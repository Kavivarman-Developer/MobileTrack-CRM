import { Ionicons } from "@expo/vector-icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { z } from "zod";
import { Button, Field } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { useAppDispatch } from "../../hooks/redux";
import { setCredentials } from "../../redux/authSlice";
import { confirmPasswordReset, getForgotPasswordStatus, login, requestPasswordReset } from "../../services/api";
import { showErrorToast, showSuccessToast, toastConfig } from "../../utils/toast";

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
type FormValues = z.infer<typeof schema>;
type ResetStep = "request" | "confirm";

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>("request");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
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
    onError: (error: Error) => showErrorToast(error.message, "Login failed"),
  });

  function closeReset() {
    setResetOpen(false);
    setResetStep("request");
    setResetCode("");
    setNewPassword("");
    setConfirmPassword("");
  }

  const requestReset = useMutation({
    mutationFn: () => requestPasswordReset(resetEmail.trim().toLowerCase()),
    onSuccess: (data) => {
      setResetStep("confirm");
      showSuccessToast(data.message, "Check your email");
    },
    onError: (error: Error) => showErrorToast(error.message, "Request failed"),
  });

  const confirmReset = useMutation({
    mutationFn: () => confirmPasswordReset(resetEmail.trim().toLowerCase(), resetCode.trim(), newPassword),
    onSuccess: (data) => {
      closeReset();
      showSuccessToast(data.message, "Password updated");
    },
    onError: (error: Error) => showErrorToast(error.message, "Reset failed"),
  });

  function submitRequest() {
    if (!canResetPassword) {
      Alert.alert("Enter email", "Enter your shop owner email first.");
      return;
    }
    requestReset.mutate();
  }

  function submitConfirm() {
    if (!resetCode.trim()) {
      Alert.alert("Enter code", "Enter the reset code from your email.");
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
    confirmReset.mutate();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <View style={styles.logoBadge}>
              <Ionicons color="#ffffff" name="storefront" size={32} />
            </View>
            <Text style={styles.brand}>Retail Manager</Text>
            <Text style={styles.subtitle}>Inventory, billing, customers and daily shop totals — all in one place.</Text>
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
                  <Ionicons color={colors.muted} name="mail-outline" size={20} style={styles.inputIcon} />
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
                  <Ionicons color={colors.muted} name="lock-closed-outline" size={20} style={styles.inputIcon} />
                  <Field
                    onChangeText={onChange}
                    placeholder="Enter password"
                    secureTextEntry={!showPassword}
                    style={styles.inputWithIconRight}
                    value={value}
                  />
                  <Pressable hitSlop={12} onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                    <Ionicons color={colors.muted} name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} />
                  </Pressable>
                </View>
              )}
            />

            <Button icon="log-in-outline" loading={mutation.isPending} onPress={handleSubmit((values) => mutation.mutate(values))} title="Sign in" />
            {forgotStatus.data?.enabled && (
              <Pressable onPress={() => { setResetEmail(email); setResetStep("request"); setResetOpen(true); }} style={styles.forgotButton}>
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
                <Text style={styles.cardHint}>
                  {resetStep === "request" ? "Use your shop owner email" : "Enter the code we emailed you"}
                </Text>
              </View>
              <Pressable onPress={closeReset} style={styles.closeButton}>
                <Ionicons color={colors.text} name="close" size={22} />
              </Pressable>
            </View>
            {resetStep === "request" ? (
              <>
                <Text style={styles.label}>Email address</Text>
                <Field autoCapitalize="none" keyboardType="email-address" onChangeText={setResetEmail} placeholder="you@shop.com" value={resetEmail} />
                <Button loading={requestReset.isPending} onPress={submitRequest} title="Send reset code" />
              </>
            ) : (
              <>
                <Text style={styles.cardHint}>Code sent to {resetEmail}</Text>
                <Text style={styles.label}>Reset code</Text>
                <Field autoCapitalize="none" onChangeText={setResetCode} placeholder="Paste the code from your email" value={resetCode} />
                <Text style={styles.label}>New password</Text>
                <Field onChangeText={setNewPassword} placeholder="New password" secureTextEntry value={newPassword} />
                <Text style={styles.label}>Confirm password</Text>
                <Field onChangeText={setConfirmPassword} placeholder="Confirm password" secureTextEntry value={confirmPassword} />
                <Button loading={confirmReset.isPending} onPress={submitConfirm} title="Update password" />
                <Pressable onPress={() => setResetStep("request")} style={styles.forgotButton}>
                  <Text style={styles.forgotText}>Use a different email</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
        <Toast config={toastConfig} />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.secondary },
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  brandBlock: { alignItems: "center", marginBottom: spacing.xl },
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
  brand: { color: "#ffffff", ...typography.h1, fontSize: 28, textAlign: "center" },
  subtitle: { color: "#94A3B8", fontSize: 14, fontWeight: "500", marginTop: spacing.xs, paddingHorizontal: spacing.md, textAlign: "center", lineHeight: 20 },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderColor: colors.border,
    borderWidth: 1,
    ...shadows.floating,
  },
  cardTitle: { color: colors.text, ...typography.h2 },
  cardHint: { color: colors.muted, fontSize: 14, fontWeight: "500", marginBottom: spacing.md, marginTop: 2 },

  label: { color: colors.text, ...typography.label, marginBottom: spacing.xs },
  inputWrap: { justifyContent: "center", marginBottom: spacing.sm, position: "relative" },
  inputIcon: { left: spacing.md, position: "absolute", zIndex: 2 },
  inputWithIcon: { paddingLeft: 46 },
  inputWithIconRight: { paddingLeft: 46, paddingRight: 48 },
  eyeButton: { alignItems: "center", height: 48, justifyContent: "center", position: "absolute", right: 4, width: 44, zIndex: 2 },
  forgotButton: { alignItems: "center", minHeight: 44, justifyContent: "center", marginTop: spacing.sm },
  forgotText: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  modalOverlay: { backgroundColor: "rgba(15, 23, 42, 0.45)", flex: 1, justifyContent: "flex-end" },
  resetCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
  resetHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  closeButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 40, justifyContent: "center", width: 40 },

  footer: { color: "#64748B", fontSize: 12, fontWeight: "500", marginTop: spacing.xl, textAlign: "center" },
});
