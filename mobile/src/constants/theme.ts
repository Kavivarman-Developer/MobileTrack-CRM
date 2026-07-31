// Design system for the Retail Inventory & Billing app.
// Keeps the SAME export names/keys your screens already import (colors, spacing, radius, shadows)
// so nothing else in the codebase needs to change — only the values got a real design pass.

export const colors = {
  // Base surfaces
  background: "#F4F6FB",      // app background — soft cool grey, not pure white/grey
  surface: "#FFFFFF",         // cards
  surfaceTint: "#F0F3FF",     // subtle tinted panels (empty states etc.)
  border: "#E7EAF3",          // hairline borders — soft, not harsh grey

  // Text
  text: "#12172B",            // near-black navy for headings/body — softer than pure black
  muted: "#6B7280",           // secondary text

  // Brand
  primary: "#4F46E5",         // indigo — main brand/action color
  primaryDark: "#3730A3",     // pressed/active state, link text
  secondary: "#0F172A",       // deep navy for hero panels/headers

  // Status
  success: "#16A34A",
  danger: "#DC2626",
  warning: "#D97706",
  info: "#2563EB",
  accent: "#EA580C",          // used for money/highlight numbers
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
  sm: 10,
  md: 16,   // was likely 8 before — bumped up for a softer, more modern card feel
  lg: 22,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  floating: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 8,
  },
};

export const typography = {
  h1: { fontSize: 28, fontWeight: "900" as const, letterSpacing: -0.3 },
  h2: { fontSize: 20, fontWeight: "800" as const, letterSpacing: -0.2 },
  h3: { fontSize: 16, fontWeight: "800" as const },
  body: { fontSize: 14, fontWeight: "500" as const },
  caption: { fontSize: 12, fontWeight: "600" as const },
  eyebrow: { fontSize: 11, fontWeight: "800" as const, letterSpacing: 0.6, textTransform: "uppercase" as const },
};