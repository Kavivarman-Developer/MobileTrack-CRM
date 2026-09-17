// Design system for the Retail Inventory & Billing app.
// Keep export names stable so existing screen behavior does not change.
import { Dimensions, PixelRatio, Platform } from "react-native";
import { ios } from "./ios";

// Responsive scaling: baseline is a 375pt-wide screen (iPhone SE/standard).
// Clamped so very large tablets or very small screens don't blow sizes out of proportion.
const baseWidth = 375;
const windowWidth = Dimensions.get("window").width;
const widthRatio = Math.min(Math.max(windowWidth / baseWidth, 0.85), 1.15);

export function scale(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * widthRatio));
}

export function scaleFont(size: number): number {
  return Math.round(PixelRatio.roundToNearestPixel(size * widthRatio));
}

export const colors = {
  // Base surfaces & canvas (Emergent soft lavender-gray)
  background: ios.bg,
  surface: ios.card,
  surfaceTint: ios.fill,
  border: ios.separator,
  borderDark: "#D0D2DE",

  // Text hierarchy
  text: ios.label,
  muted: ios.secondary,
  faint: "#AEB1C2",

  // Brand (Emergent blue / purple)
  primary: ios.blue,
  primaryDark: "#3B52D4",
  primaryLight: "#E8ECFE",
  secondary: ios.navy,

  // Status & Semantic Colors
  success: ios.green,
  danger: ios.red,
  warning: ios.orange,
  info: ios.blue,
  accent: ios.orange,
  purple: ios.purple,

  // Soft tint backgrounds
  greenSoft: "#E8F8ED",
  orangeSoft: "#FFF4E5",
  redSoft: "#FFEBEA",
  blueSoft: "#E8ECFE",
  tealSoft: "#E6FAF6",
  purpleSoft: ios.purpleSoft,
};

export const spacing = {
  xxs: scale(3),
  xs: scale(6),
  sm: scale(10),
  md: scale(13),
  lg: scale(16),
  xl: scale(20),
  xxl: scale(26),
  xxxl: scale(32),
};

export const radius = {
  xs: scale(7),
  sm: scale(10),
  md: scale(14),
  lg: scale(16),
  xl: scale(19),
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#1B1F3B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  floating: {
    shadowColor: "#1B1F3B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 6,
  },
  overlay: {
    shadowColor: "#1B1F3B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const layout = {
  maxWidth: 1040,
  contentMaxWidth: 860,
  formMaxWidth: 600,
  modalMaxWidth: 540,
  cardMaxWidth: 720,
};

export const fonts = {
  regular: Platform.select({
    web: 'Inter, "Inter_400Regular", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    default: "Inter_400Regular",
  }),
  medium: Platform.select({
    web: 'Inter, "Inter_500Medium", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    default: "Inter_500Medium",
  }),
  semibold: Platform.select({
    web: 'Inter, "Inter_600SemiBold", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    default: "Inter_600SemiBold",
  }),
  bold: Platform.select({
    web: 'Inter, "Inter_700Bold", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    default: "Inter_700Bold",
  }),
};

export const typography = {
  h1: { fontFamily: fonts.bold, fontSize: scaleFont(22), fontWeight: "700" as const, letterSpacing: -0.5, lineHeight: scaleFont(27) },
  h2: { fontFamily: fonts.bold, fontSize: scaleFont(17), fontWeight: "700" as const, letterSpacing: -0.3, lineHeight: scaleFont(22) },
  h3: { fontFamily: fonts.semibold, fontSize: scaleFont(14), fontWeight: "600" as const, letterSpacing: -0.2, lineHeight: scaleFont(19) },
  body: { fontFamily: fonts.regular, fontSize: scaleFont(13), fontWeight: "400" as const, lineHeight: scaleFont(18) },
  bodyMedium: { fontFamily: fonts.medium, fontSize: scaleFont(13), fontWeight: "500" as const, lineHeight: scaleFont(18) },
  bodyBold: { fontFamily: fonts.semibold, fontSize: scaleFont(13), fontWeight: "600" as const, lineHeight: scaleFont(18) },
  caption: { fontFamily: fonts.medium, fontSize: scaleFont(11), fontWeight: "500" as const, lineHeight: scaleFont(14) },
  label: { fontFamily: fonts.semibold, fontSize: scaleFont(10.5), fontWeight: "600" as const, letterSpacing: 0.5, textTransform: "uppercase" as const },
  eyebrow: { fontFamily: fonts.semibold, fontSize: scaleFont(10.5), fontWeight: "600" as const, letterSpacing: 0.6, textTransform: "uppercase" as const },
  metricNumber: { fontFamily: fonts.bold, fontSize: scaleFont(18), fontWeight: "700" as const, letterSpacing: -0.4 },
};

export const touchTarget = {
  minHeight: 40,
  minWidth: 40,
};
