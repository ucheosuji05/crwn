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
  white: '#FFFFFF',
  
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
  background: colors.offWhite,
  surface: colors.white,
  card: colors.champagne,
  text: colors.textPrimary,
  textSecondary: colors.charcoalGrey,
  primary: colors.maroon,
  accent: colors.honey,
  border: colors.slateGrey,
  divider: '#f3f4f6',
};

// Dark theme
export const darkTheme = {
  background: colors.black,
  surface: '#2A2A2A',
  card: '#333333',
  text: colors.offWhite,
  textSecondary: colors.slateGrey,
  primary: colors.maroon,
  accent: colors.honey,
  border: colors.charcoalGrey,
  divider: '#3A3A3A',
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
