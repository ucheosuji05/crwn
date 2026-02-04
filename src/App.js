import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Auth
import { AuthProvider, useAuth } from './src/hooks/useAuth';

// Screens
import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';

// =============================================================================
// APP CONTENT (uses auth context)
// =============================================================================

function AppContent() {
  const { user, loading } = useAuth();
  const [showSignIn, setShowSignIn] = useState(false);

  console.log('AppContent render - user:', user?.email || 'NO USER');

  // Show loading spinner while checking auth state
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#5D1F1F" />
      </View>
    );
  }

  // User is authenticated - show main app
  if (user) {
    return (
      <NavigationContainer>
        <BottomTabNavigator />
      </NavigationContainer>
    );
  }

  // User wants to sign in (has existing account)
  if (showSignIn) {
    return (
      <AuthScreen 
        onBack={() => setShowSignIn(false)}
      />
    );
  }

  // Show onboarding for new users (not authenticated)
  return (
    <OnboardingScreen
      onDone={() => {
        // After signup completes, the AuthProvider will detect the session
        // and automatically show the main app (user will be set)
      }}
      onSignIn={() => {
        // User clicked "Sign in" - show AuthScreen
        setShowSignIn(true);
      }}
    />
  );
}

// =============================================================================
// MAIN APP (wraps everything in providers)
// =============================================================================

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FDF9F0',
  },
});
