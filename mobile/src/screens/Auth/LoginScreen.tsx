
import { useMutation } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Image } from "expo-image";
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
import {
  apiErrorMessage,
  AuthLookupResult,
  firebaseLogin,
  lookupAccount,
} from "../../services/api";
import {
  showErrorToast,
  showSuccessToast,
  toastConfig,
} from "../../utils/toast";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { Ionicons } from "@expo/vector-icons";

type AuthStep =
  | "identifier"
  | "email-password"
  | "email-register"
  | "otp"
  | "phone-register";

const brand = {
  navy: "#0D3666",
  navyDark: "#09294E",
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
  return (
    (error as Error)?.message?.replace(/^Firebase:\s*/, "") ||
    "Something went wrong"
  );
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
      accessibilityState={{
        busy: Boolean(loading),
        disabled: Boolean(loading),
      }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.ctaWrapper,
        pressed && styles.ctaPressed,
      ]}
    >
      <LinearGradient
        colors={["#17558F", brand.navy]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.ctaGradient}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons color="#FFFFFF" name={icon} size={19} />
            <Text style={styles.ctaText}>{title}</Text>
          </>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const recaptchaVerifier =
    useRef<FirebaseRecaptchaVerifierModal>(null);
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

  const accountEmail =
    lookup?.kind === "email" ? identifier.trim().toLowerCase() : "";

  const stepCopy = useMemo(() => {
    if (step === "identifier")
      return {
        n: 1,
        title: "Enter Mobile Number",
        hint: "We'll send you a secure OTP to continue.",
      };

    if (step === "email-password")
      return {
        n: 2,
        title: lookup?.nameHint
          ? `Welcome back, ${lookup.nameHint}`
          : "Enter Password",
        hint: "Login to your account",
      };

    if (step === "email-register")
      return {
        n: 2,
        title: "Create shop account",
        hint: "Soft signup — just a few details to get started.",
      };

    if (step === "otp")
      return {
        n: 2,
        title: "Enter OTP",
        hint: `We've sent a code to ${identifier.trim()}`,
      };

    return {
      n: 2,
      title: "Almost there",
      hint: "Tell us a bit about your shop.",
    };
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

  async function finalizeLogin(
    idToken: string,
    nameValue?: string,
    businessNameValue?: string
  ) {
    const data = await firebaseLogin(
      idToken,
      nameValue,
      businessNameValue
    );
    dispatch(setCredentials(data));
  }

  const sendOtp = useMutation({
    mutationFn: async () => {
      const verifier = recaptchaVerifier.current;
      if (!verifier)
        throw new Error("Verification is not ready. Try again.");

      const confirmation = await signInWithPhoneNumber(
        firebaseAuth,
        toE164(identifier),
        verifier
      );

      confirmationRef.current = confirmation;
    },
    onSuccess: () => {
      setOtpCode("");
      setStep("otp");
    },
    onError: (error) =>
      showErrorToast(
        firebaseErrorMessage(error),
        "Could not send OTP"
      ),
  });

  const checkAccount = useMutation({
    mutationFn: () => lookupAccount(identifier.trim()),
    onSuccess: (data) => {
      setLookup(data);
      setPassword("");
      setConfirmPassword("");

      if (data.kind === "email") {
        setStep(
          data.exists ? "email-password" : "email-register"
        );
      } else {
        sendOtp.mutate();
      }
    },
    onError: (error: Error) =>
      showErrorToast(apiErrorMessage(error), "Check failed"),
  });

  const confirmOtp = useMutation({
    mutationFn: async () => {
      if (!confirmationRef.current)
        throw new Error("Request a new OTP.");

      const credential = await confirmationRef.current.confirm(
        otpCode.trim()
      );

      return credential.user.getIdToken();
    },
    onSuccess: async (idToken) => {
      if (lookup?.exists) {
        try {
          await finalizeLogin(idToken);
        } catch (error) {
          showErrorToast(
            apiErrorMessage(error),
            "Login failed"
          );
        }
      } else {
        pendingIdTokenRef.current = idToken;
        setStep("phone-register");
      }
    },
    onError: (error) =>
      showErrorToast(
        firebaseErrorMessage(error),
        "Verification failed"
      ),
  });

  const emailSignIn = useMutation({
    mutationFn: async () => {
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        identifier.trim().toLowerCase(),
        password
      );

      const idToken = await credential.user.getIdToken();
      await finalizeLogin(idToken);
    },
    onError: (error) =>
      showErrorToast(
        firebaseErrorMessage(error),
        "Login failed"
      ),
  });

  const emailRegister = useMutation({
    mutationFn: async () => {
      const credential = await createUserWithEmailAndPassword(
        firebaseAuth,
        identifier.trim().toLowerCase(),
        password
      );

      const idToken = await credential.user.getIdToken();

      await finalizeLogin(
        idToken,
        name.trim(),
        businessName.trim() || undefined
      );
    },
    onSuccess: () =>
      showSuccessToast("Shop ready", "Welcome aboard"),
    onError: (error) =>
      showErrorToast(
        firebaseErrorMessage(error),
        "Signup failed"
      ),
  });

  const phoneRegister = useMutation({
    mutationFn: async () => {
      if (!pendingIdTokenRef.current)
        throw new Error(
          "Session expired. Verify your mobile again."
        );

      await finalizeLogin(
        pendingIdTokenRef.current,
        name.trim(),
        businessName.trim() || undefined
      );
    },
    onSuccess: () =>
      showSuccessToast("Shop ready", "Welcome aboard"),
    onError: (error: Error) =>
      showErrorToast(
        apiErrorMessage(error),
        "Signup failed"
      ),
  });

  function submitIdentifier() {
    const value = identifier.trim();

    if (!value)
      return Alert.alert(
        "Required",
        "Enter your email or mobile number."
      );

    if (!isEmail(value) && !isPhone(value)) {
      return Alert.alert(
        "Invalid",
        "Use a valid email or 10-digit mobile number."
      );
    }

    checkAccount.mutate();
  }

  function submitEmailPassword() {
    if (password.length < 6)
      return Alert.alert(
        "Password",
        "Enter your password."
      );

    emailSignIn.mutate();
  }

  function submitEmailRegister() {
    if (!name.trim())
      return Alert.alert(
        "Name required",
        "Enter your name."
      );

    if (password.length < 6)
      return Alert.alert(
        "Weak password",
        "Password must be at least 6 characters."
      );

    if (password !== confirmPassword)
      return Alert.alert(
        "Mismatch",
        "Passwords do not match."
      );

    emailRegister.mutate();
  }

  function submitOtp() {
    if (otpCode.trim().length < 6)
      return Alert.alert(
        "OTP",
        "Enter the 6-digit code."
      );

    confirmOtp.mutate();
  }

  function submitPhoneRegister() {
    if (!name.trim())
      return Alert.alert(
        "Name required",
        "Enter your name."
      );

    phoneRegister.mutate();
  }

  function closeReset() {
    setResetOpen(false);
    setResetSent(false);
    setResetEmail("");
  }

  const requestReset = useMutation({
    mutationFn: () =>
      sendPasswordResetEmail(
        firebaseAuth,
        resetEmail.trim().toLowerCase()
      ),
    onSuccess: () => {
      setResetSent(true);
      showSuccessToast(
        "Check your email",
        "We sent a password reset link."
      );
    },
    onError: (error) =>
      showErrorToast(
        firebaseErrorMessage(error),
        "Request failed"
      ),
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
        behavior={
          Platform.OS === "ios" ? "padding" : undefined
        }
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back button */}
          <View style={styles.topBar}>
            {step !== "identifier" ? (
              <Pressable
                onPress={goBack}
                style={styles.topBackRow}
              >
                <Ionicons
                  color="#FFFFFF"
                  name="arrow-back"
                  size={18}
                />
                <Text style={styles.topBackText}>
                  Back
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* =====================================================
              LARGE FULL-WIDTH SHOP HERO
              ===================================================== */}
          <View style={styles.heroWrapper}>
            <Image
              source={require("../../../assets/hero.jpeg")}
              style={styles.heroImage}
              contentFit="cover"
              contentPosition="top center"
              transition={250}
            />

            {/* Soft bottom fade — image remains visually dominant */}
            <LinearGradient
              colors={[
                "rgba(254,245,233,0)",
                "rgba(254,245,233,0.02)",
                "rgba(254,245,233,0.20)",
                "rgba(254,245,233,0.90)",
              ]}
              locations={[0, 0.55, 0.78, 1]}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />

            {/* Bottom curved transition */}
            <Svg
              height="42"
              style={styles.heroWave}
              viewBox="0 0 400 42"
              width="100%"
            >
              <Path
                d="M0 42 Q 80 13 170 25 Q 270 38 400 8 L400 42 Z"
                fill={brand.cream}
              />
            </Svg>
          </View>

          {/* =====================================================
              BRAND / LOGO
              ===================================================== */}
          <View style={styles.brandBlock}>
            <View style={styles.logoBadgeGlow}>
              <View style={styles.logoBadge}>
                <Ionicons
                  color="#FFFFFF"
                  name="home"
                  size={32}
                />
              </View>
            </View>

            <Text style={styles.brand}>
              <Text style={styles.brandDark}>
                Kadai{" "}
              </Text>
              <Text style={styles.brandOrange}>
                Kanakku
              </Text>
            </Text>

            <Text style={styles.subtitle}>
              Ungal Nambikkai, Engal Kadamai
            </Text>

            <View style={styles.brandUnderline} />
          </View>

          {/* =====================================================
              LOGIN CARD
              ===================================================== */}
          <View style={styles.card}>
            <View style={styles.stepHeaderRow}>
              <StepBadge n={stepCopy.n} />

              <View style={styles.stepHeaderText}>
                <Text style={styles.cardTitle}>
                  {stepCopy.title}
                </Text>

                <Text style={styles.cardHint}>
                  {stepCopy.hint}
                </Text>
              </View>
            </View>

            {/* STEP 1 */}
            {step === "identifier" && (
              <View style={styles.stepBody}>
                <View style={styles.phoneInputContainer}>
                  <View style={styles.countryPickerBox}>
                    <View
                      style={styles.indiaFlag}
                      accessible
                      accessibilityLabel="India"
                    >
                      <View
                        style={[
                          styles.flagStripe,
                          styles.flagSaffron,
                        ]}
                      />

                      <View
                        style={[
                          styles.flagStripe,
                          styles.flagWhite,
                        ]}
                      >
                        <View style={styles.flagChakra}>
                          <View
                            style={styles.flagChakraDot}
                          />
                        </View>
                      </View>

                      <View
                        style={[
                          styles.flagStripe,
                          styles.flagGreen,
                        ]}
                      />
                    </View>

                    <Text style={styles.countryCodeText}>
                      +91
                    </Text>

                    <Ionicons
                      color={brand.muted}
                      name="chevron-down"
                      size={13}
                      style={{ marginLeft: 2 }}
                    />
                  </View>

                  <View
                    style={styles.phoneInputDivider}
                  />

                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="phone-pad"
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
                  loading={
                    checkAccount.isPending ||
                    sendOtp.isPending
                  }
                  onPress={submitIdentifier}
                  title="Send OTP"
                />
              </View>
            )}

            {/* EMAIL PASSWORD */}
            {step === "email-password" && (
              <View style={styles.stepBody}>
                <View
                  style={styles.selectedIdentifierBox}
                >
                  <View
                    style={styles.selectedIdentifierLeft}
                  >
                    <Ionicons
                      color={brand.navy}
                      name="mail-outline"
                      size={18}
                    />

                    <Text
                      style={styles.selectedIdentifierText}
                    >
                      {identifier.trim()}
                    </Text>
                  </View>

                  <Pressable
                    onPress={goBack}
                    style={styles.changeLink}
                  >
                    <Text
                      style={styles.changeLinkText}
                    >
                      Change
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.inputWrap}>
                  <Ionicons
                    color={brand.muted}
                    name="lock-closed-outline"
                    size={18}
                    style={styles.inputIcon}
                  />

                  <Field
                    autoComplete="password"
                    onChangeText={setPassword}
                    onSubmitEditing={
                      submitEmailPassword
                    }
                    placeholder="Enter your password"
                    secureTextEntry={!showPassword}
                    style={styles.inputWithIconRight}
                    value={password}
                  />

                  <Pressable
                    accessibilityLabel={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    onPress={() =>
                      setShowPassword((v) => !v)
                    }
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      color={brand.muted}
                      name={
                        showPassword
                          ? "eye-off-outline"
                          : "eye-outline"
                      }
                      size={18}
                    />
                  </Pressable>
                </View>

                <View style={styles.rememberRow}>
                  <Pressable
                    onPress={() =>
                      setRememberMe((v) => !v)
                    }
                    style={styles.rememberLeft}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        rememberMe &&
                          styles.checkboxOn,
                      ]}
                    >
                      {rememberMe && (
                        <Ionicons
                          color="#FFFFFF"
                          name="checkmark"
                          size={11}
                        />
                      )}
                    </View>

                    <Text style={styles.rememberText}>
                      Remember me
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setResetEmail(
                        accountEmail || identifier
                      );
                      setResetSent(false);
                      setResetOpen(true);
                    }}
                  >
                    <Text style={styles.forgotText}>
                      Forgot password?
                    </Text>
                  </Pressable>
                </View>

                <PrimaryCTA
                  icon="log-in-outline"
                  loading={emailSignIn.isPending}
                  onPress={submitEmailPassword}
                  title="Login"
                />

                <Pressable
                  onPress={goBack}
                  style={styles.createPanel}
                >
                  <Text style={styles.createPanelText}>
                    Don't have an account?
                  </Text>

                  <Text style={styles.createPanelLink}>
                    Create one →
                  </Text>
                </Pressable>
              </View>
            )}

            {/* EMAIL REGISTER */}
            {step === "email-register" && (
              <View style={styles.stepBody}>
                <View
                  style={styles.selectedIdentifierBox}
                >
                  <View
                    style={styles.selectedIdentifierLeft}
                  >
                    <Ionicons
                      color={brand.navy}
                      name="person-add-outline"
                      size={16}
                    />

                    <Text
                      style={styles.selectedIdentifierText}
                    >
                      New shop · {identifier.trim()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.label}>
                  Your name
                </Text>

                <Field
                  onChangeText={setName}
                  placeholder="Owner name"
                  value={name}
                />

                <Text style={styles.label}>
                  Shop name
                </Text>

                <Field
                  onChangeText={setBusinessName}
                  placeholder="e.g. Metro Mobiles"
                  value={businessName}
                />

                <Text style={styles.label}>
                  Create password
                </Text>

                <View style={styles.inputWrap}>
                  <Ionicons
                    color={brand.muted}
                    name="lock-closed-outline"
                    size={18}
                    style={styles.inputIcon}
                  />

                  <Field
                    onChangeText={setPassword}
                    placeholder="Min 6 characters"
                    secureTextEntry={!showPassword}
                    style={styles.inputWithIconRight}
                    value={password}
                  />

                  <Pressable
                    onPress={() =>
                      setShowPassword((v) => !v)
                    }
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      color={brand.muted}
                      name={
                        showPassword
                          ? "eye-off-outline"
                          : "eye-outline"
                      }
                      size={18}
                    />
                  </Pressable>
                </View>

                <Text style={styles.label}>
                  Confirm password
                </Text>

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

            {/* OTP */}
            {step === "otp" && (
              <View style={styles.stepBody}>
                <View
                  style={styles.selectedIdentifierBox}
                >
                  <View
                    style={styles.selectedIdentifierLeft}
                  >
                    <Ionicons
                      color={brand.navy}
                      name="call-outline"
                      size={16}
                    />

                    <Text
                      style={styles.selectedIdentifierText}
                    >
                      {identifier.trim()}
                    </Text>
                  </View>

                  <Pressable
                    onPress={goBack}
                    style={styles.changeLink}
                  >
                    <Text
                      style={styles.changeLinkText}
                    >
                      Change
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.inputWrap}>
                  <Ionicons
                    color={brand.muted}
                    name="keypad-outline"
                    size={18}
                    style={styles.inputIcon}
                  />

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

                <Pressable
                  onPress={() => sendOtp.mutate()}
                  style={styles.forgotButton}
                >
                  <Text style={styles.forgotText}>
                    {sendOtp.isPending
                      ? "Sending..."
                      : "Resend code"}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* PHONE REGISTER */}
            {step === "phone-register" && (
              <View style={styles.stepBody}>
                <View
                  style={styles.selectedIdentifierBox}
                >
                  <View
                    style={styles.selectedIdentifierLeft}
                  >
                    <Ionicons
                      color={brand.navy}
                      name="person-add-outline"
                      size={16}
                    />

                    <Text
                      style={styles.selectedIdentifierText}
                    >
                      New shop · {identifier.trim()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.label}>
                  Your name
                </Text>

                <Field
                  onChangeText={setName}
                  placeholder="Owner name"
                  value={name}
                />

                <Text style={styles.label}>
                  Shop name
                </Text>

                <Field
                  onChangeText={setBusinessName}
                  placeholder="e.g. Metro Mobiles"
                  value={businessName}
                />

                <PrimaryCTA
                  icon="checkmark-circle-outline"
                  loading={phoneRegister.isPending}
                  onPress={submitPhoneRegister}
                  title="Create account & enter"
                />
              </View>
            )}
          </View>

          {/* =====================================================
              TRUST / BENEFITS
              ===================================================== */}
          <View style={styles.featureCard}>
            <View style={styles.featureItem}>
              <View style={styles.featureIconBadge}>
                <Ionicons
                  color={brand.orange}
                  name="shield-checkmark"
                  size={16}
                />
              </View>

              <Text style={styles.featureText}>
                Safe & Secure
              </Text>

              <Text style={styles.featureSubText}>
                Your data is protected
              </Text>
            </View>

            <View style={styles.featureDivider} />

            <View style={styles.featureItem}>
              <View style={styles.featureIconBadge}>
                <Ionicons
                  color={brand.orange}
                  name="flash"
                  size={16}
                />
              </View>

              <Text style={styles.featureText}>
                Fast Access
              </Text>

              <Text style={styles.featureSubText}>
                Quick & Easy
              </Text>
            </View>

            <View style={styles.featureDivider} />

            <View style={styles.featureItem}>
              <View style={styles.featureIconBadge}>
                <Ionicons
                  color={brand.orange}
                  name="cube-outline"
                  size={16}
                />
              </View>

              <Text style={styles.featureText}>
                Wide Range
              </Text>

              <Text style={styles.featureSubText}>
                All Your Needs
              </Text>
            </View>

            <View style={styles.featureDivider} />

            <View style={styles.featureItem}>
              <View style={styles.featureIconBadge}>
                <Ionicons
                  color={brand.orange}
                  name="headset"
                  size={16}
                />
              </View>

              <Text style={styles.featureText}>
                Support
              </Text>

              <Text style={styles.featureSubText}>
                We're Here
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footerWave}>
            <Svg
              height="58"
              viewBox="0 0 400 58"
              width="100%"
            >
              <Path
                d="M0 22 Q 75 48 155 23 Q 250 -5 400 22 L400 58 L0 58 Z"
                fill={brand.navy}
              />

              <Path
                d="M0 21 Q 75 47 155 22 Q 250 -6 400 21"
                fill="none"
                stroke={brand.orange}
                strokeWidth="4"
              />
            </Svg>

            <View style={styles.footerTextRow}>
              <Text style={styles.footerFlourish}>
                »
              </Text>

              <Text style={styles.footerText}>
                Shop Smart
              </Text>

              <Text style={styles.footerFlourish}>
                «
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Reset Password */}
      <Sheet
        hint={
          resetSent
            ? "Check your inbox for the reset link"
            : "We'll email a reset link to your inbox"
        }
        icon="key-outline"
        onClose={closeReset}
        title="Reset password"
        visible={resetOpen}
        footer={
          resetSent ? (
            <Button
              onPress={closeReset}
              title="Done"
            />
          ) : (
            <Button
              loading={requestReset.isPending}
              onPress={() => {
                if (!isEmail(resetEmail))
                  return Alert.alert(
                    "Email",
                    "Enter a valid email."
                  );

                requestReset.mutate();
              }}
              title="Send reset link"
            />
          )
        }
      >
        {!resetSent ? (
          <>
            <Text style={styles.label}>
              Email
            </Text>

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
  safeArea: {
    flex: 1,
    backgroundColor: brand.cream,
  },

  container: {
    flex: 1,
    backgroundColor: brand.cream,
  },

  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingBottom: 0,
  },

  /* ---------------------------------------------------------
     TOP BAR
     --------------------------------------------------------- */
  topBar: {
    width: "100%",
    maxWidth: 460,
    paddingHorizontal: spacing.md,
    paddingTop:
      Platform.OS === "android" ? spacing.xs : 0,
    zIndex: 30,
    minHeight: 36,
    justifyContent: "center",
    position: "absolute",
  },

  topBackRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignSelf: "flex-start",
  },

  topBackText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 13,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  /* ---------------------------------------------------------
     LARGE HERO
     --------------------------------------------------------- */
  heroWrapper: {
    width: "100%",
    height: Platform.OS === "web" ? 310 : 285,
    position: "relative",
    overflow: "hidden",
    backgroundColor: "#F5EBDD",
  },

  heroImage: {
    width: "100%",
    height: "100%",
  },

  heroWave: {
    bottom: -1,
    position: "absolute",
  },

  /* ---------------------------------------------------------
     BRAND
     --------------------------------------------------------- */
  brandBlock: {
    alignItems: "center",
    marginTop: -42,
    paddingHorizontal: spacing.md,
    zIndex: 8,
    width: "100%",
  },

  logoBadgeGlow: {
    alignItems: "center",
    backgroundColor: "rgba(245, 153, 38, 0.22)",
    borderRadius: 38,
    height: 72,
    justifyContent: "center",
    marginBottom: 5,
    width: 72,
  },

  logoBadge: {
    alignItems: "center",
    backgroundColor: brand.navy,
    borderRadius: 19,
    height: 62,
    justifyContent: "center",
    width: 62,
    borderWidth: 3,
    borderColor: "#FFFDF8",
    shadowColor: brand.navy,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 7,
  },

  brand: {
    color: brand.navy,
    fontFamily: fonts.extraBold,
    fontSize: 28,
    letterSpacing: -0.8,
    textAlign: "center",
  },

  brandDark: {
    color: brand.navy,
  },

  brandOrange: {
    color: brand.orange,
  },

  subtitle: {
    color: brand.muted,
    fontFamily: fonts.semibold,
    fontSize: 10.5,
    marginTop: 2,
    textAlign: "center",
    lineHeight: 15,
  },

  brandUnderline: {
    height: 3,
    width: 64,
    borderRadius: 2,
    backgroundColor: brand.orange,
    marginTop: 6,
  },

  /* ---------------------------------------------------------
     MAIN CARD
     --------------------------------------------------------- */
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 16,
    marginTop: 13,
    width: "92%",
    maxWidth: 430,
    borderWidth: 1,
    borderColor: "rgba(210,220,231,0.65)",
    shadowColor: brand.navy,
    shadowOffset: {
      width: 0,
      height: 9,
    },
    shadowOpacity: 0.12,
    shadowRadius: 22,
    elevation: 5,
  },

  stepHeaderRow: {
    flexDirection: "row",
    marginBottom: 13,
    alignItems: "center",
  },

  stepBadge: {
    alignItems: "center",
    backgroundColor: brand.orange,
    borderRadius: 999,
    height: 31,
    justifyContent: "center",
    marginRight: 10,
    width: 31,
    shadowColor: brand.orange,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 2,
  },

  stepBadgeText: {
    color: "#FFFFFF",
    fontFamily: fonts.extraBold,
    fontSize: 14,
  },

  stepHeaderText: {
    flex: 1,
  },

  cardTitle: {
    color: brand.navy,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    letterSpacing: -0.2,
  },

  cardHint: {
    color: brand.muted,
    fontFamily: fonts.medium,
    fontSize: 10.5,
    lineHeight: 15,
    marginTop: 2,
  },

  stepBody: {
    marginTop: 1,
  },

  /* ---------------------------------------------------------
     INPUTS
     --------------------------------------------------------- */
  label: {
    color: brand.navy,
    fontFamily: fonts.semibold,
    fontSize: 11.5,
    marginBottom: 5,
    marginTop: 5,
  },

  phoneInputContainer: {
    alignItems: "center",
    backgroundColor: "#F7FAFD",
    borderColor: "#C8D7E7",
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: "row",
    minHeight: 50,
    paddingHorizontal: 11,
    marginBottom: 11,
  },

  countryPickerBox: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },

  indiaFlag: {
    width: 22,
    height: 15,
    borderRadius: 2.5,
    overflow: "hidden",
    marginRight: 2,
    borderWidth: 0.5,
    borderColor: "#D5D5D5",
    backgroundColor: "#FFFFFF",
  },

  flagStripe: {
    flex: 1,
    width: "100%",
  },

  flagSaffron: {
    backgroundColor: "#FF9933",
  },

  flagWhite: {
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  flagGreen: {
    backgroundColor: "#138808",
  },

  flagChakra: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 0.8,
    borderColor: "#000080",
    alignItems: "center",
    justifyContent: "center",
  },

  flagChakraDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#000080",
  },

  countryCodeText: {
    color: brand.navy,
    fontFamily: fonts.bold,
    fontSize: 14,
  },

  phoneInputDivider: {
    backgroundColor: "#D6E0EA",
    height: 25,
    marginHorizontal: 9,
    width: 1,
  },

  phoneTextInput: {
    color: brand.navy,
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 14,
    minHeight: 46,
    paddingVertical: 0,
  },

  inputWrap: {
    justifyContent: "center",
    position: "relative",
    marginBottom: 10,
  },

  inputIcon: {
    left: 13,
    position: "absolute",
    zIndex: 2,
  },

  inputWithIcon: {
    paddingLeft: 42,
    backgroundColor: "#F7FAFD",
    borderRadius: 13,
    borderColor: "#C8D7E7",
    minHeight: 48,
    fontSize: 13.5,
  },

  inputWithIconRight: {
    paddingLeft: 42,
    paddingRight: 45,
    backgroundColor: "#F7FAFD",
    borderRadius: 13,
    borderColor: "#C8D7E7",
    minHeight: 48,
    fontSize: 13.5,
  },

  eyeButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    position: "absolute",
    right: 2,
    width: 40,
    zIndex: 2,
  },

  /* ---------------------------------------------------------
     CTA
     --------------------------------------------------------- */
  ctaWrapper: {
    borderRadius: 13,
    shadowColor: brand.navy,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.23,
    shadowRadius: 9,
    elevation: 4,
  },

  ctaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },

  ctaGradient: {
    alignItems: "center",
    borderRadius: 13,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 50,
  },

  ctaText: {
    color: "#FFFFFF",
    fontFamily: fonts.extraBold,
    fontSize: 14,
  },

  /* ---------------------------------------------------------
     SELECTED IDENTIFIER
     --------------------------------------------------------- */
  selectedIdentifierBox: {
    alignItems: "center",
    backgroundColor: "#F4F8FC",
    borderColor: "#D4DFEA",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 11,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  selectedIdentifierLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    flex: 1,
  },

  selectedIdentifierText: {
    color: brand.navy,
    fontFamily: fonts.bold,
    fontSize: 12.5,
    fontWeight: "700",
    flexShrink: 1,
  },

  changeLink: {
    paddingHorizontal: 5,
    paddingVertical: 3,
  },

  changeLinkText: {
    color: brand.blueLink,
    fontFamily: fonts.semibold,
    fontSize: 12.5,
  },

  /* ---------------------------------------------------------
     REMEMBER / FORGOT
     --------------------------------------------------------- */
  rememberRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  rememberLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },

  checkbox: {
    alignItems: "center",
    borderColor: brand.navy,
    borderRadius: 5,
    borderWidth: 1.5,
    height: 18,
    justifyContent: "center",
    width: 18,
  },

  checkboxOn: {
    backgroundColor: brand.navy,
  },

  rememberText: {
    color: brand.navy,
    fontFamily: fonts.medium,
    fontSize: 11.5,
  },

  forgotButton: {
    alignItems: "center",
    minHeight: 34,
    justifyContent: "center",
    marginTop: 2,
  },

  forgotText: {
    color: brand.blueLink,
    fontFamily: fonts.semibold,
    fontSize: 11.5,
  },

  createPanel: {
    alignItems: "center",
    backgroundColor: "#F4F8FC",
    borderRadius: 11,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 10,
  },

  createPanelText: {
    color: brand.muted,
    fontFamily: fonts.medium,
    fontSize: 11.5,
  },

  createPanelLink: {
    color: brand.blueLink,
    fontFamily: fonts.semibold,
    fontSize: 11.5,
  },

  /* ---------------------------------------------------------
     FEATURES
     --------------------------------------------------------- */
  featureCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.68)",
    borderColor: "rgba(210,220,231,0.55)",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 13,
    paddingVertical: 12,
    paddingHorizontal: 5,
    width: "92%",
    maxWidth: 430,
  },

  featureItem: {
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },

  featureIconBadge: {
    alignItems: "center",
    backgroundColor: brand.featureIconBg,
    borderRadius: 10,
    height: 31,
    justifyContent: "center",
    marginBottom: 4,
    width: 31,
  },

  featureText: {
    color: brand.navy,
    fontFamily: fonts.bold,
    fontSize: 9.5,
    textAlign: "center",
    lineHeight: 12,
  },

  featureSubText: {
    color: brand.muted,
    fontFamily: fonts.medium,
    fontSize: 7.5,
    textAlign: "center",
    lineHeight: 10,
    marginTop: 1,
  },

  featureDivider: {
    backgroundColor: "#D8E1EA",
    height: 32,
    width: 1,
  },

  /* ---------------------------------------------------------
     FOOTER
     --------------------------------------------------------- */
  footerWave: {
    width: "100%",
    height: 58,
    marginTop: 9,
    position: "relative",
    overflow: "hidden",
  },

  footerTextRow: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  footerText: {
    color: "#FFFFFF",
    fontFamily: fonts.extraBold,
    fontSize: 13,
    letterSpacing: 0.3,
  },

  footerFlourish: {
    color: brand.orange,
    fontFamily: fonts.bold,
    fontSize: 12,
  },
});