import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  white: "#FFFFFF",
  muted: "#5E748B",
  border: "#D2DCE7",
  inputBorder: "#C5D3E1",
  inputBg: "#F3F7FC",
  featureIconBg: "#FFEBC8",
  blueLink: "#0066CC",
};

const fonts = {
  regular: Platform.select({
    web: "'Nunito Sans', 'Inter', sans-serif",
    default: "NunitoSans_400Regular",
  }),
  semibold: Platform.select({
    web: "'Nunito Sans', 'Inter', sans-serif",
    default: "NunitoSans_600SemiBold",
  }),
  bold: Platform.select({
    web: "'Nunito Sans', 'Inter', sans-serif",
    default: "NunitoSans_700Bold",
  }),
  extraBold: Platform.select({
    web: "'Nunito Sans', 'Inter', sans-serif",
    default: "NunitoSans_800ExtraBold",
  }),
  medium: Platform.select({
    web: "'Nunito Sans', 'Inter', sans-serif",
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

  if (value.trim().startsWith("+")) {
    return `+${digits}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  return `+${digits}`;
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

  if (code && map[code]) {
    return map[code];
  }

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
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.ctaWrapper,
        pressed && styles.ctaPressed,
      ]}
    >
      <LinearGradient
        colors={["#1A5B97", brand.navy]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.ctaGradient}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <>
            <Ionicons color="#FFFFFF" name={icon} size={18} />
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

  const confirmationRef =
    useRef<ConfirmationResult | null>(null);

  const pendingIdTokenRef =
    useRef<string | null>(null);

  const [step, setStep] =
    useState<AuthStep>("identifier");

  const [identifier, setIdentifier] = useState("");
  const [lookup, setLookup] =
    useState<AuthLookupResult | null>(null);

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
    lookup?.kind === "email"
      ? identifier.trim().toLowerCase()
      : "";

  const stepCopy = (() => {
    switch (step) {
      case "email-password":
        return {
          n: 2,
          title: lookup?.nameHint
            ? `Welcome back, ${lookup.nameHint}`
            : "Enter Password",
          hint: "Login to your account",
        };

      case "email-register":
        return {
          n: 2,
          title: "Create shop account",
          hint: "Just a few details to get started.",
        };

      case "otp":
        return {
          n: 2,
          title: "Enter OTP",
          hint: `Code sent to ${identifier.trim()}`,
        };

      case "phone-register":
        return {
          n: 2,
          title: "Almost there",
          hint: "Tell us a little about your shop.",
        };

      default:
        return {
          n: 1,
          title: "Enter Mobile Number",
          hint: "We'll send you a secure OTP to continue.",
        };
    }
  })();

  function goBack() {
    if (step === "identifier") {
      return;
    }

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

      if (!verifier) {
        throw new Error(
          "Verification is not ready. Try again."
        );
      }

      const confirmation =
        await signInWithPhoneNumber(
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

    onError: (error) => {
      showErrorToast(
        firebaseErrorMessage(error),
        "Could not send OTP"
      );
    },
  });

  const checkAccount = useMutation({
    mutationFn: () =>
      lookupAccount(identifier.trim()),

    onSuccess: (data) => {
      setLookup(data);
      setPassword("");
      setConfirmPassword("");

      if (data.kind === "email") {
        setStep(
          data.exists
            ? "email-password"
            : "email-register"
        );
      } else {
        sendOtp.mutate();
      }
    },

    onError: (error: Error) => {
      showErrorToast(
        apiErrorMessage(error),
        "Check failed"
      );
    },
  });

  const confirmOtp = useMutation({
    mutationFn: async () => {
      if (!confirmationRef.current) {
        throw new Error("Request a new OTP.");
      }

      const credential =
        await confirmationRef.current.confirm(
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

    onError: (error) => {
      showErrorToast(
        firebaseErrorMessage(error),
        "Verification failed"
      );
    },
  });

  const emailSignIn = useMutation({
    mutationFn: async () => {
      const credential =
        await signInWithEmailAndPassword(
          firebaseAuth,
          identifier.trim().toLowerCase(),
          password
        );

      const idToken =
        await credential.user.getIdToken();

      await finalizeLogin(idToken);
    },

    onError: (error) => {
      showErrorToast(
        firebaseErrorMessage(error),
        "Login failed"
      );
    },
  });

  const emailRegister = useMutation({
    mutationFn: async () => {
      const credential =
        await createUserWithEmailAndPassword(
          firebaseAuth,
          identifier.trim().toLowerCase(),
          password
        );

      const idToken =
        await credential.user.getIdToken();

      await finalizeLogin(
        idToken,
        name.trim(),
        businessName.trim() || undefined
      );
    },

    onSuccess: () => {
      showSuccessToast(
        "Shop ready",
        "Welcome aboard"
      );
    },

    onError: (error) => {
      showErrorToast(
        firebaseErrorMessage(error),
        "Signup failed"
      );
    },
  });

  const phoneRegister = useMutation({
    mutationFn: async () => {
      if (!pendingIdTokenRef.current) {
        throw new Error(
          "Session expired. Verify your mobile again."
        );
      }

      await finalizeLogin(
        pendingIdTokenRef.current,
        name.trim(),
        businessName.trim() || undefined
      );
    },

    onSuccess: () => {
      showSuccessToast(
        "Shop ready",
        "Welcome aboard"
      );
    },

    onError: (error: Error) => {
      showErrorToast(
        apiErrorMessage(error),
        "Signup failed"
      );
    },
  });

  function submitIdentifier() {
    const value = identifier.trim();

    if (!value) {
      return Alert.alert(
        "Required",
        "Enter your email or mobile number."
      );
    }

    if (!isEmail(value) && !isPhone(value)) {
      return Alert.alert(
        "Invalid",
        "Use a valid email or 10-digit mobile number."
      );
    }

    checkAccount.mutate();
  }

  function submitEmailPassword() {
    if (password.length < 6) {
      return Alert.alert(
        "Password",
        "Enter your password."
      );
    }

    emailSignIn.mutate();
  }

  function submitEmailRegister() {
    if (!name.trim()) {
      return Alert.alert(
        "Name required",
        "Enter your name."
      );
    }

    if (password.length < 6) {
      return Alert.alert(
        "Weak password",
        "Password must be at least 6 characters."
      );
    }

    if (password !== confirmPassword) {
      return Alert.alert(
        "Mismatch",
        "Passwords do not match."
      );
    }

    emailRegister.mutate();
  }

  function submitOtp() {
    if (otpCode.trim().length < 6) {
      return Alert.alert(
        "OTP",
        "Enter the 6-digit code."
      );
    }

    confirmOtp.mutate();
  }

  function submitPhoneRegister() {
    if (!name.trim()) {
      return Alert.alert(
        "Name required",
        "Enter your name."
      );
    }

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

    onError: (error) => {
      showErrorToast(
        firebaseErrorMessage(error),
        "Request failed"
      );
    },
  });

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        style="light"
      />

      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={firebaseApp.options as any}
        attemptInvisibleVerification
      />

      <KeyboardAvoidingView
        style={styles.container}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        {/* =====================================================
            FIXED SHOP BACKGROUND
            ===================================================== */}

        <View style={styles.fixedHero}>
          <Image
            source={require("../../../assets/hero.jpeg")}
            style={styles.heroImage}
            contentFit="cover"
            transition={300}
          />

          {/* Dark transparent top layer */}
          <LinearGradient
            colors={[
              "rgba(0,0,0,0.25)",
              "rgba(0,0,0,0.02)",
              "rgba(0,0,0,0)",
            ]}
            locations={[0, 0.35, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Bottom fade */}
          <LinearGradient
            colors={[
              "rgba(254,245,233,0)",
              "rgba(254,245,233,0.15)",
              "rgba(254,245,233,0.90)",
              brand.cream,
            ]}
            locations={[
              0,
              0.48,
              0.82,
              1,
            ]}
            style={styles.heroFade}
            pointerEvents="none"
          />

          {/* Small shop label */}
          <View style={styles.heroLabel}>
            <View style={styles.heroLabelDot} />

            <Text style={styles.heroLabelText}>
              YOUR SHOP • YOUR BUSINESS
            </Text>
          </View>
        </View>

        {/* =====================================================
            MAIN NON-SCROLLING CONTENT
            ===================================================== */}

        <View style={styles.mainContent}>

          {/* Back button */}
          {step !== "identifier" ? (
            <Pressable
              onPress={goBack}
              style={styles.backButton}
            >
              <Ionicons
                name="arrow-back"
                size={17}
                color="#FFFFFF"
              />

              <Text style={styles.backText}>
                Back
              </Text>
            </Pressable>
          ) : null}

          {/* ===================================================
              BRAND
              =================================================== */}

          <View style={styles.brandBlock}>

            <View style={styles.logoOuter}>
              <View style={styles.logoBadge}>
                <Ionicons
                  color="#FFFFFF"
                  name="home"
                  size={29}
                />
              </View>
            </View>

            <Text style={styles.brandName}>
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

          {/* ===================================================
              LOGIN CARD
              =================================================== */}

          <View style={styles.card}>

            <View style={styles.stepHeaderRow}>
              <StepBadge n={stepCopy.n} />

              <View style={styles.stepHeaderText}>
                <Text
                  style={styles.cardTitle}
                  numberOfLines={1}
                >
                  {stepCopy.title}
                </Text>

                <Text
                  style={styles.cardHint}
                  numberOfLines={2}
                >
                  {stepCopy.hint}
                </Text>
              </View>
            </View>

            {/* ================================================
                STEP 1
                ================================================ */}

            {step === "identifier" && (
              <View>

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
                        <View
                          style={styles.flagChakra}
                        >
                          <View
                            style={
                              styles.flagChakraDot
                            }
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

                    <Text
                      style={styles.countryCodeText}
                    >
                      +91
                    </Text>

                    <Ionicons
                      color={brand.muted}
                      name="chevron-down"
                      size={13}
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
                    onSubmitEditing={
                      submitIdentifier
                    }
                    placeholder="Mobile number"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="done"
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

            {/* ================================================
                EMAIL PASSWORD
                ================================================ */}

            {step === "email-password" && (
              <View>

                <View
                  style={
                    styles.selectedIdentifierBox
                  }
                >
                  <View
                    style={
                      styles.selectedIdentifierLeft
                    }
                  >
                    <Ionicons
                      color={brand.navy}
                      name="mail-outline"
                      size={17}
                    />

                    <Text
                      style={
                        styles.selectedIdentifierText
                      }
                      numberOfLines={1}
                    >
                      {identifier.trim()}
                    </Text>
                  </View>

                  <Pressable
                    onPress={goBack}
                    style={styles.changeLink}
                  >
                    <Text
                      style={
                        styles.changeLinkText
                      }
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
                    style={
                      styles.inputWithIconRight
                    }
                    value={password}
                  />

                  <Pressable
                    onPress={() =>
                      setShowPassword(
                        (v) => !v
                      )
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
                      setRememberMe(
                        (v) => !v
                      )
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

                    <Text
                      style={styles.rememberText}
                    >
                      Remember me
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      setResetEmail(
                        accountEmail ||
                        identifier
                      );

                      setResetSent(false);
                      setResetOpen(true);
                    }}
                  >
                    <Text
                      style={styles.forgotText}
                    >
                      Forgot password?
                    </Text>
                  </Pressable>

                </View>

                <PrimaryCTA
                  icon="log-in-outline"
                  loading={emailSignIn.isPending}
                  onPress={
                    submitEmailPassword
                  }
                  title="Login"
                />

                <Pressable
                  onPress={goBack}
                  style={styles.createPanel}
                >
                  <Text
                    style={styles.createPanelText}
                  >
                    Don't have an account?
                  </Text>

                  <Text
                    style={styles.createPanelLink}
                  >
                    Create one →
                  </Text>
                </Pressable>

              </View>
            )}

            {/* ================================================
                EMAIL REGISTER
                ================================================ */}

            {step === "email-register" && (
              <View>

                <View
                  style={
                    styles.selectedIdentifierBox
                  }
                >
                  <View
                    style={
                      styles.selectedIdentifierLeft
                    }
                  >
                    <Ionicons
                      color={brand.navy}
                      name="person-add-outline"
                      size={16}
                    />

                    <Text
                      style={
                        styles.selectedIdentifierText
                      }
                      numberOfLines={1}
                    >
                      New shop ·{" "}
                      {identifier.trim()}
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
                    style={
                      styles.inputWithIconRight
                    }
                    value={password}
                  />

                  <Pressable
                    onPress={() =>
                      setShowPassword(
                        (v) => !v
                      )
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
                  onChangeText={
                    setConfirmPassword
                  }
                  placeholder="Re-enter password"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                />

                <PrimaryCTA
                  icon="checkmark-circle-outline"
                  loading={
                    emailRegister.isPending
                  }
                  onPress={
                    submitEmailRegister
                  }
                  title="Create account"
                />

              </View>
            )}

            {/* ================================================
                OTP
                ================================================ */}

            {step === "otp" && (
              <View>

                <View
                  style={
                    styles.selectedIdentifierBox
                  }
                >
                  <View
                    style={
                      styles.selectedIdentifierLeft
                    }
                  >
                    <Ionicons
                      color={brand.navy}
                      name="call-outline"
                      size={16}
                    />

                    <Text
                      style={
                        styles.selectedIdentifierText
                      }
                      numberOfLines={1}
                    >
                      {identifier.trim()}
                    </Text>
                  </View>

                  <Pressable
                    onPress={goBack}
                    style={styles.changeLink}
                  >
                    <Text
                      style={
                        styles.changeLinkText
                      }
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
                  onPress={() =>
                    sendOtp.mutate()
                  }
                  style={styles.forgotButton}
                >
                  <Text
                    style={styles.forgotText}
                  >
                    {sendOtp.isPending
                      ? "Sending..."
                      : "Resend code"}
                  </Text>
                </Pressable>

              </View>
            )}

            {/* ================================================
                PHONE REGISTER
                ================================================ */}

            {step === "phone-register" && (
              <View>

                <View
                  style={
                    styles.selectedIdentifierBox
                  }
                >
                  <View
                    style={
                      styles.selectedIdentifierLeft
                    }
                  >
                    <Ionicons
                      color={brand.navy}
                      name="person-add-outline"
                      size={16}
                    />

                    <Text
                      style={
                        styles.selectedIdentifierText
                      }
                      numberOfLines={1}
                    >
                      New shop ·{" "}
                      {identifier.trim()}
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
                  loading={
                    phoneRegister.isPending
                  }
                  onPress={
                    submitPhoneRegister
                  }
                  title="Create account & enter"
                />

              </View>
            )}

          </View>

          {/* ===================================================
              TRUST FEATURES
              =================================================== */}

          {step === "identifier" && (
            <View style={styles.featureCard}>

              <View style={styles.featureItem}>
                <View
                  style={styles.featureIconBadge}
                >
                  <Ionicons
                    color={brand.orange}
                    name="shield-checkmark"
                    size={15}
                  />
                </View>

                <Text
                  style={styles.featureText}
                >
                  Secure
                </Text>

                <Text
                  style={styles.featureSubText}
                >
                  Protected
                </Text>
              </View>

              <View
                style={styles.featureDivider}
              />

              <View style={styles.featureItem}>
                <View
                  style={styles.featureIconBadge}
                >
                  <Ionicons
                    color={brand.orange}
                    name="flash"
                    size={15}
                  />
                </View>

                <Text
                  style={styles.featureText}
                >
                  Fast
                </Text>

                <Text
                  style={styles.featureSubText}
                >
                  Quick access
                </Text>
              </View>

              <View
                style={styles.featureDivider}
              />

              <View style={styles.featureItem}>
                <View
                  style={styles.featureIconBadge}
                >
                  <Ionicons
                    color={brand.orange}
                    name="cube-outline"
                    size={15}
                  />
                </View>

                <Text
                  style={styles.featureText}
                >
                  Simple
                </Text>

                <Text
                  style={styles.featureSubText}
                >
                  Easy business
                </Text>
              </View>

              <View
                style={styles.featureDivider}
              />

              <View style={styles.featureItem}>
                <View
                  style={styles.featureIconBadge}
                >
                  <Ionicons
                    color={brand.orange}
                    name="headset"
                    size={15}
                  />
                </View>

                <Text
                  style={styles.featureText}
                >
                  Support
                </Text>

                <Text
                  style={styles.featureSubText}
                >
                  We're here
                </Text>
              </View>

            </View>
          )}

          {/* ===================================================
              FOOTER
              =================================================== */}

          <View style={styles.footer}>
            <Svg
              height="42"
              width="100%"
              viewBox="0 0 400 42"
            >
              <Path
                d="M0 15 Q 80 37 170 16 Q 270 -3 400 16 L400 42 L0 42 Z"
                fill={brand.navy}
              />

              <Path
                d="M0 14 Q 80 36 170 15 Q 270 -4 400 15"
                fill="none"
                stroke={brand.orange}
                strokeWidth="3"
              />
            </Svg>

            <View
              style={styles.footerTextRow}
            >
              <Text
                style={styles.footerFlourish}
              >
                »
              </Text>

              <Text style={styles.footerText}>
                Shop Smart
              </Text>

              <Text
                style={styles.footerFlourish}
              >
                «
              </Text>
            </View>
          </View>

        </View>
      </KeyboardAvoidingView>

      {/* =====================================================
          RESET PASSWORD
          ===================================================== */}

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
              loading={
                requestReset.isPending
              }
              onPress={() => {
                if (!isEmail(resetEmail)) {
                  return Alert.alert(
                    "Email",
                    "Enter a valid email."
                  );
                }

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

/* ============================================================
   STYLES
   ============================================================ */

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: brand.cream,
  },

  container: {
    flex: 1,
    backgroundColor: brand.cream,
  },

  /* ----------------------------------------------------------
     FIXED HERO IMAGE
     ---------------------------------------------------------- */

  fixedHero: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,

    height:
      Platform.OS === "web"
        ? 390
        : 285,

    overflow: "hidden",

    backgroundColor: "#EEDFCB",

    zIndex: 0,
  },

  heroImage: {
    width: "100%",
    height: "100%",
  },

  heroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,

    height: "72%",
  },

  heroLabel: {
    position: "absolute",

    top:
      Platform.OS === "web"
        ? 26
        : 30,

    alignSelf: "center",

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 12,
    paddingVertical: 6,

    borderRadius: 999,

    backgroundColor:
      "rgba(13,54,102,0.78)",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.30)",
  },

  heroLabelDot: {
    width: 6,
    height: 6,
    borderRadius: 99,

    backgroundColor: brand.orange,

    marginRight: 6,
  },

  heroLabelText: {
    color: "#FFFFFF",

    fontFamily: fonts.bold,

    fontSize: 8.5,

    letterSpacing: 0.8,
  },

  /* ----------------------------------------------------------
     MAIN CONTENT
     ---------------------------------------------------------- */
  mainContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",

    paddingTop: Platform.OS === "web" ? 100 : 180,
    paddingBottom: 50,

    zIndex: 5,
  },

  /* ----------------------------------------------------------
     BACK
     ---------------------------------------------------------- */

  backButton: {
    position: "absolute",

    top:
      Platform.OS === "web"
        ? 18
        : 18,

    left: 16,

    zIndex: 50,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 9,
    paddingVertical: 7,

    borderRadius: 10,

    backgroundColor:
      "rgba(13,54,102,0.78)",

    borderWidth: 1,
    borderColor:
      "rgba(255,255,255,0.25)",
  },

  backText: {
    color: "#FFFFFF",

    fontFamily: fonts.bold,

    fontSize: 12,

    marginLeft: 5,
  },

  /* ----------------------------------------------------------
     BRAND
     ---------------------------------------------------------- */

  brandBlock: {
    alignItems: "center",

    width: "100%",

    paddingHorizontal: 16,
  },

  logoOuter: {
    alignItems: "center",
    justifyContent: "center",

    width: 64,
    height: 64,

    borderRadius: 32,

    backgroundColor:
      "rgba(245,153,38,0.24)",

    marginBottom: 3,
  },

  logoBadge: {
    width: 55,
    height: 55,

    borderRadius: 17,

    backgroundColor: brand.navy,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 3,

    borderColor: "#FFFDF8",

    shadowColor: brand.navy,

    shadowOffset: {
      width: 0,
      height: 5,
    },

    shadowOpacity: 0.25,
    shadowRadius: 10,

    elevation: 6,
  },

  brandName: {
    fontFamily: fonts.extraBold,

    fontSize:
      Platform.OS === "web"
        ? 29
        : 26,

    letterSpacing: -0.8,

    lineHeight: 31,

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

    fontSize: 9.5,

    marginTop: 1,

    textAlign: "center",
  },

  brandUnderline: {
    width: 58,
    height: 3,

    borderRadius: 99,

    backgroundColor:
      brand.orange,

    marginTop: 5,
  },

  /* ----------------------------------------------------------
     CARD
     ---------------------------------------------------------- */

  card: {
    width: "92%",
    maxWidth: 430,

    backgroundColor:
      "rgba(255,255,255,0.98)",

    borderRadius: 20,

    paddingHorizontal: 15,
    paddingVertical: 14,

    marginTop: 11,

    borderWidth: 1,

    borderColor:
      "rgba(210,220,231,0.85)",

    shadowColor: "#09294E",

    shadowOffset: {
      width: 0,
      height: 9,
    },

    shadowOpacity: 0.14,
    shadowRadius: 18,

    elevation: 6,
  },

  stepHeaderRow: {
    flexDirection: "row",

    alignItems: "center",

    marginBottom: 10,
  },

  stepBadge: {
    width: 30,
    height: 30,

    borderRadius: 999,

    backgroundColor:
      brand.orange,

    alignItems: "center",
    justifyContent: "center",

    marginRight: 9,

    shadowColor:
      brand.orange,

    shadowOffset: {
      width: 0,
      height: 3,
    },

    shadowOpacity: 0.25,
    shadowRadius: 5,

    elevation: 3,
  },

  stepBadgeText: {
    color: "#FFFFFF",

    fontFamily: fonts.extraBold,

    fontSize: 13,
  },

  stepHeaderText: {
    flex: 1,
  },

  cardTitle: {
    color: brand.navy,

    fontFamily: fonts.extraBold,

    fontSize: 15,

    letterSpacing: -0.2,
  },

  cardHint: {
    color: brand.muted,

    fontFamily: fonts.medium,

    fontSize: 9.5,

    lineHeight: 13,

    marginTop: 1,
  },

  /* ----------------------------------------------------------
     PHONE INPUT
     ---------------------------------------------------------- */

  phoneInputContainer: {
    minHeight: 47,

    alignItems: "center",

    flexDirection: "row",

    backgroundColor:
      "#F7FAFD",

    borderWidth: 1,

    borderColor:
      "#C8D7E7",

    borderRadius: 12,

    paddingHorizontal: 10,

    marginBottom: 9,
  },

  countryPickerBox: {
    flexDirection: "row",

    alignItems: "center",

    gap: 4,
  },

  indiaFlag: {
    width: 22,
    height: 15,

    overflow: "hidden",

    borderRadius: 2,

    borderWidth: 0.5,

    borderColor: "#D5D5D5",
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

    borderRadius: 99,

    borderWidth: 0.8,

    borderColor: "#000080",

    alignItems: "center",
    justifyContent: "center",
  },

  flagChakraDot: {
    width: 2,
    height: 2,

    borderRadius: 99,

    backgroundColor: "#000080",
  },

  countryCodeText: {
    color: brand.navy,

    fontFamily: fonts.bold,

    fontSize: 13,
  },

  phoneInputDivider: {
    width: 1,
    height: 23,

    backgroundColor:
      "#D6E0EA",

    marginHorizontal: 8,
  },

  phoneTextInput: {
    flex: 1,

    minHeight: 43,

    color: brand.navy,

    fontFamily: fonts.medium,

    fontSize: 13.5,

    paddingVertical: 0,
  },

  /* ----------------------------------------------------------
     INPUTS
     ---------------------------------------------------------- */

  inputWrap: {
    position: "relative",

    justifyContent: "center",

    marginBottom: 8,
  },

  inputIcon: {
    position: "absolute",

    left: 13,

    zIndex: 5,
  },

  inputWithIcon: {
    paddingLeft: 41,

    backgroundColor:
      "#F7FAFD",

    borderRadius: 12,

    borderColor:
      "#C8D7E7",

    minHeight: 47,

    fontSize: 13,
  },

  inputWithIconRight: {
    paddingLeft: 41,
    paddingRight: 42,

    backgroundColor:
      "#F7FAFD",

    borderRadius: 12,

    borderColor:
      "#C8D7E7",

    minHeight: 47,

    fontSize: 13,
  },

  eyeButton: {
    position: "absolute",

    right: 2,

    width: 39,
    height: 46,

    alignItems: "center",
    justifyContent: "center",

    zIndex: 5,
  },

  label: {
    color: brand.navy,

    fontFamily: fonts.semibold,

    fontSize: 10.5,

    marginBottom: 4,

    marginTop: 3,
  },

  /* ----------------------------------------------------------
     CTA
     ---------------------------------------------------------- */

  ctaWrapper: {
    borderRadius: 12,

    shadowColor: brand.navy,

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.22,

    shadowRadius: 8,

    elevation: 4,
  },

  ctaPressed: {
    opacity: 0.9,

    transform: [
      {
        scale: 0.99,
      },
    ],
  },

  ctaGradient: {
    minHeight: 48,

    borderRadius: 12,

    flexDirection: "row",

    alignItems: "center",
    justifyContent: "center",

    gap: 7,
  },

  ctaText: {
    color: "#FFFFFF",

    fontFamily: fonts.extraBold,

    fontSize: 13.5,
  },

  /* ----------------------------------------------------------
     SELECTED ACCOUNT
     ---------------------------------------------------------- */

  selectedIdentifierBox: {
    minHeight: 42,

    flexDirection: "row",

    alignItems: "center",
    justifyContent: "space-between",

    backgroundColor:
      "#F4F8FC",

    borderWidth: 1,

    borderColor:
      "#D4DFEA",

    borderRadius: 11,

    paddingHorizontal: 10,

    paddingVertical: 7,

    marginBottom: 8,
  },

  selectedIdentifierLeft: {
    flexDirection: "row",

    alignItems: "center",

    flex: 1,

    gap: 7,
  },

  selectedIdentifierText: {
    flex: 1,

    color: brand.navy,

    fontFamily: fonts.bold,

    fontSize: 11.5,
  },

  changeLink: {
    paddingHorizontal: 5,
    paddingVertical: 3,
  },

  changeLinkText: {
    color: brand.blueLink,

    fontFamily: fonts.semibold,

    fontSize: 11.5,
  },

  /* ----------------------------------------------------------
     REMEMBER
     ---------------------------------------------------------- */

  rememberRow: {
    flexDirection: "row",

    alignItems: "center",
    justifyContent: "space-between",

    marginBottom: 8,
  },

  rememberLeft: {
    flexDirection: "row",

    alignItems: "center",

    gap: 6,
  },

  checkbox: {
    width: 17,
    height: 17,

    borderRadius: 5,

    borderWidth: 1.5,

    borderColor:
      brand.navy,

    alignItems: "center",
    justifyContent: "center",
  },

  checkboxOn: {
    backgroundColor:
      brand.navy,
  },

  rememberText: {
    color: brand.navy,

    fontFamily: fonts.medium,

    fontSize: 10.5,
  },

  forgotText: {
    color: brand.blueLink,

    fontFamily: fonts.semibold,

    fontSize: 10.5,
  },

  forgotButton: {
    alignItems: "center",
    justifyContent: "center",

    minHeight: 31,

    marginTop: 1,
  },

  /* ----------------------------------------------------------
     CREATE PANEL
     ---------------------------------------------------------- */

  createPanel: {
    flexDirection: "row",

    alignItems: "center",
    justifyContent: "center",

    gap: 5,

    backgroundColor:
      "#F4F8FC",

    borderRadius: 10,

    paddingVertical: 8,

    marginTop: 8,
  },

  createPanelText: {
    color: brand.muted,

    fontFamily: fonts.medium,

    fontSize: 10.5,
  },

  createPanelLink: {
    color: brand.blueLink,

    fontFamily: fonts.semibold,

    fontSize: 10.5,
  },

  /* ----------------------------------------------------------
     FEATURES
     ---------------------------------------------------------- */

  featureCard: {
    width: "92%",
    maxWidth: 430,

    minHeight: 66,

    flexDirection: "row",

    alignItems: "center",
    justifyContent: "space-between",

    marginTop: 9,

    paddingHorizontal: 5,
    paddingVertical: 7,

    backgroundColor:
      "rgba(255,255,255,0.84)",

    borderRadius: 15,

    borderWidth: 1,

    borderColor:
      "rgba(210,220,231,0.65)",
  },

  featureItem: {
    flex: 1,

    alignItems: "center",

    minWidth: 0,
  },

  featureIconBadge: {
    width: 27,
    height: 27,

    borderRadius: 9,

    alignItems: "center",
    justifyContent: "center",

    backgroundColor:
      brand.featureIconBg,

    marginBottom: 3,
  },

  featureText: {
    color: brand.navy,

    fontFamily: fonts.bold,

    fontSize: 8.5,

    lineHeight: 10,

    textAlign: "center",
  },

  featureSubText: {
    color: brand.muted,

    fontFamily: fonts.medium,

    fontSize: 6.8,

    lineHeight: 9,

    textAlign: "center",
  },

  featureDivider: {
    width: 1,
    height: 29,

    backgroundColor:
      "#D8E1EA",
  },

  /* ----------------------------------------------------------
     FOOTER
     ---------------------------------------------------------- */

  footer: {
    width: "100%",
    height: 42,
    position: "absolute",
    bottom: -3,
    left: 0,
    right: 0,
    overflow: "hidden",
    zIndex: 20,
  },

  footerTextRow: {
    position: "absolute",

    left: 0,
    right: 0,

    bottom: 5,

    flexDirection: "row",

    alignItems: "center",
    justifyContent: "center",

    gap: 7,
  },

  footerText: {
    color: "#FFFFFF",

    fontFamily: fonts.extraBold,

    fontSize: 11.5,

    letterSpacing: 0.3,
  },

  footerFlourish: {
    color: brand.orange,

    fontFamily: fonts.bold,

    fontSize: 11,
  },
});
