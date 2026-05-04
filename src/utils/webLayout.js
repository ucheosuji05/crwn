import { Platform } from 'react-native';

export const WEB_MAX_WIDTHS = {
  grid:    1100,  // Explore photo grid
  feed:     720,  // Community & Notifications single-column feed
  profile:  900,  // Profile screen
  list:     860,  // Stylists list
};

/**
 * Returns style that centers + constrains content width on web.
 * No-op on native (returns empty object).
 */
export function webWrap(maxWidth) {
  if (Platform.OS !== 'web') return {};
  return { alignSelf: 'center', width: '100%', maxWidth };
}
