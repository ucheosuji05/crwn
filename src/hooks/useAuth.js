import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { authClient, initAuth } from '../lib/auth-client';
import { authService } from '../services/authService';

const AuthContext = createContext({});

// TEMP: skip the sign-in screen for local dev. Set back to false to restore normal auth.
const DEV_BYPASS_AUTH = false;
const DEV_USER = {
  id: 'dev-user',
  email: 'dev@example.com',
  name: 'Dev User',
  userType: 'explorer',
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(DEV_BYPASS_AUTH ? DEV_USER : null);
  const [session, setSession] = useState(DEV_BYPASS_AUTH ? { id: 'dev-session' } : null);
  const [loading, setLoading] = useState(!DEV_BYPASS_AUTH);

  // Better Auth: load session on mount
  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    const loadSession = async () => {
      try {
        await initAuth(); // ensure stored token is loaded before first request
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timed out')), 8000)
        );
        const { data } = await Promise.race([authClient.getSession(), timeout]);
        setSession(data?.session || null);
        setUser(data?.user || null);
      } catch (err) {
        console.error('AuthProvider: Failed to load session', err);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, []);

  const signUp = useCallback(async (email, password, userData) => {
    const result = await authService.signUp(email, password, userData);
    if (result.user) {
      // Refresh session after sign up
      const { data } = await authClient.getSession();
      setSession(data?.session || null);
      setUser(data?.user || null);
    }
    return result;
  }, []);

  const signIn = useCallback(async (email, password) => {
    const result = await authService.signIn(email, password);
    if (result.user) {
      setSession(result.session);
      setUser(result.user);
    }
    return result;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const result = await authService.signInWithGoogle();
    if (result.data?.user) {
      setUser(result.data.user);
      setSession(result.data.session);
    }
    return result;
  }, []);

  const signInWithInstagram = useCallback(async () => {
    const result = await authService.signInWithInstagram();
    if (result.data?.user) {
      setUser(result.data.user);
      setSession(result.data.session);
    }
    return result;
  }, []);

  const clearAuth = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setSession(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await authClient.getSession();
      setSession(data?.session || null);
      setUser(data?.user || null);
    } catch (err) {
      console.error('refreshProfile error:', err);
    }
  }, []);

  const value = {
    user,
    session,
    loading,
    profile: user,        // BottomTabNavigator uses profile?.is_stylist
    profileLoaded: !loading, // BottomTabNavigator gates the Stylists tab on this
    signUp,
    signIn,
    signInWithGoogle,
    signInWithInstagram,
    clearAuth,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
