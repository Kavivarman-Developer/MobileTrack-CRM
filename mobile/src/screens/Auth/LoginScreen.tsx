import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import Toast from "react-native-toast-message";
import Svg, { Path } from "react-native-svg";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  sendPasswordResetEmail,
  ConfirmationResult,
} from "firebase/auth";
import { LinearGradient } from "expo-linear-gradient";
import { Button, Field, Sheet } from "../../components/Layout";
import { spacing } from "../../constants/theme";
import { firebaseApp, firebaseAuth } from "../../config/firebase";
import { useAppDispatch } from "../../hooks/redux";
import { setCredentials } from "../../redux/authSlice";
import { apiErrorMessage, AuthLookupResult, firebaseLogin, lookupAccount } from "../../services/api";
import { showErrorToast, showSuccessToast, toastConfig } from "../../utils/toast";

type AuthStep = "identifier" | "email-password" | "email-register" | "otp" | "phone-register";

const brand = {
  navy: "#0D3666",
  orange: "#F59926",
  cream: "#FEF5E9",
  muted: "#5E748B",
  border: "#D2DCE7",
  inputBorder: "#C5D3E1",
  inputBg: "#F3F7FC",
  featureIconBg: "#FFEBC8",
  blueLink: "#0066CC",
};

const fonts = {
  regular: Platform.select({
    web: "'Nunito Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    default: "NunitoSans_400Regular",
  }),
  semibold: Platform.select({
    web: "'Nunito Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    default: "NunitoSans_600SemiBold",
  }),
  bold: Platform.select({
    web: "'Nunito Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    default: "NunitoSans_700Bold",
  }),
  extraBold: Platform.select({
    web: "'Nunito Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    default: "NunitoSans_800ExtraBold",
  }),
  medium: Platform.select({
    web: "'Nunito Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    default: "NunitoSans_600SemiBold",
  }),
};

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function toE164(value: string) {
  const digits = value.replace(/\D/g, "");
  if (value.trim().startsWith("+")) return `+${digits}`;
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

function formatDisplayPhone(value: string) {
  const trimmed = value.trim();
  if (isEmail(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (trimmed.startsWith("+")) return trimmed;
  return `+91 ${digits}`;
}

function firebaseErrorMessage(error: unknown) {
  const code = (error as any)?.code as string | undefined;
  const map: Record<string, string> = {
    "auth/wrong-password": "Incorrect password.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/user-not-found": "No account found.",
    "auth/email-already-in-use": "Email already registered.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/invalid-verification-code": "Incorrect OTP. Try again.",
    "auth/code-expired": "OTP expired. Request a new one.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/invalid-phone-number": "Enter a valid mobile number.",
  };
  if (code && map[code]) return map[code];
  return (error as Error)?.message?.replace(/^Firebase:\s*/, "") || "Something went wrong";
}

function StepBadge({ n }: { n: number }) {
  return (
    <View style={styles.stepBadge}>
      <Text style={styles.stepBadgeText}>{n}</Text>
    </View>
  );
}

function PrimaryCTA({
  title,
  onPress,
  loading,
  icon,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(loading), disabled: Boolean(loading) }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [styles.ctaWrapper, pressed && styles.ctaPressed]}
    >
      <LinearGradient
        colors={["#134A85", brand.navy]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.ctaGradient}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Text style={styles.ctaText}>{title}</Text>
            <Ionicons color="#FFFFFF" name={icon} size={19} />
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const pendingIdTokenRef = useRef<string | null>(null);

  const [step, setStep] = useState<AuthStep>("identifier");
  const [identifier, setIdentifier] = useState("");
  const [lookup, setLookup] = useState<AuthLookupResult | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [rememberMe, setRememberMe] = useState(true);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const accountEmail = lookup?.kind === "email" ? identifier.trim().toLowerCase() : "";

  const stepCopy = useMemo(() => {
    if (step === "identifier") return { n: 1, title: "Enter Mobile Number", hint: "We’ll send you a secure OTP to continue." };
    if (step === "email-password")
      return { n: 2, title: lookup?.nameHint ? `Welcome back, ${lookup.nameHint}` : "Enter Password", hint: "Login to your account" };
    if (step === "email-register") return { n: 2, title: "Create shop account", hint: "Soft signup — just a few details to get started." };
    if (step === "otp") return { n: 2, title: "Enter OTP", hint: `We’ve sent a code to ${identifier.trim()}` };
    return { n: 2, title: "Almost there", hint: "Tell us a bit about your shop." };
  }, [identifier, lookup?.nameHint, step]);

  function goBack() {
    if (step === "identifier") return;
    setStep("identifier");
    setLookup(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setOtpCode("");
    confirmationRef.current = null;
    pendingIdTokenRef.current = null;
  }

  async function finalizeLogin(idToken: string, nameValue?: string, businessNameValue?: string) {
    const data = await firebaseLogin(idToken, nameValue, businessNameValue);
    dispatch(setCredentials(data));
  }

  const checkAccount = useMutation({
    mutationFn: () => lookupAccount(identifier.trim()),
    onSuccess: (data) => {
      setLookup(data);
      setPassword("");
      setConfirmPassword("");
      if (data.kind === "email") {
        setStep(data.exists ? "email-password" : "email-register");
      } else {
        sendOtp.mutate();
      }
    },
    onError: (error: Error) => showErrorToast(apiErrorMessage(error), "Check failed"),
  });

  const sendOtp = useMutation({
    mutationFn: async () => {
      const verifier = recaptchaVerifier.current;
      if (!verifier) throw new Error("Verification is not ready. Try again.");
      const confirmation = await signInWithPhoneNumber(firebaseAuth, toE164(identifier), verifier);
      confirmationRef.current = confirmation;
    },
    onSuccess: () => {
      setOtpCode("");
      setStep("otp");
    },
    onError: (error) => showErrorToast(firebaseErrorMessage(error), "Could not send OTP"),
  });

  const confirmOtp = useMutation({
    mutationFn: async () => {
      if (!confirmationRef.current) throw new Error("Request a new OTP.");
      const credential = await confirmationRef.current.confirm(otpCode.trim());
      return credential.user.getIdToken();
    },
    onSuccess: async (idToken) => {
      if (lookup?.exists) {
        try {
          await finalizeLogin(idToken);
        } catch (error) {
          showErrorToast(apiErrorMessage(error), "Login failed");
        }
      } else {
        pendingIdTokenRef.current = idToken;
        setStep("phone-register");
      }
    },
    onError: (error) => showErrorToast(firebaseErrorMessage(error), "Verification failed"),
  });

  const emailSignIn = useMutation({
    mutationFn: async () => {
      const credential = await signInWithEmailAndPassword(firebaseAuth, identifier.trim().toLowerCase(), password);
      const idToken = await credential.user.getIdToken();
      await finalizeLogin(idToken);
    },
    onError: (error) => showErrorToast(firebaseErrorMessage(error), "Login failed"),
  });

  const emailRegister = useMutation({
    mutationFn: async () => {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, identifier.trim().toLowerCase(), password);
      const idToken = await credential.user.getIdToken();
      await finalizeLogin(idToken, name.trim(), businessName.trim() || undefined);
    },
    onSuccess: () => showSuccessToast("Shop ready", "Welcome aboard"),
    onError: (error) => showErrorToast(firebaseErrorMessage(error), "Signup failed"),
  });

  const phoneRegister = useMutation({
    mutationFn: async () => {
      if (!pendingIdTokenRef.current) throw new Error("Session expired. Verify your mobile again.");
      await finalizeLogin(pendingIdTokenRef.current, name.trim(), businessName.trim() || undefined);
    },
    onSuccess: () => showSuccessToast("Shop ready", "Welcome aboard"),
    onError: (error: Error) => showErrorToast(apiErrorMessage(error), "Signup failed"),
  });

  function submitIdentifier() {
    const value = identifier.trim();
    if (!value) return Alert.alert("Required", "Enter your email or mobile number.");
    if (!isEmail(value) && !isPhone(value)) {
      return Alert.alert("Invalid", "Use a valid email or 10-digit mobile number.");
    }
    checkAccount.mutate();
  }

  function submitEmailPassword() {
    if (password.length < 6) return Alert.alert("Password", "Enter your password.");
    emailSignIn.mutate();
  }

  function submitEmailRegister() {
    if (!name.trim()) return Alert.alert("Name required", "Enter your name.");
    if (password.length < 6) return Alert.alert("Weak password", "Password must be at least 6 characters.");
    if (password !== confirmPassword) return Alert.alert("Mismatch", "Passwords do not match.");
    emailRegister.mutate();
  }

  function submitOtp() {
    if (otpCode.trim().length < 6) return Alert.alert("OTP", "Enter the 6-digit code.");
    confirmOtp.mutate();
  }

  function submitPhoneRegister() {
    if (!name.trim()) return Alert.alert("Name required", "Enter your name.");
    phoneRegister.mutate();
  }

  function closeReset() {
    setResetOpen(false);
    setResetSent(false);
    setResetEmail("");
  }

  const requestReset = useMutation({
    mutationFn: () => sendPasswordResetEmail(firebaseAuth, resetEmail.trim().toLowerCase()),
    onSuccess: () => {
      setResetSent(true);
      showSuccessToast("Check your email", "We sent a password reset link.");
    },
    onError: (error) => showErrorToast(firebaseErrorMessage(error), "Request failed"),
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseApp.options as any}
        attemptInvisibleVerification
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Bar Back Button (Only for sub-steps) */}
          <View style={styles.topBar}>
            {step !== "identifier" ? (
              <Pressable onPress={goBack} style={styles.topBackRow}>
                <Ionicons color={brand.navy} name="arrow-back" size={18} />
                <Text style={styles.topBackText}>Back</Text>
              </Pressable>
            ) : (
              <View style={{ height: 16 }} />
            )}
          </View>

          {/* Hero Storefront Banner */}
          <View style={styles.heroWrapper}>
            <Image
              resizeMode="cover"
              source={require("../../../assets/hero.jpeg")}
              style={styles.heroImage}
            />
            {/* Deep gradient for punch + legibility, fading into the cream canvas */}
            <LinearGradient
              colors={["rgba(13,54,102,0.55)", "rgba(13,54,102,0.05)", brand.cream]}
              locations={[0, 0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            {/* Curved wave cut where the hero meets the content below */}
            <Svg height="20" style={styles.heroWave} viewBox="0 0 400 20" width="100%">
              <Path d="M0 20 Q 100 0 200 8 Q 300 16 400 2 L400 20 Z" fill={brand.cream} />
            </Svg>
          </View>

          {/* Brand Identity Block */}
          <View style={styles.brandBlock}>
            <View style={styles.logoBadgeGlow}>
              <View style={styles.logoBadge}>
                <Ionicons color="#FFFFFF" name="storefront" size={22} />
              </View>
            </View>
            <Text style={styles.brand}>Kadai Kanakku</Text>
            <Text style={styles.subtitle}>
              Unnaalum Unnoda Kadaiyum Nalla Nadakkattum
            </Text>

            {/* Orange Curved Underline accent */}
            <Svg height="8" width="90" viewBox="0 0 90 8" style={{ marginTop: 3 }}>
              <Path
                d="M 3 2 Q 45 7 87 2"
                fill="none"
                stroke={brand.orange}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </Svg>
          </View>

          {/* Primary Form Card */}
          <View style={styles.card}>
            {/* Step Header */}
            <View style={styles.stepHeaderRow}>
              <StepBadge n={stepCopy.n} />
              <View style={styles.stepHeaderText}>
                <Text style={styles.cardTitle}>{stepCopy.title}</Text>
                <Text style={styles.cardHint}>{stepCopy.hint}</Text>
              </View>
            </View>

            {/* STEP 1: Phone / Email Entry */}
            {step === "identifier" && (
              <View style={styles.stepBody}>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryPickerBox}>
                    <Text style={styles.flagEmoji}>🇮🇳</Text>
                    <Text style={styles.countryCodeText}>+91</Text>
                    <Ionicons color={brand.muted} name="chevron-down" size={13} style={{ marginLeft: 2 }} />
                  </View>
                  <View style={styles.phoneInputDivider} />
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    onChangeText={setIdentifier}
                    onSubmitEditing={submitIdentifier}
                    placeholder="Mobile number"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="next"
                    style={styles.phoneTextInput}
                    value={identifier}
                  />
                </View>

                {/* Primary CTA Button */}
                <PrimaryCTA
                  icon="arrow-forward"
                  loading={checkAccount.isPending || sendOtp.isPending}
                  onPress={submitIdentifier}
                  title="Get OTP"
                />
              </View>
            )}

            {/* STEP 2: Password Step (Existing Email Users) */}
            {step === "email-password" && (
              <View style={styles.stepBody}>
                <View style={styles.selectedIdentifierBox}>
                  <View style={styles.selectedIdentifierLeft}>
                    <Ionicons color={brand.navy} name="phone-portrait-outline" size={18} />
                    <Text style={styles.selectedIdentifierText}>{formatDisplayPhone(identifier)}</Text>
                  </View>
                  <Pressable onPress={goBack} style={styles.changeLink}>
                    <Text style={styles.changeLinkText}>Change</Text>
                  </Pressable>
                </View>

                <View style={styles.inputWrap}>
                  <Ionicons color={brand.muted} name="lock-closed-outline" size={18} style={styles.inputIcon} />
                  <Field
                    autoComplete="password"
                    onChangeText={setPassword}
                    onSubmitEditing={submitEmailPassword}
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    style={styles.inputWithIconRight}
                    value={password}
                  />
                  <Pressable
                    accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      color={brand.muted}
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                    />
                  </Pressable>
                </View>

                {/* Remember & Forgot Password Links */}
                <View style={styles.rememberRow}>
                  <Pressable onPress={() => setRememberMe((v) => !v)} style={styles.rememberLeft}>
                    <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                      {rememberMe && <Ionicons color="#FFFFFF" name="checkmark" size={11} />}
                    </View>
                    <Text style={styles.rememberText}>Remember me</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setResetEmail(accountEmail || identifier);
                      setResetSent(false);
                      setResetOpen(true);
                    }}
                  >
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </Pressable>
                </View>

                <PrimaryCTA
                  icon="log-in-outline"
                  loading={emailSignIn.isPending}
                  onPress={submitEmailPassword}
                  title="Login"
                />

                <Pressable onPress={goBack} style={styles.createPanel}>
                  <Text style={styles.createPanelText}>Don’t have an account?</Text>
                  <Text style={styles.createPanelLink}>Create one →</Text>
                </Pressable>
              </View>
            )}

            {/* STEP 3: Email Register */}
            {step === "email-register" && (
              <View style={styles.stepBody}>
                <View style={styles.selectedIdentifierBox}>
                  <View style={styles.selectedIdentifierLeft}>
                    <Ionicons color={brand.navy} name="person-add-outline" size={16} />
                    <Text style={styles.selectedIdentifierText}>New shop · {identifier.trim()}</Text>
                  </View>
                </View>

                <Text style={styles.label}>Your name</Text>
                <Field onChangeText={setName} placeholder="Owner name" value={name} />

                <Text style={styles.label}>Shop name</Text>
                <Field onChangeText={setBusinessName} placeholder="e.g. Metro Mobiles" value={businessName} />

                <Text style={styles.label}>Create password</Text>
                <View style={styles.inputWrap}>
                  <Ionicons color={brand.muted} name="lock-closed-outline" size={18} style={styles.inputIcon} />
                  <Field
                    onChangeText={setPassword}
                    placeholder="Min 6 characters"
                    secureTextEntry={!showPassword}
                    style={styles.inputWithIconRight}
                    value={password}
                  />
                  <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                    <Ionicons
                      color={brand.muted}
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                    />
                  </Pressable>
                </View>

                <Text style={styles.label}>Confirm password</Text>
                <Field
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                />

                <PrimaryCTA
                  icon="checkmark-circle-outline"
                  loading={emailRegister.isPending}
                  onPress={submitEmailRegister}
                  title="Create account & enter"
                />
              </View>
            )}

            {/* STEP 4: OTP Verification */}
            {step === "otp" && (
              <View style={styles.stepBody}>
                <View style={styles.selectedIdentifierBox}>
                  <View style={styles.selectedIdentifierLeft}>
                    <Ionicons color={brand.navy} name="call-outline" size={16} />
                    <Text style={styles.selectedIdentifierText}>{identifier.trim()}</Text>
                  </View>
                  <Pressable onPress={goBack} style={styles.changeLink}>
                    <Text style={styles.changeLinkText}>Change</Text>
                  </Pressable>
                </View>

                <View style={styles.inputWrap}>
                  <Ionicons color={brand.muted} name="keypad-outline" size={18} style={styles.inputIcon} />
                  <Field
                    keyboardType="number-pad"
                    maxLength={6}
                    onChangeText={setOtpCode}
                    onSubmitEditing={submitOtp}
                    placeholder="Enter 6-digit OTP"
                    style={styles.inputWithIcon}
                    value={otpCode}
                  />
                </View>

                <PrimaryCTA
                  icon="checkmark-circle-outline"
                  loading={confirmOtp.isPending}
                  onPress={submitOtp}
                  title="Verify & continue"
                />

                <Pressable onPress={() => sendOtp.mutate()} style={styles.forgotButton}>
                  <Text style={styles.forgotText}>
                    {sendOtp.isPending ? "Sending..." : "Resend code"}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* STEP 5: Phone Onboarding / Shop Details */}
            {step === "phone-register" && (
              <View style={styles.stepBody}>
                <View style={styles.selectedIdentifierBox}>
                  <View style={styles.selectedIdentifierLeft}>
                    <Ionicons color={brand.navy} name="person-add-outline" size={16} />
                    <Text style={styles.selectedIdentifierText}>New shop · {identifier.trim()}</Text>
                  </View>
                </View>

                <Text style={styles.label}>Your name</Text>
                <Field onChangeText={setName} placeholder="Owner name" value={name} />

                <Text style={styles.label}>Shop name</Text>
                <Field onChangeText={setBusinessName} placeholder="e.g. Metro Mobiles" value={businessName} />

                <PrimaryCTA
                  icon="checkmark-circle-outline"
                  loading={phoneRegister.isPending}
                  onPress={submitPhoneRegister}
                  title="Create account & enter"
                />
              </View>
            )}
          </View>

          {/* Three Feature Highlights / Trust Bar */}
          <View style={styles.featureRow}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconBadge}>
                <Ionicons color={brand.orange} name="shield-checkmark" size={14} />
              </View>
              <Text style={styles.featureText}>Safe & Secure</Text>
            </View>
            <View style={styles.featureDivider} />
            <View style={styles.featureItem}>
              <View style={styles.featureIconBadge}>
                <Ionicons color={brand.orange} name="flash" size={14} />
              </View>
              <Text style={styles.featureText}>Fast Access</Text>
            </View>
            <View style={styles.featureDivider} />
            <View style={styles.featureItem}>
              <View style={styles.featureIconBadge}>
                <Ionicons color={brand.orange} name="bar-chart" size={14} />
              </View>
              <Text style={styles.featureText}>Manage Shop</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Reset Password Sheet */}
      <Sheet
        hint={resetSent ? "Check your inbox for the reset link" : "We’ll email a reset link to your inbox"}
        icon="key-outline"
        onClose={closeReset}
        title="Reset password"
        visible={resetOpen}
        footer={
          resetSent ? (
            <Button onPress={closeReset} title="Done" />
          ) : (
            <Button
              loading={requestReset.isPending}
              onPress={() => {
                if (!isEmail(resetEmail)) return Alert.alert("Email", "Enter a valid email.");
                requestReset.mutate();
              }}
              title="Send reset link"
            />
          )
        }
      >
        {!resetSent ? (
          <>
            <Text style={styles.label}>Email</Text>
            <Field
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={setResetEmail}
              placeholder="you@shop.com"
              value={resetEmail}
            />
          </>
        ) : null}
      </Sheet>
      <Toast config={toastConfig} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: brand.cream },
  container: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
    alignItems: "center",
  },

  topBar: {
    width: "100%",
    maxWidth: 420,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === "android" ? spacing.xs : 0,
    zIndex: 10,
    minHeight: 28,
    justifyContent: "center",
  },
  topBackRow: { alignItems: "center", flexDirection: "row", gap: 4, paddingVertical: 4 },
  topBackText: { color: brand.navy, fontFamily: fonts.bold, fontSize: 14, fontWeight: "700" },

  heroWrapper: {
    height: 110,
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  heroImage: { height: "100%", width: "100%" },
  heroWave: {
    bottom: -1,
    position: "absolute",
  },

  brandBlock: {
    alignItems: "center",
    marginTop: -24,
    paddingHorizontal: spacing.md,
    zIndex: 5,
  },
  logoBadgeGlow: {
    alignItems: "center",
    backgroundColor: "rgba(245, 153, 38, 0.16)",
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    marginBottom: 4,
    width: 52,
  },
  logoBadge: {
    alignItems: "center",
    backgroundColor: brand.navy,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
    borderWidth: 2.5,
    borderColor: brand.cream,
    shadowColor: brand.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  brand: {
    color: brand.navy,
    fontFamily: fonts.extraBold,
    fontSize: 22,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  subtitle: {
    color: brand.muted,
    fontFamily: fonts.regular,
    fontSize: 11.5,
    marginTop: 2,
    textAlign: "center",
    lineHeight: 15,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: spacing.md,
    marginTop: spacing.sm,
    width: "92%",
    maxWidth: 420,
    shadowColor: "#0D3666",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },

  stepHeaderRow: {
    flexDirection: "row",
    marginBottom: spacing.sm,
    alignItems: "center",
  },
  stepBadge: {
    alignItems: "center",
    backgroundColor: brand.orange,
    borderRadius: 999,
    height: 26,
    justifyContent: "center",
    marginRight: 8,
    width: 26,
    shadowColor: brand.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  stepBadgeText: { color: "#FDFCF9", fontFamily: fonts.bold, fontSize: 13 },
  stepHeaderText: { flex: 1 },
  cardTitle: {
    color: brand.navy,
    fontFamily: fonts.extraBold,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  cardHint: {
    color: brand.muted,
    fontFamily: fonts.medium,
    fontSize: 11.5,
    lineHeight: 15,
    marginTop: 1,
  },

  stepBody: { marginTop: 2 },

  label: {
    color: brand.muted,
    fontFamily: fonts.semibold,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 4,
  },

  phoneInputContainer: {
    alignItems: "center",
    backgroundColor: brand.inputBg,
    borderColor: brand.inputBorder,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: 10,
    marginBottom: spacing.sm,
  },
  countryPickerBox: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
  },
  flagEmoji: { fontSize: 16, marginRight: 2 },
  countryCodeText: { color: brand.navy, fontFamily: fonts.bold, fontSize: 14, fontWeight: "700" },
  phoneInputDivider: {
    backgroundColor: brand.border,
    height: 20,
    marginHorizontal: 8,
    width: 1,
  },
  phoneTextInput: {
    color: brand.navy,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    minHeight: 40,
    paddingVertical: 0,
  },

  inputWrap: {
    justifyContent: "center",
    position: "relative",
    marginBottom: spacing.sm,
  },
  inputIcon: { left: 12, position: "absolute", zIndex: 2 },
  inputWithIcon: {
    paddingLeft: 40,
    backgroundColor: brand.inputBg,
    borderRadius: 12,
    borderColor: brand.inputBorder,
    minHeight: 44,
    fontSize: 14,
  },
  inputWithIconRight: {
    paddingLeft: 40,
    paddingRight: 42,
    backgroundColor: brand.inputBg,
    borderRadius: 12,
    borderColor: brand.inputBorder,
    minHeight: 44,
    fontSize: 14,
  },
  eyeButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    width: 38,
    zIndex: 2,
  },

  ctaWrapper: {
    borderRadius: 12,
    shadowColor: brand.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaGradient: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
  },
  ctaText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 14,
    fontWeight: "700",
  },

  selectedIdentifierBox: {
    alignItems: "center",
    backgroundColor: brand.inputBg,
    borderColor: brand.inputBorder,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectedIdentifierLeft: { alignItems: "center", flexDirection: "row", gap: 8 },
  selectedIdentifierText: { color: brand.navy, fontFamily: fonts.bold, fontSize: 13, fontWeight: "700" },
  changeLink: { paddingHorizontal: 4, paddingVertical: 2 },
  changeLinkText: { color: brand.blueLink, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },

  createPanel: {
    alignItems: "center",
    backgroundColor: brand.inputBg,
    borderRadius: 10,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: spacing.sm,
    paddingVertical: 9,
  },
  createPanelText: { color: brand.muted, fontFamily: fonts.medium, fontSize: 12 },
  createPanelLink: { color: brand.blueLink, fontFamily: fonts.semibold, fontSize: 12, fontWeight: "600" },

  rememberRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  rememberLeft: { alignItems: "center", flexDirection: "row", gap: 6 },
  checkbox: {
    alignItems: "center",
    borderColor: brand.navy,
    borderRadius: 4,
    borderWidth: 1.5,
    height: 18,
    justifyContent: "center",
    width: 18,
  },
  checkboxOn: { backgroundColor: brand.navy },
  rememberText: { color: brand.navy, fontFamily: fonts.medium, fontSize: 12 },

  forgotButton: {
    alignItems: "center",
    minHeight: 32,
    justifyContent: "center",
    marginTop: 2,
  },
  forgotText: { color: brand.blueLink, fontFamily: fonts.semibold, fontSize: 12, fontWeight: "600" },

  featureRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    width: "92%",
    maxWidth: 420,
  },
  featureItem: { alignItems: "center", flex: 1 },
  featureIconBadge: {
    alignItems: "center",
    backgroundColor: brand.featureIconBg,
    borderRadius: 8,
    height: 26,
    justifyContent: "center",
    marginBottom: 2,
    width: 26,
  },
  featureText: {
    color: brand.muted,
    fontFamily: fonts.medium,
    fontSize: 10,
    textAlign: "center",
    lineHeight: 13,
  },
  featureDivider: {
    backgroundColor: brand.border,
    height: 20,
    width: 1,
  },
});
