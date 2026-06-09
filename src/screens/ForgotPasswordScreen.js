import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL || 'http://localhost:3001';

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
      const res = await fetch(`${AUTH_URL}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: AUTH_URL },
        body: JSON.stringify({ email: trimmed, redirectTo: 'crwn://reset-password' }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body.message || body.error || `Server error ${res.status}`;
        Alert.alert('Error', msg);
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
    <LinearGradient colors={['#E8C4B8', '#D4A574', '#A67B5B']} locations={[0, 0.5, 1]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={styles.backButton} onPress={onBack}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.content}>
              <Text style={styles.title}>crâ™›n</Text>

              {sent ? (
                <>
                  <View style={styles.iconWrap}>
                    <Ionicons name="mail-outline" size={48} color="#fff" />
                  </View>
                  <Text style={styles.heading}>Check your email</Text>
                  <Text style={styles.body}>
                    We sent a password reset link to{'\n'}
                    <Text style={styles.emailHighlight}>{email.trim().toLowerCase()}</Text>
                    {'\n\n'}
                    Open the link on your phone to set a new password. It expires in 1 hour.
                  </Text>
                  <TouchableOpacity style={styles.button} onPress={onBack}>
                    <Text style={styles.buttonText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.heading}>Forgot password?</Text>
                  <Text style={styles.body}>
                    Enter your email and we'll send you a link to reset your password.
                  </Text>

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
                      editable={!loading}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                  >
                    {loading
                      ? <ActivityIndicator color="#8B4513" />
                      : <Text style={styles.buttonText}>Send Reset Link</Text>
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
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  backButton: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 12, marginTop: 8,
  },
  content: { flex: 1, justifyContent: 'center', padding: 24, paddingBottom: 40 },
  title: {
    fontSize: 48, fontWeight: 'bold', textAlign: 'center',
    marginBottom: 32, color: '#fff', letterSpacing: 2,
  },
  iconWrap: { alignItems: 'center', marginBottom: 16 },
  heading: {
    fontSize: 24, fontWeight: '700', color: '#fff',
    textAlign: 'center', marginBottom: 12,
  },
  body: {
    fontSize: 15, color: '#fff', textAlign: 'center',
    opacity: 0.9, lineHeight: 22, marginBottom: 32,
  },
  emailHighlight: { fontWeight: '700' },
  inputContainer: { marginBottom: 24 },
  inputLabel: { color: '#fff', fontSize: 14, marginBottom: 8, opacity: 0.9 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd',
    padding: 14, borderRadius: 10, fontSize: 16, color: '#111',
  },
  button: { backgroundColor: '#fff', padding: 16, borderRadius: 10 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#8B4513', textAlign: 'center', fontWeight: '700', fontSize: 16 },
});
