// Design system for the Retail Inventory & Billing app.
// Keep export names stable so existing screen behavior does not change.

export const colors = {
  // Base surfaces & canvas
  background: "#F8FAFC", // Clean, crisp cool gray canvas
  surface: "#FFFFFF",    // Pure white for card elevation
  surfaceTint: "#F1F5F9",// Soft neutral fill for inputs & chips
  border: "#E2E8F0",     // Subtle divider border
  borderDark: "#CBD5E1", // Slightly stronger border for interactive focus

  // Text hierarchy
  text: "#0F172A",       // Deep Slate-900 for high readability
  muted: "#64748B",      // Slate-500 for secondary copy & hints
  faint: "#94A3B8",      // Slate-400 for disabled / placeholder text

  // Brand Palette (Refined Indigo)
  primary: "#4F46E5",     // Indigo 600 - Main call-to-action
  primaryDark: "#4338CA", // Indigo 700 - Active state & headers
  primaryLight: "#EEF2FF",// Indigo 50 - Background accent
  secondary: "#1E1B4B",   // Indigo 950 - Dark contrast containers / headers

  // Status & Semantic Colors (WCAG 2.1 Compliant contrast)
  success: "#059669",     // Emerald 600 - Paid / Healthy Stock
  danger: "#DC2626",      // Red 600 - Unpaid / Out of Stock / Delete
  warning: "#D97706",     // Amber 600 - Low Stock / Pending / Partial
  info: "#0284C7",        // Light Blue 600 - New Order / Info
  accent: "#EA580C",      // Orange 600 - Profit / Metrics
  purple: "#7C3AED",      // Violet 600 - Processing status

  // Soft tint backgrounds (Badges / Pills / Alert Banners)
  greenSoft: "#ECFDF5",   // Emerald 50
  orangeSoft: "#FFF7ED",  // Orange 50
  redSoft: "#FEF2F2",     // Red 50
  blueSoft: "#EFF6FF",    // Blue 50
  tealSoft: "#F0FDF4",    // Mint 50
  purpleSoft: "#F5F3FF",  // Purple 50
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
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  floating: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  overlay: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const typography = {
  h1: { fontSize: 26, fontWeight: "700" as const, letterSpacing: -0.5, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.3, lineHeight: 26 },
  h3: { fontSize: 16, fontWeight: "600" as const, letterSpacing: -0.2, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodyMedium: { fontSize: 15, fontWeight: "500" as const, lineHeight: 22 },
  bodyBold: { fontSize: 15, fontWeight: "600" as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: "500" as const, lineHeight: 16 },
  label: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.4, textTransform: "uppercase" as const },
  eyebrow: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.8, textTransform: "uppercase" as const },
  metricNumber: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.5 },
};

export const touchTarget = {
  minHeight: 44,
  minWidth: 44,
};
