import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { WEB_MAX_WIDTHS } from '../utils/webLayout';
import { Ionicons as Icon } from '@expo/vector-icons';
import SavedLooks from './SavedLooks';
import HairProfile from './HairProfile';
import PostCard from './PostCard';
import { usePosts } from '../hooks/usePosts';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { bookingService } from '../services/bookingService';
import { postService } from '../services/postService';
import { supabase } from '../config/supabase';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const GRID_GAP = 8;
const CONTENT_WIDTH = Platform.OS === 'web'
  ? Math.min(SCREEN_WIDTH, WEB_MAX_WIDTHS.profile)
  : SCREEN_WIDTH;
const GRID_SIZE = (CONTENT_WIDTH - GRID_GAP * 3) / 2;

const ALL_TABS = [
  { key: 'posts',     label: 'Posts' },
  { key: 'tagged',    label: 'Tagged',   stylistOnly: true },
  { key: 'favorites', label: 'Saved',    ownOnly: true },
  { key: 'bookings',  label: 'Bookings', ownOnly: true },
  { key: 'hair',      label: 'Hair',     lock: true },
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function ProfileTabs({ viewedUserId, isOwnProfile }) {
  const [activeTab, setActiveTab] = useState('posts');
  const [selectedPost, setSelectedPost] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [isViewedStylist, setIsViewedStylist] = useState(false);
  const [taggedPosts, setTaggedPosts] = useState([]);
  const [taggedLoading, setTaggedLoading] = useState(false);
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { profile: authProfile } = useAuth();
  const isOwnStylist = isOwnProfile && !!authProfile?.is_stylist;
  const { posts, loading, refresh, deletePost } = usePosts(viewedUserId);

  // Check if viewed profile is a stylist
  useEffect(() => {
    if (!viewedUserId) return;
    supabase
      .from('profiles')
      .select('is_stylist')
      .eq('id', viewedUserId)
      .single()
      .then(({ data }) => setIsViewedStylist(!!data?.is_stylist));
  }, [viewedUserId]);

  // Load tagged posts when that tab is opened
  useEffect(() => {
    if (activeTab === 'tagged' && isViewedStylist && viewedUserId) {
      setTaggedLoading(true);
      postService.getTaggedPosts(viewedUserId).then(({ data }) => {
        setTaggedPosts(data || []);
        setTaggedLoading(false);
      });
    }
  }, [activeTab, isViewedStylist, viewedUserId]);

  useEffect(() => {
    if (activeTab === 'bookings' && isOwnProfile && user?.id) {
      setBookingsLoading(true);
      const fetch = isOwnStylist
        ? bookingService.getBookingsByStylist(user.id)
        : bookingService.getBookingsByUser(user.id);
      fetch.then(({ data }) => {
        setBookings(data || []);
        setBookingsLoading(false);
      });
    }
  }, [activeTab, isOwnProfile, isOwnStylist, user?.id]);

  const renderContent = () => {
    switch (activeTab) {
      case 'posts':
        if (loading) {
          return <ActivityIndicator style={{ paddingTop: 60 }} size="large" color={colors.primary} />;
        }
        if (posts.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptyText}>
                {isOwnProfile ? 'Share your first hairstyle!' : "This user hasn't posted yet."}
              </Text>
            </View>
          );
        }
        const rows = [];
        for (let i = 0; i < posts.length; i += 2) {
          rows.push(posts.slice(i, i + 2));
        }
        return (
          <View style={styles.gridContainer}>
            {rows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((item) => {
                  const thumb = item.post_media?.[0]?.media_url;
                  const stylistName = item.stylists?.full_name || item.stylists?.username;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.gridCell}
                      onPress={() => setSelectedPost(item)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.gridImageBox}>
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.gridImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.gridImage, styles.gridPlaceholder]}>
                            <Icon name="image-outline" size={20} color="#9ca3af" />
                          </View>
                        )}
                        {(item.post_media?.length ?? 0) > 1 && (
                          <View style={styles.photoDots}>
                            {Array.from({ length: Math.min(item.post_media.length, 5) }).map((_, i) => (
                              <View key={i} style={[styles.photoDot, i === 0 && styles.photoDotActive]} />
                            ))}
                          </View>
                        )}
                      </View>
                      {stylistName ? (
                        <View style={styles.gridFooter}>
                          <View style={styles.gridFooterRow}>
                            <Icon name="cut-outline" size={10} color={colors.primary} />
                            <Text style={styles.gridFooterStylist} numberOfLines={1}>{stylistName}</Text>
                          </View>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                })}
                {row.length < 2 && [...Array(2 - row.length)].map((_, i) => (
                  <View key={`empty-${i}`} style={styles.gridCell} />
                ))}
              </View>
            ))}
          </View>
        );

      case 'tagged':
        if (taggedLoading) {
          return <ActivityIndicator style={{ paddingTop: 60 }} size="large" color={colors.primary} />;
        }
        if (taggedPosts.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No tagged posts yet</Text>
              <Text style={styles.emptyText}>Posts where this stylist is tagged will appear here</Text>
            </View>
          );
        }
        const taggedRows = [];
        for (let i = 0; i < taggedPosts.length; i += 2) {
          taggedRows.push(taggedPosts.slice(i, i + 2));
        }
        return (
          <View style={styles.gridContainer}>
            {taggedRows.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((item) => {
                  const thumb = item.post_media?.[0]?.media_url;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.gridCell}
                      onPress={() => setSelectedPost(item)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.gridImageBox}>
                        {thumb ? (
                          <Image source={{ uri: thumb }} style={styles.gridImage} resizeMode="cover" />
                        ) : (
                          <View style={[styles.gridImage, styles.gridPlaceholder]}>
                            <Icon name="image-outline" size={20} color="#9ca3af" />
                          </View>
                        )}
                        {(item.post_media?.length ?? 0) > 1 && (
                          <View style={styles.photoDots}>
                            {Array.from({ length: Math.min(item.post_media.length, 5) }).map((_, i) => (
                              <View key={i} style={[styles.photoDot, i === 0 && styles.photoDotActive]} />
                            ))}
                          </View>
                        )}
                      </View>
                      {item.profiles && (
                        <View style={styles.gridFooter}>
                          <View style={styles.gridFooterRow}>
                            <Icon name="person-outline" size={10} color={colors.textSecondary} />
                            <Text style={styles.gridFooterPostedBy} numberOfLines={1}>
                              {item.profiles.full_name || item.profiles.username}
                            </Text>
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                {row.length < 2 && [...Array(2 - row.length)].map((_, i) => (
                  <View key={`empty-${i}`} style={styles.gridCell} />
                ))}
              </View>
            ))}
          </View>
        );

      case 'favorites':
        return <SavedLooks />;

      case 'bookings':
        if (!isOwnProfile) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Private</Text>
              <Text style={styles.emptyText}>Bookings are only visible to the owner</Text>
            </View>
          );
        }
        if (bookingsLoading) {
          return <ActivityIndicator style={{ paddingTop: 60 }} size="large" color={colors.primary} />;
        }
        if (bookings.length === 0) {
          return (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptyText}>
                {isOwnStylist ? 'Client bookings will appear here' : 'Your appointments will appear here'}
              </Text>
            </View>
          );
        }
        return (
          <View style={styles.bookingsList}>
            {bookings.map((booking) => {
              const isUpcoming = booking.status === 'upcoming';
              const isCancelled = booking.status === 'cancelled';
              const displayName = isOwnStylist
                ? (booking.client?.full_name || booking.client?.username || 'Client')
                : (booking.stylists?.full_name || booking.stylists?.business_name || booking.stylists?.username || 'Unknown Stylist');
              const badgeStyle = isUpcoming
                ? styles.statusUpcoming
                : isCancelled
                  ? styles.statusCancelled
                  : styles.statusCompleted;
              const badgeTextStyle = isUpcoming
                ? styles.statusUpcomingText
                : isCancelled
                  ? styles.statusCancelledText
                  : styles.statusCompletedText;
              return (
                <View key={booking.id} style={styles.bookingCard}>
                  <View style={styles.bookingRow}>
                    <Text style={styles.bookingStylist}>{displayName}</Text>
                    <View style={[styles.statusBadge, badgeStyle]}>
                      <Text style={[styles.statusText, badgeTextStyle]}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.bookingService}>{booking.service_name}</Text>
                  <Text style={styles.bookingDate}>{formatDate(booking.appointment_date)}</Text>
                </View>
              );
            })}
          </View>
        );

      case 'hair':
        if (!isOwnProfile) {
          return (
            <View style={styles.emptyState}>
              <Icon name="lock-closed-outline" size={40} color="#d1d5db" />
              <Text style={styles.emptyTitle}>Private</Text>
              <Text style={styles.emptyText}>Hair profile is only visible to the owner</Text>
            </View>
          );
        }
        return <HairProfile viewedUserId={viewedUserId} />;

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {ALL_TABS.filter((tab) => {
          if (tab.ownOnly && !isOwnProfile) return false;
          if (tab.stylistOnly && !isViewedStylist) return false;
          return true;
        }).map((tab) => {
          const active = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <View style={styles.tabLabelRow}>
                <Text style={[styles.tabText, active && styles.activeTabText]}>
                  {tab.label}
                </Text>
                {tab.lock && (
                  <Icon name="lock-closed" size={12} color={active ? colors.selected : '#9ca3af'} style={{ marginLeft: 3 }} />
                )}
              </View>
              {active && <View style={styles.activeUnderline} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.content}>{renderContent()}</View>

      {/* Post detail popup */}
      <Modal
        visible={!!selectedPost}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPost(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setSelectedPost(null)}>
          <Pressable style={[styles.popupCard, Platform.OS === 'web' && styles.popupCardWeb]} onPress={() => {}}>
            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              <PostCard
                post={selectedPost}
                currentUserId={user?.id}
                onDelete={async (postId, userId) => {
                  const result = await deletePost(postId, userId);
                  if (result?.success) setSelectedPost(null);
                  return result;
                }}
              />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: {},
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    backgroundColor: c.surface,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
    color: c.textSecondary,
    fontFamily: 'Figtree_500Medium',
  },
  activeTabText: {
    color: c.selected,
    fontFamily: 'Figtree_700Bold',
  },
  activeUnderline: {
    position: 'absolute',
    bottom: -1,
    left: 8,
    right: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: c.selected,
  },
  content: {},

  // Grid
  gridContainer: { padding: GRID_GAP },
  gridRow: { flexDirection: 'row', gap: GRID_GAP, marginBottom: GRID_GAP },
  gridCell: { width: GRID_SIZE, borderRadius: 10, overflow: 'hidden', backgroundColor: c.surface },
  gridImageBox: { width: '100%', height: GRID_SIZE, position: 'relative' },
  gridImage: { width: '100%', height: '100%' },
  gridPlaceholder: {
    backgroundColor: c.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridFooter: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 6,
    gap: 3,
  },
  gridFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridFooterStylist: {
    fontSize: 11,
    fontFamily: 'Figtree_600SemiBold',
    color: c.primary,
    flex: 1,
  },
  gridFooterPostedBy: {
    fontSize: 11,
    fontFamily: 'Figtree_500Medium',
    color: c.textSecondary,
    flex: 1,
  },
  photoDots: {
    position: 'absolute',
    bottom: 7,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  photoDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  photoDotActive: {
    backgroundColor: '#fff',
    width: 6,
    height: 6,
  },

  // Bookings
  bookingsList: {
    padding: 16,
    gap: 12,
  },
  bookingCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    gap: 4,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  bookingStylist: {
    fontSize: 16,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
    flex: 1,
  },
  bookingService: {
    fontSize: 14,
    color: c.textSecondary,
    fontFamily: 'Figtree_500Medium',
  },
  bookingDate: {
    fontSize: 14,
    color: c.textSecondary,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusUpcoming: {
    backgroundColor: '#FEF3CD',
  },
  statusCompleted: {
    backgroundColor: c.borderLight,
  },
  statusCancelled: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Figtree_600SemiBold',
  },
  statusUpcomingText: {
    color: '#9A6200',
  },
  statusCompletedText: {
    color: c.textSecondary,
  },
  statusCancelledText: {
    color: '#dc2626',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
  },
  emptyText: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  popupCard: {
    width: '100%',
    maxHeight: SCREEN_HEIGHT * 0.78,
    backgroundColor: c.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  popupCardWeb: {
    maxWidth: 460,
    maxHeight: SCREEN_HEIGHT * 0.82,
  },
});
