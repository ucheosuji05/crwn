import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { threadService } from '../services/threadService';
import { useTheme } from '../context/ThemeContext';

const BRAND  = '#5D1F1F';
const HONEY  = '#C9963A';
const CHAMPA = '#FAFAFA';
const NEST_LINE = '#E5DDD5';

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const now  = new Date();
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

// ─── Build reply tree from flat array ────────────────────────────────────────

function buildTree(flat) {
  const map = {};
  flat.forEach(r => { map[r.id] = { ...r, children: [] }; });
  const roots = [];
  flat.forEach(r => {
    if (r.parent_id && map[r.parent_id]) {
      map[r.parent_id].children.push(map[r.id]);
    } else {
      roots.push(map[r.id]);
    }
  });
  return roots;
}

// ─── ReplyNode ────────────────────────────────────────────────────────────────

function ReplyNode({
  reply, depth = 0,
  upvotedIds, onUpvoteToggle,
  currentUserId, onDelete,
  newReplyId, highlightAnim,
  onReply,
  styles, colors,
}) {
  const [toggling, setToggling] = useState(false);
  const isNew    = reply.id === newReplyId;
  const isOwner  = reply.user_id === currentUserId;
  const isUpvoted = upvotedIds.has(reply.id);
  const upvotes  = Number(reply?.upvotes?.[0]?.count ?? 0);
  const author   = reply?.profiles?.username || 'Anonymous';

  const handleUpvote = async () => {
    if (!currentUserId || toggling) return;
    setToggling(true);
    const was = isUpvoted;
    onUpvoteToggle(reply.id, !was);
    const { error } = was
      ? await threadService.removeReplyUpvote(currentUserId, reply.id)
      : await threadService.upvoteReply(currentUserId, reply.id);
    if (error) onUpvoteToggle(reply.id, was);
    setToggling(false);
  };

  const handleDelete = () => {
    Alert.alert('Delete reply', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(reply.id) },
    ]);
  };

  const cardContent = (
    <View style={[styles.replyCard, depth > 0 && styles.replyCardNested]}>
      <View style={styles.replyHeader}>
        <Text style={styles.replyAuthor}>@{author}</Text>
        <View style={styles.replyHeaderRight}>
          <Text style={styles.replyTime}>{formatTimeAgo(reply?.created_at)}</Text>
          {isOwner && (
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn}>
              <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Text style={styles.replyBody}>{reply?.body}</Text>

      <View style={styles.replyFooter}>
        <TouchableOpacity
          style={styles.replyUpvote}
          onPress={handleUpvote}
          disabled={toggling || !currentUserId}
        >
          <Ionicons name={isUpvoted ? 'heart' : 'heart-outline'} size={14} color={HONEY} />
          <Text style={[styles.replyUpvoteText, isUpvoted && styles.replyUpvoteActive]}>
            {upvotes}
          </Text>
        </TouchableOpacity>

        {currentUserId && (
          <TouchableOpacity onPress={() => onReply({ id: reply.id, author })}>
            <Text style={styles.replyLink}>Reply</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View>
      {isNew ? (
        <Animated.View style={[styles.highlightWrap, { opacity: highlightAnim, backgroundColor: CHAMPA }]}>
          {cardContent}
        </Animated.View>
      ) : (
        cardContent
      )}

      {/* Nested children */}
      {reply.children?.length > 0 && (
        <View style={[styles.nestedBlock, depth === 0 ? styles.nestedBlockRoot : styles.nestedBlockDeep]}>
          {reply.children.map(child => (
            <ReplyNode
              key={child.id}
              reply={child}
              depth={depth + 1}
              upvotedIds={upvotedIds}
              onUpvoteToggle={onUpvoteToggle}
              currentUserId={currentUserId}
              onDelete={onDelete}
              newReplyId={newReplyId}
              highlightAnim={highlightAnim}
              onReply={onReply}
              styles={styles}
              colors={colors}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── ThreadDetailScreen ───────────────────────────────────────────────────────

export default function ThreadDetailScreen({
  thread,
  isThreadUpvoted = false,
  onThreadUpvoteToggle,
  onBack,
  onThreadDeleted,
}) {
  const { user }   = useAuth();
  const { colors } = useTheme();
  const styles     = useMemo(() => makeStyles(colors), [colors]);

  const [replies, setReplies]                 = useState([]);
  const [upvotedReplyIds, setUpvotedReplyIds] = useState(new Set());
  const [loadingReplies, setLoadingReplies]   = useState(true);
  const [replyText, setReplyText]             = useState('');
  const [posting, setPosting]                 = useState(false);
  const [toggling, setToggling]               = useState(false);
  const [replyingTo, setReplyingTo]           = useState(null); // { id, author }
  const [newReplyId, setNewReplyId]           = useState(null);

  const toastOpacity   = useRef(new Animated.Value(0)).current;
  const highlightAnim  = useRef(new Animated.Value(1)).current;
  const highlightTimer = useRef(null);
  const inputRef       = useRef(null);

  const replyTree = useMemo(() => buildTree(replies), [replies]);

  // ── Fetch replies ──────────────────────────────────────────────────────────

  const fetchReplies = useCallback(async () => {
    if (!thread?.id) return;
    setLoadingReplies(true);
    const [repliesResult, upvotesResult] = await Promise.all([
      threadService.getReplies(thread.id),
      user
        ? threadService.getUpvotedReplyIds(user.id, thread.id)
        : Promise.resolve({ ids: [] }),
    ]);
    if (!repliesResult.error) setReplies(repliesResult.data || []);
    setUpvotedReplyIds(new Set(upvotesResult.ids || []));
    setLoadingReplies(false);
  }, [thread?.id, user]);

  useEffect(() => { fetchReplies(); }, [fetchReplies]);

  useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current); }, []);

  // ── Toast helpers ──────────────────────────────────────────────────────────

  const showToast = () => {
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(toastOpacity, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  };

  const startHighlightFade = (id) => {
    setNewReplyId(id);
    highlightAnim.setValue(1);
    highlightTimer.current = setTimeout(() => {
      Animated.timing(highlightAnim, { toValue: 0, duration: 800, useNativeDriver: true }).start(() => {
        setNewReplyId(null);
        highlightAnim.setValue(1);
      });
    }, 10000);
  };

  // ── Thread upvote ──────────────────────────────────────────────────────────

  const handleThreadUpvote = async () => {
    if (!user || toggling) return;
    setToggling(true);
    const was = isThreadUpvoted;
    onThreadUpvoteToggle?.(thread.id, !was);
    const { error } = was
      ? await threadService.removeThreadUpvote(user.id, thread.id)
      : await threadService.upvoteThread(user.id, thread.id);
    if (error) onThreadUpvoteToggle?.(thread.id, was);
    setToggling(false);
  };

  // ── Reply upvote ───────────────────────────────────────────────────────────

  const handleReplyUpvoteToggle = (replyId, isNowUpvoted) => {
    setUpvotedReplyIds(prev => {
      const next = new Set(prev);
      if (isNowUpvoted) next.add(replyId); else next.delete(replyId);
      return next;
    });
    setReplies(prev => prev.map(r => {
      if (r.id !== replyId) return r;
      const c = Number(r.upvotes?.[0]?.count ?? 0);
      return { ...r, upvotes: [{ count: isNowUpvoted ? c + 1 : c - 1 }] };
    }));
  };

  // ── Post reply ─────────────────────────────────────────────────────────────

  const handlePostReply = async () => {
    if (!replyText.trim() || !user || posting) return;
    setPosting(true);

    let { data, error } = await threadService.createReply(
      user.id,
      thread.id,
      replyText.trim(),
      replyingTo?.id ?? null,
    );

    // If parent_id column doesn't exist yet, retry without it
    if (error && error.message?.includes('parent_id')) {
      console.warn('parent_id column missing — run DB migration. Retrying without it.');
      ({ data, error } = await threadService.createReply(user.id, thread.id, replyText.trim()));
    }

    if (error) {
      console.error('createReply error:', error);
      Alert.alert('Error', 'Could not post your reply. Please try again.');
    } else if (data) {
      setReplies(prev => [...prev, data]);
      setReplyText('');
      setReplyingTo(null);
      showToast();
      startHighlightFade(data.id);
    }
    setPosting(false);
  };

  // ── Handle "Reply" tap on a reply ──────────────────────────────────────────

  const handleReplyTo = ({ id, author }) => {
    setReplyingTo({ id, author });
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDeleteReply = async (replyId) => {
    if (!user) return;
    const { error } = await threadService.deleteReply(replyId, user.id);
    if (!error) setReplies(prev => prev.filter(r => r.id !== replyId));
  };

  const handleDeleteThread = () => {
    Alert.alert('Delete discussion', 'This will permanently delete your post and all replies.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await threadService.deleteThread(thread.id, user.id);
          if (error) Alert.alert('Error', 'Could not delete the discussion. Please try again.');
          else onThreadDeleted?.(thread.id);
        },
      },
    ]);
  };

  const upvoteCount = Number(thread?.upvotes?.[0]?.count ?? 0);
  const author      = thread?.profiles?.username || 'Anonymous';

  if (!thread) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          {thread.user_id === user?.id && (
            <TouchableOpacity onPress={handleDeleteThread} style={styles.backBtn}>
              <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Toast ── */}
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <View style={styles.toastInner}>
            <View style={styles.toastCheck}>
              <Ionicons name="checkmark" size={13} color="#fff" />
            </View>
            <Text style={styles.toastText}>Your comment was posted</Text>
          </View>
        </Animated.View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Thread post ── */}
          <View style={styles.post}>
            <View style={styles.postMeta}>
              <Text style={styles.postAuthor}>@{author}</Text>
              {thread.category ? (
                <View style={styles.categoryTag}>
                  <Text style={styles.categoryTagText}>{thread.category}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.postTitle}>{thread.title}</Text>
            <Text style={styles.postBody}>{thread.body}</Text>
            <View style={styles.postFooter}>
              <TouchableOpacity
                style={styles.footerItem}
                onPress={handleThreadUpvote}
                disabled={toggling || !user}
              >
                <Ionicons
                  name={isThreadUpvoted ? 'heart' : 'heart-outline'}
                  size={15}
                  color={HONEY}
                />
                <Text style={[styles.footerText, isThreadUpvoted && styles.footerTextActive]}>
                  {upvoteCount}
                </Text>
              </TouchableOpacity>
              <Text style={styles.dot}>•</Text>
              <Text style={styles.footerText}>{formatTimeAgo(thread.created_at)}</Text>
            </View>
          </View>

          {/* ── Replies ── */}
          <View style={styles.divider} />
          <View style={styles.repliesSection}>
            <Text style={styles.repliesHeading}>
              {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
            </Text>

            {loadingReplies ? (
              <ActivityIndicator color={BRAND} style={{ marginTop: 24 }} />
            ) : replies.length === 0 ? (
              <Text style={styles.noReplies}>Be the first to reply!</Text>
            ) : (
              replyTree.map(r => (
                <ReplyNode
                  key={r.id}
                  reply={r}
                  depth={0}
                  upvotedIds={upvotedReplyIds}
                  onUpvoteToggle={handleReplyUpvoteToggle}
                  currentUserId={user?.id}
                  onDelete={handleDeleteReply}
                  newReplyId={newReplyId}
                  highlightAnim={highlightAnim}
                  onReply={handleReplyTo}
                  styles={styles}
                  colors={colors}
                />
              ))
            )}
          </View>
        </ScrollView>

        {/* ── Reply input bar ── */}
        <View style={styles.inputBar}>
          {replyingTo && (
            <View style={styles.replyingToRow}>
              <Text style={styles.replyingToText}>Replying to @{replyingTo.author}</Text>
              <TouchableOpacity onPress={() => setReplyingTo(null)}>
                <Ionicons name="close" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder={user ? 'Add your reply...' : 'Sign in to reply'}
              placeholderTextColor={colors.placeholder}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              editable={!!user}
            />
            <TouchableOpacity
              style={[styles.postBtn, (!replyText.trim() || !user || posting) && styles.postBtnDisabled]}
              onPress={handlePostReply}
              disabled={!replyText.trim() || !user || posting}
            >
              {posting
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.postBtnText}>Post</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.surface },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0ece8',
    backgroundColor: c.surface,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingBottom: 20 },

  // ── Toast ──
  toast: {
    position: 'absolute',
    top: 12,
    left: 0, right: 0,
    alignItems: 'center',
    zIndex: 999,
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2018',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  toastCheck: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#5D1F1F',
    alignItems: 'center', justifyContent: 'center',
  },
  toastText: { fontSize: 13, color: '#fff', fontFamily: 'Figtree_500Medium' },

  // ── Thread post ──
  post: {
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: '#f0ece8',
  },
  postMeta: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 10,
  },
  postAuthor: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: HONEY },
  categoryTag: { backgroundColor: '#f5f0eb', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  categoryTagText: { fontSize: 11, color: '#9c6b3c', fontFamily: 'Figtree_500Medium' },
  postTitle: { fontSize: 19, fontFamily: 'Figtree_700Bold', color: c.text, lineHeight: 26, marginBottom: 10 },
  postBody: { fontSize: 14, color: c.textSecondary, lineHeight: 21, marginBottom: 16 },
  postFooter: { flexDirection: 'row', alignItems: 'center' },
  footerItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  footerText: { fontSize: 13, color: c.textMuted, marginLeft: 3 },
  footerTextActive: { color: HONEY, fontFamily: 'Figtree_600SemiBold' },
  dot: { color: c.border, marginHorizontal: 8, fontSize: 12 },
  divider: { height: 1, backgroundColor: '#f0ece8' },

  // ── Replies section ──
  repliesSection: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12 },
  repliesHeading: { fontSize: 15, fontFamily: 'Figtree_700Bold', color: c.text, marginBottom: 4 },
  noReplies: { color: c.textMuted, fontSize: 14, marginTop: 20, textAlign: 'center' },

  // ── Reply card ──
  replyCard: {
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
  },
  replyCardNested: {
    borderTopWidth: 0,
    paddingTop: 12,
  },
  highlightWrap: {
    borderRadius: 10,
    marginHorizontal: -4,
    paddingHorizontal: 4,
  },
  replyHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  replyHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyAuthor: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: HONEY },
  replyTime: { fontSize: 11, color: c.textMuted },
  deleteBtn: { padding: 2 },
  replyBody: { fontSize: 14, color: c.text, lineHeight: 20, marginBottom: 10 },
  replyFooter: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  replyUpvote: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  replyUpvoteText: { fontSize: 13, color: c.textMuted, marginLeft: 3 },
  replyUpvoteActive: { color: HONEY, fontFamily: 'Figtree_600SemiBold' },
  replyLink: { fontSize: 13, color: c.textMuted, fontFamily: 'Figtree_500Medium' },

  // ── Nesting ──
  nestedBlock: {
    marginLeft: 16,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: NEST_LINE,
    marginTop: 2,
    marginBottom: 4,
  },
  nestedBlockRoot: {
    marginLeft: 0,
    paddingLeft: 16,
  },
  nestedBlockDeep: {
    marginLeft: 8,
    paddingLeft: 10,
  },

  // ── Replying-to chip ──
  replyingToRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingTop: 6, paddingBottom: 2,
  },
  replyingToText: { fontSize: 12, color: c.textMuted, fontFamily: 'Figtree_400Regular' },

  // ── Input bar ──
  inputBar: {
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: '#f0ece8',
    paddingBottom: 10,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingTop: 10, gap: 10,
  },
  input: {
    flex: 1, backgroundColor: '#f5f0eb', borderRadius: 22,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 14, color: c.text, maxHeight: 100,
  },
  postBtn: {
    backgroundColor: BRAND, borderRadius: 22,
    paddingHorizontal: 18, paddingVertical: 10,
    minWidth: 56, alignItems: 'center',
  },
  postBtnDisabled: { backgroundColor: '#ccc' },
  postBtnText: { color: '#fff', fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
});
