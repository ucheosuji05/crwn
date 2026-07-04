import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { getAuthToken } from '../../lib/auth-client';
import { AUTH_URL } from '../../lib/auth-url';

const REPORT_TYPES = [
  { key: 'user',    label: 'A user account',       icon: 'person-outline' },
  { key: 'content', label: 'A post or content',    icon: 'image-outline' },
];

const REPORT_REASONS = [
  { key: 'spam',        label: 'Spam or unwanted content' },
  { key: 'nudity',      label: 'Nudity or sexual content' },
  { key: 'hate_speech', label: 'Hate speech or symbols' },
  { key: 'violence',    label: 'Violence or threats' },
  { key: 'harassment',  label: 'Harassment or bullying' },
  { key: 'false_info',  label: 'False information' },
  { key: 'other',       label: 'Something else' },
];

export default function ReportContentScreen({ onBack }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [reportType, setReportType] = useState(null);
  const [detail, setDetail] = useState('');
  const [reason, setReason] = useState(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit = reportType && reason && detail.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || !user?.id) return;
    setLoading(true);
    try {
      const token = getAuthToken();
      await fetch(`${AUTH_URL}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type: reportType,
          reason,
          notes: `[${reportType === 'user' ? 'User' : 'Content'}] ${detail.trim()}`,
        }),
      });
    } catch (_) {}
    setLoading(false);
    setDone(true);
  };

  if (done) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.doneWrap}>
          <Ionicons name="checkmark-circle" size={60} color="#3B7A3B" />
          <Text style={styles.doneTitle}>Report submitted</Text>
          <Text style={styles.doneBody}>
            Thanks for letting us know. We review all reports and take action when our community guidelines are violated.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={onBack}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionLabel}>What are you reporting?</Text>
        <View style={styles.card}>
          {REPORT_TYPES.map((t, i) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.row, i === 0 && styles.rowBorder]}
              onPress={() => setReportType(t.key)}
            >
              <Ionicons name={t.icon} size={20} color={colors.textSecondary} style={styles.rowIcon} />
              <Text style={[styles.rowTitle, styles.flex]}>{t.label}</Text>
              <View style={[styles.radio, reportType === t.key && styles.radioSelected]}>
                {reportType === t.key && <View style={styles.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {reportType && (
          <>
            <Text style={styles.sectionLabel}>
              {reportType === 'user' ? 'Username or profile link' : 'Describe the content'}
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder={
                reportType === 'user'
                  ? 'e.g. @username or a link to the profile'
                  : 'Describe what you saw and where it appeared'
              }
              placeholderTextColor={colors.placeholder}
              value={detail}
              onChangeText={setDetail}
              multiline={reportType === 'content'}
              numberOfLines={reportType === 'content' ? 4 : 1}
              autoCapitalize="none"
              maxLength={500}
            />

            <Text style={styles.sectionLabel}>Reason for reporting</Text>
            <View style={styles.card}>
              {REPORT_REASONS.map((r, i) => (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.row, i < REPORT_REASONS.length - 1 && styles.rowBorder]}
                  onPress={() => setReason(r.key)}
                >
                  <Text style={[styles.rowTitle, styles.flex]}>{r.label}</Text>
                  <View style={[styles.radio, reason === r.key && styles.radioSelected]}>
                    {reason === r.key && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitBtnText}>Submit Report</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    backgroundColor: c.background,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Figtree_600SemiBold', color: c.text },
  placeholder: { width: 40 },
  content: { padding: 20, paddingBottom: 48 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Figtree_600SemiBold',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 24,
  },
  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: c.borderLight,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.borderLight },
  rowIcon: { marginRight: 12 },
  rowTitle: { fontSize: 15, fontFamily: 'Figtree_500Medium', color: c.text },
  flex: { flex: 1 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: c.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioSelected: { borderColor: '#5D1F1F' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#5D1F1F' },
  textInput: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.borderLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Figtree_400Regular',
    color: c.text,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#5D1F1F',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 32,
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
  doneWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 14,
  },
  doneTitle: { fontSize: 20, fontFamily: 'Figtree_700Bold', color: c.text },
  doneBody: {
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },
  doneBtn: {
    backgroundColor: '#5D1F1F',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  doneBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Figtree_600SemiBold' },
});
