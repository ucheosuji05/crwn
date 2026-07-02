import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Modal, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Check, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useUnreadCount } from '../context/UnreadCountContext';
import { bookingService } from '../services/bookingService';
import { supabase } from '../config/supabase';

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmtTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return null;
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 || 12;
  const mm = m && m !== 0 ? `:${String(m).padStart(2, '0')}` : '';
  return `${dh}${mm} ${period}`;
}

// ── Type config ────────────────────────────────────────────────────────────────

const TYPE_CFG = {
  booking_request:   { icon: 'calendar-outline', color: '#F59E0B', bg: '#FEF9EC', label: 'New Request'  },
  booking_confirmed: { lucideIcon: Check,        color: '#3F523F', bg: '#E8F0E8', label: 'Confirmed'    },
  booking_declined:  { lucideIcon: X,             color: '#A0522D', bg: '#F5E8E8', label: 'Declined'     },
};

function getTypeCfg(type) {
  return TYPE_CFG[type] || { icon: 'notifications-outline', color: '#C8835A', bg: '#FDF1EE', label: 'Notification' };
}

// ── Booking detail bottom sheet ───────────────────────────────────────────────

function fmtDuration(min) {
  if (!min) return null;
  if (min < 60) return `${min} min`;
  const h = min / 60;
  if (h % 1 === 0) return `${h} hour${h !== 1 ? 's' : ''}`;
  return `${Math.floor(h)} hr ${min % 60} min`;
}

function ServiceRow({ label, value, pill, last, colors, styles }) {
  return (
    <>
      <View style={styles.serviceRow}>
        <Text style={[styles.serviceLabel, { color: colors.textMuted }]}>{label}</Text>
        {pill ? (
          <View style={[styles.depositPill, { backgroundColor: colors.borderLight }]}>
            <Text style={[styles.depositPillText, { color: colors.textSecondary || colors.textMuted }]}>{pill}</Text>
          </View>
        ) : (
          <Text style={[styles.serviceValue, { color: colors.text }]}>{value || '—'}</Text>
        )}
      </View>
      {!last && <View style={[styles.rowDivider, { backgroundColor: colors.borderLight }]} />}
    </>
  );
}

function BookingDetailModal({ visible, notif, booking, hairProfile, loading, colors, onClose, onAccept, onDecline, submitting }) {
  const styles = useMemo(() => makeModalStyles(colors), [colors]);

  // Client info: from booking.client (request path) or notif.actor (notification path)
  const actor      = booking?.client || notif?.actor;
  const clientName = actor?.full_name || actor?.username || 'Client';
  const initial    = clientName.charAt(0).toUpperCase();
  const isPending  = booking?.status === 'pending' || notif?.type === 'booking_request';

  // "Client since" uses profile created_at when available, otherwise omitted
  const clientSince = actor?.created_at
    ? new Date(actor.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  const timeLabel     = booking?.appointment_time ? (fmtTime(booking.appointment_time) || booking.appointment_time) : 'Any time';
  const durationLabel = fmtDuration(booking?.duration_min);
  const depositLabel  = 'Pending'; // all requests start as pending

  const hasHair = hairProfile && (hairProfile.hair_type || hairProfile.porosity || hairProfile.density || hairProfile.texture);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Backdrop — tap to dismiss */}
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.card, { backgroundColor: colors.surface }]}>

          {loading ? (
            <View style={styles.loadingCenter}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : (
            <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>

              {/* Modal header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Booking Request</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Client row */}
              <View style={styles.clientRow}>
                {actor?.avatar_url ? (
                  <Image source={{ uri: actor.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primaryLight || '#FDF1EE' }]}>
                    <Text style={[styles.avatarInitial, { color: colors.primary }]}>{initial}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.clientName, { color: colors.text }]}>{clientName}</Text>
                  {clientSince
                    ? <Text style={[styles.clientSub, { color: colors.textMuted }]}>Client since {clientSince}</Text>
                    : actor?.username
                      ? <Text style={[styles.clientSub, { color: colors.textMuted }]}>@{actor.username}</Text>
                      : null}
                </View>
              </View>

              {/* SERVICE DETAILS */}
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionBlockLabel, { color: colors.textMuted }]}>SERVICE DETAILS</Text>
                <View style={[styles.detailsBox, { borderColor: colors.borderLight, backgroundColor: colors.background }]}>
                  <ServiceRow label="Service"  value={booking?.service_name} last={!durationLabel && !booking?.notes} colors={colors} styles={styles} />
                  <ServiceRow label="Time"     value={timeLabel}             last={!durationLabel && !booking?.notes} colors={colors} styles={styles} />
                  {durationLabel && (
                    <ServiceRow label="Duration" value={durationLabel} last={!booking?.notes} colors={colors} styles={styles} />
                  )}
                  {booking?.notes && (
                    <ServiceRow label="Notes" value={booking.notes} last={true} colors={colors} styles={styles} />
                  )}
                  <ServiceRow label="Deposit Status" pill={depositLabel} last={true} colors={colors} styles={styles} />
                </View>
              </View>

              {/* HAIR PROFILE */}
              {hasHair && (
                <View style={styles.sectionBlock}>
                  <Text style={[styles.sectionBlockLabel, { color: colors.textMuted }]}>HAIR PROFILE</Text>
                  <View style={[styles.detailsBox, { borderColor: colors.borderLight, backgroundColor: colors.background }]}>
                    <View style={styles.hairGrid}>
                      {hairProfile.hair_type && (
                        <View style={styles.hairCell}>
                          <Text style={[styles.hairLabel, { color: colors.textMuted }]}>Hair Type</Text>
                          <Text style={[styles.hairValue, { color: colors.text }]}>{hairProfile.hair_type}</Text>
                        </View>
                      )}
                      {hairProfile.porosity && (
                        <View style={styles.hairCell}>
                          <Text style={[styles.hairLabel, { color: colors.textMuted }]}>Porosity</Text>
                          <Text style={[styles.hairValue, { color: colors.text }]}>{hairProfile.porosity}</Text>
                        </View>
                      )}
                      {hairProfile.density && (
                        <View style={styles.hairCell}>
                          <Text style={[styles.hairLabel, { color: colors.textMuted }]}>Density</Text>
                          <Text style={[styles.hairValue, { color: colors.text }]}>{hairProfile.density}</Text>
                        </View>
                      )}
                      {hairProfile.texture && (
                        <View style={styles.hairCell}>
                          <Text style={[styles.hairLabel, { color: colors.textMuted }]}>Texture</Text>
                          <Text style={[styles.hairValue, { color: colors.text }]}>{hairProfile.texture}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Action buttons */}
              {isPending ? (
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[styles.declineBtn, { borderColor: colors.border }]}
                    onPress={onDecline}
                    disabled={!!submitting}
                    activeOpacity={0.75}
                  >
                    {submitting === 'decline'
                      ? <ActivityIndicator size="small" color={colors.textMuted} />
                      : <Text style={[styles.declineBtnText, { color: colors.text }]}>Decline</Text>
                    }
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.acceptBtn}
                    onPress={onAccept}
                    disabled={!!submitting}
                    activeOpacity={0.85}
                  >
                    <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} borderRadius={14} />
                    {submitting === 'accept'
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.acceptBtnText}>Accept</Text>
                    }
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.closeBtn, { borderColor: colors.borderLight }]}
                  onPress={onClose}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>Close</Text>
                </TouchableOpacity>
              )}

            </ScrollView>
          )}

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────────
// Stylist-side notifications: pending booking requests + booking status updates.
// Messages/conversations live in the separate Messaging screen (see header button
// below) — this screen used to combine both, split apart so the bottom-nav bell
// tab shows notifications only.

export default function StylistNotificationsScreen() {
  const { user }               = useAuth();
  const { colors }             = useTheme();
  const { clearBookingNotifs, msgCount } = useUnreadCount();
  const navigation             = useNavigation();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [requests,      setRequests]      = useState([]);  // pending bookings
  const [notifications, setNotifications] = useState([]);  // booking update notifs
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [actionError,   setActionError]   = useState(null);
  const [submitting,    setSubmitting]    = useState(null); // bookingId being acted on

  // Detail modal
  const [selectedBooking,    setSelectedBooking]    = useState(null); // full booking row
  const [selectedNotif,      setSelectedNotif]      = useState(null); // notif for context
  const [clientHairProfile,  setClientHairProfile]  = useState(null); // client's hair data
  const [bookingLoading,     setBookingLoading]     = useState(false);
  const [modalSubmitting,    setModalSubmitting]    = useState(null);

  // ── Fetch pending booking requests ────────────────────────────────────────
  const fetchRequests = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`id, service_name, appointment_date, appointment_time, duration_min, notes, status, created_at,
                 client:user_id (id, username, full_name, avatar_url)`)
        .eq('stylist_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) console.error('[fetchRequests]', JSON.stringify(error));
      setRequests(data || []);
    } catch (err) {
      console.error('[fetchRequests] threw:', err);
    }
  }, [user?.id]);

  // ── Fetch booking notifications (updates, confirmations, etc.) ────────────
  const fetchNotifs = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('booking_notifications')
        .select(`*, actor:actor_id (id, username, full_name, avatar_url)`)
        .eq('user_id', user.id)
        .neq('type', 'booking_request')
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) console.error('[fetchNotifs]', JSON.stringify(error));
      setNotifications(data || []);
    } catch (err) {
      console.error('[fetchNotifs] threw:', err);
    }
  }, [user?.id]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchRequests(), fetchNotifs()]);
  }, [fetchRequests, fetchNotifs]);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));
    if (user?.id) bookingService.markAllRead(user.id).then(() => clearBookingNotifs?.());

    // Realtime: new booking → refresh requests; new notif → refresh notifs
    const ch = supabase
      .channel(`stylist_notifs:${user?.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings',
          filter: `stylist_id=eq.${user?.id}` }, fetchRequests)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings',
          filter: `stylist_id=eq.${user?.id}` }, fetchRequests)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'booking_notifications',
          filter: `user_id=eq.${user?.id}` }, fetchNotifs)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchAll, user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }, [fetchAll]);

  // ── Accept a booking request ───────────────────────────────────────────────
  const handleAccept = useCallback(async (booking) => {
    setSubmitting(booking.id);
    setActionError(null);
    const { error } = await bookingService.acceptBooking(booking.id);
    if (error) {
      setActionError('Could not accept booking. Please try again.');
      setSubmitting(null);
      return;
    }
    if (booking.client?.id) {
      await bookingService.sendNotification(booking.client.id, {
        title: 'Booking Confirmed',
        body: `Your ${booking.service_name} appointment has been confirmed.`,
        type: 'booking_confirmed',
        bookingId: booking.id,
        actorId: user.id,
      });
    }
    setRequests(prev => prev.filter(r => r.id !== booking.id));
    setSubmitting(null);
    setSelectedBooking(null);
  }, [user?.id]);

  // ── Decline a booking request ──────────────────────────────────────────────
  const handleDecline = useCallback(async (booking) => {
    setSubmitting(booking.id);
    setActionError(null);
    const { error } = await bookingService.declineBooking(booking.id);
    if (error) {
      setActionError('Could not decline booking. Please try again.');
      setSubmitting(null);
      return;
    }
    if (booking.client?.id) {
      await bookingService.sendNotification(booking.client.id, {
        title: 'Booking Update',
        body: 'Your booking request was not accepted. Feel free to request another time.',
        type: 'booking_declined',
        bookingId: booking.id,
        actorId: user.id,
      });
    }
    setRequests(prev => prev.filter(r => r.id !== booking.id));
    setSubmitting(null);
    setSelectedBooking(null);
  }, [user?.id]);

  // ── Fetch hair profile for a client ──────────────────────────────────────
  const fetchHairProfile = useCallback(async (clientId) => {
    if (!clientId) return;
    const { data } = await supabase
      .from('hair_profiles')
      .select('hair_type, porosity, density, texture, length, goals')
      .eq('user_id', clientId)
      .single();
    setClientHairProfile(data || null);
  }, []);

  // ── Open detail popup (from request card tap) ─────────────────────────────
  const openDetail = useCallback((booking, notif = null) => {
    setSelectedBooking(booking);
    setSelectedNotif(notif);
    setClientHairProfile(null);
    const clientId = booking?.client?.id;
    if (clientId) fetchHairProfile(clientId);
  }, [fetchHairProfile]);

  // ── Tap a notification row (fetch booking + hair profile) ─────────────────
  const handleNotifPress = useCallback(async (notif) => {
    if (!notif.booking_id) return;
    setBookingLoading(true);
    setSelectedBooking(null);
    setSelectedNotif(notif);
    setClientHairProfile(null);

    const { data: bData } = await supabase
      .from('bookings')
      .select(`id, service_name, appointment_date, appointment_time, duration_min, notes, status, created_at,
               client:user_id (id, username, full_name, avatar_url)`)
      .eq('id', notif.booking_id)
      .single();

    setSelectedBooking(bData || null);
    setBookingLoading(false);

    // Fetch hair profile in parallel
    const clientId = bData?.client?.id || notif?.actor?.id;
    if (clientId) fetchHairProfile(clientId);
  }, [fetchHairProfile]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.header}><Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text></View>
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      </SafeAreaView>
    );
  }

  const isEmpty = requests.length === 0 && notifications.length === 0;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
        <TouchableOpacity
          style={styles.headerChatBtn}
          onPress={() => navigation.navigate('Messaging')}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="mail-outline" size={22} color={colors.text} />
          {msgCount > 0 && (
            <View style={[styles.headerChatBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.headerChatBadgeText}>{msgCount > 9 ? '9+' : msgCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Error banner */}
      {!!actionError && (
        <View style={[styles.alertBar, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
          <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
          <Text style={[styles.alertBarText, { color: '#EF4444', flex: 1 }]}>{actionError}</Text>
          <TouchableOpacity onPress={() => setActionError(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, isEmpty && styles.scrollEmpty]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {isEmpty ? (
          <View style={styles.center}>
            <Ionicons name="notifications-outline" size={52} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No notifications yet</Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              Booking requests and updates will appear here
            </Text>
          </View>
        ) : (
          <>
            {/* ── REQUESTS ── */}
            {requests.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>REQUESTS</Text>
                {requests.map(b => {
                  const clientName = b.client?.full_name || b.client?.username || 'Client';
                  const initial    = clientName.charAt(0).toUpperCase();
                  const dateLabel  = b.appointment_date
                    ? new Date(b.appointment_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : null;
                  const timeLabel  = fmtTime(b.appointment_time);
                  const isActing   = submitting === b.id;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.requestCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                      onPress={() => openDetail(b)}
                      activeOpacity={0.82}
                    >
                      <View style={styles.requestTop}>
                        {b.client?.avatar_url
                          ? <Image source={{ uri: b.client.avatar_url }} style={styles.reqAvatar} />
                          : <View style={[styles.reqAvatar, styles.reqAvatarFallback, { backgroundColor: colors.primaryLight || '#FDF1EE' }]}>
                              <Text style={[styles.reqInitial, { color: colors.primary }]}>{initial}</Text>
                            </View>
                        }
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.reqName, { color: colors.text }]}>{clientName}</Text>
                          <Text style={[styles.reqService, { color: colors.textMuted }]}>{b.service_name}</Text>
                          {(dateLabel || timeLabel) && (
                            <Text style={[styles.reqDateTime, { color: colors.textSecondary }]}>
                              {[dateLabel, timeLabel].filter(Boolean).join(', ')}
                            </Text>
                          )}
                        </View>
                        <View style={[styles.pendingPill, { backgroundColor: '#FEF9EC' }]}>
                          <View style={[styles.pendingDot, { backgroundColor: '#F59E0B' }]} />
                          <Text style={[styles.pendingText, { color: '#92601A' }]}>Pending</Text>
                        </View>
                      </View>

                      <View style={styles.reqActions}>
                        <TouchableOpacity
                          style={[styles.reqDeclineBtn, { borderColor: colors.border }]}
                          onPress={(e) => { e.stopPropagation?.(); handleDecline(b); }}
                          disabled={isActing}
                          activeOpacity={0.75}
                        >
                          {isActing
                            ? <ActivityIndicator size="small" color={colors.textMuted} />
                            : <Text style={[styles.reqDeclineText, { color: colors.text }]}>Decline</Text>
                          }
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.reqAcceptBtn}
                          onPress={(e) => { e.stopPropagation?.(); handleAccept(b); }}
                          disabled={isActing}
                          activeOpacity={0.85}
                        >
                          <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} borderRadius={12} />
                          {isActing
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Text style={styles.reqAcceptText}>Accept</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── NOTIFICATIONS ── */}
            {notifications.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>NOTIFICATIONS</Text>
                <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                  {notifications.map((notif, i) => {
                    const cfg    = getTypeCfg(notif.type);
                    const actor  = notif.actor;
                    const isLast = i === notifications.length - 1;
                    return (
                      <TouchableOpacity
                        key={notif.id}
                        style={[styles.notifRow, !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderLight }]}
                        onPress={() => handleNotifPress(notif)}
                        activeOpacity={0.75}
                      >
                        {actor?.avatar_url
                          ? <Image source={{ uri: actor.avatar_url }} style={styles.notifAvatar} />
                          : <View style={[styles.notifAvatar, { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' }]}>
                              <Ionicons name="person" size={18} color={colors.border} />
                            </View>
                        }
                        <View style={{ flex: 1 }}>
                          <View style={styles.msgTopRow}>
                            <Text style={[styles.notifTitle, { color: colors.text }]} numberOfLines={1}>{notif.title}</Text>
                            {!notif.is_read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}
                          </View>
                          {notif.body
                            ? <Text style={[styles.msgPreview, { color: colors.textMuted }]} numberOfLines={2}>{notif.body}</Text>
                            : null}
                          <Text style={[styles.notifTime, { color: colors.textMuted }]}>{timeAgo(notif.created_at)}</Text>
                        </View>
                        <View style={[styles.notifIcon, { backgroundColor: cfg.bg }]}>
                          {cfg.lucideIcon ? (
                            <cfg.lucideIcon size={16} color={cfg.color} strokeWidth={2} />
                          ) : (
                            <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Booking detail modal */}
      <BookingDetailModal
        visible={!!selectedBooking || bookingLoading}
        notif={selectedNotif}
        booking={selectedBooking}
        hairProfile={clientHairProfile}
        loading={bookingLoading}
        colors={colors}
        onClose={() => { setSelectedBooking(null); setSelectedNotif(null); setClientHairProfile(null); }}
        onAccept={() => selectedBooking && handleAccept(selectedBooking)}
        onDecline={() => selectedBooking && handleDecline(selectedBooking)}
        submitting={modalSubmitting}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  safe:   { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 22, fontFamily: 'LibreBaskerville_700Bold' },
  headerChatBtn: { position: 'relative', padding: 4 },
  headerChatBadge: {
    position: 'absolute', top: 0, right: 0,
    minWidth: 16, height: 16, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  headerChatBadgeText: { fontSize: 9, fontFamily: 'Figtree_700Bold', color: '#fff' },

  // ScrollView container
  scroll:      { paddingBottom: 28 },
  scrollEmpty: { flex: 1 },

  // Section wrapper
  section:      { marginTop: 22 },
  sectionLabel: {
    fontSize: 11, fontFamily: 'Figtree_700Bold', letterSpacing: 0.9,
    marginBottom: 10, paddingHorizontal: 20,
  },

  // Grouped card container (notifications)
  listCard: {
    marginHorizontal: 16,
    borderRadius: 16, borderWidth: 1,
    overflow: 'hidden',
  },

  // Request card (standalone per-booking card)
  requestCard: {
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, borderWidth: 1,
    padding: 16, overflow: 'hidden',
  },
  requestTop: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14,
  },
  reqAvatar:         { width: 46, height: 46, borderRadius: 23, flexShrink: 0 },
  reqAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  reqInitial:  { fontSize: 18, fontFamily: 'Figtree_700Bold' },
  reqName:     { fontSize: 15, fontFamily: 'Figtree_700Bold', marginBottom: 2 },
  reqService:  { fontSize: 13, fontFamily: 'Figtree_400Regular', marginBottom: 2 },
  reqDateTime: { fontSize: 12, fontFamily: 'Figtree_500Medium' },

  // Pending pill badge
  pendingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    alignSelf: 'flex-start',
  },
  pendingDot:  { width: 6, height: 6, borderRadius: 3 },
  pendingText: { fontSize: 11, fontFamily: 'Figtree_600SemiBold' },

  // Request accept / decline buttons
  reqActions: { flexDirection: 'row', gap: 10 },
  reqDeclineBtn: {
    flex: 1, borderRadius: 12, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  reqDeclineText: { fontSize: 13, fontFamily: 'Figtree_600SemiBold' },
  reqAcceptBtn: {
    flex: 2, borderRadius: 12, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  reqAcceptText: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: '#fff' },

  // Notification row (inside listCard)
  msgTopRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  msgPreview: { fontSize: 13, fontFamily: 'Figtree_400Regular', lineHeight: 17 },
  notifRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  notifIcon: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifTitle:  { fontSize: 14, fontFamily: 'Figtree_600SemiBold', flex: 1 },
  notifTime:   { fontSize: 11, fontFamily: 'Figtree_400Regular', marginTop: 3 },
  notifAvatar: { width: 44, height: 44, borderRadius: 22, flexShrink: 0 },
  unreadDot:   { width: 7, height: 7, borderRadius: 3.5 },

  // Empty state
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyContainer: { flex: 1 },
  emptyText:      { fontSize: 16, fontFamily: 'Figtree_600SemiBold' },
  emptySub:       { fontSize: 13, fontFamily: 'Figtree_400Regular', textAlign: 'center', lineHeight: 19 },

  // Alert / error banner
  alertBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 10, marginBottom: 2,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1,
  },
  alertBarText:    { fontSize: 13, fontFamily: 'Figtree_500Medium' },
  alertAction:     { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, borderWidth: 1 },
  alertActionText: { fontSize: 12, fontFamily: 'Figtree_600SemiBold' },
});

// ── Booking detail bottom-sheet styles ───────────────────────────────────────
const makeModalStyles = (c) => StyleSheet.create({
  // Bottom sheet
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    width: '100%',
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  loadingCenter: { paddingVertical: 60, alignItems: 'center' },

  // Header: "Booking Request" + X
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold' },

  // Client row
  clientRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 4,
  },
  avatar:        { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 20, fontFamily: 'Figtree_700Bold' },
  clientName:    { fontSize: 16, fontFamily: 'Figtree_700Bold', marginBottom: 3 },
  clientSub:     { fontSize: 13, fontFamily: 'Figtree_400Regular' },

  // Section block (SERVICE DETAILS / HAIR PROFILE)
  sectionBlock: { marginTop: 20, marginHorizontal: 20 },
  sectionBlockLabel: {
    fontSize: 11, fontFamily: 'Figtree_700Bold', letterSpacing: 0.8,
    marginBottom: 10,
  },

  // Detail rows box
  detailsBox: {
    borderRadius: 14, borderWidth: 1,
    overflow: 'hidden',
  },

  // Service row: label (left) | value / pill (right)
  serviceRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  serviceLabel: { fontSize: 14, fontFamily: 'Figtree_400Regular' },
  serviceValue: { fontSize: 14, fontFamily: 'Figtree_600SemiBold', textAlign: 'right', flexShrink: 1, marginLeft: 8 },
  rowDivider:   { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  // Deposit status pill
  depositPill: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  depositPillText: { fontSize: 12, fontFamily: 'Figtree_500Medium' },

  // Hair profile 2-column grid
  hairGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 8, paddingVertical: 8,
  },
  hairCell: {
    width: '50%',
    paddingHorizontal: 10, paddingVertical: 10,
  },
  hairLabel: { fontSize: 11, fontFamily: 'Figtree_500Medium', marginBottom: 4 },
  hairValue: { fontSize: 14, fontFamily: 'Figtree_600SemiBold' },

  // Action buttons
  btnRow: {
    flexDirection: 'row', gap: 12,
    marginHorizontal: 20, marginTop: 24, marginBottom: 4,
  },
  declineBtn: {
    flex: 1, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  declineBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  acceptBtn: {
    flex: 2, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  acceptBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
  closeBtn: {
    marginHorizontal: 20, marginTop: 20,
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
  },
  closeBtnText: { fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
});
