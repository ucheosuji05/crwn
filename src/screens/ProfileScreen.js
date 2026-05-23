import { useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, Modal, TouchableOpacity, Platform, useWindowDimensions, RefreshControl } from 'react-native';
import { webWrap, WEB_MAX_WIDTHS } from '../utils/webLayout';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import UserHeader from '../components/UserHeader';
import ProfileTabs from '../components/ProfileTabs';
import SettingsScreen from './SettingsScreen';

export default function ProfileScreen({ route, navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [profileVersion, setProfileVersion] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setProfileVersion(v => v + 1);
    // Small delay so child components have time to re-mount before we clear the spinner
    await new Promise(r => setTimeout(r, 600));
    setRefreshing(false);
  }, []);

  const viewedUserId = route?.params?.viewedUserId || user?.id;
  const isOwnProfile = viewedUserId === user?.id;
  const isStackScreen = route?.name === 'UserProfile';

  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.surface },
      webWrap(WEB_MAX_WIDTHS.profile),
      Platform.OS === 'web' && { height: windowHeight },
    ]}>
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
        {/* UserHeader no longer receives onBack — the overlay button below handles it */}
        <UserHeader
          key={profileVersion}
          viewedUserId={viewedUserId}
          isOwnProfile={isOwnProfile}
        />
        <ProfileTabs key={profileVersion} viewedUserId={viewedUserId} isOwnProfile={isOwnProfile} />
      </ScrollView>

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
