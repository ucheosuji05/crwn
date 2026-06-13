import Constants from 'expo-constants';

const configUrl = Constants?.expoConfig?.extra?.authUrl || Constants?.manifest?.extra?.authUrl;
const envUrl = typeof process !== 'undefined' ? process.env.EXPO_PUBLIC_AUTH_URL : undefined;

export const AUTH_URL = configUrl || envUrl || 'http://localhost:3001';

if (__DEV__) {
  console.log('[AUTH_URL] auth URL:', AUTH_URL, 'configUrl:', configUrl, 'envUrl:', envUrl);
}
