import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { Button, Field } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { useAppDispatch } from "../../hooks/redux";
import { setCredentials } from "../../redux/authSlice";
import { googleLogin, login } from "../../services/api";

WebBrowser.maybeCompleteAuthSession();

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
type FormValues = z.infer<typeof schema>;

const nativeRedirectUri = AuthSession.makeRedirectUri({ scheme: "mobiletrackcrm" });

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const [showPassword, setShowPassword] = useState(false);
  const handledWebRedirect = useRef(false);
  const redirectUri = Platform.OS === "web" && typeof window !== "undefined" ? window.location.origin : nativeRedirectUri;
  console.log("Google redirect URI", redirectUri);
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
    redirectUri,
    scopes: ["openid", "profile", "email"],
  });
  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(schema),
  });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => login(values.email, values.password),
    onSuccess: (data) => dispatch(setCredentials(data)),
    onError: (error: Error) => Alert.alert("Login failed", error.message),
  });
  const googleMutation = useMutation({
    mutationFn: (idToken: string) => googleLogin(idToken),
    onSuccess: (data) => dispatch(setCredentials(data)),
    onError: (error: Error) => Alert.alert("Google login failed", error.message),
  });

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || handledWebRedirect.current) return;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const idToken = query.get("id_token") || hash.get("id_token");
    const authError = query.get("error") || hash.get("error");
    if (authError) {
      handledWebRedirect.current = true;
      window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
      Alert.alert("Google login failed", authError);
      return;
    }
    if (!idToken) return;
    handledWebRedirect.current = true;
    window.history.replaceState({}, document.title, window.location.origin + window.location.pathname);
    googleMutation.mutate(idToken);
  }, []);

  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.authentication?.idToken || response.params?.id_token;
    if (!idToken) {
      Alert.alert("Google login failed", "Google did not return an ID token.");
      return;
    }
    googleMutation.mutate(idToken);
  }, [response]);

  function continueWithGoogle() {
    if (!process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID) {
      Alert.alert("Google login not configured", "Set EXPO_PUBLIC_GOOGLE_CLIENT_ID in mobile/.env first.");
      return;
    }
    if (Platform.OS === "web") {
      if (!request?.url || typeof window === "undefined") return;
      window.location.assign(request.url);
      return;
    }
    promptAsync();
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      {/* Brand header block */}
      <View style={styles.brandBlock}>
        <View style={styles.logoBadge}>
          <Ionicons color="#fff" name="storefront" size={28} />
        </View>
        <Text style={styles.brand}>Retail Manager</Text>
        <Text style={styles.subtitle}>Inventory, billing, customers and daily shop totals — all in one place.</Text>
      </View>

      {/* Form card */}
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
                placeholder="••••••••"
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
        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.divider} />
        </View>
        <Pressable disabled={!request || googleMutation.isPending} onPress={continueWithGoogle} style={({ pressed }) => [styles.googleButton, pressed && styles.googleButtonPressed]}>
          <Ionicons color={colors.text} name="logo-google" size={18} />
          <Text style={styles.googleText}>{googleMutation.isPending ? "Signing in..." : "Continue with Google"}</Text>
        </Pressable>
      </View>

      <Text style={styles.footer}>Secured with encrypted session tokens</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.secondary, justifyContent: "center", padding: spacing.lg },
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
  brand: { color: "#fff", ...typography.h1, fontSize: 26, textAlign: "center" },
  subtitle: { color: "#A9B1C7", fontSize: 14, fontWeight: "500", marginTop: spacing.xs, textAlign: "center", paddingHorizontal: spacing.md },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.floating,
  },
  cardTitle: { color: colors.text, ...typography.h2 },
  cardHint: { color: colors.muted, fontSize: 13, fontWeight: "500", marginBottom: spacing.md, marginTop: 2 },

  label: { color: colors.text, fontSize: 12, fontWeight: "800", marginBottom: spacing.xs, textTransform: "uppercase", letterSpacing: 0.4 },
  inputWrap: { justifyContent: "center", marginBottom: spacing.sm, position: "relative" },
  inputIcon: { left: spacing.md, position: "absolute", zIndex: 2 },
  inputWithIcon: { paddingLeft: 42, marginBottom: 0 },
  eyeButton: { alignItems: "center", height: 44, justifyContent: "center", position: "absolute", right: 6, width: 44 },
  dividerRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginVertical: spacing.md },
  divider: { backgroundColor: colors.border, flex: 1, height: 1 },
  dividerText: { color: colors.muted, fontSize: 11, fontWeight: "900" },
  googleButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing.sm, justifyContent: "center", minHeight: 48, padding: spacing.md },
  googleButtonPressed: { opacity: 0.86 },
  googleText: { color: colors.text, fontWeight: "900" },

  footer: { color: "#7C86A3", fontSize: 12, fontWeight: "600", marginTop: spacing.lg, textAlign: "center" },
});
