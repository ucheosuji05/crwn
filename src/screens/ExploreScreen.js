import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, FlatList, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SearchBar from '../components/SearchBar';
import RecommendationSlider from '../components/RecommendationSlider';
import PostList from '../components/PostList';
import { usePosts } from '../hooks/usePosts'; // ← ADD THIS


const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_SPACING = 2;
const NUM_COLUMNS = 2;
const TILE_SIZE = (SCREEN_WIDTH - (GRID_SPACING * (NUM_COLUMNS + 1))) / NUM_COLUMNS;

export default function ExploreScreen() {
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  
  //Fetch real posts from Supabase
  const { posts, loading, refresh } = usePosts();

  const toggleView = () => {
    setViewMode(viewMode === 'list' ? 'grid' : 'list');
  };

  const renderGridItem = ({ item }) => {
    // Get first image from post_media array (Supabase structure)
    const firstImage = item.post_media?.[0]?.media_url;
    
    return (
      <TouchableOpacity style={styles.gridItem}>
        {firstImage ? (
          <Image
            source={{ uri: firstImage }}
            style={styles.gridImage}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.gridImage} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Search and View Toggle */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBarWrapper}>
          <SearchBar />
        </View>
        <TouchableOpacity 
          style={styles.viewToggle} 
          onPress={toggleView}
        >
          <Ionicons 
            name={viewMode === 'list' ? 'grid-outline' : 'list-outline'} 
            size={24} 
            color="#111827" 
          />
        </TouchableOpacity>
      </View>

      {/* Recommendation Slider - only show in list view */}
      {viewMode === 'list' && <RecommendationSlider />}

      {/* Content based on view mode */}
      {viewMode === 'list' ? (
        <PostList />
      ) : (
        <FlatList
          data={posts} 
          renderItem={renderGridItem}
          keyExtractor={item => item.id}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          refreshing={loading} 
          onRefresh={refresh} 
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    backgroundColor: '#fff'
  },
  searchBarWrapper: {
    flex: 1
  },
  viewToggle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  gridContainer: {
    padding: GRID_SPACING
  },
  gridRow: {
    justifyContent: 'space-between'
  },
  gridItem: {
    width: TILE_SIZE,
    height: TILE_SIZE * 1.3,
    marginBottom: GRID_SPACING,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    overflow: 'hidden'
  },
  gridImage: {
    width: '100%',
    height: '100%'
  }
});