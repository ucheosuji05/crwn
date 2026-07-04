import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { authClient } from '../lib/auth-client';
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
};

export default function ForgotPasswordScreen({ onBack }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert('Enter your email', 'Please enter the email address on your account.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email: trimmed,
        redirectTo: `${AUTH_URL}/api/auth/open-app`,
      });

      if (error) {
        Alert.alert('Error', error.message || 'Could not send reset email. Please try again.');
        return;
      }

      setSent(true);
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
            {/* Back button */}
            <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={loading}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>

            {/* Logo */}
            <View style={styles.logoSection}>
              <Text style={styles.logo}>crwn.</Text>
              <Text style={styles.tagline}>
                {sent ? 'Email sent!' : 'Reset password'}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.formSection}>
              {sent ? (
                <>
                  <View style={styles.iconWrap}>
                    <Ionicons name="mail-outline" size={48} color={colors.textBrown} />
                  </View>
                  <Text style={styles.heading}>Check your email</Text>
                  <Text style={styles.body}>
                    We sent a reset link to{'\n'}
                    <Text style={styles.emailHighlight}>{email.trim().toLowerCase()}</Text>
                    {'\n\n'}
                    Click the link to set a new password. It expires in 1 hour.
                  </Text>
                  <TouchableOpacity style={styles.submitButton} onPress={onBack} activeOpacity={0.85}>
                    <Text style={styles.submitButtonText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.heading}>Forgot password?</Text>
                  <Text style={styles.body}>
                    Enter your email and we'll send you a link to reset your password.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="you@example.com"
                      placeholderTextColor="#B0A898"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!loading}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.submitButton, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading
                      ? <ActivityIndicator color={colors.white} />
                      : <Text style={styles.submitButtonText}>Send Reset Link</Text>
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

  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginLeft: -8,
    marginBottom: 8,
  },

  logoSection: {
    alignItems: 'center',
    paddingTop: 32,
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
    marginBottom: 32,
  },
  emailHighlight: {
    fontFamily: 'Figtree_700Bold',
    opacity: 1,
  },

  inputGroup: { marginBottom: 28 },
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

  submitButton: {
    backgroundColor: colors.maroon,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Figtree_600SemiBold',
    letterSpacing: 0.3,
  },
  buttonDisabled: { opacity: 0.6 },
});
