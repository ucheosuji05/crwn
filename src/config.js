/**
 * CRWN App Configuration
 */

// Backend API URL - update this for production
export const BACKEND_URL = __DEV__ 
  ? 'http://localhost:3000'  // Development
  : 'https://api.crwn.app';  // Production (update when ready)

// App Version
export const APP_VERSION = '1.0.0';

// Feature Flags
export const FEATURES = {
  ENABLE_STYLIST_MODE: true,
  ENABLE_HAIR_QUIZ: true,
  ENABLE_PUSH_NOTIFICATIONS: false,
  ENABLE_ANALYTICS: false,
};

// API Endpoints
export const ENDPOINTS = {
  ONBOARD: '/api/onboard',
  LOGIN: '/api/auth/login',
  REGISTER: '/api/auth/register',
  PROFILE: '/api/user/profile',
  POSTS: '/api/posts',
  STYLISTS: '/api/stylists',
};

export default {
  BACKEND_URL,
  APP_VERSION,
  FEATURES,
  ENDPOINTS,
};
