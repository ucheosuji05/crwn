import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Image, ScrollView, ActivityIndicator, RefreshControl,
} from 'react-native';
import SearchBar from '../components/SearchBar';
import { HEADER_BAR_HEIGHT } from '../components/ScreenHeader';
import { webWrap, WEB_MAX_WIDTHS } from '../utils/webLayout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useProviderMode } from '../context/ProviderModeContext';
import { stylistService, normalizeStylist } from '../services/stylistService';
import { Crown } from 'lucide-react-native';

const SPECIALTY_FILTERS = [
  'All',
  'Locs & loc maintenance',
  'Box braids & protective styles',
  'Silk press & blowouts',
  'Natural styles & wash & go',
  'Twists & twist outs',
  'Wigs & installs',
  'Color & highlights',
  'Cuts & fades',
  'Keratin & relaxers',
];

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

// Renders an image slot — shows a grey placeholder when the URI is missing
function PhotoSlot({ uri, style, colors }) {
  if (!uri) {
    return <View style={[style, { backgroundColor: colors.borderLight }]} />;
  }
  return <Image source={{ uri }} style={style} />;
}

function StylistCard({ item, styles, colors }) {
  const navigation = useNavigation();
  const [p0, p1, p2] = item.photos;

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => navigation.navigate('StylistProfile', { stylist: item })}>
      {/* Rounded/clipped inner wrapper — kept separate from styles.card so the
          shadow on the outer layer isn't clipped by this overflow:hidden */}
      <View style={styles.cardInner}>
        {/* Photo collage */}
        <View style={styles.photoGrid}>
          <PhotoSlot uri={p0} style={styles.photoMain} colors={colors} />
          <View style={styles.photoStack}>
            <PhotoSlot uri={p1} style={styles.photoSmall} colors={colors} />
            <PhotoSlot uri={p2} style={[styles.photoSmall, styles.photoSmallBottom]} colors={colors} />
          </View>
        </View>

        {/* Info */}
        <View style={styles.cardBody}>
          {/* Name + rating */}
          <View style={styles.nameRow}>
            <Text style={styles.stylistName} numberOfLines={1}>{item.name}</Text>
            <View style={styles.ratingBadge}>
              <Crown size={13} color="#D4930A" />
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
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function StylistsScreen() {
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { toggleMode } = useProviderMode();
  const isStylist = !!profile?.is_stylist;
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

      {/* Header — full width, same structure as Community */}
      <View style={styles.header}>
        {searchOpen ? (
          <>
            <View style={[styles.searchRow, webWrap(WEB_MAX_WIDTHS.feed)]}>
              <TouchableOpacity
                style={styles.searchIconBtn}
                onPress={() => { setSearchOpen(false); setSearchQuery(''); }}
              >
                <Ionicons name="close-outline" size={22} color={colors.text} />
              </TouchableOpacity>
              <View style={styles.searchBarWrap}>
                <SearchBar
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search service providers..."
                  autoFocus
                  containerStyle={styles.searchBarContainer}
                />
              </View>
            </View>
            <View style={[styles.chipsRow, webWrap(WEB_MAX_WIDTHS.feed)]}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterList}
                style={styles.filterScrollView}
                keyboardShouldPersistTaps="handled"
                directionalLockEnabled
                alwaysBounceVertical={false}
              >
                {SPECIALTY_FILTERS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                    onPress={() => setActiveFilter(f)}
                  >
                    <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        ) : (
          <View style={[styles.chipsRow, webWrap(WEB_MAX_WIDTHS.feed)]}>
            <TouchableOpacity style={styles.searchIconBtn} onPress={() => setSearchOpen(true)}>
              <Ionicons name="search-outline" size={22} color={colors.text} />
            </TouchableOpacity>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterList}
              style={styles.filterScrollView}
              keyboardShouldPersistTaps="handled"
              directionalLockEnabled
              alwaysBounceVertical={false}
            >
              {SPECIALTY_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                  onPress={() => setActiveFilter(f)}
                >
                  <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Main content — centered */}
      <View style={[{ flex: 1 }, webWrap(WEB_MAX_WIDTHS.feed)]}>

        {/* Provider mode banner — visible only to stylists in client mode */}
        {isStylist && (
          <TouchableOpacity
            style={[styles.providerBanner, { backgroundColor: colors.primaryLight || '#FDF1EE', borderBottomColor: colors.borderLight }]}
            onPress={toggleMode}
            activeOpacity={0.8}
          >
            <Ionicons name="briefcase-outline" size={15} color={colors.primary} />
            <Text style={[styles.providerBannerText, { color: colors.primary }]}>Switch to Provider Mode</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.primary} />
          </TouchableOpacity>
        )}

        {loading || searching ? (
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
            renderItem={({ item }) => (
              <StylistCard item={item} styles={styles} colors={colors} />
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>No service providers found</Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery || activeFilter !== 'All'
                    ? 'Try a different search or filter'
                    : 'Service providers will appear here once they join CRWN'}
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
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  providerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: 1,
  },
  providerBannerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
  },

  header: {
    minHeight: HEADER_BAR_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline || c.borderLight,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16 },
  searchBarWrap: { flex: 1 },
  searchBarContainer: { marginLeft: 6, marginRight: 14, marginVertical: 8 },
  filterScrollView: { flex: 1 },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: HEADER_BAR_HEIGHT,
    paddingLeft: 16,
  },
  filterList: { paddingLeft: 6, paddingVertical: 6, paddingRight: 14, gap: 8, alignItems: 'center' },
  searchIconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  filterChip: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(232, 226, 217, 0.4)',
  },
  filterChipActive: {
    backgroundColor: c.primary,
  },
  filterText: {
    fontSize: 13,
    fontFamily: 'Figtree_500Medium',
    color: c.textSecondary,
  },
  filterTextActive: {
    color: '#fff',
    fontFamily: 'Figtree_600SemiBold',
  },

  // ── Loading ──
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── List ──
  list: { flex: 1, backgroundColor: '#FFFFFF' },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 16,
  },

  // ── Stylist card ── shadow values match the card shadow used in the Hair
  // Profile section (src/components/HairProfile.js) for a consistent, subtle lift.
  // No overflow:hidden here — that would clip the shadow on iOS; the rounded
  // clipping instead happens on cardInner below.
  card: {
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: c.isDark ? 0 : 0.08,
    shadowRadius: 6,
    elevation: c.isDark ? 0 : 2,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
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
    borderLeftColor: '#FFFFFF',
  },
  photoSmallBottom: {
    borderTopWidth: 2,
    borderTopColor: '#FFFFFF',
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
    backgroundColor: '#F2E8DA',
    borderRadius: 999,
    shadowColor: '#8E683B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  chipText: {
    fontSize: 12,
    color: '#8E683B',
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
