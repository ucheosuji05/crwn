import React from 'react';
import { View, Image, FlatList, Dimensions, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { postService } from '../services/postService';

const numColumns = 3;
const screenWidth = Dimensions.get('window').width;
const tileSize = screenWidth / numColumns;

export default function SavedLooks() {
  const { user } = useAuth();
  const [bookmarkedPosts, setBookmarkedPosts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchBookmarkedPosts();
  }, [user]);

  const fetchBookmarkedPosts = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await postService.getBookmarkedPosts(user.id);
    
    if (error) {
      console.error('Error fetching bookmarks:', error);
    } else {
      // Extract posts from bookmarks
      const posts = data?.map(bookmark => bookmark.posts).filter(Boolean) || [];
      setBookmarkedPosts(posts);
    }
    setLoading(false);
  };

  const renderItem = ({ item }) => {
    // Get first image from post
    const firstImage = item.post_media?.[0]?.media_url;

    return (
      <View style={styles.tile}>
        {firstImage ? (
          <Image 
            source={{ uri: firstImage }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.image, styles.placeholder]} />
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (bookmarkedPosts.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>🔖</Text>
        <Text style={styles.emptyTitle}>No saved posts yet</Text>
        <Text style={styles.emptyText}>
          Tap the bookmark icon on posts you want to save for later
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={bookmarkedPosts}
      renderItem={renderItem}
      numColumns={numColumns}
      keyExtractor={item => item.id}
      style={styles.grid}
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    flex: 1,
  },
  tile: {
    width: tileSize,
    height: tileSize,
    padding: 1,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f3f4f6',
  },
  placeholder: {
    backgroundColor: '#e5e7eb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});