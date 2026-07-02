import { Platform, useWindowDimensions } from 'react-native';

const WEB_LAYOUT_BREAKPOINT = 768;

/** True when the device should use the wide/desktop web layout (not phone web). */
export function useIsWebLayout() {
  const { width } = useWindowDimensions();
  return Platform.OS === 'web' && width >= WEB_LAYOUT_BREAKPOINT;
}

export const WEB_MAX_WIDTHS = {
  grid:    1400,  // Explore photo grid
  feed:     960,  // Community & Notifications single-column feed
  profile: 1140,  // Profile screen
  list:    1200,  // Stylists list
};

/**
 * Returns style that centers + constrains content width on web.
 * No-op on native (returns empty object).
 */
export function webWrap(maxWidth) {
  if (Platform.OS !== 'web') return {};
  return { alignSelf: 'center', width: '100%', maxWidth };
}
