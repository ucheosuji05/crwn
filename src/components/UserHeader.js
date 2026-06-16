import { useState, useEffect, useMemo } from 'react';
import { s, fs } from '../utils/responsive';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Share,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { profileService } from '../services/profileService';
import EditProfileScreen from '../screens/EditProfileScreen';

/**
 * UserHeader
 *
 * Props:
 *   viewedUserId  — ID of the profile being displayed
 *   isOwnProfile  — boolean; true when the signed-in user is viewing their own profile
 */
export default function UserHeader({ viewedUserId, isOwnProfile }) {
  const { user, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation();

  const [profile, setProfile]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [uploading, setUploading]     = useState(false);
  const [following, setFollowing]     = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [followList, setFollowList]   = useState(null); // { title, data }
  const [followListLoading, setFollowListLoading] = useState(false);
  const [unfollowSheetVisible, setUnfollowSheetVisible] = useState(false);

  // Fetch the viewed user's profile whenever the target ID changes
  useEffect(() => {
    if (viewedUserId) {
      fetchProfile();
      if (!isOwnProfile && user?.id) checkFollowing();
    } else {
      setLoading(false);
    }
  }, [viewedUserId]);

  const checkFollowing = async () => {
    const { isFollowing: result } = await profileService.isFollowing(user.id, viewedUserId);
    setFollowing(result);
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await profileService.getProfile(viewedUserId);
      if (error) {
        console.error('UserHeader: Error fetching profile:', error);
        // Fallback for own profile only
        if (isOwnProfile && user) {
          setProfile({
            full_name: user.name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            username: user.username || user.email?.split('@')[0] || 'user',
            email: user.email,
            avatar_url: null,
            followers_count: 0,
            following_count: 0,
            bio: null,
          });
        }
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('UserHeader: Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Avatar upload (own profile only) ───────────────────────────────────────

  const pickImage = () => {
    if (Platform.OS === 'web') {
      chooseFromLibrary();
      return;
    }
    Alert.alert('Change Profile Picture', 'Choose an option', [
      { text: 'Take Photo',           onPress: takePhoto },
      { text: 'Choose from Library',  onPress: chooseFromLibrary },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) uploadAvatar(result.assets[0].uri);
  };

  const chooseFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) uploadAvatar(result.assets[0].uri);
  };

  const uploadAvatar = async (uri) => {
    if (!user?.id) return;
    setUploading(true);
    const { url, error } = await profileService.uploadAvatar(user.id, uri);
    if (error) {
      Alert.alert('Error', 'Failed to upload photo. Please try again.');
    } else {
      setProfile((prev) => ({ ...prev, avatar_url: url }));
      await refreshProfile(user.id);
      Alert.alert('Success', 'Profile picture updated!');
    }
    setUploading(false);
  };

  // ── Follow / Unfollow (other profiles only) ────────────────────────────────

  const handleFollow = async () => {
    if (!user || followLoading) return;
    setFollowLoading(true);
    if (following) {
      await profileService.unfollowUser(user.id, viewedUserId);
      setFollowing(false);
    } else {
      await profileService.followUser(user.id, viewedUserId);
      setFollowing(true);
    }
    // Re-fetch to get the true count from DB
    await fetchProfile();
    setFollowLoading(false);
  };

  const handleReportProfile = () => {
    setUnfollowSheetVisible(false);
    Alert.alert('Report', 'This profile has been reported for review.');
  };

  // ── Edit Profile ──────────────────────────────────────────────────────────

  const handleEditProfile = () => setEditVisible(true);

  // ── Share Profile ─────────────────────────────────────────────────────────

  const handleShare = async () => {
    const name = profile?.full_name || profile?.username || 'this user';
    const handle = profile?.username ? `@${profile.username}` : '';
    try {
      await Share.share({
        message: `Check out ${name}'s profile on CRWN! ${handle}`,
        title: `${name} on CRWN`,
      });
    } catch (e) {
      console.error('Share error:', e);
    }
  };

  // ── Followers / Following list ────────────────────────────────────────────

  const openFollowers = async () => {
    setFollowList({ title: 'Followers', data: [] });
    setFollowListLoading(true);
    const { data } = await profileService.getFollowers(viewedUserId);
    setFollowList({ title: 'Followers', data: data || [] });
    setFollowListLoading(false);
  };

  const openFollowing = async () => {
    setFollowList({ title: 'Following', data: [] });
    setFollowListLoading(true);
    const { data } = await profileService.getFollowing(viewedUserId);
    setFollowList({ title: 'Following', data: data || [] });
    setFollowListLoading(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const emailPrefix     = user?.email?.split('@')[0];
  const displayName     = profile?.full_name || profile?.username || emailPrefix || 'User';
  const displayUsername = profile?.username   || emailPrefix || 'user';

  const AVATAR_SIZE = s(90);
  const BANNER_HEIGHT = s(110);

  return (
    <View style={styles.wrapper}>
      {/* ── Gradient Banner ── */}
      <LinearGradient
        colors={['#5D1F1F', '#C8835A']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.banner, { height: BANNER_HEIGHT }]}
      >
        <SafeAreaView edges={['top']} style={styles.bannerSafe} />
      </LinearGradient>

      {/* ── Avatar overlapping banner ── */}
      <View style={[styles.avatarRow, { marginTop: -(AVATAR_SIZE / 2) }]}>
        <TouchableOpacity
          onPress={isOwnProfile ? pickImage : undefined}
          activeOpacity={isOwnProfile ? 0.8 : 1}
          style={[styles.avatarRing, { width: AVATAR_SIZE + 4, height: AVATAR_SIZE + 4, borderRadius: (AVATAR_SIZE + 4) / 2 }]}
        >
          {uploading ? (
            <View style={[styles.avatar, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : profile?.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={[styles.avatar, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }]}>
              <Ionicons name="person" size={44} color="#9ca3af" />
            </View>
          )}
          {isOwnProfile && !uploading && (
            <View style={[styles.cameraBadge, { backgroundColor: colors.primary }]}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Profile info ── */}
      <View style={styles.info}>
        <Text style={styles.name}>{displayName}</Text>
        <Text style={styles.username}>@{displayUsername}</Text>

        {profile?.bio ? (
          <Text style={styles.bio}>{profile.bio}</Text>
        ) : null}

        {/* Stats */}
        <View style={styles.stats}>
          <TouchableOpacity style={styles.stat} onPress={openFollowers}>
            <Text style={styles.statNumber}>{profile?.followers_count || 0}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.stat} onPress={openFollowing}>
            <Text style={styles.statNumber}>{profile?.following_count || 0}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </TouchableOpacity>
        </View>

        {/* Buttons */}
        <View style={styles.buttons}>
          {isOwnProfile ? (
            <>
              <TouchableOpacity style={styles.btn} onPress={handleEditProfile}>
                <Text style={styles.btnText}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={15} color={colors.text} style={{ marginRight: 5 }} />
                <Text style={styles.btnText}>Share</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.btn, following ? styles.followingBtn : styles.followBtn]}
                onPress={() => following ? setUnfollowSheetVisible(true) : handleFollow()}
                disabled={followLoading}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color={following ? '#7D3F1D' : '#fff'} />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.btnText, following ? styles.followingBtnText : styles.followBtnText]}>
                      {following ? 'Following' : 'Follow'}
                    </Text>
                    {following && <Ionicons name="chevron-down" size={16} color="#7D3F1D" style={{ marginLeft: 4 }} />}
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.messageBtn]}
                onPress={() => navigation.navigate('Messaging', {
                  recipientId: viewedUserId,
                  recipientName: profile?.full_name || profile?.username || 'User',
                })}
              >
                <Text style={[styles.btnText, styles.messageBtnText]}>Message</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* ── Edit Profile Modal ── */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditVisible(false)}>
        <EditProfileScreen
          onBack={() => setEditVisible(false)}
          onSave={() => { setEditVisible(false); fetchProfile(); }}
        />
      </Modal>

      {/* ── Followers / Following Modal ── */}
      <Modal
        visible={!!followList}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFollowList(null)}
      >
        <SafeAreaView style={styles.listSheet} edges={['top']}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{followList?.title}</Text>
            <TouchableOpacity onPress={() => setFollowList(null)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {followListLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : (
            <FlatList
              data={followList?.data}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 40 }}
              ListEmptyComponent={
                <Text style={styles.listEmpty}>No {followList?.title?.toLowerCase()} yet.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.listRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    setFollowList(null);
                    navigation.navigate('UserProfile', { viewedUserId: item.id });
                  }}
                >
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.listAvatar} />
                  ) : (
                    <View style={styles.listAvatarPlaceholder}>
                      <Ionicons name="person" size={18} color="#9ca3af" />
                    </View>
                  )}
                  <View style={styles.listRowText}>
                    <Text style={styles.listRowName}>{item.full_name || item.username}</Text>
                    <Text style={styles.listRowUsername}>@{item.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Unfollow / report profile sheet ── */}
      <Modal
        visible={unfollowSheetVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnfollowSheetVisible(false)}
      >
        <Pressable style={styles.sheetOverlay} onPress={() => setUnfollowSheetVisible(false)}>
          <View style={[styles.sheetContainer, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={[styles.sheetItem, { borderBottomColor: colors.borderLight }]}
              onPress={() => { setUnfollowSheetVisible(false); handleFollow(); }}
            >
              <Ionicons name="person-remove-outline" size={22} color={colors.text} />
              <Text style={[styles.sheetItemText, { color: colors.text }]}>Unfollow</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetItem, styles.sheetItemDanger]} onPress={handleReportProfile}>
              <Ionicons name="flag-outline" size={22} color="#ef4444" />
              <Text style={[styles.sheetItemText, styles.sheetItemTextDanger]}>Report Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetItem, styles.sheetCancel, { borderTopColor: colors.borderLight }]}
              onPress={() => setUnfollowSheetVisible(false)}
            >
              <Text style={[styles.sheetCancelText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  wrapper: {
    backgroundColor: c.surface,
  },
  loadingContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: c.surface,
  },

  // ── Banner ──
  banner: {
    width: '100%',
  },
  bannerSafe: {
    flex: 1,
  },

  // ── Avatar ──
  avatarRow: {
    alignItems: 'center',
    zIndex: 1,
  },
  avatarRing: {
    backgroundColor: c.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    backgroundColor: c.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    backgroundColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.surface,
  },

  // ── Info block ──
  info: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    backgroundColor: c.surface,
  },
  name: {
    fontSize: fs(22),
    fontFamily: 'Figtree_700Bold',
    color: c.text,
    marginBottom: 3,
  },
  username: {
    fontSize: fs(15),
    color: c.textSecondary,
    marginBottom: 10,
  },
  bio: {
    fontSize: 14,
    lineHeight: 20,
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
  },

  // ── Stats ──
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: s(56),
    marginBottom: s(18),
  },
  stat: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 13,
    color: c.textSecondary,
  },

  // ── Buttons ──
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    width: '100%',
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  btnText: {
    fontSize: 14,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
  },
  followBtn: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  followBtnText: {
    color: '#fff',
  },
  followingBtn: {
    backgroundColor: c.surface,
    borderWidth: 1.5,
    borderColor: '#7D3F1D',
  },
  followingBtnText: {
    color: '#7D3F1D',
  },
  messageBtn: {
    borderWidth: 1.5,
    borderColor: '#E2DACB',
    backgroundColor: 'transparent',
  },
  messageBtnText: {
    color: '#77674B',
  },

  // ── Follow list modal ──
  listSheet: {
    flex: 1,
    backgroundColor: c.surface,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  listTitle: {
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
  },
  listEmpty: {
    textAlign: 'center',
    color: c.textMuted,
    marginTop: 40,
    fontSize: 14,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  listAvatar: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: c.border,
  },
  listAvatarPlaceholder: {
    width: s(44),
    height: s(44),
    borderRadius: s(22),
    backgroundColor: c.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRowText: {
    flex: 1,
  },
  listRowName: {
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
  },
  listRowUsername: {
    fontSize: 13,
    color: c.textSecondary,
    marginTop: 1,
  },

  // ── Unfollow / report sheet ──
  sheetOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end' },
  sheetContainer: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34, paddingTop: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 24, borderBottomWidth: 1 },
  sheetItemText: { fontSize: 16, fontFamily: 'Figtree_500Medium', marginLeft: 16 },
  sheetItemDanger: { borderBottomWidth: 0 },
  sheetItemTextDanger: { color: '#ef4444' },
  sheetCancel: { justifyContent: 'center', marginTop: 8, borderTopWidth: 8, borderBottomWidth: 0 },
  sheetCancelText: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', textAlign: 'center' },
});