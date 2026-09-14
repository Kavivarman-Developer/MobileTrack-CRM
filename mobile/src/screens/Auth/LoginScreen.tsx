import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import { Button, Field, Sheet } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { useAppDispatch } from "../../hooks/redux";
import { setCredentials } from "../../redux/authSlice";
import {
  apiErrorMessage,
  AuthLookupResult,
  confirmPasswordReset,
  getForgotPasswordStatus,
  login,
  lookupAccount,
  registerShop,
  requestPasswordReset,
} from "../../services/api";
import { showErrorToast, showSuccessToast, toastConfig } from "../../utils/toast";

type AuthStep = "identifier" | "password" | "register";
type ResetStep = "request" | "confirm";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<AuthStep>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [lookup, setLookup] = useState<AuthLookupResult | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<ResetStep>("request");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");

  const accountEmail = lookup?.email || (lookup?.kind === "email" ? identifier.trim().toLowerCase() : email.trim().toLowerCase());
  const forgotStatus = useQuery({
    queryFn: () => getForgotPasswordStatus(accountEmail || ""),
    queryKey: ["forgot-password-status", accountEmail || "global"],
    staleTime: 30_000,
    enabled: step === "password",
  });

  const stepCopy = useMemo(() => {
    if (step === "identifier") return { title: "Quick start", hint: "Enter email or mobile — we’ll check if you’re new or already registered." };
    if (step === "password") return { title: lookup?.nameHint ? `Welcome back, ${lookup.nameHint}` : "Welcome back", hint: "Enter your password to open the shop." };
    return { title: "Create shop account", hint: "Soft signup — just a few details to get started." };
  }, [lookup?.nameHint, step]);

  const checkAccount = useMutation({
    mutationFn: () => lookupAccount(identifier.trim()),
    onSuccess: (data) => {
      setLookup(data);
      setPassword("");
      setConfirmPassword("");
      if (data.exists) {
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setStep("password");
      } else {
        setEmail(data.kind === "email" ? data.email || identifier.trim().toLowerCase() : "");
        setPhone(data.kind === "phone" ? data.phone || identifier.replace(/\D/g, "").slice(-10) : "");
        setStep("register");
      }
    },
    onError: (error: Error) => showErrorToast(apiErrorMessage(error), "Check failed"),
  });

  const signIn = useMutation({
    mutationFn: () => login(identifier.trim(), password),
    onSuccess: (data) => dispatch(setCredentials(data)),
    onError: (error: Error) => showErrorToast(apiErrorMessage(error), "Login failed"),
  });

  const signUp = useMutation({
    mutationFn: () =>
      registerShop({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        phone: phone.trim() || undefined,
        businessName: businessName.trim() || undefined,
      }),
    onSuccess: (data) => {
      showSuccessToast("Shop ready", "Welcome aboard");
      dispatch(setCredentials(data));
    },
    onError: (error: Error) => showErrorToast(apiErrorMessage(error), "Signup failed"),
  });

  function goBack() {
    if (step === "identifier") return;
    setStep("identifier");
    setLookup(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  }

  function submitIdentifier() {
    const value = identifier.trim();
    if (!value) return Alert.alert("Required", "Enter your email or mobile number.");
    if (!isEmail(value) && !isPhone(value)) {
      return Alert.alert("Invalid", "Use a valid email or 10-digit mobile number.");
    }
    checkAccount.mutate();
  }

  function submitPassword() {
    if (password.length < 6) return Alert.alert("Password", "Enter your password.");
    signIn.mutate();
  }

  function submitRegister() {
    if (!name.trim()) return Alert.alert("Name required", "Enter your name.");
    if (!email.trim() || !isEmail(email)) return Alert.alert("Email required", "Enter a valid email for your shop account.");
    if (phone.trim() && !isPhone(phone)) return Alert.alert("Mobile", "Enter a valid mobile number.");
    if (password.length < 6) return Alert.alert("Weak password", "Password must be at least 6 characters.");
    if (password !== confirmPassword) return Alert.alert("Mismatch", "Passwords do not match.");
    signUp.mutate();
  }

  function closeReset() {
    setResetOpen(false);
    setResetStep("request");
    setResetCode("");
    setNewPassword("");
    setResetConfirmPassword("");
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <View style={styles.logoBadge}>
              <Ionicons color="#ffffff" name="storefront" size={30} />
            </View>
            <Text style={styles.brand}>Retail Manager</Text>
            <Text style={styles.subtitle}>Quick login · Soft signup · One shop OS</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.stepDots}>
              <View style={[styles.dot, step === "identifier" && styles.dotOn]} />
              <View style={[styles.dot, (step === "password" || step === "register") && styles.dotOn]} />
            </View>

            {step !== "identifier" ? (
              <Pressable onPress={goBack} style={styles.backRow}>
                <Ionicons color={ios.blue} name="chevron-back" size={18} />
                <Text style={styles.backText}>Change {lookup?.kind === "phone" ? "mobile" : "email"}</Text>
              </Pressable>
            ) : null}

            <Text style={styles.cardTitle}>{stepCopy.title}</Text>
            <Text style={styles.cardHint}>{stepCopy.hint}</Text>

            {step === "identifier" && (
              <>
                <Text style={styles.label}>Email or mobile</Text>
                <View style={styles.inputWrap}>
                  <Ionicons color={ios.secondary} name="person-outline" size={20} style={styles.inputIcon} />
                  <Field
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onChangeText={setIdentifier}
                    onSubmitEditing={submitIdentifier}
                    placeholder="you@shop.com or 98765 43210"
                    returnKeyType="next"
                    style={styles.inputWithIcon}
                    value={identifier}
                  />
                </View>
                <Button icon="arrow-forward" loading={checkAccount.isPending} onPress={submitIdentifier} title="Continue" />
              </>
            )}

            {step === "password" && (
              <>
                <View style={styles.chip}>
                  <Ionicons color={ios.blue} name={lookup?.kind === "phone" ? "call-outline" : "mail-outline"} size={14} />
                  <Text style={styles.chipText}>{identifier.trim()}</Text>
                </View>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons color={ios.secondary} name="lock-closed-outline" size={20} style={styles.inputIcon} />
                  <Field
                    autoComplete="password"
                    onChangeText={setPassword}
                    onSubmitEditing={submitPassword}
                    placeholder="Enter password"
                    secureTextEntry={!showPassword}
                    style={styles.inputWithIconRight}
                    value={password}
                  />
                  <Pressable
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.eyeButton}
                  >
                    <Ionicons color={ios.secondary} name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} />
                  </Pressable>
                </View>
                <Button icon="log-in-outline" loading={signIn.isPending} onPress={submitPassword} title="Sign in" />
                {forgotStatus.data?.enabled && accountEmail ? (
                  <Pressable
                    onPress={() => {
                      setResetEmail(accountEmail);
                      setResetStep("request");
                      setResetOpen(true);
                    }}
                    style={styles.forgotButton}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </Pressable>
                ) : null}
              </>
            )}

            {step === "register" && (
              <>
                <View style={styles.chip}>
                  <Ionicons color={ios.green} name="person-add-outline" size={14} />
                  <Text style={styles.chipText}>New shop · {identifier.trim()}</Text>
                </View>

                <Text style={styles.label}>Your name</Text>
                <Field onChangeText={setName} placeholder="Owner name" value={name} />

                <Text style={styles.label}>Shop name</Text>
                <Field onChangeText={setBusinessName} placeholder="e.g. Metro Mobiles" value={businessName} />

                <Text style={styles.label}>Email</Text>
                <Field
                  autoCapitalize="none"
                  editable={lookup?.kind !== "email"}
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="you@shop.com"
                  style={lookup?.kind === "email" ? styles.lockedField : undefined}
                  value={email}
                />

                <Text style={styles.label}>Mobile {lookup?.kind === "email" ? "(optional)" : ""}</Text>
                <Field
                  editable={lookup?.kind !== "phone"}
                  keyboardType="phone-pad"
                  onChangeText={setPhone}
                  placeholder="9876543210"
                  style={lookup?.kind === "phone" ? styles.lockedField : undefined}
                  value={phone}
                />

                <Text style={styles.label}>Create password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons color={ios.secondary} name="lock-closed-outline" size={20} style={styles.inputIcon} />
                  <Field
                    onChangeText={setPassword}
                    placeholder="Min 6 characters"
                    secureTextEntry={!showPassword}
                    style={styles.inputWithIconRight}
                    value={password}
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                    <Ionicons color={ios.secondary} name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} />
                  </Pressable>
                </View>

                <Text style={styles.label}>Confirm password</Text>
                <Field onChangeText={setConfirmPassword} placeholder="Re-enter password" secureTextEntry={!showPassword} value={confirmPassword} />

                <Button icon="checkmark-circle-outline" loading={signUp.isPending} onPress={submitRegister} title="Create account & enter" />
              </>
            )}
          </View>

          <Text style={styles.footer}>Existing shop → password · New shop → soft signup</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <Sheet
        hint={resetStep === "request" ? "We’ll email a reset code to your inbox" : "Paste the code, then set a new password"}
        icon="key-outline"
        onClose={closeReset}
        title="Reset password"
        visible={resetOpen}
        footer={
          resetStep === "request" ? (
            <Button
              loading={requestReset.isPending}
              onPress={() => {
                if (!isEmail(resetEmail)) return Alert.alert("Email", "Enter a valid email.");
                requestReset.mutate();
              }}
              title="Send reset code"
            />
          ) : (
            <Button
              loading={confirmReset.isPending}
              onPress={() => {
                if (!resetCode.trim()) return Alert.alert("Code", "Enter the reset code.");
                if (newPassword.length < 6) return Alert.alert("Password", "Use at least 6 characters.");
                if (newPassword !== resetConfirmPassword) return Alert.alert("Mismatch", "Passwords do not match.");
                confirmReset.mutate();
              }}
              title="Update password"
            />
          )
        }
      >
        {resetStep === "request" ? (
          <>
            <Text style={styles.label}>Email</Text>
            <Field autoCapitalize="none" keyboardType="email-address" onChangeText={setResetEmail} placeholder="you@shop.com" value={resetEmail} />
          </>
        ) : (
          <>
            <View style={styles.chip}>
              <Ionicons color={ios.blue} name="mail-outline" size={14} />
              <Text style={styles.chipText}>{resetEmail}</Text>
            </View>
            <Text style={styles.label}>Reset code</Text>
            <Field autoCapitalize="none" onChangeText={setResetCode} placeholder="Paste code" value={resetCode} />
            <Text style={styles.label}>New password</Text>
            <Field onChangeText={setNewPassword} placeholder="New password" secureTextEntry value={newPassword} />
            <Text style={styles.label}>Confirm password</Text>
            <Field onChangeText={setResetConfirmPassword} placeholder="Confirm password" secureTextEntry value={resetConfirmPassword} />
            <Pressable onPress={() => setResetStep("request")} style={styles.forgotButton}>
              <Text style={styles.forgotText}>Use a different email</Text>
            </Pressable>
          </>
        )}
      </Sheet>
      <Toast config={toastConfig} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: ios.dark },
  container: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  brandBlock: { alignItems: "center", marginBottom: spacing.xl },
  logoBadge: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 20,
    height: 64,
    justifyContent: "center",
    marginBottom: spacing.md,
    width: 64,
  },
  brand: { color: "#ffffff", fontFamily: fonts.bold, fontSize: 28, fontWeight: "700", letterSpacing: -0.6, textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.65)", fontFamily: fonts.medium, fontSize: 14, marginTop: 6, textAlign: "center" },

  card: { backgroundColor: ios.card, borderRadius: 24, padding: spacing.xl },
  stepDots: { flexDirection: "row", gap: 6, marginBottom: 14 },
  dot: { backgroundColor: ios.fill, borderRadius: 999, height: 6, width: 18 },
  dotOn: { backgroundColor: ios.blue, width: 28 },
  backRow: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", marginBottom: 8 },
  backText: { color: ios.blue, fontFamily: fonts.semibold, fontSize: 14, fontWeight: "600" },
  cardTitle: { color: ios.label, fontFamily: fonts.bold, fontSize: 24, fontWeight: "700", letterSpacing: -0.4 },
  cardHint: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg, marginTop: 4 },

  label: { color: ios.secondary, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  inputWrap: { justifyContent: "center", position: "relative" },
  inputIcon: { left: spacing.md, position: "absolute", zIndex: 2 },
  inputWithIcon: { paddingLeft: 46 },
  inputWithIconRight: { paddingLeft: 46, paddingRight: 48 },
  eyeButton: { alignItems: "center", height: 48, justifyContent: "center", position: "absolute", right: 4, width: 44, zIndex: 2 },
  lockedField: { backgroundColor: ios.fill, opacity: 0.9 },

  chip: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#007AFF14",
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { color: ios.blue, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },

  forgotButton: { alignItems: "center", minHeight: 44, justifyContent: "center", marginTop: spacing.sm },
  forgotText: { color: ios.blue, fontFamily: fonts.semibold, fontSize: 14, fontWeight: "600" },
  footer: { color: "rgba(255,255,255,0.45)", fontFamily: fonts.medium, fontSize: 12, marginTop: spacing.xl, textAlign: "center" },
});
