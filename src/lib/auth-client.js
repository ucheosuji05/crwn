import { createAuthClient } from 'better-auth/client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AUTH_URL } from './auth-url';

const TOKEN_KEY = '@crwn/auth_token';

let cachedToken = null;
let _persistNextToken = true;

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
      await tokenLoaded;
      if (!ctx.headers) ctx.headers = {};
      // React Native omits Origin; Better Auth requires it for CSRF validation
      if (ctx.headers instanceof Headers) {
        ctx.headers.set('Origin', AUTH_URL);
        if (cachedToken) ctx.headers.set('Authorization', `Bearer ${cachedToken}`);
      } else {
        ctx.headers['Origin'] = AUTH_URL;
        if (cachedToken) ctx.headers['Authorization'] = `Bearer ${cachedToken}`;
      }
      return ctx;
    },
    onResponse: async ({ response }) => {
      // Better Auth's bearer plugin sets this header on sign-in/sign-up
      const newToken = response?.headers?.get('set-auth-token');
      if (newToken) {
        cachedToken = newToken;
        if (_persistNextToken) {
          await AsyncStorage.setItem(TOKEN_KEY, newToken);
        } else {
          // Don't persist — user opted out of "remember me"
          _persistNextToken = true; // reset for next sign-in
        }
      }
    },
  },
});

export function setPersistNextToken(value) {
  _persistNextToken = value;
}

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
