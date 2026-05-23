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
        deposit_status,
        duration_min,
        notes,
        created_at,
        stylist:stylist_id (id, username, business_name, full_name, avatar_url)
      `)
      .eq('user_id', userId)
      .order('appointment_date', { ascending: false });

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
        notes,
        created_at,
        client:user_id (id, username, full_name, avatar_url)
      `)
      .eq('stylist_id', stylistId)
      .order('appointment_date', { ascending: true });

    return { data, error };
  },

  /** Client creates a booking with a stylist */
  async createBooking({ userId, stylistId, serviceName, appointmentDate, appointmentTime, notes }) {
    const { data, error } = await supabase
      .from('bookings')
      .insert([{
        user_id: userId,
        stylist_id: stylistId,
        service_name: serviceName,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime || null,
        notes: notes || null,
        status: 'upcoming',
      }])
      .select()
      .single();

    return { data, error };
  },

  /** Update booking status (confirm / complete / cancel) */
  async updateBookingStatus(bookingId, status) {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .select()
      .single();

    return { data, error };
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
};
