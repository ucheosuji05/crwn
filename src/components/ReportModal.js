import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../context/ThemeContext';
import { getAuthToken } from '../lib/auth-client';
import { AUTH_URL } from '../lib/auth-url';
import { useBlock } from '../context/BlockContext';

const REPORT_REASONS = [
  { key: 'spam',        label: 'Spam or unwanted content' },
  { key: 'nudity',      label: 'Nudity or sexual content' },
  { key: 'hate_speech', label: 'Hate speech or symbols' },
  { key: 'violence',    label: 'Violence or threats' },
  { key: 'harassment',  label: 'Harassment or bullying' },
  { key: 'false_info',  label: 'False information' },
  { key: 'other',       label: 'Something else' },
];

/**
 * ReportModal — multi-step: reason picker → optional block prompt → done.
 *
 * Props:
 *   visible        — boolean
 *   onClose        — called on dismiss / done
 *   type           — 'user' | 'post'
 *   targetId       — userId (type='user') or postId (type='post')
 *   targetName     — display name shown in the block prompt
 *   reportedUserId — for post reports: the post author's user ID
 */
export default function ReportModal({
  visible,
  onClose,
  type,
  targetId,
  targetName,
  reportedUserId,
}) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { blockUser } = useBlock();

  const [step, setStep] = useState('reason');
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const blockTargetId = type === 'user' ? targetId : reportedUserId;

  const reset = () => {
    setStep('reason');
    setSelected(null);
    setLoading(false);
  };

  const handleClose = () => { reset(); onClose(); };

  const handleSubmitReport = async () => {
    if (!selected || !user?.id) return;
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`${AUTH_URL}/api/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type,
          reason: selected,
          targetName: targetName || null,
          reportedUserId: type === 'user' ? targetId : (reportedUserId || null),
          reportedPostId: type === 'post' ? targetId : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.warn('[ReportModal] server error', res.status, body);
      }
    } catch (err) {
      console.error('[ReportModal] fetch error', err);
    }
    setLoading(false);
    if (blockTargetId && blockTargetId !== user.id) {
      setStep('block');
    } else {
      setStep('done');
    }
  };

  const handleBlock = async () => {
    if (!user?.id || !blockTargetId) { setStep('done'); return; }
    setLoading(true);
    await blockUser(blockTargetId);
    setLoading(false);
    setStep('done');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {step === 'reason' && (
            <>
              <View style={styles.header}>
                <View style={styles.headerSpacer} />
                <Text style={[styles.title, { color: colors.text }]}>Report</Text>
                <TouchableOpacity onPress={handleClose} hitSlop={8} style={styles.closeBtn}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Why are you reporting this?
              </Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {REPORT_REASONS.map(r => (
                  <TouchableOpacity
                    key={r.key}
                    style={[styles.reasonRow, { borderBottomColor: colors.borderLight }]}
                    onPress={() => setSelected(r.key)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.reasonText, { color: colors.text }]}>{r.label}</Text>
                    <View style={[styles.radio, selected === r.key && styles.radioSelected]}>
                      {selected === r.key && <View style={styles.radioDot} />}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.btn, !selected && styles.btnDisabled]}
                onPress={handleSubmitReport}
                disabled={!selected || loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Submit Report</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'block' && (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="ban-outline" size={48} color="#5D1F1F" />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>
                Block {targetName || 'this user'}?
              </Text>
              <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                They won't be able to find your profile or posts. You won't see their content either.
              </Text>
              <TouchableOpacity style={styles.btn} onPress={handleBlock} disabled={loading}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Block {targetName || 'User'}</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtn} onPress={() => setStep('done')}>
                <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'done' && (
            <>
              <View style={styles.iconWrap}>
                <Ionicons name="checkmark-circle" size={56} color="#3B7A3B" />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Thanks for letting us know</Text>
              <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                Your report has been submitted. We review all reports and take action when our guidelines are violated.
              </Text>
              <TouchableOpacity style={styles.btn} onPress={handleClose}>
                <Text style={styles.btnText}>Done</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '82%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerSpacer: { width: 30 },
  title: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Figtree_700Bold',
    textAlign: 'center',
  },
  closeBtn: { width: 30, alignItems: 'flex-end' },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Figtree_400Regular',
    marginBottom: 12,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reasonText: {
    fontSize: 15,
    fontFamily: 'Figtree_400Regular',
    flex: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#C0C0C0',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioSelected: { borderColor: '#5D1F1F' },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#5D1F1F',
  },
  btn: {
    backgroundColor: '#5D1F1F',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
  },
  skipBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  skipText: {
    fontSize: 14,
    fontFamily: 'Figtree_500Medium',
  },
  iconWrap: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  bodyText: {
    fontSize: 14,
    fontFamily: 'Figtree_400Regular',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 4,
  },
});
