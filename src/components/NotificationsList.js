import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, Image, FlatList, StyleSheet,
  TouchableOpacity, RefreshControl, ActivityIndicator,
} from 'react-native';
import { webWrap, WEB_MAX_WIDTHS } from '../utils/webLayout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useUnreadCount } from '../context/UnreadCountContext';
import { notificationService } from '../services/notificationService';
import { bookingService } from '../services/bookingService';
import { supabase } from '../config/supabase';
import ScreenHeader from './ScreenHeader';

// ── Type configs ──────────────────────────────────────────────────────────────

const SOCIAL_TYPE_CONFIG = {
  like:    { icon: 'heart',           color: '#ef4444' },
  crown:   { icon: 'star',            color: '#F8B430' },
  comment: { icon: 'chatbubble',      color: null },
  reply:   { icon: 'chatbubble-ellipses', color: null },
  follow:  { icon: 'person-add',      color: null },
};

const BOOKING_TYPE_CONFIG = {
  booking_confirmed:   { icon: 'checkmark-circle', color: '#22c55e', label: 'Confirmed'   },
  booking_declined:    { icon: 'close-circle',      color: '#ef4444', label: 'Declined'    },
  booking_cancelled:   { icon: 'close-circle',      color: '#ef4444', label: 'Cancelled'   },
  booking_rescheduled: { icon: 'calendar',          color: '#f59e0b', label: 'Rescheduled' },
  booking_request:     { icon: 'calendar-outline',  color: '#C8835A', label: 'New Request' },
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
    decrementNotif, decrementBookingNotif,
    clearNotifs, clearBookingNotifs,
  } = useUnreadCount();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);

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

    // Realtime: booking notifications
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
      // Booking: go to the stylist's profile
      if (item.actor?.id) {
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
          navigation.navigate('PostDetail', { postId: item.post_id });
        } else if (item.actor?.id) {
          navigation.navigate('UserProfile', { viewedUserId: item.actor.id });
        }
        break;

      case 'comment':
        // Someone commented on a post → open post with comments expanded
        if (item.post_id) {
          navigation.navigate('PostDetail', { postId: item.post_id, openComments: true });
        } else if (item.thread_id) {
          navigation.navigate('Community', { screen: 'Community', params: { openThreadId: item.thread_id } });
        } else if (item.actor?.id) {
          navigation.navigate('UserProfile', { viewedUserId: item.actor.id });
        }
        break;

      case 'reply':
        // Someone replied to a comment on a post → open post with comments expanded
        if (item.post_id) {
          navigation.navigate('PostDetail', { postId: item.post_id, openComments: true });
        } else if (item.thread_id) {
          navigation.navigate('Community', { openThreadId: item.thread_id });
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
          navigation.navigate('PostDetail', { postId: item.post_id });
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

  // ── Render item ──────────────────────────────────────────────────────────────

  const renderItem = ({ item }) => {
    const isBooking = item._source === 'booking';

    if (isBooking) {
      const cfg = BOOKING_TYPE_CONFIG[item.type] ?? BOOKING_TYPE_CONFIG.booking_confirmed;
      const actorAvatar = item.actor?.avatar_url;
      const actorName   = item.actor?.full_name || item.actor?.username;

      return (
        <TouchableOpacity
          style={[styles.row, !item.is_read && styles.rowUnread]}
          onPress={() => handlePress(item)}
          activeOpacity={0.7}
        >
          {/* Avatar area */}
          <View style={styles.avatarWrap}>
            {actorAvatar ? (
              <Image source={{ uri: actorAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.border }]}>
                <Ionicons name="cut" size={22} color={colors.textMuted} />
              </View>
            )}
            <View style={[styles.badge, { backgroundColor: cfg.color, borderColor: colors.surface }]}>
              <Ionicons name={cfg.icon} size={10} color="#fff" />
            </View>
          </View>

          {/* Text */}
          <View style={styles.textBlock}>
            <Text style={styles.message} numberOfLines={3}>
              <Text style={[styles.actor, { color: cfg.color }]}>{item.title}</Text>
              {item.body ? `\n${item.body}` : ''}
              {actorName ? (
                <Text style={[styles.bookingFrom, { color: colors.textMuted }]}>{`\nFrom ${actorName}`}</Text>
              ) : null}
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
          <View style={[styles.badge, { backgroundColor: cfg.color ?? colors.primary, borderColor: colors.surface }]}>
            <Ionicons name={cfg.icon} size={10} color="#fff" />
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
      data={notifications}
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
        <ScreenHeader
          title="Notifications"
          right={
            unreadCount > 0 ? (
              <TouchableOpacity onPress={handleMarkAllRead}>
                <Text style={styles.markAll}>Mark all read</Text>
              </TouchableOpacity>
            ) : null
          }
        />
        {list}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  safe:    { flex: 1, backgroundColor: c.surface },
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
  bookingFrom:  { fontSize: 12 },
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
