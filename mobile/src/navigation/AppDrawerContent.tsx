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
        <View style={styles.brandRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.brandInfo}>
            <Text numberOfLines={1} style={styles.shop}>KADAI KANAKKU</Text>
            <Text numberOfLines={1} style={styles.name}>{user?.name || "Shop owner"}</Text>
          </View>
          {user?.role ? (
            <View style={styles.rolePill}>
              <Ionicons color="#FFFFFF" name="shield-checkmark-outline" size={11} />
              <Text style={styles.roleText}>{user.role}</Text>
            </View>
          ) : null}
        </View>
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
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 8,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarText: { color: "#ffffff", fontFamily: fonts.bold, fontSize: 13, fontWeight: "700" },
  brandInfo: {
    flex: 1,
    justifyContent: "center",
  },
  shop: {
    color: "#A5B4FC",
    fontFamily: fonts.bold,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  name: {
    color: "#ffffff",
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 1,
  },
  rolePill: {
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  roleText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  list: { paddingTop: 2 },
});
