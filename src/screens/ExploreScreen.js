import { useState, useCallback, useMemo, useRef } from 'react';
import { Platform, ActivityIndicator } from 'react-native';
import { s } from '../utils/responsive';
import { webWrap, WEB_MAX_WIDTHS } from '../utils/webLayout';
import { useUnreadCount } from '../context/UnreadCountContext';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  ScrollView,
  Image,
  Keyboard,
  Modal,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import SearchBar from '../components/SearchBar';
import PostCard from '../components/PostCard';
import PostFeedViewerModal from '../components/PostFeedViewerModal';
import { HEADER_BAR_HEIGHT } from '../components/ScreenHeader';
import { usePosts } from '../hooks/usePosts';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

const SIDE_PAD = 12;
const GAP = 12;

// Heights per layout type
const H = {
  feature:  [s(340), s(310), s(360), s(325), s(350)], // very tall single
  full:     [s(255), s(230), s(275), s(245), s(260)],
  banner:   [s(145), s(160), s(135), s(155), s(148)], // short cinematic
  pair:     [s(195), s(215), s(180), s(225), s(205)],
  trio:     [s(158), s(172), s(148), s(182), s(163)],
  tall:     [s(235), s(255), s(218), s(245), s(228)], // uneven pairs – same row height
  stacked:  [s(118), s(108), s(125), s(112), s(120)], // individual height in stacked col
  quad:     [s(148), s(135), s(158), s(143), s(152)], // 2×2 cells
};

const nth = (arr, i) => arr[i % arr.length];

// 28-entry pattern — takes 64 posts to cycle, feels organic
const PATTERN = [
  'full',           // 1
  'pair',           // 2
  'wide-thin',      // 2  (65/35)
  'trio',           // 3
  'feature',        // 1  very tall
  'stacked-right',  // 3  tall-left | two-stacked-right
  'large-small',    // 2  (60/40)
  'quad',           // 4  2×2 grid
  'banner',         // 1  short cinematic
  'thin-wide',      // 2  (35/65)
  'trio',           // 3
  'stacked-left',   // 3  two-stacked-left | tall-right
  'pair',           // 2
  'feature',        // 1
  'wide-thin',      // 2
  'full',           // 1
  'stacked-right',  // 3
  'small-large',    // 2  (40/60)
  'trio',           // 3
  'banner',         // 1
  'quad',           // 4
  'large-small',    // 2
  'stacked-left',   // 3
  'full',           // 1
  'pair',           // 2
  'thin-wide',      // 2
  'feature',        // 1
  'trio',           // 3
];

const NEEDS = {
  feature: 1, full: 1, banner: 1,
  pair: 2, 'large-small': 2, 'small-large': 2, 'wide-thin': 2, 'thin-wide': 2,
  trio: 3, 'stacked-right': 3, 'stacked-left': 3,
  quad: 4,
};

function buildRows(posts) {
  const rows = [];
  let i = 0;
  let pi = 0;
  while (i < posts.length) {
    const remaining = posts.length - i;
    let type = PATTERN[pi % PATTERN.length];
    pi++;
    const need = NEEDS[type];
    if (remaining < need) {
      if (remaining >= 3) type = 'trio';
      else if (remaining >= 2) type = 'pair';
      else type = 'full';
    }
    rows.push({ type, posts: posts.slice(i, i + NEEDS[type]), startIndex: i });
    i += NEEDS[type];
  }
  return rows;
}

// Tile image that gracefully falls back to a placeholder icon on load errors
function ImageWithFallback({ uri }) {
  const [failed, setFailed] = useState(false);
  const { colors } = useTheme();
  if (failed) {
    return (
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.borderLight }]}>
        <Ionicons name="image-outline" size={28} color={colors.border} />
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

export default function ExploreScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  // Web popup card
  const [selectedPost, setSelectedPost] = useState(null);
  const [postCommentsOpen, setPostCommentsOpen] = useState(false);
  const postModalScrollRef = useRef(null);
  // Mobile full-screen viewer
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex,   setViewerIndex]   = useState(0);

  const { posts, loading, loadingMore, hasMore, loadMore, refresh, deletePost } = usePosts();
  const isLoadingMoreRef = useRef(false);
  const { msgCount: unreadCount } = useUnreadCount();

  const isSearching = query.trim().length > 0;

  // Returns true when `q` matches the beginning of any word in `str`
  const wordStartsWith = (str, q) =>
    str ? str.toLowerCase().split(/[\s\-_]+/).some(w => w.startsWith(q)) : false;

  const filteredPosts = isSearching
    ? posts.filter((p) => {
        const q = query.toLowerCase().replace(/^#/, '');
        const matchesUser =
          wordStartsWith(p.profiles?.username, q) ||
          wordStartsWith(p.profiles?.full_name, q);
        const matchesTag =
          Array.isArray(p.tags) && p.tags.some(t => wordStartsWith(t, q));
        return matchesUser || matchesTag;
      })
    : posts;

  // Fast O(1) lookup: post.id → its index in filteredPosts (used by renderTileInner)
  const postIndexMap = useMemo(
    () => new Map(filteredPosts.map((p, i) => [p.id, i])),
    [filteredPosts],
  );

  const openPost = (item) => {
    if (Platform.OS !== 'web') {
      // Mobile: full-screen viewer starting at this post
      const idx = postIndexMap.get(item.id) ?? 0;
      setViewerIndex(idx);
      setViewerVisible(true);
    } else {
      // Web: existing floating popup card
      setSelectedPost(item);
    }
  };

  const scrapbookRows = useMemo(() => buildRows(filteredPosts), [filteredPosts]);

  // Search dropdown data
  const matchingUsers = isSearching
    ? (() => {
        const q = query.toLowerCase().replace(/^#/, '');
        return [
          ...new Map(
            posts
              .filter((p) => p.profiles && (
                wordStartsWith(p.profiles.username, q) ||
                wordStartsWith(p.profiles.full_name, q)
              ))
              .map((p) => [p.user_id, { userId: p.user_id, ...p.profiles }])
          ).values(),
        ].slice(0, 5);
      })()
    : [];

  const matchingTags = isSearching
    ? (() => {
        const q = query.toLowerCase().replace(/^#/, '');
        if (!q) return [];
        const counts = new Map();
        posts.forEach(p => {
          if (Array.isArray(p.tags)) {
            p.tags.forEach(t => {
              if (wordStartsWith(t, q)) {
                counts.set(t, (counts.get(t) || 0) + 1);
              }
            });
          }
        });
        return [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([tag, count]) => ({ tag, count }));
      })()
    : [];

  const toggleSearch = useCallback(() => {
    if (searchOpen) {
      setSearchOpen(false);
      setQuery('');
      requestAnimationFrame(() => Keyboard.dismiss());
    } else {
      setSearchOpen(true);
    }
  }, [searchOpen]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
    requestAnimationFrame(() => Keyboard.dismiss());
  }, []);

  const handleSelectResult = (userId, isStylist) => {
    closeSearch();
    if (isStylist) {
      navigation.navigate('StylistProfile', { stylist: { id: userId } });
    } else {
      navigation.navigate('UserProfile', { viewedUserId: userId });
    }
  };

  const renderTileInner = (item, height) => {
    const firstImage = item.post_media?.[0]?.media_url;
    const stylistName = item.stylists?.full_name || item.stylists?.username;
    return (
      <TouchableOpacity
        onPress={() => openPost(item)}
        activeOpacity={0.88}
      >
        <View style={[styles.tileImage, { height }]}>
          {firstImage ? (
            <ImageWithFallback uri={firstImage} />
          ) : (
            <View style={styles.tileImagePlaceholder} />
          )}
          {(item.post_media?.length ?? 0) > 1 && (
            <View style={styles.photoDots}>
              {Array.from({ length: Math.min(item.post_media.length, 5) }).map((_, i) => (
                <View key={`${item.id}-dot-${i}`} style={[styles.photoDot, i === 0 && styles.photoDotActive]} />
              ))}
            </View>
          )}
        </View>
        {stylistName ? (
          <View style={styles.tileFooter}>
            <View style={styles.tileFooterRow}>
              <Ionicons name="cut-outline" size={10} color={colors.primary} />
              <Text style={styles.tileFooterStylist} numberOfLines={1}>{stylistName}</Text>
            </View>
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderRow = (row) => {
    const { type, posts: rPosts, startIndex: si } = row;

    switch (type) {
      case 'feature':
        return (
          <View key={`row-${si}`} style={styles.tileShadow}>
            {renderTileInner(rPosts[0], nth(H.feature, si))}
          </View>
        );

      case 'full':
        return (
          <View key={`row-${si}`} style={styles.tileShadow}>
            {renderTileInner(rPosts[0], nth(H.full, si))}
          </View>
        );

      case 'banner':
        return (
          <View key={`row-${si}`} style={styles.tileShadow}>
            {renderTileInner(rPosts[0], nth(H.banner, si))}
          </View>
        );

      case 'pair':
        return (
          <View key={`row-${si}`} style={styles.row}>
            <View style={[styles.flex1, styles.tileShadow]}>
              {renderTileInner(rPosts[0], nth(H.pair, si))}
            </View>
            <View style={[styles.flex1, styles.tileShadow]}>
              {renderTileInner(rPosts[1], nth(H.pair, si + 1))}
            </View>
          </View>
        );

      case 'trio':
        return (
          <View key={`row-${si}`} style={styles.row}>
            {rPosts.map((item, i) => (
              <View key={item.id} style={[styles.flex1, styles.tileShadow]}>
                {renderTileInner(item, nth(H.trio, si + i))}
              </View>
            ))}
          </View>
        );

      case 'large-small':
        return (
          <View key={`row-${si}`} style={styles.row}>
            <View style={[{ flex: 3 }, styles.tileShadow]}>
              {renderTileInner(rPosts[0], nth(H.tall, si))}
            </View>
            <View style={[{ flex: 2 }, styles.tileShadow]}>
              {renderTileInner(rPosts[1], nth(H.tall, si))}
            </View>
          </View>
        );

      case 'small-large':
        return (
          <View key={`row-${si}`} style={styles.row}>
            <View style={[{ flex: 2 }, styles.tileShadow]}>
              {renderTileInner(rPosts[0], nth(H.tall, si))}
            </View>
            <View style={[{ flex: 3 }, styles.tileShadow]}>
              {renderTileInner(rPosts[1], nth(H.tall, si))}
            </View>
          </View>
        );

      case 'wide-thin':
        return (
          <View key={`row-${si}`} style={styles.row}>
            <View style={[{ flex: 4 }, styles.tileShadow]}>
              {renderTileInner(rPosts[0], nth(H.tall, si))}
            </View>
            <View style={[{ flex: 2 }, styles.tileShadow]}>
              {renderTileInner(rPosts[1], nth(H.tall, si))}
            </View>
          </View>
        );

      case 'thin-wide':
        return (
          <View key={`row-${si}`} style={styles.row}>
            <View style={[{ flex: 2 }, styles.tileShadow]}>
              {renderTileInner(rPosts[0], nth(H.tall, si))}
            </View>
            <View style={[{ flex: 4 }, styles.tileShadow]}>
              {renderTileInner(rPosts[1], nth(H.tall, si))}
            </View>
          </View>
        );

      case 'stacked-right': {
        const sh = nth(H.stacked, si);
        const totalH = sh * 2 + GAP;
        return (
          <View key={`row-${si}`} style={styles.row}>
            <View style={[styles.flex1, styles.tileShadow]}>
              {renderTileInner(rPosts[0], totalH)}
            </View>
            <View style={[styles.flex1, { gap: GAP }]}>
              <View style={styles.tileShadow}>{renderTileInner(rPosts[1], sh)}</View>
              <View style={styles.tileShadow}>{renderTileInner(rPosts[2], sh)}</View>
            </View>
          </View>
        );
      }

      case 'stacked-left': {
        const sh = nth(H.stacked, si);
        const totalH = sh * 2 + GAP;
        return (
          <View key={`row-${si}`} style={styles.row}>
            <View style={[styles.flex1, { gap: GAP }]}>
              <View style={styles.tileShadow}>{renderTileInner(rPosts[0], sh)}</View>
              <View style={styles.tileShadow}>{renderTileInner(rPosts[1], sh)}</View>
            </View>
            <View style={[styles.flex1, styles.tileShadow]}>
              {renderTileInner(rPosts[2], totalH)}
            </View>
          </View>
        );
      }

      case 'quad': {
        const qh = nth(H.quad, si);
        return (
          <View key={`row-${si}`} style={{ gap: GAP }}>
            <View style={styles.row}>
              <View style={[styles.flex1, styles.tileShadow]}>{renderTileInner(rPosts[0], qh)}</View>
              <View style={[styles.flex1, styles.tileShadow]}>{renderTileInner(rPosts[1], qh)}</View>
            </View>
            <View style={styles.row}>
              <View style={[styles.flex1, styles.tileShadow]}>{renderTileInner(rPosts[2], qh)}</View>
              <View style={[styles.flex1, styles.tileShadow]}>{renderTileInner(rPosts[3], qh)}</View>
            </View>
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerIcon}
            onPress={toggleSearch}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name={searchOpen ? 'close-outline' : 'search-outline'} size={22} color={colors.text} />
          </Pressable>

          {Platform.OS !== 'web' && <Text style={styles.headerLogo} pointerEvents="none">crwn.</Text>}

          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.navigate('Messaging')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* ── Collapsible Search ── */}
      <View style={styles.searchAreaWrapper}>
        {searchOpen && (
          <View style={styles.searchBarRow}>
            <SearchBar value={query} onChangeText={setQuery} />
          </View>
        )}

        {searchOpen && isSearching && (
          <View style={styles.dropdown}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 300 }}
            >
              {matchingUsers.length > 0 && (
                <>
                  <Text style={styles.dropdownSection}>People</Text>
                  {matchingUsers.map((u) => (
                    <TouchableOpacity
                      key={u.userId}
                      style={styles.dropdownRow}
                      onPress={() => handleSelectResult(u.userId, u.is_stylist)}
                    >
                      {u.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={styles.dropdownAvatar} />
                      ) : (
                        <View style={styles.dropdownAvatarPlaceholder}>
                          <Ionicons name="person" size={16} color="#9ca3af" />
                        </View>
                      )}
                      <View style={styles.dropdownRowText}>
                        <Text style={styles.dropdownUsername}>@{u.username || 'user'}</Text>
                        {u.full_name ? <Text style={styles.dropdownMeta}>{u.full_name}</Text> : null}
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {matchingTags.length > 0 && (
                <>
                  <Text style={styles.dropdownSection}>Tags</Text>
                  {matchingTags.map(({ tag, count }) => (
                    <TouchableOpacity
                      key={tag}
                      style={styles.dropdownRow}
                      onPress={() => setQuery(`#${tag}`)}
                    >
                      <Ionicons name="pricetag-outline" size={18} color="#9ca3af" style={{ marginRight: 12 }} />
                      <View style={styles.dropdownRowText}>
                        <Text style={styles.dropdownUsername}>#{tag}</Text>
                        <Text style={styles.dropdownMeta}>{count} post{count !== 1 ? 's' : ''}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {matchingUsers.length === 0 && matchingTags.length === 0 && (
                <View style={styles.dropdownEmpty}>
                  <Text style={styles.dropdownEmptyText}>No results for "{query}"</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* ── Scrapbook Grid ── */}
      <ScrollView
        style={[styles.scroll, webWrap(WEB_MAX_WIDTHS.grid)]}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={400}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        onScroll={({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
          const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 300;
          if (nearBottom && hasMore && !loadingMore && !isLoadingMoreRef.current) {
            isLoadingMoreRef.current = true;
            loadMore().finally(() => { isLoadingMoreRef.current = false; });
          }
        }}
      >
        {scrapbookRows.map(renderRow)}

        {/* Bottom pagination feedback */}
        {loadingMore && (
          <ActivityIndicator
            color={colors.primary}
            style={{ paddingVertical: 24 }}
          />
        )}
        {!hasMore && posts.length > 0 && !loading && (
          <View style={styles.endOfFeed}>
            <View style={[styles.endOfFeedLine, { backgroundColor: colors.borderLight }]} />
            <Text style={[styles.endOfFeedText, { color: colors.textMuted }]}>You're all caught up</Text>
            <View style={[styles.endOfFeedLine, { backgroundColor: colors.borderLight }]} />
          </View>
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CreatePost')}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#5D1F1F', '#C8835A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* ── Mobile: full-screen post viewer (tap tile → viewer, scroll for next) ── */}
      {Platform.OS !== 'web' && (
        <PostFeedViewerModal
          visible={viewerVisible}
          posts={filteredPosts}
          initialIndex={viewerIndex}
          onClose={() => setViewerVisible(false)}
          onDelete={async (postId, userId) => {
            const result = await deletePost(postId, userId);
            if (result?.success) setViewerVisible(false);
            return result;
          }}
          onNavigateToProfile={(userId) => {
            setViewerVisible(false);
            setTimeout(() => navigation.navigate('UserProfile', { viewedUserId: userId }), 250);
          }}
          onNavigateToStylist={(stylistId) => {
            setViewerVisible(false);
            setTimeout(() => navigation.navigate('StylistProfile', { stylist: { id: stylistId } }), 250);
          }}
        />
      )}

      {/* ── Web: floating popup card (unchanged) ── */}
      {Platform.OS === 'web' && (
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
                postCommentsOpen ? styles.popupCardWebWide : styles.popupCardWeb,
              ]}
              onPress={() => {}}
            >
              <ScrollView ref={postModalScrollRef} showsVerticalScrollIndicator={false} bounces={false}>
                {selectedPost && (
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
                    onNavigateToProfile={(userId) => {
                      setSelectedPost(null);
                      setPostCommentsOpen(false);
                      navigation.navigate('UserProfile', { viewedUserId: userId });
                    }}
                    onNavigateToStylist={(stylistId) => {
                      const st = selectedPost?.stylists;
                      setSelectedPost(null);
                      setPostCommentsOpen(false);
                      navigation.navigate('StylistProfile', {
                        stylist: {
                          id: stylistId,
                          name: st?.full_name || st?.username || 'Stylist',
                        },
                      });
                    }}
                  />
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.surface },
  safeHeader: { backgroundColor: c.surface },

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
  headerLogo: {
    fontSize: 24,
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
  badge: {
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
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontFamily: 'Figtree_700Bold',
    lineHeight: 12,
  },

  // ── Search ──
  searchAreaWrapper: {
    zIndex: 100,
    elevation: 100,
    backgroundColor: c.surface,
  },
  searchBarRow: {
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  dropdown: {
    position: 'absolute',
    top: 60,
    left: 12,
    right: 12,
    backgroundColor: c.surface,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: c.isDark ? 0 : 0.12,
    shadowRadius: 12,
    elevation: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderLight,
  },
  dropdownSection: {
    fontSize: 11,
    fontFamily: 'Figtree_700Bold',
    color: c.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dropdownAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  dropdownAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  dropdownRowText: { flex: 1 },
  dropdownUsername: { fontSize: 14, fontFamily: 'Figtree_600SemiBold', color: c.text },
  dropdownCaption: { fontSize: 14, fontFamily: 'Figtree_500Medium', color: c.text },
  dropdownMeta: { fontSize: 12, color: c.textMuted, marginTop: 1 },
  dropdownEmpty: { paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center' },
  dropdownEmptyText: { fontSize: 14, color: c.textMuted },

  // ── Scrapbook grid ──
  scroll: { flex: 1 },
  grid: {
    paddingHorizontal: SIDE_PAD,
    paddingTop: 12,
    paddingBottom: 100,
    gap: GAP,
  },

  fullTile: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    gap: GAP,
  },
  flex1: {
    flex: 1,
  },
  tileShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Image container
  tileImage: {
    width: '100%',
    borderRadius: 5.5,
    overflow: 'hidden',
    backgroundColor: c.borderLight,
  },
  tileImagePlaceholder: {
    flex: 1,
    backgroundColor: c.border,
  },
  tileFooter: {
    paddingHorizontal: 7,
    paddingTop: 5,
    paddingBottom: 5,
    gap: 3,
    backgroundColor: c.surface,
  },
  tileFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tileFooterStylist: {
    fontSize: 11,
    fontFamily: 'Figtree_600SemiBold',
    color: c.primary,
    flex: 1,
  },
  photoDots: {
    position: 'absolute',
    bottom: 7,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  photoDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  photoDotActive: {
    backgroundColor: '#fff',
    width: 6,
    height: 6,
  },

  // ── FAB ──
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    shadowColor: c.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },

  // ── End-of-feed ──
  endOfFeed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  endOfFeedLine: {
    flex: 1,
    height: 1,
  },
  endOfFeedText: {
    fontSize: 12,
    fontFamily: 'Figtree_500Medium',
  },

  // ── Post popup ──
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  popupCard: {
    width: '100%',
    maxHeight: '78%',
    backgroundColor: c.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  popupCardWeb: {
    maxWidth: 460,
    maxHeight: '82%',
  },
  popupCardWebWide: {
    maxWidth: 800,
    width: '95vw',
    maxHeight: '92%',
  },
});
