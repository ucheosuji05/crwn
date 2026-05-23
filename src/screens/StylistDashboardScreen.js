import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, Image, useWindowDimensions,
  RefreshControl, Pressable, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useProviderMode } from '../context/ProviderModeContext';
import { bookingService } from '../services/bookingService';
import { analyticsService } from '../services/analyticsService';
import { supabase } from '../config/supabase';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS       = ['Bookings', 'Services'];
const CAL_VIEWS  = ['Day', 'Week', 'Month'];
const MONTHS     = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HOURS      = Array.from({ length: 13 }, (_, i) => i + 7);
const FILTER_OPTIONS = [
  { label: 'Last 7 days',  value: 7  },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'All time',     value: 0  },
];
const BAR_MAX_H = 80;
const ANALYTICS_BREAK = 860;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':').map(Number);
  if (isNaN(hours)) return '';
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  const minStr = minutes && minutes !== 0 ? `:${String(minutes).padStart(2, '0')}` : ':00';
  return `${displayHour}${minStr} ${period}`;
}

function formatTimePill(timeStr) {
  if (!timeStr) return '';
  const [hours] = timeStr.split(':').map(Number);
  if (isNaN(hours)) return '';
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 || 12;
  return `${displayHour}${period}`;
}

function formatDuration(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = minutes / 60;
  return Number.isInteger(h) ? `${h} hour${h !== 1 ? 's' : ''}` : `${h.toFixed(1)} hours`;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function bookingsForDay(bookings, day) {
  return bookings.filter(b => {
    if (!b.appointment_date) return false;
    return sameDay(new Date(b.appointment_date + 'T00:00:00'), day);
  });
}

function blockedForDay(blockedTimes, day) {
  return blockedTimes.filter(b => {
    if (!b.block_date) return false;
    return sameDay(new Date(b.block_date + 'T00:00:00'), day);
  });
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtHour(h) {
  const p = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 || 12;
  return `${dh}:00 ${p}`;
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function clientSince(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `Client since ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AppointmentCard({ booking, colors, styles, onPress }) {
  const clientName = booking.client?.full_name || booking.client?.username || 'Client';
  const time       = formatTime(booking.appointment_time);
  const duration   = formatDuration(booking.duration_min || booking.service?.duration_min);
  const isPaid     = booking.deposit_status === 'paid' || booking.deposit_status === 'Paid';

  return (
    <TouchableOpacity style={styles.appointmentCard} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.appointmentCardTop}>
        <Text style={styles.appointmentClientName}>{clientName}</Text>
        {isPaid && (
          <View style={styles.depositBadge}>
            <Text style={styles.depositBadgeText}>Deposit Paid</Text>
          </View>
        )}
      </View>
      <Text style={styles.appointmentService}>{booking.service_name}</Text>
      {(time || duration) ? (
        <View style={styles.appointmentMeta}>
          {time     ? <Text style={styles.appointmentMetaText}>{time}</Text>     : null}
          {time && duration ? <View style={styles.appointmentBullet} /> : null}
          {duration ? <Text style={styles.appointmentMetaText}>{duration}</Text> : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function AddServiceModal({ visible, onClose, onSave, colors, styles }) {
  const [name, setName]         = useState('');
  const [price, setPrice]       = useState('');
  const [duration, setDuration] = useState('');
  const [desc, setDesc]         = useState('');
  const [saving, setSaving]     = useState(false);

  const reset = () => { setName(''); setPrice(''); setDuration(''); setDesc(''); };

  const handleSave = async () => {
    if (!name.trim() || !price.trim()) {
      Alert.alert('Required', 'Please enter a service name and price.');
      return;
    }
    setSaving(true);
    await onSave({ name: name.trim(), price: parseFloat(price), duration_min: parseInt(duration) || null, description: desc.trim() || null });
    setSaving(false);
    reset();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
          <View style={styles.addServiceModalHeader}>
            <Text style={styles.addServiceModalTitle}>New Service</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTabs="handled">
            <Text style={styles.inputLabel}>Service Name *</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              placeholder="e.g. Box Braids" placeholderTextColor={colors.placeholder}
              value={name} onChangeText={setName} />
            <Text style={styles.inputLabel}>Price ($) *</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              placeholder="e.g. 150" placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
            <Text style={styles.inputLabel}>Duration (minutes)</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              placeholder="e.g. 120" placeholderTextColor={colors.placeholder}
              keyboardType="number-pad" value={duration} onChangeText={setDuration} />
            <Text style={styles.inputLabel}>Description</Text>
            <TextInput style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBackground }]}
              placeholder="Describe what's included..." placeholderTextColor={colors.placeholder}
              multiline numberOfLines={4} textAlignVertical="top"
              value={desc} onChangeText={setDesc} />
          </ScrollView>
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            {saving
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.saveBtnText}>Save Service</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Block Time Modal ──────────────────────────────────────────────────────────
// Required SQL (run once in Supabase SQL Editor):
// CREATE TABLE IF NOT EXISTS blocked_times (
//   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
//   stylist_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
//   block_date date NOT NULL,
//   start_time time,  end_time time,
//   all_day boolean DEFAULT true,  reason text,
//   created_at timestamptz DEFAULT now()
// );
// CREATE INDEX IF NOT EXISTS idx_blocked_times_stylist ON blocked_times(stylist_id, block_date);

const TIME_OPTIONS = Array.from({ length: 17 }, (_, i) => i + 6); // 6 AM – 10 PM

// Mini calendar grid used inside BlockTimeModal
function MiniCalendar({ selectedDate, onSelectDate, colors }) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [viewMonth, setViewMonth] = useState(() =>
    selectedDate ? new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
                 : new Date(today.getFullYear(), today.getMonth(), 1)
  );

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

  const isSame = (a, b) => a && b &&
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
          {MONTHS[viewMonth.getMonth()]} {viewMonth.getFullYear()}
        </Text>
        <TouchableOpacity onPress={() => setViewMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {DAYS_SHORT.map(d => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 10, fontFamily: 'Figtree_600SemiBold', color: colors.textMuted, textTransform: 'uppercase' }}>{d}</Text>
        ))}
      </View>

      {/* Date grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={{ width: '14.28%', height: 36 }} />;
          const isToday    = isSame(day, today);
          const isSelected = isSame(day, selectedDate);
          const isPast     = day < today;
          return (
            <TouchableOpacity
              key={day.toISOString()}
              style={{
                width: '14.28%', height: 36,
                alignItems: 'center', justifyContent: 'center',
              }}
              onPress={() => onSelectDate(day)}
              disabled={isPast}
            >
              <View style={{
                width: 30, height: 30, borderRadius: 15,
                alignItems: 'center', justifyContent: 'center',
                backgroundColor: isSelected ? '#5D1F1F' : 'transparent',
              }}>
                <Text style={{
                  fontSize: 13,
                  fontFamily: isSelected ? 'Figtree_700Bold' : 'Figtree_500Medium',
                  color: isSelected ? '#fff' : isToday ? '#C8835A' : isPast ? colors.borderLight : colors.text,
                }}>
                  {day.getDate()}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function BlockTimeModal({ visible, onClose, onSave, defaultDate, colors, styles }) {
  const [selectedDate, setSelectedDate] = useState(null);
  const [allDay,       setAllDay]       = useState(true);
  const [startHour,    setStartHour]    = useState(9);
  const [endHour,      setEndHour]      = useState(17);
  const [reason,       setReason]       = useState('');
  const [saving,       setSaving]       = useState(false);

  useEffect(() => {
    if (visible) setSelectedDate(defaultDate || new Date());
  }, [visible, defaultDate]);

  const reset = () => {
    setAllDay(true); setStartHour(9); setEndHour(17);
    setReason(''); setSaving(false);
  };

  const handleSave = async () => {
    if (!selectedDate) { Alert.alert('Required', 'Please select a date.'); return; }
    if (!allDay && endHour <= startHour) { Alert.alert('Invalid', 'End time must be after start time.'); return; }
    setSaving(true);
    const result = await onSave({
      date:      toDateStr(selectedDate),
      allDay,
      startTime: allDay ? null : `${String(startHour).padStart(2, '0')}:00:00`,
      endTime:   allDay ? null : `${String(endHour).padStart(2, '0')}:00:00`,
      reason:    reason.trim() || null,
    });
    setSaving(false);
    // Only close the modal when the save actually worked
    if (result?.success) {
      reset();
      onClose();
    }
  };

  const displayDate = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : 'Select a date';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { reset(); onClose(); }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>

          {/* Header */}
          <View style={styles.addServiceModalHeader}>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.addServiceModalTitle}>Block Time Off</Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !selectedDate}
              style={{ opacity: saving || !selectedDate ? 0.4 : 1 }}
            >
              {saving
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Text style={{ fontSize: 15, fontFamily: 'Figtree_700Bold', color: colors.primary }}>Save</Text>
              }
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>

            {/* ── Selected date display ── */}
            <View style={[styles.blockDateDisplay, { borderColor: colors.borderLight }]}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              <Text style={[styles.blockDateText, { color: selectedDate ? colors.text : colors.textMuted }]}>
                {displayDate}
              </Text>
            </View>

            {/* ── Inline mini calendar ── */}
            <View style={[styles.blockCalCard, { borderColor: colors.borderLight }]}>
              <MiniCalendar
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                colors={colors}
              />
            </View>

            {/* ── Duration type ── */}
            <Text style={[styles.blockSectionLabel, { color: colors.textMuted }]}>DURATION</Text>
            <View style={[styles.blockSegment, { borderColor: colors.borderLight, backgroundColor: colors.inputBackground }]}>
              <TouchableOpacity
                style={[styles.blockSegBtn, allDay && { backgroundColor: '#5D1F1F' }]}
                onPress={() => setAllDay(true)}
              >
                <Ionicons name="sunny-outline" size={14} color={allDay ? '#fff' : colors.textMuted} />
                <Text style={[styles.blockSegBtnText, { color: allDay ? '#fff' : colors.textMuted }]}>All Day</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.blockSegBtn, !allDay && { backgroundColor: '#5D1F1F' }]}
                onPress={() => setAllDay(false)}
              >
                <Ionicons name="time-outline" size={14} color={!allDay ? '#fff' : colors.textMuted} />
                <Text style={[styles.blockSegBtnText, { color: !allDay ? '#fff' : colors.textMuted }]}>Custom Hours</Text>
              </TouchableOpacity>
            </View>

            {/* ── Custom time range ── */}
            {!allDay && (
              <View style={[styles.blockTimeCard, { borderColor: colors.borderLight }]}>
                {/* Start time */}
                <View style={styles.blockTimeSection}>
                  <Text style={[styles.blockTimeSectionLabel, { color: colors.textMuted }]}>FROM</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    {TIME_OPTIONS.map(h => (
                      <TouchableOpacity
                        key={`s-${h}`}
                        style={[styles.blockTimeChip, { borderColor: colors.border },
                          h === startHour && { backgroundColor: '#5D1F1F', borderColor: '#5D1F1F' }
                        ]}
                        onPress={() => { setStartHour(h); if (endHour <= h) setEndHour(h + 1); }}
                      >
                        <Text style={[styles.blockTimeChipText, { color: h === startHour ? '#fff' : colors.text }]}>
                          {fmtHour(h)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={[styles.blockTimeDivider, { backgroundColor: colors.borderLight }]} />

                {/* End time */}
                <View style={styles.blockTimeSection}>
                  <Text style={[styles.blockTimeSectionLabel, { color: colors.textMuted }]}>TO</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                  >
                    {TIME_OPTIONS.filter(h => h > startHour).map(h => (
                      <TouchableOpacity
                        key={`e-${h}`}
                        style={[styles.blockTimeChip, { borderColor: colors.border },
                          h === endHour && { backgroundColor: '#5D1F1F', borderColor: '#5D1F1F' }
                        ]}
                        onPress={() => setEndHour(h)}
                      >
                        <Text style={[styles.blockTimeChipText, { color: h === endHour ? '#fff' : colors.text }]}>
                          {fmtHour(h)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Summary */}
                <View style={[styles.blockTimeSummary, { backgroundColor: colors.primaryLight || '#FDF1EE' }]}>
                  <Ionicons name="time-outline" size={14} color={colors.primary} />
                  <Text style={[styles.blockTimeSummaryText, { color: colors.primary }]}>
                    {fmtHour(startHour)} – {fmtHour(endHour)}
                  </Text>
                </View>
              </View>
            )}

            {/* ── Reason ── */}
            <Text style={[styles.blockSectionLabel, { color: colors.textMuted, marginTop: 20 }]}>REASON (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, styles.blockReasonInput, { color: colors.text, borderColor: colors.borderLight, backgroundColor: colors.inputBackground }]}
              placeholder="e.g. Personal time, holiday, travel..."
              placeholderTextColor={colors.placeholder}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

          </ScrollView>

          {/* Save button */}
          <View style={{ padding: 16, paddingBottom: Platform.OS === 'ios' ? 28 : 16 }}>
            <TouchableOpacity style={[styles.saveBtn, (saving || !selectedDate) && { opacity: 0.5 }]} onPress={handleSave} disabled={saving || !selectedDate}>
              <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Block This Time</Text>
              }
            </TouchableOpacity>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Mini bar chart ────────────────────────────────────────────────────────────

function BarChart({ data, colors }) {
  const peak = Math.max(...data.map(d => d.count), 1);
  return (
    <View style={barStyles.container}>
      <View style={barStyles.header}>
        <Text style={[barStyles.label, { color: colors.textMuted }]}>VIEWS THIS WEEK</Text>
        <Text style={[barStyles.peak, { color: colors.textSecondary }]}>Peak: {fmtNum(peak)}</Text>
      </View>
      <View style={barStyles.barsRow}>
        {data.map(({ day, count }, i) => {
          const h = peak > 0 ? Math.max((count / peak) * BAR_MAX_H, count > 0 ? 6 : 2) : 2;
          return (
            <View key={`bar-${day}-${i}`} style={barStyles.barCol}>
              <View style={barStyles.barTrack}>
                <View style={[barStyles.bar, { height: h, backgroundColor: colors.primary }]} />
              </View>
              <Text style={[barStyles.dayLabel, { color: colors.textMuted }]}>{day.charAt(0)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  container:  { marginBottom: 4 },
  header:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label:      { fontSize: 10, fontFamily: 'Figtree_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  peak:       { fontSize: 11, fontFamily: 'Figtree_500Medium' },
  barsRow:    { flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX_H + 24, gap: 4 },
  barCol:     { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  barTrack:   { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar:        { width: '80%', borderRadius: 3, minHeight: 2 },
  dayLabel:   { fontSize: 10, fontFamily: 'Figtree_500Medium', marginTop: 4 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StylistDashboardScreen() {
  const { user, profileLoaded } = useAuth();
  const { colors }              = useTheme();
  const { toggleMode }          = useProviderMode();
  const { width: windowWidth }  = useWindowDimensions();
  const isWide                  = windowWidth >= ANALYTICS_BREAK;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [activeTab,         setActiveTab]         = useState('Bookings');
  const [bookingView,       setBookingView]       = useState('list'); // 'list' | 'calendar'
  const [calView,           setCalView]           = useState('Month');
  const [bookings,          setBookings]          = useState([]);
  const [services,          setServices]          = useState([]);
  const [loadingBookings,   setLoadingBookings]   = useState(true);
  const [loadingServices,   setLoadingServices]   = useState(true);
  const [addServiceVisible, setAddServiceVisible] = useState(false);

  // Appointment detail modal
  const [selectedBooking,      setSelectedBooking]      = useState(null);
  const [apptDetailVisible,    setApptDetailVisible]    = useState(false);
  const [clientProfile,        setClientProfile]        = useState(null);
  const [clientProfileLoading, setClientProfileLoading] = useState(false);

  // Block time off
  const [blockTimeVisible, setBlockTimeVisible] = useState(false);
  const [blockedTimes,     setBlockedTimes]     = useState([]);

  // Calendar state
  const today       = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [selectedDay,  setSelectedDay]  = useState(today);
  const [calMonth,     setCalMonth]     = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [calWeekStart, setCalWeekStart] = useState(startOfWeek(today));

  // Analytics state
  const [analyticsLoading,  setAnalyticsLoading]  = useState(true);
  const [analyticsPosts,    setAnalyticsPosts]    = useState([]);
  const [analyticsStats,    setAnalyticsStats]    = useState(null);
  const [bookmarkCounts,    setBookmarkCounts]    = useState({});
  const [weeklyActivity,    setWeeklyActivity]    = useState([]);
  const [recentComments,    setRecentComments]    = useState([]);
  const [selectedPost,      setSelectedPost]      = useState(null);
  const [postModalVisible,  setPostModalVisible]  = useState(false);
  const [filterDays,        setFilterDays]        = useState(30);
  const [filterMenuOpen,    setFilterMenuOpen]    = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadBookings = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await bookingService.getBookingsByStylist(user.id);
    setBookings(data || []);
    setLoadingBookings(false);
  }, [user?.id]);

  const loadBlockedTimes = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('blocked_times')
        .select('*')
        .eq('stylist_id', user.id)
        .order('block_date', { ascending: true });
      setBlockedTimes(data || []);
    } catch (_) {}
  }, [user?.id]);

  const loadServices = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await bookingService.getServices(user.id);
    setServices(data || []);
    setLoadingServices(false);
  }, [user?.id]);

  const loadAnalytics = useCallback(async () => {
    if (!user?.id) return;
    setAnalyticsLoading(true);
    try {
      const { data: posts } = await analyticsService.getProviderPosts(user.id);
      const safePost = posts || [];
      const postIds  = safePost.map(p => p.id);

      const [bmCounts, weekly, comments, { data: bkgs }] = await Promise.all([
        analyticsService.getBookmarkCounts(postIds),
        analyticsService.getWeeklyActivity(postIds),
        analyticsService.getRecentComments(postIds, 6),
        bookingService.getBookingsByStylist(user.id),
      ]);

      const stats = analyticsService.computeAggregateStats(safePost, bmCounts, bkgs || []);

      setAnalyticsPosts(safePost);
      setAnalyticsStats(stats);
      setBookmarkCounts(bmCounts);
      setWeeklyActivity(weekly);
      setRecentComments(comments.data || []);
      if (!selectedPost && safePost.length > 0) setSelectedPost(safePost[0]);
    } catch (e) {
      console.error('[Analytics] load error:', e);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [user?.id]);

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadBookings(), loadServices(), loadAnalytics(), loadBlockedTimes()]);
    setRefreshing(false);
  }, [loadBookings, loadServices, loadAnalytics, loadBlockedTimes]);

  useEffect(() => { loadBookings(); }, [loadBookings]);
  useEffect(() => { loadServices(); }, [loadServices]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { loadBlockedTimes(); }, [loadBlockedTimes]);

  // ── Appointment detail ────────────────────────────────────────────────────────

  const openAppointmentDetail = useCallback(async (booking) => {
    setSelectedBooking(booking);
    setClientProfile(null);
    setApptDetailVisible(true);
    if (booking.client?.id) {
      setClientProfileLoading(true);
      try {
        const { data } = await supabase
          .from('profiles')
          .select('hair_type, porosity, density, texture, hair_goals, avatar_url, created_at, full_name, username')
          .eq('id', booking.client.id)
          .single();
        setClientProfile(data);
      } catch (_) {}
      setClientProfileLoading(false);
    }
  }, []);

  // ── Filter ───────────────────────────────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    if (!filterDays) return analyticsPosts;
    const cutoff = new Date(Date.now() - filterDays * 24 * 60 * 60 * 1000);
    return analyticsPosts.filter(p => new Date(p.created_at) >= cutoff);
  }, [analyticsPosts, filterDays]);

  // ── Today summary ─────────────────────────────────────────────────────────────
  const todayBookings = useMemo(() => bookingsForDay(bookings, today), [bookings, today]);

  // ── Booking status ───────────────────────────────────────────────────────────
  const handleStatusChange = async (bookingId, status) => {
    const { error } = await bookingService.updateBookingStatus(bookingId, status);
    if (!error) setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status } : b));
  };

  // ── Service CRUD ─────────────────────────────────────────────────────────────
  const handleAddService = async (service) => {
    const { data, error } = await bookingService.addService(user.id, service);
    if (!error && data) setServices(prev => [...prev, data]);
  };

  const handleDeleteService = (serviceId) => {
    if (Platform.OS === 'web') {
      if (window.confirm('Remove this service from your profile?')) {
        bookingService.deleteService(serviceId).then(({ error }) => {
          if (!error) setServices(prev => prev.filter(s => s.id !== serviceId));
        });
      }
    } else {
      Alert.alert('Delete Service', 'Remove this service from your profile?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          const { error } = await bookingService.deleteService(serviceId);
          if (!error) setServices(prev => prev.filter(s => s.id !== serviceId));
        }},
      ]);
    }
  };

  // ── Block time ───────────────────────────────────────────────────────────────
  const handleBlockTime = async ({ date, allDay, startTime, endTime, reason }) => {
    const { data, error } = await supabase
      .from('blocked_times')
      .insert({
        stylist_id: user.id,
        block_date: date,
        all_day:    allDay,
        start_time: startTime,
        end_time:   endTime,
        reason,
      })
      .select()
      .single();

    if (!error && data) {
      setBlockedTimes(prev => [...prev, data]);
      // Switch to calendar view and jump to the blocked date so it's immediately visible
      const blockedDate = new Date(date + 'T00:00:00');
      setBookingView('calendar');
      setCalView('Month');
      setSelectedDay(blockedDate);
      setCalMonth(new Date(blockedDate.getFullYear(), blockedDate.getMonth(), 1));
      return { success: true };
    } else {
      console.warn('[BlockTime] Save failed:', error?.message, error?.code);
      const msg = error?.code === '42P01'
        ? 'The blocked_times table hasn\'t been created yet.\n\nRun the SQL from the code comments in your Supabase SQL Editor to set it up.'
        : error?.message || 'Something went wrong. Please try again.';
      Alert.alert('Could not save', msg);
      return { success: false };
    }
  };

  const handleDeleteBlock = async (blockId) => {
    const { error } = await supabase.from('blocked_times').delete().eq('id', blockId);
    if (!error) setBlockedTimes(prev => prev.filter(b => b.id !== blockId));
  };

  // ── Calendar helpers ─────────────────────────────────────────────────────────
  const monthDays = useMemo(() => {
    const year  = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const first = new Date(year, month, 1).getDay();
    const total = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= total; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [calMonth]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(calWeekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [calWeekStart]);

  // ── Analytics helpers ─────────────────────────────────────────────────────────
  const openPostDetail = (post) => {
    setSelectedPost(post);
    if (!isWide) setPostModalVisible(true);
  };

  const selectedPostMetrics = useMemo(() => {
    if (!selectedPost) return null;
    return analyticsService.computePostMetrics(
      selectedPost,
      bookmarkCounts[selectedPost.id] || 0,
      analyticsStats?.totalBookings || 0,
    );
  }, [selectedPost, bookmarkCounts, analyticsStats]);

  const filterLabel = FILTER_OPTIONS.find(f => f.value === filterDays)?.label ?? 'Last 30 days';

  // ── Analytics render ─────────────────────────────────────────────────────────

  const renderOverviewStats = () => {
    if (!analyticsStats) return null;
    const { totalCrowns, totalSaves, totalBookings, engagementRate } = analyticsStats;
    return (
      <View>
        <View style={styles.analyticsGrid}>
          <View style={styles.analyticsStatCard}>
            <View style={styles.analyticsStatIcon}><Ionicons name="heart" size={16} color={colors.primary} /></View>
            <Text style={styles.analyticsStatValue}>{fmtNum(totalCrowns)}</Text>
            <Text style={styles.analyticsStatLabel}>Total Crowns</Text>
          </View>
          <View style={styles.analyticsStatCard}>
            <View style={styles.analyticsStatIcon}><Ionicons name="eye-outline" size={16} color={colors.primary} /></View>
            <Text style={styles.analyticsStatValue}>{fmtNum(totalCrowns * 5)}</Text>
            <Text style={styles.analyticsStatLabel}>Profile Visits</Text>
          </View>
          <View style={styles.analyticsStatCard}>
            <View style={styles.analyticsStatIcon}><Ionicons name="bookmark-outline" size={16} color={colors.primary} /></View>
            <Text style={styles.analyticsStatValue}>{fmtNum(totalSaves)}</Text>
            <Text style={styles.analyticsStatLabel}>Total Saves</Text>
          </View>
          <View style={styles.analyticsStatCard}>
            <View style={styles.analyticsStatIcon}><Ionicons name="calendar-outline" size={16} color={colors.primary} /></View>
            <Text style={styles.analyticsStatValue}>{totalBookings}</Text>
            <Text style={styles.analyticsStatLabel}>Bookings</Text>
          </View>
        </View>
        <View style={[styles.engagementBanner, { backgroundColor: colors.primaryLight || '#FDF1EE' }]}>
          <Ionicons name="trending-up" size={16} color={colors.primary} />
          <Text style={[styles.engagementBannerLabel, { color: colors.textSecondary }]}>Avg. Engagement Rate</Text>
          <Text style={[styles.engagementBannerValue, { color: colors.primary }]}>{engagementRate}%</Text>
        </View>
      </View>
    );
  };

  const renderPostListItem = (post, index) => {
    const metrics    = analyticsService.computePostMetrics(post, bookmarkCounts[post.id] || 0);
    const thumb      = post.post_media?.[0]?.media_url;
    const tags       = Array.isArray(post.tags) ? post.tags.slice(0, 3).map(t => `#${t}`).join(' ') : '';
    const isSelected = isWide && selectedPost?.id === post.id;
    return (
      <TouchableOpacity key={post.id} style={[styles.postListItem, isSelected && styles.postListItemSelected]}
        onPress={() => openPostDetail(post)} activeOpacity={0.8}>
        <View style={styles.postThumb}>
          {thumb
            ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="image-outline" size={20} color={colors.border} />
              </View>
          }
        </View>
        <View style={styles.postListInfo}>
          <Text style={styles.postListTitle} numberOfLines={1}>{post.title || 'Untitled'}</Text>
          {!!tags && <Text style={[styles.postListTags, { color: colors.primary }]} numberOfLines={1}>{tags}</Text>}
          <Text style={styles.postListDate}>{formatDate(post.created_at)}</Text>
          <View style={styles.postMetricsRow}>
            <View style={styles.postMetric}><Ionicons name="heart" size={11} color={colors.primary} /><Text style={styles.postMetricText}>{fmtNum(metrics.likes)}</Text></View>
            <View style={styles.postMetric}><Ionicons name="eye-outline" size={11} color={colors.textMuted} /><Text style={styles.postMetricText}>{fmtNum(metrics.estViews)}</Text></View>
            <View style={styles.postMetric}><Ionicons name="bookmark-outline" size={11} color={colors.textMuted} /><Text style={styles.postMetricText}>{fmtNum(metrics.saves)}</Text></View>
          </View>
          <View style={styles.postListFooter}>
            <View style={[styles.engagementChip, { backgroundColor: colors.primaryLight || '#FDF1EE' }]}>
              <Ionicons name="trending-up" size={10} color={colors.primary} />
              <Text style={[styles.engagementChipText, { color: colors.primary }]}>{metrics.rate}%</Text>
            </View>
            {metrics.bookings > 0 && (
              <View style={styles.bookingsChip}>
                <Ionicons name="cut-outline" size={10} color={colors.textMuted} />
                <Text style={styles.bookingsChipText}>{metrics.bookings} bookings</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPostDetailPanel = (post) => {
    if (!post || !selectedPostMetrics) return (
      <View style={styles.detailEmpty}>
        <Ionicons name="bar-chart-outline" size={40} color={colors.border} />
        <Text style={[styles.detailEmptyText, { color: colors.textMuted }]}>Select a post to view analytics</Text>
      </View>
    );
    const thumb = post.post_media?.[0]?.media_url;
    const tags  = Array.isArray(post.tags) ? post.tags.map(t => `#${t}`).join(' ') : '';
    const { likes, comments, saves, estViews, rate } = selectedPostMetrics;
    const conversionRate = ((analyticsStats?.totalBookings || 0) / Math.max(estViews, 1) * 100).toFixed(1);
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {thumb && (
          <View style={styles.detailHero}>
            <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.5)']} style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 16 }]}>
              <Text style={styles.detailHeroTitle} numberOfLines={2}>{post.title || 'Untitled'}</Text>
            </LinearGradient>
          </View>
        )}
        <View style={styles.detailBody}>
          {!thumb && <Text style={styles.detailTitle}>{post.title || 'Untitled'}</Text>}
          {!!tags && <Text style={[styles.detailTags, { color: colors.primary }]}>{tags}</Text>}
          <View style={styles.detailDateRow}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={styles.detailDate}>{formatDate(post.created_at)}</Text>
          </View>
          <Text style={styles.detailSectionLabel}>ENGAGEMENT</Text>
          <View style={styles.engagementGrid}>
            {[['heart','Crowns',likes],['eye-outline','Views',estViews],['bookmark-outline','Saves',saves],['chatbubble-outline','Comments',comments]].map(([icon, label, val], idx) => (
              <View key={`eng-${idx}`} style={styles.engagementCell}>
                <View style={styles.engagementCellIcon}><Ionicons name={icon} size={14} color={colors.primary} /></View>
                <Text style={styles.engagementCellValue}>{fmtNum(val)}</Text>
                <Text style={styles.engagementCellLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.engagementRateRow, { backgroundColor: colors.primaryLight || '#FDF1EE' }]}>
            <Ionicons name="trending-up" size={14} color={colors.primary} />
            <Text style={[styles.engagementRateLabel, { color: colors.textSecondary }]}>Engagement Rate</Text>
            <Text style={[styles.engagementRateValue, { color: colors.primary }]}>{rate}%</Text>
          </View>
          {weeklyActivity.length > 0 && (
            <View style={styles.detailSection}><BarChart data={weeklyActivity} colors={colors} /></View>
          )}
          <View style={styles.detailSection}>
            <View style={styles.bookingsFromPostRow}>
              <View style={styles.bookingsFromPostLeft}>
                <View style={styles.bookingsFromPostIcon}><Ionicons name="people-outline" size={14} color={colors.primary} /></View>
                <Text style={[styles.detailSectionLabel, { marginBottom: 0 }]}>BOOKINGS FROM POST</Text>
              </View>
              <Text style={styles.bookingsFromPostCount}>{analyticsStats?.totalBookings ?? 0}</Text>
            </View>
            <View style={styles.conversionRow}>
              <Text style={styles.conversionLabel}>Conversion rate</Text>
              <Text style={[styles.conversionValue, { color: colors.primary }]}>{conversionRate}%</Text>
            </View>
            <View style={styles.conversionBar}>
              <View style={[styles.conversionFill, { width: `${Math.min(parseFloat(conversionRate), 100)}%`, backgroundColor: colors.primary }]} />
            </View>
          </View>
          {recentComments.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionLabel}>RECENT COMMENTS</Text>
              {recentComments.map(c => (
                <View key={c.id} style={styles.commentRow}>
                  <View style={styles.commentAvatar}>
                    {c.profiles?.avatar_url
                      ? <Image source={{ uri: c.profiles.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                      : <View style={[styles.commentAvatarPlaceholder, { backgroundColor: colors.borderLight }]}><Ionicons name="person" size={16} color={colors.border} /></View>
                    }
                  </View>
                  <View style={styles.commentBody}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentUsername}>{c.profiles?.username || c.profiles?.full_name || 'User'}</Text>
                      <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                    </View>
                    <Text style={styles.commentText} numberOfLines={2}>{c.content}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  const renderPostModal = () => (
    <Modal visible={postModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPostModalVisible(false)}>
      <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.surface }]} edges={['top']}>
        <View style={styles.postModalHeader}>
          <Text style={[styles.postModalTitle, { color: colors.text }]}>Post Analytics</Text>
          <TouchableOpacity onPress={() => setPostModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        {renderPostDetailPanel(selectedPost)}
        <View style={[styles.postModalFooter, { borderTopColor: colors.borderLight, backgroundColor: colors.surface }]}>
          <TouchableOpacity style={[styles.closeBtn, { borderColor: colors.border }]} onPress={() => setPostModalVisible(false)}>
            <Text style={[styles.closeBtnText, { color: colors.text }]}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareBtn}>
            <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.shareBtnText}>Share Post</Text>
            <Ionicons name="share-outline" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );

  const renderAnalytics = () => {
    if (analyticsLoading) return <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />;
    return (
      <View style={styles.analyticsContainer}>
        {isWide ? (
          <View style={styles.analyticsWideRow}>
            <View style={styles.analyticsLeftCol}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {renderOverviewStats()}
                <View style={styles.sectionHeaderRow}><Text style={styles.sectionTitle}>RECENT POSTS</Text></View>
                {filteredPosts.length === 0
                  ? <Text style={styles.emptyAnalyticsText}>No posts yet</Text>
                  : filteredPosts.map(renderPostListItem)}
              </ScrollView>
            </View>
            <View style={styles.analyticsCenterCol}>
              {selectedPost ? renderPostDetailPanel(selectedPost) : (
                <View style={styles.detailEmpty}>
                  <Ionicons name="bar-chart-outline" size={48} color={colors.border} />
                  <Text style={[styles.detailEmptyText, { color: colors.textMuted }]}>Select a post to view analytics</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.analyticsMobileContent}>
            <View style={styles.filterRow}>
              <TouchableOpacity style={[styles.filterChip, { borderColor: colors.border }]} onPress={() => setFilterMenuOpen(v => !v)}>
                <Text style={[styles.filterChipText, { color: colors.text }]}>{filterLabel}</Text>
                <Ionicons name={filterMenuOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
              </TouchableOpacity>
              {filterMenuOpen && (
                <View style={[styles.filterDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {FILTER_OPTIONS.map(opt => (
                    <TouchableOpacity key={opt.value} style={styles.filterOption} onPress={() => { setFilterDays(opt.value); setFilterMenuOpen(false); }}>
                      <Text style={[styles.filterOptionText, { color: opt.value === filterDays ? colors.primary : colors.text }]}>{opt.label}</Text>
                      {opt.value === filterDays && <Ionicons name="checkmark" size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            {renderOverviewStats()}
            <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 12 }]}>RECENT POSTS</Text>
            {filteredPosts.length === 0
              ? <Text style={styles.emptyAnalyticsText}>No posts for this period</Text>
              : filteredPosts.map(renderPostListItem)}
          </ScrollView>
        )}
        {renderPostModal()}
      </View>
    );
  };

  // ── Render: Bookings ──────────────────────────────────────────────────────────

  const renderSummaryCard = () => {
    const count = todayBookings.length;
    return (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Today</Text>
        <Text style={styles.summaryCount}>{count} appointment{count !== 1 ? 's' : ''}</Text>
      </View>
    );
  };

  const renderBookingsList = () => {
    const upcoming = bookings.filter(b => b.status === 'upcoming');
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        {renderSummaryCard()}

        {loadingBookings ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : upcoming.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={40} color={colors.border} />
            <Text style={styles.emptyTitle}>No upcoming bookings</Text>
            <Text style={styles.emptyText}>Share your profile to start getting booked</Text>
          </View>
        ) : (
          upcoming.map(b => (
            <AppointmentCard
              key={b.id}
              booking={b}
              colors={colors}
              styles={styles}
              onPress={() => openAppointmentDetail(b)}
            />
          ))
        )}

        {/* Block time off */}
        <TouchableOpacity style={styles.blockTimeBtn} activeOpacity={0.7} onPress={() => setBlockTimeVisible(true)}>
          <Text style={styles.blockTimeBtnText}>+ Block time off</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderBookings = () => (
    bookingView === 'list' ? renderBookingsList() : renderCalendar()
  );

  // ── Render: Calendar ──────────────────────────────────────────────────────────

  const renderCalendar = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      {renderSummaryCard()}

      {/* Day / Week / Month switcher */}
      <View style={styles.calViewRow}>
        {CAL_VIEWS.map(v => (
          <TouchableOpacity key={v} style={[styles.calViewBtn, calView === v && styles.calViewBtnActive]} onPress={() => setCalView(v)}>
            <Text style={[styles.calViewText, calView === v && styles.calViewTextActive]}>{v}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {calView === 'Month' && renderMonthView()}
      {calView === 'Week'  && renderWeekView()}
      {calView === 'Day'   && renderDayView()}
    </ScrollView>
  );

  const renderMonthView = () => {
    const selDayBookings  = bookingsForDay(bookings, selectedDay);
    const selDayBlocked   = blockedForDay(blockedTimes, selectedDay);

    return (
      <View>
        {/* Month navigation */}
        <View style={styles.calNav}>
          <TouchableOpacity onPress={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.calNavTitle}>{MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}</Text>
          <TouchableOpacity onPress={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Day-of-week headers */}
        <View style={[styles.calDayHeaders, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline }]}>
          {DAYS_SHORT.map(d => (
            <Text key={d} style={[styles.calDayHeader, { color: colors.textMuted }]}>{d}</Text>
          ))}
        </View>

        {/* Calendar grid with borders */}
        <View style={[styles.calGrid, { borderTopWidth: StyleSheet.hairlineWidth, borderLeftWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline }]}>
          {monthDays.map((day, i) => {
            if (!day) {
              return (
                <View key={`e-${i}`} style={[styles.calCell, { borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline }]} />
              );
            }
            const isToday      = sameDay(day, today);
            const isSelected   = sameDay(day, selectedDay);
            const dayBookings  = bookingsForDay(bookings, day);
            const dayBlocked   = blockedForDay(blockedTimes, day);
            const hasBookings  = dayBookings.length > 0;
            const isBlocked    = dayBlocked.length > 0;

            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={[
                  styles.calCell,
                  { borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.hairline },
                  isBlocked && !hasBookings && { backgroundColor: '#F5F5F5' },
                ]}
                onPress={() => setSelectedDay(day)}
                activeOpacity={0.7}
              >
                {/* Date number */}
                <Text style={[
                  styles.calCellText,
                  isToday    && styles.calCellToday,
                  isSelected && styles.calCellSelectedText,
                ]}>
                  {day.getDate()}
                </Text>

                {/* Booking time pills */}
                {hasBookings && (
                  <View style={styles.calPillCol}>
                    {dayBookings.slice(0, 3).map((b, bi) => (
                      <View key={`bp-${bi}`} style={[styles.calTimePill, { backgroundColor: colors.primary }]}>
                        <Text style={styles.calTimePillText}>{formatTimePill(b.appointment_time) || '●'}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Blocked indicator (when no bookings) */}
                {isBlocked && !hasBookings && (
                  <View style={[styles.calTimePill, { backgroundColor: '#9ca3af' }]}>
                    <Text style={styles.calTimePillText}>Off</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.calLegend}>
          <View style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.calLegendText, { color: colors.textSecondary }]}>Booked</Text>
          </View>
          <View style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { backgroundColor: '#9ca3af' }]} />
            <Text style={[styles.calLegendText, { color: colors.textSecondary }]}>Blocked</Text>
          </View>
          <View style={styles.calLegendItem}>
            <View style={[styles.calLegendDot, { backgroundColor: colors.borderLight, borderWidth: 1, borderColor: colors.border }]} />
            <Text style={[styles.calLegendText, { color: colors.textSecondary }]}>Available</Text>
          </View>
        </View>

        {/* Selected day detail */}
        <View style={styles.calDayBookings}>
          <Text style={styles.calDayBookingsTitle}>
            {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>

          {/* Blocked time slots for this day */}
          {selDayBlocked.map(b => (
            <View key={b.id} style={styles.blockedSlotRow}>
              <View style={styles.blockedSlotLeft}>
                <View style={[styles.blockedSlotIcon, { backgroundColor: '#9ca3af22' }]}>
                  <Ionicons name="ban-outline" size={14} color="#9ca3af" />
                </View>
                <View>
                  <Text style={[styles.blockedSlotTitle, { color: colors.text }]}>
                    {b.all_day ? 'All Day Blocked' : `${formatTime(b.start_time)} – ${formatTime(b.end_time)}`}
                  </Text>
                  {b.reason ? <Text style={[styles.blockedSlotReason, { color: colors.textMuted }]}>{b.reason}</Text> : null}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert('Remove Block', 'Remove this blocked time?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => handleDeleteBlock(b.id) },
                ])}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}

          {/* Bookings for this day */}
          {selDayBookings.length === 0 && selDayBlocked.length === 0 ? (
            <Text style={styles.calEmptyText}>No bookings this day</Text>
          ) : selDayBookings.map(b => (
            <AppointmentCard key={b.id} booking={b} colors={colors} styles={styles} onPress={() => openAppointmentDetail(b)} />
          ))}
        </View>
      </View>
    );
  };

  const renderWeekView = () => {
    const selDayBlocked  = blockedForDay(blockedTimes, selectedDay);
    const selDayBookings = bookingsForDay(bookings, selectedDay);
    return (
      <View>
        <View style={styles.calNav}>
          <TouchableOpacity onPress={() => setCalWeekStart(w => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; })}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.calNavTitle}>
            {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
            {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setCalWeekStart(w => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; })}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.weekRow}>
          {weekDays.map((day) => {
            const isToday    = sameDay(day, today);
            const isSelected = sameDay(day, selectedDay);
            const count      = bookingsForDay(bookings, day).length;
            const isBlocked  = blockedForDay(blockedTimes, day).length > 0;
            return (
              <TouchableOpacity
                key={day.toISOString()}
                style={[styles.weekCell, isSelected && styles.weekCellSelected, isBlocked && !count && styles.weekCellOff]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.weekDayLabel, isToday && { color: colors.primary }]}>{DAYS_SHORT[day.getDay()]}</Text>
                <View style={[styles.weekDayNum, isSelected && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.weekDayNumText, isSelected && { color: '#fff' }]}>{day.getDate()}</Text>
                </View>
                {count > 0 && (
                  <View style={[styles.weekBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.weekBadgeText}>{count}</Text>
                  </View>
                )}
                {isBlocked && count === 0 && (
                  <View style={[styles.weekBadge, { backgroundColor: '#9ca3af' }]}>
                    <Text style={styles.weekBadgeText}>Off</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.calDayBookings}>
          <Text style={styles.calDayBookingsTitle}>
            {selectedDay.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </Text>
          {/* Blocked time slots */}
          {selDayBlocked.map(b => (
            <View key={b.id} style={styles.blockedSlotRow}>
              <View style={styles.blockedSlotLeft}>
                <View style={[styles.blockedSlotIcon, { backgroundColor: '#9ca3af22' }]}>
                  <Ionicons name="ban-outline" size={14} color="#9ca3af" />
                </View>
                <View>
                  <Text style={[styles.blockedSlotTitle, { color: colors.text }]}>
                    {b.all_day ? 'All Day Blocked' : `${formatTime(b.start_time)} – ${formatTime(b.end_time)}`}
                  </Text>
                  {b.reason ? <Text style={[styles.blockedSlotReason, { color: colors.textMuted }]}>{b.reason}</Text> : null}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert('Remove Block', 'Remove this blocked time?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => handleDeleteBlock(b.id) },
                ])}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))}
          {selDayBookings.length === 0 && selDayBlocked.length === 0
            ? <Text style={styles.calEmptyText}>No bookings this day</Text>
            : selDayBookings.map(b => (
              <AppointmentCard key={b.id} booking={b} colors={colors} styles={styles} onPress={() => openAppointmentDetail(b)} />
            ))
          }
        </View>
      </View>
    );
  };

  const renderDayView = () => {
    const dayBookings    = bookingsForDay(bookings, selectedDay);
    const dayBlocked     = blockedForDay(blockedTimes, selectedDay);
    const allDayBlocks   = dayBlocked.filter(b => b.all_day);
    const partialBlocks  = dayBlocked.filter(b => !b.all_day && b.start_time && b.end_time);

    const isHourBlocked = (h) =>
      allDayBlocks.length > 0 ||
      partialBlocks.some(b => {
        const startH = parseInt(b.start_time.split(':')[0], 10);
        const endH   = parseInt(b.end_time.split(':')[0], 10);
        return h >= startH && h < endH;
      });

    return (
      <View>
        <View style={styles.calNav}>
          <TouchableOpacity onPress={() => setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() - 1); return n; })}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.calNavTitle}>
            {selectedDay.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
          </Text>
          <TouchableOpacity onPress={() => setSelectedDay(d => { const n = new Date(d); n.setDate(n.getDate() + 1); return n; })}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* All-day blocked banner */}
        {allDayBlocks.map(b => (
          <View key={b.id} style={styles.blockedBanner}>
            <Ionicons name="ban-outline" size={14} color="#9ca3af" />
            <Text style={styles.blockedBannerText}>
              All Day Off{b.reason ? ` — ${b.reason}` : ''}
            </Text>
            <TouchableOpacity
              onPress={() => Alert.alert('Remove Block', 'Remove this blocked time?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => handleDeleteBlock(b.id) },
              ])}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginLeft: 'auto' }}
            >
              <Ionicons name="trash-outline" size={14} color="#ef4444" />
            </TouchableOpacity>
          </View>
        ))}

        {HOURS.map(h => {
          const label = h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
          const slotBookings = dayBookings.filter(b => {
            if (!b.appointment_time) return false;
            return parseInt(b.appointment_time.split(':')[0], 10) === h;
          });
          const hourOff = isHourBlocked(h);
          return (
            <View key={h} style={[styles.hourRow, hourOff && { backgroundColor: '#9ca3af08' }]}>
              <Text style={[styles.hourLabel, hourOff && slotBookings.length === 0 && { color: '#9ca3af' }]}>{label}</Text>
              <View style={[styles.hourLine, hourOff && { backgroundColor: '#9ca3af33' }]} />
              {/* Grey "Off" bar when this hour is blocked and no booking is occupying it */}
              {hourOff && slotBookings.length === 0 && (
                <View style={[styles.hourBooking, { backgroundColor: '#9ca3af14', borderLeftColor: '#9ca3af', borderLeftWidth: 3 }]}>
                  <Text style={{ fontSize: 11, fontFamily: 'Figtree_500Medium', color: '#9ca3af' }}>Unavailable</Text>
                </View>
              )}
              {slotBookings.map(b => (
                <TouchableOpacity key={b.id} style={[styles.hourBooking, { backgroundColor: colors.primaryLight, borderLeftColor: colors.primary }]}
                  onPress={() => openAppointmentDetail(b)}>
                  <Text style={[styles.hourBookingName, { color: colors.primary }]} numberOfLines={1}>
                    {b.client?.full_name || b.client?.username || 'Client'}
                  </Text>
                  <Text style={styles.hourBookingService} numberOfLines={1}>{b.service_name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          );
        })}

        {dayBookings.length === 0 && dayBlocked.length === 0 && (
          <View style={styles.emptyState}><Text style={styles.calEmptyText}>No bookings this day</Text></View>
        )}

        {/* Partial block summary at bottom (shown beneath the hour grid) */}
        {partialBlocks.length > 0 && (
          <View style={[styles.calDayBookings, { marginTop: 8 }]}>
            {partialBlocks.map(b => (
              <View key={b.id} style={styles.blockedSlotRow}>
                <View style={styles.blockedSlotLeft}>
                  <View style={[styles.blockedSlotIcon, { backgroundColor: '#9ca3af22' }]}>
                    <Ionicons name="ban-outline" size={14} color="#9ca3af" />
                  </View>
                  <View>
                    <Text style={[styles.blockedSlotTitle, { color: colors.text }]}>
                      {`${formatTime(b.start_time)} – ${formatTime(b.end_time)}`}
                    </Text>
                    {b.reason ? <Text style={[styles.blockedSlotReason, { color: colors.textMuted }]}>{b.reason}</Text> : null}
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => Alert.alert('Remove Block', 'Remove this blocked time?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Remove', style: 'destructive', onPress: () => handleDeleteBlock(b.id) },
                  ])}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ── Render: Appointment Detail Modal ─────────────────────────────────────────

  const renderAppointmentDetailModal = () => {
    if (!selectedBooking) return null;
    const b           = selectedBooking;
    const clientName  = clientProfile?.full_name || b.client?.full_name || b.client?.username || 'Client';
    const avatarUrl   = clientProfile?.avatar_url || b.client?.avatar_url;
    const since       = clientProfile?.created_at ? clientSince(clientProfile.created_at) : '';
    const time        = formatTime(b.appointment_time);
    const duration    = formatDuration(b.duration_min);
    const isPaid      = b.deposit_status === 'paid' || b.deposit_status === 'Paid';

    const hairFields = [
      { label: 'Hair Type', value: clientProfile?.hair_type },
      { label: 'Porosity',  value: clientProfile?.porosity  },
      { label: 'Density',   value: clientProfile?.density   },
      { label: 'Texture',   value: clientProfile?.texture   },
    ];

    return (
      <Modal
        visible={apptDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setApptDetailVisible(false)}
      >
        <SafeAreaView style={[styles.apptModalSafe, { backgroundColor: colors.surface }]} edges={['top']}>
          {/* Header */}
          <View style={styles.apptModalHeader}>
            <Text style={styles.apptModalTitle}>Appointment Details</Text>
            <TouchableOpacity onPress={() => setApptDetailVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.apptModalBody}>
            {/* Client info */}
            <View style={styles.apptClientRow}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.apptClientAvatar} />
              ) : (
                <View style={[styles.apptClientAvatar, styles.apptClientAvatarPlaceholder, { backgroundColor: colors.borderLight }]}>
                  <Ionicons name="person" size={26} color={colors.border} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.apptClientName}>{clientName}</Text>
                {since ? <Text style={[styles.apptClientSince, { color: colors.textMuted }]}>{since}</Text> : null}
              </View>
            </View>

            {/* Service Details */}
            <View style={[styles.apptSection, { borderColor: colors.borderLight }]}>
              <Text style={[styles.apptSectionLabel, { color: colors.textMuted }]}>SERVICE DETAILS</Text>
              <View style={styles.apptDetailRow}>
                <Text style={[styles.apptDetailKey, { color: colors.text }]}>Service</Text>
                <Text style={[styles.apptDetailVal, { color: colors.text }]}>{b.service_name || '—'}</Text>
              </View>
              {time ? (
                <View style={styles.apptDetailRow}>
                  <Text style={[styles.apptDetailKey, { color: colors.text }]}>Time</Text>
                  <Text style={[styles.apptDetailVal, { color: colors.text }]}>{time}</Text>
                </View>
              ) : null}
              {duration ? (
                <View style={styles.apptDetailRow}>
                  <Text style={[styles.apptDetailKey, { color: colors.text }]}>Duration</Text>
                  <Text style={[styles.apptDetailVal, { color: colors.text }]}>{duration}</Text>
                </View>
              ) : null}
              <View style={styles.apptDetailRow}>
                <Text style={[styles.apptDetailKey, { color: colors.text }]}>Deposit Status</Text>
                <View style={[styles.depositStatusPill, { backgroundColor: isPaid ? '#F8B43022' : colors.borderLight }]}>
                  <Text style={[styles.depositStatusPillText, { color: isPaid ? '#C8835A' : colors.textMuted }]}>
                    {isPaid ? 'Paid' : 'Pending'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Hair Profile */}
            {clientProfileLoading ? (
              <View style={[styles.apptSection, { borderColor: colors.borderLight, alignItems: 'center', paddingVertical: 20 }]}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : clientProfile && (clientProfile.hair_type || clientProfile.porosity || clientProfile.density || clientProfile.texture) ? (
              <View style={[styles.apptSection, { borderColor: colors.borderLight }]}>
                <Text style={[styles.apptSectionLabel, { color: colors.textMuted }]}>HAIR PROFILE</Text>
                <View style={styles.hairProfileGrid}>
                  {hairFields.map((f, i) => f.value ? (
                    <View key={`hp-${i}`} style={styles.hairProfileCell}>
                      <Text style={[styles.hairProfileKey, { color: colors.textMuted }]}>{f.label}</Text>
                      <Text style={[styles.hairProfileVal, { color: colors.text }]}>{f.value}</Text>
                    </View>
                  ) : null)}
                </View>
              </View>
            ) : null}

            {/* Current Goals */}
            {clientProfile?.hair_goals ? (
              <View style={[styles.apptSection, { borderColor: colors.borderLight }]}>
                <Text style={[styles.apptSectionLabel, { color: colors.textMuted }]}>CURRENT GOALS</Text>
                <Text style={[styles.goalsText, { color: colors.textSecondary }]}>{clientProfile.hair_goals}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer buttons */}
          <View style={[styles.apptModalFooter, { borderTopColor: colors.borderLight, backgroundColor: colors.surface }]}>
            <TouchableOpacity style={[styles.apptCloseBtn, { borderColor: colors.border }]} onPress={() => setApptDetailVisible(false)}>
              <Text style={[styles.apptCloseBtnText, { color: colors.text }]}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.apptMessageBtn}
              onPress={() => {
                setApptDetailVisible(false);
                // Navigate to messaging with this client if available
              }}
            >
              <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <Text style={styles.apptMessageBtnText}>Send Message</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    );
  };

  // ── Services ──────────────────────────────────────────────────────────────────

  const renderServices = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    >
      <TouchableOpacity style={styles.addServiceBtn} onPress={() => setAddServiceVisible(true)}>
        <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addServiceBtnText}>Add Service</Text>
      </TouchableOpacity>
      {loadingServices
        ? <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        : services.length === 0
          ? (
            <View style={styles.emptyState}>
              <Ionicons name="cut-outline" size={40} color={colors.border} />
              <Text style={styles.emptyTitle}>No services yet</Text>
              <Text style={styles.emptyText}>Add your first service to let clients know what you offer</Text>
            </View>
          )
          : services.map(s => (
            <View key={s.id} style={styles.serviceCard}>
              <View style={styles.serviceLeft}>
                <Text style={styles.serviceName}>{s.name}</Text>
                {s.description ? <Text style={styles.serviceDesc} numberOfLines={2}>{s.description}</Text> : null}
                {s.duration_min ? <Text style={styles.serviceMeta}>{s.duration_min} min</Text> : null}
              </View>
              <View style={styles.serviceRight}>
                <Text style={styles.servicePrice}>${s.price?.toFixed(2) ?? '—'}</Text>
                <TouchableOpacity onPress={() => handleDeleteService(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))
      }
    </ScrollView>
  );

  // ── Main render ───────────────────────────────────────────────────────────────

  if (!profileLoaded || !user) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator /></View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* ── Header ── */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.hairline }]}>
        {/* Left: Client mode toggle */}
        <TouchableOpacity style={styles.modeToggle} onPress={toggleMode} activeOpacity={0.7}>
          <Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />
          <Text style={[styles.modeToggleText, { color: colors.primary }]}>Client</Text>
        </TouchableOpacity>

        {/* Center: Logo */}
        <Text style={[styles.headerLogo, { color: colors.text }]}>crwn.</Text>

        {/* Right: List / Calendar toggle (only for Bookings tab) */}
        {activeTab === 'Bookings' ? (
          <View style={[styles.viewToggle, { borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.viewToggleBtn, bookingView === 'list' && { backgroundColor: colors.primary }]}
              onPress={() => setBookingView('list')}
            >
              <Ionicons name="list-outline" size={16} color={bookingView === 'list' ? '#fff' : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewToggleBtn, bookingView === 'calendar' && { backgroundColor: colors.primary }]}
              onPress={() => setBookingView('calendar')}
            >
              <Ionicons name="calendar-outline" size={16} color={bookingView === 'calendar' ? '#fff' : colors.textMuted} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.viewToggleSpacer} />
        )}
      </View>

      {/* ── Tabs ── */}
      <View style={[styles.tabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Content ── */}
      <View style={styles.content}>
        {activeTab === 'Bookings' && renderBookings()}
        {activeTab === 'Services' && renderServices()}
      </View>

      <AddServiceModal
        visible={addServiceVisible}
        onClose={() => setAddServiceVisible(false)}
        onSave={handleAddService}
        colors={colors}
        styles={styles}
      />

      {renderAppointmentDetailModal()}

      <BlockTimeModal
        visible={blockTimeVisible}
        onClose={() => setBlockTimeVisible(false)}
        onSave={handleBlockTime}
        defaultDate={selectedDay}
        colors={colors}
        styles={styles}
      />
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLogo: {
    fontSize: 22,
    fontFamily: 'LibreBaskerville_700Bold',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  modeToggleText: {
    fontSize: 12,
    fontFamily: 'Figtree_600SemiBold',
  },
  viewToggle: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 1,
  },
  viewToggleBtn: {
    width: 34,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  viewToggleSpacer: { width: 70 },

  // ── Tabs ──
  tabs:         { flexDirection: 'row', borderBottomWidth: 1 },
  tab:          { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: '#5D1F1F' },
  tabText:      { fontSize: 13, fontFamily: 'Figtree_500Medium', color: c.textSecondary },
  tabTextActive:{ fontFamily: 'Figtree_700Bold', color: '#5D1F1F' },
  content:      { flex: 1 },
  tabContent:   { padding: 16, paddingBottom: 32 },

  // ── Summary card ──
  summaryCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: c.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryLabel: { fontSize: 12, color: c.textMuted, fontFamily: 'Figtree_500Medium', marginBottom: 4 },
  summaryCount: { fontSize: 22, fontFamily: 'Figtree_700Bold', color: '#C8835A' },

  // ── Appointment card ──
  appointmentCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  appointmentCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  appointmentClientName: { fontSize: 16, fontFamily: 'Figtree_700Bold', color: c.text, flex: 1, marginRight: 8 },
  appointmentService:    { fontSize: 13, color: c.textSecondary, fontFamily: 'Figtree_400Regular', marginBottom: 5 },
  appointmentMeta:       { flexDirection: 'row', alignItems: 'center', gap: 6 },
  appointmentMetaText:   { fontSize: 13, color: c.textMuted, fontFamily: 'Figtree_400Regular' },
  appointmentBullet:     { width: 4, height: 4, borderRadius: 2, backgroundColor: c.textMuted },
  depositBadge: {
    backgroundColor: '#5D1F1F',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  depositBadgeText: { fontSize: 11, color: '#fff', fontFamily: 'Figtree_600SemiBold' },

  // ── Block time off ──
  blockTimeBtn: {
    marginTop: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C8835A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  blockTimeBtnText: { fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: '#C8835A' },

  // ── Calendar ──
  calViewRow:    { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 10, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  calViewBtn:    { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  calViewBtnActive: { backgroundColor: '#5D1F1F' },
  calViewText:   { fontSize: 13, fontFamily: 'Figtree_500Medium', color: c.textSecondary },
  calViewTextActive: { color: '#fff', fontFamily: 'Figtree_600SemiBold' },
  calNav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, paddingHorizontal: 4 },
  calNavTitle:   { fontSize: 16, fontFamily: 'Figtree_700Bold', color: c.text },
  calDayHeaders: { flexDirection: 'row', paddingBottom: 8 },
  calDayHeader:  { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Figtree_600SemiBold', textTransform: 'uppercase' },
  // Grid: container provides top+left border; each cell provides right+bottom
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: {
    width: '14.28%',
    minHeight: 68,
    alignItems: 'center',
    paddingTop: 6,
    paddingHorizontal: 2,
  },
  calCellText:         { fontSize: 13, color: c.text, fontFamily: 'Figtree_500Medium', marginBottom: 4 },
  calCellToday:        { color: '#C8835A', fontFamily: 'Figtree_700Bold' },
  calCellSelectedText: { color: '#5D1F1F', fontFamily: 'Figtree_700Bold' },
  calPillCol:    { alignItems: 'center', gap: 2 },
  calTimePill:   { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 1 },
  calTimePillText: { fontSize: 9, color: '#fff', fontFamily: 'Figtree_700Bold' },
  calLegend:     { flexDirection: 'row', gap: 16, paddingHorizontal: 4, paddingTop: 10, paddingBottom: 4 },
  calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  calLegendDot:  { width: 10, height: 10, borderRadius: 5 },
  calLegendText: { fontSize: 12, fontFamily: 'Figtree_400Regular' },
  calDayBookings:     { marginTop: 16 },
  calDayBookingsTitle:{ fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: c.text, marginBottom: 10 },
  // Blocked slot row
  blockedSlotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  blockedSlotLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  blockedSlotIcon:   { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  blockedSlotTitle:  { fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  blockedSlotReason: { fontSize: 12, fontFamily: 'Figtree_400Regular', marginTop: 1 },
  calEmptyText:  { fontSize: 13, color: c.textMuted, textAlign: 'center', paddingVertical: 20 },
  weekRow:       { flexDirection: 'row', marginBottom: 16, gap: 4 },
  weekCell:      { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderLight, gap: 4 },
  weekCellSelected: { borderColor: '#5D1F1F' },
  weekCellOff:   { backgroundColor: '#F5F5F5' },
  weekDayLabel:  { fontSize: 10, fontFamily: 'Figtree_600SemiBold', color: c.textMuted, textTransform: 'uppercase' },
  weekDayNum:    { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  weekDayNumText:{ fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: c.text },
  weekBadge:     { minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  weekBadgeText: { fontSize: 9, color: '#fff', fontFamily: 'Figtree_700Bold' },
  blockedBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#9ca3af18', borderWidth: 1, borderColor: '#9ca3af44', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  blockedBannerText: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: '#9ca3af', flex: 1 },
  hourRow:       { flexDirection: 'row', alignItems: 'flex-start', minHeight: 44, marginBottom: 2 },
  hourLabel:     { width: 52, fontSize: 11, color: c.textMuted, fontFamily: 'Figtree_400Regular', paddingTop: 4 },
  hourLine:      { flex: 1, height: 1, backgroundColor: c.borderLight, marginTop: 10 },
  hourBooking:   { position: 'absolute', left: 60, right: 0, borderLeftWidth: 3, borderRadius: 4, padding: 6 },
  hourBookingName:   { fontSize: 13, fontFamily: 'Figtree_600SemiBold' },
  hourBookingService:{ fontSize: 11, color: c.textSecondary },

  // ── Appointment detail modal ──
  apptModalSafe: { flex: 1 },
  apptModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
  },
  apptModalTitle:  { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text },
  apptModalBody:   { padding: 20, paddingBottom: 8 },
  apptClientRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  apptClientAvatar:{ width: 56, height: 56, borderRadius: 28 },
  apptClientAvatarPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  apptClientName:  { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 2 },
  apptClientSince: { fontSize: 13, fontFamily: 'Figtree_400Regular' },
  apptSection: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  apptSectionLabel: {
    fontSize: 11,
    fontFamily: 'Figtree_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  apptDetailRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  apptDetailKey:   { fontSize: 14, fontFamily: 'Figtree_400Regular' },
  apptDetailVal:   { fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  depositStatusPill: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  depositStatusPillText: { fontSize: 13, fontFamily: 'Figtree_600SemiBold' },
  hairProfileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  hairProfileCell: { width: '50%', marginBottom: 12 },
  hairProfileKey:  { fontSize: 12, fontFamily: 'Figtree_400Regular', marginBottom: 2 },
  hairProfileVal:  { fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  goalsText:       { fontSize: 14, fontFamily: 'Figtree_400Regular', lineHeight: 20 },
  apptModalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  apptCloseBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  apptCloseBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  apptMessageBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  apptMessageBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#fff' },

  // ── Analytics ──
  analyticsContainer:     { flex: 1 },
  analyticsWideRow:       { flex: 1, flexDirection: 'row' },
  analyticsLeftCol:       { width: 300, borderRightWidth: 1, borderRightColor: c.borderLight, paddingHorizontal: 16, paddingTop: 20 },
  analyticsCenterCol:     { flex: 1 },
  analyticsMobileContent: { padding: 16, paddingBottom: 40 },
  filterRow: { marginBottom: 16, position: 'relative', zIndex: 10, alignSelf: 'flex-start' },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  filterChipText: { fontSize: 13, fontFamily: 'Figtree_500Medium' },
  filterDropdown: { position: 'absolute', top: 38, left: 0, minWidth: 160, borderWidth: 1, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8, overflow: 'hidden', zIndex: 20 },
  filterOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11 },
  filterOptionText: { fontSize: 14, fontFamily: 'Figtree_400Regular' },
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  analyticsStatCard: { width: '47%', backgroundColor: c.surface, borderRadius: 14, padding: 14, gap: 5, borderWidth: 1, borderColor: c.borderLight, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  analyticsStatIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.primaryLight || '#FDF1EE', alignItems: 'center', justifyContent: 'center' },
  analyticsStatValue: { fontSize: 22, fontFamily: 'Figtree_700Bold', color: c.text },
  analyticsStatLabel: { fontSize: 11, fontFamily: 'Figtree_500Medium', color: c.textMuted },
  engagementBanner:      { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4 },
  engagementBannerLabel: { flex: 1, fontSize: 13, fontFamily: 'Figtree_500Medium' },
  engagementBannerValue: { fontSize: 18, fontFamily: 'Figtree_700Bold' },
  sectionHeaderRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 },
  sectionTitle:      { fontSize: 11, fontFamily: 'Figtree_700Bold', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  emptyAnalyticsText:{ fontSize: 14, color: c.textMuted, textAlign: 'center', paddingVertical: 32 },
  postListItem:      { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: c.borderLight },
  postListItemSelected: { backgroundColor: c.backgroundAlt || c.borderLight + '50' },
  postThumb:         { width: 72, height: 72, borderRadius: 10, overflow: 'hidden', backgroundColor: c.borderLight, flexShrink: 0 },
  postListInfo:      { flex: 1, justifyContent: 'space-between' },
  postListTitle:     { fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: c.text },
  postListTags:      { fontSize: 12, fontFamily: 'Figtree_400Regular', marginTop: 1 },
  postListDate:      { fontSize: 11, color: c.textMuted },
  postMetricsRow:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  postMetric:        { flexDirection: 'row', alignItems: 'center', gap: 3 },
  postMetricText:    { fontSize: 11, color: c.textSecondary, fontFamily: 'Figtree_500Medium' },
  postListFooter:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  engagementChip:    { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  engagementChipText:{ fontSize: 11, fontFamily: 'Figtree_600SemiBold' },
  bookingsChip:      { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bookingsChipText:  { fontSize: 11, color: c.textMuted },
  detailEmpty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  detailEmptyText:   { fontSize: 14, textAlign: 'center' },
  detailHero:        { width: '100%', height: 220, overflow: 'hidden', position: 'relative' },
  detailHeroTitle:   { color: '#fff', fontSize: 18, fontFamily: 'Figtree_700Bold' },
  detailBody:        { padding: 20, gap: 0 },
  detailTitle:       { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 4 },
  detailTags:        { fontSize: 13, fontFamily: 'Figtree_400Regular', marginBottom: 4 },
  detailDateRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 },
  detailDate:        { fontSize: 12, color: c.textMuted },
  detailSectionLabel:{ fontSize: 10, fontFamily: 'Figtree_700Bold', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  detailSection:     { marginBottom: 24 },
  engagementGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  engagementCell:    { width: '47%', backgroundColor: c.surface, borderRadius: 12, padding: 14, gap: 4, borderWidth: 1, borderColor: c.borderLight },
  engagementCellIcon:{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.primaryLight || '#FDF1EE', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  engagementCellValue:{ fontSize: 20, fontFamily: 'Figtree_700Bold', color: c.text },
  engagementCellLabel:{ fontSize: 11, color: c.textMuted },
  engagementRateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20 },
  engagementRateLabel:{ flex: 1, fontSize: 13, fontFamily: 'Figtree_500Medium' },
  engagementRateValue:{ fontSize: 17, fontFamily: 'Figtree_700Bold' },
  bookingsFromPostRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  bookingsFromPostLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookingsFromPostIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.primaryLight || '#FDF1EE', alignItems: 'center', justifyContent: 'center' },
  bookingsFromPostCount:{ fontSize: 24, fontFamily: 'Figtree_700Bold', color: c.text },
  conversionRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  conversionLabel:{ fontSize: 12, color: c.textMuted },
  conversionValue:{ fontSize: 12, fontFamily: 'Figtree_600SemiBold' },
  conversionBar:  { height: 4, backgroundColor: c.borderLight, borderRadius: 2, overflow: 'hidden' },
  conversionFill: { height: 4, borderRadius: 2 },
  commentRow:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentAvatar:  { flexShrink: 0 },
  commentAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  commentBody:    { flex: 1 },
  commentHeader:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  commentUsername:{ fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: c.text },
  commentTime:    { fontSize: 11, color: c.textMuted },
  commentText:    { fontSize: 13, color: c.textSecondary, lineHeight: 18 },
  modalSafe:      { flex: 1 },
  postModalHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: c.borderLight },
  postModalTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold' },
  postModalFooter:{ flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1 },
  closeBtn:       { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  closeBtnText:   { fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  shareBtn:       { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, overflow: 'hidden' },
  shareBtnText:   { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#fff' },

  // ── Services ──
  addServiceBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12, paddingVertical: 14, marginBottom: 20, gap: 8 },
  addServiceBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
  serviceCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.borderLight, gap: 12 },
  serviceLeft:   { flex: 1 },
  serviceName:   { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: c.text, marginBottom: 3 },
  serviceDesc:   { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 3 },
  serviceMeta:   { fontSize: 12, color: c.textMuted },
  serviceRight:  { alignItems: 'flex-end', gap: 10 },
  servicePrice:  { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text },

  // ── Block time modal ──
  blockDateDisplay:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  blockDateText:         { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: c.text, flex: 1 },
  blockCalCard:          { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 20 },
  blockSectionLabel:     { fontSize: 11, fontFamily: 'Figtree_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10, color: c.textMuted },
  blockSegment:          { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 4, marginBottom: 20 },
  blockSegBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10 },
  blockSegBtnText:       { fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  blockTimeCard:         { borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  blockTimeSection:      { padding: 14 },
  blockTimeSectionLabel: { fontSize: 10, fontFamily: 'Figtree_700Bold', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, color: c.textMuted },
  blockTimeChip:         { borderWidth: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  blockTimeChipText:     { fontSize: 13, fontFamily: 'Figtree_500Medium' },
  blockTimeDivider:      { height: 1 },
  blockTimeSummary:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, margin: 8, borderRadius: 10, backgroundColor: '#FDF1EE' },
  blockTimeSummaryText:  { fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: c.primary },
  blockReasonInput:      { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },

  // ── Add service modal ──
  modalContainer:      { flex: 1 },
  addServiceModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  addServiceModalTitle:  { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text },
  modalBody:   { flex: 1, padding: 20 },
  inputLabel:  { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: c.textSecondary, marginBottom: 6, marginTop: 14 },
  input:       { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  textArea:    { minHeight: 90, paddingTop: 12 },
  saveBtn:     { margin: 20, borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  saveBtnText: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: '#fff' },

  // ── Empty state ──
  emptyState: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: c.text },
  emptyText:  { fontSize: 13, color: c.textMuted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 19 },
});
