import { supabase } from '../config/supabase';

export const bookingService = {
  // ── Client side ───────────────────────────────────────────────────────────

  async getBookingsByUser(userId) {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        service_name,
        appointment_date,
        appointment_time,
        status,
        duration_min,
        notes,
        created_at,
        stylist:stylist_id (id, username, full_name, avatar_url)
      `)
      .eq('user_id', userId)
      .order('appointment_date', { ascending: false });

    if (error) console.error('[getBookingsByUser]', JSON.stringify(error));
    return { data, error };
  },

  // ── Stylist side ──────────────────────────────────────────────────────────

  /** All bookings where this user is the stylist */
  async getBookingsByStylist(stylistId) {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        id,
        service_name,
        appointment_date,
        appointment_time,
        status,
        duration_min,
        notes,
        created_at,
        client:user_id (id, username, full_name, avatar_url)
      `)
      .eq('stylist_id', stylistId)
      .order('appointment_date', { ascending: true });

    if (error) console.error('[getBookingsByStylist]', JSON.stringify(error));
    return { data, error };
  },

  /**
   * Client creates a booking request — starts as 'pending' until the stylist
   * explicitly accepts it. Pending bookings do NOT show on the stylist's
   * calendar and do NOT block other clients' time slots.
   * Also fires a booking_notification to the stylist so they see it immediately.
   */
  async createBooking({ userId, stylistId, serviceName, appointmentDate, appointmentTime, notes, durationMin }) {
    // ── Duplicate guard ────────────────────────────────────────────────────────
    // Reject if the client already has an active booking with this stylist on
    // the same date (and same time slot when a time is provided).
    try {
      let dupQuery = supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('user_id',          userId)
        .eq('stylist_id',       stylistId)
        .eq('appointment_date', appointmentDate)
        .in('status', ['pending', 'upcoming', 'confirmed']);

      if (appointmentTime) {
        dupQuery = dupQuery.eq('appointment_time', appointmentTime);
      }

      const { count } = await dupQuery;
      if (count > 0) {
        const msg = appointmentTime
          ? 'You already have a booking at this time. Please choose a different slot.'
          : 'You already have a booking on this date with this stylist.';
        return { data: null, error: { message: msg, code: 'DUPLICATE' } };
      }
    } catch (_) {
      // If the check fails for any reason, allow the insert to proceed
    }
    // ──────────────────────────────────────────────────────────────────────────

    // Base record without optional columns that may not be migrated yet
    const baseRecord = {
      user_id:          userId,
      stylist_id:       stylistId,
      service_name:     serviceName,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime || null,
      notes:            notes || null,
      status:           'pending',
    };

    // First attempt — include duration_min if provided
    let { data, error } = await supabase
      .from('bookings')
      .insert([durationMin ? { ...baseRecord, duration_min: durationMin } : baseRecord])
      .select()
      .single();

    // If the column doesn't exist yet (42703), silently retry without it
    if (error?.code === '42703') {
      ({ data, error } = await supabase
        .from('bookings')
        .insert([baseRecord])
        .select()
        .single());
    }

    // Log the actual DB error so it shows in the console during debugging
    if (error) {
      console.error('[bookingService] createBooking failed:', JSON.stringify(error));
    }

    // Notify the stylist of the incoming request (fire-and-forget)
    if (!error && data) {
      const dateLabel = appointmentDate
        ? new Date(appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';
      this.sendNotification(stylistId, {
        title: 'New Booking Request',
        body: `${serviceName}${dateLabel ? ` — ${dateLabel}` : ''}`,
        type: 'booking_request',
        bookingId: data.id,
        actorId: userId,
      });
    }

    return { data, error };
  },

  /** Stylist accepts a pending booking → status becomes 'upcoming' */
  async acceptBooking(bookingId) {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'upcoming' })
      .eq('id', bookingId)
      .select()
      .single();
    return { data, error };
  },

  /** Stylist declines a pending booking → status becomes 'cancelled' */
  async declineBooking(bookingId) {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .select()
      .single();
    return { data, error };
  },

  /**
   * Fetch confirmed bookings for a specific stylist on a given date.
   * Used by the client booking modal to filter out already-taken time slots
   * based on duration (e.g. a 2-hour service blocks both the start hour and
   * the hour following it).
   */
  async getConfirmedBookingsForDate(stylistId, dateStr) {
    const { data, error } = await supabase
      .from('bookings')
      .select('id, appointment_time, duration_min, service_name')
      .eq('stylist_id', stylistId)
      .eq('appointment_date', dateStr)
      .in('status', ['upcoming', 'confirmed']); // treat both as accepted
    return { data: data || [], error };
  },

  /** Stylist reschedules an accepted booking — updates date and/or time */
  async rescheduleBooking(bookingId, { appointmentDate, appointmentTime }) {
    const { data, error } = await supabase
      .from('bookings')
      .update({
        appointment_date: appointmentDate,
        appointment_time: appointmentTime || null,
      })
      .eq('id', bookingId)
      .select()
      .single();
    return { data, error };
  },

  /** Update booking status (complete / cancel / admin use) */
  async updateBookingStatus(bookingId, status) {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .select()
      .single();

    return { data, error };
  },

  // ── Booking Notifications ─────────────────────────────────────────────────
  // Uses a dedicated `booking_notifications` table separate from the social
  // notifications table. Run this SQL once in Supabase SQL Editor:
  //
  // CREATE TABLE IF NOT EXISTS booking_notifications (
  //   id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  //   user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  //   title      text NOT NULL,
  //   body       text,
  //   type       text,   -- 'booking_request' | 'booking_confirmed' | 'booking_declined'
  //   booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  //   actor_id   uuid REFERENCES profiles(id) ON DELETE SET NULL,
  //   is_read    boolean DEFAULT false,
  //   created_at timestamptz DEFAULT now()
  // );
  // CREATE INDEX IF NOT EXISTS idx_booking_notifs_user
  //   ON booking_notifications(user_id, created_at DESC);
  // ALTER TABLE booking_notifications ENABLE ROW LEVEL SECURITY;
  // CREATE POLICY "Users view own booking notifications" ON booking_notifications
  //   FOR SELECT USING (auth.uid() = user_id);
  // CREATE POLICY "Authenticated users insert booking notifications" ON booking_notifications
  //   FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  // CREATE POLICY "Users update own booking notifications" ON booking_notifications
  //   FOR UPDATE USING (auth.uid() = user_id);

  /** Send a booking notification to a user. Silent no-op if table doesn't exist. */
  async sendNotification(userId, { title, body, type, bookingId, actorId }) {
    try {
      await supabase
        .from('booking_notifications')
        .insert({
          user_id:    userId,
          title,
          body,
          type,
          booking_id: bookingId || null,
          actor_id:   actorId   || null,
          is_read:    false,
        });
    } catch (_) {}
  },

  /** Get unread booking notification count. Returns 0 if table doesn't exist. */
  async getUnreadCount(userId) {
    try {
      const { count, error } = await supabase
        .from('booking_notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      if (error) return 0;
      return count ?? 0;
    } catch (_) { return 0; }
  },

  /** Mark all of a user's booking notifications as read. */
  async markAllRead(userId) {
    try {
      await supabase
        .from('booking_notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    } catch (_) {}
  },

  /** Mark a single booking notification as read. */
  async markBookingNotificationRead(notifId) {
    try {
      await supabase
        .from('booking_notifications')
        .update({ is_read: true })
        .eq('id', notifId);
    } catch (_) {}
  },

  /**
   * Fetch recent booking notifications for a user (client or stylist).
   * Joins actor profile for avatar/name display.
   */
  async getBookingNotifications(userId) {
    try {
      const { data, error } = await supabase
        .from('booking_notifications')
        .select(`
          id, title, body, type, booking_id, is_read, created_at,
          actor:actor_id (id, username, full_name, avatar_url)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      // Gracefully handle missing table
      if (error?.code === '42P01') return { data: [], error: null };
      if (error) console.error('[getBookingNotifications]', JSON.stringify(error));
      return { data: data || [], error };
    } catch (_) { return { data: [], error: null }; }
  },

  // ── Services ──────────────────────────────────────────────────────────────

  async getServices(stylistId) {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('stylist_id', stylistId)
      .order('created_at', { ascending: true });

    // Gracefully handle missing table
    if (error?.code === '42P01') return { data: [], error: null, notMigrated: true };
    return { data: data || [], error };
  },

  async addService(stylistId, service) {
    const { data, error } = await supabase
      .from('services')
      .insert([{ stylist_id: stylistId, ...service }])
      .select()
      .single();

    return { data, error };
  },

  async updateService(serviceId, updates) {
    const { data, error } = await supabase
      .from('services')
      .update(updates)
      .eq('id', serviceId)
      .select()
      .single();

    return { data, error };
  },

  async deleteService(serviceId) {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', serviceId);

    return { error };
  },

  // ── Client-side cancellation ───────────────────────────────────────────────

  /**
   * Client immediately cancels a PENDING (not yet accepted) booking.
   * No stylist approval required — the booking is cancelled straight away.
   */
  async cancelPendingByClient(bookingId, { stylistId, userId, serviceName } = {}) {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .eq('status', 'pending');   // guard: only works while still pending
    // Note: no .select().single() — avoids PGRST116 when RLS filters the return

    if (!error && stylistId) {
      this.sendNotification(stylistId, {
        title: 'Booking Withdrawn',
        body:  `${serviceName} — request cancelled by client.`,
        type:  'booking_declined',
        bookingId,
        actorId: userId,
      });
    }
    return { error };
  },

  /**
   * Client requests cancellation of an already-accepted booking.
   * Sets status to 'cancellation_requested' and notifies the stylist.
   * The appointment stays on the calendar until the stylist approves/denies.
   */
  async requestCancellation(bookingId, { stylistId, userId, serviceName, appointmentDate } = {}) {
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancellation_requested' })
      .eq('id', bookingId)
      .in('status', ['upcoming', 'confirmed']);
    // Note: no .select().single() — avoids PGRST116 when RLS filters the return

    if (!error && stylistId) {
      const dateLabel = appointmentDate
        ? new Date(appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : '';
      this.sendNotification(stylistId, {
        title: 'Cancellation Request',
        body:  `${serviceName}${dateLabel ? ` — ${dateLabel}` : ''} · Client requesting cancellation`,
        type:  'cancellation_requested',
        bookingId,
        actorId: userId,
      });
    }
    return { error };
  },

  /** Stylist approves a client's cancellation request → booking becomes 'cancelled' */
  async approveCancellation(bookingId, { clientId, stylistId, serviceName } = {}) {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .select()
      .single();

    if (!error && data && clientId) {
      this.sendNotification(clientId, {
        title: 'Cancellation Approved',
        body:  `Your ${serviceName} appointment has been cancelled.`,
        type:  'booking_declined',
        bookingId,
        actorId: stylistId,
      });
    }
    return { data, error };
  },

  /** Stylist denies a client's cancellation request → booking restored to 'upcoming' */
  async denyCancellation(bookingId, { clientId, stylistId, serviceName } = {}) {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status: 'upcoming' })
      .eq('id', bookingId)
      .select()
      .single();

    if (!error && data && clientId) {
      this.sendNotification(clientId, {
        title: 'Cancellation Denied',
        body:  `Your cancellation request for ${serviceName} was not approved. Your appointment is still scheduled.`,
        type:  'booking_confirmed',
        bookingId,
        actorId: stylistId,
      });
    }
    return { data, error };
  },
};
