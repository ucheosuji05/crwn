import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Platform } from 'react-native';
import { webWrap, WEB_MAX_WIDTHS, useIsWebLayout } from '../utils/webLayout';
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
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Scissors, Plus, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import SearchBar from '../components/SearchBar';
import CreatePostMenu from '../components/CreatePostMenu';
import PostCard from '../components/PostCard';
import SkeletonPulse from '../components/SkeletonPulse';
import { HEADER_BAR_HEIGHT } from '../components/ScreenHeader';
import { usePosts } from '../hooks/usePosts';
import { useAuth } from '../hooks/useAuth';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../config/supabase';
import { postService } from '../services/postService';

export const SIDE_PAD = 12;
export const COLUMN_GAP = 10;
export const CARD_RADIUS = 16;
export const DEFAULT_AR = 1 / 1.2; // ~0.83 — portrait (1.2:1 height:width) fallback until real dims load
const TOPIC_ASPECT_RATIO = 1.6; // width:height — short, wide accent tile

// ── Aspect-ratio buckets (height:width) used to balance the masonry order ──
const HW_LANDSCAPE_MAX = 0.8;  // shorter than this → landscape, spans full width
const HW_SQUARE_MAX = 1.1;     // square-ish
const HW_PORTRAIT_MAX = 1.6;   // portrait
// anything taller than HW_PORTRAIT_MAX → "tall portrait"
const MAX_RENDER_HW = 1.6; // cap a card's rendered height at 1.6x its width — resizeMode 'cover' crops any overflow

function bucketFor(hw, kind) {
  if (kind === 'topic') return 'topic';
  if (hw < HW_LANDSCAPE_MAX) return 'landscape';
  if (hw <= HW_SQUARE_MAX) return 'square';
  if (hw <= HW_PORTRAIT_MAX) return 'portrait';
  return 'tall';
}


// ── Topic filler cards ────────────────────────────────────────────────────────
const TOPIC_TAGS = ['island twists', 'wash n go', 'silk press', 'locs', 'type 4', 'protective styles'];
// Diagonal (160deg) gradient pairs, rotated through as topic cards are seeded
const TOPIC_GRADIENTS = [
  ['#2A3D2A', '#3F523F'], // green
  ['#3D0A0A', '#5D1F1F'], // maroon
  ['#5D2E0C', '#B35D2B'], // ochre
  ['#2A1F0A', '#4F4032'], // brown
  ['#8B6914', '#C2B093'], // champagne
  ['#6B4A2A', '#A07850'], // rust/tan
];
const TOPIC_FIRST_INDEX = 6;
const TOPIC_INTERVAL = 8; // ~6-8 posts apart → seeded at indices 6, 14, 22…

// Interleaves TopicCards into the post feed at indices 6, 14, 22…
function buildFeedItems(posts, topicTags = TOPIC_TAGS) {
  const items = [];
  let nextTopicAt = TOPIC_FIRST_INDEX;
  let topicIndex = 0;

  posts.forEach((post, i) => {
    if (i === nextTopicAt) {
      const tag = topicTags[topicIndex % topicTags.length];
      const gradient = TOPIC_GRADIENTS[topicIndex % TOPIC_GRADIENTS.length];
      items.push({
        kind: 'topic',
        key: `topic-${topicIndex}`,
        tag,
        tagSlug: tag.replace(/\s+/g, '').toLowerCase(),
        gradient,
      });
      topicIndex += 1;
      nextTopicAt += TOPIC_INTERVAL;
    }
    items.push({ kind: 'post', key: post.id, post });
  });

  return items;
}

// Balanced masonry: items are pulled from a shared pool (in their original
// relative order) and slotted wherever they best minimize blank space —
// display-order only, nothing is dropped or added.
//
// Rules:
// - Landscape cards (height:width < 0.8) span full width, but only when both
//   columns are within 20px of level — otherwise they wait their turn. Two
//   full-width cards never land back to back; a two-column row is forced
//   between them
// - Tall-portrait cards (height:width > 1.6) never stack back to back in the
//   same column; a topic / square / portrait card is pulled forward to break
//   up the run and keep both columns close in height
// - Every card's rendered height is capped at a 1.6:1 (height:width) ratio —
//   resizeMode 'cover' crops any overflow so extremely tall images never
//   blow out their allocated slot
export function computeMasonryLayout(feedItems, columnWidth, imageDimensions) {
  const gap = COLUMN_GAP;
  const fullWidth = columnWidth * 2 + gap;
  let leftH = 0;
  let rightH = 0;
  const items = [];

  const pool = feedItems.map(entry => {
    let ar = DEFAULT_AR;
    if (entry.kind === 'post') {
      const dims = imageDimensions[entry.post.id];
      ar = dims ? dims.width / dims.height : DEFAULT_AR;
    } else if (entry.kind === 'topic') {
      ar = TOPIC_ASPECT_RATIO;
    }
    const hw = 1 / ar;
    return { entry, ar, renderAr: Math.max(ar, 1 / MAX_RENDER_HW), bucket: bucketFor(hw, entry.kind) };
  });

  const takeFirst = (predicate) => {
    const idx = pool.findIndex(predicate);
    return idx === -1 ? null : pool.splice(idx, 1)[0];
  };
  const isFiller = (p) => p.bucket === 'topic' || p.bucket === 'square' || p.bucket === 'portrait';

  let lastLeftBucket = null;
  let lastRightBucket = null;
  let lastWasFull = false;

  while (pool.length) {
    // Place a full-width landscape card once the columns are roughly level —
    // but never directly after another full-width card
    if (!lastWasFull && Math.abs(leftH - rightH) <= 20) {
      const landscape = takeFirst(p => p.bucket === 'landscape');
      if (landscape) {
        const top = Math.max(leftH, rightH);
        const h = fullWidth / landscape.renderAr;
        items.push({ entry: landscape.entry, column: 'full', top, height: h });
        const nextH = top + h + gap;
        leftH = nextH;
        rightH = nextH;
        lastLeftBucket = lastRightBucket = 'landscape';
        lastWasFull = true;
        continue;
      }
    }

    const useLeft = leftH <= rightH;
    const lastBucket = useLeft ? lastLeftBucket : lastRightBucket;

    // Avoid two tall-portrait cards back to back in the same column —
    // pull a shorter filler card (topic/square/portrait) forward instead
    const pick = (lastBucket === 'tall' ? takeFirst(isFiller) : null)
      || takeFirst(p => p.bucket !== 'landscape')
      || takeFirst(() => true);
    if (!pick) break;

    lastWasFull = false;
    const h = columnWidth / pick.renderAr;
    if (useLeft) {
      items.push({ entry: pick.entry, column: 'left', top: leftH, height: h });
      leftH += h + gap;
      lastLeftBucket = pick.bucket;
    } else {
      items.push({ entry: pick.entry, column: 'right', top: rightH, height: h });
      rightH += h + gap;
      lastRightBucket = pick.bucket;
    }
  }

  return { items, totalHeight: Math.max(leftH, rightH) };
}

function TopicCard({ tag, gradient, style, onPress }) {
  return (
    <TouchableOpacity style={style} onPress={onPress} activeOpacity={0.85}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0.33, y: 0.02 }}
        end={{ x: 0.67, y: 0.98 }}
        style={[StyleSheet.absoluteFill, { borderRadius: CARD_RADIUS }]}
      />
      <Text style={topicStyles.label} numberOfLines={1}>
        #{tag.replace(/\s+/g, '').toLowerCase()}
      </Text>
    </TouchableOpacity>
  );
}

const topicStyles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    color: '#FCFCFC',
    letterSpacing: 0.3,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});

// Full-grid skeleton shown while the very first page of posts is loading
const SKELETON_HEIGHTS = [220, 180, 200, 240, 190, 210, 230, 170];

function ExploreSkeletonGrid({ styles }) {
  const leftHeights = SKELETON_HEIGHTS.filter((_, i) => i % 2 === 0);
  const rightHeights = SKELETON_HEIGHTS.filter((_, i) => i % 2 === 1);
  return (
    <View style={styles.skeletonRow}>
      <View style={styles.skeletonCol}>
        {leftHeights.map((h, i) => (
          <SkeletonPulse key={`l${i}`} style={[styles.skeletonCard, { height: h }]} />
        ))}
      </View>
      <View style={styles.skeletonCol}>
        {rightHeights.map((h, i) => (
          <SkeletonPulse key={`r${i}`} style={[styles.skeletonCard, { height: h }]} />
        ))}
      </View>
    </View>
  );
}

export function ImageWithFallback({ uri }) {
  const [status, setStatus] = useState('loading'); // 'loading' | 'loaded' | 'failed'
  const { colors } = useTheme();

  useEffect(() => {
    setStatus('loading');
  }, [uri]);

  if (status === 'failed') {
    return (
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.borderLight }]}> 
        <Ionicons name="image-outline" size={28} color={colors.border} />
      </View>
    );
  }

  return (
    <>
      {status === 'loading' && <SkeletonPulse style={StyleSheet.absoluteFill} />}
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('failed')}
      />
    </>
  );
}

export default function ExploreScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const isWebLayout = useIsWebLayout();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');
  // Natural state: search icon + tag row, no text input. Tapping the icon
  // reveals the search bar; the tag chip row stays visible either way.
  const [searchOpen, setSearchOpen] = useState(false);
  // Controls the TAGS/People suggestion dropdown independently of whether
  // there's query text — lets us keep the query (and its filter) after
  // selecting a suggestion while still dismissing the dropdown.
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeFilter, setActiveFilter] = useState('All');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  // Web popup card
  const [selectedPost, setSelectedPost] = useState(null);
  const [postCommentsOpen, setPostCommentsOpen] = useState(false);
  const postModalScrollRef = useRef(null);

  // Sticky header: the CRWN title row collapses on scroll down and reappears
  // once the user scrolls back to the top. Search bar + tag chips stay pinned.
  const titleAnim = useRef(new Animated.Value(1)).current; // 1 = expanded, 0 = collapsed
  const titleVisibleRef = useRef(true);
  const lastScrollYRef = useRef(0);

  // Close the post modal when navigating away (e.g. tapping a hashtag on web)
  useFocusEffect(useCallback(() => () => setSelectedPost(null), []));

  // Masonry layout state
  const [imageDimensions, setImageDimensions] = useState({});
  const [containerWidth, setContainerWidth] = useState(0);
  const fetchedRef = useRef(new Set());
  const pendingDimsRef = useRef({});
  const rafRef = useRef(null);

  const { posts, loading, loadingMore, hasMore, loadMore, refresh } = usePosts();
  const isLoadingMoreRef = useRef(false);

  // Live user search against the profiles table (all users, not just those in the feed)
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [usersSearching, setUsersSearching] = useState(false);
  const userSearchTimerRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) { setUserSearchResults([]); setUsersSearching(false); return; }
    setUsersSearching(true);
    clearTimeout(userSearchTimerRef.current);
    userSearchTimerRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, is_stylist')
        .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(8);
      setUserSearchResults((data || []).map(u => ({ ...u, userId: u.id })));
      setUsersSearching(false);
    }, 300);
    return () => clearTimeout(userSearchTimerRef.current);
  }, [query]);
  const { msgCount: unreadCount } = useUnreadCount();

  const isSearching = query.trim().length > 0;

  const wordStartsWith = (str, q) =>
    str ? str.toLowerCase().split(/[\s\-_]+/).some(w => w.startsWith(q)) : false;

  // Deduplicate posts by ID to prevent React key warnings during pagination or optimistic updates
  const uniquePosts = [...new Map(posts.map(p => [p.id, p])).values()];

  const filteredPosts = useMemo(() => {
    let list = uniquePosts;
    if (isSearching) {
      list = list.filter((p) => {
        const q = query.toLowerCase().replace(/^#/, '');
        const matchesUser =
          wordStartsWith(p.profiles?.username, q) ||
          wordStartsWith(p.profiles?.full_name, q);
        const matchesTag =
          Array.isArray(p.tags) && p.tags.some(t => wordStartsWith(t, q));
        return matchesUser || matchesTag;
      });
    }
    if (activeFilter !== 'All') {
      list = list.filter((p) =>
        Array.isArray(p.tags) && p.tags.some(t => t.toLowerCase() === activeFilter.toLowerCase())
      );
    }
    return list;
  }, [uniquePosts, isSearching, query, activeFilter]);

  // Batch dimension updates into a single setState per animation frame
  const flushDims = useCallback(() => {
    const pending = pendingDimsRef.current;
    if (Object.keys(pending).length === 0) return;
    pendingDimsRef.current = {};
    setImageDimensions(prev => ({ ...prev, ...pending }));
    rafRef.current = null;
  }, []);

  useEffect(() => {
    filteredPosts.forEach(post => {
      const uri = post.post_media?.[0]?.media_url;
      if (!uri || fetchedRef.current.has(post.id)) return;
      fetchedRef.current.add(post.id);
      Image.getSize(
        uri,
        (w, h) => {
          pendingDimsRef.current[post.id] = { width: w, height: h };
          if (!rafRef.current) rafRef.current = requestAnimationFrame(flushDims);
        },
        () => {
          pendingDimsRef.current[post.id] = { width: 1, height: 1 };
          if (!rafRef.current) rafRef.current = requestAnimationFrame(flushDims);
        },
      );
    });
  }, [filteredPosts, flushDims]);

  const columnWidth = containerWidth > 0
    ? (containerWidth - SIDE_PAD * 2 - COLUMN_GAP) / 2
    : 0;

  // Count tag frequency across all loaded posts; fall back to static list if DB has none yet
  const popularTags = useMemo(() => {
    const counts = {};
    for (const post of uniquePosts) {
      for (const tag of (post.tags || [])) {
        counts[tag] = (counts[tag] || 0) + 1;
      }
    }
    const sorted = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([tag]) => tag);
    return sorted.length >= 2 ? sorted : TOPIC_TAGS;
  }, [uniquePosts]);

  // Filter pills: "All" plus the real hashtags users have applied to Explore posts
  const exploreFilters = useMemo(() => ['All', ...popularTags], [popularTags]);

  useEffect(() => {
    if (!exploreFilters.includes(activeFilter)) setActiveFilter('All');
  }, [exploreFilters]);

  // Topic filler cards are only seeded into the main feed, not search results
  const feedItems = useMemo(
    () => isSearching
      ? filteredPosts.map(post => ({ kind: 'post', key: post.id, post }))
      : buildFeedItems(filteredPosts, popularTags),
    [filteredPosts, isSearching, popularTags],
  );

  const masonryLayout = useMemo(
    () => columnWidth > 0
      ? computeMasonryLayout(feedItems, columnWidth, imageDimensions)
      : { items: [], totalHeight: 0 },
    [feedItems, columnWidth, imageDimensions],
  );

  const openPost = useCallback((item) => {
    if (Platform.OS !== 'web') {
      navigation.push('PostDetail', { postId: item.id });
    } else {
      setSelectedPost(item);
    }
  }, [navigation]);

  // Search dropdown data — live DB results replace the old post-derived list
  const matchingUsers = isSearching ? userSearchResults : [];

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

  // Hides the search input and returns to the natural state (search icon +
  // tag row), clearing the query and dismissing the keyboard.
  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setQuery('');
    setShowDropdown(false);
    requestAnimationFrame(() => Keyboard.dismiss());
  }, []);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
  }, []);

  // Show the suggestion dropdown again whenever the user types; selecting a
  // suggestion hides it explicitly (see matchingTags/matchingUsers handlers).
  const handleQueryChange = useCallback((text) => {
    setQuery(text);
    setShowDropdown(text.trim().length > 0);
  }, []);

  // Applies a tag as the search query and dismisses the suggestion dropdown
  // (but keeps the query itself so the filter it just applied still shows).
  const handleSelectTag = useCallback((tag) => {
    setQuery(`#${tag}`);
    setActiveFilter(tag);
    setShowDropdown(false);
    requestAnimationFrame(() => Keyboard.dismiss());
  }, []);

  // Collapse the CRWN title row on scroll down, restore it once back at the
  // top. Height isn't supported by the native driver, so this animation runs
  // on the JS thread (the underlying onScroll listener itself still fires
  // natively — useNativeDriver is only unavailable for the height/opacity
  // animation this listener drives).
  const animateTitle = useCallback((toValue) => {
    Animated.timing(titleAnim, { toValue, duration: 220, useNativeDriver: false }).start();
  }, [titleAnim]);

  const handleGridScroll = useCallback(({ nativeEvent: { layoutMeasurement, contentOffset, contentSize } }) => {
    const y = contentOffset.y;
    const goingDown = y > lastScrollYRef.current;

    if (y <= 0 && !titleVisibleRef.current) {
      titleVisibleRef.current = true;
      animateTitle(1);
    } else if (goingDown && y > 8 && titleVisibleRef.current) {
      titleVisibleRef.current = false;
      animateTitle(0);
    }
    lastScrollYRef.current = y;

    const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 300;
    if (nearBottom && hasMore && !loadingMore && !isLoadingMoreRef.current) {
      isLoadingMoreRef.current = true;
      loadMore().finally(() => { isLoadingMoreRef.current = false; });
    }
  }, [animateTitle, hasMore, loadingMore, loadMore]);

  const handleSelectResult = (userId, isStylist) => {
    closeSearch();
    if (isStylist) {
      navigation.navigate('StylistProfile', { stylist: { id: userId } });
    } else {
      navigation.navigate('UserProfile', { viewedUserId: userId });
    }
  };

  const renderMasonryItem = (item) => {
    const { entry, column, top, height } = item;

    let left, width;
    if (column === 'full') {
      left = 0;
      width = columnWidth * 2 + COLUMN_GAP;
    } else if (column === 'left') {
      left = 0;
      width = columnWidth;
    } else {
      left = columnWidth + COLUMN_GAP;
      width = columnWidth;
    }

    const positionStyle = { position: 'absolute', left, top, width, height };

    if (entry.kind === 'topic') {
      return (
        <TopicCard
          key={entry.key}
          tag={entry.tag}
          gradient={entry.gradient}
          style={[styles.card, positionStyle]}
          onPress={() => navigation.navigate('FilteredExplore', { tag: entry.tagSlug })}
        />
      );
    }

    const { post } = entry;
    const uri = post.post_media?.[0]?.media_url;
    const stylistName = post.stylists?.full_name || post.stylists?.username;

    return (
      <TouchableOpacity
        key={post.id}
        style={[styles.card, positionStyle]}
        onPress={() => openPost(post)}
        activeOpacity={0.88}
      >
        {uri ? (
          <ImageWithFallback uri={uri} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.borderLight }]} />
        )}

        {/* Stylist tag — frosted glass pill over a dark gradient, bottom-left, only when stylist linked */}
        {stylistName && (
          <>
            <LinearGradient
              colors={['transparent', 'rgba(26,22,18,0.9)']}
              locations={[0, 1]}
              style={styles.stylistGradient}
              pointerEvents="none"
            />
            <View style={styles.stylistTag}>
              <Scissors size={12} color="#fff" strokeWidth={1.5} />
              <Text style={styles.stylistName} numberOfLines={1}>{stylistName}</Text>
            </View>
          </>
        )}

        {/* Multi-image dots */}
        {(post.post_media?.length ?? 0) > 1 && (
          <View style={styles.photoDots}>
            {Array.from({ length: Math.min(post.post_media.length, 5) }).map((_, i) => (
              <View key={`${post.id}-dot-${i}`} style={[styles.photoDot, i === 0 && styles.photoDotActive]} />
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ── Header — collapses on scroll down, reappears at the top ── */}
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <Animated.View
          style={[
            styles.header,
            {
              height: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [0, HEADER_BAR_HEIGHT] }),
              opacity: titleAnim,
            },
          ]}
        >
          {searchOpen ? (
            <View style={styles.headerIcon} />
          ) : (
            <Pressable
              style={styles.headerIcon}
              onPress={openSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="search-outline" size={22} color={colors.text} />
            </Pressable>
          )}

          <Text style={styles.headerLogo} pointerEvents="none">crwn.</Text>

          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.navigate('Messaging')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="mail-outline" size={22} color={colors.text} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>

      {/* ── Tag row always pinned; search input only shown when opened ── */}
      <View style={styles.searchAreaWrapper}>
        <View style={styles.searchDropdown}>
          {searchOpen && (
            <View style={styles.searchRow}>
              <Pressable
                style={styles.searchToggleBtn}
                onPress={closeSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-outline" size={22} color={colors.text} />
              </Pressable>
              <View style={styles.searchBarWrap}>
                <SearchBar
                  value={query}
                  onChangeText={handleQueryChange}
                  containerStyle={styles.searchBarInner}
                />
              </View>
            </View>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContent}
            keyboardShouldPersistTaps="handled"
          >
            {exploreFilters.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                onPress={() => setActiveFilter(prev => (f !== 'All' && prev === f) ? 'All' : f)}
              >
                <Text style={[styles.filterChipText, activeFilter === f && styles.filterChipTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {isSearching && showDropdown && (
          <View style={styles.dropdown}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 300 }}
            >
              {usersSearching && (
                <ActivityIndicator size="small" color="#9ca3af" style={{ paddingVertical: 12 }} />
              )}

              {!usersSearching && matchingUsers.length > 0 && (
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
                      onPress={() => handleSelectTag(tag)}
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

              {!usersSearching && matchingUsers.length === 0 && matchingTags.length === 0 && (
                <View style={styles.dropdownEmpty}>
                  <Text style={styles.dropdownEmptyText}>No results for "{query}"</Text>
                </View>
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* ── Masonry Grid ── */}
      <ScrollView
        style={[styles.scroll, webWrap(WEB_MAX_WIDTHS.grid)]}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
        onScroll={handleGridScroll}
      >
        {/* Absolutely-positioned masonry canvas */}
        {loading && uniquePosts.length === 0 ? (
          <ExploreSkeletonGrid styles={styles} />
        ) : (
          <View style={[styles.masonryCanvas, { height: masonryLayout.totalHeight }]}>
            {masonryLayout.items.map(renderMasonryItem)}
          </View>
        )}

        {loadingMore && (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 24 }} />
        )}
        {!hasMore && posts.length > 0 && !loading && (
          <View style={styles.endOfFeed}>
            <View style={[styles.endOfFeedLine, { backgroundColor: colors.borderLight }]} />
            <Text style={[styles.endOfFeedText, { color: colors.textMuted }]}>You're all caught up</Text>
            <View style={[styles.endOfFeedLine, { backgroundColor: colors.borderLight }]} />
          </View>
        )}
      </ScrollView>

      {/* ── FAB — burnt ochre → maroon gradient circle ── */}
      <CreatePostMenu
        visible={createMenuOpen}
        onClose={() => setCreateMenuOpen(false)}
        onSelectExplore={() => {
          setCreateMenuOpen(false);
          navigation.navigate('CreatePost');
        }}
        onSelectCommunity={() => {
          setCreateMenuOpen(false);
          navigation.navigate('MainTabs', { screen: 'Community', params: { openCreate: true } });
        }}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => setCreateMenuOpen((open) => !open)}
        activeOpacity={0.85}
      >
        {createMenuOpen ? (
          <View style={styles.fabClose}>
            <X size={24} color="#5D1F1F" strokeWidth={2.5} />
          </View>
        ) : (
          <LinearGradient
            colors={['#5D1F1F', '#7D3F1D', '#B35D2B']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.fabGradient}
          >
            <Plus size={24} color="#fff" strokeWidth={2} />
          </LinearGradient>
        )}
      </TouchableOpacity>

      {/* ── Web: floating popup card (all web sizes) ── */}
      {/* Rendered inside ExploreScreen's root View so it only covers the grid,
          leaving the header and bottom tab bar visible. */}
      {Platform.OS === 'web' && !!selectedPost && (
        <Pressable
          style={styles.backdrop}
          onPress={() => { setSelectedPost(null); setPostCommentsOpen(false); }}
        >
          <Pressable
            style={[
              styles.popupCard,
              isWebLayout
                ? (postCommentsOpen ? styles.popupCardWebWide : styles.popupCardWeb)
                : styles.popupCardNarrow,
            ]}
            onPress={() => {}}
          >
            <ScrollView ref={postModalScrollRef} showsVerticalScrollIndicator={false} bounces={false}>
              <PostCard
                post={selectedPost}
                currentUserId={user?.id}
                scrollViewRef={postModalScrollRef}
                onCommentsOpenChange={setPostCommentsOpen}
                onDelete={async (postId) => {
                  const result = await postService.deletePost(postId);
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
            </ScrollView>
          </Pressable>
        </Pressable>
      )}
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.surface },
  safeHeader: { backgroundColor: '#FFFFFF' },

  // ── Header ──
  header: {
    height: HEADER_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
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
  searchDropdown: {
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10,
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
  dropdownMeta: { fontSize: 12, fontFamily: 'Figtree_500Medium', color: c.textMuted, marginTop: 1 },
  dropdownEmpty: { paddingHorizontal: 16, paddingVertical: 20, alignItems: 'center' },
  dropdownEmptyText: { fontSize: 14, fontFamily: 'Figtree_500Medium', color: c.textMuted },

  // ── Filter chips ──
  filterContent: {
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
    backgroundColor: 'rgba(232, 226, 217, 0.4)',
  },
  filterChipActive: {
    backgroundColor: c.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    color: '#5E5E5E',
  },
  filterChipTextActive: {
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    color: '#fff',
  },

  // ── Masonry grid ──
  scroll: { flex: 1 },
  gridContent: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  masonryCanvas: {
    marginHorizontal: SIDE_PAD,
  },

  // ── Initial-load skeleton grid ──
  skeletonRow: {
    flexDirection: 'row',
    gap: COLUMN_GAP,
    marginHorizontal: SIDE_PAD,
  },
  skeletonCol: { flex: 1, gap: COLUMN_GAP },
  skeletonCard: { borderRadius: CARD_RADIUS },

  // ── Card ──
  card: {
    position: 'relative',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: c.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Dark gradient behind the stylist tag — solid near the bottom edge,
  // fading to transparent about halfway up the card for legibility
  stylistGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  // Frosted-glass pill overlaid on the image, bottom-left
  stylistTag: {
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
  stylistName: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Figtree_500Medium',
    marginLeft: 4,
  },
  photoDots: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
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
    borderRadius: 999,
    zIndex: 50,
    shadowColor: '#B35D2B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabClose: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.borderLight,
  },

  // ── End-of-feed ──
  endOfFeed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  endOfFeedLine: { flex: 1, height: 1 },
  endOfFeedText: {
    fontSize: 12,
    fontFamily: 'Figtree_500Medium',
  },

  // ── Web popup card ──
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 200,
  },
  popupCard: {
    width: '100%',
    maxHeight: '88%',
    backgroundColor: c.surface,
    borderRadius: 20,
    overflow: 'hidden',
    zIndex: 201,
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
  popupCardNarrow: {
    width: '100%',
    maxHeight: '92%',
  },
});
