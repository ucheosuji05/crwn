import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../config/supabase';

// Reused as-is from the regular-user Settings flow — these are generic
// account/privacy/support panels with no client-only content.
import AccountSettings from './settings/AccountSettings';
import PrivacySettings from './settings/PrivacySettings';
import SupportFeedback from './settings/SupportFeedback';
import CalendarIntegration from './settings/CalendarIntegration';

// Sections that open an inline panel (mirrors SettingsScreen.js's activeScreen switch).
const PANEL_SECTIONS = [
  { title: 'Calendar Integration', icon: 'calendar-outline', screen: 'calendar', description: 'Sync bookings to Google Calendar' },
  { title: 'Account', icon: 'person-circle-outline', screen: 'account', description: 'Your account, your crown' },
  { title: 'Privacy & Safety', icon: 'shield-checkmark-outline', screen: 'privacy', description: 'Control your data and privacy' },
  { title: 'Support & Feedback', icon: 'chatbubble-ellipses-outline', screen: 'support', description: 'Help us improve CRWN' },
];

// Sections that push a full stack screen instead — existing screens are
// linked in as-is rather than rewritten.
const NAV_SECTIONS = [
  { title: 'Analytics', icon: 'bar-chart-outline', route: 'ProviderAnalytics', description: 'Posts, engagement & booking insights' },
];

export default function StylistSettingsScreen({ navigation }) {
  const { clearAuth } = useAuth();
  const { isDark, setDarkMode, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeScreen, setActiveScreen] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) performSignOut();
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: performSignOut },
        ]
      );
    }
  };

  const performSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch (_) {
      // network error is fine — clearAuth logs out locally regardless
    }
    clearAuth();
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'calendar':
        return <CalendarIntegration onBack={() => setActiveScreen(null)} />;
      case 'account':
        return <AccountSettings onBack={() => setActiveScreen(null)} />;
      case 'privacy':
        return <PrivacySettings onBack={() => setActiveScreen(null)} />;
      case 'support':
        return <SupportFeedback onBack={() => setActiveScreen(null)} />;
      default:
        return null;
    }
  };

  if (activeScreen) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        {renderScreen()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {NAV_SECTIONS.map((section) => (
          <TouchableOpacity
            key={section.route}
            style={styles.settingItem}
            onPress={() => navigation.navigate(section.route)}
            activeOpacity={0.7}
          >
            <View style={styles.settingIcon}>
              <Ionicons name={section.icon} size={22} color={colors.textSecondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{section.title}</Text>
              <Text style={styles.settingDescription}>{section.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}

        {PANEL_SECTIONS.map((section) => (
          <TouchableOpacity
            key={section.screen}
            style={styles.settingItem}
            onPress={() => setActiveScreen(section.screen)}
            activeOpacity={0.7}
          >
            <View style={styles.settingIcon}>
              <Ionicons name={section.icon} size={22} color={colors.textSecondary} />
            </View>
            <View style={styles.settingContent}>
              <Text style={styles.settingTitle}>{section.title}</Text>
              <Text style={styles.settingDescription}>{section.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ))}

        <View style={styles.settingItem}>
          <View style={styles.settingIcon}>
            <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={22} color={colors.textSecondary} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Dark Mode</Text>
            <Text style={styles.settingDescription}>{isDark ? 'Dark theme active' : 'Light theme active'}</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={setDarkMode}
            trackColor={{ false: '#d1d5db', true: colors.primary }}
            thumbColor="#fff"
            ios_backgroundColor="#d1d5db"
          />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
          onPress={handleSignOut}
          disabled={signingOut}
        >
          {signingOut ? (
            <>
              <ActivityIndicator size="small" color="#ef4444" />
              <Text style={styles.signOutText}>Signing out...</Text>
            </>
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c) => StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.hairline,
  },
  headerTitle: { fontSize: 17, fontFamily: 'Figtree_700Bold', color: c.text },
  content: { paddingTop: 8, paddingBottom: 24 },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: { flex: 1 },
  settingTitle: {
    fontSize: 16,
    fontFamily: 'Figtree_600SemiBold',
    color: c.text,
    marginBottom: 2,
  },
  settingDescription: { fontSize: 13, color: c.textSecondary },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: c.borderLight,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: c.primaryLight,
    gap: 8,
  },
  signOutButtonDisabled: { opacity: 0.6 },
  signOutText: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: '#ef4444' },
});
