import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Dimensions, Modal, TextInput, Alert,
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Crown } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { bookingService } from '../services/bookingService';
import { postService } from '../services/postService';
import { supabase } from '../config/supabase';
import PostCard from '../components/PostCard';

const HONEY = '#D4930A';
const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_GAP = 8;
const GRID_SIZE = (SCREEN_WIDTH - GRID_GAP * 3) / 2;

const TABS = ['Posts', 'Services', 'Reviews', 'Tagged'];

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

function BookingMiniCalendar({ selectedDate, onSelectDate, colors, blockedTimes = [] }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [viewMonth, setViewMonth] = useState(() =>
    selectedDate
      ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
      : new Date(today.getFullYear(), today.getMonth(), 1)
  );

  // Returns true when the stylist has an all-day block on this date
  const isAllDayBlocked = useCallback((day) =>
    blockedTimes.some(b => b.all_day && bkSameDay(day, new Date(b.block_date + 'T00:00:00')))
  , [blockedTimes]);

  // Returns true when there is ANY block (all-day or partial) on this date
  const hasAnyBlock = useCallback((day) =>
    blockedTimes.some(b => bkSameDay(day, new Date(b.block_date + 'T00:00:00')))
  , [blockedTimes]);

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
          const allDayOff    = isAllDayBlocked(day);
          const partialBlock = !allDayOff && hasAnyBlock(day);
          const isDisabled   = isPast || allDayOff;
          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={{ width: '14.28%', height: 36, alignItems: 'center', justifyContent: 'center' }}
              onPress={() => onSelectDate(day)}
              disabled={isDisabled}
            >
              <View style={{
                width: 30, height: 30, borderRadius: 15,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSelected ? '#5D1F1F' : allDayOff ? '#f3f4f6' : 'transparent',
              }}>
                <Text style={{
                  fontSize: 13,
                  fontFamily: isSelected ? 'Figtree_700Bold' : 'Figtree_500Medium',
                  color: isSelected ? '#fff'
                       : allDayOff   ? '#d1d5db'
                       : isToday     ? '#C8835A'
                       : isPast      ? colors.borderLight
                       :               colors.text,
                  textDecorationLine: allDayOff ? 'line-through' : 'none',
                }}>
                  {day.getDate()}
                </Text>
              </View>
              {/* Partial-block dot */}
              {partialBlock && (
                <View style={{ position: 'absolute', bottom: 3, width: 4, height: 4, borderRadius: 2, backgroundColor: '#9ca3af' }} />
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
  const bs = useMemo(() => makeBookingStyles(colors), [colors]);
  const [services,        setServices]        = useState([]);
  const [selected,        setSelected]        = useState(null);
  const [selectedDate,    setSelectedDate]    = useState(null);
  const [selectedHour,    setSelectedHour]    = useState(null); // null = any time
  const [notes,           setNotes]           = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [loadingSvc,      setLoadingSvc]      = useState(true);
  const [blockedTimes,    setBlockedTimes]    = useState([]);
  const [confirmed,       setConfirmed]       = useState(false);
  const [confirmedDetails,setConfirmedDetails]= useState(null);

  useEffect(() => {
    if (!visible || !stylist?.id) return;
    setLoadingSvc(true);
    setSelectedDate(null);
    setSelectedHour(null);
    setNotes('');
    setBlockedTimes([]);
    setConfirmed(false);
    setConfirmedDetails(null);

    // Load services and blocked times in parallel
    Promise.all([
      bookingService.getServices(stylist.id),
      supabase
        .from('blocked_times')
        .select('id, block_date, all_day, start_time, end_time')
        .eq('stylist_id', stylist.id),
    ]).then(([{ data: svcData }, { data: btData }]) => {
      setServices(svcData || []);
      setSelected(preselectedService || svcData?.[0] || null);
      setBlockedTimes(btData || []);
      setLoadingSvc(false);
    });
  }, [visible, stylist?.id, preselectedService]);

  const reset = () => {
    setSelectedDate(null); setSelectedHour(null);
    setNotes(''); setSelected(null);
    setConfirmed(false); setConfirmedDetails(null);
  };

  // ── Blocked-time helpers for the selected day ──
  const selDayBlocks = useMemo(() => {
    if (!selectedDate) return [];
    return blockedTimes.filter(b =>
      bkSameDay(selectedDate, new Date(b.block_date + 'T00:00:00'))
    );
  }, [selectedDate, blockedTimes]);

  const selDayAllDayOff = selDayBlocks.some(b => b.all_day);

  const availableHours = useMemo(() => {
    const partial = selDayBlocks.filter(b => !b.all_day && b.start_time && b.end_time);
    return BK_TIME_OPTS.filter(h =>
      !partial.some(b => {
        const startH = parseInt(b.start_time.split(':')[0], 10);
        const endH   = parseInt(b.end_time.split(':')[0], 10);
        return h >= startH && h < endH;
      })
    );
  }, [selDayBlocks]);

  // If currently-selected hour gets blocked by new date, reset it
  useEffect(() => {
    if (selectedHour !== null && !availableHours.includes(selectedHour)) {
      setSelectedHour(null);
    }
  }, [availableHours]);

  const handleBook = async () => {
    if (!selected)      { Alert.alert('Select a service', 'Please choose a service to book.'); return; }
    if (!selectedDate)  { Alert.alert('Date required',    'Please select your preferred date.');  return; }

    setSubmitting(true);
    const { error } = await bookingService.createBooking({
      userId:          user.id,
      stylistId:       stylist.id,
      serviceName:     selected.name,
      appointmentDate: bkToDateStr(selectedDate),
      appointmentTime: selectedHour !== null ? `${String(selectedHour).padStart(2, '0')}:00:00` : null,
      notes:           notes.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Booking failed', 'Something went wrong. Please try again.');
    } else {
      // Show in-modal confirmation screen instead of a dismissible alert
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
  };

  const displayDate = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'Select a date';

  const canBook = !!selected && !!selectedDate && !selDayAllDayOff && !submitting && services.length > 0;

  // ── Success screen ────────────────────────────────────────────────────────────
  if (confirmed && confirmedDetails) {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
        <View style={[bs.successWrap, { backgroundColor: colors.surface }]}>
          {/* Icon */}
          <View style={bs.successIconRing}>
            <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} borderRadius={40} />
            <Ionicons name="checkmark" size={36} color="#fff" />
          </View>

          <Text style={[bs.successHeading, { color: colors.text }]}>Booking Requested!</Text>
          <Text style={[bs.successSub, { color: colors.textMuted }]}>
            Your request has been sent.{'\n'}You'll be notified once {confirmedDetails.stylistName} confirms.
          </Text>

          {/* Summary card */}
          <View style={[bs.summaryCard, { borderColor: colors.borderLight, backgroundColor: colors.background }]}>
            <View style={bs.summaryRow}>
              <Ionicons name="cut-outline" size={15} color={colors.textMuted} />
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

          {/* Done button */}
          <TouchableOpacity
            style={bs.doneBtn}
            onPress={() => { reset(); onClose(); }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} borderRadius={14} />
            <Text style={bs.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
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
              <Ionicons name="cut-outline" size={16} color={colors.primary} />
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
              <Ionicons name="cut-outline" size={20} color={colors.textMuted} />
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
              blockedTimes={blockedTimes}
            />
          </View>

          {/* ── Time ── */}
          <Text style={[bs.sectionLabel, { color: colors.textMuted }]}>
            TIME{'  '}<Text style={bs.optional}>OPTIONAL</Text>
          </Text>

          {selDayAllDayOff ? (
            /* Whole day is blocked — show unavailable banner */
            <View style={[bs.unavailableBanner, { borderColor: '#e5e7eb', backgroundColor: '#f9fafb' }]}>
              <Ionicons name="ban-outline" size={16} color="#9ca3af" />
              <Text style={bs.unavailableText}>
                Stylist is unavailable on this day
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
                {/* Only show hours not blocked by a partial block */}
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
    </Modal>
  );
}

const makeBookingStyles = (c) => StyleSheet.create({
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
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28, paddingBottom: 40,
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
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  doneBtnText: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: '#fff' },

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
  const stylist = route?.params?.stylist || {};
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeTab, setActiveTab]           = useState('Posts');
  const [bookingVisible, setBookingVisible]   = useState(false);
  const [bookingService_, setBookingService]  = useState(null);
  const [services, setServices]               = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [taggedPosts, setTaggedPosts]         = useState([]);
  const [taggedLoading, setTaggedLoading]     = useState(false);
  const [selectedPost, setSelectedPost]       = useState(null);
  const { user } = useAuth();

  const {
    id: stylistId,
    name = 'Stylist',
    location = '',
    rating = 0,
    reviewCount = 0,
    specialties = [],
    photos = [],
  } = stylist;

  const avatarUri = photos[0];
  const AVATAR_SIZE = 90;
  const BANNER_HEIGHT = 120;

  // Fetch services
  useEffect(() => {
    if (!stylistId) return;
    bookingService.getServices(stylistId).then(({ data }) => {
      setServices(data || []);
      setServicesLoading(false);
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

  const openBooking = (svc = null) => {
    setBookingService(svc);
    setBookingVisible(true);
  };

  // ── Tab content ─────────────────────────────────────────────────────────────

  const renderPosts = () => {
    const rows = [];
    for (let i = 0; i < photos.length; i += 2) rows.push(photos.slice(i, i + 2));
    return (
      <View style={styles.gridContainer}>
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.gridRow}>
            {row.map((src, i) => (
              <View key={i} style={styles.gridCell}>
                <Image source={typeof src === 'string' ? { uri: src } : src} style={styles.gridImage} resizeMode="cover" />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  };

  const renderServices = () => {
    if (servicesLoading) return <ActivityIndicator color={colors.primary} style={{ paddingTop: 48 }} />;
    if (services.length === 0) return (
      <View style={styles.emptyState}>
        <Ionicons name="cut-outline" size={36} color={colors.border} />
        <Text style={styles.emptyTitle}>No services yet</Text>
        <Text style={styles.emptyText}>This stylist hasn't added services yet</Text>
      </View>
    );
    return (
      <View style={styles.servicesList}>
        {services.map(svc => (
          <View key={svc.id} style={styles.serviceCard}>
            <View style={styles.serviceCardLeft}>
              <Text style={styles.serviceCardName}>{svc.name}</Text>
              {svc.description ? <Text style={styles.serviceCardDesc} numberOfLines={2}>{svc.description}</Text> : null}
              {svc.duration_min ? (
                <View style={styles.serviceCardMeta}>
                  <Ionicons name="time-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.serviceCardMetaText}>{svc.duration_min} min</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.serviceCardRight}>
              <Text style={styles.serviceCardPrice}>${svc.price?.toFixed(2)}</Text>
              <TouchableOpacity style={styles.bookServiceBtn} onPress={() => openBooking(svc)}>
                <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                <Text style={styles.bookServiceBtnText}>Book</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Posts':    return renderPosts();
      case 'Services': return renderServices();
      case 'Reviews':
        return (
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={36} color={colors.border} />
            <Text style={styles.emptyTitle}>{reviewCount} Reviews</Text>
            <Text style={styles.emptyText}>Reviews will appear here</Text>
          </View>
        );
      case 'Tagged': {
        if (taggedLoading) return <ActivityIndicator color={colors.primary} style={{ paddingTop: 48 }} />;
        if (taggedPosts.length === 0) return (
          <View style={styles.emptyState}>
            <Ionicons name="cut-outline" size={36} color={colors.border} />
            <Text style={styles.emptyTitle}>No tagged posts yet</Text>
            <Text style={styles.emptyText}>Posts where clients tag this stylist will appear here</Text>
          </View>
        );
        const taggedRows = [];
        for (let i = 0; i < taggedPosts.length; i += 2) taggedRows.push(taggedPosts.slice(i, i + 2));
        return (
          <View style={styles.gridContainer}>
            {taggedRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((item) => {
                  const thumb = item.post_media?.[0]?.media_url;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.gridCell}
                      onPress={() => setSelectedPost(item)}
                      activeOpacity={0.8}
                    >
                      {thumb
                        ? <Image source={{ uri: thumb }} style={styles.gridImage} resizeMode="cover" />
                        : <View style={[styles.gridImage, { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="image-outline" size={20} color="#9ca3af" /></View>}
                      {item.profiles && (
                        <View style={styles.tilePostedBy}>
                          <Text style={styles.tilePostedByText} numberOfLines={1}>
                            {item.profiles.full_name || item.profiles.username}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                {row.length < 2 && <View style={styles.gridCell} />}
              </View>
            ))}
          </View>
        );
      }
      default: return null;
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: BANNER_HEIGHT }} />

        <View style={[styles.avatarRow, { marginTop: -(AVATAR_SIZE / 2) }]}>
          <View style={[styles.avatarRing, { width: AVATAR_SIZE + 4, height: AVATAR_SIZE + 4, borderRadius: (AVATAR_SIZE + 4) / 2, backgroundColor: colors.surface }]}>
            {avatarUri
              ? <Image source={{ uri: avatarUri }} style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }} />
              : <View style={[styles.avatarPlaceholder, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]}><Ionicons name="person" size={44} color="#9ca3af" /></View>}
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{location}</Text>
            <Text style={styles.metaDot}>•</Text>
            <Crown size={14} color={HONEY} />
            <Text style={styles.metaText}>({reviewCount} reviews)</Text>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statNumber}>{photos.length}</Text><Text style={styles.statLabel}>Posts</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Text style={styles.statNumber}>{services.length}</Text><Text style={styles.statLabel}>Services</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Text style={styles.statNumber}>{rating}</Text><Text style={styles.statLabel}>Rating</Text></View>
          </View>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.bookBtn} onPress={() => openBooking()}>
              <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.bookBtnText}>Book</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.messageBtn}>
              <Text style={styles.messageBtnText}>Message</Text>
            </TouchableOpacity>
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
      </ScrollView>

      <TouchableOpacity style={[styles.backBtn, { top: insets.top + 8 }]} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>

      <View style={[styles.socialIcons, { top: insets.top + 8 }]}>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="globe-outline" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="logo-instagram" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      </View>

      <BookingModal
        visible={bookingVisible}
        stylist={stylist}
        preselectedService={bookingService_}
        onClose={() => { setBookingVisible(false); setBookingService(null); }}
        colors={colors}
      />

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
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  avatarRow: { alignItems: 'center', zIndex: 1 },
  avatarRing: { alignItems: 'center', justifyContent: 'center' },
  avatarPlaceholder: { backgroundColor: c.border, alignItems: 'center', justifyContent: 'center' },
  info: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  name: { fontSize: 24, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 },
  metaText: { fontSize: 13, color: c.textSecondary, fontFamily: 'Figtree_400Regular' },
  metaDot: { fontSize: 13, color: c.textSecondary, marginHorizontal: 2 },
  stats: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stat: { alignItems: 'center', paddingHorizontal: 24 },
  statDivider: { width: 1, height: 32, backgroundColor: c.border },
  statNumber: { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 2 },
  statLabel: { fontSize: 12, color: c.textSecondary },
  buttons: { flexDirection: 'row', gap: 12, marginBottom: 16, width: '100%' },
  bookBtn: { flex: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bookBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
  messageBtn: { flex: 1, borderRadius: 10, borderWidth: 1.5, borderColor: c.primary, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  messageBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: c.primary },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: c.surface },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontSize: 15, color: c.textSecondary, fontFamily: 'Figtree_500Medium' },
  activeTabText: { color: c.selected, fontFamily: 'Figtree_700Bold' },
  activeUnderline: { position: 'absolute', bottom: -1, left: 8, right: 8, height: 3, borderRadius: 2, backgroundColor: '#5D1F1F' },
  gridContainer: { padding: GRID_GAP },
  gridRow: { flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP },
  gridCell: { width: GRID_SIZE, height: GRID_SIZE, borderRadius: 10, overflow: 'hidden' },
  gridImage: { width: '100%', height: '100%' },
  emptyState: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 8 },
  emptyTitle: { fontSize: 17, fontFamily: 'Figtree_600SemiBold', color: c.text },
  emptyText: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },
  servicesList: { padding: 16, gap: 12 },
  serviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: c.borderLight, gap: 12 },
  serviceCardLeft: { flex: 1 },
  serviceCardName: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: c.text, marginBottom: 3 },
  serviceCardDesc: { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 4 },
  serviceCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  serviceCardMetaText: { fontSize: 12, color: c.textMuted },
  serviceCardRight: { alignItems: 'flex-end', gap: 10 },
  serviceCardPrice: { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text },
  bookServiceBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bookServiceBtnText: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
  backBtn: { position: 'absolute', left: 14, padding: 6, zIndex: 100 },
  socialIcons: { position: 'absolute', right: 14, flexDirection: 'row', gap: 12, zIndex: 100 },
  tilePostedBy: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tilePostedByText: {
    fontSize: 10,
    color: '#fff',
    fontFamily: 'Figtree_500Medium',
  },
  postModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
});
