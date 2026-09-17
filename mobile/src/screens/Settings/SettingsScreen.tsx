import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Button, IosScreenHeader, Screen } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { logout } from "../../redux/authSlice";
import { API_BASE_URL } from "../../services/api";

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const navigation = useNavigation<any>();

  return (
    <Screen style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <IosScreenHeader eyebrow="Control center" title="Settings" />

        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || "User").slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name || "Shop Owner"}</Text>
          <Text style={styles.meta}>{user?.email || "No email"}</Text>
          <View style={styles.heroPills}>
            <Text style={styles.heroPill}>{(user?.role || "staff").toUpperCase()}</Text>
            <Text style={styles.heroPill}>{user ? "Signed in" : "Signed out"}</Text>
          </View>
        </View>

        <Text style={styles.groupLabel}>Sell</Text>
        <View style={styles.group}>
          <ModuleLink icon="bag-outline" label="Sales" onPress={() => navigation.navigate("Sales")} />
          <ModuleLink icon="flash-outline" label="Quick POS" onPress={() => navigation.navigate("QuickSale")} />
          <ModuleLink icon="card-outline" label="Billing desk" onPress={() => navigation.navigate("Billing")} />
          <ModuleLink icon="receipt-outline" label="Orders" onPress={() => navigation.navigate("Orders")} last />
        </View>

        <Text style={styles.groupLabel}>Stock</Text>
        <View style={styles.group}>
          <ModuleLink icon="cube-outline" label="Items" onPress={() => navigation.navigate("Items")} />
          <ModuleLink icon="options-outline" label="Stock adjustments" onPress={() => navigation.navigate("Inventory Adjustments")} />
          <ModuleLink icon="cart-outline" label="Purchases" onPress={() => navigation.navigate("Purchases")} />
          <ModuleLink icon="people-outline" label="Vendors" onPress={() => navigation.navigate("Vendors")} last />
        </View>

        <Text style={styles.groupLabel}>Money</Text>
        <View style={styles.group}>
          <ModuleLink icon="bar-chart-outline" label="Reports" onPress={() => navigation.navigate("Reports")} />
          <ModuleLink icon="wallet-outline" label="Expenses" onPress={() => navigation.navigate("Expenses")} />
          <ModuleLink icon="person-add-outline" label="Customers" onPress={() => navigation.navigate("Customers")} last />
        </View>

        <Text style={styles.groupLabel}>Account</Text>
        <View style={styles.group}>
          <SettingRow icon="server-outline" label="API" value={API_BASE_URL} />
          <SettingRow icon="shield-checkmark-outline" label="Session" value={user ? "Active" : "Signed out"} positive={!!user} last />
        </View>

        <View style={styles.danger}>
          <Text style={styles.dangerHint}>Sign out clears this device session.</Text>
          <Button icon="log-out-outline" onPress={() => dispatch(logout())} title="Sign Out" variant="danger" />
        </View>
      </ScrollView>
    </Screen>
  );
}

function SettingRow({
  icon,
  label,
  positive,
  value,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  positive?: boolean;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Ionicons color={ios.blue} name={icon} size={18} />
      </View>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text numberOfLines={1} style={[styles.rowValue, positive && styles.positive]}>{value}</Text>
    </View>
  );
}

function ModuleLink({
  icon,
  label,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.row, !last && styles.rowBorder]}>
      <View style={styles.rowIcon}>
        <Ionicons color={ios.blue} name={icon} size={18} />
      </View>
      <Text style={styles.moduleLabel}>{label}</Text>
      <Ionicons color={ios.secondary} name="chevron-forward" size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: ios.bg },
  container: { paddingBottom: spacing.xxl },
  hero: {
    alignItems: "center",
    backgroundColor: ios.dark,
    borderRadius: 24,
    marginBottom: spacing.lg,
    padding: spacing.xl,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 28,
    height: 56,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 56,
  },
  avatarText: { color: "#fff", fontFamily: fonts.bold, fontSize: 18, fontWeight: "700" },
  name: { color: "#fff", fontFamily: fonts.bold, fontSize: 22, fontWeight: "700" },
  meta: { color: "rgba(255,255,255,0.65)", fontFamily: fonts.medium, fontSize: 14, marginTop: 4 },
  heroPills: { flexDirection: "row", gap: spacing.xs, marginTop: 11 },
  heroPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    color: "#fff",
    fontFamily: fonts.semibold,
    fontSize: 12,
    fontWeight: "600",
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  groupLabel: {
    color: ios.secondary,
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.xs,
    marginLeft: spacing.xxs,
    marginTop: spacing.xxs,
    textTransform: "uppercase",
  },
  group: {
    backgroundColor: ios.card,
    borderRadius: 16,
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 46,
    paddingHorizontal: 11,
    paddingVertical: spacing.sm,
  },
  rowBorder: { borderBottomColor: ios.separator, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    marginRight: spacing.sm,
    width: 32,
  },
  rowLabel: { color: ios.label, flex: 1, fontFamily: fonts.medium, fontSize: 15, fontWeight: "500" },
  rowValue: { color: ios.secondary, flexShrink: 1, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600", maxWidth: "45%", textAlign: "right" },
  positive: { color: ios.green },
  moduleLabel: { color: ios.label, flex: 1, fontFamily: fonts.medium, fontSize: 16, fontWeight: "500" },
  danger: {
    backgroundColor: ios.card,
    borderRadius: 16,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  dangerHint: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13, marginBottom: spacing.sm },
});
