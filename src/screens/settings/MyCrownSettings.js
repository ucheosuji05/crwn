import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function MyCrownSettings({ onBack }) {
  const [affirmationsEnabled, setAffirmationsEnabled] = useState(true);
  const [affirmationFrequency, setAffirmationFrequency] = useState('daily');
  const [languageTone, setLanguageTone] = useState('empowering');
  const [celebrationReminders, setCelebrationReminders] = useState(true);

  const frequencyOptions = [
    { value: 'daily', label: 'Daily', icon: 'sunny-outline' },
    { value: 'weekly', label: 'Weekly', icon: 'calendar-outline' },
    { value: 'off', label: 'Off', icon: 'moon-outline' },
  ];

  const toneOptions = [
    { value: 'gentle', label: 'Gentle', description: 'Soft, nurturing encouragement', icon: '🌸' },
    { value: 'empowering', label: 'Empowering', description: 'Confident, strong affirmations', icon: '💪' },
    { value: 'bold', label: 'Bold', description: 'Fierce, unapologetic declarations', icon: '👑' },
  ];

  return (
    <View style={styles.fullContainer}>
      {/* Back Button Header */}
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#5D1F1F" />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>My Crown 👑</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.crown}>👑</Text>
          <Text style={styles.headerTitle}>Your Crown, Your Way</Text>
          <Text style={styles.headerDescription}>
            Personalize your daily affirmations and celebrations. CRWN is here to uplift you.
          </Text>
        </View>

        {/* Affirmations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Daily Affirmations</Text>
          
          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Enable Affirmations</Text>
              <Text style={styles.optionDescription}>
                Receive daily reminders that you're worthy
              </Text>
            </View>
            <Switch
              value={affirmationsEnabled}
              onValueChange={setAffirmationsEnabled}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>

          {affirmationsEnabled && (
            <>
              <Text style={styles.subSectionTitle}>Frequency</Text>
              <View style={styles.buttonGroup}>
                {frequencyOptions.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.frequencyButton,
                      affirmationFrequency === option.value && styles.frequencyButtonActive
                    ]}
                    onPress={() => setAffirmationFrequency(option.value)}
                  >
                    <Ionicons 
                      name={option.icon} 
                      size={20} 
                      color={affirmationFrequency === option.value ? '#5D1F1F' : '#6b7280'} 
                    />
                    <Text style={[
                      styles.frequencyText,
                      affirmationFrequency === option.value && styles.frequencyTextActive
                    ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Language Tone */}
        {affirmationsEnabled && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Language Tone</Text>
            <Text style={styles.sectionDescription}>
              Choose how we speak to you. Your crown, your voice.
            </Text>
            
            {toneOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.toneOption,
                  languageTone === option.value && styles.toneOptionActive
                ]}
                onPress={() => setLanguageTone(option.value)}
              >
                <Text style={styles.toneIcon}>{option.icon}</Text>
                <View style={styles.toneContent}>
                  <Text style={[
                    styles.toneLabel,
                    languageTone === option.value && styles.toneLabelActive
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.toneDescription}>{option.description}</Text>
                </View>
                {languageTone === option.value && (
                  <Ionicons name="checkmark-circle" size={24} color="#5D1F1F" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Celebrations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Celebration Reminders</Text>
          
          <View style={styles.option}>
            <View style={styles.optionContent}>
              <Text style={styles.optionLabel}>Personal Milestones</Text>
              <Text style={styles.optionDescription}>
                Wash day anniversaries, big chop celebrations, and more
              </Text>
            </View>
            <Switch
              value={celebrationReminders}
              onValueChange={setCelebrationReminders}
              trackColor={{ false: '#d1d5db', true: '#5D1F1F' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Example Affirmation */}
        {affirmationsEnabled && (
          <View style={styles.exampleCard}>
            <Ionicons name="sparkles" size={24} color="#5D1F1F" />
            <Text style={styles.exampleTitle}>Example Affirmation</Text>
            <Text style={styles.exampleText}>
              {languageTone === 'gentle' && "Your hair is beautiful exactly as it is. You're doing amazing. 🌸"}
              {languageTone === 'empowering' && "Your crown is powerful. You're unstoppable. Wear it with pride. 💪"}
              {languageTone === 'bold' && "Your hair is revolutionary. Your existence is resistance. Own it. 👑"}
            </Text>
          </View>
        )}
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
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderBottomColor: '#fecaca',
  },
  crown: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#5D1F1F',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    textAlign: 'center',
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
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#6b7280',
    paddingHorizontal: 20,
    marginBottom: 12,
    lineHeight: 18,
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    paddingHorizontal: 20,
    marginTop: 16,
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
  buttonGroup: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  frequencyButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 6,
  },
  frequencyButtonActive: {
    backgroundColor: '#fef2f2',
    borderColor: '#5D1F1F',
  },
  frequencyText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  frequencyTextActive: {
    color: '#5D1F1F',
    fontWeight: '600',
  },
  toneOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 12,
  },
  toneOptionActive: {
    backgroundColor: '#fef2f2',
  },
  toneIcon: {
    fontSize: 32,
  },
  toneContent: {
    flex: 1,
  },
  toneLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  toneLabelActive: {
    color: '#5D1F1F',
    fontWeight: '600',
  },
  toneDescription: {
    fontSize: 13,
    color: '#6b7280',
  },
  exampleCard: {
    margin: 20,
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    alignItems: 'center',
  },
  exampleTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5D1F1F',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 15,
    color: '#111827',
    textAlign: 'center',
    lineHeight: 22,
  },
});