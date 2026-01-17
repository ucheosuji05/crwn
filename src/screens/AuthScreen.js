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
import { useAuth } from '../hooks/useAuth';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    console.log('=== AUTH SUBMIT STARTED ===');
    console.log('Mode:', isSignUp ? 'SIGN UP' : 'SIGN IN');
    console.log('Email:', email);
    console.log('Password length:', password.length);
    console.log('Name:', name);
    console.log('Username:', username);
    
    // Validation
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (isSignUp && (!name || !username)) {
      Alert.alert('Error', 'Please enter name and username');
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        console.log('🔵 Calling signUp function...');
        
        const result = await signUp(email, password, { 
          name: name.trim(), 
          username: username.toLowerCase().trim() 
        });
        
        console.log('🔵 SignUp result:', JSON.stringify(result, null, 2));
        
        if (result.error) {
          console.error('❌ SIGN UP ERROR:', result.error);
          console.error('Error message:', result.error.message);
          console.error('Error code:', result.error.code);
          console.error('Error status:', result.error.status);
          console.error('Full error:', JSON.stringify(result.error, null, 2));
          
          Alert.alert(
            'Sign Up Failed', 
            result.error.message || 'Unknown error occurred',
            [{ text: 'OK' }]
          );
        } else {
          console.log('✅ SIGN UP SUCCESS');
          Alert.alert(
            'Success!', 
            'Account created successfully!',
            [{ text: 'OK', onPress: () => setIsSignUp(false) }]
          );
        }
      } else {
        console.log('🔵 Calling signIn function...');
        
        const result = await signIn(email, password);
        
        console.log('🔵 SignIn result:', JSON.stringify(result, null, 2));
        
        if (result.error) {
          console.error('❌ SIGN IN ERROR:', result.error);
          console.error('Error message:', result.error.message);
          
          Alert.alert(
            'Sign In Failed', 
            result.error.message || 'Invalid email or password'
          );
        } else {
          console.log('✅ SIGN IN SUCCESS');
        }
      }
    } catch (error) {
      console.error('❌ UNEXPECTED ERROR:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      Alert.alert(
        'Error', 
        `Unexpected error: ${error.message || 'Unknown error'}`
      );
    } finally {
      setLoading(false);
      console.log('=== AUTH SUBMIT ENDED ===');
    }
  };

  return (
    <LinearGradient colors={["#8B4513", "#D2691E"]} style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            <Text style={styles.title}>CRWN</Text>
            <Text style={styles.subtitle}>Your Hair Care Community</Text>
            
            {isSignUp && (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#999"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!loading}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Username (no spaces)"
                  placeholderTextColor="#999"
                  value={username}
                  onChangeText={(text) => setUsername(text.replace(/\s/g, ''))}
                  autoCapitalize="none"
                  editable={!loading}
                />
              </>
            )}
            
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password (min 6 characters)"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />
            
            <TouchableOpacity 
              style={[styles.button, loading && styles.buttonDisabled]} 
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#8B4513" />
              ) : (
                <Text style={styles.buttonText}>
                  {isSignUp ? 'Sign Up' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => setIsSignUp(!isSignUp)}
              disabled={loading}
            >
              <Text style={styles.switchText}>
                {isSignUp ? 'Have an account? Sign In' : 'Need an account? Sign Up'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#fff',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#fff',
    opacity: 0.9,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    marginTop: 8,
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
    marginTop: 20,
    fontSize: 14,
  },
});