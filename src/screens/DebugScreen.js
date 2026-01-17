import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { supabase } from '../config/supabase';

export default function DebugScreen() {
  const [results, setResults] = useState([]);

  const addResult = (test, success, message) => {
    setResults(prev => [...prev, { test, success, message, time: new Date().toLocaleTimeString() }]);
  };

  const clearResults = () => setResults([]);

  // Test 1: Check Supabase Config
  const testConfig = () => {
    const url = supabase.supabaseUrl;
    const hasKey = supabase.supabaseKey ? 'Yes' : 'No';
    
    addResult(
      'Config Check',
      url && hasKey === 'Yes',
      `URL: ${url}\nKey exists: ${hasKey}`
    );
  };

  // Test 2: Check Database Connection
  const testConnection = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('count');
      
      if (error) {
        addResult('Database Connection', false, `Error: ${error.message}`);
      } else {
        addResult('Database Connection', true, 'Connected successfully!');
      }
    } catch (err) {
      addResult('Database Connection', false, `Network error: ${err.message}`);
    }
  };

  // Test 3: Check if profiles table exists
  const testProfilesTable = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.code === '42P01') {
          addResult('Profiles Table', false, 'Table does not exist. Run SQL schema!');
        } else {
          addResult('Profiles Table', false, `Error: ${error.message}`);
        }
      } else {
        addResult('Profiles Table', true, `Table exists. Found ${data?.length || 0} rows`);
      }
    } catch (err) {
      addResult('Profiles Table', false, `Error: ${err.message}`);
    }
  };

  // Test 4: Test Auth Signup
  const testSignup = async () => {
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = 'password123';
    
    try {
      // Step 1: Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: testEmail,
        password: testPassword,
      });

      if (authError) {
        addResult('Auth Signup', false, `Auth error: ${authError.message}`);
        return;
      }

      if (!authData.user) {
        addResult('Auth Signup', false, 'No user returned from signup');
        return;
      }

      addResult('Auth Signup', true, `User created: ${authData.user.id}`);

      // Step 2: Try to create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authData.user.id,
          email: testEmail,
          username: `testuser${Date.now()}`,
          full_name: 'Test User',
        }]);

      if (profileError) {
        addResult('Profile Creation', false, `Profile error: ${profileError.message}\nCode: ${profileError.code}\nDetails: ${profileError.details}`);
        
        // Clean up - delete the auth user
        await supabase.auth.admin.deleteUser(authData.user.id);
      } else {
        addResult('Profile Creation', true, 'Profile created successfully!');
        
        // Clean up
        Alert.alert('Success!', 'Test signup worked! Cleaning up test user...');
        await supabase.from('profiles').delete().eq('id', authData.user.id);
      }
    } catch (err) {
      addResult('Test Signup', false, `Unexpected error: ${err.message}`);
    }
  };

  // Test 5: Check Current User
  const testCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        addResult('Current User', true, `Logged in as: ${user.email}`);
      } else {
        addResult('Current User', true, 'Not logged in');
      }
    } catch (err) {
      addResult('Current User', false, `Error: ${err.message}`);
    }
  };

  // Test 6: Check RLS Policies
  const testRLS = async () => {
    try {
      // Try to insert without auth (should fail with RLS)
      const { error } = await supabase
        .from('profiles')
        .insert([{
          id: '00000000-0000-0000-0000-000000000001',
          email: 'test@test.com',
          username: 'test',
          full_name: 'Test',
        }]);

      if (error) {
        if (error.code === '42501' || error.message.includes('policy')) {
          addResult('RLS Check', true, 'RLS is active (this is good!)');
        } else {
          addResult('RLS Check', false, `Unexpected error: ${error.message}`);
        }
      } else {
        addResult('RLS Check', false, 'RLS not active (security issue!)');
      }
    } catch (err) {
      addResult('RLS Check', false, `Error: ${err.message}`);
    }
  };

  const runAllTests = async () => {
    clearResults();
    testConfig();
    await testConnection();
    await testProfilesTable();
    await testCurrentUser();
    await testRLS();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Supabase Debug Tool</Text>
      
      <ScrollView style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={runAllTests}>
          <Text style={styles.buttonText}>🚀 Run All Tests</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testConfig}>
          <Text style={styles.buttonText}>1. Check Config</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testConnection}>
          <Text style={styles.buttonText}>2. Test Connection</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testProfilesTable}>
          <Text style={styles.buttonText}>3. Check Profiles Table</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testCurrentUser}>
          <Text style={styles.buttonText}>4. Check Current User</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testRLS}>
          <Text style={styles.buttonText}>5. Check RLS Policies</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testSignup}>
          <Text style={styles.buttonText}>6. Test Full Signup Flow</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={clearResults}>
          <Text style={styles.buttonText}>Clear Results</Text>
        </TouchableOpacity>
      </ScrollView>

      <ScrollView style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        {results.length === 0 && (
          <Text style={styles.noResults}>No tests run yet. Click a button above!</Text>
        )}
        {results.map((result, index) => (
          <View key={index} style={[styles.result, result.success ? styles.success : styles.failure]}>
            <Text style={styles.resultIcon}>{result.success ? '✅' : '❌'}</Text>
            <View style={styles.resultContent}>
              <Text style={styles.resultTest}>{result.test}</Text>
              <Text style={styles.resultMessage}>{result.message}</Text>
              <Text style={styles.resultTime}>{result.time}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    maxHeight: 280,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2563eb',
    padding: 14,
    borderRadius: 8,
    marginBottom: 8,
  },
  clearButton: {
    backgroundColor: '#6b7280',
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 15,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  noResults: {
    textAlign: 'center',
    color: '#666',
    marginTop: 20,
  },
  result: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  success: {
    backgroundColor: '#d1fae5',
  },
  failure: {
    backgroundColor: '#fee2e2',
  },
  resultIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  resultContent: {
    flex: 1,
  },
  resultTest: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  resultMessage: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  resultTime: {
    fontSize: 12,
    color: '#666',
  },
});
