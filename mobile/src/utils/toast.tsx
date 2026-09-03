import Toast, { BaseToastProps, ErrorToast } from "react-native-toast-message";
import { StyleSheet } from "react-native";
import { colors, radius, shadows, spacing, typography } from "../constants/theme";

const baseToastStyle = {
  borderRadius: radius.md,
  height: "auto" as const,
  minHeight: 60,
  paddingVertical: spacing.xs,
  width: "90%" as const,
  ...shadows.floating,
  zIndex: 9999,
  elevation: 24,
};

const styles = StyleSheet.create({
  contentContainer: { paddingHorizontal: spacing.sm },
  text1: { ...typography.label, color: colors.text },
  text2: { ...typography.caption, color: colors.muted },
});

export const toastConfig = {
  success: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      contentContainerStyle={styles.contentContainer}
      style={[baseToastStyle, { borderLeftColor: colors.success, backgroundColor: colors.surface }]}
      text1Style={styles.text1}
      text2Style={styles.text2}
      text2NumberOfLines={2}
    />
  ),
  error: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      contentContainerStyle={styles.contentContainer}
      style={[baseToastStyle, { borderLeftColor: colors.danger, backgroundColor: colors.surface }]}
      text1Style={styles.text1}
      text2Style={styles.text2}
      text2NumberOfLines={2}
    />
  ),
  info: (props: BaseToastProps) => (
    <ErrorToast
      {...props}
      contentContainerStyle={styles.contentContainer}
      style={[baseToastStyle, { borderLeftColor: colors.info, backgroundColor: colors.surface }]}
      text1Style={styles.text1}
      text2Style={styles.text2}
      text2NumberOfLines={2}
    />
  ),
};

function show(type: "success" | "error" | "info", title: string, message?: string) {
  Toast.show({
    type,
    text1: title,
    text2: message,
    position: "top",
    visibilityTime: 3500,
    autoHide: true,
    topOffset: 60,
  });
}

export function showSuccessToast(message: string, title = "Success") {
  show("success", title, message);
}

export function showErrorToast(message: string, title = "Error") {
  show("error", title, message);
}

export function showInfoToast(message: string, title = "Info") {
  show("info", title, message);
}
