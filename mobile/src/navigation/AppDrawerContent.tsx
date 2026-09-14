import { Ionicons } from "@expo/vector-icons";
import { DrawerContentScrollView, DrawerItemList, type DrawerContentComponentProps } from "@react-navigation/drawer";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, typography } from "../constants/theme";
import { useAppSelector } from "../hooks/redux";

export function AppDrawerContent(props: DrawerContentComponentProps) {
  const user = useAppSelector((state) => state.auth.user);
  const initials = (user?.name || "Shop").slice(0, 2).toUpperCase();

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <View style={styles.brand}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.shop}>Retail Manager</Text>
        <Text style={styles.name}>{user?.name || "Shop owner"}</Text>
        <Text style={styles.email}>{user?.email || ""}</Text>
        {user?.role ? (
          <View style={styles.rolePill}>
            <Ionicons color={colors.primary} name="shield-checkmark-outline" size={12} />
            <Text style={styles.roleText}>{user.role}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.list}>
        <DrawerItemList {...props} />
      </View>
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 0 },
  brand: {
    backgroundColor: colors.secondary,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 48,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 48,
  },
  avatarText: { color: "#ffffff", fontFamily: fonts.bold, fontSize: 16, fontWeight: "700" },
  shop: { color: "#A5B4FC", ...typography.eyebrow },
  name: { color: "#ffffff", ...typography.h3, marginTop: 4 },
  email: { color: "#94A3B8", fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  rolePill: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 4,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  roleText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 11, fontWeight: "600", textTransform: "capitalize" },
  list: { paddingTop: spacing.xs },
});
