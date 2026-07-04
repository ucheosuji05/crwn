import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { authClient, storeAuthToken, clearAuthToken, setPersistNextToken } from '../lib/auth-client';
import { supabase, clearSupabaseTokenCache } from '../config/supabase'; // keep for profile/hair data writes
import { AUTH_URL } from '../lib/auth-url';

export const authService = {

  // ─── Email sign up ────────────────────────────────────────────────────────
  async signUp(email, password, userData) {
    try {
      const { data, error } = await authClient.signUp.email({
        email,
        password,
        name: `${userData.name || ''}`.trim(),
        // extra fields land on the user record via additionalFields in server/auth.js
        userType: userData.userType || 'explorer',
        username: userData.username || email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, ''),
        location: userData.location || '',
      });

      if (error) return { user: null, error };

      // Write hair profile to Supabase separately (Better Auth doesn't own this table)
      if (data?.user && userData.hairType) {
        await supabase.from('hair_profiles').insert([{
          user_id: data.user.id,
          hair_type: userData.hairType,
          porosity: userData.porosity || null,
          goals: userData.hairGoals || [],
        }]);
      }

      return { user: data?.user, error: null };
    } catch (err) {
      return { user: null, error: err };
    }
  },

  // ─── Email sign in ────────────────────────────────────────────────────────
  async signIn(email, password, rememberMe = true) {
    try {
      setPersistNextToken(rememberMe);
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error) setPersistNextToken(true); // reset on error
      return { user: data?.user, session: data?.session, error };
    } catch (err) {
      setPersistNextToken(true); // reset on exception
      console.error('[authService.signIn] AUTH_URL:', AUTH_URL, 'email:', email, 'error:', err);
      return { user: null, session: null, error: err };
    }
  },

  // ─── Social OAuth helper ─────────────────────────────────────────────────
  async _socialSignIn(provider) {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const origin = encodeURIComponent(window.location.origin);
      const authUrl = `${AUTH_URL}/api/auth/oauth-start/${encodeURIComponent(provider)}?platform=web&origin=${origin}&_t=${Date.now()}`;

      // Open OAuth in a popup so this page stays alive (critical for iOS standalone mode
      // and for avoiding iOS Link Tracking Protection stripping the callback URL params).
      // On iOS Safari, window.open() creates a new tab rather than a floating popup —
      // localStorage storage events still work correctly across tabs from the same origin.
      localStorage.removeItem('@crwn/oauth_pending'); // clear any stale signal
      const popup = window.open(authUrl, 'crwn_oauth', 'popup,width=500,height=700');

      if (!popup || popup.closed) {
        // Popup was blocked — fall back to full-page redirect
        window.location.href = authUrl;
        return new Promise(() => {}); // page navigates away — never resolves
      }

      // The popup's loadSession writes the token to localStorage when OAuth completes.
      // We listen for that storage event here in the main window.
      let token;
      try {
        token = await new Promise((resolve, reject) => {
          const TIMEOUT_MS = 10 * 60 * 1000;
          let settled = false;

          const finish = (tok, err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            clearInterval(pollClosed);
            window.removeEventListener('storage', onStorage);
            localStorage.removeItem('@crwn/oauth_pending');
            try { if (!popup.closed) popup.close(); } catch (_) {}
            if (err) reject(err);
            else resolve(tok);
          };

          const timer = setTimeout(
            () => finish(null, new Error('Sign-in timed out. Please try again.')),
            TIMEOUT_MS
          );

          // Detect if the user manually closes the popup without completing OAuth
          const pollClosed = setInterval(() => {
            if (!popup.closed) return;
            clearInterval(pollClosed);
            // Brief delay in case a storage event is about to arrive
            setTimeout(() => {
              const pending = localStorage.getItem('@crwn/oauth_pending');
              if (pending) finish(pending, null);
              else finish(null, new Error('Sign-in was cancelled.'));
            }, 500);
          }, 500);

          const onStorage = (e) => {
            if (e.key === '@crwn/oauth_pending' && e.newValue) {
              finish(e.newValue, null);
            }
          };
          window.addEventListener('storage', onStorage);

          // Race: popup may have completed before the listener was attached
          const pendingNow = localStorage.getItem('@crwn/oauth_pending');
          if (pendingNow) finish(pendingNow, null);
        });
      } catch (err) {
        return { data: null, error: err };
      }

      await storeAuthToken(token);
      const { data, error } = await authClient.getSession();
      return { data, error };
    }

    try {
      // Open a bridge page that auto-submits the POST in the browser so the
      // entire OAuth flow (state generation → Google → callback) stays in one
      // continuous browser session, preventing state_mismatch errors.
      const startUrl = `${AUTH_URL}/api/auth/oauth-start/${encodeURIComponent(provider)}?_t=${Date.now()}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, 'crwn://auth/callback');

      console.log('[_socialSignIn] browser result type:', result.type, 'url prefix:', result.url?.substring(0, 60));

      if (result.type !== 'success') {
        return { data: null, error: new Error('Sign-in was cancelled') };
      }

      // Strip fragment (#) before parsing — iOS can append a bare # to deep links
      const urlWithoutFragment = result.url.split('#')[0];
      const qsStart = urlWithoutFragment.indexOf('?');
      const qs = qsStart >= 0 ? urlWithoutFragment.slice(qsStart + 1) : '';
      const params = new URLSearchParams(qs);
      const token = params.get('token');
      const oauthError = params.get('error');

      console.log('[_socialSignIn] oauthError:', oauthError, 'hasToken:', !!token);

      if (oauthError || !token) {
        return { data: null, error: new Error(oauthError || 'No token received') };
      }

      await storeAuthToken(token);
      const { data: sessionData } = await authClient.getSession();
      console.log('[_socialSignIn] getSession result — user:', sessionData?.user?.email, 'session:', !!sessionData?.session);
      return { data: sessionData, error: null };
    } catch (err) {
      return { data: null, error: new Error(err?.message || `${provider} sign-in failed`) };
    }
  },

  // ─── Google OAuth ────────────────────────────────────────────────────────
  async signInWithGoogle() {
    return this._socialSignIn('google');
  },

  // ─── Instagram / Meta OAuth ───────────────────────────────────────────────
  async signInWithInstagram() {
    return this._socialSignIn('facebook');
  },

  // ─── Sign out ─────────────────────────────────────────────────────────────
  async signOut() {
    try {
      const { error } = await authClient.signOut();
      await clearAuthToken();
      clearSupabaseTokenCache();
      return { error };
    } catch (err) {
      await clearAuthToken();
      clearSupabaseTokenCache();
      return { error: err };
    }
  },

  // ─── Session helpers ──────────────────────────────────────────────────────
  async getCurrentUser() {
    try {
      const session = await authClient.getSession();
      return session?.data?.user || null;
    } catch {
      return null;
    }
  },

  async getSession() {
    try {
      const { data } = await authClient.getSession();
      return data?.session || null;
    } catch {
      return null;
    }
  },
};
