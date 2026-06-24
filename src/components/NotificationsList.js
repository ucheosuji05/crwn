import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, Image, FlatList, StyleSheet, ScrollView,
  TouchableOpacity, Pressable, RefreshControl, ActivityIndicator,
} from 'react-native';
import { webWrap, WEB_MAX_WIDTHS } from '../utils/webLayout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Scissors, UserPlus } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useUnreadCount } from '../context/UnreadCountContext';
import { notificationService } from '../services/notificationService';
import { bookingService } from '../services/bookingService';
import { supabase } from '../config/supabase';
import { HEADER_BAR_HEIGHT } from './ScreenHeader';
import SearchBar from './SearchBar';

// ── Type configs ──────────────────────────────────────────────────────────────

// Shared cream badge background for social notification-type icons
const SOCIAL_BADGE_BG = '#E8DDD0';

const SOCIAL_TYPE_CONFIG = {
  like:    { icon: 'heart',               color: '#F27C7C', iconSize: 9  },
  crown:   { icon: 'star',                color: '#F8B430', iconSize: 11 },
  comment: { icon: 'chatbubble-ellipses', color: '#8E683B', iconSize: 11 },
  reply:   { icon: 'chatbubble-ellipses', color: '#8E683B', iconSize: 11 },
  mention: { icon: 'at',                  color: '#8E683B', iconSize: 11 },
  follow:  { lucideIcon: UserPlus,        color: '#8E683B', iconSize: 11 },
};

const BOOKING_TYPE_CONFIG = {
  booking_confirmed:   { icon: 'checkmark-circle', bg: '#3F523F', title: 'Booking Confirmed' },
  booking_declined:    { icon: 'close-circle',     bg: '#C0392B', title: 'Booking Update' },
  booking_cancelled:   { icon: 'close-circle',     bg: '#C0392B', title: 'Booking Update' },
  booking_rescheduled: { icon: 'calendar',         bg: '#f59e0b', title: 'Booking Update' },
  booking_request:     { icon: 'calendar-outline', bg: '#C8835A', title: 'Booking Update' },
  booking_completed:   { icon: 'ribbon-outline',   bg: '#F8B430', title: 'Booking Update' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function socialActionText(type, actorName) {
  switch (type) {
    case 'like':    return [actorName, 'liked your post'];
    case 'crown':   return [actorName, 'crowned your post'];
    case 'comment': return [actorName, 'commented on your post'];
    case 'reply':   return [actorName, 'replied to your comment'];
    case 'mention': return [actorName, 'mentioned you in a comment'];
    case 'follow':  return [actorName, 'started following you'];
    default:        return [actorName, 'interacted with you'];
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function NotificationsList({ panelMode = false }) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const {
    msgCount, decrementNotif, decrementBookingNotif,
    clearNotifs, clearBookingNotifs,
  } = useUnreadCount();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [searchOpen, setSearchOpen]       = useState(false);
  const [query, setQuery]                 = useState('');
  const [notifFilter, setNotifFilter]     = useState('All');

  // ── Fetch + merge both feeds ─────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    const [socialRes, bookingRes] = await Promise.all([
      notificationService.getNotifications(user.id),
      bookingService.getBookingNotifications(user.id),
    ]);
    const social  = (socialRes.data  || []).map(n => ({ ...n, _source: 'social'  }));
    const booking = (bookingRes.data || []).map(n => ({ ...n, _source: 'booking' }));
    const merged  = [...social, ...booking].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
    setNotifications(merged);
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications().finally(() => setLoading(false));

    // Realtime: social notifications
    const socialChannel = notificationService.subscribeToNotifications(user?.id, (payload) => {
      if (payload.new) {
        setNotifications(prev => [{ ...payload.new, _source: 'social' }, ...prev]);
      }
    });

    // Realtime: booking + social UPDATE/DELETE (read-state changes, deletions)
    const bookingChannel = supabase
      .channel(`notif_list_booking:${user?.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'booking_notifications',
        filter: `user_id=eq.${user?.id}`,
      }, (payload) => {
        if (payload.new) {
          setNotifications(prev => [{ ...payload.new, _source: 'booking' }, ...prev]);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'booking_notifications',
        filter: `user_id=eq.${user?.id}`,
      }, (payload) => {
        if (payload.new) {
          setNotifications(prev =>
            prev.map(n => n._source === 'booking' && n.id === payload.new.id
              ? { ...n, ...payload.new }
              : n
            )
          );
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'booking_notifications',
        filter: `user_id=eq.${user?.id}`,
      }, (payload) => {
        if (payload.old?.id) {
          setNotifications(prev =>
            prev.filter(n => !(n._source === 'booking' && n.id === payload.old.id))
          );
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`,
      }, (payload) => {
        if (payload.new) {
          setNotifications(prev =>
            prev.map(n => n._source === 'social' && n.id === payload.new.id
              ? { ...n, ...payload.new }
              : n
            )
          );
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`,
      }, (payload) => {
        if (payload.old?.id) {
          setNotifications(prev =>
            prev.filter(n => !(n._source === 'social' && n.id === payload.old.id))
          );
        }
      })
      .subscribe();

    return () => {
      socialChannel?.unsubscribe?.();
      bookingChannel?.unsubscribe?.();
    };
  }, [fetchNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  // ── Tap handler ──────────────────────────────────────────────────────────────

  const handlePress = async (item) => {
    // Mark as read (optimistic)
    if (!item.is_read) {
      setNotifications(prev =>
        prev.map(n => n.id === item.id ? { ...n, is_read: true } : n)
      );
      if (item._source === 'social') {
        notificationService.markAsRead(item.id);
        decrementNotif();
      } else {
        bookingService.markBookingNotificationRead(item.id);
        decrementBookingNotif();
      }
    }

    // ── Deep-link navigation ──────────────────────────────────────────────────

    if (item._source === 'booking') {
      if (item.type === 'booking_completed' && item.actor?.id) {
        // Take client straight to the stylist's Reviews tab to leave a review
        navigation.navigate('StylistProfile', { stylist: { id: item.actor.id }, initialTab: 'Reviews' });
      } else if (item.actor?.id) {
        navigation.navigate('StylistProfile', { stylist: { id: item.actor.id } });
      }
      return;
    }

    // Social notifications
    switch (item.type) {
      case 'like':
      case 'crown':
        // Someone liked/crowned a post → open that post
        if (item.post_id) {
          navigation.push('PostDetail', { postId: item.post_id });
        } else if (item.actor?.id) {
          navigation.navigate('UserProfile', { viewedUserId: item.actor.id });
        }
        break;

      case 'comment':
        // Someone commented on a post → open post with comments expanded
        if (item.post_id) {
          navigation.push('PostDetail', { postId: item.post_id, openComments: true });
        } else if (item.thread_id) {
          navigation.navigate('Community', { screen: 'Community', params: { openThreadId: item.thread_id } });
        } else if (item.actor?.id) {
          navigation.navigate('UserProfile', { viewedUserId: item.actor.id });
        }
        break;

      case 'reply':
        // Someone replied to a comment on a post → open post with comments expanded
        if (item.post_id) {
          navigation.push('PostDetail', { postId: item.post_id, openComments: true });
        } else if (item.thread_id) {
          navigation.navigate('Community', { openThreadId: item.thread_id });
        } else if (item.actor?.id) {
          navigation.navigate('UserProfile', { viewedUserId: item.actor.id });
        }
        break;

      case 'mention':
        // Someone mentioned you in a comment → open that post with comments expanded
        if (item.post_id) {
          navigation.push('PostDetail', { postId: item.post_id, openComments: true });
        } else if (item.actor?.id) {
          navigation.navigate('UserProfile', { viewedUserId: item.actor.id });
        }
        break;

      case 'follow':
        // Someone followed you → open their profile
        if (item.actor?.id) {
          navigation.navigate('UserProfile', { viewedUserId: item.actor.id });
        }
        break;

      default:
        // Fallback: open actor profile or the post if we have one
        if (item.post_id) {
          navigation.push('PostDetail', { postId: item.post_id });
        } else if (item.actor?.id) {
          navigation.navigate('UserProfile', { viewedUserId: item.actor.id });
        }
    }
  };

  // ── Mark all read ────────────────────────────────────────────────────────────

  const handleMarkAllRead = async () => {
    await Promise.all([
      notificationService.markAllAsRead(user.id),
      bookingService.markAllRead(user.id),
    ]);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    clearNotifs();
    clearBookingNotifs();
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  // ── Search ───────────────────────────────────────────────────────────────────

  const NOTIF_FILTERS = ['All', 'Likes', 'Comments', 'Follows', 'Bookings'];

  const toggleSearch = () => {
    if (searchOpen) { setQuery(''); setNotifFilter('All'); }
    setSearchOpen(prev => !prev);
  };

  const filteredNotifications = useMemo(() => {
    let list = notifications;

    if (notifFilter !== 'All') {
      const typeMap = {
        Likes:    n => n.type === 'like' || n.type === 'crown',
        Comments: n => n.type === 'comment' || n.type === 'reply',
        Follows:  n => n.type === 'follow',
        Bookings: n => n._source === 'booking',
      };
      list = list.filter(typeMap[notifFilter] ?? (() => true));
    }

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(n => {
      const actorName = (n.actor?.username || n.actor?.full_name || '').toLowerCase();
      const text = `${n.title || ''} ${n.body || ''}`.toLowerCase();
      return actorName.includes(q) || text.includes(q);
    });
  }, [notifications, query, notifFilter]);

  // ── Render item ──────────────────────────────────────────────────────────────

  const renderItem = ({ item }) => {
    const isBooking = item._source === 'booking';

    if (isBooking) {
      const cfg = BOOKING_TYPE_CONFIG[item.type] ?? BOOKING_TYPE_CONFIG.booking_confirmed;
      const actorHandle = item.actor?.username ? `@${item.actor.username}` : item.actor?.full_name;

      return (
        <TouchableOpacity
          style={[styles.row, !item.is_read && styles.rowUnread]}
          onPress={() => handlePress(item)}
          activeOpacity={0.7}
        >
          {/* Icon area — booking notifications always show the scissors icon, not a profile photo */}
          <View style={styles.avatarWrap}>
            <View style={[styles.avatarPlaceholder, { backgroundColor: SOCIAL_BADGE_BG }]}>
              <Scissors size={22} color="#5D1F1F" strokeWidth={1.5} />
            </View>
            <View style={[styles.badge, { backgroundColor: cfg.bg, borderColor: '#fff' }]}>
              <Ionicons name={cfg.icon} size={12} color="#fff" />
            </View>
          </View>

          {/* Text */}
          <View style={styles.textBlock}>
            <Text style={styles.message} numberOfLines={3}>
              <Text style={styles.bookingTitle}>{cfg.title}</Text>
              {actorHandle ? <Text style={styles.bookingWith}>{` with ${actorHandle}`}</Text> : null}
              {item.body ? `\n${item.body}` : ''}
            </Text>
            <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
          </View>

          {/* Right spacer */}
          <View style={styles.thumbnailSpacer} />

          {!item.is_read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      );
    }

    // ── Social notification ────────────────────────────────────────────────────
    const cfg = SOCIAL_TYPE_CONFIG[item.type] || SOCIAL_TYPE_CONFIG.like;
    const actorName = item.actor?.username
      ? `@${item.actor.username}`
      : item.actor?.full_name || 'Someone';
    const [actor, action] = socialActionText(item.type, actorName);
    const showThumbnail = item.type !== 'follow' && item.post_thumbnail;

    return (
      <TouchableOpacity
        style={[styles.row, !item.is_read && styles.rowUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrap}>
          {item.actor?.avatar_url ? (
            <Image source={{ uri: item.actor.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
              <Ionicons name="person" size={22} color={colors.textMuted} />
            </View>
          )}
          <View style={[styles.badge, { backgroundColor: SOCIAL_BADGE_BG, borderColor: '#fff' }]}>
            {cfg.lucideIcon ? (
              <cfg.lucideIcon size={cfg.iconSize} color={cfg.color} strokeWidth={2} />
            ) : (
              <Ionicons name={cfg.icon} size={cfg.iconSize} color={cfg.color} />
            )}
          </View>
        </View>

        <View style={styles.textBlock}>
          <Text style={styles.message} numberOfLines={2}>
            <Text style={styles.actor}>{actor}</Text>
            {'  '}{action}
          </Text>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>

        {showThumbnail ? (
          <Image source={{ uri: item.post_thumbnail }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailSpacer} />
        )}

        {!item.is_read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  // ── Layout ───────────────────────────────────────────────────────────────────

  const list = (
    <FlatList
      data={filteredNotifications}
      keyExtractor={item => `${item._source ?? 'n'}-${item.id}`}
      renderItem={renderItem}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      }
      contentContainerStyle={notifications.length === 0 && styles.emptyContainer}
    />
  );

  if (loading) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: colors.surface }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // Panel mode: bare list, no header/SafeAreaView/webWrap
  if (panelMode) {
    return <View style={{ flex: 1 }}>{list}</View>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[{ flex: 1 }, webWrap(WEB_MAX_WIDTHS.feed)]}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerIcon}
            onPress={toggleSearch}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={searchOpen ? 'close-outline' : 'search-outline'} size={22} color={colors.text} />
          </Pressable>

          <Text style={styles.headerTitle} pointerEvents="none">Notifications</Text>

          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.navigate('Messaging')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="mail-outline" size={22} color={colors.text} />
            {msgCount > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeCountText}>
                  {msgCount > 9 ? '9+' : msgCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {searchOpen && (
          <View style={styles.searchPanel}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search notifications" autoFocus />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {NOTIF_FILTERS.map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, notifFilter === f && styles.filterChipActive]}
                  onPress={() => setNotifFilter(f)}
                >
                  <Text style={[styles.filterChipText, notifFilter === f && styles.filterChipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {list}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.surface },

  // ── Header ──
  header: {
    height: HEADER_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
    backgroundColor: c.surface,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'LibreBaskerville_700Bold',
    color: c.text,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  headerIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  badgeCount: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeCountText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Figtree_700Bold',
    lineHeight: 12,
  },
  searchPanel: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
    backgroundColor: c.surface,
  },
  filterRow: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  filterChipActive: {
    backgroundColor: c.selected,
    borderColor: c.selected,
  },
  filterChipText: {
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
    color: c.textSecondary,
  },
  filterChipTextActive: {
    color: c.isDark ? '#111' : '#fff',
    fontFamily: 'Figtree_600SemiBold',
  },

  markAllRow: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
  },
  markAll: { fontSize: 13, color: c.primary, fontFamily: 'Figtree_600SemiBold' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    backgroundColor: c.surface,
    gap: 12,
  },
  rowUnread: { backgroundColor: c.unread },

  avatarWrap:        { position: 'relative', width: 52, height: 52 },
  avatar:            { width: 52, height: 52, borderRadius: 26, backgroundColor: c.border },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', bottom: 0, left: 0,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },

  textBlock:    { flex: 1 },
  message:      { fontSize: 14, color: c.text, lineHeight: 19, marginBottom: 3 },
  actor:        { fontFamily: 'Figtree_700Bold', color: c.primary },
  bookingTitle: { fontFamily: 'Figtree_700Bold', color: '#5D1F1F' },
  bookingWith:  { color: '#5D1F1F' },
  time:         { fontSize: 12, color: c.textMuted },

  thumbnail:       { width: 48, height: 48, borderRadius: 8, backgroundColor: c.border },
  thumbnailSpacer: { width: 48 },

  unreadDot: {
    position: 'absolute',
    right: 12,
    top: '50%',
    marginTop: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.primary,
  },

  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyContainer: { flex: 1 },
  emptyText:      { fontSize: 15, color: c.textMuted },
});
