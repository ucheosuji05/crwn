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
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../hooks/useAuth';

export default function AuthScreen({ onBack }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    // Validation
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setLoading(true);

    try {
      const result = await signIn(email.trim().toLowerCase(), password);
      
      if (result.error) {
        console.error('Sign in error:', result.error);
        Alert.alert(
          'Sign In Failed', 
          result.error.message || 'Invalid email or password'
        );
      }
      // If successful, the AuthProvider will detect the session change
      // and App.js will automatically show the main app
    } catch (error) {
      console.error('Unexpected error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
            {/* Back Button */}
            {onBack && (
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            )}

            <View style={styles.content}>
              {/* Logo */}
              <Text style={styles.title}>cr♛n</Text>
              <Text style={styles.subtitle}>Welcome back</Text>
              
              {/* Email Input */}
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
              
              {/* Password Input */}
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
                    editable={!loading}
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

              {/* Forgot Password */}
              <TouchableOpacity style={styles.forgotButton}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
              
              {/* Sign In Button */}
              <TouchableOpacity 
                style={[styles.button, loading && styles.buttonDisabled]} 
                onPress={handleSignIn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#8B4513" />
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </TouchableOpacity>
              
              {/* Back to Create Account */}
              {onBack && (
                <TouchableOpacity onPress={onBack} disabled={loading}>
                  <Text style={styles.switchText}>
                    Don't have an account? <Text style={styles.switchLink}>Create one</Text>
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
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
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
    marginBottom: 40,
    color: '#fff',
    opacity: 0.9,
  },
  inputContainer: {
    marginBottom: 16,
  },
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
  eyeButton: {
    paddingHorizontal: 14,
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    color: '#fff',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
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
