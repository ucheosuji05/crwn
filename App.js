import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, StatusBar, Linking } from 'react-native';

// Apply Figtree as the default font for every Text in the app.
// Explicit fontFamily overrides (e.g. LibreBaskerville on headers) take precedence.
if (!Text.defaultProps) Text.defaultProps = {};
Text.defaultProps.style = { fontFamily: 'Figtree_400Regular' };

// Remove the browser's default focus outline (black box) from all text inputs on web.
if (typeof document !== 'undefined') {
  const s = document.createElement('style');
  s.textContent = 'input:focus,textarea:focus{outline:none!important;box-shadow:none!important;}';
  document.head.appendChild(s);
}
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import {
  LibreBaskerville_400Regular,
  LibreBaskerville_700Bold,
} from '@expo-google-fonts/libre-baskerville';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from '@expo-google-fonts/figtree';

import OnboardingScreen from './src/screens/OnboardingScreen';
import AuthScreen from './src/screens/AuthScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider, useAuth } from './src/hooks/useAuth';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { UnreadCountProvider } from './src/context/UnreadCountContext';
import { ProviderModeProvider } from './src/context/ProviderModeContext';
import { colors } from './src/theme/themes';

// =============================================================================
// APP CONTENT — reads auth state from AuthProvider
// =============================================================================

function AppContent() {
  const { user, loading } = useAuth();
  const { colors: themeColors } = useTheme();
  const [hasOnboarded, setHasOnboarded] = useState(null);
  const [authView, setAuthView] = useState('default'); // 'default' | 'forgot-password' | 'reset-password'
  const [resetToken, setResetToken] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('onboarded').then(val => setHasOnboarded(val === 'true'));
  }, []);

  // Handle crwn://reset-password?token=... deep links
  useEffect(() => {
    const handleUrl = ({ url }) => {
      if (!url) return;
      try {
        const parsed = new URL(url);
        if (parsed.pathname === '//reset-password' || url.includes('reset-password')) {
          const token = parsed.searchParams.get('token');
          if (token) {
            setResetToken(token);
            setAuthView('reset-password');
          }
        }
      } catch {}
    };

    Linking.getInitialURL().then(url => { if (url) handleUrl({ url }); });
    const sub = Linking.addEventListener('url', handleUrl);
    return () => sub.remove();
  }, []);

  if (loading || hasOnboarded === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.honey} />
      </View>
    );
  }

  // ── Pre-auth screens (no NavigationContainer) ──────────────────────────
  if (!user) {
    if (authView === 'reset-password' && resetToken) {
      return (
        <ResetPasswordScreen
          token={resetToken}
          onDone={() => { setAuthView('default'); setResetToken(null); }}
        />
      );
    }
    if (authView === 'forgot-password') {
      return <ForgotPasswordScreen onBack={() => setAuthView('default')} />;
    }
    if (hasOnboarded) {
      return (
        <AuthScreen
          onBack={() => setHasOnboarded(false)}
          onForgotPassword={() => setAuthView('forgot-password')}
        />
      );
    }
    return (
      <OnboardingScreen
        onDone={() => AsyncStorage.setItem('onboarded', 'true')}
        onSignIn={() => setHasOnboarded(true)}
      />
    );
  }

  // ── Authenticated — show main app ──────────────────────────────────────
  return (
    <>
      <StatusBar barStyle={themeColors.statusBar} backgroundColor={themeColors.surface} />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

// =============================================================================
// ROOT — AuthProvider wraps everything so every screen can call useAuth()
// =============================================================================

export default function App() {
  const [fontsLoaded] = useFonts({
    LibreBaskerville_400Regular,
    LibreBaskerville_700Bold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.honey} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <UnreadCountProvider>
            <ProviderModeProvider>
              <AppContent />
            </ProviderModeProvider>
          </UnreadCountProvider>
        </ThemeProvider>
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
    backgroundColor: '#FAFAFA',
  },
});
