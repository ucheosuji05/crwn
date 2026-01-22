import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';

export default function AccountSettings({ navigation }) {
  const { user } = useAuth();

  const accountOptions = [
    { title: 'Edit Profile', icon: 'create-outline', onPress: () => navigation.navigate('EditProfile') },
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