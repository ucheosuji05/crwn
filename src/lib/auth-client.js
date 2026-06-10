import { createAuthClient } from 'better-auth/client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL || 'http://localhost:3001';
const TOKEN_KEY = '@crwn/auth_token';

let cachedToken = null;

// Resolved once the stored token has been loaded from disk
let resolveTokenLoaded;
const tokenLoaded = new Promise(resolve => { resolveTokenLoaded = resolve; });

AsyncStorage.getItem(TOKEN_KEY).then(t => {
  cachedToken = t;
  resolveTokenLoaded();
});

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  fetchOptions: {
    onRequest: async (ctx) => {
      // Wait for AsyncStorage to finish loading before the first request
      await tokenLoaded;
      if (cachedToken) {
        if (!ctx.headers) ctx.headers = {};
        if (ctx.headers instanceof Headers) {
          ctx.headers.set('Authorization', `Bearer ${cachedToken}`);
        } else {
          ctx.headers['Authorization'] = `Bearer ${cachedToken}`;
        }
      }
      return ctx;
    },
    onResponse: async ({ response }) => {
      // Better Auth's bearer plugin sets this header on sign-in/sign-up
      const newToken = response?.headers?.get('set-auth-token');
      if (newToken) {
        cachedToken = newToken;
        await AsyncStorage.setItem(TOKEN_KEY, newToken);
      }
    },
  },
});

export async function storeAuthToken(token) {
  cachedToken = token;
  await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearAuthToken() {
  cachedToken = null;
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return cachedToken;
}

// Call this before the first getSession() to ensure the token is ready
export function initAuth() {
  return tokenLoaded;
}
