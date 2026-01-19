import React from 'react';
import { FlatList, StyleSheet, RefreshControl, Text, View } from 'react-native';
import PostCard from './PostCard';
import { usePosts } from '../hooks/usePosts';

export default function PostList() {
  // Don't pass userId - fetch ALL posts for explore
  const { posts, loading, refresh } = usePosts();

  if (posts.length === 0 && !loading) {
    return (
      <View style={styles.emptyState}>
        {/*emoji removed*/}
        <Text style={styles.emptyText}>No posts yet</Text>
        <Text style={styles.emptySubtext}>Be the first to share!</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <PostCard post={item} />}
      style={styles.list}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refresh} />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
});