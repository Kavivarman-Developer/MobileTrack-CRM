import { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";
import { colors, radius, shadows, spacing } from "../constants/theme";

export function Screen({ children }: { children: ReactNode }) {
  return <View style={styles.screen}>{children}</View>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Field(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />;
}

export function Button({ title, onPress, loading }: { title: string; onPress: () => void; loading?: boolean }) {
  return (
    <TouchableOpacity disabled={loading} onPress={onPress} style={styles.button}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{title}</Text>}
    </TouchableOpacity>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyIcon}>+</Text>
      <Text style={styles.empty}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  card: { ...shadows.card, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  title: { color: colors.text, fontSize: 24, fontWeight: "800", marginBottom: spacing.md },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, marginBottom: spacing.sm, minHeight: 48, padding: spacing.md },
  button: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.md, minHeight: 48, justifyContent: "center", marginTop: spacing.xs, padding: spacing.md },
  buttonText: { color: "#fff", fontWeight: "800" },
  emptyWrap: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, justifyContent: "center", padding: spacing.lg },
  emptyIcon: { color: colors.primary, fontSize: 28, fontWeight: "900", marginBottom: spacing.xs },
  empty: { color: colors.muted, textAlign: "center" },
});
