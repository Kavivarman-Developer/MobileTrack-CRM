import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";
import { Button, Field } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { useAppDispatch } from "../../hooks/redux";
import { setCredentials } from "../../redux/authSlice";
import { getForgotPasswordStatus, login, resetForgotPassword } from "../../services/api";

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const { control, handleSubmit, watch } = useForm<FormValues>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(schema),
  });
  const email = watch("email").trim().toLowerCase();
  const canResetPassword = z.string().email().safeParse(resetEmail.trim().toLowerCase()).success;
  const forgotStatus = useQuery({
    queryFn: () => getForgotPasswordStatus(""),
    queryKey: ["forgot-password-status-global"],
    staleTime: 30_000,
  });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => login(values.email, values.password),
    onSuccess: (data) => dispatch(setCredentials(data)),
    onError: (error: Error) => Alert.alert("Login failed", error.message),
  });
  const resetPassword = useMutation({
    mutationFn: () => resetForgotPassword(resetEmail.trim().toLowerCase(), newPassword),
    onSuccess: (data) => {
      setResetOpen(false);
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password updated", data.message);
    },
    onError: (error: Error) => Alert.alert("Reset failed", error.message),
  });

  function submitReset() {
    if (!canResetPassword) {
      Alert.alert("Enter email", "Enter your shop owner email first.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Weak password", "Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Password mismatch", "New password and confirmation must match.");
      return;
    }
    resetPassword.mutate();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <View style={styles.logoBadge}>
              <Ionicons color="#fff" name="storefront" size={28} />
            </View>
            <Text style={styles.brand}>Retail Manager</Text>
            <Text style={styles.subtitle}>Inventory, billing, customers and daily shop totals - all in one place.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Welcome back</Text>
            <Text style={styles.cardHint}>Sign in to continue to your shop dashboard</Text>

            <Text style={styles.label}>Email address</Text>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <View style={styles.inputWrap}>
                  <Ionicons color={colors.muted} name="mail-outline" size={18} style={styles.inputIcon} />
                  <Field
                    autoCapitalize="none"
                    keyboardType="email-address"
                    onChangeText={onChange}
                    placeholder="you@shop.com"
                    style={styles.inputWithIcon}
                    value={value}
                  />
                </View>
              )}
            />

            <Text style={styles.label}>Password</Text>
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <View style={styles.inputWrap}>
                  <Ionicons color={colors.muted} name="lock-closed-outline" size={18} style={styles.inputIcon} />
                  <Field
                    onChangeText={onChange}
                    placeholder="Password"
                    secureTextEntry={!showPassword}
                    style={styles.inputWithIcon}
                    value={value}
                  />
                  <Pressable hitSlop={10} onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                    <Ionicons color={colors.muted} name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} />
                  </Pressable>
                </View>
              )}
            />

            <Button loading={mutation.isPending} onPress={handleSubmit((values) => mutation.mutate(values))} title="Sign in" />
            {forgotStatus.data?.enabled && (
              <Pressable onPress={() => { setResetEmail(email); setResetOpen(true); }} style={styles.forgotButton}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            )}
          </View>

          <Text style={styles.footer}>Secured with encrypted session tokens</Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <Modal animationType="slide" transparent visible={resetOpen}>
        <View style={styles.modalOverlay}>
          <View style={styles.resetCard}>
            <View style={styles.resetHeader}>
              <View>
                <Text style={styles.cardTitle}>Reset password</Text>
                <Text style={styles.cardHint}>Use your shop owner email</Text>
              </View>
              <Pressable onPress={() => setResetOpen(false)} style={styles.closeButton}>
                <Ionicons color={colors.text} name="close" size={20} />
              </Pressable>
            </View>
            <Text style={styles.label}>Email address</Text>
            <Field autoCapitalize="none" keyboardType="email-address" onChangeText={setResetEmail} placeholder="you@shop.com" value={resetEmail} />
            <Text style={styles.label}>New password</Text>
            <Field onChangeText={setNewPassword} placeholder="New password" secureTextEntry value={newPassword} />
            <Text style={styles.label}>Confirm password</Text>
            <Field onChangeText={setConfirmPassword} placeholder="Confirm password" secureTextEntry value={confirmPassword} />
            <Button loading={resetPassword.isPending} onPress={submitReset} title="Update password" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.secondary },
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  brandBlock: { alignItems: "center", marginBottom: spacing.lg },
  logoBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    height: 64,
    justifyContent: "center",
    marginBottom: spacing.md,
    width: 64,
    ...shadows.floating,
  },
  brand: { color: "#fff", ...typography.h1, textAlign: "center" },
  subtitle: { color: "#A9B1C7", fontSize: 14, fontWeight: "500", marginTop: spacing.xs, paddingHorizontal: spacing.md, textAlign: "center" },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.floating,
  },
  cardTitle: { color: colors.text, ...typography.h2 },
  cardHint: { color: colors.muted, fontSize: 13, fontWeight: "500", marginBottom: spacing.md, marginTop: 2 },

  label: { color: colors.text, fontSize: 12, fontWeight: "800", letterSpacing: 0.4, marginBottom: spacing.xs, textTransform: "uppercase" },
  inputWrap: { justifyContent: "center", marginBottom: spacing.sm, position: "relative" },
  inputIcon: { left: spacing.md, position: "absolute", zIndex: 2 },
  inputWithIcon: { marginBottom: 0, paddingLeft: 42, paddingRight: 46 },
  eyeButton: { alignItems: "center", height: 44, justifyContent: "center", position: "absolute", right: 6, width: 44 },
  forgotButton: { alignItems: "center", minHeight: 44, justifyContent: "center", marginTop: spacing.sm },
  forgotText: { color: colors.primaryDark, fontSize: 14, fontWeight: "900" },
  modalOverlay: { backgroundColor: "rgba(15,23,42,0.38)", flex: 1, justifyContent: "flex-end" },
  resetCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg },
  resetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  closeButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 40, justifyContent: "center", width: 40 },

  footer: { color: "#7C86A3", fontSize: 12, fontWeight: "600", marginTop: spacing.lg, textAlign: "center" },
});
