import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Alert, ActivityIndicator, Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { getAuthToken } from '../../lib/auth-client';
import { AUTH_URL } from '../../lib/auth-url';

const FEEDBACK_TYPES = [
  { value: 'bug',        label: 'Report a Bug',     icon: 'bug-outline' },
  { value: 'suggestion', label: 'Suggest a Feature', icon: 'bulb-outline' },
];

async function postFeedback(payload) {
  const token = getAuthToken();
  const res = await fetch(`${AUTH_URL}/api/feedback`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.warn('[SupportFeedback] server error', res.status, body);
  }
  return res.ok;
}

export default function SupportFeedback({ onBack }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Share Your Thoughts state
  const [feedback, setFeedback] = useState('');
  const [feedbackType, setFeedbackType] = useState('suggestion');
  const [submitting, setSubmitting] = useState(false);

  // Contact Support modal state
  const [showContact, setShowContact] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitting, setContactSubmitting] = useState(false);

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) {
      Alert.alert('Empty Feedback', 'Please enter your feedback before submitting.');
      return;
    }
    setSubmitting(true);
    const ok = await postFeedback({
      kind: 'feedback',
      feedbackType,
      message: feedback.trim(),
    });
    setSubmitting(false);
    if (ok) {
      setFeedback('');
      Alert.alert('Thank You!', "Your feedback has been sent to the CRWN team. We'll review it shortly.");
    } else {
      Alert.alert('Error', 'Could not send feedback right now. Please try again.');
    }
  };

  const handleSubmitContact = async () => {
    if (!contactMessage.trim()) {
      Alert.alert('Empty Message', 'Please describe your issue before sending.');
      return;
    }
    setContactSubmitting(true);
    const ok = await postFeedback({
      kind: 'support',
      message: contactMessage.trim(),
    });
    setContactSubmitting(false);
    if (ok) {
      setContactMessage('');
      setShowContact(false);
      Alert.alert('Message Sent', "We've received your support request and will get back to you shortly.");
    } else {
      Alert.alert('Error', 'Could not send your message right now. Please try again.');
    }
  };

  return (
    <View style={styles.fullContainer}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.detailTitle}>Support & Feedback</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>We're Listening</Text>
          <Text style={styles.headerDescription}>
            Your voice matters. Help us build CRWN together.
          </Text>
        </View>

        {/* Contact Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.actionCard} onPress={() => setShowContact(true)}>
            <Ionicons name="mail-outline" size={24} color={colors.primary} />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Contact Support</Text>
              <Text style={styles.actionDescription}>Get help from our team</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Share Your Thoughts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Share Your Thoughts</Text>
          <Text style={styles.question}>What would make CRWN better for you?</Text>

          <View style={styles.typeSelector}>
            {FEEDBACK_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[styles.typeButton, feedbackType === type.value && styles.typeButtonActive]}
                onPress={() => setFeedbackType(type.value)}
              >
                <Ionicons
                  name={type.icon}
                  size={20}
                  color={feedbackType === type.value ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.typeText, feedbackType === type.value && styles.typeTextActive]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.textArea}
            placeholder="Tell us more… We're all ears!"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={6}
            value={feedback}
            onChangeText={setFeedback}
            textAlignVertical="top"
          />

          <TouchableOpacity
            style={[styles.submitButton, (!feedback.trim() || submitting) && styles.submitButtonDisabled]}
            onPress={handleSubmitFeedback}
            disabled={!feedback.trim() || submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.submitButtonText}>Submit Feedback</Text>}
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Contact Support Modal */}
      <Modal
        visible={showContact}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContact(false)}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Pressable style={styles.modalBackdrop} onPress={() => setShowContact(false)}>
            <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="mail-outline" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Contact Support</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>We'll reply to {user?.email || 'your email'}</Text>
                </View>
                <TouchableOpacity onPress={() => setShowContact(false)} style={styles.modalClose}>
                  <Ionicons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Describe your issue or question</Text>
                <TextInput
                  style={[styles.contactInput, { backgroundColor: colors.background, borderColor: colors.borderLight, color: colors.text }]}
                  placeholder="Tell us what's going on…"
                  placeholderTextColor={colors.placeholder}
                  multiline
                  numberOfLines={5}
                  value={contactMessage}
                  onChangeText={setContactMessage}
                  textAlignVertical="top"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.submitButton, (!contactMessage.trim() || contactSubmitting) && styles.submitButtonDisabled]}
                  onPress={handleSubmitContact}
                  disabled={!contactMessage.trim() || contactSubmitting}
                >
                  {contactSubmitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.submitButtonText}>Send Message</Text>}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  fullContainer: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    backgroundColor: c.background,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  detailTitle: { fontSize: 18, fontFamily: 'Figtree_600SemiBold', color: c.text },
  placeholder: { width: 40 },
  container: { flex: 1, backgroundColor: c.background },
  header: { padding: 20 },
  headerTitle: { fontSize: 24, fontFamily: 'Figtree_700Bold', color: c.primary, marginBottom: 8 },
  headerDescription: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  section: { marginTop: 12, paddingHorizontal: 20 },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: c.surface,
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: c.borderLight,
  },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: c.text, marginBottom: 2 },
  actionDescription: { fontSize: 13, color: c.textSecondary },
  question: { fontSize: 16, fontFamily: 'Figtree_600SemiBold', color: c.text, marginBottom: 16 },
  typeSelector: { marginBottom: 16 },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: c.surface,
    borderRadius: 10,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: c.border,
  },
  typeButtonActive: { backgroundColor: c.primaryLight, borderColor: c.selected },
  typeText: { fontSize: 15, color: c.textSecondary },
  typeTextActive: { color: c.selected, fontFamily: 'Figtree_600SemiBold' },
  textArea: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: c.text,
    minHeight: 120,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: c.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitButtonText: { color: '#fff', fontSize: 16, fontFamily: 'Figtree_600SemiBold' },

  // Contact modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#FEF3E2',
    alignItems: 'center', justifyContent: 'center',
  },
  modalTitle:    { fontSize: 16, fontFamily: 'Figtree_700Bold' },
  modalSubtitle: { fontSize: 12, fontFamily: 'Figtree_400Regular', marginTop: 1 },
  modalClose:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalBody:     { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 10 },
  modalLabel:    { fontSize: 13, fontFamily: 'Figtree_500Medium' },
  contactInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    minHeight: 130,
    marginBottom: 4,
  },
});
