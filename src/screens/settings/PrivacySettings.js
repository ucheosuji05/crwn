import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function PrivacySettings({ onBack }) {
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [hidePhotos, setHidePhotos] = useState(false);
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [blurPhotos, setBlurPhotos] = useState(false);

  const visibilityOptions = [
    { value: 'public', label: 'Public', description: 'Anyone can see your profile' },
    { value: 'community', label: 'Community Only', description: 'Only CRWN members can see your profile' },
    { value: 'private', label: 'Private', description: 'Only people you approve can see your profile' },
  ];

  return (
    <View style={styles.fullContainer}>
      {/* Back Button Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#5D1F1F" />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>Privacy & Safety</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Trust + Protection</Text>
          <Text style={styles.headerDescription}>
            Your safety is our priority. Control who sees your content and how you interact.
          </Text>
        </View>

        {/* Profile Visibility */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Visibility</Text>
          
          {visibilityOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={styles.radioOption}
              onPress={() => setProfileVisibility(option.value)}
            >
              <View style={styles.radioContent}>
                <Text style={styles.radioLabel}>{option.label}</Text>
                <Text style={styles.radioDescription}>{option.description}</Text>
              </View>
              <View style={[
                styles.radioCircle,
                profileVisibility === option.value && styles.radioCircleSelected
              ]}>
                {profileVisibility === option.value && (
                  <View style={styles.radioInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Photo Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photo Privacy</Text>
          
          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Hide Hair Photos from Public</Text>
              <Text style={styles.optionDescription}>
                Keep your hair photos visible only to followers
              </Text>
            </View>
            <Switch
              value={hidePhotos}
              onValueChange={setHidePhotos}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Blur Photos by Default</Text>
              <Text style={styles.optionDescription}>
                Photos are blurred until you choose to reveal them
              </Text>
            </View>
            <Switch
              value={blurPhotos}
              onValueChange={setBlurPhotos}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Browsing Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Browsing Privacy</Text>
          
          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Anonymous Browsing Mode</Text>
              <Text style={styles.optionDescription}>
                Browse content without leaving a trace
              </Text>
            </View>
            <Switch
              value={anonymousMode}
              onValueChange={setAnonymousMode}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Safety Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => Alert.alert('Coming Soon', 'Blocked users management')}
          >
            <Ionicons name="ban-outline" size={22} color="#6b7280" />
            <Text style={styles.actionText}>Blocked Users</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => Alert.alert('Coming Soon', 'Report content or users')}
          >
            <Ionicons name="flag-outline" size={22} color="#6b7280" />
            <Text style={styles.actionText}>Report Content or Users</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Data Transparency */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Transparency</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => Alert.alert('Data Usage', 'CRWN collects only the data necessary to provide you with a personalized experience. We never sell your data to third parties.')}
          >
            <Ionicons name="document-text-outline" size={22} color="#6b7280" />
            <Text style={styles.actionText}>How We Use Your Data</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => Alert.alert('Coming Soon', 'Download your data')}
          >
            <Ionicons name="download-outline" size={22} color="#6b7280" />
            <Text style={styles.actionText}>Download My Data</Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#5D1F1F',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  section: {
    marginTop: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  optionContent: {
    flex: 1,
    marginRight: 16,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  radioContent: {
    flex: 1,
    marginRight: 16,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  radioDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#5D1F1F',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5D1F1F',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
});