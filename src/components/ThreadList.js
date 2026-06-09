import React, { useState, useMemo, useCallback } from 'react';
import {
  View, FlatList, Text, TouchableOpacity, Pressable,
  StyleSheet, ActivityIndicator, Keyboard,
} from 'react-native';
import { webWrap, WEB_MAX_WIDTHS } from '../utils/webLayout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Plus, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import ThreadCard from './ThreadCard';
import SearchBar from './SearchBar';
import CreatePostMenu from './CreatePostMenu';
import { useTheme } from '../context/ThemeContext';
import { HEADER_BAR_HEIGHT } from './ScreenHeader';

const FILTERS = [
  'All', 'Hair Health', 'Product Recs', 'Styling Tips',
  'Beginner', 'Protective Styles', 'Growth & Retention',
];

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

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
        {searchOpen ? (
          <>
            <View style={styles.searchRow}>
              <Pressable
                style={styles.searchToggleBtn}
                onPress={toggleSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-outline" size={22} color={colors.text} />
              </Pressable>
              <View style={styles.searchBarWrap}>
                <SearchBar
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search discussions..."
                  autoFocus
                  containerStyle={styles.searchBarContainer}
                />
              </View>
            </View>

            <View style={styles.chipsRow}>
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
            </View>
          </>
        ) : (
          <View style={styles.chipsRow}>
            <Pressable
              style={styles.searchToggleBtn}
              onPress={toggleSearch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="search-outline" size={22} color={colors.text} />
            </Pressable>
            <FlatList
              horizontal
              data={FILTERS}
              keyExtractor={(f) => f}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
              style={styles.filterFlatList}
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
          </View>
        )}
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
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={renderEmpty}
          refreshing={loading}
          onRefresh={onRefresh}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <CreatePostMenu
        visible={createMenuOpen}
        onClose={() => setCreateMenuOpen(false)}
        onSelectExplore={() => {
          setCreateMenuOpen(false);
          navigation.navigate('CreatePost');
        }}
        onSelectCommunity={() => {
          setCreateMenuOpen(false);
          onCreatePress?.();
        }}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setCreateMenuOpen((open) => !open)} activeOpacity={0.85}>
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
            style={StyleSheet.absoluteFill}
          />
        )}
        {!createMenuOpen && <Plus size={24} color="#fff" strokeWidth={2} />}
      </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FCFCFC' },
  header: {
    minHeight: HEADER_BAR_HEIGHT,
    backgroundColor: '#FCFCFC',
  },
  searchToggleBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  searchBarWrap: { flex: 1 },
  searchBarContainer: { marginLeft: 6, marginRight: 14, marginVertical: 8 },
  filterFlatList: { flex: 1 },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: HEADER_BAR_HEIGHT,
    paddingLeft: 14,
  },
  filterList: { paddingLeft: 6, paddingVertical: 10, paddingRight: 14, gap: 8, alignItems: 'center' },
  filterChip: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: '#F1EEE8',
  },
  filterChipActive: { backgroundColor: '#5D1F1F' },
  filterText: { fontSize: 13, fontWeight: '500', color: '#5E5E5E' },
  filterTextActive: { color: '#fff' },
  listContent: { paddingBottom: 100, flexGrow: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  centerMessage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  centerText: { color: c.textMuted, fontSize: 15, fontFamily: 'Figtree_500Medium' },
  retryBtn: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: c.primary, borderRadius: 20 },
  retryText: { color: '#fff', fontSize: 14, fontFamily: 'Figtree_600SemiBold' },
  fabClose: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0EAE0',
  },
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
    zIndex: 50,
    shadowColor: '#5D1F1F',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
});
