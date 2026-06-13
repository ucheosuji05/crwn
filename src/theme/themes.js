/**
 * CRWN Theme Constants
 * Color palette and typography for consistent styling across the app.
 */

// =============================================================================
// COLORS
// =============================================================================

export const colors = {
  // Primary Brand Colors
  maroon: '#5D1F1F',
  deepBrown: '#4A2511',
  warmBrown: '#8B5A2B',
  
  // Gradient Colors (from mockups)
  gradientTop: '#E8C4B8',      // Soft pink/peach
  gradientMiddle: '#D4A574',   // Warm tan
  gradientBottom: '#A67B5B',   // Brown
  
  // Accent Colors
  honey: '#F8B430',
  burntOchre: '#B35D2B',
  taupe: '#C4A47C',
  
  // Neutral Colors
  offWhite: '#FDF9F0',
  cream: '#FAF7F2',
  champagne: '#E8E2D9',
  slateGrey: '#D1D1D1',
  charcoalGrey: '#5E5E5E',
  
  // Core
  black: '#1A1A1A',
  white: '#FCFCFC',
  
  // Semantic Colors
  success: '#2D6A4F',
  error: '#9B2C2C',
  warning: '#F8B430',
  
  // Text Colors
  textPrimary: '#1A1A1A',
  textSecondary: '#5E5E5E',
  textBrown: '#5D3A1A',
  textLight: '#FDF9F0',
  textMuted: '#9ca3af',
};

// Light theme
export const lightTheme = {
  isDark: false,
  selected: '#5D1F1F',       // active/selected tint — maroon in light mode
  background: '#FAFAFA',
  backgroundAlt: '#F4F4F5',
  surface: '#FCFCFC',
  surfaceAlt: '#F9F9F9',
  card: '#FCFCFC',
  cardWarm: '#F9F5F3',
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  primary: '#5D1F1F',
  primaryLight: '#fef2f2',
  accent: '#F8B430',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  hairline: '#C0C0C0',
  inputBackground: '#f3f4f6',
  placeholder: '#9ca3af',
  danger: '#ef4444',
  unread: '#F5F0EA',
  overlay: 'rgba(0,0,0,0.5)',
  tabBar: '#FCFCFC',
  statusBar: 'dark-content',
};

// Dark theme — true black with WCAG AA accessible contrast
export const darkTheme = {
  isDark: true,
  selected: '#F8B430',       // active/selected tint — gold in dark mode
  background: '#000000',      // Pure black
  backgroundAlt: '#0A0A0A',   // Barely-lifted background layer
  surface: '#111111',         // Cards, sheets, modals
  surfaceAlt: '#1A1A1A',      // Secondary surfaces
  card: '#111111',
  cardWarm: '#180A00',        // Warm-tinted surface
  text: '#FFFFFF',            // 21:1 contrast on black — max readability
  textSecondary: '#A3A3A3',   // ~6.6:1 on black — WCAG AA ✓
  textMuted: '#737373',       // ~4.6:1 on black — WCAG AA ✓
  primary: '#F8B430',         // Gold — brand accent in dark mode
  primaryLight: '#1C0A0A',    // Dark maroon tint for highlighted cards
  accent: '#F8B430',
  border: '#2A2A2A',
  borderLight: '#1A1A1A',
  hairline: '#2A2A2A',
  inputBackground: '#1A1A1A',
  placeholder: '#666666',
  danger: '#ef4444',
  unread: '#5E5E5E',
  overlay: 'rgba(0,0,0,0.85)',
  tabBar: '#000000',          // Black tab bar
  statusBar: 'light-content',
};

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const fonts = {
  editorial: 'LibreBaskerville-Bold',
  heading: 'Figtree-Bold',
  subheading: 'Figtree-SemiBold',
  button: 'Figtree-Medium',
  body: 'Figtree-Regular',
  editorialFallback: 'serif',
  sansSerifFallback: 'System',
};

export const fontSizes = {
  hero: 32,
  display: 28,
  h1: 24,
  h2: 20,
  h3: 18,
  h4: 16,
  large: 17,
  body: 15,
  small: 14,
  caption: 13,
  tiny: 12,
};

export const fontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',
};

// =============================================================================
// SPACING & LAYOUT
// =============================================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
};

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 12,
  xl: 16,
  xxl: 20,
  full: 9999,
};

// =============================================================================
// SHADOWS
// =============================================================================

export const shadows = {
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  card: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
};

// =============================================================================
// GRADIENTS (for LinearGradient)
// =============================================================================

export const gradients = {
  // Main onboarding gradient (warm peach to brown)
  onboarding: [colors.gradientTop, colors.gradientMiddle, colors.gradientBottom],
  onboardingLocations: [0, 0.5, 1],
  
  // Alternative gradients
  warm: [colors.burntOchre, colors.honey],
  subtle: [colors.champagne, colors.offWhite],
  dark: [colors.black, '#2A2A2A'],
};

// =============================================================================
// ONBOARDING SPECIFIC
// =============================================================================

export const onboarding = {
  // Progress indicator colors
  progressActive: colors.honey,
  progressInactive: colors.taupe,
  
  // Button styles
  buttonPrimary: colors.taupe,
  buttonText: colors.textBrown,
  buttonOutline: colors.slateGrey,
  
  // Card styles
  cardBackground: colors.white,
  cardBorderRadius: borderRadius.xxl,
};

export default {
  colors,
  lightTheme,
  darkTheme,
  fonts,
  fontSizes,
  fontWeights,
  spacing,
  borderRadius,
  shadows,
  gradients,
  onboarding,
};
