import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { Platform } from 'react-native';
import { authClient, initAuth, storeAuthToken } from '../lib/auth-client';
import { authService } from '../services/authService';
import { supabase } from '../config/supabase';

const AuthContext = createContext({});

// TEMP: skip the sign-in screen for local dev. Set back to false to restore normal auth.
const DEV_BYPASS_AUTH = false;
const DEV_USER = {
  id: 'dev-user',
  email: 'dev@example.com',
  name: 'Dev User',
  userType: 'explorer',
};

async function fetchSupabaseProfile(userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, is_stylist, location, preferences')
    .eq('id', userId)
    .single();
  return data || null;
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(DEV_BYPASS_AUTH ? DEV_USER : null);
  const [profile, setProfile] = useState(DEV_BYPASS_AUTH ? DEV_USER : null);
  const [session, setSession] = useState(DEV_BYPASS_AUTH ? { id: 'dev-session' } : null);
  const [loading, setLoading] = useState(!DEV_BYPASS_AUTH);

  // Better Auth: load session on mount
  useEffect(() => {
    if (DEV_BYPASS_AUTH) return;

    const loadSession = async () => {
      try {
        // After Google OAuth on web, the server redirects back with ?auth_token=<TOKEN>.
        // On iOS, we open OAuth in a popup so the main window stays alive. The popup
        // signals the main window via a localStorage storage event (immune to COOP).
        // For the full-page redirect fallback, we read the token directly from the URL.
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const urlToken = params.get('auth_token');
          if (urlToken) {
            await storeAuthToken(urlToken);
            // Signal any parent window that opened this as an OAuth popup
            try { localStorage.setItem('@crwn/oauth_pending', urlToken); } catch (_) {}
            window.history.replaceState(null, '', window.location.pathname);
          }
        }
        await initAuth(); // ensure stored token is loaded before first request
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Session check timed out')), 8000)
        );
        const { data } = await Promise.race([authClient.getSession(), timeout]);
        const authUser = data?.user || null;
        setSession(data?.session || null);
        setUser(authUser);
        if (authUser?.id) {
          const supabaseProfile = await fetchSupabaseProfile(authUser.id);
          setProfile(supabaseProfile ? { ...authUser, ...supabaseProfile } : authUser);
        } else {
          setProfile(null);
        }
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
      const { data } = await authClient.getSession();
      const authUser = data?.user || null;
      setSession(data?.session || null);
      setUser(authUser);
      if (authUser?.id) {
        const supabaseProfile = await fetchSupabaseProfile(authUser.id);
        setProfile(supabaseProfile ? { ...authUser, ...supabaseProfile } : authUser);
      }
    }
    return result;
  }, []);

  const signIn = useCallback(async (email, password) => {
    const result = await authService.signIn(email, password);
    if (result.user) {
      setSession(result.session);
      setUser(result.user);
      const supabaseProfile = await fetchSupabaseProfile(result.user.id);
      setProfile(supabaseProfile ? { ...result.user, ...supabaseProfile } : result.user);
    }
    return result;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const result = await authService.signInWithGoogle();
    if (result.error) return result;

    // Prefer data from _socialSignIn, but fall back to a fresh getSession if empty
    let authUser = result.data?.user || null;
    let authSession = result.data?.session || null;

    if (!authUser) {
      console.log('[signInWithGoogle] result.data empty — retrying getSession');
      const { data } = await authClient.getSession();
      authUser = data?.user || null;
      authSession = data?.session || null;
    }

    console.log('[signInWithGoogle] authUser:', authUser?.email);

    let isNewUser = false;

    if (authUser) {
      setUser(authUser);
      setSession(authSession);

      let supabaseProfile = await fetchSupabaseProfile(authUser.id);

      // New Google user — auto-create a minimal Supabase profile
      if (!supabaseProfile) {
        isNewUser = true;
        try {
          const base = (authUser.email?.split('@')[0] || `user`).toLowerCase().replace(/[^a-z0-9_]/g, '_');
          await supabase.from('profiles').insert([{
            id: authUser.id,
            full_name: authUser.name || '',
            username: base,
            avatar_url: authUser.image || null,
          }]);
          supabaseProfile = await fetchSupabaseProfile(authUser.id);
        } catch (err) {
          console.warn('[signInWithGoogle] profile auto-create failed:', err.message);
        }
      }

      setProfile(supabaseProfile ? { ...authUser, ...supabaseProfile } : authUser);
    }

    return { ...result, isNewUser };
  }, []);

  const signInWithInstagram = useCallback(async () => {
    const result = await authService.signInWithInstagram();
    if (result.data?.user) {
      setUser(result.data.user);
      setSession(result.data.session);
      const supabaseProfile = await fetchSupabaseProfile(result.data.user.id);
      setProfile(supabaseProfile ? { ...result.data.user, ...supabaseProfile } : result.data.user);
    }
    return result;
  }, []);

  const clearAuth = useCallback(async () => {
    await authService.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const { data } = await authClient.getSession();
      const authUser = data?.user || null;
      setSession(data?.session || null);
      setUser(authUser);
      if (authUser?.id) {
        const supabaseProfile = await fetchSupabaseProfile(authUser.id);
        setProfile(supabaseProfile ? { ...authUser, ...supabaseProfile } : authUser);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error('refreshProfile error:', err);
    }
  }, []);

  const value = {
    user,
    session,
    loading,
    profile,
    profileLoaded: !loading,
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
