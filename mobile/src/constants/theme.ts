// Design system for the Retail Inventory & Billing app.
// Keep export names stable so existing screen behavior does not change.

export const colors = {
  // Base surfaces
  background: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceTint: "#EFF4FF",
  border: "#E3E7EF",

  // Text
  text: "#111827",
  muted: "#6B7280",

  // Brand
  primary: "#2563EB",
  primaryDark: "#1D4ED8",
  secondary: "#172033",

  // Status
  success: "#16A34A",
  danger: "#DC2626",
  warning: "#D97706",
  info: "#2563EB",
  accent: "#EA580C",
  purple: "#7C3AED",

  // Soft tint backgrounds (badges/pills)
  greenSoft: "#E7F8EE",
  orangeSoft: "#FFF1E6",
  redSoft: "#FDECEC",
  blueSoft: "#E8EEFE",
  tealSoft: "#E6F6F4",
};

export const spacing = {
  xs: 6,
  sm: 12,
  md: 18,
  lg: 26,
  xl: 36,
};

export const radius = {
  sm: 8,
  md: 8,
  lg: 12,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  floating: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 7,
  },
};

export const typography = {
  h1: { fontSize: 26, fontWeight: "900" as const, letterSpacing: 0 },
  h2: { fontSize: 20, fontWeight: "800" as const, letterSpacing: 0 },
  h3: { fontSize: 16, fontWeight: "800" as const, letterSpacing: 0 },
  body: { fontSize: 14, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "600" as const },
  eyebrow: { fontSize: 11, fontWeight: "800" as const, letterSpacing: 0.5, textTransform: "uppercase" as const },
};
