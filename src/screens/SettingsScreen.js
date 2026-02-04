import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../hooks/useAuth';

// Import all settings screens
import AccountSettings from './settings/AccountSettings';
import PreferencesSettings from './settings/PreferencesSettings';
import NotificationSettings from './settings/NotificationSettings';
import PrivacySettings from './settings/PrivacySettings';
import MyCrownSettings from './settings/MyCrownSettings';
import CommunityGuidelines from './settings/CommunityGuidelines';
import SupportFeedback from './settings/SupportFeedback';
import AboutCRWN from './settings/AboutCRWN';

export default function SettingsScreen({ onClose }) {
  const { signOut } = useAuth();
  const [activeScreen, setActiveScreen] = useState(null);
  const [signingOut, setSigningOut] = useState(false);

  const settingsSections = [
    {
      title: 'Account',
      icon: 'person-circle-outline',
      screen: 'account',
      description: 'Your account, your crown'
    },
    {
      title: 'Preferences',
      icon: 'options-outline',
      screen: 'preferences',
      description: 'Personalize your experience'
    },
    {
      title: 'Notifications',
      icon: 'notifications-outline',
      screen: 'notifications',
      description: 'Manage your alerts'
    },
    {
      title: 'Privacy & Safety',
      icon: 'shield-checkmark-outline',
      screen: 'privacy',
      description: 'Control your data and privacy'
    },
    {
      title: 'My Crown 👑',
      icon: 'sparkles-outline',
      screen: 'mycrown',
      description: 'Affirmations & celebrations',
      special: true
    },
    {
      title: 'Community Guidelines',
      icon: 'people-outline',
      screen: 'guidelines',
      description: 'Our values and culture'
    },
    {
      title: 'Support & Feedback',
      icon: 'chatbubble-ellipses-outline',
      screen: 'support',
      description: 'Help us improve CRWN'
    },
    {
      title: 'About CRWN',
      icon: 'information-circle-outline',
      screen: 'about',
      description: 'Our mission and story'
    }
  ];

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: performSignOut }
      ]
    );
  };

  const performSignOut = () => {
    console.log('=== SIGN OUT START ===');
    setSigningOut(true);
    
    // Call signOut (this clears user state immediately)
    signOut();
    
    console.log('=== SIGN OUT COMPLETE ===');
    
    // Close modal
    onClose();
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case 'account':
        return <AccountSettings onBack={() => setActiveScreen(null)} />;
      case 'preferences':
        return <PreferencesSettings onBack={() => setActiveScreen(null)} />;
      case 'notifications':
        return <NotificationSettings onBack={() => setActiveScreen(null)} />;
      case 'privacy':
        return <PrivacySettings onBack={() => setActiveScreen(null)} />;
      case 'mycrown':
        return <MyCrownSettings onBack={() => setActiveScreen(null)} />;
      case 'guidelines':
        return <CommunityGuidelines onBack={() => setActiveScreen(null)} />;
      case 'support':
        return <SupportFeedback onBack={() => setActiveScreen(null)} />;
      case 'about':
        return <AboutCRWN onBack={() => setActiveScreen(null)} />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.modalHeader}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.modalTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      {activeScreen ? (
        renderScreen()
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <Text style={styles.headerSubtitle}>Manage your CRWN experience</Text>
          </View>

          {settingsSections.map((section, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.settingItem, section.special && styles.specialItem]}
              onPress={() => setActiveScreen(section.screen)}
            >
              <View style={styles.settingIcon}>
                <Ionicons 
                  name={section.icon} 
                  size={24} 
                  color={section.special ? '#5D1F1F' : '#6b7280'} 
                />
              </View>
              <View style={styles.settingContent}>
                <Text style={[styles.settingTitle, section.special && styles.specialTitle]}>
                  {section.title}
                </Text>
                <Text style={styles.settingDescription}>{section.description}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
            </TouchableOpacity>
          ))}

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

          <Text style={styles.version}>CRWN v1.0.0</Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF9F0',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 40,
  },
  header: {
    padding: 20,
    paddingTop: 10,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  specialItem: {
    backgroundColor: '#fef2f2',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  specialTitle: {
    color: '#5D1F1F',
  },
  settingDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    gap: 8,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
  version: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
    color: '#9ca3af',
  },
});