// Emergent Item Manager visual tokens — shared across screens.

export const ios = {
  bg: "#F6F5FA",
  card: "#FFFFFF",
  fill: "#EEEFF5",
  label: "#111827",
  secondary: "#8B8FA8",
  blue: "#4F6BF6",
  green: "#22C55E",
  orange: "#F59E0B",
  red: "#EF4444",
  dark: "#1B1F3B",
  separator: "rgba(27, 31, 59, 0.10)",
  sep: "rgba(27, 31, 59, 0.10)",
  teal: "#14B8A6",
  indigo: "#6366F1",
  purple: "#8B7CF6",
  purpleSoft: "#F0ECFF",
  purpleEyebrow: "#A78BFA",
  navy: "#1B1F3B",
  actionBar: "#2A2F4A",
} as const;

export type IosColor = typeof ios[keyof typeof ios];
