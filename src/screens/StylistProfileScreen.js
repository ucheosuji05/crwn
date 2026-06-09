import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, Modal, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
  Animated, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Crown, Scissors } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingService } from '../services/bookingService';
import { postService } from '../services/postService';
import { profileService } from '../services/profileService';
import { reviewService } from '../services/reviewService';
import { injectScrollbarCSS } from '../utils/injectScrollbarCSS';
import { supabase } from '../config/supabase';
import PostCard from '../components/PostCard';

const HONEY = '#D4930A';
const SCREEN_WIDTH = Dimensions.get('window').width;

// ── Masonry layout (mirrors the Explore feed: shortest column first,
// natural aspect ratio, capped at 1.6:1 height:width) ──
const MASONRY_GAP = 10;
const MASONRY_PAD = 12;
const MASONRY_DEFAULT_AR = 1;
const MASONRY_MAX_HW = 1.6;
const MASONRY_HW_LANDSCAPE_MAX = 0.8; // shorter than this (height:width) → landscape, spans full width
const MASONRY_COLUMN_WIDTH = (SCREEN_WIDTH - MASONRY_PAD * 2 - MASONRY_GAP) / 2;

const TABS = ['Posts', 'Services', 'Tagged'];

function formatStyleTag(tag) {
  if (!tag) return '';
  return tag
    .toString()
    .replace(/[-_]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word[0]?.toUpperCase() + word.slice(1))
    .join(' ');
}

// Shortest-column-first masonry: each post is placed into whichever column
// is currently shorter, rendered at its natural aspect ratio but capped at
// a 1.6:1 height:width ratio so very tall images don't blow out their slot.
// Mirrors the Explore feed: landscape posts span the full width once both
// columns are roughly level, and never land back to back.
function computeProfileMasonry(posts, columnWidth, imageDimensions) {
  const gap = MASONRY_GAP;
  const fullWidth = columnWidth * 2 + gap;
  let leftH = 0;
  let rightH = 0;
  let lastWasFull = false;
  const items = [];

  posts.forEach(post => {
    const dims = imageDimensions[post.id];
    const ar = dims ? dims.width / dims.height : MASONRY_DEFAULT_AR;
    const hw = 1 / ar;
    const renderAr = Math.max(ar, 1 / MASONRY_MAX_HW);

    if (!lastWasFull && hw < MASONRY_HW_LANDSCAPE_MAX && Math.abs(leftH - rightH) <= 20) {
      const top = Math.max(leftH, rightH);
      const height = fullWidth / renderAr;
      items.push({ post, column: 'full', top, height });
      const nextH = top + height + gap;
      leftH = nextH;
      rightH = nextH;
      lastWasFull = true;
      return;
    }

    lastWasFull = false;
    const height = columnWidth / renderAr;
    if (leftH <= rightH) {
      items.push({ post, column: 'left', top: leftH, height });
      leftH += height + gap;
    } else {
      items.push({ post, column: 'right', top: rightH, height });
      rightH += height + gap;
    }
  });

  return { items, totalHeight: Math.max(leftH, rightH, gap) - gap };
}

// ── Booking modal helpers ─────────────────────────────────────────────────────

const BK_MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const BK_DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const BK_TIME_OPTS  = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM – 10 PM

function bkFmtHour(h) {
  const p = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 || 12;
  return `${dh}:00 ${p}`;
}

function bkToDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function bkSameDay(a, b) {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();
}

function BookingMiniCalendar({ selectedDate, onSelectDate, colors, workSchedules = [] }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [viewMonth, setViewMonth] = useState(() =>
    selectedDate
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1)
  );

  const hasAnyScheduleAtAll = workSchedules.length > 0;

  // Returns true when the stylist has a work schedule (any kind) on this date
  const isScheduledDay = useCallback((day) =>
    workSchedules.some(s => bkSameDay(day, new Date(s.work_date + 'T00:00:00')))
  , [workSchedules]);

  // Returns true when the stylist has schedules but NOT for this date → day is unavailable
  const isUnavailableDay = useCallback((day) =>
    hasAnyScheduleAtAll && !isScheduledDay(day)
  , [hasAnyScheduleAtAll, isScheduledDay]);

  // Returns true when the stylist has a partial-hours schedule on this date (not all-day)
  const hasPartialSchedule = useCallback((day) =>
    workSchedules.some(s => !s.all_day && bkSameDay(day, new Date(s.work_date + 'T00:00:00')))
  , [workSchedules]);

  const cells = useMemo(() => {
    const year  = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const out   = [];
    for (let i = 0; i < first; i++) out.push(null);
    for (let d = 1; d <= total; d++) out.push(new Date(year, month, d));
    return out;
  }, [viewMonth]);

  const isSame = (a, b) =>
    a && b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth()    &&
    a.getDate()     === b.getDate();

  return (
    <View>
      {/* Month navigation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <TouchableOpacity onPress={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 15, fontFamily: 'Figtree_700Bold', color: colors.text }}>
          {BK_MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </Text>
        <TouchableOpacity onPress={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      {/* Day-of-week headers */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {BK_DAYS_SHORT.map(d => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontFamily: 'Figtree_600SemiBold', color: colors.textMuted, textTransform: 'uppercase' }}>{d}</Text>
        ))}
      </View>
      {/* Date grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={{ width: '14.28%', height: 36 }} />;
          const isToday      = isSame(day, today);
          const isSelected   = isSame(day, selectedDate);
          const isPast       = day < today;
          const unavailable  = isUnavailableDay(day);
          const partialSched = !unavailable && hasPartialSchedule(day);
          const isGrey       = isPast || unavailable;
          const isDisabled   = isPast || unavailable;
          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={{ width: '14.28%', height: 36, alignItems: 'center', justifyContent: 'center', opacity: isGrey && !isSelected ? 0.38 : 1 }}
              onPress={() => onSelectDate(day)}
              disabled={isDisabled}
            >
              <View style={{
                width: 30, height: 30, borderRadius: 15,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSelected ? '#5D1F1F' : 'transparent',
              }}>
                <Text style={{
                  fontSize: 13,
                  fontFamily: isSelected ? 'Figtree_700Bold' : 'Figtree_500Medium',
                  color: isSelected ? '#fff'
                       : isGrey     ? colors.textMuted
                       : isToday    ? '#C8835A'
                       :              colors.text,
                }}>
                  {day.getDate()}
                </Text>
              </View>
              {/* Green dot for partial-hours schedule */}
              {partialSched && (
                <View style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: '#22c55e' }} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Booking modal ─────────────────────────────────────────────────────────────

function BookingModal({ visible, stylist, preselectedService, onClose, colors }) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const bs = useMemo(() => makeBookingStyles(colors), [colors]);
  const [services,           setServices]           = useState([]);
  const [selected,           setSelected]           = useState(null);
  const [selectedDate,       setSelectedDate]       = useState(null);
  const [selectedHour,       setSelectedHour]       = useState(null); // null = any time
  const [notes,              setNotes]              = useState('');
  const [submitting,         setSubmitting]         = useState(false);
  const [loadingSvc,         setLoadingSvc]         = useState(true);
  const [workSchedules,      setWorkSchedules]      = useState([]);
  // Confirmed bookings for the currently selected date (fetched on date change)
  const [confirmedForDate,   setConfirmedForDate]   = useState([]);
  const [loadingConfirmed,   setLoadingConfirmed]   = useState(false);
  const [confirmed,          setConfirmed]          = useState(false);
  const [confirmedDetails,   setConfirmedDetails]   = useState(null);
  const [bookError,          setBookError]          = useState(null);

  // Checkmark pop-in animation
  const checkAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (confirmed) {
      checkAnim.setValue(0);
      Animated.spring(checkAnim, {
        toValue: 1, useNativeDriver: true,
        tension: 70, friction: 9,
      }).start();
    }
  }, [confirmed, checkAnim]);

  useEffect(() => {
    if (!visible || !stylist?.id) return;
    setLoadingSvc(true);
    setSelectedDate(null);
    setSelectedHour(null);
    setNotes('');
    setWorkSchedules([]);
    setConfirmedForDate([]);
    setConfirmed(false);
    setConfirmedDetails(null);
    setBookError(null);

    // Load services and work schedules in parallel
    Promise.all([
      bookingService.getServices(stylist.id),
      supabase
        .from('work_schedules')
        .select('id, work_date, all_day, start_time, end_time, break_hours')
        .eq('stylist_id', stylist.id),
    ]).then(([{ data: svcData }, { data: wsData }]) => {
      setServices(svcData || []);
      setSelected(preselectedService || svcData?.[0] || null);
      setWorkSchedules(wsData || []);
      setLoadingSvc(false);
    });
  }, [visible, stylist?.id, preselectedService]);

  // When the selected date changes, fetch confirmed bookings for that day
  useEffect(() => {
    if (!selectedDate || !stylist?.id) { setConfirmedForDate([]); return; }
    setLoadingConfirmed(true);
    bookingService.getConfirmedBookingsForDate(stylist.id, bkToDateStr(selectedDate))
      .then(({ data }) => { setConfirmedForDate(data || []); })
      .finally(() => setLoadingConfirmed(false));
  }, [selectedDate, stylist?.id]);

  const reset = () => {
    setSelectedDate(null); setSelectedHour(null);
    setNotes(''); setSelected(null);
    setConfirmed(false); setConfirmedDetails(null);
    setBookError(null);
  };

  // ── Work-schedule helpers ──────────────────────────────────────────────────────
  // Does this stylist have ANY schedule set up at all?
  // If not, we show all standard hours (backward-compatible for new providers).
  const hasAnyScheduleAtAll = workSchedules.length > 0;

  // Work schedule entries for the currently selected day
  const workForDay = useMemo(() => {
    if (!selectedDate) return [];
    return workSchedules.filter(s =>
      bkSameDay(selectedDate, new Date(s.work_date + 'T00:00:00'))
    );
  }, [selectedDate, workSchedules]);

  // True when the stylist has set up schedules but hasn't added one for this day
  const selDayNotAvailable = hasAnyScheduleAtAll && workForDay.length === 0;

  const availableHours = useMemo(() => {
    const newServiceH = Math.ceil((selected?.duration_min || 60) / 60);

    // Build the set of hours the stylist has scheduled for this day.
    // If no schedule exists at all, treat every standard hour as scheduled.
    let scheduledHourSet;
    if (!hasAnyScheduleAtAll || workForDay.some(s => s.all_day)) {
      scheduledHourSet = new Set(BK_TIME_OPTS);
    } else {
      scheduledHourSet = new Set();
      workForDay.filter(s => !s.all_day && s.start_time && s.end_time).forEach(s => {
        const startH = parseInt(s.start_time.split(':')[0], 10);
        const endH   = parseInt(s.end_time.split(':')[0], 10);
        for (let h = startH; h < endH; h++) scheduledHourSet.add(h);
      });
    }

    // Build the set of break hours (hidden from clients)
    const breakHourSet = new Set();
    workForDay.forEach(s => {
      const bh = Array.isArray(s.break_hours) ? s.break_hours : [];
      bh.forEach(h => breakHourSet.add(h));
    });

    return BK_TIME_OPTS.filter(h => {
      // 1. Must be within the stylist's scheduled work window
      if (!scheduledHourSet.has(h)) return false;

      // 2. Must not fall within a break/downtime window
      if (breakHourSet.has(h)) return false;

      // 3. The new booking [h, h+newServiceH) must not overlap any confirmed booking
      if (confirmedForDate.some(b => {
        if (!b.appointment_time) return false;
        const bStart = parseInt(b.appointment_time.split(':')[0], 10);
        const bDurH  = Math.ceil((b.duration_min || 60) / 60);
        return h < bStart + bDurH && bStart < h + newServiceH;
      })) return false;

      return true;
    });
  }, [workForDay, hasAnyScheduleAtAll, confirmedForDate, selected]);

  // If currently-selected hour gets blocked by new date, reset it
  useEffect(() => {
    if (selectedHour !== null && !availableHours.includes(selectedHour)) {
      setSelectedHour(null);
    }
  }, [availableHours]);

  const handleBook = async () => {
    if (!selected)     { setBookError('Please select a service first.'); return; }
    if (!selectedDate) { setBookError('Please pick a date for your appointment.'); return; }

    setBookError(null);
    setSubmitting(true);
    try {
      const { error } = await bookingService.createBooking({
        userId:          user.id,
        stylistId:       stylist.id,
        serviceName:     selected.name,
        appointmentDate: bkToDateStr(selectedDate),
        appointmentTime: selectedHour !== null ? `${String(selectedHour).padStart(2, '0')}:00:00` : null,
        notes:           notes.trim() || null,
        durationMin:     selected.duration_min || null,
      });

      if (error) {
        console.error('[BookingModal] handleBook error:', JSON.stringify(error));
        // Show a specific message for the most common failure modes
        const msg =
          error.code === '42501' ? 'Permission denied. Please sign in and try again.' :
          error.code === '42P01' ? 'Booking table not set up yet. Contact support.' :
          error.message         ? error.message :
          'Something went wrong. Please try again.';
        setBookError(msg);
      } else {
        setConfirmedDetails({
          stylistName:  stylist.name,
          serviceName:  selected.name,
          price:        selected.price,
          date:         selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
          time:         selectedHour !== null ? bkFmtHour(selectedHour) : null,
          notes:        notes.trim() || null,
        });
        setConfirmed(true);
      }
    } catch (_) {
      setBookError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const displayDate = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'Select a date';

  const canBook = !!selected && !!selectedDate && !selDayNotAvailable && !submitting && services.length > 0;

  const isWeb = Platform.OS === 'web';

  return (
    <Modal
      visible={visible}
      animationType={isWeb ? 'fade' : 'slide'}
      transparent={isWeb}
      presentationStyle={isWeb ? 'overFullScreen' : 'pageSheet'}
      onRequestClose={() => { reset(); onClose(); }}
    >
      {/* Web: dim backdrop + centered card */}
      <View style={isWeb ? bs.webOverlay : { flex: 1 }}>
        <View style={isWeb ? [bs.webCard, { backgroundColor: colors.surface }] : { flex: 1 }}>

      {/* ── Success screen (shown after booking is submitted) ── */}
      {confirmed && confirmedDetails ? (
        <ScrollView
          contentContainerStyle={[bs.successWrap, { backgroundColor: colors.surface }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Animated checkmark circle */}
          <Animated.View style={[bs.successIconRing, {
            transform: [
              { scale: checkAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.3, 1.15, 1] }) },
            ],
            opacity: checkAnim,
          }]}>
            <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} borderRadius={40} />
            <Ionicons name="checkmark" size={36} color="#fff" />
          </Animated.View>

          <Text style={[bs.successHeading, { color: colors.text }]}>Booking Requested!</Text>
          <Text style={[bs.successSub, { color: colors.textMuted }]}>
            Your request has been sent.{'\n'}You'll be notified once {confirmedDetails.stylistName} confirms.
          </Text>

          {/* Summary card */}
          <View style={[bs.summaryCard, { borderColor: colors.borderLight, backgroundColor: colors.background }]}>
            <View style={bs.summaryRow}>
              <Scissors size={15} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[bs.summaryLabel, { color: colors.textMuted }]}>Stylist</Text>
              <Text style={[bs.summaryValue, { color: colors.text }]}>{confirmedDetails.stylistName}</Text>
            </View>
            <View style={[bs.summaryDivider, { backgroundColor: colors.borderLight }]} />
            <View style={bs.summaryRow}>
              <Ionicons name="sparkles-outline" size={15} color={colors.textMuted} />
              <Text style={[bs.summaryLabel, { color: colors.textMuted }]}>Service</Text>
              <Text style={[bs.summaryValue, { color: colors.text }]}>{confirmedDetails.serviceName}</Text>
            </View>
            {confirmedDetails.price != null && (
              <>
                <View style={[bs.summaryDivider, { backgroundColor: colors.borderLight }]} />
                <View style={bs.summaryRow}>
                  <Ionicons name="pricetag-outline" size={15} color={colors.textMuted} />
                  <Text style={[bs.summaryLabel, { color: colors.textMuted }]}>Price</Text>
                  <Text style={[bs.summaryValue, { color: colors.text }]}>${confirmedDetails.price?.toFixed(2)}</Text>
                </View>
              </>
            )}
            <View style={[bs.summaryDivider, { backgroundColor: colors.borderLight }]} />
            <View style={bs.summaryRow}>
              <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
              <Text style={[bs.summaryLabel, { color: colors.textMuted }]}>Date</Text>
              <Text style={[bs.summaryValue, { color: colors.text }]}>{confirmedDetails.date}</Text>
            </View>
            {confirmedDetails.time && (
              <>
                <View style={[bs.summaryDivider, { backgroundColor: colors.borderLight }]} />
                <View style={bs.summaryRow}>
                  <Ionicons name="time-outline" size={15} color={colors.textMuted} />
                  <Text style={[bs.summaryLabel, { color: colors.textMuted }]}>Time</Text>
                  <Text style={[bs.summaryValue, { color: colors.text }]}>{confirmedDetails.time}</Text>
                </View>
              </>
            )}
            {confirmedDetails.notes && (
              <>
                <View style={[bs.summaryDivider, { backgroundColor: colors.borderLight }]} />
                <View style={[bs.summaryRow, { alignItems: 'flex-start' }]}>
                  <Ionicons name="document-text-outline" size={15} color={colors.textMuted} style={{ marginTop: 1 }} />
                  <Text style={[bs.summaryLabel, { color: colors.textMuted }]}>Notes</Text>
                  <Text style={[bs.summaryValue, { color: colors.text, flex: 1 }]}>{confirmedDetails.notes}</Text>
                </View>
              </>
            )}
          </View>

          {/* Action buttons */}
          <TouchableOpacity
            style={bs.doneBtn}
            onPress={() => { reset(); onClose(); navigation.navigate('Crwn.'); }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} borderRadius={14} />
            <Ionicons name="home-outline" size={17} color="#fff" style={{ marginRight: 6 }} />
            <Text style={bs.doneBtnText}>Go to Home</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[bs.secondaryBtn, { borderColor: colors.borderLight }]}
            onPress={() => { reset(); onClose(); }}
            activeOpacity={0.75}
          >
            <Text style={[bs.secondaryBtnText, { color: colors.textMuted }]}>Done</Text>
          </TouchableOpacity>
        </ScrollView>

      ) : (

      /* ── Booking form ── */
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* ── Header ── */}
        <View style={bs.header}>
          <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={bs.title}>Book Appointment</Text>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView
          contentContainerStyle={bs.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Stylist strip ── */}
          <View style={[bs.stylistStrip, { borderColor: colors.borderLight }]}>
            <View style={bs.stylistIconWrap}>
              <Scissors size={16} color={colors.primary} strokeWidth={1.5} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[bs.stylistName, { color: colors.primary }]}>{stylist?.name}</Text>
              {stylist?.location ? <Text style={[bs.stylistLoc, { color: colors.textSecondary }]}>{stylist.location}</Text> : null}
            </View>
          </View>

          {/* ── Service picker ── */}
          <Text style={[bs.sectionLabel, { color: colors.textMuted }]}>SERVICE</Text>
          {loadingSvc ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} />
          ) : services.length === 0 ? (
            <View style={[bs.emptyServices, { borderColor: colors.borderLight }]}>
              <Scissors size={20} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={[bs.emptyServicesText, { color: colors.textMuted }]}>No services listed yet</Text>
            </View>
          ) : (
            <View style={{ gap: 8, marginBottom: 24 }}>
              {services.map(svc => (
                <TouchableOpacity
                  key={svc.id}
                  style={[
                    bs.serviceOption,
                    { borderColor: colors.borderLight, backgroundColor: colors.surface },
                    selected?.id === svc.id && { borderColor: colors.primary, backgroundColor: colors.primaryLight || '#FDF1EE' },
                  ]}
                  onPress={() => setSelected(svc)}
                  activeOpacity={0.8}
                >
                  <View style={bs.serviceLeft}>
                    <Text style={[bs.serviceName, { color: selected?.id === svc.id ? colors.primary : colors.text }]}>{svc.name}</Text>
                    {svc.description ? <Text style={[bs.serviceDesc, { color: colors.textSecondary }]} numberOfLines={1}>{svc.description}</Text> : null}
                    {svc.duration_min ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                        <Text style={[bs.serviceMeta, { color: colors.textMuted }]}>{svc.duration_min} min</Text>
                      </View>
                    ) : null}
                  </View>
                  <View style={bs.serviceRight}>
                    <Text style={[bs.servicePrice, { color: colors.text }]}>${svc.price?.toFixed(2)}</Text>
                    {selected?.id === svc.id && (
                      <View style={bs.serviceCheck}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Date ── */}
          <Text style={[bs.sectionLabel, { color: colors.textMuted }]}>DATE</Text>
          {/* Selected date pill */}
          <View style={[bs.dateDisplay, { borderColor: colors.borderLight }]}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={[bs.dateDisplayText, { color: selectedDate ? colors.text : colors.textMuted }]}>
              {displayDate}
            </Text>
          </View>
          {/* Inline calendar */}
          <View style={[bs.calCard, { borderColor: colors.borderLight }]}>
            <BookingMiniCalendar
              selectedDate={selectedDate}
              onSelectDate={(day) => { setSelectedDate(day); setSelectedHour(null); }}
              colors={colors}
              workSchedules={workSchedules}
            />
          </View>

          {/* ── Time ── */}
          <Text style={[bs.sectionLabel, { color: colors.textMuted }]}>
            TIME{'  '}<Text style={bs.optional}>OPTIONAL</Text>
          </Text>

          {selDayNotAvailable ? (
            /* Stylist has a schedule but not for this day */
            <View style={[bs.unavailableBanner, { borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }]}>
              <Ionicons name="calendar-outline" size={16} color="#9ca3af" />
              <Text style={bs.unavailableText}>
                Stylist is not available on this day
              </Text>
            </View>
          ) : (
            <View style={[bs.timeCard, { borderColor: colors.borderLight }]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, padding: 14 }}
              >
                {/* "Any time" chip */}
                <TouchableOpacity
                  style={[bs.timeChip, { borderColor: colors.border }, selectedHour === null && { backgroundColor: '#5D1F1F', borderColor: '#5D1F1F' }]}
                  onPress={() => setSelectedHour(null)}
                >
                  <Text style={[bs.timeChipText, { color: selectedHour === null ? '#fff' : colors.textMuted }]}>Any time</Text>
                </TouchableOpacity>
                {/* Only show hours within the scheduled work window */}
                {availableHours.map(h => (
                  <TouchableOpacity
                    key={h}
                    style={[bs.timeChip, { borderColor: colors.border }, selectedHour === h && { backgroundColor: '#5D1F1F', borderColor: '#5D1F1F' }]}
                    onPress={() => setSelectedHour(h)}
                  >
                    <Text style={[bs.timeChipText, { color: selectedHour === h ? '#fff' : colors.text }]}>
                      {bkFmtHour(h)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              {selectedHour !== null && (
                <View style={[bs.timeSummary, { borderTopColor: colors.borderLight, backgroundColor: colors.primaryLight || '#FDF1EE' }]}>
                  <Ionicons name="time-outline" size={14} color={colors.primary} />
                  <Text style={[bs.timeSummaryText, { color: colors.primary }]}>
                    Preferred time: {bkFmtHour(selectedHour)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ── Notes ── */}
          <Text style={[bs.sectionLabel, { color: colors.textMuted, marginTop: 20 }]}>
            NOTES{'  '}<Text style={bs.optional}>OPTIONAL</Text>
          </Text>
          <TextInput
            style={[bs.notesInput, { color: colors.text, borderColor: colors.borderLight, backgroundColor: colors.inputBackground }]}
            placeholder="Allergies, reference photos, length preferences..."
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={notes}
            onChangeText={setNotes}
          />
        </ScrollView>

        {/* ── CTA ── */}
        <View style={[bs.ctaWrap, { paddingBottom: Platform.OS === 'ios' ? 28 : 16 }]}>
          {/* Inline error — shown instead of Alert so web users always see it */}
          {!!bookError && (
            <View style={[bs.errorBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
              <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
              <Text style={bs.errorBannerText}>{bookError}</Text>
            </View>
          )}
          <TouchableOpacity
            style={[bs.bookBtn, !canBook && { opacity: 0.5 }]}
            onPress={handleBook}
            disabled={!canBook}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="calendar-outline" size={18} color="#fff" />
                <Text style={bs.bookBtnText}>
                  {selected ? `Book ${selected.name}` : 'Confirm Booking'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
      )}

        </View>{/* webCard */}
      </View>{/* webOverlay */}
    </Modal>
  );
}

const makeBookingStyles = (c) => StyleSheet.create({
  // Web modal overlay + card
  webOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  webCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '92%',
    borderRadius: 20,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  title: { fontSize: 17, fontFamily: 'Figtree_700Bold', color: c.text },
  body:  { padding: 20, paddingBottom: 8 },

  // Stylist strip
  stylistStrip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 24,
    backgroundColor: c.primaryLight || '#FDF1EE',
  },
  stylistIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  stylistName: { fontSize: 15, fontFamily: 'Figtree_700Bold' },
  stylistLoc:  { fontSize: 12, fontFamily: 'Figtree_400Regular', marginTop: 1 },

  // Section labels
  sectionLabel: {
    fontSize: 11, fontFamily: 'Figtree_700Bold',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
  },
  optional: { fontSize: 10, fontFamily: 'Figtree_500Medium', letterSpacing: 0.4 },

  // No-services empty state
  emptyServices: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 24,
  },
  emptyServicesText: { fontSize: 14, fontFamily: 'Figtree_500Medium' },

  // Service cards
  serviceOption: {
    flexDirection: 'row', alignItems: 'center',
    padding: 14, borderRadius: 12, borderWidth: 1.5,
  },
  serviceLeft:  { flex: 1 },
  serviceName:  { fontSize: 15, fontFamily: 'Figtree_600SemiBold', marginBottom: 2 },
  serviceDesc:  { fontSize: 12, marginBottom: 2 },
  serviceMeta:  { fontSize: 11 },
  serviceRight: { alignItems: 'flex-end', gap: 8 },
  servicePrice: { fontSize: 17, fontFamily: 'Figtree_700Bold' },
  serviceCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#5D1F1F', alignItems: 'center', justifyContent: 'center',
  },

  // Date picker
  dateDisplay: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12,
  },
  dateDisplayText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', flex: 1 },
  calCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 24 },

  // Unavailable day banner
  unavailableBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  unavailableText: {
    fontSize: 14, fontFamily: 'Figtree_500Medium', color: '#9ca3af', flex: 1,
  },

  // Time chips
  timeCard:      { borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  timeChip:      { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  timeChipText:  { fontSize: 13, fontFamily: 'Figtree_500Medium' },
  timeSummary: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderTopWidth: StyleSheet.hairlineWidth,
  },
  timeSummaryText: { fontSize: 13, fontFamily: 'Figtree_600SemiBold' },

  // Notes
  notesInput: {
    borderWidth: 1, borderRadius: 12,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12,
    fontSize: 14, minHeight: 80, textAlignVertical: 'top',
  },

  // ── Success screen ──
  successWrap: {
    flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, paddingTop: 48, paddingBottom: 48,
  },
  successIconRing: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 24,
  },
  successHeading: {
    fontSize: 24, fontFamily: 'Figtree_700Bold',
    marginBottom: 10, textAlign: 'center',
  },
  successSub: {
    fontSize: 14, fontFamily: 'Figtree_400Regular',
    lineHeight: 21, textAlign: 'center', marginBottom: 32,
  },
  summaryCard: {
    width: '100%', borderWidth: 1, borderRadius: 16,
    overflow: 'hidden', marginBottom: 32,
  },
  summaryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  summaryLabel: {
    fontSize: 13, fontFamily: 'Figtree_500Medium', width: 60,
  },
  summaryValue: {
    fontSize: 14, fontFamily: 'Figtree_600SemiBold', flex: 1, textAlign: 'right',
  },
  summaryDivider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  doneBtn: {
    width: '100%', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden', marginBottom: 12,
  },
  doneBtnText: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
  secondaryBtn: {
    width: '100%', borderRadius: 14, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 15, fontFamily: 'Figtree_500Medium' },

  // Error banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 10,
  },
  errorBannerText: {
    fontSize: 13, fontFamily: 'Figtree_500Medium',
    color: '#EF4444', flex: 1,
  },

  // CTA
  ctaWrap: { padding: 16 },
  bookBtn: {
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  bookBtnText: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StylistProfileScreen({ route, navigation }) {
  const routeStylist = route?.params?.stylist || {};
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeTab, setActiveTab]           = useState(route?.params?.initialTab || 'Posts');
  const [bookingVisible, setBookingVisible]   = useState(false);
  const [bookingService_, setBookingService]  = useState(null);
  const [services, setServices]               = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [taggedPosts, setTaggedPosts]         = useState([]);
  const [taggedLoading, setTaggedLoading]     = useState(false);
  const [selectedPost, setSelectedPost]       = useState(null);
  const [stylistPosts, setStylistPosts]       = useState([]);
  const [postsLoading, setPostsLoading]       = useState(false);
  const [postImageDims, setPostImageDims]     = useState({});
  const dimsFetchedRef = useRef(new Set());
  // Full profile fetched from DB (used when navigating with minimal params)
  const [fetchedProfile, setFetchedProfile]   = useState(null);
  const [reviews, setReviews]                 = useState([]);
  const [reviewsLoading, setReviewsLoading]   = useState(false);
  const [followersCount, setFollowersCount]   = useState(0);
  const [postCount, setPostCount]             = useState(0);
  const [unreviewedBookings, setUnreviewedBookings] = useState([]);
  const [reviewModal, setReviewModal]         = useState(null);
  const [reviewRating, setReviewRating]       = useState(5);
  const [reviewText, setReviewText]           = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [following, setFollowing]             = useState(false);
  const [followLoading, setFollowLoading]     = useState(false);
  const [unfollowSheetVisible, setUnfollowSheetVisible] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (Platform.OS === 'web') injectScrollbarCSS();
  }, []);

  const stylist = fetchedProfile
    ? { ...routeStylist, ...fetchedProfile }
    : routeStylist;

  const {
    id: stylistId,
    name = 'Stylist',
    location = '',
    city,
    state,
    rating = 0,
    reviewCount = 0,
    specialties = [],
    photos = [],
    avatarUrl,
    requirements: stylistRequirements = [],
  } = stylist;

  const displayLocation = (city || state)
    ? `${city || ''}${city && state ? ', ' : ''}${state || ''}`
    : location;

  // Fetch reviews + check for unreviewed bookings when Reviews tab is active
  useEffect(() => {
    if (activeTab !== 'Reviews' || !stylistId) return;
    setReviewsLoading(true);
    reviewService.getReviewsByStylist(stylistId)
      .then(({ data }) => setReviews(data || []))
      .finally(() => setReviewsLoading(false));

    // Check if the current user has completed appointments they haven't reviewed
    if (!user?.id) return;
    supabase
      .from('bookings')
      .select('id, service_name')
      .eq('user_id', user.id)
      .eq('stylist_id', stylistId)
      .eq('status', 'completed')
      .then(async ({ data: completed }) => {
        if (!completed?.length) { setUnreviewedBookings([]); return; }
        const { data: done } = await supabase
          .from('reviews')
          .select('booking_id')
          .in('booking_id', completed.map(b => b.id));
        const doneIds = new Set((done || []).map(r => r.booking_id));
        setUnreviewedBookings(completed.filter(b => !doneIds.has(b.id)));
      });
  }, [activeTab, stylistId, user?.id]);

  const handleSubmitReview = async () => {
    if (!reviewModal || !user?.id || !stylistId) return;
    setReviewSubmitting(true);
    const { error } = await reviewService.submitReview(
      reviewModal.id, user.id, stylistId,
      reviewRating, reviewText, reviewModal.service_name,
    );
    setReviewSubmitting(false);
    if (!error) {
      setUnreviewedBookings(prev => prev.filter(b => b.id !== reviewModal.id));
      setReviewModal(null);
      // Reload reviews list and stylist profile rating
      reviewService.getReviewsByStylist(stylistId).then(({ data }) => setReviews(data || []));
      const { normalizeStylist } = require('../services/stylistService');
      supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, city, state, location, specialties, portfolio_photos, rating, review_count, requirements')
        .eq('id', stylistId)
        .single()
        .then(({ data }) => { if (data) setFetchedProfile(normalizeStylist({ ...data, post_photos: [] })); });
    }
  };

  // Fetch live follower count + post count for the stats row
  useEffect(() => {
    if (!stylistId) return;
    supabase
      .from('follows')
      .select('id', { count: 'exact', head: true })
      .eq('following_id', stylistId)
      .then(({ count }) => setFollowersCount(count ?? 0));
    supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', stylistId)
      .then(({ count }) => setPostCount(count ?? 0));
  }, [stylistId]);

  // If we only received a bare ID (from post/search navigation), fetch the full profile
  useEffect(() => {
    if (!routeStylist.id) return;
    // Skip fetch if we already have a full profile (navigated from StylistsScreen)
    if (routeStylist.name && routeStylist.name !== 'Stylist') return;
    const { normalizeStylist } = require('../services/stylistService');
    supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url, city, state, location, specialties, portfolio_photos, rating, review_count')
      .eq('id', routeStylist.id)
      .single()
      .then(({ data }) => {
        if (data) setFetchedProfile(normalizeStylist({ ...data, post_photos: [] }));
      });
  }, [routeStylist.id]);

  const avatarUri = avatarUrl || photos[0];
  const AVATAR_SIZE = 100;
  const BANNER_HEIGHT = 120;

  // Fetch services
  useEffect(() => {
    if (!stylistId) return;
    bookingService.getServices(stylistId).then(({ data }) => {
      setServices(data || []);
      setServicesLoading(false);
    });
  }, [stylistId]);

  // Fetch stylist's actual posts for the Posts tab
  useEffect(() => {
    if (!stylistId) return;
    setPostsLoading(true);
    postService.getPostsByUser(stylistId).then(({ data }) => {
      setStylistPosts(data || []);
      setPostsLoading(false);
    });
  }, [stylistId]);

  // Fetch tagged posts when that tab opens
  useEffect(() => {
    if (activeTab !== 'Tagged' || !stylistId) return;
    setTaggedLoading(true);
    postService.getTaggedPosts(stylistId).then(({ data }) => {
      setTaggedPosts(data || []);
      setTaggedLoading(false);
    });
  }, [activeTab, stylistId]);

  // Load natural image dimensions for masonry sizing (Posts + Tagged)
  useEffect(() => {
    [...stylistPosts, ...taggedPosts].forEach(post => {
      const uri = post.post_media?.[0]?.media_url;
      if (!uri || dimsFetchedRef.current.has(post.id)) return;
      dimsFetchedRef.current.add(post.id);
      Image.getSize(
        uri,
        (w, h) => setPostImageDims(prev => ({ ...prev, [post.id]: { width: w, height: h } })),
        () => setPostImageDims(prev => ({ ...prev, [post.id]: { width: 1, height: 1 } })),
      );
    });
  }, [stylistPosts, taggedPosts]);

  // Check initial follow state
  useEffect(() => {
    if (!user?.id || !stylistId) return;
    profileService.isFollowing(user.id, stylistId).then(({ isFollowing }) => {
      setFollowing(!!isFollowing);
    });
  }, [user?.id, stylistId]);

  const handleFollow = async () => {
    if (!user?.id || followLoading) return;
    setFollowLoading(true);
    if (following) {
      setFollowing(false);
      setFollowersCount(prev => Math.max(0, prev - 1));
      const { error } = await profileService.unfollowUser(user.id, stylistId);
      if (error) {
        setFollowing(true);
        setFollowersCount(prev => prev + 1);
      }
    } else {
      setFollowing(true);
      setFollowersCount(prev => prev + 1);
      const { error } = await profileService.followUser(user.id, stylistId);
      if (error) {
        setFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
      }
    }
    setFollowLoading(false);
  };

  const handleReportStylist = () => {
    setUnfollowSheetVisible(false);
    Alert.alert('Report', 'This stylist has been reported for review.');
  };

  const openBooking = (svc = null) => {
    setBookingService(svc);
    setBookingVisible(true);
  };

  // Opens the full PostDetail screen on native; on web (no dedicated route
  // transitions) falls back to the in-app post popup — same pattern as
  // ExploreScreen and ProfileTabs use.
  const openPost = useCallback((post) => {
    if (Platform.OS !== 'web') {
      navigation.push('PostDetail', { postId: post.id });
    } else {
      setSelectedPost(post);
    }
  }, [navigation]);

  // ── Tab content ─────────────────────────────────────────────────────────────

  // Shared masonry grid renderer for Posts + Tagged (shortest column first,
  // natural aspect ratio capped at 1.6:1, 10px gaps, 12px outer padding)
  const renderMasonryGrid = (posts) => {
    const layout = computeProfileMasonry(posts, MASONRY_COLUMN_WIDTH, postImageDims);
    return (
      <View style={styles.masonryOuter}>
        <View style={[styles.masonryCanvas, { height: layout.totalHeight }]}>
          {layout.items.map(({ post, column, top, height }) => {
            const left = column === 'left' ? 0 : column === 'full' ? 0 : MASONRY_COLUMN_WIDTH + MASONRY_GAP;
            const width = column === 'full' ? MASONRY_COLUMN_WIDTH * 2 + MASONRY_GAP : MASONRY_COLUMN_WIDTH;
            const thumb = post.post_media?.[0]?.media_url;
            const styleTag = formatStyleTag(post.tags?.[0]);
            return (
              <TouchableOpacity
                key={post.id}
                style={[styles.masonryCell, { width, height, left, top }]}
                onPress={() => openPost(post)}
                activeOpacity={0.85}
              >
                {thumb
                  ? <Image source={{ uri: thumb }} style={styles.gridImage} resizeMode="cover" />
                  : <View style={[styles.gridImage, { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' }]}>
                      <Ionicons name="image-outline" size={20} color="#9ca3af" />
                    </View>}
                {styleTag ? (
                  <>
                    <LinearGradient
                      colors={['transparent', 'rgba(26,22,18,0.9)']}
                      locations={[0, 1]}
                      style={styles.styleTagGradient}
                      pointerEvents="none"
                    />
                    <View style={styles.styleTag}>
                      <Text style={styles.styleTagText} numberOfLines={1}>{styleTag}</Text>
                    </View>
                  </>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const renderPosts = () => {
    if (postsLoading) return <ActivityIndicator color={colors.primary} style={{ paddingTop: 48 }} />;
    if (stylistPosts.length === 0) return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No posts yet</Text>
        <Text style={styles.emptyText}>This stylist hasn't posted yet</Text>
      </View>
    );
    return renderMasonryGrid(stylistPosts);
  };

  const renderServices = () => {
    if (servicesLoading) return <ActivityIndicator color={colors.primary} style={{ paddingTop: 48 }} />;
    if (services.length === 0) return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No services yet</Text>
        <Text style={styles.emptyText}>This stylist hasn't added services yet</Text>
      </View>
    );

    const serviceRequirements = Array.isArray(stylistRequirements) ? stylistRequirements : [];

    return (
      <View style={styles.servicesList}>
        <TouchableOpacity
          style={styles.requirementsRow}
          activeOpacity={0.7}
          onPress={() => setRequirementsOpen(prev => !prev)}
        >
          <Text style={styles.sectionLabelText}>REQUIREMENTS</Text>
          <Ionicons name={requirementsOpen ? 'chevron-down' : 'chevron-forward'} size={16} color="#9CA3AF" />
        </TouchableOpacity>

        {requirementsOpen && (
          <View style={[styles.requirementsExpandedCard, { borderColor: '#E8E0D8', backgroundColor: colors.surface }]}>
            <View style={styles.requirementsExpandedHeader}>
              <Text style={[styles.requirementsExpandedTitle, { color: colors.text }]}>Before Your Appointment</Text>
              <View style={styles.requirementsCountPill}>
                <Text style={styles.requirementsCountPillText}>{serviceRequirements.length}</Text>
              </View>
            </View>
            <View style={styles.requirementsBody}>
              {serviceRequirements.length > 0 ? serviceRequirements.map((item, i) => (
                <View key={`req-${i}`} style={styles.requirementRow}>
                  <View style={[styles.requirementBullet, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.requirementText, { color: colors.text }]}>{item}</Text>
                </View>
              )) : (
                <Text style={[styles.requirementText, { color: colors.textSecondary }]}>No requirements listed yet.</Text>
              )}
            </View>
          </View>
        )}

        <Text style={[styles.sectionLabelText, styles.servicesLabel]}>SERVICES</Text>

        {services.map(svc => (
          <View key={svc.id} style={[styles.serviceCard, { borderColor: '#E8E0D8', backgroundColor: colors.surface }]}>
            <View style={styles.serviceCardTopRow}>
              <Text style={[styles.serviceCardName, { color: colors.text }]} numberOfLines={1}>{svc.name}</Text>
              <Text style={[styles.serviceCardPrice, { color: colors.text }]}>{`$${svc.price?.toFixed(2)}`}</Text>
            </View>
            {svc.description ? <Text style={[styles.serviceCardDesc, { color: colors.textSecondary }]}>{svc.description}</Text> : null}
            {svc.duration_min ? (
              <Text style={[styles.serviceCardMetaText, { color: colors.textSecondary }]}>{svc.duration_min} min</Text>
            ) : null}
            <TouchableOpacity style={styles.serviceBookNowBtn} onPress={() => openBooking(svc)} activeOpacity={0.85}>
              <LinearGradient
                colors={['#5D1F1F', '#7D3F1D', '#B35D2B']}
                locations={[0, 0.34, 1]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.serviceBookNowText}>Book Now</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Posts':    return renderPosts();
      case 'Services': return renderServices();
            case 'Tagged': {
        if (taggedLoading) return <ActivityIndicator color={colors.primary} style={{ paddingTop: 48 }} />;
        if (taggedPosts.length === 0) return (
          <View style={styles.taggedEmptyState}>
            <Text style={styles.taggedEmptyText}>No tagged posts yet</Text>
          </View>
        );
        return renderMasonryGrid(taggedPosts);
      }
      default: return null;
    }
  };

  // ── Shared inner content (used in both web <div> and native <ScrollView>) ──
  const profileContent = (
    <>
      <View style={{ height: BANNER_HEIGHT }}>
        <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <TouchableOpacity style={styles.instagramBadge} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => {/* open insta */}} activeOpacity={0.75}>
          <Ionicons name="logo-instagram" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

        <View style={[styles.avatarRow, { marginTop: -(AVATAR_SIZE / 2) }]}>
          <View style={[styles.avatarRing, { width: AVATAR_SIZE + 4, height: AVATAR_SIZE + 4, borderRadius: (AVATAR_SIZE + 4) / 2, backgroundColor: colors.surface, borderWidth: 2, borderColor: '#fff' }]}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }} />
              : <View style={[styles.avatarPlaceholder, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]}><Ionicons name="person" size={44} color="#9ca3af" /></View>}
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <View style={styles.nameBadge}>
              <Scissors size={16} color={colors.primary} strokeWidth={2.5} />
              <Text style={styles.name}>{name}</Text>
            </View>
            {following && (
              <TouchableOpacity style={styles.unfollowBtn} onPress={() => setUnfollowSheetVisible(true)} activeOpacity={0.75}>
                <Ionicons name="chevron-down" size={16} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Location + Specialty — same row */}
          {(!!location || specialties.length > 0) && (
            <View style={styles.metaRow}>
              {!!location && (
                <>
                  <Ionicons name="location-outline" size={14} color="#5E5E5E" />
                  <Text style={styles.metaText}>{displayLocation}</Text>
                </>
              )}
              {specialties[0] ? (
                <View style={styles.specialtyTag}>
                  <Text style={styles.specialtyTagText}>{specialties[0]}</Text>
                </View>
              ) : null}
            </View>
          )}

          <View style={styles.stats}>
            <TouchableOpacity style={styles.stat} activeOpacity={0.7} onPress={() => {/* view followers */}}>
              <Text style={styles.statNumber}>{followersCount}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </TouchableOpacity>
            <View style={styles.statDivider} />
            <TouchableOpacity style={styles.stat} activeOpacity={0.7} onPress={() => {/* view reviews */}}>
              <Text style={styles.statNumber}>{reviewCount ?? 0}</Text>
              <Text style={styles.statLabel}>Reviews</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.buttons}>
            {!following ? (
              <>
                <TouchableOpacity
                  style={styles.followFullBtn}
                  onPress={handleFollow}
                  activeOpacity={0.8}
                  disabled={followLoading}
                >
                  <LinearGradient colors={['#B35D2B', '#7D3F1D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} borderRadius={10} />
                  <Text style={styles.followFullBtnText}>Follow</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bookActionBtn} onPress={() => openBooking()} activeOpacity={0.85}>
                  <Text style={styles.bookBtnText}>Book</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                  <TouchableOpacity style={styles.bookActionBtn} onPress={() => openBooking()} activeOpacity={0.85}>
                    <Text style={styles.bookBtnText}>Book</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.messageActionBtn}
                    onPress={() => navigation.navigate('Messaging', { recipientId: stylistId, recipientName: name })}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.messageActionText}>Message</Text>
                  </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        <View style={styles.tabs}>
          {TABS.map((tab) => {
            const active = activeTab === tab;
            return (
              <TouchableOpacity key={tab} style={styles.tab} onPress={() => setActiveTab(tab)} activeOpacity={0.7}>
                <Text style={[styles.tabText, active && styles.activeTabText]}>{tab}</Text>
                {active && <View style={styles.activeUnderline} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {renderTabContent()}
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {Platform.OS === 'web' ? (
        /* ── Web: native <div> with CSS 100vh so content can actually overflow ── */
        <div
          className="crwn-profile-scroll-div"
          style={{
            height: '100vh',
            overflowY: 'scroll',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0,0,0,0.25) transparent',
          }}
        >
          {profileContent}
        </div>
      ) : (
        /* ── Native: plain ScrollView ── */
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {profileContent}
        </ScrollView>
      )}

      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 24 }]} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={26} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>

      <BookingModal
        visible={bookingVisible}
        stylist={stylist}
        preselectedService={bookingService_}
        onClose={() => { setBookingVisible(false); setBookingService(null); }}
        colors={colors}
      />

      {/* Leave a Review modal */}
      <Modal
        visible={!!reviewModal}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModal(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable
            style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
            onPress={() => setReviewModal(null)}
          >
            <Pressable
              style={[styles.reviewModalCard, { backgroundColor: colors.surface }]}
              onPress={() => {}}
            >
              <View style={[styles.reviewModalHeader, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.reviewModalTitle, { color: colors.text }]}>Rate Your Experience</Text>
                <TouchableOpacity onPress={() => setReviewModal(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.reviewModalBody}>
                {!!reviewModal?.service_name && (
                  <Text style={[styles.reviewModalService, { color: colors.textSecondary }]}>
                    {reviewModal.service_name}
                  </Text>
                )}

                <View style={styles.reviewStarRow}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <TouchableOpacity key={n} onPress={() => setReviewRating(n)} activeOpacity={0.7} style={{ padding: 6 }}>
                      <MaterialCommunityIcons
                        name={n <= reviewRating ? 'crown' : 'crown-outline'}
                        size={36}
                        color={n <= reviewRating ? HONEY : colors.border}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[styles.reviewTextInput, {
                    backgroundColor: colors.surfaceAlt ?? colors.backgroundAlt,
                    color: colors.text,
                    borderColor: colors.borderLight,
                  }]}
                  placeholder="Share your experience (optional)"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                  value={reviewText}
                  onChangeText={setReviewText}
                  maxLength={500}
                />

                <TouchableOpacity
                  style={[styles.reviewSubmitBtn, { backgroundColor: colors.primary, opacity: reviewSubmitting ? 0.6 : 1 }]}
                  onPress={handleSubmitReview}
                  disabled={reviewSubmitting}
                  activeOpacity={0.8}
                >
                  {reviewSubmitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.reviewSubmitText}>Submit Review</Text>
                  }
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Tagged post detail modal */}
      <Modal
        visible={!!selectedPost}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelectedPost(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={['top']}>
          <View style={styles.postModalHeader}>
            <TouchableOpacity onPress={() => setSelectedPost(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedPost && (
              <PostCard
                post={selectedPost}
                currentUserId={user?.id}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Unfollow / report stylist sheet */}
      <Modal
        visible={unfollowSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnfollowSheetVisible(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setUnfollowSheetVisible(false)}>
          <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={[styles.sheetItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => { setUnfollowSheetVisible(false); handleFollow(); }}
            >
              <Ionicons name="person-remove-outline" size={22} color={colors.text} />
              <Text style={[styles.sheetItemText, { color: colors.text }]}>Unfollow</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetItem, styles.sheetItemDanger]} onPress={handleReportStylist}>
              <Ionicons name="flag-outline" size={22} color="#ef4444" />
              <Text style={[styles.sheetItemText, styles.sheetItemTextDanger]}>Report Stylist</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetItem, styles.sheetCancel, { borderTopColor: colors.borderLight }]}
              onPress={() => setUnfollowSheetVisible(false)}
            >
              <Text style={[styles.sheetCancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  avatarRow: { alignItems: 'center', zIndex: 1 },
  avatarRing: { alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholder: { backgroundColor: c.border, alignItems: 'center', justifyContent: 'center' },
  info: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },

  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  metaText: { fontSize: 13, color: '#5E5E5E', fontFamily: 'Figtree_400Regular' },
  metaDot: { fontSize: 13, color: c.textSecondary, marginHorizontal: 2 },
  specialtyTag: {
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F0EAE0',
  },
  specialtyTagText: {
    fontSize: 12, fontFamily: 'Figtree_600SemiBold', color: '#4F4032',
  },
  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginBottom: 24 },
  stat: { alignItems: 'center', paddingHorizontal: 4 },
  statDivider: { width: 1, height: 32, backgroundColor: '#E0D8D0' },
  statNumber: { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 2 },
  statLabel: { fontSize: 12, color: '#5E5E5E' },
  buttons: { flexDirection: 'row', gap: 10, marginBottom: 16, width: '100%', alignItems: 'center' },
  followFullBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  followFullBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
  bookActionBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: '#E2DACB' },
  bookBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#77674B' },
  messageActionBtn: { flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E2DACB', backgroundColor: 'transparent' },
  messageActionText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#77674B' },
  /* Header name row */
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 8 },
  nameBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 22, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 0 },
  unfollowBtn: { marginLeft: 2, padding: 6 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontSize: 15, color: c.textSecondary, fontFamily: 'Figtree_500Medium' },
  activeTabText: { color: c.selected, fontFamily: 'Figtree_700Bold' },
  activeUnderline: { position: 'absolute', bottom: -1, left: 8, right: 8, height: 3, borderRadius: 2, backgroundColor: '#5D1F1F' },
  masonryOuter: { paddingHorizontal: MASONRY_PAD, paddingTop: 12 },
  masonryCanvas: { position: 'relative', width: '100%' },
  masonryCell: { position: 'absolute', borderRadius: 14, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  // Mirrors the Explore feed's "stylist tag": dark gradient fade behind a
  // frosted-glass pill, bottom-left, with a Scissors icon + label
  styleTagGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  styleTag: {
    position: 'absolute', left: 10, bottom: 10,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8,
    maxWidth: '85%',
  },
  styleTagText: { color: '#fff', fontSize: 12, fontFamily: 'Figtree_500Medium' },
  emptyState: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: 'Figtree_600SemiBold', color: c.text },
  emptyText: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
  taggedEmptyState: { alignItems: 'center', paddingTop: 60 },
  taggedEmptyText: { fontSize: 14, color: c.textSecondary, textAlign: 'center' },
  reviewsList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  leaveReviewPrompt: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
    marginBottom: 16,
  },
  leaveReviewTitle: { fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  leaveReviewSub: { fontSize: 12, marginTop: 2 },
  reviewModalCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  reviewModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewModalTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold' },
  reviewModalBody: { padding: 20, gap: 16 },
  reviewModalService: { fontSize: 13, textAlign: 'center' },
  reviewStarRow: { flexDirection: 'row', justifyContent: 'center' },
  reviewTextInput: {
    borderWidth: 1, borderRadius: 12, padding: 12,
    fontSize: 14, minHeight: 100, textAlignVertical: 'top',
  },
  reviewSubmitBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  reviewSubmitText: { fontSize: 15, fontFamily: 'Figtree_700Bold', color: '#fff' },
  reviewCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: { width: 40, height: 40, borderRadius: 20 },
  reviewAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  reviewClientName: { fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  reviewTime: { fontSize: 12, marginTop: 1 },
  reviewCrowns: { flexDirection: 'row', gap: 2 },
  reviewText: { fontSize: 14, lineHeight: 20 },
  reviewTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  reviewTagText: { fontSize: 12, fontFamily: 'Figtree_500Medium' },
  servicesList: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  sectionLabelText: { fontSize: 11, fontFamily: 'Figtree_700Bold', letterSpacing: 1, textTransform: 'uppercase', color: '#9CA3AF' },
  servicesLabel: { marginTop: 8, marginBottom: 12 },
  requirementsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  requirementsExpandedCard: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 8 },
  requirementsExpandedHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  requirementsExpandedTitle: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', flex: 1, marginRight: 10 },
  requirementsCountPill: { backgroundColor: '#F0EAE0', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  requirementsCountPillText: { fontSize: 12, fontFamily: 'Figtree_600SemiBold', color: '#B35D2B' },
  requirementsBody: { gap: 10 },
  requirementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  requirementBullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  requirementText: { fontSize: 13, lineHeight: 20, flex: 1 },
  serviceCard: { borderRadius: 12, borderWidth: 1, marginBottom: 12, padding: 16 },
  serviceCardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 },
  serviceCardName: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', flex: 1 },
  serviceCardDesc: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  serviceCardMetaText: { fontSize: 12, marginBottom: 12 },
  serviceCardPrice: { fontSize: 16, fontFamily: 'Figtree_700Bold' },
  serviceBookNowBtn: { height: 44, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  serviceBookNowText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#ffffff' },
  backBtn: { position: 'absolute', left: 14, padding: 6, zIndex: 100 },
  instagramBadge: {
    position: 'absolute', top: 64, right: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10, padding: 6,
  },
  sheetOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheetContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1 },
  sheetItemText: { fontSize: 16, fontFamily: 'Figtree_500Medium', marginLeft: 16 },
  sheetItemDanger: { borderBottomWidth: 0 },
  sheetItemTextDanger: { color: '#ef4444' },
  sheetCancel: { justifyContent: 'center', marginTop: 8, borderTopWidth: 8, borderBottomWidth: 0 },
  sheetCancelText: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', textAlign: 'center' },
  postModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
});
