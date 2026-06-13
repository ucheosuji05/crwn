import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from '../lib/auth-client';
import { AUTH_URL } from '../lib/auth-url';

// TODO: Replace with your actual Supabase credentials
const SUPABASE_URL = 'https://iyfpmxejxgxypjnoivyz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5ZnBteGVqeGd4eXBqbm9pdnl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTE1OTUsImV4cCI6MjA3OTU4NzU5NX0._2LSVnN3ZY8mtU9JUwmKJpNDgsBohrNMak7fTyuiXnM';

// Better Auth owns the real session. To make auth.uid() resolve for Supabase's
// RLS policies, we mint a short-lived Supabase-compatible JWT from the Better
// Auth session via the server, and hand it to supabase-js through the
// `accessToken` callback (called on every PostgREST/Storage request).
// Returning null/undefined falls back to the anon key automatically, so
// logged-out/public reads keep working unchanged.
let cachedSupabaseToken = null;
let cachedSupabaseTokenExp = 0; // unix seconds
let inFlightFetch = null;

async function fetchSupabaseToken() {
  const betterAuthToken = getAuthToken();
  if (!betterAuthToken) return null;

  const res = await fetch(`${AUTH_URL}/api/auth/supabase-token`, {
    headers: { Authorization: `Bearer ${betterAuthToken}` },
  });
  if (!res.ok) return null;

  const { token, exp } = await res.json();
  cachedSupabaseToken = token;
  cachedSupabaseTokenExp = exp;
  return token;
}

async function getSupabaseAccessToken() {
  const betterAuthToken = getAuthToken();
  if (!betterAuthToken) {
    cachedSupabaseToken = null;
    cachedSupabaseTokenExp = 0;
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (cachedSupabaseToken && cachedSupabaseTokenExp - now > 30) {
    return cachedSupabaseToken;
  }

  if (!inFlightFetch) {
    inFlightFetch = fetchSupabaseToken().finally(() => { inFlightFetch = null; });
  }
  try {
    return await inFlightFetch;
  } catch (_) {
    return null;
  }
}

export function clearSupabaseTokenCache() {
  cachedSupabaseToken = null;
  cachedSupabaseTokenExp = 0;
}

// Supabase is used for data only — Better Auth handles all authentication.
// Disabling session persistence prevents the client from entering a
// token-refresh loop on startup when there is no valid Supabase session.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
  accessToken: getSupabaseAccessToken,
});
