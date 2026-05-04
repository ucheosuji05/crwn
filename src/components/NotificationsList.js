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
import ScreenHeader from './ScreenHeader';

const TYPE_CONFIG = {
  like:    { icon: 'heart',      color: '#ef4444' },
  crown:   { icon: 'star',       color: '#F8B430' },
  comment: { icon: 'chatbubble', color: null },
  follow:  { icon: 'person-add', color: null },
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60)    return `${diff}s ago`;
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function actionText(type, actorName) {
  switch (type) {
    case 'like':    return [actorName, 'liked your post'];
    case 'crown':   return [actorName, 'crowned your post'];
    case 'comment': return [actorName, 'commented on your post'];
    case 'follow':  return [actorName, 'started following you'];
    default:        return [actorName, 'interacted with you'];
  }
}

export default function NotificationsList({ panelMode = false }) {
  const { user } = useAuth();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { decrementNotif, clearNotifs } = useUnreadCount();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await notificationService.getNotifications(user.id);
    setNotifications(data || []);
  }, [user?.id]);

  useEffect(() => {
    fetchNotifications().finally(() => setLoading(false));
    const channel = notificationService.subscribeToNotifications(user?.id, (payload) => {
      if (payload.new) setNotifications((prev) => [payload.new, ...prev]);
    });
    return () => { channel?.unsubscribe?.(); };
  }, [fetchNotifications]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  };

  const handlePress = async (item) => {
    if (!item.is_read) {
      await notificationService.markAsRead(item.id);
      setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
      decrementNotif();
    }
    if (item.actor?.id) navigation.navigate('UserProfile', { viewedUserId: item.actor.id });
  };

  const handleMarkAllRead = async () => {
    await notificationService.markAllAsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    clearNotifs();
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const renderItem = ({ item }) => {
    const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.like;
    const actorName = item.actor?.username ? `@${item.actor.username}` : item.actor?.full_name || 'Someone';
    const [actor, action] = actionText(item.type, actorName);
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

  const list = (
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name="notifications-outline" size={52} color={colors.border} />
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

  // Panel mode: bare list, no header/SafeAreaView/webWrap — parent panel owns the chrome
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

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.surface },
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
  avatarWrap: { position: 'relative', width: 52, height: 52 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: c.border },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute', bottom: 0, left: 0,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2,
  },
  textBlock: { flex: 1 },
  message: { fontSize: 14, color: c.text, lineHeight: 19, marginBottom: 3 },
  actor: { fontFamily: 'Figtree_700Bold', color: c.primary },
  time: { fontSize: 12, color: c.textMuted },
  thumbnail: { width: 48, height: 48, borderRadius: 8, backgroundColor: c.border },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyContainer: { flex: 1 },
  emptyText: { fontSize: 15, color: c.textMuted },
});
