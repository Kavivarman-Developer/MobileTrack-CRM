import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Button, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { logout } from "../../redux/authSlice";
import { API_BASE_URL } from "../../services/api";

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const navigation = useNavigation<any>();

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CONTROL CENTER</Text>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* User Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{(user?.name || "User").slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user?.name || "Shop Owner"}</Text>
            <Text style={styles.meta}>{user?.email || "No email registered"}</Text>
            <View style={{ marginTop: spacing.xs }}>
              <Badge label={user?.role || "staff"} tone="info" />
            </View>
          </View>
        </View>

        {/* Connection Panel */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Backend Connection</Text>
          <SettingRow icon="server-outline" label="API Server URL" value={API_BASE_URL} />
          <SettingRow icon="shield-checkmark-outline" label="Authentication State" positive={!!user} value={user ? "Session Active" : "Signed Out"} />
        </View>

        {/* Categorized App Modules Navigation */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Sales & Operations Modules</Text>
          <ModuleLink icon="bag-outline" label="Sales Billing" onPress={() => navigation.navigate("Sales")} />
          <ModuleLink icon="flash-outline" label="Quick POS Counter" onPress={() => navigation.navigate("QuickSale")} />
          <ModuleLink icon="card-outline" label="Billing Desk" onPress={() => navigation.navigate("Billing")} />
          <ModuleLink icon="receipt-outline" label="Orders Management" onPress={() => navigation.navigate("Orders")} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Inventory & Procurement</Text>
          <ModuleLink icon="cube-outline" label="Product Catalog / Items" onPress={() => navigation.navigate("Items")} />
          <ModuleLink icon="options-outline" label="Stock Adjustments" onPress={() => navigation.navigate("InventoryAdjustments")} />
          <ModuleLink icon="cart-outline" label="Purchases (POs)" onPress={() => navigation.navigate("Purchases")} />
          <ModuleLink icon="people-outline" label="Vendor Directory" onPress={() => navigation.navigate("Vendors")} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Financials & Analytics</Text>
          <ModuleLink icon="bar-chart-outline" label="Full Business Reports" onPress={() => navigation.navigate("Reports")} />
          <ModuleLink icon="wallet-outline" label="Expenses Tracker" onPress={() => navigation.navigate("Expenses")} />
          <ModuleLink icon="person-add-outline" label="Customer Profiles" onPress={() => navigation.navigate("Customers")} />
        </View>

        {/* Session Danger Zone */}
        <View style={styles.dangerPanel}>
          <Text style={styles.sectionTitle}>Session Control</Text>
          <Text style={styles.dangerHint}>Signing out will clear your session token from this device.</Text>
          <Button icon="log-out-outline" onPress={() => dispatch(logout())} title="Sign Out" variant="danger" />
        </View>
      </ScrollView>
    </Screen>
  );
}

function SettingRow({ icon, label, positive, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; positive?: boolean; value: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabelGroup}>
        <Ionicons color={colors.muted} name={icon} size={16} style={{ marginRight: 6 }} />
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text numberOfLines={1} style={[styles.rowValue, positive && styles.positive]}>{value}</Text>
    </View>
  );
}

function ModuleLink({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.moduleLink}>
      <Ionicons color={colors.primary} name={icon} size={18} style={{ marginRight: 10 }} />
      <Text style={styles.moduleLabel}>{label}</Text>
      <Ionicons color={colors.muted} name="chevron-forward" size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xl },
  header: { marginBottom: spacing.md },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, marginTop: 2 },

  profileCard: { alignItems: "center", backgroundColor: colors.secondary, borderRadius: radius.md, flexDirection: "row", marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  profileAvatar: { alignItems: "center", backgroundColor: colors.primaryLight, borderRadius: radius.sm, height: 52, justifyContent: "center", marginRight: spacing.md, width: 52 },
  profileAvatarText: { color: colors.primary, fontSize: 18, fontWeight: "700" },
  profileInfo: { flex: 1 },
  name: { color: "#ffffff", fontSize: 18, fontWeight: "700" },
  meta: { color: colors.blueSoft, fontSize: 13, marginTop: 2 },

  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  dangerPanel: { backgroundColor: colors.surface, borderColor: colors.redSoft, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  sectionTitle: { color: colors.text, ...typography.h3, marginBottom: spacing.sm },

  row: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  rowLabelGroup: { flexDirection: "row", alignItems: "center" },
  rowLabel: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  rowValue: { color: colors.text, fontSize: 13, fontWeight: "600" },
  positive: { color: colors.success },

  moduleLink: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", minHeight: 48, paddingVertical: spacing.sm },
  moduleLabel: { color: colors.text, flex: 1, fontSize: 14, fontWeight: "500" },
  dangerHint: { color: colors.muted, fontSize: 12, marginBottom: spacing.sm },
});
