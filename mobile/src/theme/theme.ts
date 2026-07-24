// Design tokens — ported 1:1 from the HTML prototype's :root CSS variables.
// Every screen and component should pull from here instead of hardcoding
// hex values, so the whole app stays visually consistent and easy to re-theme.

export const colors = {
  green: '#22C55E',
  greenDark: '#16A34A',
  greenLight: '#DCFCE7',

  red: '#EF4444',
  redLight: '#FEE2E2',

  orange: '#F97316',
  orangeLight: '#FFF7ED',

  blue: '#2563EB',
  blueLight: '#EFF6FF',

  yellow: '#EAB308',
  yellowLight: '#FEFCE8',
  yellowText: '#854D0E', // used for the "top rated" / yellow badge text in the HTML

  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',

  white: '#FFFFFF',
  black: '#000000',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// React Native shadows need both iOS (shadow*) and Android (elevation) props.
export const shadow = {
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 8,
  },
} as const;

// The HTML uses 'DM Sans' + 'DM Mono' from Google Fonts. In React Native these
// need to be loaded as custom fonts (e.g. via `expo-font` + `@expo-google-fonts/dm-sans`
// and `@expo-google-fonts/dm-mono`), then referenced by their loaded family name below.
// Until fonts are loaded, RN falls back to the system font automatically.
export const font = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  semibold: 'DMSans_600SemiBold',
  bold: 'DMSans_700Bold',
  extrabold: 'DMSans_800ExtraBold',
  mono: 'DMMono_500Medium',
} as const;

export const theme = { colors, radius, spacing, shadow, font };
export default theme;