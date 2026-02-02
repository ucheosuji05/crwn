import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UserHeader from '../components/UserHeader';
import HairProfile from '../components/HairProfile';
import ProfileTabs from '../components/ProfileTabs';
import SettingsScreen from './SettingsScreen';

export default function ProfileScreen() {
  const [settingsVisible, setSettingsVisible] = useState(false);

  return (
    <View style={styles.container}>
      {/* Settings Icon - Top Right */}
      <TouchableOpacity 
        style={styles.settingsButton}
        onPress={() => setSettingsVisible(true)}
      >
        <Ionicons name="settings-outline" size={24} color="#5D1F1F" />
      </TouchableOpacity>

      <ScrollView showsVerticalScrollIndicator={false}>
        <UserHeader />
        <HairProfile />
        <ProfileTabs />
      </ScrollView>

      {/* Settings Modal */}
      <Modal
        visible={settingsVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <SettingsScreen onClose={() => setSettingsVisible(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  settingsButton: {
    position: 'absolute',
    top: 50,
    right: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});