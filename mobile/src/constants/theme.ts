// Design system for the Retail Inventory & Billing app.
// Keep export names stable so existing screen behavior does not change.
import { ios } from "./ios";

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
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
};

export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 18,
  xl: 22,
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

export const fonts = {
  regular: "Inter_400Regular",
  medium: "Inter_500Medium",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
};

export const typography = {
  h1: { fontFamily: fonts.bold, fontSize: 28, fontWeight: "700" as const, letterSpacing: -0.6, lineHeight: 34 },
  h2: { fontFamily: fonts.bold, fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3, lineHeight: 26 },
  h3: { fontFamily: fonts.semibold, fontSize: 16, fontWeight: "600" as const, letterSpacing: -0.2, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, fontWeight: "500" as const, lineHeight: 22 },
  bodyBold: { fontFamily: fonts.semibold, fontSize: 15, fontWeight: "600" as const, lineHeight: 22 },
  caption: { fontFamily: fonts.medium, fontSize: 12, fontWeight: "500" as const, lineHeight: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.8, textTransform: "uppercase" as const },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.8, textTransform: "uppercase" as const },
  metricNumber: { fontFamily: fonts.bold, fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.4 },
};

export const touchTarget = {
  minHeight: 44,
  minWidth: 44,
};
