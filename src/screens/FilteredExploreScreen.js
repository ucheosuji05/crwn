import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Platform,
} from 'react-native';

const SIDEBAR_WIDTH = 210;
import { Ionicons } from '@expo/vector-icons';
import { Scissors } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { webWrap, WEB_MAX_WIDTHS } from '../utils/webLayout';
import { HEADER_BAR_HEIGHT } from '../components/ScreenHeader';
import { postService } from '../services/postService';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import {
  SIDE_PAD,
  COLUMN_GAP,
  CARD_RADIUS,
  computeMasonryLayout,
  ImageWithFallback,
} from './ExploreScreen';

export default function FilteredExploreScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tag = route.params?.tag || '';

  const { width: windowWidth } = useWindowDimensions();
  const effectiveWidth = Platform.OS === 'web'
    ? Math.min(windowWidth - SIDEBAR_WIDTH, WEB_MAX_WIDTHS.grid)
    : windowWidth;
  const containerWidth = effectiveWidth - SIDE_PAD * 2;

  const [imageDimensions, setImageDimensions] = useState({});
  const fetchedRef = useRef(new Set());
  const pendingDimsRef = useRef({});
  const rafRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await postService.getPostsByTag(tag);
    setPosts(data || []);
    setLoading(false);
  }, [tag]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const refresh = loadPosts;
  const matchingPosts = posts;

  const flushDims = useCallback(() => {
    const pending = pendingDimsRef.current;
    if (Object.keys(pending).length === 0) return;
    pendingDimsRef.current = {};
    setImageDimensions(prev => ({ ...prev, ...pending }));
    rafRef.current = null;
  }, []);

  useEffect(() => {
    matchingPosts.forEach(post => {
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
  }, [matchingPosts, flushDims]);

  const columnWidth = containerWidth > 0
    ? (containerWidth - COLUMN_GAP) / 2
    : 0;

  const feedItems = useMemo(
    () => matchingPosts.map(post => ({ kind: 'post', key: post.id, post })),
    [matchingPosts],
  );

  const masonryLayout = useMemo(
    () => columnWidth > 0
      ? computeMasonryLayout(feedItems, columnWidth, imageDimensions)
      : { items: [], totalHeight: 0 },
    [feedItems, columnWidth, imageDimensions],
  );

  const openPost = useCallback((item) => {
    navigation.navigate('PostDetail', { postId: item.id });
  }, [navigation]);

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
      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.headerLogo} pointerEvents="none">#{tag}</Text>

          <View style={styles.headerIcon} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={[styles.scroll, webWrap(WEB_MAX_WIDTHS.grid)]}
        contentContainerStyle={styles.gridContent}
        showsVerticalScrollIndicator={true}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {matchingPosts.length === 0 && !loading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTag}>#{tag}</Text>
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        ) : (
          <View style={[styles.masonryCanvas, { height: masonryLayout.totalHeight }]}>
            {masonryLayout.items.map(renderMasonryItem)}
          </View>
        )}

        {loading && matchingPosts.length === 0 && (
          <ActivityIndicator color={colors.primary} style={{ paddingVertical: 40 }} />
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.surface },
  safeHeader: { backgroundColor: c.surface },

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
    fontSize: 17,
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

  scroll: { flex: 1 },
  gridContent: {
    paddingTop: 12,
    paddingBottom: 100,
  },
  masonryCanvas: {
    marginHorizontal: SIDE_PAD,
  },

  card: {
    position: 'relative',
    borderRadius: CARD_RADIUS,
    overflow: 'hidden',
    backgroundColor: c.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stylistGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
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

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    gap: 6,
  },
  emptyTag: {
    fontSize: 16,
    fontFamily: 'Figtree_600SemiBold',
    color: c.textMuted,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
    color: c.textMuted,
  },
});
