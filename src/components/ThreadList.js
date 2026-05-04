import React, { useState, useMemo, useCallback } from 'react';
import {
  View, FlatList, Text, TouchableOpacity, Pressable,
  StyleSheet, ActivityIndicator, Keyboard,
} from 'react-native';
import { webWrap, WEB_MAX_WIDTHS } from '../utils/webLayout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import ThreadCard from './ThreadCard';
import SearchBar from './SearchBar';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { useTheme } from '../context/ThemeContext';
import { HEADER_BAR_HEIGHT } from './ScreenHeader';

const FILTERS =['All', 'Low Porosity', 'High Porosity', 'Protective Styles', 'Styling Tips', 'Beginner'];

export default function ThreadList({
  threads = [],
  upvotedIds = new Set(),
  loading = false,
  error = null,
  onRefresh,
  onUpvoteToggle,
  onThreadPress,
  onCreatePress,
}) {
  const navigation = useNavigation();
  const unreadCount = useUnreadMessages();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const toggleSearch = useCallback(() => {
    if (searchOpen) {
      setSearchOpen(false);
      setSearch('');
      requestAnimationFrame(() => Keyboard.dismiss());
    } else {
      setSearchOpen(true);
    }
  }, [searchOpen]);

  const filtered = useMemo(() => {
    return threads.filter((t) => {
      const matchesCategory = activeFilter === 'All' || t.category === activeFilter;
      const q = search.toLowerCase();
      const matchesSearch = !q || t.title?.toLowerCase().includes(q) || t.body?.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [threads, activeFilter, search]);

  const ListHeader = (
    <>
      {searchOpen && (
        <SearchBar
          value={search}
          onChangeText={setSearch}
          placeholder="Search discussions..."
          autoFocus
        />
      )}
      <FlatList
        horizontal
        data={FILTERS}
        keyExtractor={(f) => f}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => {
          const active = item === activeFilter;
          return (
            <TouchableOpacity
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setActiveFilter(item)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{item}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </>
  );

  const renderEmpty = () => {
    if (loading) return null;
    if (error) {
      return (
        <View style={styles.centerMessage}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.border} />
          <Text style={styles.centerText}>Couldn't load discussions</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={onRefresh}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.centerMessage}>
        <Ionicons name="chatbubbles-outline" size={40} color={colors.border} />
        <Text style={styles.centerText}>No discussions found</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[{ flex: 1 }, webWrap(WEB_MAX_WIDTHS.feed)]}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerIcon}
          onPress={toggleSearch}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={searchOpen ? 'close-outline' : 'search-outline'}
            size={22}
            color={colors.text}
          />
        </Pressable>

        <Text style={styles.headerLogo} pointerEvents="none">crwn.</Text>

        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => navigation.navigate('Messaging')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {loading && threads.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <ThreadCard
              thread={item}
              isUpvoted={upvotedIds.has(item.id)}
              onUpvoteToggle={onUpvoteToggle}
              onPress={() => onThreadPress?.(item)}
            />
          )}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          refreshing={loading}
          onRefresh={onRefresh}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={onCreatePress}>
        <LinearGradient
          colors={['#5D1F1F', '#C8835A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
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
  headerIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
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
  badgeText: { color: '#fff', fontSize: 9, fontFamily: 'Figtree_700Bold', lineHeight: 12 },
  filterList: { paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  filterChip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  filterChipActive: { backgroundColor: c.selected, borderColor: c.selected },
  filterText: { fontSize: 13, color: c.textSecondary, fontFamily: 'Figtree_500Medium' },
  filterTextActive: { color: c.isDark ? '#111' : '#fff', fontFamily: 'Figtree_600SemiBold' },
  listContent: { paddingBottom: 100 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  centerMessage: { alignItems: 'center', paddingTop: 60, gap: 12 },
  centerText: { color: c.textMuted, fontSize: 15 },
  retryBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: c.primary, borderRadius: 20 },
  retryText: { color: '#fff', fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5D1F1F',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
