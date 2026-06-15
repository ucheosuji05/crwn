import { Platform } from 'react-native';
import Constants from 'expo-constants';

const configUrl = Constants?.expoConfig?.extra?.authUrl || Constants?.manifest?.extra?.authUrl;
const envUrl = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_AUTH_URL : undefined;

// On web, prefer the configured Railway URL so Google OAuth works in production
// builds and EAS previews. Falls back to localhost for local dev (start the
// server with `node --env-file=server.env index.js` in the server/ directory).
export const AUTH_URL = configUrl || envUrl || 'http://localhost:3001';

if (__DEV__) {
  console.log('[AUTH_URL] auth URL:', AUTH_URL, 'configUrl:', configUrl, 'envUrl:', envUrl);
}
