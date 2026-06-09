import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { authClient, initAuth } from '../lib/auth-client';
import { authService } from '../services/authService';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // Better Auth: load session on mount
  useEffect(() => {
    const loadSession = async () => {
      try {
        await initAuth(); // ensure stored token is loaded before first request
        const { data } = await authClient.getSession();
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
