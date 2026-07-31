import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { colors, radius, shadows, spacing, typography } from "../constants/theme";

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

// Small uppercase label used above page titles, e.g. "Shop overview" above "Dashboard"
export function Eyebrow({ children }: { children: ReactNode }) {
  return <Text style={styles.eyebrow}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} style={[styles.input, props.multiline && styles.inputMultiline, props.style]} {...props} />;
}

export function Button({
  title,
  onPress,
  loading,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <Pressable
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        variant === "danger" && styles.buttonDanger,
        pressed && styles.buttonPressed,
        loading && styles.buttonDisabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? "#fff" : colors.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "secondary" && styles.buttonTextSecondary,
            variant === "ghost" && styles.buttonTextGhost,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Text style={styles.emptyIcon}>+</Text>
      </View>
      <Text style={styles.empty}>{text}</Text>
    </View>
  );
}

// Reusable status pill, e.g. "Low stock", "Received", "Paid"
export function Badge({ label, tone = "neutral" }: { label: string; tone?: "success" | "danger" | "warning" | "info" | "neutral" }) {
  return (
    <View style={[styles.badge, badgeTone[tone].bg]}>
      <Text style={[styles.badgeText, badgeTone[tone].text]}>{label}</Text>
    </View>
  );
}

const badgeTone = {
  success: { bg: { backgroundColor: colors.greenSoft }, text: { color: colors.success } },
  danger: { bg: { backgroundColor: colors.redSoft }, text: { color: colors.danger } },
  warning: { bg: { backgroundColor: colors.orangeSoft }, text: { color: colors.warning } },
  info: { bg: { backgroundColor: colors.blueSoft }, text: { color: colors.info } },
  neutral: { bg: { backgroundColor: colors.surfaceTint }, text: { color: colors.muted } },
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  card: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  title: { color: colors.text, ...typography.h1, marginBottom: spacing.sm },
  eyebrow: { color: colors.primary, ...typography.eyebrow, marginBottom: 2 },

  input: {
    backgroundColor: colors.surfaceTint,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginBottom: spacing.sm,
    minHeight: 50,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputMultiline: { minHeight: 90, paddingTop: spacing.sm, textAlignVertical: "top" },

  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: spacing.md,
    ...shadows.card,
    shadowOpacity: 0.16,
  },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1.5, shadowOpacity: 0 },
  buttonGhost: { backgroundColor: "transparent", shadowOpacity: 0 },
  buttonDanger: { backgroundColor: colors.danger },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  buttonTextSecondary: { color: colors.text },
  buttonTextGhost: { color: colors.primary },

  emptyWrap: {
    alignItems: "center",
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.md,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  emptyIconWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 48,
    ...shadows.card,
  },
  emptyIcon: { color: colors.primary, fontSize: 22, fontWeight: "900" },
  empty: { color: colors.muted, fontSize: 14, fontWeight: "600", textAlign: "center" },

  badge: { alignSelf: "flex-start", borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
});