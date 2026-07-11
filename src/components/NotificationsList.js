import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, Image, FlatList, StyleSheet, ScrollView,
  TouchableOpacity, Pressable, RefreshControl, ActivityIndicator,
} from 'react-native';
import { webWrap, WEB_MAX_WIDTHS } from '../utils/webLayout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { UserPlus, Check, X } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useUnreadCount } from '../context/UnreadCountContext';
import { useBlock } from '../context/BlockContext';
import { notificationService } from '../services/notificationService';
import { bookingService } from '../services/bookingService';
import { supabase } from '../config/supabase';
import { HEADER_BAR_HEIGHT } from './ScreenHeader';
import SearchBar from './SearchBar';

// ── Type configs ──────────────────────────────────────────────────────────────
// `bg` is a light tint of `color`, used behind the type icon on the right of
// each notification row — e.g. light pink for likes, light Burnt Ochre for
// follows/bookings.

const SOCIAL_TYPE_CONFIG = {
  like:    { icon: 'heart',               color: '#D4726E', bg: '#FAEAEA', title: 'New Like'     },
  crown:   { icon: 'star',                color: '#F8B430', bg: '#FFF7E3', title: 'New Crown'    },
  comment: { icon: 'chatbubble-ellipses', color: '#8E683B', bg: '#F3EDE3', title: 'New Comment'  },
  reply:   { icon: 'chatbubble-ellipses', color: '#8E683B', bg: '#F3EDE3', title: 'New Reply'    },
  mention: { icon: 'at',                  color: '#8E683B', bg: '#F3EDE3', title: 'New Mention'  },
  follow:  { lucideIcon: UserPlus,        color: '#4F4032', bg: '#EDE5D8', title: 'New Follower' },
};

const BOOKING_TYPE_CONFIG = {
  booking_confirmed:   { lucideIcon: Check,        color: '#3F523F', bg: '#E8F0E8', title: 'Booking Confirmed' },
  booking_declined:    { lucideIcon: X,             color: '#A0522D', bg: '#F5E8E8', title: 'Booking Update'    },
  booking_cancelled:   { lucideIcon: X,             color: '#A0522D', bg: '#F5E8E8', title: 'Booking Update'    },
  booking_rescheduled: { icon: 'calendar',         color: '#F59E0B', bg: '#FEF9EC', title: 'Booking Update'    },
  booking_request:     { icon: 'calendar-outline', color: '#C8835A', bg: '#FDF1EE', title: 'Booking Update'    },
  booking_completed:   { icon: 'ribbon-outline',   color: '#F8B430', bg: '#FFF7E3', title: 'Booking Update'    },
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
  const { allHiddenIds } = useBlock();
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

    // Realtime: social notifications (skip if the actor is blocked)
    const socialChannel = notificationService.subscribeToNotifications(user?.id, (payload) => {
      if (payload.new && !allHiddenIds.has(payload.new.actor?.id)) {
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
    // Hide all notifications from blocked users
    let list = notifications.filter(n => !allHiddenIds.has(n.actor?.id));

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

    // Shared consistent layout: avatar (left) — title/subtitle/time (center)
    // — type icon in a tinted circle (right). See "Booking Withdrawn" in the
    // stylist Notifications screen for the reference pattern.
    let cfg, title, subtitle;
    if (isBooking) {
      cfg = BOOKING_TYPE_CONFIG[item.type] ?? BOOKING_TYPE_CONFIG.booking_confirmed;
      const actorHandle = item.actor?.username ? `@${item.actor.username}` : item.actor?.full_name;
      title = cfg.title;
      subtitle = item.body || (actorHandle ? `With ${actorHandle}` : 'Tap to view details');
    } else {
      cfg = SOCIAL_TYPE_CONFIG[item.type] || SOCIAL_TYPE_CONFIG.like;
      const actorName = item.actor?.username
        ? `@${item.actor.username}`
        : item.actor?.full_name || 'Someone';
      const [actor, action] = socialActionText(item.type, actorName);
      title = cfg.title;
      subtitle = `${actor} ${action}`;
    }

    return (
      <TouchableOpacity
        style={[styles.row, !item.is_read && styles.rowUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        {/* Left: profile picture of the user who triggered the notification */}
        {item.actor?.avatar_url ? (
          <Image source={{ uri: item.actor.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name="person" size={22} color={colors.textMuted} />
          </View>
        )}

        {/* Center: title, subtitle/detail, relative timestamp */}
        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {!item.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
          <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
        </View>

        {/* Right: category icon in a light tint of its semantic color */}
        <View style={[styles.typeIconCircle, { backgroundColor: cfg.bg }]}>
          {cfg.lucideIcon ? (
            <cfg.lucideIcon size={16} color={cfg.color} strokeWidth={2} />
          ) : (
            <Ionicons name={cfg.icon} size={16} color={cfg.color} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // ── Layout ───────────────────────────────────────────────────────────────────

  const list = (
    <FlatList
      data={filteredNotifications}
      keyExtractor={item => `${item._source ?? 'n'}-${item.id}`}
      renderItem={renderItem}
      style={{ flex: 1 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      }
      contentContainerStyle={filteredNotifications.length === 0 && styles.emptyContainer}
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
          {searchOpen ? (
            <View style={styles.headerIcon} />
          ) : (
            <Pressable
              style={styles.headerIcon}
              onPress={toggleSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="search-outline" size={22} color={colors.text} />
            </Pressable>
          )}

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
            <View style={styles.searchRow}>
              <Pressable
                style={styles.searchToggleBtn}
                onPress={toggleSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-outline" size={22} color={colors.text} />
              </Pressable>
              <View style={styles.searchBarWrap}>
                <SearchBar
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search notifications"
                  autoFocus
                  containerStyle={styles.searchBarInner}
                />
              </View>
            </View>
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
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
    backgroundColor: c.surface,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
  },
  searchToggleBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBarWrap: { flex: 1 },
  searchBarInner: {
    marginLeft: 6,
    marginRight: 14,
    marginVertical: 0,
  },
  filterRow: {
    paddingLeft: 10,
    paddingRight: 16,
    paddingVertical: 0,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterChip: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: c.inputBackground,
  },
  filterChipActive: {
    backgroundColor: c.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    color: c.textSecondary,
  },
  filterChipTextActive: {
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    color: '#fff',
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

  avatar:            { width: 52, height: 52, borderRadius: 26, backgroundColor: c.border, flexShrink: 0 },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  textBlock: { flex: 1 },
  titleRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  title:     { fontSize: 14, fontFamily: 'Figtree_700Bold', color: c.text, flexShrink: 1 },
  subtitle:  { fontSize: 13, color: c.textMuted, lineHeight: 18, marginBottom: 3 },
  time:      { fontSize: 12, color: c.textMuted },

  typeIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.primary,
    flexShrink: 0,
  },

  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyContainer: { flex: 1 },
  emptyText:      { fontSize: 15, color: c.textMuted },
});
