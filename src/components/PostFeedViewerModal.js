import React from 'react';
import {
  Modal,
  FlatList,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import PostCard from './PostCard';

/**
 * Full-screen post viewer for mobile.
 *
 * Opens when the user taps a post tile in the scrapbook grid.
 * Starts at `initialIndex` and lets the user scroll down to read
 * subsequent posts. All PostCard functionality (likes, comments,
 * bookmark, delete) works exactly the same here.
 *
 * `onPostPress` is intentionally NOT passed to the inner PostCard
 * so tapping the image inside the viewer doesn't re-open the viewer.
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

  // Only show posts from the tapped one onward — scroll down for more
  const visiblePosts = posts.slice(initialIndex);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView
        style={[styles.root, { backgroundColor: colors.surface }]}
        edges={['top']}
      >
        {/* Minimal header — back arrow + "Posts" title */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.7}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Posts</Text>
          {/* spacer keeps title centred */}
          <View style={{ width: 22 }} />
        </View>

        {/* Feed starting from the tapped post */}
        <FlatList
          data={visiblePosts}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              currentUserId={user?.id}
              onDelete={onDelete}
              onNavigateToProfile={onNavigateToProfile}
              onNavigateToStylist={onNavigateToStylist}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 22,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
  },
  listContent: {
    paddingBottom: 40,
  },
});
