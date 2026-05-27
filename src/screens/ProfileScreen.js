import { useState, useCallback, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Modal, TouchableOpacity, Platform, RefreshControl, ActivityIndicator } from 'react-native';
import { WEB_MAX_WIDTHS } from '../utils/webLayout';
import { injectScrollbarCSS } from '../utils/injectScrollbarCSS';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import UserHeader from '../components/UserHeader';
import ProfileTabs from '../components/ProfileTabs';
import SettingsScreen from './SettingsScreen';
import { supabase } from '../config/supabase';

export default function ProfileScreen({ route, navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [settingsVisible, setSettingsVisible] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // null = still checking, false = regular user, true = stylist (redirecting)
  const [checkingRole, setCheckingRole] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') injectScrollbarCSS();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setProfileVersion(v => v + 1);
    await new Promise(r => setTimeout(r, 600));
    setRefreshing(false);
  }, []);

  const viewedUserId = route?.params?.viewedUserId || user?.id;
  const isOwnProfile = viewedUserId === user?.id;
  const isStackScreen = route?.name === 'UserProfile';

  // When viewing someone else's profile, check if they're a stylist.
  // If so, swap this screen for StylistProfile so the correct layout is shown.
  useEffect(() => {
    if (!viewedUserId || isOwnProfile || !isStackScreen) return;
    setCheckingRole(true);
    supabase
      .from('profiles')
      .select('is_stylist')
      .eq('id', viewedUserId)
      .single()
      .then(({ data }) => {
        if (data?.is_stylist) {
          // Replace so pressing Back skips this screen
          navigation.replace('StylistProfile', { stylist: { id: viewedUserId } });
        } else {
          setCheckingRole(false);
        }
      });
  }, [viewedUserId]);

  // Show a brief spinner while we decide which profile layout to use
  if (checkingRole) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.surface }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {Platform.OS === 'web' ? (
        /* ── Web: native <div> with CSS 100vh — guarantees real viewport height
           so scrollHeight > clientHeight and the scrollbar thumb appears.      */
        <div
          className="crwn-profile-scroll-div"
          style={{
            height: '100vh',
            overflowY: 'scroll',
            maxWidth: WEB_MAX_WIDTHS.profile,
            width: '100%',
            marginLeft: 'auto',
            marginRight: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(0,0,0,0.25) transparent',
          }}
        >
          <UserHeader key={profileVersion} viewedUserId={viewedUserId} isOwnProfile={isOwnProfile} />
          <ProfileTabs key={profileVersion} viewedUserId={viewedUserId} isOwnProfile={isOwnProfile} />
        </div>
      ) : (
        /* ── Native: keep ScrollView with pull-to-refresh */
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >
          <UserHeader key={profileVersion} viewedUserId={viewedUserId} isOwnProfile={isOwnProfile} />
          <ProfileTabs key={profileVersion} viewedUserId={viewedUserId} isOwnProfile={isOwnProfile} />
        </ScrollView>
      )}

      {/* Back arrow — absolute overlay so ScrollView never swallows the touch */}
      {isStackScreen && (
        <TouchableOpacity
          style={[styles.backOverlay, { top: insets.top + 8 }]}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      )}

      {/* Settings gear — absolute overlay, own profile only */}
      {isOwnProfile && !isStackScreen && (
        <TouchableOpacity
          style={[styles.settingsOverlay, { top: insets.top + 8 }]}
          onPress={() => setSettingsVisible(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
      )}

      <Modal
        visible={settingsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <SettingsScreen
          onClose={() => setSettingsVisible(false)}
          onProfileUpdated={() => setProfileVersion(v => v + 1)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },
  backOverlay: {
    position: 'absolute',
    left: 14,
    padding: 6,
    zIndex: 100,
  },
  settingsOverlay: {
    position: 'absolute',
    right: 14,
    padding: 6,
    zIndex: 100,
  },
});
