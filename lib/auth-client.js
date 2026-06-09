import { createAuthClient } from 'better-auth/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Points to your Better Auth server
// - In dev: your local machine IP (not localhost — devices can't reach localhost)
// - In prod: your deployed server URL
//  const AUTH_SERVER_URL = __DEV__
//    ? 'http://192.168.1.x:8081'   // ← replace x with your local IP (run `ipconfig` to find it)
//    : 'https://your-auth-server.com'; // ← replace before deploying

const AUTH_SERVER_URL = 'https://clay-culinary-security.ngrok-free.dev';

export const authClient = createAuthClient({
  baseURL: AUTH_SERVER_URL,
  storage: AsyncStorage, // persists session across app restarts
});
