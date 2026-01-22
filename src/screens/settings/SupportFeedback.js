import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SupportFeedback({ onBack }) {
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('suggestion');

  const feedbackTypes = [
    { value: 'bug', label: 'Report a Bug', icon: 'bug-outline' },
    { value: 'suggestion', label: 'Suggest a Feature', icon: 'bulb-outline' },
    { value: 'question', label: 'Ask a Question', icon: 'help-circle-outline' },
  ];

  const handleSubmit = () => {
    if (!feedback.trim()) {
      Alert.alert('Empty Feedback', 'Please enter your feedback before submitting.');
      return;
    }

    Alert.alert(
      'Thank You!',
      'Your feedback helps us make CRWN better. We\'ll review it and get back to you if needed.',
      [{ text: 'OK', onPress: () => setFeedback('') }]
    );
  };

  return (
    <View style={styles.fullContainer}>
      {/* Back Button Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#5D1F1F" />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>Support & Feedback</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>We're Listening</Text>
          <Text style={styles.headerDescription}>
            Your voice matters. Help us build CRWN together through co-creation, not complaints.
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => Alert.alert('Coming Soon', 'Help center articles')}
          >
            <Ionicons name="book-outline" size={24} color="#5D1F1F" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Help Center</Text>
              <Text style={styles.actionDescription}>Browse FAQs and guides</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionCard}
            onPress={() => Alert.alert('Contact Support', 'Email: support@crwnapp.com')}
          >
            <Ionicons name="mail-outline" size={24} color="#5D1F1F" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Contact Support</Text>
              <Text style={styles.actionDescription}>Get help from our team</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>

        {/* Feedback Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Share Your Thoughts</Text>
          
          <Text style={styles.question}>What would make CRWN better for you?</Text>
          
          <View style={styles.typeSelector}>
            {feedbackTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.typeButton,
                  feedbackType === type.value && styles.typeButtonActive
                ]}
                onPress={() => setFeedbackType(type.value)}
              >
                <Ionicons 
                  name={type.icon} 
                  size={20} 
                  color={feedbackType === type.value ? '#5D1F1F' : '#6b7280'} 
                />
                <Text style={[
                  styles.typeText,
                  feedbackType === type.value && styles.typeTextActive
                ]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.textArea}
            placeholder="Tell us more... We're all ears! 💭"
            placeholderTextColor="#9ca3af"
            multiline
            numberOfLines={6}
            value={feedback}
            onChangeText={setFeedback}
            textAlignVertical="top"
          />

          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>Submit Feedback</Text>
          </TouchableOpacity>
        </View>

        {/* Community Impact */}
        <View style={styles.impactCard}>
          <Ionicons name="people" size={32} color="#5D1F1F" />
          <Text style={styles.impactTitle}>Community-Driven Growth</Text>
          <Text style={styles.impactText}>
            Over 500+ features suggested by our community. Your ideas shape CRWN's future.
          </Text>
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
  },
  headerTitle: {
    fontSize: 24,
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
    marginTop: 12,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  typeSelector: {
    marginBottom: 16,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  typeButtonActive: {
    backgroundColor: '#fef2f2',
    borderColor: '#5D1F1F',
  },
  typeText: {
    fontSize: 15,
    color: '#6b7280',
  },
  typeTextActive: {
    color: '#5D1F1F',
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#5D1F1F',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  impactCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  impactTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#5D1F1F',
    marginTop: 12,
    marginBottom: 8,
  },
  impactText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});