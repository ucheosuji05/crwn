import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  useWindowDimensions,
} from 'react-native';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../utils/responsive';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons as Icon } from '@expo/vector-icons';
import SavedLooks from './SavedLooks';
import HairProfile from './HairProfile';
import PostCard from './PostCard';
import PostFeedViewerModal from './PostFeedViewerModal';
import SkeletonPulse from './SkeletonPulse';
import { usePosts } from '../hooks/usePosts';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { bookingService } from '../services/bookingService';
import { postService } from '../services/postService';
import { profileService } from '../services/profileService';
import { reviewService } from '../services/reviewService';
import { supabase } from '../config/supabase';
import { Crown, Scissors } from 'lucide-react-native';
import { useIsWebLayout, WEB_MAX_WIDTHS } from '../utils/webLayout';

const HONEY = '#D4930A';

// ── Masonry layout (mirrors ExploreScreen's true masonry grid) ───────────────
const MASONRY_PAD = 12;
const MASONRY_GAP = 10;
const MASONRY_RADIUS = 16;
const MASONRY_DEFAULT_AR = 1;
const MASONRY_MAX_HW = 1.6;
const MASONRY_HW_LANDSCAPE_MAX = 0.8; // shorter than this (height:width) → landscape, spans full width
const MASONRY_COLUMN_WIDTH = (SCREEN_WIDTH - MASONRY_PAD * 2 - MASONRY_GAP) / 2;

// Shortest-column-first masonry, sized off each image's natural aspect ratio
// (capped at 1.6:1 height:width so resizeMode 'cover' never crops too tightly).
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

// N-column shortest-column-first masonry for web (numCols > 2)
function computeNColMasonry(posts, columnWidth, imageDimensions, numCols) {
  if (numCols === 2) return computeProfileMasonry(posts, columnWidth, imageDimensions);
  const gap = MASONRY_GAP;
  const heights = new Array(numCols).fill(0);
  const items = [];
  posts.forEach(post => {
    const dims = imageDimensions[post.id];
    const ar = dims ? dims.width / dims.height : MASONRY_DEFAULT_AR;
    const renderAr = Math.max(ar, 1 / MASONRY_MAX_HW);
    const col = heights.indexOf(Math.min(...heights));
    const height = columnWidth / renderAr;
    items.push({ post, column: col, top: heights[col], height });
    heights[col] += height + gap;
  });
  return { items, totalHeight: Math.max(Math.max(...heights) - gap, 0) };
}

const ALL_TABS = [
  { key: 'posts',     label: 'Posts' },
  { key: 'tagged',    label: 'Tagged',   stylistOnly: true },
  { key: 'favorites', label: 'Saves',    ownOnly: true },
  { key: 'bookings',  label: 'Bookings', ownOnly: true },
  { key: 'hair',      label: 'Hair',     lock: true },
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatTime(timeStr) {
  if (!timeStr) return null;
  const [h, m] = timeStr.split(':').map(Number);
  if (isNaN(h)) return null;
  const period = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 || 12;
  const mm = m && m !== 0 ? `:${String(m).padStart(2, '0')}` : '';
  return `${dh}${mm} ${period}`;
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

const STATUS_CONFIG = {
  upcoming:               { label: 'Upcoming',        bg: '#FEF9EC', text: '#92601A', dot: '#F59E0B' },
  pending:                { label: 'Pending',         bg: '#FEF9EC', text: '#92601A', dot: '#F59E0B' },
  confirmed:              { label: 'Confirmed',       bg: '#ECFDF5', text: '#065F46', dot: '#10B981' },
  completed:              { label: 'Completed',       bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' },
  cancelled:              { label: 'Cancelled',       bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
  cancellation_requested: { label: 'Cancel Requested', bg: '#FEF2F2', text: '#991B1B', dot: '#EF4444' },
};

function ImageWithFallback({ uri }) {
  const [failed, setFailed] = useState(false);
  const { colors } = useTheme();
  if (failed) {
    return (
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.borderLight }]}>
        <Icon name="image-outline" size={28} color={colors.border} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

function ClientBookingCard({ booking, colors, styles, onPress }) {
  const stylist     = booking.stylist || booking.stylists || {};
  const name        = stylist.full_name || stylist.business_name || stylist.username || 'Stylist';
  const avatarUrl   = stylist.avatar_url;
  const date        = formatDateShort(booking.appointment_date);
  const time        = formatTime(booking.appointment_time);
  const isPaid      = booking.deposit_status === 'paid' || booking.deposit_status === 'Paid';
  const statusKey   = booking.status?.toLowerCase() || 'upcoming';
  const statusCfg   = STATUS_CONFIG[statusKey] || STATUS_CONFIG.upcoming;
  const initial     = name.charAt(0).toUpperCase();

  return (
    <TouchableOpacity style={[styles.bkCard, { borderColor: colors.borderLight }]} onPress={onPress} activeOpacity={0.85}>
      {/* Top row: avatar + name + status */}
      <View style={styles.bkTopRow}>
        {/* Avatar */}
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.bkAvatar} />
        ) : (
          <View style={[styles.bkAvatar, styles.bkAvatarPlaceholder, { backgroundColor: colors.primaryLight || '#FDF1EE' }]}>
            <Text style={[styles.bkAvatarInitial, { color: colors.primary }]}>{initial}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.bkStylistName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
          <Text style={[styles.bkServiceName, { color: colors.textSecondary }]} numberOfLines={1}>{booking.service_name}</Text>
        </View>
        {/* Status pill */}
        <View style={[styles.bkStatusPill, { backgroundColor: statusCfg.bg }]}>
          <View style={[styles.bkStatusDot, { backgroundColor: statusCfg.dot }]} />
          <Text style={[styles.bkStatusText, { color: statusCfg.text }]}>{statusCfg.label}</Text>
        </View>
        <Icon name="chevron-forward" size={16} color={colors.textMuted} />
      </View>

      {/* Bottom row: date + time + deposit badge */}
      <View style={[styles.bkMetaRow, { borderTopColor: colors.borderLight }]}>
        <Icon name="calendar-outline" size={13} color={colors.textMuted} />
        <Text style={[styles.bkMeta, { color: colors.textMuted }]}>{date}</Text>
        {time && (
          <>
            <View style={[styles.bkMetaDot, { backgroundColor: colors.borderLight }]} />
            <Icon name="time-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.bkMeta, { color: colors.textMuted }]}>{time}</Text>
          </>
        )}
        {isPaid && (
          <View style={[styles.bkDepositBadge, { marginLeft: 'auto' }]}>
            <Text style={styles.bkDepositText}>Deposit Paid</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ProfileTabs({ viewedUserId, isOwnProfile }) {
  const isWebLayout = useIsWebLayout();
  const { width: windowWidth } = useWindowDimensions();
  const numCols = isWebLayout ? 3 : 2;
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const dynColWidth = (() => {
    const containerW = measuredWidth > 0
      ? measuredWidth
      : (isWebLayout ? Math.min(windowWidth, WEB_MAX_WIDTHS.profile) : windowWidth);
    return (containerW - MASONRY_PAD * 2 - MASONRY_GAP * (numCols - 1)) / numCols;
  })();
  const [activeTab, setActiveTab] = useState('posts');
  const [selectedPost, setSelectedPost] = useState(null);
  const [postCommentsOpen, setPostCommentsOpen] = useState(false);
  const postModalScrollRef = useRef(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bkConfirmAction, setBkConfirmAction] = useState(null); // null | 'cancel_pending' | 'request_cancel'
  const [bkActionLoading, setBkActionLoading] = useState(false);
  const [bkActionSuccess, setBkActionSuccess] = useState(null); // null | 'cancel_pending' | 'request_cancel'
  const [bkActionError, setBkActionError] = useState(null);
  const [isViewedStylist, setIsViewedStylist] = useState(false);
  const [taggedPosts, setTaggedPosts] = useState([]);
  const [taggedLoading, setTaggedLoading] = useState(false);
  const [postImageDims, setPostImageDims] = useState({});
  const dimsFetchedRef = useRef(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  // Review modal state
  const [reviewModalBooking, setReviewModalBooking] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewedBookingIds, setReviewedBookingIds] = useState(new Set());
  const { user } = useAuth();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { profile: authProfile } = useAuth();
  const isOwnStylist = isOwnProfile && !!authProfile?.is_stylist;
  const { posts, loading, refresh, silentRefetch, deletePost } = usePosts(viewedUserId);

  // When returning to the profile (e.g. after PostDetail deletes a post),
  // silently re-sync without a loading spinner — realtime already removed
  // the deleted post from state instantly; this confirms nothing else changed.
  useEffect(() => {
    const unsub = navigation.addListener('focus', silentRefetch);
    return unsub;
  }, [navigation, silentRefetch]);

  // ── Masonry grid renderers (mirrors ExploreScreen's masonry feed) ───────────
  const openPost = (item) => {
    if (!isWebLayout) {
      navigation.push('PostDetail', { postId: item.id });
    } else {
      setSelectedPost(item);
    }
  };

  // Fetch each post image's natural dimensions so masonry tiles can be sized
  // off their real aspect ratio (capped at 1.6:1), exactly like Explore.
  useEffect(() => {
    [...posts, ...taggedPosts].forEach(post => {
      const uri = post.post_media?.[0]?.media_url;
      if (!uri || dimsFetchedRef.current.has(post.id)) return;
      dimsFetchedRef.current.add(post.id);
      Image.getSize(uri,
        (w, h) => setPostImageDims(prev => ({ ...prev, [post.id]: { width: w, height: h } })),
        () => setPostImageDims(prev => ({ ...prev, [post.id]: { width: 1, height: 1 } })),
      );
    });
  }, [posts, taggedPosts]);

  const renderMasonryGrid = (items) => {
    const layout = computeNColMasonry(items, dynColWidth, postImageDims, numCols);
    return (
      <View style={[styles.masonryCanvas, { height: layout.totalHeight }]}>
        {layout.items.map(({ post, column, top, height }) => {
          const left = typeof column === 'number'
            ? column * (dynColWidth + MASONRY_GAP)
            : (column === 'left' || column === 'full' ? 0 : dynColWidth + MASONRY_GAP);
          const width = column === 'full' ? dynColWidth * 2 + MASONRY_GAP : dynColWidth;
          const uri = post.post_media?.[0]?.media_url;
          const stylistName = post.stylists?.full_name || post.stylists?.username;
          return (
            <TouchableOpacity
              key={post.id}
              style={[styles.masonryCard, { width, height, left, top }]}
              onPress={() => openPost(post)}
              activeOpacity={0.88}
            >
              {uri ? (
                <ImageWithFallback uri={uri} />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.borderLight }]} />
              )}

              {stylistName && (
                <>
                  <LinearGradient
                    colors={['transparent', 'rgba(26,22,18,0.9)']}
                    locations={[0, 1]}
                    style={styles.stylistGradient}
                    pointerEvents="none"
                  />
                  <View style={styles.stylistTag}>
                    <Scissors size={12} color="#fff" strokeWidth={1.5} />
                    <Text style={styles.stylistName} numberOfLines={1}>{stylistName}</Text>
                  </View>
                </>
              )}

              {(post.post_media?.length ?? 0) > 1 && (
                <View style={styles.photoDots}>
                  {Array.from({ length: Math.min(post.post_media.length, 5) }).map((_, i) => (
                    <View key={`${post.id}-dot-${i}`} style={[styles.photoDot, i === 0 && styles.photoDotActive]} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // Check if viewed profile is a stylist
  useEffect(() => {
    if (!viewedUserId) return;
    supabase
      .from('profiles')
      .select('is_stylist')
      .eq('id', viewedUserId)
      .single()
      .then(({ data }) => setIsViewedStylist(!!data?.is_stylist));
  }, [viewedUserId]);

  // Load tagged posts when that tab is opened
  useEffect(() => {
    if (activeTab === 'tagged' && isViewedStylist && viewedUserId) {
      setTaggedLoading(true);
      postService.getTaggedPosts(viewedUserId).then(({ data }) => {
        setTaggedPosts(data || []);
        setTaggedLoading(false);
      });
    }
  }, [activeTab, isViewedStylist, viewedUserId]);

  // Load unread notification count for clients (not stylists — they have the dashboard)
  useEffect(() => {
    if (!isOwnProfile || isOwnStylist || !user?.id) return;
    bookingService.getUnreadCount(user.id).then(setUnreadCount);
  }, [isOwnProfile, isOwnStylist, user?.id]);

  // Pre-fetch the user's OWN bookings (as a client) as soon as we know it's
  // their own profile. Always uses getBookingsByUser — the provider dashboard
  // handles the stylist side separately.
  useEffect(() => {
    if (!isOwnProfile || !user?.id) return;
    setBookingsLoading(true);
    bookingService.getBookingsByUser(user.id)
      .then(({ data, error }) => {
        if (error) console.warn('[ProfileTabs] bookings fetch error:', error.message);
        setBookings(data || []);
      })
      .catch((err) => {
        console.warn('[ProfileTabs] bookings fetch threw:', err);
        setBookings([]);
      })
      .finally(() => setBookingsLoading(false));
  }, [isOwnProfile, user?.id]);

  // Check whether the user's hair profile is complete (own profile only)
  const [hairProfileComplete, setHairProfileComplete] = useState(true);
  const checkHairProfileComplete = () => {
    if (!isOwnProfile || !user?.id) return;
    profileService.getProfile(user.id).then(({ data }) => {
      const raw = data?.hair_profiles;
      const hp = Array.isArray(raw) ? raw[0] : raw;
      setHairProfileComplete(!!(hp?.hair_type));
    });
  };
  useEffect(() => { checkHairProfileComplete(); }, [isOwnProfile, user?.id]);
  useEffect(() => navigation.addListener('focus', checkHairProfileComplete), [navigation, isOwnProfile, user?.id]);

  // Mark booking notifications as read when client opens the Bookings tab
  useEffect(() => {
    if (activeTab === 'bookings' && isOwnProfile && !isOwnStylist && user?.id) {
      bookingService.markAllRead(user.id).then(() => setUnreadCount(0));
    }
  }, [activeTab, isOwnProfile, isOwnStylist, user?.id]);

  // ── Booking cancellation handlers ───────────────────────────────────────────

  const openReviewModal = async (booking) => {
    const alreadyReviewed = reviewedBookingIds.has(booking.id)
      || await reviewService.hasReviewedBooking(booking.id);
    if (alreadyReviewed) {
      setReviewedBookingIds(prev => new Set([...prev, booking.id]));
      return; // button will show as "Reviewed" — nothing to open
    }
    setReviewRating(5);
    setReviewText('');
    setReviewModalBooking(booking);
  };

  const handleSubmitReview = async () => {
    if (!reviewModalBooking || !user?.id) return;
    const stylistId = (reviewModalBooking.stylist || reviewModalBooking.stylists || {}).id;
    if (!stylistId) return;
    setReviewSubmitting(true);
    const { error } = await reviewService.submitReview(
      reviewModalBooking.id,
      user.id,
      stylistId,
      reviewRating,
      reviewText,
      reviewModalBooking.service_name,
    );
    setReviewSubmitting(false);
    if (!error) {
      setReviewedBookingIds(prev => new Set([...prev, reviewModalBooking.id]));
      setReviewModalBooking(null);
    }
  };

  const handleCancelPending = async () => {
    if (!selectedBooking) return;
    setBkActionLoading(true);
    setBkActionError(null);
    const { error } = await bookingService.cancelPendingByClient(selectedBooking.id, {
      stylistId: (selectedBooking.stylist || {}).id,
      userId: user?.id,
      serviceName: selectedBooking.service_name,
    });
    setBkActionLoading(false);
    if (error) {
      console.error('[cancelPendingByClient]', JSON.stringify(error));
      setBkActionError(error.message || 'Something went wrong. Please try again.');
    } else {
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, status: 'cancelled' } : b));
      setBkConfirmAction(null);
      setBkActionSuccess('cancel_pending');
    }
  };

  const handleRequestCancellation = async () => {
    if (!selectedBooking) return;
    setBkActionLoading(true);
    setBkActionError(null);
    const { error } = await bookingService.requestCancellation(selectedBooking.id, {
      stylistId: (selectedBooking.stylist || {}).id,
      userId: user?.id,
      serviceName: selectedBooking.service_name,
      appointmentDate: selectedBooking.appointment_date,
    });
    setBkActionLoading(false);
    if (error) {
      console.error('[requestCancellation]', JSON.stringify(error));
      setBkActionError(error.message || 'Something went wrong. Please try again.');
    } else {
      setBookings(prev => prev.map(b => b.id === selectedBooking.id ? { ...b, status: 'cancellation_requested' } : b));
      setBkConfirmAction(null);
      setBkActionSuccess('request_cancel');
    }
  };

  // ── Booking detail modal renderer ────────────────────────────────────────────

  const renderBookingDetailModal = () => {
    // Always derive from live bookings state so UI reflects updates immediately
    const bk = selectedBooking
      ? (bookings.find(b => b.id === selectedBooking.id) || selectedBooking)
      : null;

    const closeBkModal = () => { setSelectedBooking(null); setBkConfirmAction(null); setBkActionSuccess(null); setBkActionError(null); };

    const stylist   = bk?.stylist || {};
    const bkName    = stylist.full_name || stylist.username || 'Stylist';
    const bkAvatar  = stylist.avatar_url;
    const bkInitial = bkName.charAt(0).toUpperCase();
    const bkStatus  = bk?.status?.toLowerCase() || 'upcoming';
    const bkCfg     = STATUS_CONFIG[bkStatus] || STATUS_CONFIG.upcoming;
    const isPending          = bkStatus === 'pending';
    const isActive           = bkStatus === 'upcoming' || bkStatus === 'confirmed';
    const isCancelRequested  = bkStatus === 'cancellation_requested';
    const isCancelled        = bkStatus === 'cancelled';
    const isCompleted        = bkStatus === 'completed';

    return (
      <Modal
        visible={!!bk}
        transparent
        animationType={isWebLayout ? 'fade' : 'slide'}
        onRequestClose={closeBkModal}
      >
        <Pressable
          style={[styles.backdrop, !isWebLayout && styles.bkBackdrop]}
          onPress={closeBkModal}
        >
          <Pressable
            style={[styles.bkDetailCard, isWebLayout && styles.bkDetailCardWeb]}
            onPress={() => {}}
          >
            {/* Drag handle on mobile */}
            {!isWebLayout && <View style={styles.bkDetailHandle} />}

            {/* Header */}
            <View style={[styles.bkDetailHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.bkDetailTitle, { color: colors.text }]}>Booking Details</Text>
              <TouchableOpacity onPress={closeBkModal} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.bkDetailBody}>

              {/* Stylist row */}
              {bk && (
                <View style={styles.bkDetailStylistRow}>
                  {bkAvatar ? (
                    <Image source={{ uri: bkAvatar }} style={styles.bkDetailAvatar} />
                  ) : (
                    <View style={[styles.bkDetailAvatar, styles.bkAvatarPlaceholder, { backgroundColor: colors.primaryLight || '#FDF1EE' }]}>
                      <Text style={[styles.bkAvatarInitial, { color: colors.primary }]}>{bkInitial}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bkDetailStylistName, { color: colors.text }]}>{bkName}</Text>
                    <Text style={[styles.bkDetailServiceName, { color: colors.textSecondary }]}>{bk.service_name}</Text>
                  </View>
                  <View style={[styles.bkStatusPill, { backgroundColor: bkCfg.bg }]}>
                    <View style={[styles.bkStatusDot, { backgroundColor: bkCfg.dot }]} />
                    <Text style={[styles.bkStatusText, { color: bkCfg.text }]}>{bkCfg.label}</Text>
                  </View>
                </View>
              )}

              {/* Date / Time */}
              {bk && (
                <View style={[styles.bkDetailMetaRow, { borderColor: colors.borderLight }]}>
                  <View style={styles.bkDetailMetaItem}>
                    <Icon name="calendar-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.bkDetailMetaText, { color: colors.text }]}>
                      {formatDate(bk.appointment_date) || 'No date set'}
                    </Text>
                  </View>
                  {!!bk.appointment_time && (
                    <View style={styles.bkDetailMetaItem}>
                      <Icon name="time-outline" size={16} color={colors.textMuted} />
                      <Text style={[styles.bkDetailMetaText, { color: colors.text }]}>
                        {formatTime(bk.appointment_time)}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Notes */}
              {!!bk?.notes && (
                <View style={[styles.bkDetailNotesRow, { borderColor: colors.borderLight }]}>
                  <Text style={[styles.bkDetailNotesLabel, { color: colors.textMuted }]}>NOTES</Text>
                  <Text style={[styles.bkDetailNotesText, { color: colors.textSecondary }]}>{bk.notes}</Text>
                </View>
              )}

              {/* ── Success state ────────────────────────────────────────── */}

              {bkActionSuccess === 'request_cancel' && (
                <View style={styles.bkSuccessBox}>
                  <View style={styles.bkSuccessIconWrap}>
                    <Icon name="checkmark" size={22} color="#fff" />
                  </View>
                  <Text style={[styles.bkSuccessTitle, { color: colors.text }]}>Request Received!</Text>
                  <Text style={[styles.bkSuccessSub, { color: colors.textMuted }]}>
                    Your cancellation request has been sent. You'll be notified once the stylist responds.
                  </Text>
                  <TouchableOpacity style={styles.bkSuccessDoneBtn} onPress={closeBkModal}>
                    <Text style={styles.bkSuccessDoneBtnText}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}

              {bkActionSuccess === 'cancel_pending' && (
                <View style={styles.bkSuccessBox}>
                  <View style={[styles.bkSuccessIconWrap, { backgroundColor: '#6B7280' }]}>
                    <Icon name="checkmark" size={22} color="#fff" />
                  </View>
                  <Text style={[styles.bkSuccessTitle, { color: colors.text }]}>Booking Cancelled</Text>
                  <Text style={[styles.bkSuccessSub, { color: colors.textMuted }]}>
                    Your booking request has been cancelled successfully.
                  </Text>
                  <TouchableOpacity style={[styles.bkSuccessDoneBtn, { backgroundColor: colors.border }]} onPress={closeBkModal}>
                    <Text style={[styles.bkSuccessDoneBtnText, { color: colors.text }]}>Done</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Action area ──────────────────────────────────────────── */}

              {!bkActionSuccess && bkConfirmAction === null && (
                <>
                  {isPending && (
                    <TouchableOpacity
                      style={[styles.bkDetailActionBtn, { borderColor: '#EF4444' }]}
                      onPress={() => setBkConfirmAction('cancel_pending')}
                      activeOpacity={0.85}
                    >
                      <Icon name="close-circle-outline" size={18} color="#EF4444" />
                      <Text style={[styles.bkDetailActionBtnText, { color: '#EF4444' }]}>Cancel Booking</Text>
                    </TouchableOpacity>
                  )}

                  {isActive && (
                    <TouchableOpacity
                      style={[styles.bkDetailActionBtn, { borderColor: colors.border }]}
                      onPress={() => setBkConfirmAction('request_cancel')}
                      activeOpacity={0.85}
                    >
                      <Icon name="calendar-clear-outline" size={18} color={colors.textMuted} />
                      <Text style={[styles.bkDetailActionBtnText, { color: colors.text }]}>Request Cancellation</Text>
                    </TouchableOpacity>
                  )}

                  {isCancelRequested && (
                    <View style={[styles.bkInfoBox, { backgroundColor: '#FEF9EC' }]}>
                      <Icon name="hourglass-outline" size={15} color="#92601A" />
                      <Text style={[styles.bkInfoBoxText, { color: '#92601A' }]}>
                        Your cancellation request is awaiting the stylist's review.
                      </Text>
                    </View>
                  )}

                  {isCancelled && (
                    <View style={[styles.bkInfoBox, { backgroundColor: '#F3F4F6' }]}>
                      <Icon name="close-circle-outline" size={15} color="#6B7280" />
                      <Text style={[styles.bkInfoBoxText, { color: '#6B7280' }]}>This booking was cancelled.</Text>
                    </View>
                  )}

                  {isCompleted && (
                    <View style={{ gap: 10 }}>
                      <View style={[styles.bkInfoBox, { backgroundColor: '#ECFDF5' }]}>
                        <Icon name="checkmark-circle-outline" size={15} color="#065F46" />
                        <Text style={[styles.bkInfoBoxText, { color: '#065F46' }]}>This appointment is complete.</Text>
                      </View>
                      {!isOwnProfile && (
                        reviewedBookingIds.has(bk?.id) ? (
                          <View style={[styles.bkInfoBox, { backgroundColor: colors.surfaceAlt }]}>
                            <Icon name="star" size={15} color={colors.primary} />
                            <Text style={[styles.bkInfoBoxText, { color: colors.textSecondary }]}>You've reviewed this appointment.</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={[styles.reviewBtn, { backgroundColor: colors.primary }]}
                            onPress={() => bk && openReviewModal(bk)}
                            activeOpacity={0.8}
                          >
                            <Icon name="star-outline" size={16} color="#fff" />
                            <Text style={styles.reviewBtnText}>Leave a Review</Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  )}
                </>
              )}

              {/* ── Confirm: cancel pending ──────────────────────────────── */}
              {!bkActionSuccess && bkConfirmAction === 'cancel_pending' && (
                <View style={[styles.bkConfirmBox, { borderColor: colors.borderLight }]}>
                  <Text style={[styles.bkConfirmTitle, { color: colors.text }]}>Cancel this booking?</Text>
                  <Text style={[styles.bkConfirmSub, { color: colors.textMuted }]}>
                    Since this request hasn't been accepted yet, it will be cancelled immediately — no stylist approval needed.
                  </Text>
                  {!!bkActionError && (
                    <Text style={styles.bkActionErrorText}>{bkActionError}</Text>
                  )}
                  <View style={styles.bkConfirmBtns}>
                    <TouchableOpacity
                      style={[styles.bkConfirmKeep, { borderColor: colors.border }]}
                      onPress={() => { setBkConfirmAction(null); setBkActionError(null); }}
                      disabled={bkActionLoading}
                    >
                      <Text style={[styles.bkConfirmKeepText, { color: colors.text }]}>Keep It</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.bkConfirmDo}
                      onPress={handleCancelPending}
                      disabled={bkActionLoading}
                    >
                      {bkActionLoading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.bkConfirmDoText}>Yes, Cancel</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── Confirm: request cancellation ───────────────────────── */}
              {!bkActionSuccess && bkConfirmAction === 'request_cancel' && (
                <View style={[styles.bkConfirmBox, { borderColor: colors.borderLight }]}>
                  <Text style={[styles.bkConfirmTitle, { color: colors.text }]}>Request cancellation?</Text>
                  <View style={[styles.bkDisclaimerBox, { borderColor: '#F59E0B44', backgroundColor: '#FEF9EC' }]}>
                    <Icon name="information-circle-outline" size={15} color="#92601A" />
                    <Text style={[styles.bkDisclaimerText, { color: '#92601A' }]}>
                      Cancellation policies vary by stylist. Your appointment stays booked until the stylist reviews and approves — they may decline the request.
                    </Text>
                  </View>
                  {!!bkActionError && (
                    <Text style={styles.bkActionErrorText}>{bkActionError}</Text>
                  )}
                  <View style={styles.bkConfirmBtns}>
                    <TouchableOpacity
                      style={[styles.bkConfirmKeep, { borderColor: colors.border }]}
                      onPress={() => { setBkConfirmAction(null); setBkActionError(null); }}
                      disabled={bkActionLoading}
                    >
                      <Text style={[styles.bkConfirmKeepText, { color: colors.text }]}>Go Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.bkConfirmDo}
                      onPress={handleRequestCancellation}
                      disabled={bkActionLoading}
                    >
                      {bkActionLoading
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={styles.bkConfirmDoText}>Send Request</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              )}

            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

  const SKELETON_POST_HEIGHTS = [200, 240, 170];
  const renderSkeletonMasonry = () => (
    <View style={{ flexDirection: 'row', gap: MASONRY_GAP, marginHorizontal: MASONRY_PAD, marginTop: 12 }}>
      {Array.from({ length: numCols }).map((_, ci) => (
        <View key={ci} style={{ flex: 1, gap: MASONRY_GAP }}>
          <SkeletonPulse style={{ height: SKELETON_POST_HEIGHTS[ci % SKELETON_POST_HEIGHTS.length], borderRadius: MASONRY_RADIUS }} />
          <SkeletonPulse style={{ height: SKELETON_POST_HEIGHTS[(ci + 1) % SKELETON_POST_HEIGHTS.length], borderRadius: MASONRY_RADIUS }} />
        </View>
      ))}
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'posts': {
        const incompleteBanner = isOwnProfile && !hairProfileComplete ? (
          <TouchableOpacity
            style={styles.hairBanner}
            onPress={() => navigation.navigate('FinishHairProfile')}
            activeOpacity={0.85}
          >
            <Text style={styles.hairBannerLabel}>HAIR PROFILE INCOMPLETE</Text>
            <View style={styles.hairBannerBtn}>
              <Text style={styles.hairBannerBtnText}>FINISH NOW</Text>
            </View>
          </TouchableOpacity>
        ) : null;

        if (loading) {
          return (
            <>
              {incompleteBanner}
              {renderSkeletonMasonry()}
            </>
          );
        }
        if (posts.length === 0) {
          return (
            <>
              {incompleteBanner}
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No posts yet</Text>
                <Text style={styles.emptyText}>
                  {isOwnProfile ? 'Share your first hairstyle!' : "This user hasn't posted yet."}
                </Text>
              </View>
            </>
          );
        }
        return (
          <>
            {incompleteBanner}
            {renderMasonryGrid(posts)}
          </>
        );
      }

      case 'tagged':
        if (taggedLoading) {
          return renderSkeletonMasonry();
        }
        if (taggedPosts.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No tagged posts yet</Text>
              <Text style={styles.emptyText}>Posts where this stylist is tagged will appear here</Text>
            </View>
          );
        }
        return renderMasonryGrid(taggedPosts);

      case 'favorites':
        return <SavedLooks />;

      case 'bookings': {
        if (!isOwnProfile) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Private</Text>
              <Text style={styles.emptyText}>Bookings are only visible to the owner</Text>
            </View>
          );
        }
        if (bookingsLoading) {
          return <ActivityIndicator style={{ paddingTop: 60 }} size="large" color={colors.primary} />;
        }
        if (bookings.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptyText}>
                {isOwnStylist ? 'Client bookings will appear here' : 'Book a stylist to see your appointments here'}
              </Text>
            </View>
          );
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // pending + confirmed with future/same-day date → upcoming
        // cancelled / completed, OR confirmed with a past date → past
        const upcoming = bookings.filter(b => {
          const s = b.status?.toLowerCase();
          if (s === 'cancelled' || s === 'completed') return false;
          const d = b.appointment_date ? new Date(b.appointment_date + 'T00:00:00') : null;
          return !d || d >= today;
        });
        const past = bookings.filter(b => {
          const s = b.status?.toLowerCase();
          if (s === 'cancelled' || s === 'completed') return true;
          const d = b.appointment_date ? new Date(b.appointment_date + 'T00:00:00') : null;
          return d && d < today;
        });

        const renderSection = (label, items) => {
          if (!items.length) return null;
          return (
            <View style={styles.bkSection}>
              <Text style={[styles.bkSectionLabel, { color: colors.textMuted }]}>{label}</Text>
              {items.map(b => (
                // Always show the client view — this tab shows YOUR bookings as a client.
                // The provider dashboard handles the stylist-side view separately.
                <ClientBookingCard
                  key={b.id}
                  booking={b}
                  colors={colors}
                  styles={styles}
                  onPress={() => { setSelectedBooking(b); setBkConfirmAction(null); setBkActionSuccess(null); }}
                />
              ))}
            </View>
          );
        };

        return (
          <View style={styles.bookingsList}>
            {renderSection('Upcoming', upcoming)}
            {renderSection('Past', past)}
          </View>
        );
      }

      case 'hair':
        if (!isOwnProfile) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Private</Text>
              <Text style={styles.emptyText}>Hair profile is only visible to the owner</Text>
            </View>
          );
        }
        return (
          <>
            {!hairProfileComplete && (
              <TouchableOpacity
                style={styles.hairBanner}
                onPress={() => navigation.navigate('FinishHairProfile')}
                activeOpacity={0.85}
              >
                <Text style={styles.hairBannerLabel}>HAIR PROFILE INCOMPLETE</Text>
                <View style={styles.hairBannerBtn}>
                  <Text style={styles.hairBannerBtnText}>FINISH NOW</Text>
                </View>
              </TouchableOpacity>
            )}
            <HairProfile viewedUserId={viewedUserId} />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container} onLayout={e => setMeasuredWidth(e.nativeEvent.layout.width)}>
      <View style={styles.tabs}>
        {ALL_TABS.filter((tab) => {
          if (tab.ownOnly && !isOwnProfile) return false;
          if (tab.stylistOnly && !isViewedStylist) return false;
          return true;
        }).map((tab) => {
          const active = activeTab === tab.key;
          const showBadge = tab.key === 'bookings' && !isOwnStylist && unreadCount > 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabText, active && styles.activeTabText]}>
                  {tab.label}
                </Text>
                {tab.lock && (
                  <Icon name="lock-closed" size={12} color={active ? colors.selected : '#9ca3af'} style={{ marginLeft: 3 }} />
                )}
                {showBadge && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </View>
              {active && <View style={styles.activeUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.content}>{renderContent()}</View>

      {/* Booking detail / cancellation modal */}
      {renderBookingDetailModal()}

      {/* Leave a Review modal */}
      <Modal
        visible={!!reviewModalBooking}
        transparent
        animationType="slide"
        onRequestClose={() => setReviewModalBooking(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.backdrop} onPress={() => setReviewModalBooking(null)}>
            <Pressable style={[styles.reviewCard, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <View style={[styles.bkDetailHeader, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.bkDetailTitle, { color: colors.text }]}>Leave a Review</Text>
                <TouchableOpacity onPress={() => setReviewModalBooking(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Icon name="close" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              <View style={styles.reviewBody}>
                <Text style={[styles.reviewServiceLabel, { color: colors.textSecondary }]}>
                  {reviewModalBooking?.service_name || 'Appointment'}
                </Text>

                {/* Crown / star picker */}
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map(n => (
                    <TouchableOpacity key={n} onPress={() => setReviewRating(n)} activeOpacity={0.7} style={styles.ratingBtn}>
                      <Icon
                        name={n <= reviewRating ? 'star' : 'star-outline'}
                        size={32}
                        color={n <= reviewRating ? '#F8B430' : colors.border}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={[styles.reviewInput, { backgroundColor: colors.background ?? colors.surfaceAlt, color: colors.text, borderColor: colors.borderLight }]}
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


      {/* Post detail popup */}
      <Modal
        visible={!!selectedPost}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPost(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => { setSelectedPost(null); setPostCommentsOpen(false); }}>
          <Pressable
            style={[
              styles.popupCard,
              isWebLayout && (postCommentsOpen ? styles.popupCardWebWide : styles.popupCardWeb),
            ]}
            onPress={() => {}}
          >
            <ScrollView ref={postModalScrollRef} showsVerticalScrollIndicator={false} bounces={false} horizontal={false}>
              <PostCard
                post={selectedPost}
                currentUserId={user?.id}
                scrollViewRef={postModalScrollRef}
                onCommentsOpenChange={setPostCommentsOpen}
                onDelete={async (postId, userId) => {
                  const result = await deletePost(postId, userId);
                  if (result?.success) { setSelectedPost(null); setPostCommentsOpen(false); }
                  return result;
                }}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: {},
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
    color: c.textSecondary,
    fontFamily: 'Figtree_500Medium',
  },
  activeTabText: {
    color: c.selected,
    fontFamily: 'Figtree_700Bold',
  },
  activeUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: c.selected,
  },
  // Notification count badge on the Bookings tab
  notifBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    marginLeft: 4,
  },
  notifBadgeText: {
    fontSize: 9,
    fontFamily: 'Figtree_700Bold',
    color: '#fff',
  },
  content: {},

  // Masonry grid (mirrors ExploreScreen's masonry feed — same gap/radius/aspect rules)
  masonryCanvas: {
    position: 'relative',
    marginHorizontal: MASONRY_PAD,
    marginTop: 12,
    marginBottom: 40,
  },
  masonryCard: {
    position: 'absolute',
    borderRadius: MASONRY_RADIUS,
    overflow: 'hidden',
    backgroundColor: c.borderLight,
  },
  // Dark gradient fade behind the frosted-glass stylist tag, bottom-left
  stylistGradient: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '50%' },
  stylistTag: {
    position: 'absolute', bottom: 10, left: 10,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8,
  },
  stylistName: { color: '#fff', fontSize: 12, fontFamily: 'Figtree_500Medium', marginLeft: 4 },
  photoDots: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  photoDotActive: {
    backgroundColor: '#fff',
    width: 6,
    height: 6,
  },

  // Bookings list wrapper
  bookingsList: {
    paddingBottom: 40,
  },

  // ── New booking card styles ──────────────────────────────────────────────────
  bkSection: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
  },
  bkSectionLabel: {
    fontSize: 11,
    fontFamily: 'Figtree_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  bkCard: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 10,
    backgroundColor: c.surface,
  },
  bkTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  bkAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  bkAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bkAvatarInitial: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
  },
  bkStylistName: {
    fontSize: 15,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 2,
  },
  bkServiceName: {
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
  },
  bkStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  bkStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bkStatusText: {
    fontSize: 11,
    fontFamily: 'Figtree_600SemiBold',
  },
  bkMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bkMeta: {
    fontSize: 12,
    fontFamily: 'Figtree_500Medium',
  },
  bkMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
  },
  bkDepositBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#C8835A22',
  },
  bkDepositText: {
    fontSize: 10,
    fontFamily: 'Figtree_600SemiBold',
    color: '#C8835A',
  },

  // ── Booking detail modal ─────────────────────────────────────────────────────
  bkBackdrop: {
    // Mobile: sheet slides up from bottom
    justifyContent: 'flex-end',
    padding: 0,
    paddingTop: 80, // leave a gap at top so it doesn't go full-screen
  },
  bkDetailCard: {
    // Mobile default — bottom sheet
    backgroundColor: c.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    width: '100%',
  },
  bkDetailCardWeb: {
    // Web — centered card
    borderRadius: 20,
    maxWidth: 440,
    width: '100%',
    maxHeight: '80%',
    alignSelf: 'center',
  },
  bkDetailHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  bkDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bkDetailTitle: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
  },
  bkDetailBody: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    gap: 14,
  },
  bkDetailStylistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bkDetailAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  bkDetailStylistName: {
    fontSize: 16,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 2,
  },
  bkDetailServiceName: {
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
  },
  bkDetailMetaRow: {
    flexDirection: 'row',
    gap: 20,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bkDetailMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bkDetailMetaText: {
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
  },
  bkDetailNotesRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  bkDetailNotesLabel: {
    fontSize: 10,
    fontFamily: 'Figtree_700Bold',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  bkDetailNotesText: {
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    lineHeight: 20,
  },
  bkDetailActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4,
  },
  bkDetailActionBtnText: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
  },
  bkInfoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    marginTop: 4,
  },
  bkInfoBoxText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
    lineHeight: 18,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  reviewBtnText: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    color: '#fff',
  },
  reviewCard: {
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 'auto',
  },
  reviewBody: {
    padding: 20,
    gap: 16,
  },
  reviewServiceLabel: {
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
    textAlign: 'center',
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  ratingBtn: {
    padding: 4,
  },
  reviewInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  reviewSubmitBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  reviewSubmitText: {
    fontSize: 15,
    fontFamily: 'Figtree_700Bold',
    color: '#fff',
  },
  bkConfirmBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 10,
    marginTop: 4,
  },
  bkConfirmTitle: {
    fontSize: 15,
    fontFamily: 'Figtree_700Bold',
  },
  bkConfirmSub: {
    fontSize: 13,
    fontFamily: 'Figtree_400Regular',
    lineHeight: 18,
  },
  bkDisclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  bkDisclaimerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Figtree_400Regular',
    lineHeight: 17,
  },
  bkConfirmBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  bkConfirmKeep: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  bkConfirmKeepText: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
  },
  bkConfirmDo: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#EF4444',
  },
  bkConfirmDoText: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    color: '#fff',
  },
  bkActionErrorText: {
    fontSize: 12,
    fontFamily: 'Figtree_500Medium',
    color: '#EF4444',
    textAlign: 'center',
  },

  // Success state
  bkSuccessBox: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 8,
    gap: 10,
  },
  bkSuccessIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  bkSuccessTitle: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
    textAlign: 'center',
  },
  bkSuccessSub: {
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  bkSuccessDoneBtn: {
    marginTop: 8,
    paddingVertical: 13,
    paddingHorizontal: 48,
    borderRadius: 14,
    backgroundColor: '#10B981',
  },
  bkSuccessDoneBtnText: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
    color: '#fff',
  },

  // Hair profile incomplete banner
  hairBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(248,180,48,0.2)',
    borderWidth: 1,
    borderColor: '#F8B430',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  hairBannerLabel: {
    fontSize: 11,
    fontFamily: 'Figtree_700Bold',
    color: '#8A6A3A',
    letterSpacing: 0.5,
    flex: 1,
  },
  hairBannerBtn: {
    backgroundColor: '#F8B430',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginLeft: 10,
  },
  hairBannerBtnText: {
    fontSize: 11,
    fontFamily: 'Figtree_700Bold',
    color: '#8A6A3A',
    letterSpacing: 0.5,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
  },
  emptyText: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  popupCard: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.78,
    backgroundColor: c.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  popupCardWeb: {
    maxWidth: 460,
    maxHeight: SCREEN_HEIGHT * 0.82,
  },
  popupCardWebWide: {
    maxWidth: 800,
    width: '95vw',
    maxHeight: SCREEN_HEIGHT * 0.92,
  },
});
