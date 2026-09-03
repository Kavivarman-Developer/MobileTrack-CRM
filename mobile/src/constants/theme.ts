// Design system for the Retail Inventory & Billing app.
// Keep export names stable so existing screen behavior does not change.

export const colors = {
  // Base surfaces
  background: "#F7F7FA",
  surface: "#FFFFFF",
  surfaceTint: "#EEF0FA",
  border: "#E5E7EB",

  // Text
  text: "#111827",
  muted: "#6B7280",
  faint: "#9CA3AF",

  // Brand
  primary: "#4F46E5",
  primaryDark: "#4338CA",
  primaryLight: "#EEF2FF",
  secondary: "#1E1B4B",

  // Status
  success: "#16A34A",
  danger: "#DC2626",
  warning: "#D97706",
  info: "#0284C7",
  accent: "#EA580C",
  purple: "#7C3AED",

  // Soft tint backgrounds (badges/pills)
  greenSoft: "#E7F8EE",
  orangeSoft: "#FFF1E6",
  redSoft: "#FDECEC",
  blueSoft: "#EEF2FF",
  tealSoft: "#E6F6F4",
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  floating: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 7,
  },
  overlay: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    elevation: 12,
  },
};

export const typography = {
  h1: { fontSize: 28, fontWeight: "700" as const, letterSpacing: 0 },
  h2: { fontSize: 20, fontWeight: "700" as const, letterSpacing: 0 },
  h3: { fontSize: 16, fontWeight: "600" as const, letterSpacing: 0 },
  body: { fontSize: 15, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "500" as const },
  label: { fontSize: 13, fontWeight: "600" as const },
  eyebrow: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.6, textTransform: "uppercase" as const },
};
