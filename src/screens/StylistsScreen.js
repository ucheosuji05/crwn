import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Image, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import { webWrap, WEB_MAX_WIDTHS } from '../utils/webLayout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { stylistService, normalizeStylist } from '../services/stylistService';
import { Crown } from 'lucide-react-native';

const SPECIALTY_FILTERS = ['All', 'Braids', 'Locs', 'Twists', 'Natural Hair', 'Color', 'Silk Press', 'Fades'];

// ── Preview / demo cards — uncomment to re-enable until real stylists join ────
// const PREVIEW_STYLISTS = [
//   {
//     id: 'preview-1',
//     name: 'Jasmine Brown',
//     location: 'Brooklyn, NY',
//     rating: 4.9,
//     reviewCount: 127,
//     specialties: ['Braids', 'Protective Styles', 'Natural Hair'],
//     photos: [
//       'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400',
//       'https://images.unsplash.com/photo-1589156280159-27698a70f29e?w=400',
//       'https://images.unsplash.com/photo-1634926878768-2a5b3c42f139?w=400',
//     ],
//     isPreview: true,
//   },
//   {
//     id: 'preview-2',
//     name: 'Marcus Johnson',
//     location: 'Atlanta, GA',
//     rating: 4.8,
//     reviewCount: 89,
//     specialties: ['Fades', 'Natural Hair', 'Locs'],
//     photos: [
//       'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400',
//       'https://images.unsplash.com/photo-1504703395950-b89145a5425b?w=400',
//       'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
//     ],
//     isPreview: true,
//   },
//   {
//     id: 'preview-3',
//     name: 'Maya Thompson',
//     location: 'Los Angeles, CA',
//     rating: 5,
//     reviewCount: 203,
//     specialties: ['Color', 'Silk Press', 'Treatments'],
//     photos: [
//       'https://images.unsplash.com/photo-1512361436605-a484bdb34b5f?w=400',
//       'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400',
//       'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400',
//     ],
//     isPreview: true,
//   },
//   {
//     id: 'preview-4',
//     name: 'Zara Williams',
//     location: 'Houston, TX',
//     rating: 4.7,
//     reviewCount: 64,
//     specialties: ['Braids', 'Twists', 'Locs'],
//     photos: [
//       'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=400',
//       'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=400',
//       'https://images.unsplash.com/photo-1512361436605-a484bdb34b5f?w=400',
//     ],
//     isPreview: true,
//   },
// ];

// ── Stylist card ──────────────────────────────────────────────────────────────

function StylistCard({ item, styles, colors }) {
  const navigation = useNavigation();
  const [p0, p1, p2] = item.photos;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => navigation.navigate('StylistProfile', { stylist: item })}>
      {/* Photo collage */}
      <View style={styles.photoGrid}>
        <Image source={{ uri: p0 }} style={styles.photoMain} />
        <View style={styles.photoStack}>
          <Image source={{ uri: p1 }} style={styles.photoSmall} />
          <Image source={{ uri: p2 }} style={[styles.photoSmall, styles.photoSmallBottom]} />
        </View>
      </View>

      {/* Info */}
      <View style={styles.cardBody}>
        {/* Name + rating */}
        <View style={styles.nameRow}>
          <Text style={styles.stylistName} numberOfLines={1}>{item.name}</Text>
          <View style={styles.ratingBadge}>
            <Crown size={13} color={colors.primary} />
            <Text style={styles.ratingText}>{item.rating}</Text>
          </View>
        </View>

        {/* Location + reviews */}
        <View style={styles.locationRow}>
          <View style={styles.locationLeft}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={styles.locationText}>{item.location}</Text>
          </View>
          <Text style={styles.reviewCount}>{item.reviewCount} reviews</Text>
        </View>

        {/* Specialty chips */}
        <View style={styles.chips}>
          {item.specialties.map((s) => (
            <View key={s} style={styles.chip}>
              <Text style={styles.chipText}>{s}</Text>
            </View>
          ))}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StylistsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchOpen, setSearchOpen] = useState(false);
  const [stylists, setStylists] = useState([]);
  const [searchResults, setSearchResults] = useState(null); // null = use stylists list
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const searchTimeout = useRef(null);

  const loadStylists = useCallback(async () => {
    const { data, error } = await stylistService.getStylists();
    if (!error && data) setStylists(data.map(normalizeStylist));
  }, []);

  useEffect(() => {
    loadStylists().finally(() => setLoading(false));
  }, [loadStylists]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStylists();
    setRefreshing(false);
  };

  // Live DB search when query changes
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      const { data, error } = await stylistService.searchStylists(searchQuery.trim());
      if (!error && data) setSearchResults(data.map(normalizeStylist));
      setSearching(false);
    }, 300);

    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  const filtered = useMemo(() => {
    const list = searchResults !== null ? searchResults : stylists;

    if (activeFilter !== 'All') {
      return list.filter((s) =>
        s.specialties.some((sp) => sp.toLowerCase() === activeFilter.toLowerCase())
      );
    }

    return list;
  }, [stylists, searchResults, activeFilter]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={[{ flex: 1 }, webWrap(WEB_MAX_WIDTHS.list)]}>
      {/* Search icon + filter chips in one scrollable row */}
      <View style={styles.topBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Search button */}
          <TouchableOpacity style={styles.searchIconBtn} onPress={() => setSearchOpen((v) => !v)}>
            <Ionicons name="search-outline" size={18} color={searchOpen ? colors.text : colors.textMuted} />
          </TouchableOpacity>

          {/* Filter chips */}
          {SPECIALTY_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Expandable search input */}
      {searchOpen && (
        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search stylists..."
            placeholderTextColor={colors.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Loading */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : searching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          // ── Uncomment to re-enable preview banner ──
          // ListHeaderComponent={isPreviewMode ? (
          //   <View style={styles.previewBanner}>
          //     <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
          //     <Text style={styles.previewText}>Showing preview — real stylists will appear here once they join CRWN</Text>
          //   </View>
          // ) : null}
          renderItem={({ item }) => (
            <StylistCard item={item} styles={styles} colors={colors} />
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="cut-outline" size={48} color={colors.border} />
              <Text style={styles.emptyTitle}>No stylists found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || activeFilter !== 'All'
                  ? 'Try a different search or filter'
                  : 'Stylists will appear here once they join CRWN'}
              </Text>
            </View>
          }
        />
      )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },

  // ── Top bar (chips + search icon row) ──
  topBar: {
    backgroundColor: c.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
    height: 52,
    overflow: 'hidden',
  },
  filterContent: {
    paddingHorizontal: 14,
    paddingRight: 20,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
  },
  searchIconBtn: {
    width: 36,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Expandable search row ──
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.inputBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: c.text,
    fontFamily: 'Figtree_400Regular',
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
  },
  filterChipActive: {
    backgroundColor: c.selected,
    borderColor: c.selected,
  },
  filterText: {
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
    color: c.textSecondary,
  },
  filterTextActive: {
    color: c.isDark ? '#111' : '#fff',
    fontFamily: 'Figtree_600SemiBold',
  },

  // ── Loading ──
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── List ──
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },

  // ── Stylist card ──
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // ── Photo grid ──
  photoGrid: {
    flexDirection: 'row',
    height: 160,
  },
  photoMain: {
    flex: 2,
    backgroundColor: c.borderLight,
  },
  photoStack: {
    flex: 1,
    flexDirection: 'column',
  },
  photoSmall: {
    flex: 1,
    backgroundColor: c.borderLight,
    borderLeftWidth: 2,
    borderLeftColor: c.surface,
  },
  photoSmallBottom: {
    borderTopWidth: 2,
    borderTopColor: c.surface,
  },

  // ── Card body ──
  cardBody: {
    padding: 14,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  stylistName: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
    marginRight: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 14,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  locationText: {
    fontSize: 13,
    color: c.textMuted,
    fontFamily: 'Figtree_400Regular',
  },
  reviewCount: {
    fontSize: 12,
    color: c.textMuted,
    fontFamily: 'Figtree_400Regular',
  },

  // ── Specialty chips ──
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: c.backgroundAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipText: {
    fontSize: 12,
    color: c.textSecondary,
    fontFamily: 'Figtree_500Medium',
  },

  // ── Empty state ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: c.textMuted,
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
});
