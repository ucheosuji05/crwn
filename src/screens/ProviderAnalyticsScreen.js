import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable,
  Image, ActivityIndicator, Modal, Animated, PanResponder,
  useWindowDimensions, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { analyticsService } from '../services/analyticsService';
import { bookingService } from '../services/bookingService';

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCENT       = '#B35D2B'; // burnt ochre — primary accent throughout analytics
const ACCENT_LIGHT = '#FBF0E9'; // very light ochre — icon/cell tint backgrounds

const FILTER_OPTIONS = [
  { label: 'Last 7 days',  value: 7  },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
  { label: 'All time',     value: 0  },
];
const BAR_MAX_H       = 80;
const WIDE_BREAKPOINT = 820;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(n) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr); // handles both date-only and full ISO timestamps
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

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function BarChart({ data, colors }) {
  const peak = Math.max(...data.map(d => d.count), 1);
  return (
    <View>
      <View style={bc.header}>
        <Text style={[bc.label, { color: colors.textMuted }]}>VIEWS THIS WEEK</Text>
        <Text style={[bc.peak, { color: colors.textSecondary }]}>Peak: {fmtNum(peak)}</Text>
      </View>
      <View style={bc.row}>
        {data.map(({ day, count }, i) => {
          const h = peak > 0 ? Math.max((count / peak) * BAR_MAX_H, count > 0 ? 6 : 2) : 2;
          return (
            <View key={`bar-${day}-${i}`} style={bc.col}>
              <View style={bc.track}>
                <View style={[bc.bar, { height: h, backgroundColor: ACCENT }]} />
              </View>
              <Text style={[bc.dayLabel, { color: colors.textMuted }]}>{day.charAt(0)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const bc = StyleSheet.create({
  header:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  label:    { fontSize: 10, fontFamily: 'Figtree_700Bold', letterSpacing: 0.8, textTransform: 'uppercase' },
  peak:     { fontSize: 11, fontFamily: 'Figtree_500Medium' },
  row:      { flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX_H + 24, gap: 4 },
  col:      { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  track:    { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar:      { width: '75%', borderRadius: 3, minHeight: 2 },
  dayLabel: { fontSize: 10, fontFamily: 'Figtree_500Medium', marginTop: 4 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ProviderAnalyticsScreen() {
  const { user }               = useAuth();
  const navigation             = useNavigation();
  const { colors }             = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isWide                 = windowWidth >= WIDE_BREAKPOINT;
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // ── Bottom-sheet animation ─────────────────────────────────────────────────
  // whRef keeps windowHeight fresh for the PanResponder (created only once).
  const whRef      = useRef(windowHeight);
  whRef.current    = windowHeight;

  const sheetAnim  = useRef(new Animated.Value(windowHeight)).current;
  const sheetBaseY = useRef(windowHeight);

  const snapSheet = useCallback((toY, done) => {
    sheetBaseY.current = toY;
    Animated.spring(sheetAnim, {
      toValue: toY,
      useNativeDriver: false,   // must match PanResponder's Animated.event
      damping: 28, stiffness: 220, mass: 0.85,
    }).start(done);
  }, [sheetAnim]);

  const closeSheet = useCallback(() => {
    const h = whRef.current;
    sheetBaseY.current = h;
    Animated.timing(sheetAnim, { toValue: h, duration: 260, useNativeDriver: false })
      .start(() => setModalVisible(false));
  }, [sheetAnim]);

  const openPostSheet = useCallback((post) => {
    const h = whRef.current;
    setSelectedPost(post);
    setModalVisible(true);
    sheetAnim.setValue(h);
    snapSheet(h * 0.33);            // open at peek (~67 % visible)
  }, [sheetAnim, snapSheet]);

  // onReleaseRef — reassigned every render so the PanResponder (created once)
  // always calls up-to-date logic without a stale closure.
  const onReleaseRef = useRef(null);
  onReleaseRef.current = ({ dy, vy }) => {
    const h    = whRef.current;
    const endY = sheetBaseY.current + dy;

    if (vy > 0.5 || endY > h * 0.72) {
      // Fast swipe down OR dragged far down → dismiss
      sheetBaseY.current = h;
      Animated.timing(sheetAnim, { toValue: h, duration: 260, useNativeDriver: false })
        .start(() => setModalVisible(false));
    } else if (dy < -8 || endY < h * 0.28) {
      // Any upward pull OR dragged high → expand to full screen
      snapSheet(h * 0.04);
    } else {
      // Default → snap back to peek
      snapSheet(h * 0.33);
    }
  };

  // Pan responder on the handle strip only.
  // Uses direct setValue (no offset/flattenOffset) — simpler and reliable.
  const sheetPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,    // immediately own every touch on the pill
    onMoveShouldSetPanResponder:  () => true,
    onPanResponderGrant: () => {
      sheetAnim.stopAnimation();
      // sheetBaseY.current is always synced by snapSheet / openPostSheet
    },
    onPanResponderMove: (_, { dy }) => {
      const h    = whRef.current;
      const newY = sheetBaseY.current + dy;
      // Clamp: can't go above full (h*0.04) or below screen
      sheetAnim.setValue(Math.max(h * 0.04, Math.min(newY, h)));
    },
    onPanResponderRelease: (_, gesture) => onReleaseRef.current?.(gesture),
  })).current;

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);
  const [posts,          setPosts]          = useState([]);
  const [bmCounts,       setBmCounts]       = useState({});
  const [bookings,       setBookings]       = useState([]);
  const [followerCount,  setFollowerCount]  = useState(0);
  const [weekly,         setWeekly]         = useState([]);
  const [comments,       setComments]       = useState([]);
  const [selectedPost,   setSelectedPost]   = useState(null);
  const [modalVisible,   setModalVisible]   = useState(false);
  const [filterDays,     setFilterDays]     = useState(30);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const { data: rawPosts } = await analyticsService.getProviderPosts(user.id);
      const safePosts = rawPosts || [];
      const postIds   = safePosts.map(p => p.id);

      const [bm, wk, cm, { data: bkgs }, followerCount] = await Promise.all([
        analyticsService.getBookmarkCounts(postIds),
        analyticsService.getWeeklyActivity(postIds),
        analyticsService.getRecentComments(postIds, 6),
        bookingService.getBookingsByStylist(user.id),
        analyticsService.getFollowerCount(user.id),
      ]);

      setPosts(safePosts);
      setBmCounts(bm);
      setBookings(bkgs || []);
      setFollowerCount(followerCount);
      setWeekly(wk);
      setComments(cm.data || []);
      if (safePosts.length > 0) setSelectedPost(safePosts[0]);
    } catch (e) {
      console.error('[ProviderAnalytics] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => load(true), [load]);

  const filteredPosts = useMemo(() => {
    if (!filterDays) return posts;
    const cutoff = new Date(Date.now() - filterDays * 24 * 60 * 60 * 1000);
    return posts.filter(p => new Date(p.created_at) >= cutoff);
  }, [posts, filterDays]);

  const stats = useMemo(() => {
    const filteredBmCounts = Object.fromEntries(filteredPosts.map(p => [p.id, bmCounts[p.id] || 0]));
    const filteredBookings = filterDays
      ? bookings.filter(b => {
          if (!b.appointment_date) return false;
          const cutoff = new Date(Date.now() - filterDays * 24 * 60 * 60 * 1000);
          return new Date(b.appointment_date) >= cutoff;
        })
      : bookings;
    return analyticsService.computeAggregateStats(filteredPosts, filteredBmCounts, filteredBookings, followerCount);
  }, [filteredPosts, bmCounts, bookings, followerCount, filterDays]);

  const filterLabel = FILTER_OPTIONS.find(f => f.value === filterDays)?.label ?? 'Last 30 days';

  const postMetrics = (post) =>
    analyticsService.computePostMetrics(post, bmCounts[post.id] || 0, followerCount);

  const selectedMetrics = useMemo(
    () => selectedPost ? postMetrics(selectedPost) : null,
    [selectedPost, bmCounts, stats],
  );

  // ── Overview stats card (matches Figma exactly) ────────────────────────────
  const renderStatsCard = () => {
    if (loading) return null;
    const { totalCrowns, totalSaves, totalBookings, engagementRate, followerCount } = stats;

    // Each stat: outline icons, slightly larger size = visually thicker stroke
    const statPairs = [
      [
        { icon: 'heart-outline',  isMCI: false, label: 'Total Likes',  value: fmtNum(totalCrowns)   },
        { icon: 'people-outline', isMCI: false, label: 'Followers',    value: fmtNum(followerCount) },
      ],
      [
        { icon: 'bookmark-outline', isMCI: false, label: 'Total Saves',    value: fmtNum(totalSaves)      },
        { icon: 'people-outline',   isMCI: false, label: 'Bookings',       value: String(totalBookings)   },
      ],
    ];

    return (
      <View style={styles.statsCard}>
        {statPairs.map((pair, rowIdx) => (
          <View key={rowIdx} style={[styles.statRow, rowIdx > 0 && { marginTop: 18 }]}>
            {pair.map(({ icon, isMCI, label, value }) => (
              <View key={label} style={styles.statCell}>
                <View style={styles.statLabelRow}>
                  {isMCI
                    ? <MaterialCommunityIcons name={icon} size={20} color={ACCENT} />
                    : <Ionicons name={icon} size={19} color={ACCENT} />
                  }
                  <Text style={styles.statLabel}>{label}</Text>
                </View>
                <Text style={styles.statValue}>{value}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Separator */}
        <View style={[styles.statsSeperator, { backgroundColor: colors.borderLight }]} />

        {/* Engagement rate row */}
        <View style={styles.engRow}>
          <Ionicons name="trending-up" size={16} color={ACCENT} />
          <Text style={[styles.engLabel, { color: colors.textSecondary }]}>Avg. Engagement Rate</Text>
          <Text style={[styles.engValue, { color: ACCENT }]}>{engagementRate}%</Text>
        </View>
      </View>
    );
  };

  // ── Post list card (matches Figma exactly) ─────────────────────────────────
  const renderPostCard = (post) => {
    const m     = postMetrics(post);
    const thumb = post.post_media?.[0]?.media_url;

    return (
      <TouchableOpacity
        key={post.id}
        style={styles.postCard}
        onPress={() => { setSelectedPost(post); if (isWide) return; openPostSheet(post); }}
        activeOpacity={0.8}
      >
        <View style={styles.postCardInner}>
          {/* Thumbnail */}
          <View style={styles.postThumb}>
            {thumb
              ? <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              : <View style={[StyleSheet.absoluteFill, styles.postThumbEmpty]}>
                  <Ionicons name="image-outline" size={22} color={colors.border} />
                </View>
            }
          </View>

          {/* Right content */}
          <View style={styles.postContent}>
            <Text style={styles.postTitle} numberOfLines={1}>{post.title || 'Untitled'}</Text>
            <Text style={styles.postDate}>{formatDate(post.created_at)}</Text>

            {/* Metrics: label row then value row */}
            <View style={styles.metricsBlock}>
              {/* Labels row */}
              <View style={styles.metricLabelsRow}>
                {[
                  { icon: 'heart-outline',    isMCI: false, label: 'Likes'  },
                  { icon: 'people-outline',   isMCI: false, label: 'Reach'  },
                  { icon: 'bookmark-outline', isMCI: false, label: 'Saves'  },
                ].map(({ icon, isMCI, label }) => (
                  <View key={label} style={styles.metricCol}>
                    <View style={styles.metricLabelInner}>
                      {isMCI
                        ? <MaterialCommunityIcons name={icon} size={15} color={colors.textMuted} />
                        : <Ionicons name={icon} size={15} color={colors.textMuted} />
                      }
                      <Text style={styles.metricLabelText}>{label}</Text>
                    </View>
                  </View>
                ))}
              </View>
              {/* Values row */}
              <View style={styles.metricValuesRow}>
                {[m.likes, m.reach, m.saves].map((val, i) => (
                  <View key={i} style={styles.metricCol}>
                    <Text style={styles.metricValue}>{fmtNum(val)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Separator line */}
        <View style={[styles.postSeparator, { backgroundColor: colors.borderLight }]} />

        {/* Footer: engagement + bookings */}
        <View style={styles.postFooter}>
          <View style={styles.postFooterLeft}>
            <Ionicons name="trending-up" size={16} color={ACCENT} />
            <Text style={[styles.postEngText, { color: colors.textSecondary }]}>
              {'Engagement: '}
              <Text style={{ color: ACCENT, fontFamily: 'Figtree_700Bold' }}>{m.rate}%</Text>
            </Text>
          </View>
          {m.bookings > 0 && (
            <View style={styles.postFooterRight}>
              <Ionicons name="people-outline" size={16} color={ACCENT} />
              <Text style={styles.postBookingsText}>{m.bookings} bookings</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Post detail panel (side panel on web, bottom sheet on mobile) ──────────
  const renderDetail = (post) => {
    if (!post || !selectedMetrics) {
      return (
        <View style={styles.detailEmpty}>
          <Ionicons name="bar-chart-outline" size={44} color={colors.border} />
          <Text style={[styles.detailEmptyText, { color: colors.textMuted }]}>
            Select a post to view analytics
          </Text>
        </View>
      );
    }

    const thumb  = post.post_media?.[0]?.media_url;
    const tags   = Array.isArray(post.tags) ? post.tags.map(t => `#${t}`).join(' ') : '';
    const m      = selectedMetrics;
    const cvRate = ((stats.totalBookings || 0) / Math.max(m.reach, 1) * 100).toFixed(1);

    // Engagement pairs — same flat layout as the overview stats card
    const engPairs = [
      [
        { icon: 'heart-outline',     isMCI: false, val: m.likes,   label: 'Likes'    },
        { icon: 'people-outline',    isMCI: false, val: m.reach,   label: 'Reach'    },
      ],
      [
        { icon: 'bookmark-outline',   isMCI: false, val: m.saves,    label: 'Saves'    },
        { icon: 'chatbubble-outline', isMCI: false, val: m.comments, label: 'Comments' },
      ],
    ];

    return (
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
      >

        {/* ── Hero image + title/tags/date — all in one card ── */}
        <View style={styles.detailCard}>
          {thumb && (
            <View style={styles.hero}>
              <Image source={{ uri: thumb }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </View>
          )}
          <View style={styles.detailBody}>
            <Text style={styles.detailTitle}>{post.title || 'Untitled'}</Text>
            {!!tags && (
              <Text style={[styles.detailTags, { color: ACCENT }]}>{tags}</Text>
            )}
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
              <Text style={styles.dateText}>{formatDate(post.created_at)}</Text>
            </View>
          </View>
        </View>

        {/* ── Engagement card ── */}
        <View style={styles.detailCard}>
          <Text style={styles.sectionLabel}>ENGAGEMENT</Text>

          {engPairs.map((pair, rowIdx) => (
            <View key={rowIdx} style={[styles.statRow, rowIdx > 0 && { marginTop: 18 }]}>
              {pair.map(({ icon, isMCI, val, label }) => (
                <View key={label} style={styles.statCell}>
                  <View style={styles.statLabelRow}>
                    {isMCI
                      ? <MaterialCommunityIcons name={icon} size={16} color={ACCENT} />
                      : <Ionicons name={icon} size={15} color={ACCENT} />
                    }
                    <Text style={styles.statLabel}>{label}</Text>
                  </View>
                  <Text style={styles.statValue}>{fmtNum(val)}</Text>
                </View>
              ))}
            </View>
          ))}

          {/* Engagement rate row — same pattern as overview stats card */}
          <View style={[styles.statsSeperator, { backgroundColor: colors.borderLight }]} />
          <View style={styles.engRow}>
            <Ionicons name="trending-up" size={16} color={ACCENT} />
            <Text style={[styles.engLabel, { color: colors.textSecondary }]}>Engagement Rate</Text>
            <Text style={[styles.engValue, { color: ACCENT }]}>{m.rate}%</Text>
          </View>
        </View>

        {/* ── Views this week card ── */}
        {weekly.length > 0 && (
          <View style={styles.detailCard}>
            <BarChart data={weekly} colors={colors} />
          </View>
        )}

        {/* ── Bookings card ── */}
        <View style={styles.detailCard}>
          <View style={styles.bkgRow}>
            <View style={styles.bkgLeft}>
              <View style={[styles.bkgIcon, { backgroundColor: ACCENT_LIGHT }]}>
                <Ionicons name="people-outline" size={15} color={ACCENT} />
              </View>
              <Text style={[styles.sectionLabel, { marginBottom: 0 }]}>BOOKINGS FROM POST</Text>
            </View>
            <Text style={styles.bkgCount}>{stats?.totalBookings ?? 0}</Text>
          </View>
          <View style={styles.cvRow}>
            <Text style={styles.cvLabel}>Conversion rate</Text>
            <Text style={[styles.cvVal, { color: ACCENT }]}>{cvRate}%</Text>
          </View>
          <View style={[styles.cvTrack, { backgroundColor: colors.borderLight }]}>
            <View style={[styles.cvFill, { width: `${Math.min(parseFloat(cvRate), 100)}%`, backgroundColor: ACCENT }]} />
          </View>
        </View>

        {/* ── Recent comments card ── always shown */}
        <View style={styles.detailCard}>
          <Text style={styles.sectionLabel}>RECENT COMMENTS</Text>
          {comments.length === 0 ? (
            <Text style={[styles.cvLabel, { textAlign: 'center', paddingVertical: 12 }]}>
              No comments yet
            </Text>
          ) : (
            comments.map(c => (
              <View key={c.id} style={styles.commentRow}>
                <View style={styles.commentAvatar}>
                  {c.profiles?.avatar_url
                    ? <Image source={{ uri: c.profiles.avatar_url }} style={styles.avatarImg} />
                    : <View style={[styles.avatarPlaceholder, { backgroundColor: colors.borderLight }]}>
                        <Text style={[styles.avatarInitial, { color: colors.textSecondary }]}>
                          {(c.profiles?.username || c.profiles?.full_name || 'U')[0].toUpperCase()}
                        </Text>
                      </View>
                  }
                </View>
                <View style={styles.commentBody}>
                  <View style={styles.commentHeaderRow}>
                    <Text style={styles.commentName}>
                      {c.profiles?.username || c.profiles?.full_name || 'User'}
                    </Text>
                    <Text style={styles.commentTime}>{timeAgo(c.created_at)}</Text>
                  </View>
                  <Text style={styles.commentText} numberOfLines={2}>{c.content}</Text>
                </View>
              </View>
            ))
          )}
        </View>

      </ScrollView>
    );
  };

  // ── Post detail bottom sheet (mobile only) ────────────────────────────────
  const renderModal = () => {
    if (isWide) return null; // web uses the right-col panel, not a modal
    return (
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeSheet}
        statusBarTranslucent
      >
        <View style={{ flex: 1 }}>
          {/* Dim backdrop — tap to dismiss */}
          <Pressable
            style={[StyleSheet.absoluteFillObject, styles.sheetBackdrop]}
            onPress={closeSheet}
          />

          {/* The sheet itself */}
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                height: windowHeight * 0.97,
                backgroundColor: colors.surface,
                transform: [{ translateY: sheetAnim }],
              },
            ]}
          >
            {/* ── Pill-only drag area — no children that steal touches ── */}
            <View style={styles.sheetDragArea} {...sheetPan.panHandlers}>
              <View style={[styles.sheetPill, { backgroundColor: colors.border }]} />
            </View>

            {/* ── Header — outside pan area so X button works normally ── */}
            <View style={[styles.sheetHeaderRow, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.sheetHeaderTitle, { color: colors.text }]}>Post Analytics</Text>
              <TouchableOpacity
                onPress={closeSheet}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Scrollable detail content */}
            {renderDetail(selectedPost)}
          </Animated.View>

          {/* ── Footer pinned to screen bottom — always visible regardless of snap ── */}
          <View
            style={[
              styles.modalFooter,
              {
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                borderTopColor: colors.borderLight,
                backgroundColor: colors.surface,
              },
            ]}
          >
            <TouchableOpacity
              style={[styles.closeBtn, { borderColor: colors.border }]}
              onPress={closeSheet}
            >
              <Text style={[styles.closeBtnText, { color: colors.text }]}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shareBtn}>
              <LinearGradient
                colors={['#5D1F1F', '#C8835A']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.shareBtnText}>Share Post</Text>
              <Ionicons name="share-outline" size={15} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // ── Scrollable list content ────────────────────────────────────────────────
  const renderScrollContent = () => (
    <>
      {/* POSTS OVERVIEW label + filter chip — same pattern as RECENT POSTS */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionHeaderLabel}>POSTS OVERVIEW</Text>
        <View style={{ position: 'relative', zIndex: 20 }}>
          <TouchableOpacity
            style={[styles.filterChip, { borderColor: colors.border }]}
            onPress={() => setFilterMenuOpen(v => !v)}
          >
            <Text style={[styles.filterChipText, { color: colors.textSecondary }]}>{filterLabel}</Text>
            <Ionicons name={filterMenuOpen ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textMuted} />
          </TouchableOpacity>
          {filterMenuOpen && (
            <View style={[styles.filterDropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {FILTER_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.filterOption}
                  onPress={() => { setFilterDays(opt.value); setFilterMenuOpen(false); }}
                >
                  <Text style={[styles.filterOptionText, { color: opt.value === filterDays ? ACCENT : colors.text }]}>
                    {opt.label}
                  </Text>
                  {opt.value === filterDays && <Ionicons name="checkmark" size={13} color={ACCENT} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {renderStatsCard()}

      {/* Recent Posts header */}
      <Text style={styles.recentPostsLabel}>RECENT POSTS</Text>

      {filteredPosts.length === 0
        ? <Text style={[styles.emptyText, { color: colors.textMuted }]}>No posts for this period</Text>
        : filteredPosts.map(renderPostCard)
      }
    </>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header — back button + title, consistent with the other Settings sub-pages */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBackBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerLogo, { color: colors.text }]}>Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : isWide ? (
        // ── Wide (web) 2-col ──────────────────────────────────────────────────
        <View style={styles.wideRow}>
          <ScrollView style={styles.leftCol} contentContainerStyle={styles.scrollPad} showsVerticalScrollIndicator={false}>
            {renderScrollContent()}
          </ScrollView>
          <View style={[styles.rightCol, { borderLeftColor: colors.borderLight }]}>
            {renderDetail(selectedPost)}
          </View>
        </View>
      ) : (
        // ── Mobile single-col ─────────────────────────────────────────────────
        <ScrollView
          contentContainerStyle={styles.scrollPad}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
              colors={[ACCENT]}
            />
          }
        >
          {renderScrollContent()}
        </ScrollView>
      )}

      {renderModal()}
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1 },

  // Header — crwn. logo centered with messages button right
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLogo: {
    fontSize: 18,
    fontFamily: 'Figtree_600SemiBold',
    textAlign: 'center',
    flex: 1,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Section header row: label + filter chip side by side
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    zIndex: 20,
  },
  sectionHeaderLabel: {
    fontSize: 12,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipText:   { fontSize: 12, fontFamily: 'Figtree_500Medium' },
  filterDropdown:   { position: 'absolute', top: 34, right: 0, minWidth: 155, borderWidth: 1, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8, zIndex: 30 },
  filterOption:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  filterOptionText: { fontSize: 13, fontFamily: 'Figtree_400Regular' },

  // Layout
  wideRow:   { flex: 1, flexDirection: 'row' },
  leftCol:   { width: 340 },
  rightCol:  { flex: 1, borderLeftWidth: 1 },
  scrollPad: { padding: 16, paddingBottom: 48 },

  // ── Stats Card ──
  statsCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 18,
    marginBottom: 24,
    shadowColor: '#C4A47C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 1,
  },
  statRow: {
    flexDirection: 'row',
  },
  statCell: {
    flex: 1,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
    color: c.textSecondary,
  },
  statValue: {
    fontSize: 26,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
    letterSpacing: -0.5,
  },
  statsSeperator: {
    height: 1,
    marginVertical: 16,
  },
  engRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  engLabel: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
  },
  engValue: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
  },

  // ── Section label ──
  recentPostsLabel: {
    fontSize: 12,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 14,
  },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 32 },

  // ── Post Card ──
  postCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#C4A47C',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  postCardInner: {
    flexDirection: 'row',
    padding: 14,
    gap: 14,
  },
  postThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: c.borderLight,
    flexShrink: 0,
  },
  postThumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  postContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  postTitle: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
    marginBottom: 2,
  },
  postDate: {
    fontSize: 12,
    color: c.textMuted,
    marginBottom: 10,
  },
  // Metrics block
  metricsBlock: {
    gap: 3,
  },
  metricLabelsRow: {
    flexDirection: 'row',
  },
  metricValuesRow: {
    flexDirection: 'row',
  },
  metricCol: {
    flex: 1,
  },
  metricLabelInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metricLabelText: {
    fontSize: 12,
    color: c.textMuted,
    fontFamily: 'Figtree_400Regular',
  },
  metricValue: {
    fontSize: 15,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
  },
  // Post card separator + footer
  postSeparator: {
    height: 1,
    marginHorizontal: 14,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  postFooterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  postFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  postEngText: {
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
  },
  postBookingsText: {
    fontSize: 12,
    color: c.textSecondary,
    fontFamily: 'Figtree_500Medium',
  },

  // ── Detail panel ──
  detailEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  detailEmptyText: { fontSize: 14, textAlign: 'center' },
  // Hero image — sits inside detailCard, clips to card's rounded corners
  hero: { width: '100%', height: 200, borderRadius: 10, overflow: 'hidden' },
  // Title / tags / date — sits below the hero image inside the same card
  detailBody: { paddingTop: 14, paddingBottom: 4 },
  detailTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 4 },
  detailTags:  { fontSize: 13, fontFamily: 'Figtree_500Medium', marginBottom: 6 },
  dateRow:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateText:    { fontSize: 12, color: c.textMuted },
  // Section cards — matches statsCard visual style
  detailCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E2D9',
    padding: 18,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#C4A47C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  detailDivider: { height: StyleSheet.hairlineWidth, marginVertical: 0 }, // kept for legacy
  sectionLabel: { fontSize: 11, fontFamily: 'Figtree_700Bold', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
  section: { marginBottom: 22 },
  bkgRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  bkgLeft:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bkgIcon:  { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  bkgCount: { fontSize: 26, fontFamily: 'Figtree_700Bold', color: c.text },
  cvRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cvLabel:  { fontSize: 13, color: c.textMuted },
  cvVal:    { fontSize: 13, fontFamily: 'Figtree_600SemiBold' },
  cvTrack:  { height: 5, borderRadius: 3, overflow: 'hidden' },
  cvFill:   { height: 5, borderRadius: 3 },
  commentRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  commentAvatar: { flexShrink: 0 },
  avatarImg: { width: 34, height: 34, borderRadius: 17 },
  avatarPlaceholder: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  commentBody: { flex: 1 },
  commentHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  commentName: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: c.text },
  commentTime: { fontSize: 11, color: c.textMuted },
  commentText: { fontSize: 13, color: c.textSecondary, lineHeight: 18 },

  // ── Bottom sheet ──
  sheetBackdrop: { backgroundColor: 'rgba(0,0,0,0.42)' },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  // Pill-only drag area — large vertical hit target, zero interactive children
  sheetDragArea: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPill: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  // Header row sits below the drag area and is NOT inside the panHandlers
  sheetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetHeaderTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold' },

  // Legacy modal names kept so no other references break
  modalSafe:        { flex: 1 },
  modalHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  modalHeaderTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold' },
  modalFooter:      { flexDirection: 'row', gap: 12, padding: 16, borderTopWidth: 1 },
  closeBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  closeBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  shareBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 13, borderRadius: 12, overflow: 'hidden' },
  shareBtnText: { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
});
