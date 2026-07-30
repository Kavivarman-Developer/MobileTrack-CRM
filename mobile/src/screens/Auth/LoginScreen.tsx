import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { z } from "zod";
import { Button, Card, Field } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
import { useAppDispatch } from "../../hooks/redux";
import { setCredentials } from "../../redux/authSlice";
import { login } from "../../services/api";

const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
type FormValues = z.infer<typeof schema>;

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: { email: "admin@example.com", password: "password123" },
    resolver: zodResolver(schema),
  });
  const mutation = useMutation({
    mutationFn: (values: FormValues) => login(values.email, values.password),
    onSuccess: (data) => dispatch(setCredentials(data)),
    onError: (error: Error) => Alert.alert("Login failed", error.message),
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.brand}>Retail Manager</Text>
        <Text style={styles.subtitle}>Inventory, billing, customers, and daily shop totals.</Text>
      </View>
      <Card>
        <Controller control={control} name="email" render={({ field: { onChange, value } }) => <Field autoCapitalize="none" keyboardType="email-address" onChangeText={onChange} placeholder="Email" value={value} />} />
        <Controller control={control} name="password" render={({ field: { onChange, value } }) => <Field onChangeText={onChange} placeholder="Password" secureTextEntry value={value} />} />
        <Button loading={mutation.isPending} onPress={handleSubmit((values) => mutation.mutate(values))} title="Sign in" />
      </Card>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", backgroundColor: colors.background, padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  brand: { color: colors.text, fontSize: 34, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 16, marginTop: spacing.sm },
});
