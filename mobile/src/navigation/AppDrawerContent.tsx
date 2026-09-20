import { Ionicons } from "@expo/vector-icons";
import { DrawerContentScrollView, DrawerItemList, type DrawerContentComponentProps } from "@react-navigation/drawer";
import { Alert, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { colors, fonts, radius, spacing, typography } from "../constants/theme";
import { useAppSelector, useAppDispatch } from "../hooks/redux";
import { logout } from "../redux/authSlice";
import { firebaseAuth } from "../config/firebase";
import { signOut } from "firebase/auth";

export function AppDrawerContent(props: DrawerContentComponentProps) {
  const user = useAppSelector((state) => state.auth.user);
  const dispatch = useAppDispatch();
  const initials = (user?.name || "Shop").slice(0, 2).toUpperCase();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;

  async function handleSignOut() {
    // Alert.alert doesn't work on web — use window.confirm instead
    if (Platform.OS === "web") {
      const ok = window.confirm("Are you sure you want to sign out?");
      if (!ok) return;
      try { await signOut(firebaseAuth); } catch (_) {}
      dispatch(logout());
      return;
    }

    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut(firebaseAuth);
          } catch (_) {}
          dispatch(logout());
        },
      },
    ]);
  }

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <View style={[styles.brand, isDesktop && styles.brandDesktop]}>
        <View style={styles.brandRow}>
          <View style={[styles.avatar, isDesktop && styles.avatarDesktop]}>
            <Text style={[styles.avatarText, isDesktop && styles.avatarTextDesktop]}>{initials}</Text>
          </View>
          <View style={styles.brandInfo}>
            <Text numberOfLines={1} style={styles.shop}>KADAI KANAKKU</Text>
            <Text numberOfLines={1} style={[styles.name, isDesktop && styles.nameDesktop]}>{user?.name || "Shop owner"}</Text>
          </View>
          {user?.role ? (
            <View style={styles.rolePill}>
              <Ionicons color="#FFFFFF" name="shield-checkmark-outline" size={11} />
              <Text style={styles.roleText}>{user.role}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={[styles.list, isDesktop && styles.listDesktop]}>
        <DrawerItemList {...props} />
      </View>
      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [styles.signOutBtn, pressed && styles.signOutBtnPressed]}
      >
        <Ionicons color="#EF4444" name="log-out-outline" size={18} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </Pressable>
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
  brandDesktop: {
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
  avatarDesktop: {
    borderRadius: 10,
    height: 40,
    width: 40,
  },
  avatarText: { color: "#ffffff", fontFamily: fonts.bold, fontSize: 13, fontWeight: "700" },
  avatarTextDesktop: { fontSize: 14 },
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
  nameDesktop: {
    fontSize: 14,
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
  listDesktop: {
    paddingBottom: 20,
    paddingTop: 6,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginVertical: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.18)",
  },
  signOutBtnPressed: {
    opacity: 0.7,
  },
  signOutText: {
    color: "#EF4444",
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: "600",
  },
});
