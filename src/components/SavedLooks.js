import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Text,
  Animated,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { useNavigation } from '@react-navigation/native';
import { postService } from '../services/postService';
import { collectionService } from '../services/collectionService';
import { WEB_MAX_WIDTHS, useIsWebLayout } from '../utils/webLayout';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../config/supabase';

const POST_GAP  = 3;
const COLL_PAD  = 24;
const COLL_GAP  = 24;
const COLL_ROW_GAP = 28;

// How many collection columns to show at a given container width
function collCols(w)  { return w >= 700 ? 4 : w >= 480 ? 3 : 2; }
// How many post-grid columns
function postCols(w)  { return w >= 600 ? 3 : 2; }

export default function SavedLooks() {
  const { user }    = useAuth();
  const { colors }  = useTheme();
  const navigation  = useNavigation();
  const channelRef  = useRef(null);
  const { width: windowWidth } = useWindowDimensions();
  const isWebLayout = useIsWebLayout();

  // Measure the actual rendered container width (avoids web max-width mismatch)
  const fallbackWidth = isWebLayout
    ? Math.min(windowWidth, WEB_MAX_WIDTHS.profile)
    : windowWidth;
  const [cw, setCw] = useState(fallbackWidth);
  const onLayout = (e) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0) setCw(w);
  };

  const nCollCols   = 2;
  const nPostCols   = postCols(cw);
  const collCardW   = (cw - COLL_PAD * 2 - COLL_GAP * (nCollCols - 1)) / nCollCols;
  const collCardH   = collCardW * 0.9;
  const postTileW   = (cw - POST_GAP * (nPostCols - 1)) / nPostCols;

  const styles = useMemo(
    () => makeStyles(colors, collCardW, collCardH, postTileW),
    [colors, collCardW, collCardH, postTileW]
  );

  // ── View state + transition ─────────────────────────────────────────────────
  const [view, setView] = useState('collections');
  const [openedCollection, setOpenedCollection] = useState(null);
  const slideX  = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const navigateToPosts = (col) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setOpenedCollection(col);
      setView('posts');
      slideX.setValue(36);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideX, { toValue: 0, tension: 130, friction: 14, useNativeDriver: true }),
      ]).start();
    });
  };

  const navigateBack = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(slideX,   { toValue: 36, duration: 140, useNativeDriver: true }),
    ]).start(() => {
      setView('collections');
      setOpenedCollection(null);
      slideX.setValue(-24);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideX, { toValue: 0, tension: 130, friction: 14, useNativeDriver: true }),
      ]).start();
    });
  };

  // ── Data ────────────────────────────────────────────────────────────────────
  const [allPosts,      setAllPosts]      = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [collections,   setCollections]   = useState([]);
  const [membershipMap, setMembershipMap] = useState({});

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [createGroupVisible,  setCreateGroupVisible]  = useState(false);
  const [newGroupName,        setNewGroupName]        = useState('');
  const [addPostsVisible,     setAddPostsVisible]     = useState(false);
  const [selectedToAdd,       setSelectedToAdd]       = useState(new Set());
  const [groupMenuTarget,     setGroupMenuTarget]     = useState(null);
  const [renameVisible,       setRenameVisible]       = useState(false);
  const [renameText,          setRenameText]          = useState('');
  const [saving,              setSaving]              = useState(false);

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    if (!user?.id) return;
    const [bookmarksRes, collectionsRes, membershipsRes] = await Promise.all([
      postService.getBookmarkedPosts(user.id),
      collectionService.getCollections(user.id),
      collectionService.getAllCollectionMemberships(user.id),
    ]);
    if (!bookmarksRes.error)
      setAllPosts(bookmarksRes.data?.map(b => b.posts).filter(Boolean) || []);
    if (!collectionsRes.error)
      setCollections(collectionsRes.data || []);
    if (!membershipsRes.error) {
      const map = {};
      for (const { collection_id, post_id } of (membershipsRes.data || [])) {
        if (!map[collection_id]) map[collection_id] = new Set();
        map[collection_id].add(post_id);
      }
      setMembershipMap(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchAll();
    const channel = supabase
      .channel(`bookmarks:${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'bookmarks',
        filter: `user_id=eq.${user.id}`,
      }, fetchAll)
      .subscribe();
    channelRef.current = channel;
    return () => { channelRef.current?.unsubscribe(); channelRef.current = null; };
  }, [user?.id]);

  // Re-sync collection membership when returning from the full-screen post viewer
  // (e.g. after removing a post from a collection there).
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', fetchAll);
    return unsubscribe;
  }, [navigation, user?.id]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const displayedPosts = openedCollection === null
    ? allPosts
    : allPosts.filter(p => membershipMap[openedCollection.id]?.has(p.id));

  const getCollectionPhotos = (collId) =>
    allPosts
      .filter(p => membershipMap[collId]?.has(p.id))
      .slice(0, 3)
      .map(p => p.post_media?.[0]?.media_url)
      .filter(Boolean);

  const openPostDetail = (item) => {
    const initialIndex = displayedPosts.findIndex(p => p.id === item.id);
    navigation.navigate('CollectionPosts', {
      posts: displayedPosts,
      initialIndex: initialIndex >= 0 ? initialIndex : 0,
      collectionId: openedCollection?.id ?? null,
      collectionName: openedCollection?.name ?? 'All Saved',
    });
  };

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    setSaving(true);
    const { data, error } = await collectionService.createCollection(user.id, name);
    if (!error && data) setCollections(prev => [...prev, data]);
    setNewGroupName('');
    setCreateGroupVisible(false);
    setSaving(false);
  };

  const handleRenameGroup = async () => {
    const name = renameText.trim();
    if (!name || !groupMenuTarget) return;
    setSaving(true);
    const { error } = await collectionService.renameCollection(groupMenuTarget.id, name);
    if (!error) {
      setCollections(prev => prev.map(c => c.id === groupMenuTarget.id ? { ...c, name } : c));
      if (openedCollection?.id === groupMenuTarget.id)
        setOpenedCollection(prev => ({ ...prev, name }));
    }
    setRenameVisible(false);
    setGroupMenuTarget(null);
    setSaving(false);
  };

  const handleDeleteGroup = (collection) => {
    const doDelete = async () => {
      await collectionService.deleteCollection(collection.id);
      setCollections(prev => prev.filter(c => c.id !== collection.id));
      setMembershipMap(prev => { const m = { ...prev }; delete m[collection.id]; return m; });
      if (openedCollection?.id === collection.id) navigateBack();
    };

    if (isWebLayout) {
      if (window.confirm(`Delete "${collection.name}"? Posts will not be deleted — only this collection.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        `Delete "${collection.name}"?`,
        'Posts will not be deleted — only this collection.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ]
      );
    }
  };

  const toggleAddPost = (postId) => {
    setSelectedToAdd(prev => {
      const next = new Set(prev);
      next.has(postId) ? next.delete(postId) : next.add(postId);
      return next;
    });
  };

  const confirmAddPosts = async () => {
    if (!selectedToAdd.size || !openedCollection) { setAddPostsVisible(false); return; }
    setSaving(true);
    await Promise.all(
      [...selectedToAdd].map(postId =>
        collectionService.addPostToCollection(openedCollection.id, postId, user.id)
      )
    );
    setMembershipMap(prev => {
      const next = { ...prev };
      if (!next[openedCollection.id]) next[openedCollection.id] = new Set();
      next[openedCollection.id] = new Set([...next[openedCollection.id], ...selectedToAdd]);
      return next;
    });
    setAddPostsVisible(false);
    setSaving(false);
  };

  // ── Collection card ─────────────────────────────────────────────────────────
  const renderCollectionCard = (col) => {
    const isAll  = col === 'all';
    const name   = isAll ? 'All Saved' : col.name;
    const photos = isAll
      ? allPosts.slice(0, 3).map(p => p.post_media?.[0]?.media_url).filter(Boolean)
      : getCollectionPhotos(col.id);

    return (
      <View key={isAll ? '__all__' : col.id} style={styles.collCard}>
        <TouchableOpacity
          style={styles.stackContainer}
          onPress={() => navigateToPosts(isAll ? null : col)}
          activeOpacity={0.85}
        >
          {photos[2] && (
            <View style={[styles.stackCard, styles.stackCardC]}>
              <Image source={{ uri: photos[2] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </View>
          )}
          {photos[1] && (
            <View style={[styles.stackCard, styles.stackCardB]}>
              <Image source={{ uri: photos[1] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            </View>
          )}
          <View style={[styles.stackCard, styles.stackCardA]}>
            {photos[0] ? (
              <Image source={{ uri: photos[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : (
              <View style={styles.stackPlaceholder}>
                <Ionicons name="bookmark-outline" size={26} color={colors.border} />
              </View>
            )}
            {/* Dark gradient scrim behind the name pill */}
            <LinearGradient
              colors={['transparent', 'rgba(26,22,18,0.9)']}
              locations={[0, 1]}
              style={styles.collNameGradient}
              pointerEvents="none"
            />
            {/* Frosted glass name pill — matches Explore stylistTag */}
            <View style={styles.collNameOverlay}>
              <Ionicons name="bookmark" size={10} color="#fff" />
              <Text style={styles.collNameOverlayText} numberOfLines={1}>{name}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderNewCollectionCard = () => (
    <TouchableOpacity
      key="__new__"
      style={styles.collCard}
      onPress={() => { setNewGroupName(''); setCreateGroupVisible(true); }}
      activeOpacity={0.85}
    >
      <View style={styles.newCollContainer}>
        <Ionicons name="add" size={30} color={colors.primary} />
      </View>
      <Text style={[styles.collName, { color: colors.primary }]}>New Collection</Text>
    </TouchableOpacity>
  );

  const buildCollectionsGrid = () => {
    const items = ['all', ...collections, 'new'];
    const rows = [];
    for (let i = 0; i < items.length; i += nCollCols) {
      const row = items.slice(i, i + nCollCols);
      rows.push(
        <View key={`coll-row-${i}`} style={styles.collRow}>
          {row.map(item => {
            if (item === 'all') return renderCollectionCard('all');
            if (item === 'new') return renderNewCollectionCard();
            return renderCollectionCard(item);
          })}
          {row.length < nCollCols && Array(nCollCols - row.length).fill(null).map((_, j) => (
            <View key={`ph-${j}`} style={{ flex: 1 }} />
          ))}
        </View>
      );
    }
    return rows;
  };

  // ── Post tile ───────────────────────────────────────────────────────────────
  const renderPostTile = (item, selectable = false) => {
    const firstImage = item.post_media?.[0]?.media_url;
    const isSelected = selectable && selectedToAdd.has(item.id);
    const inGroup    = selectable && openedCollection && membershipMap[openedCollection.id]?.has(item.id);

    return (
      <TouchableOpacity
        key={item.id}
        style={styles.postTile}
        onPress={() => selectable ? toggleAddPost(item.id) : openPostDetail(item)}
        activeOpacity={0.8}
      >
        {firstImage ? (
          <Image source={{ uri: firstImage }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={styles.postTilePlaceholder}>
            <Ionicons name="image-outline" size={22} color={colors.border} />
          </View>
        )}
        {(item.post_media?.length ?? 0) > 1 && (
          <View style={styles.multiDot}>
            <Ionicons name="copy-outline" size={13} color="#fff" />
          </View>
        )}
        {inGroup && !isSelected && (
          <View style={styles.alreadyBadge}>
            <Ionicons name="checkmark" size={12} color="#fff" />
          </View>
        )}
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <Ionicons name="checkmark-circle" size={28} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const buildPostsGrid = (posts, selectable = false) => {
    const rows = [];
    for (let i = 0; i < posts.length; i += nPostCols) {
      const slice = posts.slice(i, i + nPostCols);
      rows.push(
        <View key={`post-row-${i}`} style={styles.postRow}>
          {slice.map(p => renderPostTile(p, selectable))}
          {slice.length < nPostCols && Array(nPostCols - slice.length).fill(null).map((_, j) => (
            <View key={`ep-${j}`} style={[styles.postTile, { backgroundColor: 'transparent' }]} />
          ))}
        </View>
      );
    }
    return rows;
  };

  // ── Shared modals ───────────────────────────────────────────────────────────
  const renderModals = () => (
    <>
      {/* Long-press menu */}
      <Modal
        visible={!!groupMenuTarget && !renameVisible}
        transparent animationType="fade"
        onRequestClose={() => setGroupMenuTarget(null)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setGroupMenuTarget(null)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>{groupMenuTarget?.name}</Text>
            <TouchableOpacity style={styles.menuRow} onPress={() => {
              setGroupMenuTarget(null);
              setSelectedToAdd(new Set());
              setAddPostsVisible(true);
            }}>
              <Ionicons name="add-circle-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.menuRowText}>Add to "{groupMenuTarget?.name}"</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => {
              setRenameText(groupMenuTarget?.name || '');
              setRenameVisible(true);
            }}>
              <Ionicons name="pencil-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.menuRowText}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuRow} onPress={() => {
              const target = groupMenuTarget;
              setGroupMenuTarget(null);
              handleDeleteGroup(target);
            }}>
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={[styles.menuRowText, { color: '#ef4444' }]}>Delete Collection</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Rename */}
      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={() => setRenameVisible(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setRenameVisible(false)}>
          <Pressable style={styles.inputSheet} onPress={() => {}}>
            <Text style={styles.inputSheetTitle}>Rename Collection</Text>
            <TextInput
              style={styles.nameInput} value={renameText} onChangeText={setRenameText}
              placeholder="Collection name" placeholderTextColor={colors.placeholder}
              autoFocus maxLength={40}
            />
            <View style={styles.inputSheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRenameVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !renameText.trim() && styles.confirmBtnDisabled]}
                onPress={handleRenameGroup} disabled={!renameText.trim() || saving}
              >
                <Text style={styles.confirmBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Create */}
      <Modal visible={createGroupVisible} transparent animationType="fade" onRequestClose={() => setCreateGroupVisible(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setCreateGroupVisible(false)}>
          <Pressable style={styles.inputSheet} onPress={() => {}}>
            <Text style={styles.inputSheetTitle}>New Collection</Text>
            <TextInput
              style={styles.nameInput} value={newGroupName} onChangeText={setNewGroupName}
              placeholder="Collection name" placeholderTextColor={colors.placeholder}
              autoFocus maxLength={40}
            />
            <View style={styles.inputSheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateGroupVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !newGroupName.trim() && styles.confirmBtnDisabled]}
                onPress={handleCreateGroup} disabled={!newGroupName.trim() || saving}
              >
                <Text style={styles.confirmBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add posts */}
      <Modal visible={addPostsVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAddPostsVisible(false)}>
        <SafeAreaView style={styles.addPostsSheet} edges={['top']}>
          <View style={styles.addPostsHeader}>
            <TouchableOpacity onPress={() => setAddPostsVisible(false)}>
              <Text style={styles.addPostsCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.addPostsTitle}>Add to "{openedCollection?.name}"</Text>
            <TouchableOpacity onPress={confirmAddPosts} disabled={saving}>
              <Text style={[styles.addPostsDone, !selectedToAdd.size && { opacity: 0.4 }]}>
                Add{selectedToAdd.size > 0 ? ` (${selectedToAdd.size})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView><View>{buildPostsGrid(allPosts, true)}</View></ScrollView>
        </SafeAreaView>
      </Modal>

    </>
  );

  // ── Loading / empty ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View onLayout={onLayout}>
        <ActivityIndicator style={{ paddingTop: 60 }} size="large" color={colors.primary} />
      </View>
    );
  }

  if (allPosts.length === 0) {
    return (
      <View onLayout={onLayout} style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No saved posts yet</Text>
        <Text style={styles.emptyText}>Tap the bookmark icon on any post to save it</Text>
      </View>
    );
  }

  // ── Collections view ────────────────────────────────────────────────────────
  if (view === 'collections') {
    return (
      <View onLayout={onLayout}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideX }] }}>
          <View style={styles.collectionsGrid}>
            {buildCollectionsGrid()}
          </View>
        </Animated.View>
        {renderModals()}
      </View>
    );
  }

  // ── Posts (drill-in) view ───────────────────────────────────────────────────
  return (
    <View onLayout={onLayout}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ translateX: slideX }] }}>
      <View style={styles.postsHeader}>
        <TouchableOpacity
          onPress={navigateBack}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.postsHeaderBack}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.postsHeaderTitle} numberOfLines={1}>
          {openedCollection?.name ?? 'All Saved'}
        </Text>
        {openedCollection ? (
          <TouchableOpacity
            onPress={() => setGroupMenuTarget(openedCollection)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 26 }} />
        )}
      </View>

      {displayedPosts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No posts here</Text>
          <Text style={styles.emptyText}>
            {openedCollection ? 'Tap ··· to add posts to this collection' : 'Bookmark posts to see them here'}
          </Text>
        </View>
      ) : (
        <View style={styles.postsGrid}>
          {buildPostsGrid(displayedPosts)}
        </View>
      )}
      </Animated.View>

      {renderModals()}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (c, collCardW, collCardH, postTileW) => {
  // Individual stack card is slightly smaller than the container cell
  const CW = collCardW - 14;
  const CH = collCardH - 8;

  return StyleSheet.create({
    emptyState: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60, gap: 8 },
    emptyTitle: { fontSize: 17, fontFamily: 'Figtree_600SemiBold', color: c.text },
    emptyText:  { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20 },

    // ── Collections grid ──────────────────────────────────────────────────────
    collectionsGrid: {
      paddingHorizontal: COLL_PAD,
      paddingTop: 20,
      paddingBottom: 48,
      gap: COLL_ROW_GAP,
    },
    collRow: { flexDirection: 'row', justifyContent: 'space-between' },
    collCard: { width: collCardW },

    // Stacked photo thumbnails
    stackContainer: {
      width: collCardW,
      height: collCardH,
      position: 'relative',
      marginBottom: 10,
      // No overflow:hidden — lets back cards fan out without corner clipping
    },
    stackCard: {
      position: 'absolute',
      width: CW,
      height: CH,
      borderRadius: 14,
      overflow: 'hidden',      // keeps image + rounded corners intact
      backgroundColor: c.borderLight,
    },
    // Front card — straight, fully visible on top
    stackCardA: {
      bottom: 0,
      left: 0,
      zIndex: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.16,
      shadowRadius: 8,
      elevation: 6,
    },
    // Mid card — subtle 3° clockwise tilt, peeks right
    stackCardB: {
      bottom: 0,
      left: 0,
      zIndex: 2,
      transform: [{ translateX: CW * 0.07 }, { rotate: '3deg' }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.09,
      shadowRadius: 4,
      elevation: 3,
    },
    // Back card — gentle 6° tilt for depth
    stackCardC: {
      bottom: 0,
      left: 0,
      zIndex: 1,
      transform: [{ translateX: CW * 0.14 }, { rotate: '6deg' }],
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    stackPlaceholder: {
      flex: 1,
      backgroundColor: c.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    newCollContainer: {
      width: collCardW,
      height: collCardH,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: c.primary,
      borderStyle: 'dashed',
      backgroundColor: c.surfaceAlt,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    collFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 6,
    },
    collName: {
      fontSize: 13,
      fontFamily: 'Figtree_600SemiBold',
      color: c.text,
      flex: 1,
    },
    collMenuBtn: {
      paddingLeft: 4,
    },
    collNameGradient: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: '50%',
    },
    collNameOverlay: {
      position: 'absolute',
      bottom: 10,
      left: 10,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    collNameOverlayText: {
      fontSize: 12,
      fontFamily: 'Figtree_500Medium',
      color: '#fff',
      marginLeft: 4,
    },
    collMenuOverlay: {
      position: 'absolute',
      top: 8,
      right: 8,
      backgroundColor: 'rgba(0,0,0,0.38)',
      borderRadius: 12,
      width: 26,
      height: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Posts drill-in view ───────────────────────────────────────────────────
    postsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    postsHeaderBack:  { marginRight: 12 },
    postsHeaderTitle: {
      flex: 1,
      fontSize: 17,
      fontFamily: 'Figtree_700Bold',
      color: c.text,
    },
    postsGrid: { paddingBottom: 40 },
    postRow: {
      flexDirection: 'row',
      gap: POST_GAP,
      marginBottom: POST_GAP,
    },
    postTile: {
      width: postTileW,
      height: postTileW,      // square tiles
      backgroundColor: c.borderLight,
      position: 'relative',
      overflow: 'hidden',
    },
    postTilePlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    multiDot:    { position: 'absolute', top: 8, right: 8 },
    alreadyBadge: {
      position: 'absolute', top: 6, right: 6,
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: c.primary,
      justifyContent: 'center', alignItems: 'center',
    },
    selectedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(93,31,31,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
    },

    // ── Sheet / modal chrome ──────────────────────────────────────────────────
    menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    menuSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      paddingBottom: 34, paddingTop: 8,
    },
    menuTitle: {
      fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: c.textSecondary,
      textAlign: 'center', paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
      marginBottom: 4,
    },
    menuRow:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingVertical: 16 },
    menuRowText: { fontSize: 16, fontFamily: 'Figtree_500Medium', color: c.text },
    inputSheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 24, paddingBottom: 34,
    },
    inputSheetTitle: {
      fontSize: 17, fontFamily: 'Figtree_700Bold', color: c.text,
      marginBottom: 16, textAlign: 'center',
    },
    nameInput: {
      borderWidth: 1, borderColor: c.border, borderRadius: 10,
      paddingHorizontal: 14, paddingVertical: 12,
      fontSize: 15, color: c.text, marginBottom: 16,
      backgroundColor: c.inputBackground,
    },
    inputSheetActions: { flexDirection: 'row', gap: 12 },
    cancelBtn: {
      flex: 1, paddingVertical: 13, borderRadius: 10,
      borderWidth: 1, borderColor: c.border, alignItems: 'center',
    },
    cancelBtnText:       { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: c.textSecondary },
    confirmBtn:          { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center' },
    confirmBtnDisabled:  { backgroundColor: c.border },
    confirmBtnText:      { fontSize: 15, fontFamily: 'Figtree_600SemiBold', color: '#fff' },
    addPostsSheet:       { flex: 1, backgroundColor: c.surface },
    addPostsHeader: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
    },
    addPostsCancel: { fontSize: 15, color: c.textSecondary, fontFamily: 'Figtree_500Medium' },
    addPostsTitle:  { fontSize: 15, fontFamily: 'Figtree_700Bold', color: c.text },
    addPostsDone:   { fontSize: 15, color: c.primary, fontFamily: 'Figtree_700Bold' },
  });
};
