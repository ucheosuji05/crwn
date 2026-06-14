import { Platform } from 'react-native';
import Constants from 'expo-constants';

const configUrl = Constants?.expoConfig?.extra?.authUrl || Constants?.manifest?.extra?.authUrl;
const envUrl = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_AUTH_URL : undefined;

// On web the browser and server share the same machine — use localhost so the
// Wi-Fi IP and firewall rules don't matter.
export const AUTH_URL = Platform.OS === 'web'
  ? 'http://localhost:3001'
  : (configUrl || envUrl || 'http://localhost:3001');

if (__DEV__) {
  console.log('[AUTH_URL] auth URL:', AUTH_URL, 'configUrl:', configUrl, 'envUrl:', envUrl);
}
