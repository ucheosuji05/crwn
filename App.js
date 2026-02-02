import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import OnboardingScreen from './src/screens/OnboardingScreen';
import BottomTabNavigator from './src/navigation/BottomTabNavigator';

// Theme
import { colors } from './src/theme';

// =============================================================================
// APP STATE
// =============================================================================

const AppState = {
  LOADING: 'loading',
  ONBOARDING: 'onboarding',
  AUTHENTICATED: 'authenticated',
};

// =============================================================================
// MAIN APP COMPONENT
// =============================================================================

export default function App() {
  const [appState, setAppState] = useState(AppState.LOADING);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  /**
   * Check if user has completed onboarding or is logged in
   */
  const checkAuthStatus = async () => {
    try {
      // Check for existing session/onboarding status
      const [onboarded, userProfile, authToken] = await Promise.all([
        AsyncStorage.getItem('onboarded'),
        AsyncStorage.getItem('user_profile'),
        AsyncStorage.getItem('auth_token'), // For future auth implementation
      ]);

      // If user has completed onboarding OR has an auth token, go to main app
      if (onboarded === 'true' || authToken) {
        setAppState(AppState.AUTHENTICATED);
      } else {
        setAppState(AppState.ONBOARDING);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      // Default to onboarding if there's an error
      setAppState(AppState.ONBOARDING);
    }
  };

  /**
   * Handle completion of onboarding flow
   */
  const handleOnboardingComplete = () => {
    setAppState(AppState.AUTHENTICATED);
  };

  /**
   * Handle sign in navigation (for existing users)
   * This would typically navigate to a sign in screen
   */
  const handleSignIn = async () => {
    // For now, we'll implement a placeholder
    // In a real app, this would show a sign in modal/screen
    console.log('Navigate to sign in');
    
    // Placeholder: Check if there's a saved profile and sign them in
    try {
      const userProfile = await AsyncStorage.getItem('user_profile');
      if (userProfile) {
        // User has previously signed up, let them in
        await AsyncStorage.setItem('onboarded', 'true');
        setAppState(AppState.AUTHENTICATED);
      } else {
        // In a real app, show sign in UI
        // For now, just continue to onboarding
        console.log('No existing profile found');
      }
    } catch (error) {
      console.error('Sign in error:', error);
    }
  };

  /**
   * Handle sign out (for future use)
   */
  const handleSignOut = async () => {
    try {
      await AsyncStorage.multiRemove(['onboarded', 'auth_token']);
      setAppState(AppState.ONBOARDING);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  // Loading state
  if (appState === AppState.LOADING) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.honey} />
      </View>
    );
  }

  // Onboarding flow
  if (appState === AppState.ONBOARDING) {
    return (
      <SafeAreaProvider>
        <OnboardingScreen
          onDone={handleOnboardingComplete}
          onSignIn={handleSignIn}
        />
      </SafeAreaProvider>
    );
  }

  // Main authenticated app
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <BottomTabNavigator />
      </NavigationContainer>
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
    backgroundColor: colors.offWhite,
  },
});
