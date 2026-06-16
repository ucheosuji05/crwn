import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Heart } from 'lucide-react-native';
import HashtagText from './HashtagText';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { threadService } from '../services/threadService';

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now - date) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  return date.toLocaleDateString();
}

export default function ThreadCard({ thread, isUpvoted = false, onUpvoteToggle, onPress }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [toggling, setToggling] = useState(false);
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const upvoteCount = Number(thread?.upvotes?.[0]?.count ?? 0);
  const replyCount = Number(thread?.replies?.[0]?.count ?? 0);
  const timeAgo = formatTimeAgo(thread?.created_at);

  const handleUpvote = async () => {
    if (!user || toggling) return;
    setToggling(true);
    const wasUpvoted = isUpvoted;
    onUpvoteToggle?.(thread.id, !wasUpvoted);
    const { error } = wasUpvoted
      ? await threadService.removeThreadUpvote(user.id, thread.id)
      : await threadService.upvoteThread(user.id, thread.id);
    if (error) onUpvoteToggle?.(thread.id, wasUpvoted);
    setToggling(false);
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      {thread?.category ? (
        <View style={styles.tagBubble}>
          <Text style={styles.tagText}>{thread.category}</Text>
        </View>
      ) : null}

      <Text style={styles.title} numberOfLines={2}>{thread?.title}</Text>

      {thread?.body ? (
        <HashtagText text={thread.body} style={styles.preview} numberOfLines={2} />
      ) : null}

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerItem}
          onPress={handleUpvote}
          disabled={toggling || !user}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Heart size={14} color={isUpvoted ? '#D4726E' : '#D1D1D1'} fill={isUpvoted ? '#D4726E' : 'transparent'} />
          <Text style={[styles.footerText, isUpvoted && styles.footerTextActive]}>
            {upvoteCount}
          </Text>
        </TouchableOpacity>

        <Text style={styles.dot}>•</Text>

        <View style={styles.footerItem}>
          <Ionicons name="chatbubble-outline" size={13} color={colors.textMuted} />
          <Text style={styles.footerText}>{replyCount}</Text>
        </View>

        <Text style={styles.dot}>•</Text>

        <Text style={styles.footerText}>{timeAgo}</Text>
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (c) => StyleSheet.create({
  card: {
    backgroundColor: c.card,
    marginHorizontal: 14,
    marginVertical: 8,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    shadowColor: '#000',
    shadowOpacity: c.isDark ? 0 : 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: c.isDark ? 0 : 1,
  },
  tagBubble: {
    alignSelf: 'flex-start',
    backgroundColor: c.borderLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  tagText: {
    fontSize: 12,
    fontFamily: 'Figtree_600SemiBold',
    color: c.textSecondary,
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
    lineHeight: 21,
    marginBottom: 5,
  },
  preview: {
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
    color: c.textSecondary,
    lineHeight: 18,
    marginBottom: 10,
  },
  footer: { flexDirection: 'row', alignItems: 'center' },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 13, fontFamily: 'Figtree_500Medium', color: c.textMuted, marginLeft: 3 },
  footerTextActive: { color: '#D4726E', fontFamily: 'Figtree_600SemiBold' },
  dot: { color: c.border, marginHorizontal: 7, fontSize: 12, fontFamily: 'Figtree_500Medium' },
});
