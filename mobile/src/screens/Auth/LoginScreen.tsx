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
  useWindowDimensions,
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
  RecaptchaVerifier,
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

function getRecaptchaVerifier(): RecaptchaVerifier | undefined {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    if ((window as any).recaptchaVerifier) {
      return (window as any).recaptchaVerifier;
    }
    let container = document.getElementById("recaptcha-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "recaptcha-container";
      document.body.appendChild(container);
    }
    const verifier = new RecaptchaVerifier(firebaseAuth, "recaptcha-container", {
      size: "invisible",
    });
    (window as any).recaptchaVerifier = verifier;
    return verifier;
  }
  return undefined;
}

export default function LoginScreen() {
  const dispatch = useAppDispatch();
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
      const verifier = getRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(firebaseAuth, toE164(identifier), verifier as any);
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

  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 860;

  function renderFormSteps() {
    return (
      <>
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
      </>
    );
  }

  function renderTrustBar() {
    return (
      <View style={styles.featureRow}>
        <View style={styles.featureItem}>
          <View style={styles.featureIconBadge}>
            <Ionicons color={brand.orange} name="shield-checkmark" size={16} />
          </View>
          <Text style={styles.featureTitle}>Safe & Secure</Text>
          <Text style={styles.featureSubtitle}>Bank-grade privacy</Text>
        </View>
        <View style={styles.featureDivider} />
        <View style={styles.featureItem}>
          <View style={styles.featureIconBadge}>
            <Ionicons color={brand.orange} name="flash" size={16} />
          </View>
          <Text style={styles.featureTitle}>Fast Access</Text>
          <Text style={styles.featureSubtitle}>Instant OTP login</Text>
        </View>
        <View style={styles.featureDivider} />
        <View style={styles.featureItem}>
          <View style={styles.featureIconBadge}>
            <Ionicons color={brand.orange} name="cube" size={16} />
          </View>
          <Text style={styles.featureTitle}>Manage Stock</Text>
          <Text style={styles.featureSubtitle}>Live inventory</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      {isDesktop ? (
        /* ================= DESKTOP SPLIT VIEW (100% Full Viewport) ================= */
        <View style={styles.desktopContainer}>
          {/* Left Column: Full-Height Hero Showcase */}
          <View style={styles.desktopHeroColumn}>
            <Image
              resizeMode="cover"
              source={require("../../../assets/hero.jpeg")}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={["rgba(13, 54, 102, 0.82)", "rgba(13, 54, 102, 0.45)", "rgba(13, 54, 102, 0.94)"]}
              locations={[0, 0.45, 1]}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.desktopHeroContent}>
              {/* Brand Header */}
              <View style={styles.desktopBrandHeader}>
                <View style={styles.desktopLogoBadge}>
                  <Ionicons color="#FFFFFF" name="storefront" size={26} />
                </View>
                <View>
                  <Text style={styles.desktopBrandTitle}>Kadai Kanakku</Text>
                  <Text style={styles.desktopBrandTagline}>Smart Retail POS & Billing</Text>
                </View>
              </View>

              {/* Value Proposition */}
              <View style={styles.desktopHeroCenter}>
                <Text style={styles.desktopHeroSlogan}>
                  Smart Retail POS & Billing Platform
                </Text>
                <Svg height="10" width="130" viewBox="0 0 130 10" style={{ marginTop: 8, marginBottom: 14 }}>
                  <Path d="M 4 3 Q 65 9 126 3" fill="none" stroke={brand.orange} strokeWidth="3.5" strokeLinecap="round" />
                </Svg>
                <Text style={styles.desktopHeroDescription}>
                  Manage billing, barcode scanner, live stock alerts, customer khata, and daily profit totals seamlessly from your phone or desktop.
                </Text>
              </View>

              {/* Bottom Trust Cards on Left Showcase */}
              <View style={styles.desktopTrustRow}>
                <View style={styles.desktopTrustCard}>
                  <View style={styles.featureIconBadge}>
                    <Ionicons color={brand.orange} name="shield-checkmark" size={17} />
                  </View>
                  <Text style={styles.desktopTrustTitle}>Safe & Secure</Text>
                  <Text style={styles.desktopTrustSubtitle}>Encrypted cloud store</Text>
                </View>

                <View style={styles.desktopTrustCard}>
                  <View style={styles.featureIconBadge}>
                    <Ionicons color={brand.orange} name="flash" size={17} />
                  </View>
                  <Text style={styles.desktopTrustTitle}>Fast Access</Text>
                  <Text style={styles.desktopTrustSubtitle}>1-Click instant login</Text>
                </View>

                <View style={styles.desktopTrustCard}>
                  <View style={styles.featureIconBadge}>
                    <Ionicons color={brand.orange} name="cube" size={17} />
                  </View>
                  <Text style={styles.desktopTrustTitle}>Manage Stock</Text>
                  <Text style={styles.desktopTrustSubtitle}>Realtime inventory</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Right Column: Centered Form Card */}
          <View style={styles.desktopFormColumn}>
            <ScrollView
              contentContainerStyle={styles.desktopFormScroll}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {step !== "identifier" && (
                <Pressable onPress={goBack} style={styles.desktopBackRow}>
                  <Ionicons color={brand.navy} name="arrow-back" size={16} />
                  <Text style={styles.desktopBackText}>Back to Mobile / Email</Text>
                </Pressable>
              )}

              <View style={styles.desktopCard}>
                <View style={styles.stepHeaderRow}>
                  <StepBadge n={stepCopy.n} />
                  <Text style={styles.cardTitle}>{stepCopy.title}</Text>
                  <Text style={styles.cardHint}>{stepCopy.hint}</Text>
                </View>

                {renderFormSteps()}
              </View>

              {/* Trust Bar below form */}
              {renderTrustBar()}

              <Text style={styles.footerNote}>© 2026 Kadai Kanakku · Retail POS & Store Management</Text>
            </ScrollView>
          </View>
        </View>
      ) : (
        /* ================= MOBILE VIEW (Full Height Scrollable) ================= */
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Storefront Banner */}
            <View style={styles.heroWrapper}>
              <Image
                resizeMode="cover"
                source={require("../../../assets/hero.jpeg")}
                style={styles.heroImage}
              />
              <LinearGradient
                colors={["rgba(13,54,102,0.35)", "rgba(13,54,102,0.02)", "rgba(254,245,233,0.85)", brand.cream]}
                locations={[0, 0.45, 0.88, 1]}
                style={StyleSheet.absoluteFill}
              />
              {step !== "identifier" && (
                <View style={styles.floatingTopBar}>
                  <Pressable onPress={goBack} style={styles.topBackPill}>
                    <Ionicons color="#FFFFFF" name="arrow-back" size={16} />
                    <Text style={styles.topBackPillText}>Back</Text>
                  </Pressable>
                </View>
              )}
              <Svg height="24" style={styles.heroWave} viewBox="0 0 400 24" width="100%">
                <Path d="M0 24 Q 100 0 200 10 Q 300 20 400 4 L400 24 Z" fill={brand.cream} />
              </Svg>
            </View>

            {/* Brand Identity Block */}
            <View style={styles.brandBlock}>
              <View style={styles.logoBadgeGlow}>
                <View style={styles.logoBadge}>
                  <Ionicons color="#FFFFFF" name="storefront" size={24} />
                </View>
              </View>
              <Text style={styles.brand}>Kadai Kanakku</Text>
              <Text style={styles.subtitle}>
                Smart Retail POS & Store Management
              </Text>
            </View>

            {/* Primary Form Card */}
            <View style={styles.card}>
              <View style={styles.stepHeaderRow}>
                <StepBadge n={stepCopy.n} />
                <Text style={styles.cardTitle}>{stepCopy.title}</Text>
                <Text style={styles.cardHint}>{stepCopy.hint}</Text>
              </View>

              {renderFormSteps()}
            </View>

            {/* Trust Bar */}
            {renderTrustBar()}

            <Text style={styles.footerNote}>© 2026 Kadai Kanakku · Retail POS & Store Management</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

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

  /* ================= DESKTOP STYLES ================= */
  desktopContainer: {
    flex: 1,
    flexDirection: "row",
    height: "100%",
    minHeight: "100vh" as any,
    width: "100%",
    backgroundColor: brand.cream,
  },
  desktopHeroColumn: {
    flex: 1.15,
    height: "100%",
    position: "relative",
    overflow: "hidden",
    backgroundColor: brand.navy,
  },
  desktopHeroContent: {
    flex: 1,
    padding: 48,
    justifyContent: "space-between",
    zIndex: 10,
  },
  desktopBrandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  desktopLogoBadge: {
    alignItems: "center",
    backgroundColor: brand.navy,
    borderRadius: 14,
    height: 52,
    justifyContent: "center",
    width: 52,
    borderWidth: 2,
    borderColor: brand.orange,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  desktopBrandTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.extraBold,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  desktopBrandTagline: {
    color: "#E2E8F0",
    fontFamily: fonts.medium,
    fontSize: 13,
    marginTop: 2,
  },
  desktopHeroCenter: {
    marginVertical: 24,
    maxWidth: 520,
  },
  desktopHeroSlogan: {
    color: "#FFFFFF",
    fontFamily: fonts.extraBold,
    fontSize: 32,
    lineHeight: 42,
    letterSpacing: -0.5,
  },
  desktopHeroDescription: {
    color: "#CBD5E1",
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
  },
  desktopTrustRow: {
    flexDirection: "row",
    gap: 12,
  },
  desktopTrustCard: {
    flex: 1,
    backgroundColor: "rgba(13, 54, 102, 0.75)",
    borderColor: "rgba(245, 153, 38, 0.35)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  desktopTrustTitle: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 6,
    marginBottom: 2,
  },
  desktopTrustSubtitle: {
    color: "#94A3B8",
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 14,
  },
  desktopFormColumn: {
    flex: 1,
    height: "100%",
    backgroundColor: brand.cream,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  desktopFormScroll: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingVertical: 32,
  },
  desktopBackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "center",
    marginBottom: 12,
    width: "100%",
    maxWidth: 440,
  },
  desktopBackText: {
    color: brand.navy,
    fontFamily: fonts.bold,
    fontSize: 14,
    fontWeight: "700",
  },
  desktopCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 36,
    paddingVertical: 36,
    width: "100%",
    maxWidth: 520,
    shadowColor: "#0D3666",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 6,
  },

  /* ================= MOBILE STYLES ================= */

  heroWrapper: {
    height: 220,
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },
  heroImage: { height: "100%", width: "100%" },
  floatingTopBar: {
    position: "absolute",
    top: Platform.OS === "android" ? 14 : 10,
    left: 14,
    zIndex: 20,
  },
  topBackPill: {
    alignItems: "center",
    backgroundColor: "rgba(13, 54, 102, 0.78)",
    borderRadius: 20,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  topBackPillText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 13, fontWeight: "700" },
  heroWave: {
    bottom: -1,
    position: "absolute",
  },

  brandBlock: {
    alignItems: "center",
    marginTop: -28,
    marginBottom: 10,
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
    fontFamily: fonts.medium,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
    textAlign: "center",
    lineHeight: 16,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 26,
    marginTop: 14,
    width: "92%",
    maxWidth: 440,
    shadowColor: "#0D3666",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
  },

  stepHeaderRow: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  stepBadge: {
    alignItems: "center",
    backgroundColor: brand.orange,
    borderRadius: 999,
    height: 30,
    justifyContent: "center",
    marginBottom: 8,
    width: 30,
    shadowColor: brand.orange,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  stepBadgeText: { color: "#FDFCF9", fontFamily: fonts.bold, fontSize: 14 },
  cardTitle: {
    color: brand.navy,
    fontFamily: fonts.extraBold,
    fontSize: 18,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  cardHint: {
    color: brand.muted,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    textAlign: "center",
  },

  stepBody: { marginTop: 4 },

  label: {
    color: brand.muted,
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 6,
  },

  phoneInputContainer: {
    alignItems: "center",
    backgroundColor: brand.inputBg,
    borderColor: brand.inputBorder,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 50,
    paddingHorizontal: 12,
    marginBottom: spacing.md,
  },
  countryPickerBox: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  flagEmoji: { fontSize: 18, marginRight: 2 },
  countryCodeText: { color: brand.navy, fontFamily: fonts.bold, fontSize: 15, fontWeight: "700" },
  phoneInputDivider: {
    backgroundColor: brand.border,
    height: 24,
    marginHorizontal: 10,
    width: 1,
  },
  phoneTextInput: {
    color: brand.navy,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    minHeight: 46,
    paddingVertical: 0,
  },

  inputWrap: {
    justifyContent: "center",
    position: "relative",
    marginBottom: spacing.md,
  },
  inputIcon: { left: 14, position: "absolute", zIndex: 2 },
  inputWithIcon: {
    paddingLeft: 44,
    backgroundColor: brand.inputBg,
    borderRadius: 14,
    borderColor: brand.inputBorder,
    minHeight: 50,
    fontSize: 15,
  },
  inputWithIconRight: {
    paddingLeft: 44,
    paddingRight: 46,
    backgroundColor: brand.inputBg,
    borderRadius: 14,
    borderColor: brand.inputBorder,
    minHeight: 50,
    fontSize: 15,
  },
  eyeButton: {
    alignItems: "center",
    height: 50,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    width: 42,
    zIndex: 2,
  },

  ctaWrapper: {
    borderRadius: 14,
    shadowColor: brand.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  ctaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  ctaGradient: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
  },
  ctaText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 16,
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
    backgroundColor: "#FFFFFF",
    borderColor: brand.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 12,
    width: "92%",
    maxWidth: 520,
    shadowColor: brand.navy,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  featureItem: { alignItems: "center", flex: 1, paddingHorizontal: 2 },
  featureIconBadge: {
    alignItems: "center",
    backgroundColor: brand.featureIconBg,
    borderRadius: 10,
    height: 30,
    justifyContent: "center",
    marginBottom: 4,
    width: 30,
  },
  featureTitle: {
    color: brand.navy,
    fontFamily: fonts.bold,
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
  },
  featureSubtitle: {
    color: brand.muted,
    fontFamily: fonts.regular,
    fontSize: 9.5,
    textAlign: "center",
    marginTop: 1,
    lineHeight: 12,
  },
  featureDivider: {
    backgroundColor: brand.border,
    height: 28,
    width: 1,
  },
  footerNote: {
    color: brand.muted,
    fontFamily: fonts.medium,
    fontSize: 11,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
});
