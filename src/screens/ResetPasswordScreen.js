import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL || 'http://localhost:3001';

export default function ResetPasswordScreen({ token, onDone }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (password.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords don\'t match', 'Please make sure both fields match.');
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
    <LinearGradient colors={['#E8C4B8', '#D4A574', '#A67B5B']} locations={[0, 0.5, 1]} style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <Text style={styles.title}>crâ™›n</Text>

              {success ? (
                <>
                  <View style={styles.iconWrap}>
                    <Ionicons name="checkmark-circle-outline" size={56} color="#fff" />
                  </View>
                  <Text style={styles.heading}>Password updated!</Text>
                  <Text style={styles.body}>
                    Your password has been reset. Sign in with your new password.
                  </Text>
                  <TouchableOpacity style={styles.button} onPress={onDone}>
                    <Text style={styles.buttonText}>Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.heading}>Set new password</Text>
                  <Text style={styles.body}>Choose a password that's at least 6 characters.</Text>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>New password</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder="At least 6 characters"
                        placeholderTextColor="#999"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        editable={!loading}
                      />
                      <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(v => !v)}>
                        <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#666" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.inputLabel}>Confirm password</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Repeat your password"
                      placeholderTextColor="#999"
                      value={confirm}
                      onChangeText={setConfirm}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      editable={!loading}
                    />
                  </View>

                  <TouchableOpacity
                    style={[styles.button, loading && styles.buttonDisabled]}
                    onPress={handleReset}
                    disabled={loading}
                  >
                    {loading
                      ? <ActivityIndicator color="#8B4513" />
                      : <Text style={styles.buttonText}>Reset Password</Text>
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
  inputContainer: { marginBottom: 16 },
  inputLabel: { color: '#fff', fontSize: 14, marginBottom: 8, opacity: 0.9 },
  input: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd',
    padding: 14, borderRadius: 10, fontSize: 16, color: '#111',
  },
  passwordContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
  },
  passwordInput: { flex: 1, padding: 14, fontSize: 16, color: '#111' },
  eyeButton: { paddingHorizontal: 14 },
  button: { backgroundColor: '#fff', padding: 16, borderRadius: 10, marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#8B4513', textAlign: 'center', fontWeight: '700', fontSize: 16 },
});
