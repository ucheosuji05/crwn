import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Share,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { postService } from '../services/postService';
import { collectionService } from '../services/collectionService';


export default function PostCard({
  post,
  currentUserId,
  onDelete,
  onBookmarkChange,
  onNavigateToProfile,
  onNavigateToStylist,
  onCommentsOpenChange,
  scrollViewRef,
  initialCommentsOpen = false,
}) {
  const controlsOpacity = useRef(new Animated.Value(0)).current;
  const fadeTimer = useRef(null);
  const carouselRef = useRef(null);
  const commentInputRef = useRef(null);
  const [slideWidth, setSlideWidth] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imgErrors, setImgErrors] = useState({});   // index → true when load fails
  const [menuVisible, setMenuVisible] = useState(false);
  const [commentsExpanded, setCommentsExpanded] = useState(false);
  // Auto-open comments once on mount when navigated from a notification
  const didAutoOpenComments = useRef(false);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // null | { parentId, username }
  const [expandedReplies, setExpandedReplies] = useState({}); // parentId -> { items, total, loading }
  const [commentLiked, setCommentLiked] = useState({}); // commentId -> bool
  const [commentLikeCounts, setCommentLikeCounts] = useState({}); // commentId -> number
  const [replyCounts, setReplyCounts] = useState({}); // commentId -> number
  // Web layout measurements — used to give the comment scroll area an explicit pixel height
  // so it fills exactly the space between the panel header and the input bar.
  const [postColumnHeight, setPostColumnHeight] = useState(0);
  const [webPanelH, setWebPanelH] = useState(0);      // actual height of the web comment panel
  const [cmtHdrH, setCmtHdrH] = useState(50);  // "N Comments" header row height
  const [cmtInputH, setCmtInputH] = useState(56); // input bar height (grows when reply banner shows)
  const [savePickerVisible, setSavePickerVisible] = useState(false);
  const [pickerCollections, setPickerCollections] = useState([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSaving, setPickerSaving] = useState(false);
  const [newCollectionMode, setNewCollectionMode] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');

  const examplePost = {
    id: '1',
    images: ['placeholder.jpg'],
    title: 'Side Part Silk Press',
    description: 'Book with my stylist she never disappoints!',
    profiles: {
      id: 'user1',
      username: 'laila_hunte',
      full_name: 'Laila Hunte',
      avatar_url: null
    },
    created_at: new Date().toISOString(),
    stylists: {
      id: 'stylist1',
      username: 'beautyybyemme',
      business_name: 'Beauty by Emme'
    },
    rating: 5.0,
    likes_count: 306,
    comments_count: 30,
    post_media: []
  };

  const currentPost = post || examplePost;
  
  const { 
    id: postId,
    title,
    description,
    profiles,
    created_at,
    stylists,
    rating,
    likes_count,
    comments_count,
    post_media,
    user_id,
    likes: likesRelation,
    comments: commentsRelation,
  } = currentPost;

  const dbLikesCount = likesRelation?.[0]?.count ?? likes_count ?? 0;
  const dbCommentsCount = commentsRelation?.[0]?.count ?? comments_count ?? 0;

  // Get author info from profiles relation
  const authorId = profiles?.id || user_id;
  const { user, profile: currentUserProfile } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Get stylist info
  const stylistDisplayName = stylists?.full_name || stylists?.username;
  const stylistId = stylists?.id;

  // Calculate time ago
  const getTimeAgo = (dateString) => {
    if (!dateString) return '';
    const now = new Date();
    const postDate = new Date(dateString);
    const diffMs = now - postDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return postDate.toLocaleDateString();
  };

  const timeAgo = getTimeAgo(created_at);

  // Get media items
  const mediaItems = post_media?.map(media => ({ uri: media.media_url })) || [];

  // Check if current user owns this post
  const isOwnPost = currentUserId && (authorId === currentUserId || user_id === currentUserId);

  // For own posts, prefer live AuthContext values so name/avatar update immediately
  // after an EditProfile save (before the feed does a background refetch).
  const authorName = isOwnPost
    ? (currentUserProfile?.full_name || currentUserProfile?.username || profiles?.full_name || profiles?.username || 'Anonymous')
    : (profiles?.full_name || profiles?.username || 'Anonymous');
  const authorUsername = isOwnPost
    ? (currentUserProfile?.username || profiles?.username || 'user')
    : (profiles?.username || 'user');
  const authorAvatar = isOwnPost
    ? (currentUserProfile?.avatar_url ?? profiles?.avatar_url)
    : profiles?.avatar_url;

  // Auto-open comments when arriving from a notification
  useEffect(() => {
    if (initialCommentsOpen && !didAutoOpenComments.current && postId && postId !== '1') {
      didAutoOpenComments.current = true;
      handleOpenComments();
    }
  }, [postId, initialCommentsOpen]);

  // Initialize like/bookmark state and counts from DB
  useEffect(() => {
    if (!user?.id || !postId || postId === '1') return;
    setLikesCount(dbLikesCount);
    postService.hasLiked(user.id, postId).then(({ liked: isLiked }) => {
      setLiked(isLiked);
      // If the user has liked this post but the cached count is 0 (stale data),
      // bump it to at least 1 so an optimistic unlike never goes negative.
      if (isLiked) setLikesCount(c => Math.max(c, 1));
    });
    postService.hasBookmarked(user.id, postId).then(({ bookmarked }) => setBookmarked(bookmarked));
  }, [user?.id, postId]);

  const handleLike = async () => {
    if (!user?.id) return;
    if (liked) {
      setLiked(false);
      setLikesCount(c => Math.max(0, c - 1)); // never go below 0
      await postService.unlikePost(user.id, postId);
    } else {
      setLiked(true);
      setLikesCount(c => c + 1);
      await postService.likePost(user.id, postId);
    }
  };

  const handleBookmark = async () => {
    if (!user?.id) return;
    if (bookmarked) {
      setBookmarked(false);
      await postService.removeBookmark(user.id, postId);
      onBookmarkChange?.(postId, false);
    } else {
      setNewCollectionMode(false);
      setNewCollectionName('');
      setSavePickerVisible(true);
      setPickerLoading(true);
      const { data } = await collectionService.getCollections(user.id);
      setPickerCollections(data || []);
      setPickerLoading(false);
    }
  };

  const handleSaveToCollection = async (collection) => {
    if (!user?.id) return;
    setPickerSaving(true);
    await postService.bookmarkPost(user.id, postId);
    setBookmarked(true);
    if (collection) {
      await collectionService.addPostToCollection(collection.id, postId, user.id);
    }
    setSavePickerVisible(false);
    onBookmarkChange?.(postId, true);
    setPickerSaving(false);
  };

  const handleCreateAndSave = async () => {
    const name = newCollectionName.trim();
    if (!name || !user?.id) return;
    setPickerSaving(true);
    const { data: newColl } = await collectionService.createCollection(user.id, name);
    await postService.bookmarkPost(user.id, postId);
    setBookmarked(true);
    if (newColl) {
      await collectionService.addPostToCollection(newColl.id, postId, user.id);
    }
    setSavePickerVisible(false);
    onBookmarkChange?.(postId, true);
    setPickerSaving(false);
  };

  const isWeb = Platform.OS === 'web';

  const handleOpenComments = async () => {
    if (commentsExpanded) {
      setCommentsExpanded(false);
      onCommentsOpenChange?.(false);
      return;
    }
    setCommentsExpanded(true);
    onCommentsOpenChange?.(true);
    setCommentsLoading(true);
    const { data } = await postService.getComments(postId);
    const topLevel = data || [];
    setComments(topLevel);
    setCommentsLoading(false);
    // Batch-load reply counts + comment likes for all loaded comments
    if (topLevel.length > 0) {
      const ids = topLevel.map(c => c.id);
      const [rcMap, likedIds, lcMap] = await Promise.all([
        postService.getReplyCounts(ids),
        user?.id ? postService.getMyCommentLikes(user.id, ids) : Promise.resolve([]),
        postService.getCommentLikeCounts(ids),
      ]);
      setReplyCounts(prev => ({ ...prev, ...rcMap }));
      const likedMap = {};
      (likedIds || []).forEach(id => { likedMap[id] = true; });
      setCommentLiked(prev => ({ ...prev, ...likedMap }));
      setCommentLikeCounts(prev => ({ ...prev, ...lcMap }));
    }
    // Scroll the modal's ScrollView down to reveal the comments section on mobile
    if (!isWeb) {
      setTimeout(() => scrollViewRef?.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user?.id) return;
    setSubmittingComment(true);
    const parentId = replyingTo?.parentId || null;
    const { data, error } = await postService.addComment(user.id, postId, commentText.trim(), parentId);
    if (error) {
      console.error('Comment insert failed:', JSON.stringify(error));
      Alert.alert('Error', error.message || 'Failed to post comment');
    } else if (data) {
      setCommentText('');
      if (parentId) {
        // Append reply to the expanded thread
        setExpandedReplies(prev => {
          const ex = prev[parentId] || { items: [], total: 0, loading: false };
          return { ...prev, [parentId]: { ...ex, items: [...ex.items, data], total: ex.total + 1 } };
        });
        setReplyCounts(prev => ({ ...prev, [parentId]: (prev[parentId] || 0) + 1 }));
        setReplyingTo(null);
      } else {
        setComments(prev => [...prev, data]);
      }
    }
    setSubmittingComment(false);
  };

  const handleDeleteComment = (commentId, parentId = null) => {
    const doDelete = async () => {
      const { error } = await postService.deleteComment(commentId, user.id);
      if (!error) {
        if (parentId) {
          setExpandedReplies(prev => {
            const ex = prev[parentId];
            if (!ex) return prev;
            return {
              ...prev,
              [parentId]: { ...ex, items: ex.items.filter(r => r.id !== commentId), total: Math.max(0, ex.total - 1) },
            };
          });
          setReplyCounts(prev => ({ ...prev, [parentId]: Math.max(0, (prev[parentId] || 0) - 1) }));
        } else {
          setComments(prev => prev.filter(c => c.id !== commentId));
        }
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this comment?')) doDelete();
    } else {
      Alert.alert('Delete Comment', 'Delete this comment?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleLikeComment = async (commentId) => {
    if (!user?.id) return;
    const isLiked = !!commentLiked[commentId];
    setCommentLiked(prev => ({ ...prev, [commentId]: !isLiked }));
    setCommentLikeCounts(prev => ({
      ...prev,
      [commentId]: Math.max(0, (prev[commentId] || 0) + (isLiked ? -1 : 1)),
    }));
    if (isLiked) {
      await postService.unlikeComment(user.id, commentId);
    } else {
      await postService.likeComment(user.id, commentId);
    }
  };

  const handleToggleReplies = async (parentId) => {
    if (expandedReplies[parentId]) {
      setExpandedReplies(prev => { const n = { ...prev }; delete n[parentId]; return n; });
      return;
    }
    setExpandedReplies(prev => ({ ...prev, [parentId]: { items: [], total: 0, loading: true } }));
    const { data, total } = await postService.getReplies(postId, parentId, 0, 9);
    const items = data || [];
    setExpandedReplies(prev => ({ ...prev, [parentId]: { items, total: total ?? items.length, loading: false } }));
    if (items.length > 0 && user?.id) {
      const ids = items.map(r => r.id);
      const [likedIds, lcMap] = await Promise.all([
        postService.getMyCommentLikes(user.id, ids),
        postService.getCommentLikeCounts(ids),
      ]);
      const likedMap = {};
      (likedIds || []).forEach(id => { likedMap[id] = true; });
      setCommentLiked(prev => ({ ...prev, ...likedMap }));
      setCommentLikeCounts(prev => ({ ...prev, ...lcMap }));
    }
  };

  const handleLoadMoreReplies = async (parentId) => {
    const existing = expandedReplies[parentId];
    if (!existing || existing.loading) return;
    const offset = existing.items.length;
    setExpandedReplies(prev => ({ ...prev, [parentId]: { ...existing, loading: true } }));
    const { data, total } = await postService.getReplies(postId, parentId, offset, 9);
    const newItems = data || [];
    setExpandedReplies(prev => {
      const ex = prev[parentId] || { items: [], total: 0 };
      return { ...prev, [parentId]: { items: [...ex.items, ...newItems], total: total ?? ex.total, loading: false } };
    });
    if (newItems.length > 0 && user?.id) {
      const ids = newItems.map(r => r.id);
      const [likedIds, lcMap] = await Promise.all([
        postService.getMyCommentLikes(user.id, ids),
        postService.getCommentLikeCounts(ids),
      ]);
      const likedMap = {};
      (likedIds || []).forEach(id => { likedMap[id] = true; });
      setCommentLiked(prev => ({ ...prev, ...likedMap }));
      setCommentLikeCounts(prev => ({ ...prev, ...lcMap }));
    }
  };

  const showControls = () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    Animated.timing(controlsOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    fadeTimer.current = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }, 2000);
  };

  const scrollTo = (index) => {
    carouselRef.current?.scrollTo({ x: index * slideWidth, animated: false });
    setCurrentIndex(index);
    showControls();
  };

  const handlePrev = () => scrollTo(Math.max(0, currentIndex - 1));
  const handleNext = () => scrollTo(Math.min(mediaItems.length - 1, currentIndex + 1));

  const handleProfilePress = () => {
    if (onNavigateToProfile && authorId) {
      onNavigateToProfile(authorId);
    }
  };

  const handleStylistPress = () => {
    if (onNavigateToStylist && stylistId) {
      onNavigateToStylist(stylistId);
    }
  };

  const handleMenuPress = () => {
    setMenuVisible(true);
  };

  const handleShare = async () => {
    setMenuVisible(false);
    try {
      await Share.share({
        message: `Check out this style: ${title}\n\nBy @${authorUsername} on CRWN`,
        title: title,
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };


  const performDelete = async () => {
    if (!onDelete) return;
    const result = await onDelete(postId, currentUserId);
    if (!result?.success) {
      if (Platform.OS === 'web') {
        window.alert('Failed to delete post. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to delete post');
      }
    }
  };

  const handleDelete = () => {
    setMenuVisible(false);
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this post? This cannot be undone.')) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Post',
        'Are you sure you want to delete this post? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete },
        ]
      );
    }
  };

  const handleReport = () => {
    setMenuVisible(false);
    Alert.alert('Report', 'This post has been reported for review.');
  };

  // ── Comments panel — shared between mobile inline + web side column ─────────
  const renderCommentItem = (item, isReply = false, parentId = null) => {
    const likeCount = commentLikeCounts[item.id] || 0;
    const isLiked = !!commentLiked[item.id];
    const replyCount = !isReply ? (replyCounts[item.id] || 0) : 0;
    const expanded = !isReply ? expandedReplies[item.id] : null;

    return (
      <View key={item.id} style={[styles.commentItem, isReply && styles.replyItem]}>
        <View style={[
          styles.commentAvatar,
          isReply && styles.replyAvatar,
          { backgroundColor: colors.surfaceAlt || colors.borderLight },
        ]}>
          {item.profiles?.avatar_url ? (
            <Image
              source={{ uri: item.profiles.avatar_url }}
              style={[styles.commentAvatarImg, isReply && styles.replyAvatarImg]}
            />
          ) : (
            <Text style={[styles.commentAvatarInitial, { color: colors.textSecondary }]}>
              {(item.profiles?.username || '?')[0].toUpperCase()}
            </Text>
          )}
        </View>
        <View style={styles.commentBody}>
          <View style={styles.commentBubble}>
            <Text style={[styles.commentUsername, { color: colors.primary }]}>
              @{item.profiles?.username || 'user'}
            </Text>
            <Text style={[styles.commentText, { color: colors.text }]}>{item.content}</Text>
          </View>
          {/* Like + Reply + Delete row */}
          <View style={styles.cmtActionsRow}>
            <TouchableOpacity onPress={() => handleLikeComment(item.id)} style={styles.cmtLikeBtn} activeOpacity={0.7}>
              <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={13} color={isLiked ? '#ef4444' : colors.textMuted} />
              {likeCount > 0 && <Text style={[styles.cmtLikeCount, { color: colors.textMuted }]}>{likeCount}</Text>}
            </TouchableOpacity>
            {!isReply && (
              <TouchableOpacity
                onPress={() => {
                  setReplyingTo({ parentId: item.id, username: item.profiles?.username || 'user' });
                  setTimeout(() => commentInputRef.current?.focus(), 50);
                }}
                style={styles.cmtReplyBtn}
                activeOpacity={0.7}
              >
                <Text style={[styles.cmtReplyText, { color: colors.textMuted }]}>Reply</Text>
              </TouchableOpacity>
            )}
            {item.user_id === user?.id && (
              <TouchableOpacity
                onPress={() => handleDeleteComment(item.id, parentId)}
                style={styles.cmtDeleteBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={12} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {/* View / hide replies toggle (top-level only) */}
          {!isReply && replyCount > 0 && (
            <TouchableOpacity onPress={() => handleToggleReplies(item.id)} style={styles.viewRepliesBtn} activeOpacity={0.7}>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={13} color={colors.primary} />
              <Text style={[styles.viewRepliesText, { color: colors.primary }]}>
                {expanded ? 'Hide replies' : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
              </Text>
            </TouchableOpacity>
          )}
          {/* Expanded replies */}
          {!isReply && expanded && (
            <View style={[styles.repliesContainer, { borderLeftColor: colors.borderLight }]}>
              {expanded.loading && expanded.items.length === 0 ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 8 }} />
              ) : (
                <>
                  {expanded.items.map(reply => renderCommentItem(reply, true, item.id))}
                  {expanded.loading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 6 }} />
                  ) : expanded.items.length < expanded.total ? (
                    <TouchableOpacity onPress={() => handleLoadMoreReplies(item.id)} style={styles.loadMoreRepliesBtn} activeOpacity={0.7}>
                      <Text style={[styles.loadMoreRepliesText, { color: colors.primary }]}>
                        {`Load ${Math.min(9, expanded.total - expanded.items.length)} more ${expanded.total - expanded.items.length === 1 ? 'reply' : 'replies'}`}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const makeCommentsList = (webPanel = false) => {
    // The right panel is given height = postColumnHeight (the left panel's measured height).
    // cmtScrollH fills exactly the space between the header and the input inside that height.
    // postColumnHeight is preferred; webPanelH is a fallback in case the left panel onLayout
    // hasn't fired yet (e.g. very fast comment loads before first layout measurement).
    const panelHeight = postColumnHeight > 0 ? postColumnHeight : webPanelH;
    const cmtScrollH = webPanel && panelHeight > 0
      ? Math.max(0, panelHeight - cmtHdrH - cmtInputH)
      : undefined;

    if (commentsLoading) {
      return <ActivityIndicator style={{ padding: 28 }} color={colors.primary} />;
    }
    if (comments.length === 0) {
      return (
        <View style={[styles.cmtEmptyWrap, webPanel && (cmtScrollH ? { height: cmtScrollH, justifyContent: 'center' } : { flex: 1, justifyContent: 'center' })]}>
          <Ionicons name="chatbubbles-outline" size={32} color={colors.border} style={{ marginBottom: 8 }} />
          <Text style={[styles.noComments, { color: colors.textMuted }]}>No comments yet.</Text>
          <Text style={[styles.noCommentsSub, { color: colors.textMuted }]}>Be the first to comment!</Text>
        </View>
      );
    }
    if (webPanel) {
      // Web side panel: explicit pixel height so the list fills from the
      // "N Comments" header down to the input bar.
      // We deliberately do NOT use styles.inlineCmtList because it has
      // maxHeight: 280 which cannot be overridden via a style array on RN Web.
      return (
        <ScrollView
          style={cmtScrollH ? { height: cmtScrollH } : { flex: 1 }}
          contentContainerStyle={{ paddingBottom: 8 }}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {comments.map(item => renderCommentItem(item, false, null))}
        </ScrollView>
      );
    }
    // Mobile inline: maxHeight caps the list so the feed doesn't blow out
    return (
      <ScrollView
        style={styles.inlineCmtList}
        contentContainerStyle={{ paddingBottom: 8 }}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {comments.map(item => renderCommentItem(item, false, null))}
      </ScrollView>
    );
  };

  const commentsInputRow = (
    <View>
      {replyingTo && (
        <View style={[styles.replyBanner, { backgroundColor: colors.surfaceAlt || colors.borderLight, borderTopColor: colors.borderLight }]}>
          <Text style={[styles.replyBannerText, { color: colors.textSecondary }]} numberOfLines={1}>
            Replying to{' '}
            <Text style={{ color: colors.primary, fontFamily: 'Figtree_600SemiBold' }}>@{replyingTo.username}</Text>
          </Text>
          <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
      <View style={[styles.commentInput, { borderTopColor: colors.borderLight, backgroundColor: colors.surface }]}>
        {/* Current user avatar */}
        {currentUserProfile?.avatar_url ? (
          <Image source={{ uri: currentUserProfile.avatar_url }} style={styles.cmtInputAvatar} />
        ) : (
          <View style={[styles.cmtInputAvatar, styles.cmtInputAvatarPlaceholder, { backgroundColor: colors.primary }]}>
            <Text style={styles.cmtInputAvatarInitial}>
              {(currentUserProfile?.username || user?.email || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <TextInput
          ref={commentInputRef}
          style={[styles.commentTextInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
          placeholder={replyingTo ? `Reply to @${replyingTo.username}…` : 'Add a comment…'}
          placeholderTextColor={colors.placeholder}
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        {/* Send button — always visible, primary colour when text is ready */}
        <TouchableOpacity
          onPress={handleSubmitComment}
          disabled={submittingComment}
          style={[styles.cmtSendBtn, { backgroundColor: commentText.trim() ? colors.primary : colors.border }]}
          activeOpacity={0.75}
        >
          {submittingComment ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={16} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const commentsInput = Platform.OS === 'ios' ? (
    <KeyboardAvoidingView behavior="padding">{commentsInputRow}</KeyboardAvoidingView>
  ) : commentsInputRow;

  // Mobile inline panel
  const mobileCommentsPanel = (
    <View style={[styles.inlineCmtSection, { borderTopColor: colors.borderLight }]}>
      <View style={[styles.inlineCmtHeader, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.inlineCmtTitle, { color: colors.text }]}>
          {comments.length > 0 ? `${comments.length} Comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
        </Text>
      </View>
      {makeCommentsList(false)}
      {commentsInput}
    </View>
  );

  // Web side panel
  const webCommentsPanel = (
    <View
      style={[
        styles.webCmtPanel,
        { backgroundColor: colors.surface, borderLeftColor: colors.borderLight },
        // Explicit height = left panel height so the panel never grows beyond the post.
        // This prevents the left panel from stretching to match an oversized comment list.
        postColumnHeight > 0 && { height: postColumnHeight },
      ]}
      onLayout={(e) => setWebPanelH(e.nativeEvent.layout.height)}
    >
      {/* Panel header — measure its height so we can compute scroll area size */}
      <View
        style={[styles.webCmtPanelHeader, { borderBottomColor: colors.borderLight }]}
        onLayout={(e) => setCmtHdrH(e.nativeEvent.layout.height)}
      >
        <Text style={[styles.webCmtPanelTitle, { color: colors.text }]}>
          {comments.length > 0 ? `${comments.length} Comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
        </Text>
        <TouchableOpacity onPress={() => setCommentsExpanded(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      {makeCommentsList(true)}
      {/* Wrap input so we can measure its height (grows when reply banner is visible) */}
      <View onLayout={(e) => setCmtInputH(e.nativeEvent.layout.height)}>
        {commentsInput}
      </View>
    </View>
  );

  return (
    <View style={[styles.container, isWeb && commentsExpanded && styles.webPostRow]}>
      {/* ── Left / main post section ── */}
      <View
        style={isWeb && commentsExpanded ? styles.webPostLeft : undefined}
        onLayout={(e) => { if (isWeb) setPostColumnHeight(e.nativeEvent.layout.height); }}
      >

      {/* Profile Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.profileInfo}
          onPress={handleProfilePress}
          activeOpacity={0.7}
        >
          {authorAvatar ? (
            <Image 
              source={{ uri: authorAvatar }} 
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>
                {authorName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.authorInfo}>
            <Text style={styles.authorName}>{authorName}</Text>
            <Text style={styles.timeAgo}>{timeAgo}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleMenuPress} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Post Images Carousel */}
      {mediaItems.length > 0 && (
        <View
          style={styles.mediaContainer}
          onLayout={(e) => setSlideWidth(e.nativeEvent.layout.width)}
        >
          <ScrollView
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            bounces={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(
                e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width
              );
              setCurrentIndex(index);
              showControls();
            }}
          >
            {mediaItems.map((item, i) => {
              // Provide explicit pixel dimensions once we know the container width.
              // image style uses aspectRatio:1 as a fallback for the first render.
              const imgSize = slideWidth > 0 ? { width: slideWidth, height: slideWidth } : null;
              const failed  = imgErrors[i];
              return (
                <TouchableOpacity
                  key={`${postId}-slide-${i}`}
                  activeOpacity={1}
                  onPress={showControls}
                  style={[styles.slide, slideWidth ? { width: slideWidth, height: slideWidth } : null]}
                >
                  {failed ? (
                    // Broken-image placeholder
                    <View style={[styles.image, imgSize, styles.imgError]}>
                      <Ionicons name="image-outline" size={36} color={colors.border} />
                    </View>
                  ) : (
                    <Image
                      source={item}
                      style={[styles.image, imgSize]}
                      resizeMode="cover"
                      onError={() => {
                        console.warn('[PostCard] image failed to load:', item?.uri);
                        setImgErrors(prev => ({ ...prev, [i]: true }));
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {mediaItems.length > 1 && (
            <>
              {/* On web keep arrows always visible; on native they fade in on tap */}
              <Animated.View style={[styles.carouselControls, { opacity: isWeb ? 1 : controlsOpacity }]} pointerEvents="box-none">
                <TouchableOpacity
                  style={[styles.arrowBtn, { opacity: currentIndex === 0 ? 0.3 : 1 }]}
                  onPress={handlePrev}
                  disabled={currentIndex === 0}
                >
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </TouchableOpacity>
                <View />
                <TouchableOpacity
                  style={[styles.arrowBtn, { opacity: currentIndex === mediaItems.length - 1 ? 0.3 : 1 }]}
                  onPress={handleNext}
                  disabled={currentIndex === mediaItems.length - 1}
                >
                  <Ionicons name="chevron-forward" size={22} color="#fff" />
                </TouchableOpacity>
              </Animated.View>

              <View style={styles.photoDots} pointerEvents="none">
                {mediaItems.map((_, i) => (
                  <View key={`${postId}-dot-${i}`} style={[styles.photoDot, i === currentIndex && styles.photoDotActive]} />
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        
        <View style={styles.metadata}>
          {stylistDisplayName && (
            <TouchableOpacity style={styles.stylistChip} onPress={handleStylistPress} activeOpacity={0.7}>
              <Ionicons name="cut-outline" size={13} color={colors.primary} />
              <Text style={styles.stylistName}>{stylistDisplayName}</Text>
            </TouchableOpacity>
          )}
          {!!rating && (
            <Text style={styles.rating}>Rating: {rating} stars</Text>
          )}
        </View>

        {description && <Text style={styles.description}>{description}</Text>}

        {currentPost.tags?.length > 0 && (
          <Text style={styles.tagsRow}>
            {currentPost.tags.map(t => `#${t}`).join(' ')}
          </Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={24} color={liked ? "#ef4444" : colors.text} />
          <Text style={styles.actionText}>{likesCount}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={handleOpenComments}>
          <Ionicons name="chatbubble-outline" size={24} color={commentsExpanded ? colors.primary : colors.text} />
          <Text style={[styles.actionText, commentsExpanded && { color: colors.primary }]}>
            {comments.length || dbCommentsCount}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.bookmarkButton]} onPress={handleBookmark}>
          <Ionicons name={bookmarked ? "bookmark" : "bookmark-outline"} size={24} color={bookmarked ? colors.primary : colors.text} />
        </TouchableOpacity>
      </View>

      {/* Mobile: inline comments below actions */}
      {!isWeb && commentsExpanded && mobileCommentsPanel}

      </View>{/* end webPostLeft */}

      {/* Web: comments side panel — input aligns with the actions row */}
      {isWeb && commentsExpanded && webCommentsPanel}

      {/* Post Options Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <View style={styles.menuHandle} />
            
            {/* Share Option - Always visible */}
            <TouchableOpacity style={styles.menuItem} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color={colors.text} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>

            {isOwnPost ? (
              <>
                {/* Delete Option - Only for own posts */}
                <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={handleDelete}>
                  <Ionicons name="trash-outline" size={24} color="#ef4444" />
                  <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Delete Post</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* Report Option - Only for others' posts */
              <TouchableOpacity style={[styles.menuItem, styles.menuItemDanger]} onPress={handleReport}>
                <Ionicons name="flag-outline" size={24} color="#ef4444" />
                <Text style={[styles.menuItemText, styles.menuItemTextDanger]}>Report Post</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity 
              style={[styles.menuItem, styles.cancelButton]} 
              onPress={() => setMenuVisible(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Add-to-collection banner */}
      <Modal
        visible={savePickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSavePickerVisible(false)}
      >
        <Pressable style={styles.savePickerBackdrop} onPress={() => setSavePickerVisible(false)}>
          <Pressable style={styles.savePickerSheet} onPress={() => {}}>
            <View style={styles.savePickerHandle} />
            <Text style={styles.savePickerTitle}>Add to Collection</Text>

            {pickerLoading ? (
              <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.primary} />
            ) : pickerSaving ? (
              <ActivityIndicator style={{ paddingVertical: 20 }} color={colors.primary} />
            ) : newCollectionMode ? (
              /* ── Inline new-collection form ── */
              <View style={styles.newCollForm}>
                <TextInput
                  style={styles.newCollInput}
                  placeholder="Collection name"
                  placeholderTextColor={colors.placeholder}
                  value={newCollectionName}
                  onChangeText={setNewCollectionName}
                  autoFocus
                  maxLength={40}
                  returnKeyType="done"
                  onSubmitEditing={handleCreateAndSave}
                />
                <View style={styles.newCollActions}>
                  <TouchableOpacity
                    style={styles.newCollCancel}
                    onPress={() => { setNewCollectionMode(false); setNewCollectionName(''); }}
                  >
                    <Text style={styles.newCollCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.newCollCreate, !newCollectionName.trim() && { opacity: 0.4 }]}
                    onPress={handleCreateAndSave}
                    disabled={!newCollectionName.trim()}
                  >
                    <Text style={styles.newCollCreateText}>Create & Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              /* ── Collection list ── */
              <ScrollView bounces={false} style={styles.savePickerList}>
                {/* All Saved */}
                <TouchableOpacity
                  style={styles.savePickerRow}
                  onPress={() => handleSaveToCollection(null)}
                  activeOpacity={0.7}
                >
                  <View style={styles.savePickerIcon}>
                    <Ionicons name="bookmark-outline" size={18} color={colors.primary} />
                  </View>
                  <Text style={styles.savePickerRowLabel}>All Saved</Text>
                </TouchableOpacity>

                {/* Existing collections */}
                {pickerCollections.map(col => (
                  <TouchableOpacity
                    key={col.id}
                    style={styles.savePickerRow}
                    onPress={() => handleSaveToCollection(col)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.savePickerIcon}>
                      <Ionicons name="folder-outline" size={18} color={colors.textSecondary} />
                    </View>
                    <Text style={styles.savePickerRowLabel} numberOfLines={1}>{col.name}</Text>
                  </TouchableOpacity>
                ))}

                {/* New collection */}
                <TouchableOpacity
                  style={[styles.savePickerRow, { borderBottomWidth: 0 }]}
                  onPress={() => setNewCollectionMode(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.savePickerIcon}>
                    <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  </View>
                  <Text style={[styles.savePickerRowLabel, { color: colors.primary }]}>New Collection</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>


    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: {
    backgroundColor: c.surface,
    marginBottom: 12
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primary,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Figtree_600SemiBold'
  },
  authorInfo: {
    justifyContent: 'center'
  },
  authorName: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
    marginBottom: 2
  },
  timeAgo: {
    fontSize: 13,
    color: c.textMuted
  },
  mediaContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  slide: {
    width: '100%',
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    // aspectRatio instead of height:'100%' so the image always has a computed
    // height on web even before onLayout fires (CSS height:100% doesn't resolve
    // when the parent only has aspect-ratio without an explicit px height).
    aspectRatio: 1,
    backgroundColor: c.borderLight,
    borderRadius: 12,
  },
  imgError: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  carouselControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDots: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  photoDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  photoDotActive: {
    backgroundColor: '#fff',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8
  },
  title: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 8,
    color: c.text
  },
  metadata: {
    marginBottom: 8
  },
  stylistChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: 'transparent',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 6,
  },
  stylistName: {
    fontSize: 13,
    color: c.primary,
    fontFamily: 'Figtree_600SemiBold',
  },
  rating: {
    fontSize: 14,
    color: c.textSecondary
  },
  description: {
    fontSize: 15,
    color: c.text,
    lineHeight: 20
  },
  tagsRow: {
    fontSize: 13,
    color: c.primary,
    fontFamily: 'Figtree_600SemiBold',
    marginTop: 10,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: c.borderLight
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20
  },
  bookmarkButton: {
    marginLeft: 'auto',
    marginRight: 0
  },
  actionText: {
    marginLeft: 6,
    color: c.text,
    fontSize: 15,
    fontFamily: 'Figtree_500Medium'
  },
  // Menu Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'flex-end'
  },
  menuContainer: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingTop: 12
  },
  menuHandle: {
    width: 40,
    height: 4,
    backgroundColor: c.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight
  },
  menuItemText: {
    fontSize: 16,
    color: c.text,
    marginLeft: 16
  },
  menuItemDanger: {
    borderBottomWidth: 0
  },
  menuItemTextDanger: {
    color: '#ef4444'
  },
  cancelButton: {
    justifyContent: 'center',
    marginTop: 8,
    borderTopWidth: 8,
    borderTopColor: c.borderLight,
    borderBottomWidth: 0
  },
  cancelText: {
    fontSize: 16,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
    textAlign: 'center'
  },
  // ── Inline / side-panel comments ────────────────────────────────────────────
  // Mobile: appears below the actions bar
  inlineCmtSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  // Web: side-by-side — card expands to fit both panels, nothing shrinks or clips
  webPostRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  // Post left: fixed at the same width as the normal single-post modal (460px)
  // so the photo never changes size — comments panel simply extends the card to the right
  webPostLeft: {
    width: 460,
    flexShrink: 0,
    flexGrow: 0,
  },
  // Comments right panel: fixed width, flex column so list fills and input pins to bottom
  // 460 (post) + 320 (panel) = 780px — fits inside the 840px wide modal with room to spare
  // overflow:'hidden' clips content to the explicit height set inline.
  // The three children (header + scroll list + input) are sized to add up to
  // exactly postColumnHeight, so the input always aligns with the actions row.
  webCmtPanel: {
    width: 320,
    flexShrink: 0,
    flexGrow: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    flexDirection: 'column',
    display: 'flex',
    overflow: 'hidden',
  },
  webCmtPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  webCmtPanelTitle: {
    fontSize: 15,
    fontFamily: 'Figtree_700Bold',
  },
  inlineCmtHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  inlineCmtTitle: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
  },
  inlineCmtList: {
    maxHeight: Platform.OS === 'web' ? 360 : 280,
  },
  cmtEmptyWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
  },
  noComments: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
  },
  noCommentsSub: {
    textAlign: 'center',
    fontSize: 13,
    marginTop: 2,
  },
  commentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  commentAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAvatarInitial: {
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
  },
  commentBubble: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: c.surfaceAlt || c.borderLight,
    alignSelf: 'flex-start',
  },
  commentUsername: {
    fontSize: 12,
    fontFamily: 'Figtree_700Bold',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 19,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    paddingRight: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  cmtInputAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    flexShrink: 0,
    overflow: 'hidden',
  },
  cmtInputAvatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cmtInputAvatarInitial: {
    fontSize: 10,
    fontFamily: 'Figtree_700Bold',
    color: '#fff',
  },
  commentTextInput: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
    borderWidth: 1,
  },
  cmtSendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // "Replying to @user" banner above the input
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBannerText: {
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },

  // Comment action row (Like · Reply · Delete)
  cmtActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingLeft: 12,
    gap: 14,
  },
  cmtLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cmtLikeCount: {
    fontSize: 12,
    fontFamily: 'Figtree_500Medium',
  },
  cmtReplyBtn: {},
  cmtReplyText: {
    fontSize: 12,
    fontFamily: 'Figtree_500Medium',
  },
  cmtDeleteBtn: {
    marginLeft: 'auto',
    marginRight: 4,
  },

  // View / hide replies toggle
  viewRepliesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingLeft: 12,
  },
  viewRepliesText: {
    fontSize: 12,
    fontFamily: 'Figtree_600SemiBold',
  },

  // Nested replies container (indented with left border)
  repliesContainer: {
    marginLeft: 12,
    marginTop: 4,
    borderLeftWidth: 2,
    paddingLeft: 8,
  },

  // Reply items (smaller avatar, tighter padding)
  replyItem: {
    paddingHorizontal: 0,
    paddingVertical: 6,
    gap: 8,
  },
  replyAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  replyAvatarImg: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },

  // "Load N more replies" button
  loadMoreRepliesBtn: {
    paddingVertical: 8,
    paddingLeft: 12,
  },
  loadMoreRepliesText: {
    fontSize: 12,
    fontFamily: 'Figtree_600SemiBold',
  },

  // Add-to-collection banner
  savePickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  savePickerSheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    paddingHorizontal: 20,
    maxHeight: 380,
  },
  savePickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  savePickerTitle: {
    fontSize: 15,
    fontFamily: 'Figtree_700Bold',
    color: c.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  savePickerList: {
    marginTop: 4,
  },
  savePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    gap: 12,
  },
  savePickerIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePickerRowLabel: {
    fontSize: 16,
    fontFamily: 'Figtree_500Medium',
    color: c.text,
    flex: 1,
  },
  newCollForm: {
    marginTop: 8,
    gap: 12,
  },
  newCollInput: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: c.text,
    backgroundColor: c.inputBackground,
  },
  newCollActions: {
    flexDirection: 'row',
    gap: 10,
  },
  newCollCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  newCollCancelText: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
    color: c.textSecondary,
  },
  newCollCreate: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: c.primary,
    alignItems: 'center',
  },
  newCollCreateText: {
    fontSize: 15,
    fontFamily: 'Figtree_700Bold',
    color: '#fff',
  },
});