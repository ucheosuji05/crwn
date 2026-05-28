import React, { useRef, useEffect } from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  BackHandler,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import PostCard from './PostCard';
import { HEADER_BAR_HEIGHT } from './ScreenHeader';

const { width: SCREEN_W } = Dimensions.get('window');
const DISMISS_THRESHOLD = 80;

/**
 * Rendered as an absolutely-positioned full-screen overlay (not a Modal),
 * so there is no native Modal flash on open. ExploreScreen must render this
 * as the last child so it stacks on top of everything.
 */
export default function PostFeedViewerModal({
  visible,
  posts = [],
  initialIndex = 0,
  onClose,
  onDelete,
  onNavigateToProfile,
  onNavigateToStylist,
}) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const translateX = useRef(new Animated.Value(SCREEN_W)).current;
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  const visiblePosts = posts.slice(initialIndex);

  // Slide in / out based on visible prop
  useEffect(() => {
    if (visible) {
      translateX.setValue(SCREEN_W);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Android hardware back button
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      animateClose();
      return true;
    });
    return () => sub.remove();
  }, [visible]);

  const snapBack = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
  };

  const animateClose = () => {
    Animated.timing(translateX, {
      toValue: SCREEN_W,
      duration: 250,
      useNativeDriver: true,
    }).start(() => onCloseRef.current?.());
  };

  const animateDismissRight = () => {
    Animated.timing(translateX, {
      toValue: SCREEN_W,
      duration: 220,
      useNativeDriver: true,
    }).start(() => onCloseRef.current?.());
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dx > 10 && gs.dx > Math.abs(gs.dy) * 2,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) translateX.setValue(gs.dx);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > DISMISS_THRESHOLD || gs.vx > 0.5) {
          animateDismissRight();
        } else {
          snapBack();
        }
      },
      onPanResponderTerminate: () => snapBack(),
    })
  ).current;

  // Always rendered — pointerEvents blocks interaction when hidden
  return (
    <Animated.View
      style={[
        styles.root,
        { backgroundColor: '#F9F9F9', transform: [{ translateX }] },
      ]}
      pointerEvents={visible ? 'box-none' : 'none'}
      {...panResponder.panHandlers}
    >
      {/* Top safe-area bar + header */}
      <View style={[styles.topBar, { backgroundColor: colors.surface, paddingTop: insets.top, borderBottomColor: colors.borderLight }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={animateClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            activeOpacity={0.7}
            style={[styles.backBtn, { backgroundColor: colors.surfaceAlt ?? colors.borderLight }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Posts</Text>
          <View style={styles.backBtn} />
        </View>
      </View>

      <FlatList
        data={visiblePosts}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          // Outer shell: carries the shadow (overflow must be visible for shadow to show)
          <View style={styles.cardShadow}>
            {/* Inner shell: clips content to rounded corners + draws highlight border */}
            <View style={[styles.cardInner, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <PostCard
                post={item}
                currentUserId={user?.id}
                onDelete={onDelete}
                onNavigateToProfile={onNavigateToProfile}
                onNavigateToStylist={onNavigateToStylist}
              />
            </View>
          </View>
        )}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 20 }]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  topBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    height: HEADER_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
  },
  cardShadow: {
    marginHorizontal: 12,
    marginTop: 16,
    borderRadius: 20,
    // Shadow must live on a view that is NOT overflow:hidden
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  cardInner: {
    borderRadius: 20,
    overflow: 'hidden',   // clips PostCard content to rounded corners
    borderWidth: 1,       // subtle highlight rim — gives the raised edge illusion
  },
  listContent: {
    paddingBottom: 40,
  },
});
