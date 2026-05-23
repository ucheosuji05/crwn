import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  FlatList, ActivityIndicator, Modal, TextInput, Alert,
  KeyboardAvoidingView, Platform, Image, useWindowDimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useProviderMode } from '../context/ProviderModeContext';
import { bookingService } from '../services/bookingService';
import { analyticsService } from '../services/analyticsService';

// ── Constants ─────────────────────────────────────────────────────────────────

const TABS      = ['Bookings', 'Calendar', 'Services'];
const CAL_VIEWS = ['Day', 'Week', 'Month'];
const MONTHS    = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const HOURS     = Array.from({ length: 13 }, (_, i) => i + 7);
const FILTER_OPTIONS = [
  { label: 'Last 7 days',  value: 7  },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'All time',     value: 0  },
];
const BAR_MAX_H = 80;
const ANALYTICS_BREAK = 860; // px — switches to wide (3-col) layout

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '';
  // Full ISO timestamps already have 'T'; date-only strings need it appended for local-timezone parsing
  const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

function statusColor(status) {
  switch (status) {
    case 'upcoming':  return '#F8B430';
    case 'completed': return '#22c55e';
    case 'cancelled': return '#ef4444';
    default:          return '#9ca3af';
  }
}

function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, icon, colors, styles }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={22} color={colors.primary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function BookingRow({ booking, colors, styles, onStatusChange }) {
  const clientName = booking.client?.full_name || booking.client?.username || 'Client';
  return (
    <View style={styles.bookingRow}>
      <View style={[styles.statusDot, { backgroundColor: statusColor(booking.status) }]} />
      <View style={styles.bookingInfo}>
        <Text style={styles.bookingClient} numberOfLines={1}>{clientName}</Text>
        <Text style={styles.bookingService} numberOfLines={1}>{booking.service_name}</Text>
        <Text style={styles.bookingDate}>{formatDate(booking.appointment_date)}</Text>
      </View>
      <View style={styles.bookingActions}>
        {booking.status === 'upcoming' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#dcfce7' }]}
              onPress={() => onStatusChange(booking.id, 'completed')}
            >
              <Ionicons name="checkmark" size={14} color="#16a34a" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]}
              onPress={() => onStatusChange(booking.id, 'cancelled')}
            >
              <Ionicons name="close" size={14} color="#dc2626" />
            </TouchableOpacity>
          </>
        )}
        <View style={[styles.statusBadge, { backgroundColor: statusColor(booking.status) + '22' }]}>
          <Text style={[styles.statusText, { color: statusColor(booking.status) }]}>
            {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
          </Text>
        </View>
      </View>
    </View>
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
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Service</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
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
            <View key={i} style={barStyles.barCol}>
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

  // ── Existing state ──────────────────────────────────────────────────────────
  const [activeTab,         setActiveTab]         = useState('Bookings');
  const [calView,           setCalView]           = useState('Month');
  const [bookings,          setBookings]          = useState([]);
  const [services,          setServices]          = useState([]);
  const [loadingBookings,   setLoadingBookings]   = useState(true);
  const [loadingServices,   setLoadingServices]   = useState(true);
  const [addServiceVisible, setAddServiceVisible] = useState(false);

  // Calendar state
  const today        = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [selectedDay,    setSelectedDay]    = useState(today);
  const [calMonth,       setCalMonth]       = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [calWeekStart,   setCalWeekStart]   = useState(startOfWeek(today));

  // ── Analytics state ─────────────────────────────────────────────────────────
  const [analyticsLoading,    setAnalyticsLoading]    = useState(true);
  const [analyticsPosts,      setAnalyticsPosts]      = useState([]);
  const [analyticsStats,      setAnalyticsStats]      = useState(null);
  const [bookmarkCounts,      setBookmarkCounts]      = useState({});
  const [weeklyActivity,      setWeeklyActivity]      = useState([]);
  const [recentComments,      setRecentComments]      = useState([]);
  const [selectedPost,        setSelectedPost]        = useState(null);
  const [postModalVisible,    setPostModalVisible]    = useState(false);
  const [filterDays,          setFilterDays]          = useState(30);
  const [filterMenuOpen,      setFilterMenuOpen]      = useState(false);

  // ── Data loading ─────────────────────────────────────────────────────────────

  const loadBookings = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await bookingService.getBookingsByStylist(user.id);
    setBookings(data || []);
    setLoadingBookings(false);
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
    await Promise.all([loadBookings(), loadServices(), loadAnalytics()]);
    setRefreshing(false);
  }, [loadBookings, loadServices, loadAnalytics]);

  useEffect(() => { loadBookings(); }, [loadBookings]);
  useEffect(() => { loadServices(); }, [loadServices]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);

  // ── Filter posts by date range ───────────────────────────────────────────────
  const filteredPosts = useMemo(() => {
    if (!filterDays) return analyticsPosts; // 0 = all time
    const cutoff = new Date(Date.now() - filterDays * 24 * 60 * 60 * 1000);
    return analyticsPosts.filter(p => new Date(p.created_at) >= cutoff);
  }, [analyticsPosts, filterDays]);

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

  // ── Calendar helpers ─────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const upcoming  = bookings.filter(b => b.status === 'upcoming').length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    const clients   = new Set(bookings.map(b => b.client?.id).filter(Boolean)).size;
    return { upcoming, completed, clients, total: bookings.length };
  }, [bookings]);

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

  // ── Render: Analytics Overview ───────────────────────────────────────────────

  const renderOverviewStats = () => {
    if (!analyticsStats) return null;
    const { totalCrowns, totalSaves, totalBookings, engagementRate } = analyticsStats;
    return (
      <View>
        {/* Stats grid */}
        <View style={styles.analyticsGrid}>
          <View style={styles.analyticsStatCard}>
            <View style={styles.analyticsStatIcon}>
              <Ionicons name="heart" size={16} color={colors.primary} />
            </View>
            <Text style={styles.analyticsStatValue}>{fmtNum(totalCrowns)}</Text>
            <Text style={styles.analyticsStatLabel}>Total Crowns</Text>
          </View>
          <View style={styles.analyticsStatCard}>
            <View style={styles.analyticsStatIcon}>
              <Ionicons name="eye-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.analyticsStatValue}>{fmtNum(totalCrowns * 5)}</Text>
            <Text style={styles.analyticsStatLabel}>Profile Visits</Text>
          </View>
          <View style={styles.analyticsStatCard}>
            <View style={styles.analyticsStatIcon}>
              <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.analyticsStatValue}>{fmtNum(totalSaves)}</Text>
            <Text style={styles.analyticsStatLabel}>Total Saves</Text>
          </View>
          <View style={styles.analyticsStatCard}>
            <View style={styles.analyticsStatIcon}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.analyticsStatValue}>{totalBookings}</Text>
            <Text style={styles.analyticsStatLabel}>Bookings</Text>
          </View>
        </View>

        {/* Engagement rate banner */}
        <View style={[styles.engagementBanner, { backgroundColor: colors.primaryLight || '#FDF1EE' }]}>
          <Ionicons name="trending-up" size={16} color={colors.primary} />
          <Text style={[styles.engagementBannerLabel, { color: colors.textSecondary }]}>Avg. Engagement Rate</Text>
          <Text style={[styles.engagementBannerValue, { color: colors.primary }]}>{engagementRate}%</Text>
        </View>
      </View>
    );
  };

  const renderPostListItem = (post, index) => {
    const metrics = analyticsService.computePostMetrics(post, bookmarkCounts[post.id] || 0);
    const thumb   = post.post_media?.[0]?.media_url;
    const tags    = Array.isArray(post.tags) ? post.tags.slice(0, 3).map(t => `#${t}`).join(' ') : '';
    const isSelected = isWide && selectedPost?.id === post.id;

    return (
      <TouchableOpacity
        key={post.id}
        style={[styles.postListItem, isSelected && styles.postListItemSelected]}
        onPress={() => openPostDetail(post)}
        activeOpacity={0.8}
      >
        {/* Thumbnail */}
        <View style={styles.postThumb}>
          {thumb
            ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            : <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="image-outline" size={20} color={colors.border} />
              </View>
          }
        </View>

        {/* Info */}
        <View style={styles.postListInfo}>
          <Text style={styles.postListTitle} numberOfLines={1}>{post.title || 'Untitled'}</Text>
          {!!tags && <Text style={[styles.postListTags, { color: colors.primary }]} numberOfLines={1}>{tags}</Text>}
          <Text style={styles.postListDate}>{formatDate(post.created_at)}</Text>

          <View style={styles.postMetricsRow}>
            <View style={styles.postMetric}>
              <Ionicons name="heart" size={11} color={colors.primary} />
              <Text style={styles.postMetricText}>{fmtNum(metrics.likes)}</Text>
            </View>
            <View style={styles.postMetric}>
              <Ionicons name="eye-outline" size={11} color={colors.textMuted} />
              <Text style={styles.postMetricText}>{fmtNum(metrics.estViews)}</Text>
            </View>
            <View style={styles.postMetric}>
              <Ionicons name="bookmark-outline" size={11} color={colors.textMuted} />
              <Text style={styles.postMetricText}>{fmtNum(metrics.saves)}</Text>
            </View>
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

    const thumb    = post.post_media?.[0]?.media_url;
    const tags     = Array.isArray(post.tags) ? post.tags.map(t => `#${t}`).join(' ') : '';
    const { likes, comments, saves, estViews, rate } = selectedPostMetrics;
    const conversionRate = ((analyticsStats?.totalBookings || 0) / Math.max(estViews, 1) * 100).toFixed(1);

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero image */}
        {thumb && (
          <View style={styles.detailHero}>
            <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.5)']}
              style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end', padding: 16 }]}
            >
              <Text style={styles.detailHeroTitle} numberOfLines={2}>{post.title || 'Untitled'}</Text>
            </LinearGradient>
          </View>
        )}

        <View style={styles.detailBody}>
          {/* Title + tags + date */}
          {!thumb && <Text style={styles.detailTitle}>{post.title || 'Untitled'}</Text>}
          {!!tags && <Text style={[styles.detailTags, { color: colors.primary }]}>{tags}</Text>}
          <View style={styles.detailDateRow}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={styles.detailDate}>{formatDate(post.created_at)}</Text>
          </View>

          {/* Engagement grid */}
          <Text style={styles.detailSectionLabel}>ENGAGEMENT</Text>
          <View style={styles.engagementGrid}>
            <View style={styles.engagementCell}>
              <View style={styles.engagementCellIcon}>
                <Ionicons name="heart" size={14} color={colors.primary} />
              </View>
              <Text style={styles.engagementCellValue}>{fmtNum(likes)}</Text>
              <Text style={styles.engagementCellLabel}>Crowns</Text>
            </View>
            <View style={styles.engagementCell}>
              <View style={styles.engagementCellIcon}>
                <Ionicons name="eye-outline" size={14} color={colors.primary} />
              </View>
              <Text style={styles.engagementCellValue}>{fmtNum(estViews)}</Text>
              <Text style={styles.engagementCellLabel}>Views</Text>
            </View>
            <View style={styles.engagementCell}>
              <View style={styles.engagementCellIcon}>
                <Ionicons name="bookmark-outline" size={14} color={colors.primary} />
              </View>
              <Text style={styles.engagementCellValue}>{fmtNum(saves)}</Text>
              <Text style={styles.engagementCellLabel}>Saves</Text>
            </View>
            <View style={styles.engagementCell}>
              <View style={styles.engagementCellIcon}>
                <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
              </View>
              <Text style={styles.engagementCellValue}>{fmtNum(comments)}</Text>
              <Text style={styles.engagementCellLabel}>Comments</Text>
            </View>
          </View>

          {/* Engagement rate */}
          <View style={[styles.engagementRateRow, { backgroundColor: colors.primaryLight || '#FDF1EE' }]}>
            <Ionicons name="trending-up" size={14} color={colors.primary} />
            <Text style={[styles.engagementRateLabel, { color: colors.textSecondary }]}>Engagement Rate</Text>
            <Text style={[styles.engagementRateValue, { color: colors.primary }]}>{rate}%</Text>
          </View>

          {/* Bar chart */}
          {weeklyActivity.length > 0 && (
            <View style={styles.detailSection}>
              <BarChart data={weeklyActivity} colors={colors} />
            </View>
          )}

          {/* Bookings from post */}
          <View style={styles.detailSection}>
            <View style={styles.bookingsFromPostRow}>
              <View style={styles.bookingsFromPostLeft}>
                <View style={styles.bookingsFromPostIcon}>
                  <Ionicons name="people-outline" size={14} color={colors.primary} />
                </View>
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

          {/* Recent comments */}
          {recentComments.length > 0 && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionLabel}>RECENT COMMENTS</Text>
              {recentComments.map(c => (
                <View key={c.id} style={styles.commentRow}>
                  <View style={styles.commentAvatar}>
                    {c.profiles?.avatar_url
                      ? <Image source={{ uri: c.profiles.avatar_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                      : <View style={[styles.commentAvatarPlaceholder, { backgroundColor: colors.borderLight }]}>
                          <Ionicons name="person" size={16} color={colors.border} />
                        </View>
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

  // ── Post Analytics Modal (mobile only) ───────────────────────────────────────
  const renderPostModal = () => (
    <Modal
      visible={postModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setPostModalVisible(false)}
    >
      <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.surface }]} edges={['top']}>
        <View style={styles.postModalHeader}>
          <Text style={[styles.postModalTitle, { color: colors.text }]}>Post Analytics</Text>
          <TouchableOpacity onPress={() => setPostModalVisible(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        {renderPostDetailPanel(selectedPost)}
        <View style={[styles.postModalFooter, { borderTopColor: colors.borderLight, backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[styles.closeBtn, { borderColor: colors.border }]}
            onPress={() => setPostModalVisible(false)}
          >
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

  // ── Render: full Analytics tab ───────────────────────────────────────────────
  const renderAnalytics = () => {
    if (analyticsLoading) {
      return <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />;
    }

    return (
      <View style={styles.analyticsContainer}>
        {isWide ? (
          // ── Wide (web) 3-column layout ──────────────────────────────────────
          <View style={styles.analyticsWideRow}>
            {/* Left: stats + posts list */}
            <View style={styles.analyticsLeftCol}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {renderOverviewStats()}
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>RECENT POSTS</Text>
                </View>
                {filteredPosts.length === 0
                  ? <Text style={styles.emptyAnalyticsText}>No tagged posts yet</Text>
                  : filteredPosts.map(renderPostListItem)
                }
              </ScrollView>
            </View>

            {/* Center + Right: post detail */}
            <View style={styles.analyticsCenterCol}>
              {selectedPost
                ? renderPostDetailPanel(selectedPost)
                : (
                  <View style={styles.detailEmpty}>
                    <Ionicons name="bar-chart-outline" size={48} color={colors.border} />
                    <Text style={[styles.detailEmptyText, { color: colors.textMuted }]}>Select a post to view analytics</Text>
                  </View>
                )
              }
            </View>
          </View>
        ) : (
          // ── Narrow (mobile) single column ───────────────────────────────────
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.analyticsMobileContent}>
            {/* Filter chip */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, { borderColor: colors.border }]}
                onPress={() => setFilterMenuOpen(v => !v)}
              >
                <Text style={[styles.filterChipText, { color: colors.text }]}>{filterLabel}</Text>
                <Ionicons name={filterMenuOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
              </TouchableOpacity>
              {filterMenuOpen && (
                <View style={[styles.filterDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {FILTER_OPTIONS.map(opt => (
                    <TouchableOpacity
                      key={opt.value}
                      style={styles.filterOption}
                      onPress={() => { setFilterDays(opt.value); setFilterMenuOpen(false); }}
                    >
                      <Text style={[styles.filterOptionText, { color: opt.value === filterDays ? colors.primary : colors.text }]}>
                        {opt.label}
                      </Text>
                      {opt.value === filterDays && <Ionicons name="checkmark" size={14} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {renderOverviewStats()}

            <Text style={[styles.sectionTitle, { marginTop: 20, marginBottom: 12 }]}>RECENT POSTS</Text>
            {filteredPosts.length === 0
              ? <Text style={styles.emptyAnalyticsText}>No tagged posts for this period</Text>
              : filteredPosts.map(renderPostListItem)
            }
          </ScrollView>
        )}

        {renderPostModal()}
      </View>
    );
  };

  // ── Render: Bookings tab (was Overview) ──────────────────────────────────────
  const renderBookings = () => {
    const upcoming = bookings.filter(b => b.status === 'upcoming').slice(0, 10);
    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.tabContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      >
        <View style={styles.statsRow}>
          <StatCard label="Upcoming"  value={stats.upcoming}  icon="calendar-outline"         colors={colors} styles={styles} />
          <StatCard label="Completed" value={stats.completed} icon="checkmark-circle-outline"  colors={colors} styles={styles} />
          <StatCard label="Clients"   value={stats.clients}   icon="people-outline"             colors={colors} styles={styles} />
        </View>

        <Text style={styles.sectionTitle}>Upcoming Bookings</Text>
        {loadingBookings
          ? <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          : upcoming.length === 0
            ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={40} color={colors.border} />
                <Text style={styles.emptyTitle}>No upcoming bookings</Text>
                <Text style={styles.emptyText}>Share your profile to start getting booked</Text>
              </View>
            )
            : upcoming.map(b => (
              <BookingRow key={b.id} booking={b} colors={colors} styles={styles} onStatusChange={handleStatusChange} />
            ))
        }
      </ScrollView>
    );
  };

  // ── Render: Calendar tab ─────────────────────────────────────────────────────
  const renderCalendar = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
    >
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

  const renderMonthView = () => (
    <View>
      <View style={styles.calNav}>
        <TouchableOpacity onPress={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.calNavTitle}>{MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}</Text>
        <TouchableOpacity onPress={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
          <Ionicons name="chevron-forward" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.calDayHeaders}>
        {DAYS_SHORT.map(d => <Text key={d} style={styles.calDayHeader}>{d}</Text>)}
      </View>
      <View style={styles.calGrid}>
        {monthDays.map((day, i) => {
          if (!day) return <View key={`e-${i}`} style={styles.calCell} />;
          const isToday    = sameDay(day, today);
          const isSelected = sameDay(day, selectedDay);
          const dots = bookingsForDay(bookings, day);
          return (
            <TouchableOpacity key={day.toISOString()} style={[styles.calCell, isSelected && styles.calCellSelected]} onPress={() => setSelectedDay(day)}>
              <Text style={[styles.calCellText, isToday && styles.calCellToday, isSelected && styles.calCellSelectedText]}>{day.getDate()}</Text>
              {dots.length > 0 && (
                <View style={styles.calDotRow}>
                  {dots.slice(0, 3).map((_, di) => <View key={di} style={[styles.calDot, { backgroundColor: colors.primary }]} />)}
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
        {bookingsForDay(bookings, selectedDay).length === 0
          ? <Text style={styles.calEmptyText}>No bookings this day</Text>
          : bookingsForDay(bookings, selectedDay).map(b => (
            <BookingRow key={b.id} booking={b} colors={colors} styles={styles} onStatusChange={handleStatusChange} />
          ))
        }
      </View>
    </View>
  );

  const renderWeekView = () => (
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
          const count = bookingsForDay(bookings, day).length;
          return (
            <TouchableOpacity key={day.toISOString()} style={[styles.weekCell, isSelected && styles.weekCellSelected]} onPress={() => setSelectedDay(day)}>
              <Text style={[styles.weekDayLabel, isToday && { color: colors.primary }]}>{DAYS_SHORT[day.getDay()]}</Text>
              <View style={[styles.weekDayNum, isSelected && { backgroundColor: colors.primary }]}>
                <Text style={[styles.weekDayNumText, isSelected && { color: '#fff' }]}>{day.getDate()}</Text>
              </View>
              {count > 0 && (
                <View style={[styles.weekBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.weekBadgeText}>{count}</Text>
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
        {bookingsForDay(bookings, selectedDay).length === 0
          ? <Text style={styles.calEmptyText}>No bookings this day</Text>
          : bookingsForDay(bookings, selectedDay).map(b => (
            <BookingRow key={b.id} booking={b} colors={colors} styles={styles} onStatusChange={handleStatusChange} />
          ))
        }
      </View>
    </View>
  );

  const renderDayView = () => {
    const dayBookings = bookingsForDay(bookings, selectedDay);
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
        {HOURS.map(h => {
          const label = h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
          const slotBookings = dayBookings.filter(b => {
            if (!b.appointment_time) return false;
            return parseInt(b.appointment_time.split(':')[0]) === h;
          });
          return (
            <View key={h} style={styles.hourRow}>
              <Text style={styles.hourLabel}>{label}</Text>
              <View style={styles.hourLine} />
              {slotBookings.map(b => (
                <View key={b.id} style={[styles.hourBooking, { backgroundColor: colors.primaryLight, borderLeftColor: colors.primary }]}>
                  <Text style={[styles.hourBookingName, { color: colors.primary }]} numberOfLines={1}>
                    {b.client?.full_name || b.client?.username || 'Client'}
                  </Text>
                  <Text style={styles.hourBookingService} numberOfLines={1}>{b.service_name}</Text>
                </View>
              ))}
            </View>
          );
        })}
        {dayBookings.length === 0 && (
          <View style={styles.emptyState}><Text style={styles.calEmptyText}>No bookings this day</Text></View>
        )}
      </View>
    );
  };

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
      {/* Header */}
      <LinearGradient colors={['#5D1F1F', '#C8835A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>My Studio</Text>
          <Text style={styles.headerSub}>My Studio</Text>
        </View>
        <TouchableOpacity style={styles.modeToggle} onPress={toggleMode} activeOpacity={0.8}>
          <Ionicons name="swap-horizontal-outline" size={14} color="rgba(255,255,255,0.9)" />
          <Text style={styles.modeToggleText}>Client Mode</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabs}>
        {TABS.map(t => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'Bookings'  && renderBookings()}
        {activeTab === 'Calendar'  && renderCalendar()}
        {activeTab === 'Services'  && renderServices()}
      </View>

      <AddServiceModal
        visible={addServiceVisible}
        onClose={() => setAddServiceVisible(false)}
        onSave={handleAddService}
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 22, fontFamily: 'Figtree_700Bold', color: '#fff', marginBottom: 2 },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontFamily: 'Figtree_400Regular' },
  modeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  modeToggleText: { fontSize: 12, fontFamily: 'Figtree_600SemiBold', color: '#fff' },

  // ── Tabs ──
  tabs: { flexDirection: 'row', backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#5D1F1F' },
  tabText: { fontSize: 12, fontFamily: 'Figtree_500Medium', color: c.textSecondary },
  tabTextActive: { fontFamily: 'Figtree_700Bold', color: '#5D1F1F' },
  content: { flex: 1 },
  tabContent: { padding: 16, paddingBottom: 32 },

  // ── Analytics container ──
  analyticsContainer: { flex: 1 },

  // Wide (web 3-col) layout
  analyticsWideRow: { flex: 1, flexDirection: 'row' },
  analyticsLeftCol: {
    width: 300,
    borderRightWidth: 1,
    borderRightColor: c.borderLight,
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  analyticsCenterCol: { flex: 1 },

  // Mobile single-col
  analyticsMobileContent: { padding: 16, paddingBottom: 40 },

  // Filter chip
  filterRow: { marginBottom: 16, position: 'relative', zIndex: 10, alignSelf: 'flex-start' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipText: { fontSize: 13, fontFamily: 'Figtree_500Medium' },
  filterDropdown: {
    position: 'absolute',
    top: 38,
    left: 0,
    minWidth: 160,
    borderWidth: 1,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
    zIndex: 20,
  },
  filterOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 11 },
  filterOptionText: { fontSize: 14, fontFamily: 'Figtree_400Regular' },

  // Overview stats grid (2×2)
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  analyticsStatCard: {
    width: '47%',
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    gap: 5,
    borderWidth: 1,
    borderColor: c.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  analyticsStatIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.primaryLight || '#FDF1EE', alignItems: 'center', justifyContent: 'center' },
  analyticsStatValue: { fontSize: 22, fontFamily: 'Figtree_700Bold', color: c.text },
  analyticsStatLabel: { fontSize: 11, fontFamily: 'Figtree_500Medium', color: c.textMuted },

  // Engagement rate banner
  engagementBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 4,
  },
  engagementBannerLabel: { flex: 1, fontSize: 13, fontFamily: 'Figtree_500Medium' },
  engagementBannerValue: { fontSize: 18, fontFamily: 'Figtree_700Bold' },

  // Section headers
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontSize: 11, fontFamily: 'Figtree_700Bold', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  emptyAnalyticsText: { fontSize: 14, color: c.textMuted, textAlign: 'center', paddingVertical: 32 },

  // Post list item
  postListItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  postListItemSelected: { backgroundColor: c.backgroundAlt || c.borderLight + '50' },
  postThumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: c.borderLight,
    flexShrink: 0,
  },
  postListInfo:   { flex: 1, justifyContent: 'space-between' },
  postListTitle:  { fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: c.text },
  postListTags:   { fontSize: 12, fontFamily: 'Figtree_400Regular', marginTop: 1 },
  postListDate:   { fontSize: 11, color: c.textMuted },
  postMetricsRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  postMetric:     { flexDirection: 'row', alignItems: 'center', gap: 3 },
  postMetricText: { fontSize: 11, color: c.textSecondary, fontFamily: 'Figtree_500Medium' },
  postListFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  engagementChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  engagementChipText: { fontSize: 11, fontFamily: 'Figtree_600SemiBold' },
  bookingsChip:   { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bookingsChipText: { fontSize: 11, color: c.textMuted },

  // Post detail panel
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  detailEmptyText: { fontSize: 14, textAlign: 'center' },
  detailHero: { width: '100%', height: 220, overflow: 'hidden', position: 'relative' },
  detailHeroTitle: { color: '#fff', fontSize: 18, fontFamily: 'Figtree_700Bold' },
  detailBody: { padding: 20, gap: 0 },
  detailTitle: { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 4 },
  detailTags:  { fontSize: 13, fontFamily: 'Figtree_400Regular', marginBottom: 4 },
  detailDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 },
  detailDate: { fontSize: 12, color: c.textMuted },
  detailSectionLabel: { fontSize: 10, fontFamily: 'Figtree_700Bold', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  detailSection: { marginBottom: 24 },

  // Engagement grid 2×2
  engagementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  engagementCell: {
    width: '47%',
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: c.borderLight,
  },
  engagementCellIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.primaryLight || '#FDF1EE', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  engagementCellValue: { fontSize: 20, fontFamily: 'Figtree_700Bold', color: c.text },
  engagementCellLabel: { fontSize: 11, color: c.textMuted },

  engagementRateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
  },
  engagementRateLabel: { flex: 1, fontSize: 13, fontFamily: 'Figtree_500Medium' },
  engagementRateValue: { fontSize: 17, fontFamily: 'Figtree_700Bold' },

  // Bookings from post
  bookingsFromPostRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  bookingsFromPostLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bookingsFromPostIcon: { width: 24, height: 24, borderRadius: 12, backgroundColor: c.primaryLight || '#FDF1EE', alignItems: 'center', justifyContent: 'center' },
  bookingsFromPostCount: { fontSize: 24, fontFamily: 'Figtree_700Bold', color: c.text },
  conversionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  conversionLabel: { fontSize: 12, color: c.textMuted },
  conversionValue: { fontSize: 12, fontFamily: 'Figtree_600SemiBold' },
  conversionBar: { height: 4, backgroundColor: c.borderLight, borderRadius: 2, overflow: 'hidden' },
  conversionFill: { height: 4, borderRadius: 2 },

  // Comments
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentAvatar: { flexShrink: 0 },
  commentAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  commentUsername: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: c.text },
  commentTime: { fontSize: 11, color: c.textMuted },
  commentText: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },

  // Post modal
  modalSafe: { flex: 1 },
  postModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  postModalTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold' },
  postModalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
  },
  closeBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  shareBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    overflow: 'hidden',
  },
  shareBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#fff' },

  // ── Stats (Bookings tab) ──
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: c.surface, borderRadius: 12, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: c.borderLight },
  statValue: { fontSize: 22, fontFamily: 'Figtree_700Bold', color: c.text },
  statLabel: { fontSize: 11, color: c.textMuted, fontFamily: 'Figtree_500Medium', textAlign: 'center' },

  // ── Booking row ──
  bookingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.borderLight, gap: 10 },
  statusDot:    { width: 10, height: 10, borderRadius: 5 },
  bookingInfo:  { flex: 1 },
  bookingClient: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: c.text, marginBottom: 2 },
  bookingService: { fontSize: 13, color: c.textSecondary, marginBottom: 2 },
  bookingDate:   { fontSize: 12, color: c.textMuted },
  bookingActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontFamily: 'Figtree_600SemiBold' },

  // ── Calendar ──
  calViewRow: { flexDirection: 'row', backgroundColor: c.surface, borderRadius: 10, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: c.border },
  calViewBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  calViewBtnActive: { backgroundColor: '#5D1F1F' },
  calViewText: { fontSize: 13, fontFamily: 'Figtree_500Medium', color: c.textSecondary },
  calViewTextActive: { color: '#fff', fontFamily: 'Figtree_600SemiBold' },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 },
  calNavTitle: { fontSize: 16, fontFamily: 'Figtree_700Bold', color: c.text },
  calDayHeaders: { flexDirection: 'row', marginBottom: 4 },
  calDayHeader: { flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Figtree_600SemiBold', color: c.textMuted, textTransform: 'uppercase' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8 },
  calCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calCellSelected: { backgroundColor: '#5D1F1F' },
  calCellText: { fontSize: 14, color: c.text, fontFamily: 'Figtree_500Medium' },
  calCellToday: { color: '#C8835A', fontFamily: 'Figtree_700Bold' },
  calCellSelectedText: { color: '#fff', fontFamily: 'Figtree_700Bold' },
  calDotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  calDot: { width: 4, height: 4, borderRadius: 2 },
  calDayBookings: { marginTop: 16 },
  calDayBookingsTitle: { fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: c.text, marginBottom: 10 },
  calEmptyText: { fontSize: 13, color: c.textMuted, textAlign: 'center', paddingVertical: 20 },
  weekRow: { flexDirection: 'row', marginBottom: 16, gap: 4 },
  weekCell: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: c.surface, borderWidth: 1, borderColor: c.borderLight, gap: 4 },
  weekCellSelected: { borderColor: '#5D1F1F' },
  weekDayLabel: { fontSize: 10, fontFamily: 'Figtree_600SemiBold', color: c.textMuted, textTransform: 'uppercase' },
  weekDayNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  weekDayNumText: { fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: c.text },
  weekBadge: { minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  weekBadgeText: { fontSize: 9, color: '#fff', fontFamily: 'Figtree_700Bold' },
  hourRow: { flexDirection: 'row', alignItems: 'flex-start', minHeight: 44, marginBottom: 2 },
  hourLabel: { width: 52, fontSize: 11, color: c.textMuted, fontFamily: 'Figtree_400Regular', paddingTop: 4 },
  hourLine: { flex: 1, height: 1, backgroundColor: c.borderLight, marginTop: 10 },
  hourBooking: { position: 'absolute', left: 60, right: 0, borderLeftWidth: 3, borderRadius: 4, padding: 6 },
  hourBookingName: { fontSize: 13, fontFamily: 'Figtree_600SemiBold' },
  hourBookingService: { fontSize: 11, color: c.textSecondary },

  // ── Services ──
  addServiceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 12, paddingVertical: 14, marginBottom: 20, gap: 8 },
  addServiceBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
  serviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.surface, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: c.borderLight, gap: 12 },
  serviceLeft:  { flex: 1 },
  serviceName:  { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: c.text, marginBottom: 3 },
  serviceDesc:  { fontSize: 13, color: c.textSecondary, lineHeight: 18, marginBottom: 3 },
  serviceMeta:  { fontSize: 12, color: c.textMuted },
  serviceRight: { alignItems: 'flex-end', gap: 10 },
  servicePrice: { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text },

  // ── Empty state ──
  emptyState: { alignItems: 'center', paddingTop: 48, gap: 10 },
  emptyTitle:  { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: c.text },
  emptyText:   { fontSize: 13, color: c.textMuted, textAlign: 'center', paddingHorizontal: 32, lineHeight: 19 },

  // ── Add service modal ──
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: c.border },
  modalTitle:  { fontSize: 18, fontFamily: 'Figtree_700Bold', color: c.text },
  modalBody:   { flex: 1, padding: 20 },
  inputLabel:  { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: c.textSecondary, marginBottom: 6, marginTop: 14 },
  input:       { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15 },
  textArea:    { minHeight: 90, paddingTop: 12 },
  saveBtn:     { margin: 20, borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  saveBtnText: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
});
