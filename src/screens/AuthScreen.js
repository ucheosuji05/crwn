import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';
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

export default function AuthScreen({ onBack, onForgotPassword }) {
  const { signIn, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const isDisabled = loading || googleLoading;

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      console.log('[AuthScreen] signing in to', AUTH_URL, 'email:', email.trim().toLowerCase());
      const result = await signIn(email.trim().toLowerCase(), password, rememberMe);
      if (result.error) {
        Alert.alert('Sign In Failed', result.error.message || 'Invalid email or password');
      }
    } catch (err) {
      Alert.alert('Error', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result.error) {
        const msg = result.error.message || result.error.statusText || result.error.code || 'Please try again.';
        Alert.alert('Google Sign In Failed', msg);
      }
    } catch (e) {
      Alert.alert('Error', e?.message || 'Something went wrong. Please try again.');
    } finally {
      setGoogleLoading(false);
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
            {onBack && (
              <TouchableOpacity style={styles.backButton} onPress={onBack} disabled={isDisabled}>
                <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            )}

            {/* Logo */}
            <View style={styles.logoSection}>
              <Text style={styles.logo}>crwn.</Text>
              <Text style={styles.tagline}>Welcome back</Text>
            </View>

            {/* Form */}
            <View style={styles.formSection}>

              {/* Google button */}
              <>
                  <TouchableOpacity
                    style={[styles.googleButton, isDisabled && styles.buttonDisabled]}
                    onPress={handleGoogleSignIn}
                    disabled={isDisabled}
                    activeOpacity={0.85}
                  >
                    {googleLoading ? (
                      <ActivityIndicator color={colors.textBrown} />
                    ) : (
                      <>
                        <Ionicons name="logo-google" size={18} color={colors.textBrown} />
                        <Text style={styles.googleButtonText}>Continue with Google</Text>
                      </>
                    )}
                  </TouchableOpacity>

                  <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>or sign in with email</Text>
                    <View style={styles.dividerLine} />
                  </View>
              </>

              {/* Email */}
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
                  editable={!isDisabled}
                />
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#B0A898"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isDisabled}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(v => !v)}
                  >
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Remember me + Forgot password row */}
              <View style={styles.rememberRow}>
                <TouchableOpacity
                  style={styles.rememberToggle}
                  onPress={() => setRememberMe(v => !v)}
                  disabled={isDisabled}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                    {rememberMe && <Ionicons name="checkmark" size={13} color="#fff" />}
                  </View>
                  <Text style={styles.rememberText}>Remember me</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onForgotPassword} disabled={isDisabled}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              {/* Sign In */}
              <TouchableOpacity
                style={[styles.signInButton, isDisabled && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={isDisabled}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.signInButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Switch to sign up */}
              {onBack && (
                <TouchableOpacity onPress={onBack} disabled={isDisabled} style={styles.switchRow}>
                  <Text style={styles.switchText}>
                    Don't have an account?{' '}
                    <Text style={styles.switchLink}>Sign Up</Text>
                  </Text>
                </TouchableOpacity>
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

  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingVertical: 16,
    borderRadius: 14,
    width: '100%',
    marginBottom: 20,
  },
  googleButtonText: {
    color: colors.textBrown,
    fontSize: 15,
    fontFamily: 'Figtree_600SemiBold',
  },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(93,58,26,0.25)',
  },
  dividerText: {
    color: colors.textBrown,
    fontSize: 13,
    fontFamily: 'Figtree_400Regular',
    opacity: 0.8,
  },

  inputGroup: { marginBottom: 20 },
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

  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    marginTop: -4,
  },
  rememberToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.textBrown,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: colors.maroon,
    borderColor: colors.maroon,
  },
  rememberText: {
    color: colors.textBrown,
    fontSize: 13,
    fontFamily: 'Figtree_400Regular',
  },
  forgotText: {
    color: colors.textBrown,
    fontSize: 13,
    fontFamily: 'Figtree_400Regular',
  },

  signInButton: {
    backgroundColor: colors.maroon,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  signInButtonText: {
    color: colors.white,
    fontSize: 16,
    fontFamily: 'Figtree_600SemiBold',
    letterSpacing: 0.3,
  },

  buttonDisabled: { opacity: 0.6 },

  switchRow: { alignItems: 'center' },
  switchText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontFamily: 'Figtree_400Regular',
  },
  switchLink: {
    fontFamily: 'Figtree_700Bold',
    color: colors.white,
  },
});
