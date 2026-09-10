import { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, shadows, spacing, typography } from "../constants/theme";

export function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView edges={["top", "left", "right"]} style={styles.screen}>{children}</SafeAreaView>;
}

export function Card({ children, style }: { children: ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: any }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

// Small uppercase label used above page titles, e.g. "Shop overview" above "Dashboard"
export function Eyebrow({ children, icon }: { children: ReactNode; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.eyebrowWrap}>
      {icon && <Ionicons color={colors.primary} name={icon} size={13} style={styles.eyebrowIcon} />}
      <Text style={styles.eyebrow}>{children}</Text>
    </View>
  );
}

export function Field(props: TextInputProps & { error?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.faint}
      style={[
        styles.input,
        props.multiline && styles.inputMultiline,
        props.error && styles.inputError,
        props.style,
      ]}
      {...props}
    />
  );
}

export function Button({
  title,
  onPress,
  loading,
  variant = "primary",
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  style?: any;
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
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? "#ffffff" : colors.primary} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon && (
            <Ionicons
              color={
                variant === "secondary"
                  ? colors.text
                  : variant === "ghost"
                  ? colors.primary
                  : "#ffffff"
              }
              name={icon}
              size={18}
              style={{ marginRight: 6 }}
            />
          )}
          <Text
            style={[
              styles.buttonText,
              variant === "secondary" && styles.buttonTextSecondary,
              variant === "ghost" && styles.buttonTextGhost,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Empty({ text, icon = "cube-outline" }: { text: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Ionicons color={colors.primary} name={icon} size={24} />
      </View>
      <Text style={styles.empty}>{text}</Text>
    </View>
  );
}

// Reusable status pill, e.g. "Low stock", "Received", "Paid"
// ACCESSIBILITY IMPROVEMENT: Pairs background tone + text color + semantic icon (Dual-channel)
export function Badge({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: "success" | "danger" | "warning" | "info" | "neutral";
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const defaultIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
    success: "checkmark-circle-outline",
    danger: "alert-circle-outline",
    warning: "time-outline",
    info: "information-circle-outline",
    neutral: "ellipse-outline",
  };
  const activeIcon = icon || defaultIcon[tone];

  return (
    <View style={[styles.badge, badgeTone[tone].bg]}>
      <Ionicons color={badgeTone[tone].iconColor} name={activeIcon} size={12} style={{ marginRight: 4 }} />
      <Text style={[styles.badgeText, badgeTone[tone].text]}>{label}</Text>
    </View>
  );
}

const badgeTone = {
  success: { bg: { backgroundColor: colors.greenSoft }, text: { color: colors.success }, iconColor: colors.success },
  danger: { bg: { backgroundColor: colors.redSoft }, text: { color: colors.danger }, iconColor: colors.danger },
  warning: { bg: { backgroundColor: colors.orangeSoft }, text: { color: colors.warning }, iconColor: colors.warning },
  info: { bg: { backgroundColor: colors.blueSoft }, text: { color: colors.info }, iconColor: colors.info },
  neutral: { bg: { backgroundColor: colors.surfaceTint }, text: { color: colors.muted }, iconColor: colors.muted },
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  card: {
    ...shadows.card,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  title: { color: colors.text, ...typography.h1, marginBottom: spacing.xs },
  eyebrowWrap: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  eyebrowIcon: { marginRight: 4 },
  eyebrow: { color: colors.primary, ...typography.eyebrow },

  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputMultiline: { minHeight: 90, paddingTop: spacing.sm, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger },

  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md,
    ...shadows.card,
  },
  buttonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, elevation: 0 },
  buttonGhost: { backgroundColor: "transparent", elevation: 0 },
  buttonDanger: { backgroundColor: colors.danger },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontSize: 15, fontWeight: "600", textAlign: "center" },
  buttonTextSecondary: { color: colors.text },
  buttonTextGhost: { color: colors.primary },

  emptyWrap: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    marginVertical: spacing.sm,
  },
  emptyIconWrap: {
    alignItems: "center",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 48,
  },
  empty: { color: colors.muted, fontSize: 14, fontWeight: "500", textAlign: "center" },

  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
});
