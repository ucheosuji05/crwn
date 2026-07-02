import React, { useState, useRef, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { collectionService } from '../services/collectionService';
import PostDetailCard from '../components/PostDetailCard';

// Vertically-scrollable list of posts within a saved collection, each rendered
// with the same layout/interactivity as PostDetailScreen.
export default function CollectionPostsScreen({ route, navigation }) {
  const { posts = [], initialIndex = 0, collectionId = null, collectionName = 'All Saved' } = route?.params ?? {};
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const listRef = useRef(null);

  const [items, setItems] = useState(posts);

  const goBack = () => navigation.goBack();

  const handleRemoveFromCollection = useCallback(async (postId) => {
    if (!collectionId) return;
    await collectionService.removePostFromCollection(collectionId, postId);
    setItems(prev => prev.filter(p => p.id !== postId));
  }, [collectionId]);

  const handleBookmarkChange = useCallback((postId, isNowBookmarked) => {
    if (!isNowBookmarked) setItems(prev => prev.filter(p => p.id !== postId));
  }, []);

  const handleDeleted = useCallback((postId) => {
    setItems(prev => prev.filter(p => p.id !== postId));
  }, []);

  const onScrollToIndexFailed = useCallback((info) => {
    setTimeout(() => {
      listRef.current?.scrollToIndex({ index: info.index, animated: false });
    }, 100);
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.navBar}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: colors.text }]} numberOfLines={1}>{collectionName}</Text>
        <View style={{ width: 26 }} />
      </View>

      {items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="bookmark-outline" size={40} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No posts left here</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(item) => String(item.id)}
          initialScrollIndex={Math.min(initialIndex, items.length - 1)}
          onScrollToIndexFailed={onScrollToIndexFailed}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />}
          renderItem={({ item }) => (
            <PostDetailCard
              post={item}
              navigation={navigation}
              flush
              onRemoveFromCollection={collectionId ? handleRemoveFromCollection : undefined}
              onBookmarkChange={handleBookmarkChange}
              onDeleted={handleDeleted}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  navTitle: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 15, fontFamily: 'Figtree_500Medium' },
  listContent: { paddingBottom: 24 },
  divider: { height: StyleSheet.hairlineWidth },
});
