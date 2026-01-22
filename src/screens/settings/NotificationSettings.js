import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationSettings({ onBack }) {
  const [notifications, setNotifications] = useState({
    appUpdates: true,
    communityPosts: true,
    stylistMatches: false,
    newContent: true,
    promotions: false,
    likes: true,
    comments: true,
    follows: true,
    messages: true,
  });

  const toggleNotification = (key) => {
    setNotifications(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={styles.fullContainer}>
      {/* Back Button Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#5D1F1F" />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Respect your attention</Text>
          <Text style={styles.headerDescription}>
            Choose what notifications you want to receive. We believe in quality over quantity.
          </Text>
        </View>

        {/* App & Community */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App & Community</Text>
          
          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>App Updates</Text>
              <Text style={styles.optionDescription}>New features and improvements</Text>
            </View>
            <Switch
              value={notifications.appUpdates}
              onValueChange={() => toggleNotification('appUpdates')}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Community Posts</Text>
              <Text style={styles.optionDescription}>New posts from people you follow</Text>
            </View>
            <Switch
              value={notifications.communityPosts}
              onValueChange={() => toggleNotification('communityPosts')}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>New Content Drops</Text>
              <Text style={styles.optionDescription}>Hair care tips, tutorials & articles</Text>
            </View>
            <Switch
              value={notifications.newContent}
              onValueChange={() => toggleNotification('newContent')}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Stylists */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Stylists</Text>
          
          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Stylist Matches</Text>
              <Text style={styles.optionDescription}>When stylists match your hair profile</Text>
            </View>
            <Switch
              value={notifications.stylistMatches}
              onValueChange={() => toggleNotification('stylistMatches')}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Social */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social</Text>
          
          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Likes</Text>
              <Text style={styles.optionDescription}>Someone likes your post</Text>
            </View>
            <Switch
              value={notifications.likes}
              onValueChange={() => toggleNotification('likes')}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Comments</Text>
              <Text style={styles.optionDescription}>Someone comments on your post</Text>
            </View>
            <Switch
              value={notifications.comments}
              onValueChange={() => toggleNotification('comments')}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>New Followers</Text>
              <Text style={styles.optionDescription}>Someone follows you</Text>
            </View>
            <Switch
              value={notifications.follows}
              onValueChange={() => toggleNotification('follows')}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Messages</Text>
              <Text style={styles.optionDescription}>Direct messages from community</Text>
            </View>
            <Switch
              value={notifications.messages}
              onValueChange={() => toggleNotification('messages')}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Promotions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Promotions (Optional)</Text>
          
          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Special Offers</Text>
              <Text style={styles.optionDescription}>Product deals & partner discounts</Text>
            </View>
            <Switch
              value={notifications.promotions}
              onValueChange={() => toggleNotification('promotions')}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>
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
});