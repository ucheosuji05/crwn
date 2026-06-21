import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { webWrap, WEB_MAX_WIDTHS } from '../utils/webLayout';
import { HEADER_BAR_HEIGHT } from '../components/ScreenHeader';
import ThreadCard from '../components/ThreadCard';
import ThreadDetailScreen from './ThreadDetailScreen';
import { useThreads } from '../hooks/useThreads';
import { useTheme } from '../context/ThemeContext';

/**
 * FilteredCommunityScreen
 *
 * Same feed layout as the Community tab, but scoped to threads that contain
 * a given hashtag (in the title, body, or a tags array) — reached by tapping
 * a hashtag inside a thread's body text.
 */
export default function FilteredCommunityScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const tag = route.params?.tag || '';
  const needle = `#${tag}`.toLowerCase();

  const [selectedThread, setSelectedThread] = useState(null);

  const {
    threads,
    upvotedIds,
    loading,
    error,
    refresh,
    toggleUpvoteLocally,
  } = useThreads();

  const matchingThreads = useMemo(() => threads.filter((t) => {
    const inTitle = t.title?.toLowerCase().includes(needle);
    const inBody = t.body?.toLowerCase().includes(needle);
    const inTags = Array.isArray(t.tags) && t.tags.some((x) => x?.toLowerCase() === tag.toLowerCase());
    return inTitle || inBody || inTags;
  }), [threads, needle, tag]);

  const openThread = useCallback((thread) => {
    setSelectedThread(thread);
  }, []);

  const goBackToList = useCallback(() => {
    setSelectedThread(null);
  }, []);

  if (selectedThread) {
    return (
      <ThreadDetailScreen
        thread={selectedThread}
        isThreadUpvoted={upvotedIds.has(selectedThread.id)}
        onThreadUpvoteToggle={toggleUpvoteLocally}
        onBack={goBackToList}
        onThreadDeleted={goBackToList}
      />
    );
  }

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.centerMessage}>
        <Ionicons name="pricetags-outline" size={40} color={colors.border} />
        <Text style={styles.centerText}>No posts found for #{tag}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[{ flex: 1 }, webWrap(WEB_MAX_WIDTHS.feed)]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle} pointerEvents="none">#{tag}</Text>

          <View style={styles.headerIcon} />
        </View>

        {loading && threads.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={matchingThreads}
            keyExtractor={(t) => t.id}
            renderItem={({ item }) => (
              <ThreadCard
                thread={item}
                isUpvoted={upvotedIds.has(item.id)}
                onUpvoteToggle={toggleUpvoteLocally}
                onPress={() => openThread(item)}
              />
            )}
            style={{ flex: 1 }}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={true}
            ListEmptyComponent={renderEmpty}
            refreshing={loading}
            onRefresh={refresh}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.surface },
  header: {
    height: HEADER_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: c.surface,
  },
  headerIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  listContent: { paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  centerMessage: { alignItems: 'center', paddingTop: 60, gap: 12 },
  centerText: { color: c.textMuted, fontSize: 15, fontFamily: 'Figtree_500Medium' },
});
