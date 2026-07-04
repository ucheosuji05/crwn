import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../config/supabase';
import EditProfileScreen from '../EditProfileScreen';

export default function AccountSettings({ onBack, onProfileUpdated }) {
  const { user, clearAuth } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  // Delete account state
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleProfileSaved = () => {
    setShowEditProfile(false);
    if (onProfileUpdated) onProfileUpdated();
  };

  // ── Change Password ────────────────────────────────────────────────────────
  const isPwStrong = (p) =>
    p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);

  const handleChangePassword = async () => {
    if (!isPwStrong(newPassword)) {
      Alert.alert('Weak password', 'Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setShowPasswordModal(false);
        setNewPassword('');
        setConfirmPassword('');
        Alert.alert('Success', 'Your password has been updated.');
      }
    } catch (err) {
      Alert.alert('Error', 'Password change is not available right now.');
    }
    setPwLoading(false);
  };

  // ── Change Email ──────────────────────────────────────────────────────────
  const handleChangeEmail = async () => {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setShowEmailModal(false);
        setNewEmail('');
        Alert.alert(
          'Check Your Inbox',
          'A confirmation link has been sent to your new email address. Click it to complete the change.',
        );
      }
    } catch (err) {
      Alert.alert('Error', 'Email change is not available right now.');
    }
    setEmailLoading(false);
  };

  // ── Delete Account ────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') {
      Alert.alert('Confirmation Required', 'Please type DELETE to confirm.');
      return;
    }
    setDeleteLoading(true);
    // Mark account for deletion then sign out
    await supabase
      .from('profiles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', user.id);
    try {
      await supabase.auth.signOut();
    } catch (_) {
      // supabase.auth is disabled when accessToken is configured
    }
    clearAuth();
    setDeleteLoading(false);
  };

  const accountOptions = [
    { title: 'Edit Profile', icon: 'create-outline', onPress: () => setShowEditProfile(true) },
    { title: 'Change Password', icon: 'key-outline', onPress: () => setShowPasswordModal(true) },
    { title: 'Update Email', icon: 'mail-outline', onPress: () => setShowEmailModal(true) },
    {
      title: 'Delete Account',
      icon: 'trash-outline',
      onPress: () => setShowDeleteModal(true),
      danger: true,
    },
  ];

  return (
    <View style={styles.fullContainer}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
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
          <TouchableOpacity key={index} style={styles.option} onPress={option.onPress}>
            <Ionicons name={option.icon} size={22} color={option.danger ? '#ef4444' : '#6b7280'} />
            <Text style={[styles.optionText, option.danger && styles.dangerText]}>
              {option.title}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Edit Profile Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowEditProfile(false)}
      >
        <EditProfileScreen
          onBack={() => setShowEditProfile(false)}
          onSave={handleProfileSaved}
        />
      </Modal>

      {/* ── Change Password Modal ──────────────────────────────────────────── */}
      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={() => setShowPasswordModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="New password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showNewPw}
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowNewPw(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {newPassword.length > 0 && (
              <View style={styles.pwRulesWrap}>
                <Text style={styles.pwRulesTitle}>Must contain:</Text>
                {[
                  { key: 'length',    label: 'At least 8 characters',  test: p => p.length >= 8 },
                  { key: 'uppercase', label: 'One uppercase letter',    test: p => /[A-Z]/.test(p) },
                  { key: 'lowercase', label: 'One lowercase letter',    test: p => /[a-z]/.test(p) },
                  { key: 'number',    label: 'One number',              test: p => /[0-9]/.test(p) },
                  { key: 'special',   label: 'One special character',   test: p => /[^A-Za-z0-9]/.test(p) },
                ].map(rule => {
                  const met = rule.test(newPassword);
                  return (
                    <View key={rule.key} style={styles.pwRuleRow}>
                      <Ionicons
                        name={met ? 'checkmark-circle' : 'ellipse-outline'}
                        size={13}
                        color={met ? '#3B7A3B' : '#AAAAAA'}
                      />
                      <Text style={[styles.pwRuleText, met && styles.pwRuleTextMet]}>
                        {rule.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="Confirm new password"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showConfirmPw}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowConfirmPw(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'} size={20} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowPasswordModal(false); setNewPassword(''); setConfirmPassword(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleChangePassword} disabled={pwLoading}>
                {pwLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmBtnText}>Update</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Change Email Modal ─────────────────────────────────────────────── */}
      <Modal visible={showEmailModal} transparent animationType="fade" onRequestClose={() => setShowEmailModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Update Email</Text>
            <Text style={styles.modalSubtitle}>
              Current: {user?.email ?? '—'}
            </Text>

            <View style={styles.inputRow}>
              <TextInput
                style={styles.input}
                placeholder="New email address"
                placeholderTextColor={colors.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                value={newEmail}
                onChangeText={setNewEmail}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowEmailModal(false); setNewEmail(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleChangeEmail} disabled={emailLoading}>
                {emailLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmBtnText}>Send Link</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Delete Account Modal ───────────────────────────────────────────── */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Ionicons name="warning-outline" size={36} color="#ef4444" style={{ marginBottom: 12 }} />
            <Text style={[styles.modalTitle, { color: '#ef4444' }]}>Delete Account</Text>
            <Text style={styles.modalSubtitle}>
              This cannot be undone. All your posts, bookmarks, and profile data will be permanently removed.
            </Text>
            <Text style={styles.deleteLabel}>Type DELETE to confirm</Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, styles.deleteInput]}
                placeholder="DELETE"
                placeholderTextColor={colors.placeholder}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, styles.dangerBtn]}
                onPress={handleDeleteAccount}
                disabled={deleteLoading || deleteConfirmText !== 'DELETE'}
              >
                {deleteLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmBtnText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => StyleSheet.create({
  fullContainer: { flex: 1, backgroundColor: c.background },
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
  section: { padding: 20 },
  sectionTitle: { fontSize: 20, fontFamily: 'Figtree_700Bold', color: c.primary, marginBottom: 8 },
  sectionDescription: { fontSize: 14, color: c.textSecondary, lineHeight: 20 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: c.borderLight,
    gap: 12,
  },
  optionText: { flex: 1, fontSize: 16, color: c.text },
  dangerText: { color: '#ef4444' },
  // Modal shared
  overlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'stretch',
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Figtree_700Bold',
    color: c.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: c.inputBackground,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: c.text,
  },
  eyeBtn: { padding: 4 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, color: c.textSecondary, fontFamily: 'Figtree_500Medium' },
  confirmBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: c.primary,
    alignItems: 'center',
  },
  confirmBtnText: { fontSize: 15, color: '#fff', fontFamily: 'Figtree_600SemiBold' },
  dangerBtn: { backgroundColor: '#ef4444' },
  deleteLabel: {
    fontSize: 13,
    fontFamily: 'Figtree_600SemiBold',
    color: c.textSecondary,
    marginBottom: 8,
  },
  deleteInput: { letterSpacing: 2 },
  pwRulesWrap: { marginBottom: 12, gap: 4 },
  pwRulesTitle: { fontSize: 12, color: '#666', marginBottom: 2, fontFamily: 'Figtree_500Medium' },
  pwRuleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwRuleText: { fontSize: 12, color: '#AAAAAA', fontFamily: 'Figtree_400Regular' },
  pwRuleTextMet: { color: '#3B7A3B' },
});
