import React, { useState } from 'react'; // ← Move useState here
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Modal } from 'react-native'; // ← Add Modal
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import EditProfileScreen from '../EditProfileScreen';

export default function AccountSettings({ onBack }) { // ← Changed from navigation to onBack
  const { user } = useAuth();
  const [showEditProfile, setShowEditProfile] = useState(false); // ← Move to top

  const accountOptions = [
    { title: 'Edit Profile', icon: 'create-outline', onPress: () => setShowEditProfile(true) },
    { title: 'Update Profile Photo', icon: 'camera-outline', onPress: () => Alert.alert('Coming Soon') },
    { title: 'Email & Phone', icon: 'mail-outline', onPress: () => Alert.alert('Coming Soon') },
    { title: 'Change Password', icon: 'key-outline', onPress: () => Alert.alert('Coming Soon') },
    { title: 'Connected Accounts', icon: 'link-outline', onPress: () => Alert.alert('Coming Soon') },
    { title: 'Delete Account', icon: 'trash-outline', onPress: () => handleDeleteAccount(), danger: true },
  ];

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => Alert.alert('Coming Soon') }
      ]
    );
  };

  return (
    <View style={styles.fullContainer}>
      {/* Back Button Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#5D1F1F" />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>Account</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your account, your crown.</Text>
          <Text style={styles.sectionDescription}>
            Manage your personal information and account settings.
          </Text>
        </View>

        {accountOptions.map((option, index) => (
          <TouchableOpacity
            key={index}
            style={styles.option}
            onPress={option.onPress}
          >
            <Ionicons 
              name={option.icon} 
              size={22} 
              color={option.danger ? '#ef4444' : '#6b7280'} 
            />
            <Text style={[styles.optionText, option.danger && styles.dangerText]}>
              {option.title}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <EditProfileScreen onBack={() => setShowEditProfile(false)} />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fullContainer: {
    flex: 1,
    backgroundColor: '#FDF9F0',
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    backgroundColor: '#FDF9F0',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 40,
  },
  container: {
    flex: 1,
    backgroundColor: '#FDF9F0',
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#5D1F1F',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    gap: 12,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  dangerText: {
    color: '#ef4444',
  },
});