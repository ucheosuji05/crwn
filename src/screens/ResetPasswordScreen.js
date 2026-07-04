import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AUTH_URL } from '../lib/auth-url';

const colors = {
  gradientTop: '#E8C4B8',
  gradientMiddle: '#D4A574',
  gradientBottom: '#A67B5B',
  white: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#5E5E5E',
  textBrown: '#5D3A1A',
  maroon: '#5D1F1F',
  green: '#3B7A3B',
  ruleGray: '#AAAAAA',
};

const PW_RULES = [
  { key: 'length',    label: 'At least 8 characters',  test: p => p.length >= 8 },
  { key: 'uppercase', label: 'One uppercase letter',    test: p => /[A-Z]/.test(p) },
  { key: 'lowercase', label: 'One lowercase letter',    test: p => /[a-z]/.test(p) },
  { key: 'number',    label: 'One number',              test: p => /[0-9]/.test(p) },
  { key: 'special',   label: 'One special character',   test: p => /[^A-Za-z0-9]/.test(p) },
];
const isPwStrong = p => PW_RULES.every(r => r.test(p));

export default function ResetPasswordScreen({ token, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!isPwStrong(password)) {
      Alert.alert('Weak password', 'Please meet all password requirements.');
      return;
    }
    if (password !== confirm) {
      Alert.alert("Passwords don't match", 'Please make sure both fields match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${AUTH_URL}/api/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: AUTH_URL },
        body: JSON.stringify({ newPassword: password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.message || body.error || 'The link may have expired. Request a new one.';
        Alert.alert('Reset Failed', msg);
        return;
      }

      setSuccess(true);
    } catch (e) {
      Alert.alert('Error', e?.message || 'Could not reach the server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.gradientTop, colors.gradientMiddle, colors.gradientBottom]}
      locations={[0, 0.5, 1]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.logoSection}>
              <Text style={styles.logo}>crwn.</Text>
              <Text style={styles.tagline}>
                {success ? 'All done!' : 'set new password'}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.formSection}>
              {success ? (
                <>
                  <View style={styles.iconWrap}>
                    <Ionicons name="checkmark-circle-outline" size={56} color={colors.textBrown} />
                  </View>
                  <Text style={styles.heading}>Password updated!</Text>
                  <Text style={styles.body}>
                    Your password has been reset. Sign in with your new password.
                  </Text>
                  <TouchableOpacity style={styles.submitButton} onPress={onDone} activeOpacity={0.85}>
                    <Text style={styles.submitButtonText}>Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.heading}>Choose a new password</Text>
                  <Text style={styles.body}>Must be at least 8 characters and meet the requirements below.</Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>New password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="Create a strong password"
                        placeholderTextColor="#B0A898"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        editable={!loading}
                      />
                      <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(v => !v)}>
                        <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                    {password.length > 0 && (
                      <View style={styles.pwRulesWrap}>
                        <Text style={styles.pwRulesTitle}>Must contain:</Text>
                        {PW_RULES.map(rule => {
                          const met = rule.test(password);
                          return (
                            <View key={rule.key} style={styles.pwRuleRow}>
                              <Ionicons
                                name={met ? 'checkmark-circle' : 'ellipse-outline'}
                                size={14}
                                color={met ? colors.green : colors.ruleGray}
                              />
                              <Text style={[styles.pwRuleText, met && styles.pwRuleTextMet]}>
                                {rule.label}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Confirm password</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Repeat your password"
                      placeholderTextColor="#B0A898"
                      value={confirm}
                      onChangeText={setConfirm}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                    {confirm.length > 0 && password !== confirm && (
                      <Text style={styles.errorText}>Passwords don't match</Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.submitButton, (loading || !isPwStrong(password) || password !== confirm) && styles.buttonDisabled]}
                    onPress={handleReset}
                    disabled={loading || !isPwStrong(password) || password !== confirm}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color={colors.white} />
                      : <Text style={styles.submitButtonText}>Reset Password</Text>
                    }
                  </TouchableOpacity>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },

  logoSection: {
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 36,
  },
  logo: {
    fontSize: 52,
    fontFamily: 'LibreBaskerville_700Bold',
    color: colors.textBrown,
    lineHeight: 60,
  },
  tagline: {
    fontSize: 17,
    fontFamily: 'LibreBaskerville_400Regular',
    fontStyle: 'italic',
    color: colors.textBrown,
    marginTop: 6,
  },

  formSection: { flex: 1 },

  iconWrap: { alignItems: 'center', marginBottom: 20 },
  heading: {
    fontSize: 22,
    fontFamily: 'Figtree_700Bold',
    color: colors.textBrown,
    textAlign: 'center',
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    fontFamily: 'Figtree_400Regular',
    color: colors.textBrown,
    textAlign: 'center',
    opacity: 0.85,
    lineHeight: 22,
    marginBottom: 28,
  },

  inputGroup: { marginBottom: 18 },
  inputLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 8,
    fontFamily: 'Figtree_400Regular',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    fontFamily: 'Figtree_400Regular',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D1D1',
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.textPrimary,
    fontFamily: 'Figtree_400Regular',
  },
  eyeButton: { paddingHorizontal: 12 },

  pwRulesWrap: { marginTop: 10, gap: 5 },
  pwRulesTitle: { fontSize: 12, color: '#666', marginBottom: 2, fontFamily: 'Figtree_500Medium' },
  pwRuleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pwRuleText: { fontSize: 12, color: colors.ruleGray, fontFamily: 'Figtree_400Regular' },
  pwRuleTextMet: { color: colors.green },

  errorText: { color: '#ef4444', fontSize: 12, marginTop: 4, fontFamily: 'Figtree_400Regular' },

  submitButton: {
    backgroundColor: colors.maroon,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Figtree_600SemiBold',
    letterSpacing: 0.3,
  },
  buttonDisabled: { opacity: 0.5 },
});
