import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, Image, StyleSheet, TouchableOpacity,
  ScrollView, Modal, Alert, Share, Pressable,
  TextInput, KeyboardAvoidingView, Platform,
  ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Scissors } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { postService } from '../services/postService';
import { collectionService } from '../services/collectionService';

const MAROON  = '#5D1F1F';
const OCHRE   = '#B35D2B';
const CHAMPAGNE = '#E8E2D9';
const CARD_H_MARGIN = 16; // card sits 16px from each screen edge

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COMMENTS_SHEET_HEIGHT = SCREEN_H * 0.5;

function getTimeAgo(dateString) {
  if (!dateString) return '';
  const diffMs   = Date.now() - new Date(dateString).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs  = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHrs  / 24);
  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs  < 24) return `${diffHrs}h ago`;
  if (diffDays < 7)  return `${diffDays}d ago`;
  return new Date(dateString).toLocaleDateString();
}

export default function PostDetailScreen({ route, navigation }) {
  const { postId, openComments = false } = route?.params ?? {};

  const goBack = () => navigation.goBack();

  const { colors } = useTheme();
  const { user, profile: currentUserProfile } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const scrollRef       = useRef(null);
  const carouselRef     = useRef(null);
  const commentInputRef = useRef(null);
  const lastTapTime     = useRef(0);
  const heartAnim       = useRef(new Animated.Value(0)).current;
  const sheetAnim       = useRef(new Animated.Value(0)).current;

  // Post & loading
  const [post,      setPost]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [notFound,  setNotFound]  = useState(false);
  const [deleting,  setDeleting]  = useState(false);

  // Carousel
  const [slideWidth,    setSlideWidth]    = useState(SCREEN_W - CARD_H_MARGIN * 2);
  const [currentIndex,  setCurrentIndex]  = useState(0);
  const [imgErrors,     setImgErrors]     = useState({});

  // Engagement
  const [liked,      setLiked]      = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [bookmarked, setBookmarked] = useState(false);

  // Menu
  const [menuVisible, setMenuVisible] = useState(false);

  // Collection picker
  const [savePickerVisible,  setSavePickerVisible]  = useState(false);
  const [pickerCollections,  setPickerCollections]  = useState([]);
  const [pickerLoading,      setPickerLoading]      = useState(false);
  const [pickerSaving,       setPickerSaving]       = useState(false);
  const [newCollectionMode,  setNewCollectionMode]  = useState(false);
  const [newCollectionName,  setNewCollectionName]  = useState('');

  // Comments
  const [comments,         setComments]         = useState([]);
  const [commentsLoading,  setCommentsLoading]  = useState(false);
  const [commentText,      setCommentText]      = useState('');
  const [submitting,       setSubmitting]       = useState(false);
  const [replyingTo,       setReplyingTo]       = useState(null); // { parentId, username }
  const [expandedReplies,  setExpandedReplies]  = useState({});
  const [commentLiked,     setCommentLiked]     = useState({});
  const [commentLikeCounts, setCommentLikeCounts] = useState({});
  const [replyCounts,      setReplyCounts]      = useState({});
  const [commentsSheetVisible, setCommentsSheetVisible] = useState(false);

  // ── Comments bottom sheet ────────────────────────────────────────────────────
  const openCommentsSheet = () => {
    setCommentsSheetVisible(true);
    sheetAnim.setValue(0);
    Animated.timing(sheetAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  };
  const closeCommentsSheet = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
      setCommentsSheetVisible(false);
      setReplyingTo(null);
    });
  };

  // ── Load post ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!postId) { setLoading(false); setNotFound(true); return; }
    postService.getPostById(postId).then(({ data }) => {
      if (data) setPost(data);
      else      setNotFound(true);
      setLoading(false);
    });
  }, [postId]);

  // ── Load likes / bookmark state ──────────────────────────────────────────────
  useEffect(() => {
    if (!post?.id || !user?.id) return;
    const dbLikes = post.likes?.[0]?.count ?? post.likes_count ?? 0;
    setLikesCount(dbLikes);
    postService.hasLiked(user.id, post.id).then(({ liked: isLiked }) => {
      setLiked(isLiked);
      if (isLiked) setLikesCount(c => Math.max(c, 1));
    });
    postService.hasBookmarked(user.id, post.id).then(({ bookmarked: bm }) => setBookmarked(bm));
  }, [post?.id, user?.id]);

  // ── Load comments ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!post?.id) return;
    setCommentsLoading(true);
    postService.getComments(post.id).then(async ({ data }) => {
      const top = data || [];
      setComments(top);
      setCommentsLoading(false);
      if (top.length > 0 && user?.id) {
        const ids = top.map(c => c.id);
        const [rcMap, likedIds, lcMap] = await Promise.all([
          postService.getReplyCounts(ids),
          postService.getMyCommentLikes(user.id, ids),
          postService.getCommentLikeCounts(ids),
        ]);
        setReplyCounts(rcMap);
        const lm = {};
        (likedIds || []).forEach(id => { lm[id] = true; });
        setCommentLiked(lm);
        setCommentLikeCounts(lcMap);
      }
    });
  }, [post?.id, user?.id]);

  // Auto-open the comments sheet when navigated from a notification
  useEffect(() => {
    if (openComments && post?.id) {
      setTimeout(() => openCommentsSheet(), 400);
    }
  }, [openComments, post?.id]);

  // ── Derived values ───────────────────────────────────────────────────────────
  const isOwnPost     = user?.id && (post?.user_id === user.id || post?.profiles?.id === user.id);
  const authorId      = post?.profiles?.id || post?.user_id;
  const authorName    = isOwnPost
    ? (currentUserProfile?.full_name || currentUserProfile?.username || post?.profiles?.full_name || 'Anonymous')
    : (post?.profiles?.full_name || post?.profiles?.username || 'Anonymous');
  const authorUsername = isOwnPost
    ? (currentUserProfile?.username || post?.profiles?.username || 'user')
    : (post?.profiles?.username || 'user');
  const authorAvatar  = isOwnPost
    ? (currentUserProfile?.avatar_url ?? post?.profiles?.avatar_url)
    : post?.profiles?.avatar_url;
  const stylistName   = post?.stylists?.full_name || post?.stylists?.username;
  const stylistId     = post?.stylists?.id;
  const mediaItems    = post?.post_media?.map(m => ({ uri: m.media_url })) || [];
  const dbCommentCount = post?.comments?.[0]?.count ?? post?.comments_count ?? 0;
  const timeAgo       = getTimeAgo(post?.created_at);

  // ── Like ─────────────────────────────────────────────────────────────────────
  const handleLike = async () => {
    if (!user?.id) return;
    if (liked) {
      setLiked(false);
      setLikesCount(c => Math.max(0, c - 1));
      await postService.unlikePost(user.id, post.id);
    } else {
      setLiked(true);
      setLikesCount(c => c + 1);
      await postService.likePost(user.id, post.id);
    }
  };

  // Double-tap image → like + heart animation
  const handleImageTap = () => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      if (!liked) handleLike();
      heartAnim.setValue(0);
      Animated.sequence([
        Animated.spring(heartAnim, { toValue: 1, useNativeDriver: true, friction: 3, tension: 40 }),
        Animated.delay(500),
        Animated.timing(heartAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    }
    lastTapTime.current = now;
  };

  // ── Bookmark ─────────────────────────────────────────────────────────────────
  const handleBookmark = async () => {
    if (!user?.id) return;
    if (bookmarked) {
      setBookmarked(false);
      await postService.removeBookmark(user.id, post.id);
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
    await postService.bookmarkPost(user.id, post.id);
    setBookmarked(true);
    if (collection) await collectionService.addPostToCollection(collection.id, post.id, user.id);
    setSavePickerVisible(false);
    setPickerSaving(false);
  };

  const handleCreateAndSave = async () => {
    const name = newCollectionName.trim();
    if (!name || !user?.id) return;
    setPickerSaving(true);
    const { data: newColl } = await collectionService.createCollection(user.id, name);
    await postService.bookmarkPost(user.id, post.id);
    setBookmarked(true);
    if (newColl) await collectionService.addPostToCollection(newColl.id, post.id, user.id);
    setSavePickerVisible(false);
    setPickerSaving(false);
  };

  // ── Menu actions ─────────────────────────────────────────────────────────────
  const handleShare = async () => {
    setMenuVisible(false);
    try {
      await Share.share({ message: `Check out this style: ${post?.title}\n\nBy @${authorUsername} on CRWN`, title: post?.title });
    } catch (_) {}
  };

  const handleDelete = () => {
    setMenuVisible(false);
    const doDelete = async () => {
      setDeleting(true);
      const { error } = await postService.deletePost(post.id);
      setDeleting(false);
      if (error) Alert.alert('Error', 'Failed to delete post');
      else goBack();
    };
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this post? This cannot be undone.')) doDelete();
    } else {
      Alert.alert('Delete Post', 'Are you sure? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleReport = () => {
    setMenuVisible(false);
    Alert.alert('Report', 'This post has been reported for review.');
  };

  // ── Comments ─────────────────────────────────────────────────────────────────
  const handleSubmitComment = async () => {
    if (!commentText.trim() || !user?.id) return;
    setSubmitting(true);
    const parentId = replyingTo?.parentId || null;
    const { data, error } = await postService.addComment(user.id, post.id, commentText.trim(), parentId);
    if (error) {
      Alert.alert('Error', error.message || 'Failed to post comment');
    } else if (data) {
      setCommentText('');
      if (parentId) {
        setExpandedReplies(prev => {
          const ex = prev[parentId] || { items: [], total: 0, loading: false };
          if (ex.items.some(r => r.id === data.id)) return prev;
          return { ...prev, [parentId]: { ...ex, items: [...ex.items, data], total: ex.total + 1 } };
        });
        setReplyCounts(prev => ({ ...prev, [parentId]: (prev[parentId] || 0) + 1 }));
        setReplyingTo(null);
      } else {
        setComments(prev => prev.some(c => c.id === data.id) ? prev : [...prev, data]);
      }
    }
    setSubmitting(false);
  };

  const handleDeleteComment = (commentId, parentId = null) => {
    const doDelete = async () => {
      const { error } = await postService.deleteComment(commentId, user.id);
      if (!error) {
        if (parentId) {
          setExpandedReplies(prev => {
            const ex = prev[parentId];
            if (!ex) return prev;
            return { ...prev, [parentId]: { ...ex, items: ex.items.filter(r => r.id !== commentId), total: Math.max(0, ex.total - 1) } };
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
    setCommentLikeCounts(prev => ({ ...prev, [commentId]: Math.max(0, (prev[commentId] || 0) + (isLiked ? -1 : 1)) }));
    if (isLiked) await postService.unlikeComment(user.id, commentId);
    else         await postService.likeComment(user.id, commentId);
  };

  const handleToggleReplies = async (parentId) => {
    if (expandedReplies[parentId]) {
      setExpandedReplies(prev => { const n = { ...prev }; delete n[parentId]; return n; });
      return;
    }
    setExpandedReplies(prev => ({ ...prev, [parentId]: { items: [], total: 0, loading: true } }));
    const { data, total } = await postService.getReplies(post.id, parentId, 0, 9);
    const items = data || [];
    setExpandedReplies(prev => ({ ...prev, [parentId]: { items, total: total ?? items.length, loading: false } }));
    if (items.length > 0 && user?.id) {
      const ids = items.map(r => r.id);
      const [likedIds, lcMap] = await Promise.all([
        postService.getMyCommentLikes(user.id, ids),
        postService.getCommentLikeCounts(ids),
      ]);
      const lm = {};
      (likedIds || []).forEach(id => { lm[id] = true; });
      setCommentLiked(prev => ({ ...prev, ...lm }));
      setCommentLikeCounts(prev => ({ ...prev, ...lcMap }));
    }
  };

  const handleLoadMoreReplies = async (parentId) => {
    const existing = expandedReplies[parentId];
    if (!existing || existing.loading) return;
    setExpandedReplies(prev => ({ ...prev, [parentId]: { ...existing, loading: true } }));
    const { data, total } = await postService.getReplies(post.id, parentId, existing.items.length, 9);
    const newItems = data || [];
    setExpandedReplies(prev => {
      const ex = prev[parentId] || { items: [], total: 0 };
      const seen = new Set(ex.items.map(r => r.id));
      return { ...prev, [parentId]: { items: [...ex.items, ...newItems.filter(r => !seen.has(r.id))], total: total ?? ex.total, loading: false } };
    });
    if (newItems.length > 0 && user?.id) {
      const ids = newItems.map(r => r.id);
      const [likedIds, lcMap] = await Promise.all([
        postService.getMyCommentLikes(user.id, ids),
        postService.getCommentLikeCounts(ids),
      ]);
      const lm = {};
      (likedIds || []).forEach(id => { lm[id] = true; });
      setCommentLiked(prev => ({ ...prev, ...lm }));
      setCommentLikeCounts(prev => ({ ...prev, ...lcMap }));
    }
  };

  // ── Render a comment (or reply) card ─────────────────────────────────────────
  const renderComment = (item, isReply = false, parentId = null) => {
    const likeCount  = commentLikeCounts[item.id] || 0;
    const isLiked    = !!commentLiked[item.id];
    const replyCount = !isReply ? (replyCounts[item.id] || 0) : 0;
    const expanded   = !isReply ? expandedReplies[item.id] : null;

    return (
      <View key={`cmt-${item.id}`} style={[styles.commentCard, isReply && styles.replyCard]}>
        <View style={styles.cmtRow}>
          {/* Avatar */}
          <View style={styles.cmtAvatar}>
            {item.profiles?.avatar_url
              ? <Image source={{ uri: item.profiles.avatar_url }} style={styles.cmtAvatarImg} />
              : <Text style={styles.cmtAvatarInitial}>{(item.profiles?.username || '?')[0].toUpperCase()}</Text>
            }
          </View>

          <View style={{ flex: 1 }}>
            {/* Username + delete */}
            <View style={styles.cmtHeaderRow}>
              <Text style={styles.cmtUsername}>@{item.profiles?.username || 'user'}</Text>
              {item.user_id === user?.id && (
                <TouchableOpacity onPress={() => handleDeleteComment(item.id, parentId)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="trash-outline" size={13} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.cmtText, { color: colors.text }]}>{item.content}</Text>

            {/* Like · Reply */}
            <View style={styles.cmtActions}>
              <TouchableOpacity onPress={() => handleLikeComment(item.id)} style={styles.cmtActionBtn} activeOpacity={0.7}>
                <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={13} color={isLiked ? '#F27C7C' : colors.textMuted} />
                {likeCount > 0 && <Text style={[styles.cmtMeta, { color: isLiked ? '#F27C7C' : colors.textMuted }]}>{likeCount}</Text>}
              </TouchableOpacity>
              {!isReply && (
                <TouchableOpacity
                  onPress={() => {
                    setReplyingTo({ parentId: item.id, username: item.profiles?.username || 'user' });
                    setTimeout(() => commentInputRef.current?.focus(), 50);
                  }}
                  style={styles.cmtActionBtn}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.cmtMeta, { color: colors.textMuted }]}>Reply</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* View / hide replies toggle */}
            {!isReply && replyCount > 0 && (
              <TouchableOpacity onPress={() => handleToggleReplies(item.id)} style={styles.viewRepliesBtn} activeOpacity={0.7}>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={12} color={MAROON} />
                <Text style={styles.viewRepliesText}>
                  {expanded ? 'Hide replies' : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Expanded replies */}
        {!isReply && expanded && (
          <View style={styles.repliesContainer}>
            {expanded.loading && expanded.items.length === 0
              ? <ActivityIndicator size="small" color={MAROON} style={{ paddingVertical: 8 }} />
              : expanded.items.map(r => renderComment(r, true, item.id))
            }
            {!expanded.loading && expanded.items.length < expanded.total && (
              <TouchableOpacity onPress={() => handleLoadMoreReplies(item.id)} style={styles.loadMoreBtn} activeOpacity={0.7}>
                <Text style={styles.loadMoreText}>
                  {`Load ${Math.min(9, expanded.total - expanded.items.length)} more replies`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    );
  };

  // ── Back button header (shared across all states) ─────────────────────────────
  const BackBar = () => (
    <View style={styles.navBar}>
      <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Ionicons name="chevron-back" size={26} color={colors.text} />
      </TouchableOpacity>
    </View>
  );

  // ── Loading state ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <BackBar />
        <View style={styles.center}><ActivityIndicator color={MAROON} size="large" /></View>
      </SafeAreaView>
    );
  }

  // ── Not found state ───────────────────────────────────────────────────────────
  if (notFound || !post) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <BackBar />
        <View style={styles.center}>
          <Ionicons name="image-outline" size={48} color={colors.border} />
          <Text style={[styles.notFoundText, { color: colors.textMuted }]}>Post not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main screen ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <BackBar />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ── Scrollable content ── */}
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ────────── POST CARD ────────── */}
          <View style={[styles.postCard, { backgroundColor: colors.surface }]}>

            {/* Header: avatar · name · @handle · time · three-dot */}
            <View style={styles.postHeader}>
              <TouchableOpacity
                style={styles.postHeaderLeft}
                onPress={() => navigation.navigate('UserProfile', { viewedUserId: authorId })}
                activeOpacity={0.7}
              >
                {authorAvatar ? (
                  <Image source={{ uri: authorAvatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarInitial}>{authorName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View>
                  <Text style={[styles.authorName, { color: colors.text }]}>{authorName}</Text>
                  <Text style={[styles.authorSub, { color: colors.textMuted }]}>@{authorUsername} · {timeAgo}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMenuVisible(true)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="ellipsis-vertical" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Image carousel */}
            {mediaItems.length > 0 && (
              <View
                style={styles.mediaContainer}
                onLayout={e => setSlideWidth(e.nativeEvent.layout.width)}
              >
                <ScrollView
                  ref={carouselRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  bounces={false}
                  scrollEventThrottle={16}
                  onMomentumScrollEnd={e => {
                    setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width));
                  }}
                >
                  {mediaItems.map((item, i) => (
                    <TouchableOpacity
                      key={`slide-${i}`}
                      activeOpacity={1}
                      onPress={handleImageTap}
                      style={{ width: slideWidth, height: slideWidth }}
                    >
                      {imgErrors[i] ? (
                        <View style={[styles.imgError, { width: slideWidth, height: slideWidth, backgroundColor: colors.borderLight }]}>
                          <Ionicons name="image-outline" size={36} color={colors.border} />
                        </View>
                      ) : (
                        <Image
                          source={item}
                          style={{ width: slideWidth, height: slideWidth, borderRadius: 16 }}
                          resizeMode="cover"
                          onError={() => setImgErrors(prev => ({ ...prev, [i]: true }))}
                        />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Double-tap heart overlay */}
                <Animated.View
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, styles.heartOverlay, {
                    opacity: heartAnim,
                    transform: [{
                      scale: heartAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 1.4, 1] }),
                    }],
                  }]}
                >
                  <Ionicons name="heart" size={90} color="#F27C7C" />
                </Animated.View>


                {/* Carousel dots — overlaid on bottom of image */}
                {mediaItems.length > 1 && (
                  <View style={styles.dotsRow} pointerEvents="none">
                    {mediaItems.map((_, i) => (
                      <View key={`dot-${i}`} style={[styles.dot, i === currentIndex && styles.dotActive]} />
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Engagement row: heart | comment | bookmark */}
            <View style={[styles.engRow, styles.engRowTight]}>
              <TouchableOpacity style={styles.engBtn} onPress={handleLike} activeOpacity={0.7}>
                <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#F27C7C' : colors.text} />
                <Text style={[styles.engCount, { color: liked ? '#F27C7C' : colors.text }]}>{likesCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.engBtn}
                onPress={openCommentsSheet}
                activeOpacity={0.7}
              >
                <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
                <Text style={[styles.engCount, { color: colors.text }]}>
                  {comments.length || dbCommentCount}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.engBtn, styles.bookmarkBtn]} onPress={handleBookmark} activeOpacity={0.7}>
                <Ionicons name={bookmarked ? 'bookmark' : 'bookmark-outline'} size={22} color={bookmarked ? OCHRE : colors.text} />
              </TouchableOpacity>
            </View>

            {/* Content: title (+ stylist pill), caption, hashtags */}
            <View style={styles.contentArea}>
              {/* Title row — stylist pill sits to the right */}
              <View style={styles.titleRow}>
                <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={4}>
                  {post.title}
                </Text>
                {stylistName && (
                  <TouchableOpacity
                    style={styles.stylistPill}
                    onPress={() => navigation.navigate('StylistProfile', { stylist: { id: stylistId } })}
                    activeOpacity={0.7}
                  >
                    <Scissors size={13} color={OCHRE} strokeWidth={1.5} />
                    <Text style={styles.stylistPillText} numberOfLines={1}>{stylistName}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Caption with @mentions in maroon */}
              {!!post.description && (
                <Text style={[styles.caption, { color: colors.text }]}>{post.description}</Text>
              )}

              {/* Hashtags */}
              {post.tags?.length > 0 && (
                <Text style={styles.hashtags}>{post.tags.map(t => `#${t}`).join(' ')}</Text>
              )}
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Comments bottom sheet ── */}
      <Modal visible={commentsSheetVisible} transparent animationType="none" onRequestClose={closeCommentsSheet}>
        <View style={{ flex: 1 }}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.sheetBackdrop,
              { opacity: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
            ]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeCommentsSheet} />
          </Animated.View>

          <KeyboardAvoidingView
            style={styles.sheetWrapper}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            pointerEvents="box-none"
          >
            <Animated.View
              style={[
                styles.commentsSheet,
                {
                  backgroundColor: colors.surface,
                  transform: [{
                    translateY: sheetAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [COMMENTS_SHEET_HEIGHT, 0],
                    }),
                  }],
                },
              ]}
            >
              {/* Header */}
              <View style={[styles.sheetHeader, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>
                  Comments ({comments.length || dbCommentCount})
                </Text>
                <TouchableOpacity onPress={closeCommentsSheet} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              {/* Comment list */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ flexGrow: 1 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {commentsLoading ? (
                  <ActivityIndicator color={MAROON} style={{ paddingVertical: 20 }} />
                ) : comments.length === 0 ? (
                  <View style={styles.noComments}>
                    <Text style={[styles.noCommentsText, { color: colors.textMuted }]}>No comments yet — be first!</Text>
                  </View>
                ) : (
                  comments.map(c => renderComment(c, false, null))
                )}
              </ScrollView>

              {/* Composer — pinned at bottom of sheet */}
              {replyingTo && (
                <View style={[styles.replyBanner, { backgroundColor: colors.backgroundAlt, borderTopColor: colors.borderLight }]}>
                  <Text style={[styles.replyBannerText, { color: colors.textSecondary }]} numberOfLines={1}>
                    Replying to{' '}
                    <Text style={{ color: MAROON, fontFamily: 'Figtree_600SemiBold' }}>@{replyingTo.username}</Text>
                  </Text>
                  <TouchableOpacity onPress={() => setReplyingTo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={[styles.commentInputBar, { backgroundColor: colors.surface, borderTopColor: colors.borderLight }]}>
                {currentUserProfile?.avatar_url ? (
                  <Image source={{ uri: currentUserProfile.avatar_url }} style={styles.inputAvatar} />
                ) : (
                  <View style={[styles.inputAvatar, styles.inputAvatarPlaceholder]}>
                    <Text style={styles.inputAvatarInitial}>
                      {(currentUserProfile?.username || user?.email || '?')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <TextInput
                  ref={commentInputRef}
                  style={[styles.commentInput, { backgroundColor: colors.inputBackground, borderColor: colors.border, color: colors.text }]}
                  placeholder={replyingTo ? `Reply to @${replyingTo.username}…` : 'Add a comment…'}
                  placeholderTextColor={colors.placeholder}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <TouchableOpacity
                  onPress={handleSubmitComment}
                  disabled={submitting}
                  style={[styles.sendBtn, { backgroundColor: commentText.trim() ? MAROON : colors.border }]}
                  activeOpacity={0.75}
                >
                  {submitting
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="send" size={16} color="#fff" />
                  }
                </TouchableOpacity>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ── Menu modal ── */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={[styles.menuOverlay, { backgroundColor: colors.overlay }]} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.menuHandle, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: colors.borderLight }]} onPress={handleShare}>
              <Ionicons name="share-outline" size={22} color={colors.text} />
              <Text style={[styles.menuItemText, { color: colors.text }]}>Share</Text>
            </TouchableOpacity>
            {isOwnPost ? (
              <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleDelete}>
                <Ionicons name="trash-outline" size={22} color="#ef4444" />
                <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Delete Post</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleReport}>
                <Ionicons name="flag-outline" size={22} color="#ef4444" />
                <Text style={[styles.menuItemText, { color: '#ef4444' }]}>Report Post</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.menuItem, styles.menuCancel, { borderTopColor: colors.borderLight }]}
              onPress={() => setMenuVisible(false)}
            >
              <Text style={[styles.menuCancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── Collection picker modal ── */}
      <Modal visible={savePickerVisible} transparent animationType="slide" onRequestClose={() => setSavePickerVisible(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setSavePickerVisible(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: colors.surface }]} onPress={() => {}}>
            <View style={[styles.pickerHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.pickerTitle, { color: colors.textSecondary }]}>Add to Collection</Text>

            {(pickerLoading || pickerSaving) ? (
              <ActivityIndicator style={{ paddingVertical: 20 }} color={MAROON} />
            ) : newCollectionMode ? (
              <View style={styles.newCollForm}>
                <TextInput
                  style={[styles.newCollInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.inputBackground }]}
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
                    style={[styles.newCollBtn, { borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => { setNewCollectionMode(false); setNewCollectionName(''); }}
                  >
                    <Text style={[styles.newCollBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.newCollBtn, { flex: 2, backgroundColor: MAROON, opacity: newCollectionName.trim() ? 1 : 0.4 }]}
                    onPress={handleCreateAndSave}
                    disabled={!newCollectionName.trim()}
                  >
                    <Text style={[styles.newCollBtnText, { color: '#fff' }]}>Create & Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <ScrollView bounces={false} style={{ marginTop: 4 }}>
                <TouchableOpacity style={[styles.pickerRow, { borderBottomColor: colors.border }]} onPress={() => handleSaveToCollection(null)} activeOpacity={0.7}>
                  <Ionicons name="bookmark-outline" size={18} color={MAROON} />
                  <Text style={[styles.pickerRowLabel, { color: colors.text }]}>All Saved</Text>
                </TouchableOpacity>
                {pickerCollections.map(col => (
                  <TouchableOpacity key={col.id} style={[styles.pickerRow, { borderBottomColor: colors.border }]} onPress={() => handleSaveToCollection(col)} activeOpacity={0.7}>
                    <Ionicons name="folder-outline" size={18} color={colors.textSecondary} />
                    <Text style={[styles.pickerRowLabel, { color: colors.text }]} numberOfLines={1}>{col.name}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={[styles.pickerRow, { borderBottomWidth: 0 }]} onPress={() => setNewCollectionMode(true)} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={18} color={MAROON} />
                  <Text style={[styles.pickerRowLabel, { color: MAROON }]}>New Collection</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Deleting overlay */}
      <Modal visible={deleting} transparent animationType="none">
        <View style={styles.deletingOverlay}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.deletingText}>Deleting…</Text>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1 },

  // ── Nav bar ──────────────────────────────────────────────────────────────────
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  notFoundText: { fontSize: 15, fontFamily: 'Figtree_500Medium' },

  scrollContent: { paddingBottom: 24 },

  // ── Post card ────────────────────────────────────────────────────────────────
  postCard: {
    marginHorizontal: CARD_H_MARGIN,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderLight,
    marginTop: 4,
    marginBottom: 20,
  },

  // Post header
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
    paddingVertical: 13,
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarPlaceholder: {
    backgroundColor: MAROON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  authorName: { fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  authorSub:  { fontSize: 12, fontFamily: 'Figtree_500Medium', marginTop: 1 },

  // Image carousel
  mediaContainer: { width: '100%', position: 'relative' },
  heartOverlay: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  imgError: { borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dotsRow: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotActive: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },

  // Engagement row (heart | comment | bookmark)
  engRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  engRowTight: { paddingTop: 10, paddingBottom: 14 },
  engBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 18,
    gap: 6,
  },
  engCount: { fontSize: 15, fontFamily: 'Figtree_500Medium' },
  bookmarkBtn: { marginLeft: 'auto', marginRight: 0 },

  // Content area
  contentArea: { paddingHorizontal: 14, paddingBottom: 18 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  postTitle: { fontSize: 18, fontFamily: 'Figtree_600SemiBold', flex: 1 },
  stylistPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EDDCD2',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
    maxWidth: 160,
  },
  stylistPillText: { fontSize: 12, fontFamily: 'Figtree_600SemiBold', color: OCHRE },
  caption: { fontSize: 15, fontFamily: 'Figtree_500Medium', lineHeight: 22, marginBottom: 10 },
  hashtags: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: MAROON, lineHeight: 20 },

  // ── Comments bottom sheet ────────────────────────────────────────────────────
  sheetBackdrop: { backgroundColor: 'rgba(0,0,0,0.5)' },
  sheetWrapper: { flex: 1, justifyContent: 'flex-end' },
  commentsSheet: {
    height: COMMENTS_SHEET_HEIGHT,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold' },
  noComments: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noCommentsText: { fontSize: 14, fontFamily: 'Figtree_500Medium' },

  commentCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.borderLight,
  },
  replyCard: {
    marginLeft: 30,
    paddingTop: 10,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  cmtRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cmtAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: c.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  cmtAvatarImg: { width: 32, height: 32, borderRadius: 16 },
  cmtAvatarInitial: { fontSize: 13, fontFamily: 'Figtree_600SemiBold', color: c.textSecondary },
  cmtHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  cmtUsername: { fontSize: 13, fontFamily: 'Figtree_700Bold', color: OCHRE },
  cmtText: { fontSize: 14, fontFamily: 'Figtree_500Medium', lineHeight: 20 },
  cmtActions: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 6 },
  cmtActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cmtMeta: { fontSize: 12, fontFamily: 'Figtree_500Medium' },
  viewRepliesBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  viewRepliesText: { fontSize: 12, fontFamily: 'Figtree_600SemiBold', color: MAROON },
  repliesContainer: { marginTop: 10, paddingLeft: 4 },
  loadMoreBtn: { paddingVertical: 8 },
  loadMoreText: { fontSize: 12, fontFamily: 'Figtree_600SemiBold', color: MAROON },

  // ── Comment input (pinned) ────────────────────────────────────────────────────
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBannerText: { fontSize: 13, fontFamily: 'Figtree_500Medium', flex: 1, marginRight: 8 },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputAvatar: { width: 30, height: 30, borderRadius: 15, flexShrink: 0, overflow: 'hidden' },
  inputAvatarPlaceholder: { backgroundColor: MAROON, alignItems: 'center', justifyContent: 'center' },
  inputAvatarInitial: { fontSize: 11, fontFamily: 'Figtree_700Bold', color: '#fff' },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
    maxHeight: 80,
    borderWidth: 1,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // ── Menu modal ───────────────────────────────────────────────────────────────
  menuOverlay: { flex: 1, justifyContent: 'flex-end' },
  menuSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingTop: 12,
  },
  menuHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  menuItemText: { fontSize: 16, fontFamily: 'Figtree_500Medium' },
  menuCancel: {
    borderTopWidth: 8,
    borderBottomWidth: 0,
    marginTop: 4,
    justifyContent: 'center',
  },
  menuCancelText: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', textAlign: 'center' },

  // ── Collection picker ────────────────────────────────────────────────────────
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 36,
    paddingHorizontal: 20,
    maxHeight: 380,
  },
  pickerHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 14 },
  pickerTitle: { fontSize: 13, fontFamily: 'Figtree_700Bold', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.6 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  pickerRowLabel: { fontSize: 16, fontFamily: 'Figtree_500Medium', flex: 1 },
  newCollForm: { marginTop: 8, gap: 12 },
  newCollInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: 'Figtree_500Medium' },
  newCollActions: { flexDirection: 'row', gap: 10 },
  newCollBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  newCollBtnText: { fontSize: 15, fontFamily: 'Figtree_700Bold' },

  // ── Deleting overlay ─────────────────────────────────────────────────────────
  deletingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', gap: 12 },
  deletingText: { color: '#fff', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
});
