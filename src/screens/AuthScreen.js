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

export default function AuthScreen({ onBack, onForgotPassword }) {
  const { signIn /* , signInWithGoogle */ } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  // const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }
    setLoading(true);
    try {
      console.log('[AuthScreen] signing in to', AUTH_URL, 'email:', email.trim().toLowerCase());
      const result = await signIn(email.trim().toLowerCase(), password);
      console.log('[AuthScreen] signIn result:', result);
      if (result.error) {
        Alert.alert('Sign In Failed', result.error.message || 'Invalid email or password');
      }
    } catch (err) {
      console.error('[AuthScreen] signIn exception:', err);
      Alert.alert('Error', err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // const handleGoogleSignIn = async () => {
  //   setGoogleLoading(true);
  //   try {
  //     const result = await signInWithGoogle();
  //     if (result.error) {
  //       const msg = result.error.message || result.error.statusText || result.error.code || 'Please try again.';
  //       Alert.alert('Google Sign In Failed', msg);
  //     }
  //   } catch (e) {
  //     Alert.alert('Error', e?.message || 'Something went wrong. Please try again.');
  //   } finally {
  //     setGoogleLoading(false);
  //   }
  // };

  const isDisabled = loading;

  return (
    <LinearGradient
      colors={['#E8C4B8', '#D4A574', '#A67B5B']}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {onBack && (
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            )}

            <View style={styles.content}>
              <Text style={styles.title}>crâ™›n</Text>
              <Text style={styles.subtitle}>Welcome back</Text>

              {/* ── Google sign in ───────────────────────────────── */}
              {/* <TouchableOpacity
                style={[styles.googleButton, isDisabled && styles.buttonDisabled]}
                onPress={handleGoogleSignIn}
                disabled={isDisabled}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#444" />
                ) : (
                  <>
                    <Ionicons name="logo-google" size={20} color="#444" />
                    <Text style={styles.googleButtonText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity> */}

              {/* ── Divider ───────────────────────────────────────── */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or sign in with email</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* ── Email ─────────────────────────────────────────── */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isDisabled}
                />
              </View>

              {/* ── Password ──────────────────────────────────────── */}
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#999"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isDisabled}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off' : 'eye'}
                      size={22}
                      color="#666"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={styles.forgotButton} onPress={onForgotPassword}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              {/* ── Email sign in button ──────────────────────────── */}
              <TouchableOpacity
                style={[styles.button, isDisabled && styles.buttonDisabled]}
                onPress={handleSignIn}
                disabled={isDisabled}
              >
                {loading ? (
                  <ActivityIndicator color="#8B4513" />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              {onBack && (
                <TouchableOpacity onPress={onBack} disabled={isDisabled}>
                  <Text style={styles.switchText}>
                    Don't have an account?{' '}
                    <Text style={styles.switchLink}>Create one</Text>
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
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginTop: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#fff',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 32,
    color: '#fff',
    opacity: 0.9,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    padding: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  googleButtonText: {
    color: '#444',
    fontWeight: '700',
    fontSize: 15,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dividerText: {
    color: '#fff',
    fontSize: 13,
    opacity: 0.8,
  },
  inputContainer: { marginBottom: 16 },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 8,
    opacity: 0.9,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    borderRadius: 10,
    fontSize: 16,
    color: '#111',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
  },
  passwordInput: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: '#111',
  },
  eyeButton: { paddingHorizontal: 14 },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: { color: '#fff', fontSize: 14 },
  button: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#8B4513',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 16,
  },
  switchText: {
    textAlign: 'center',
    color: '#fff',
    marginTop: 8,
    fontSize: 14,
  },
  switchLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
