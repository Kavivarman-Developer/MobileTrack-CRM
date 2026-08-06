import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { TouchableOpacity } from "react-native";
import { Button, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { logout } from "../../redux/authSlice";
import { API_BASE_URL } from "../../services/api";

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const navigation = useNavigation<any>();
  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Control center</Text>
          <Text style={styles.title}>Settings</Text>
        </View>
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>{(user?.name || "User").slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user?.name || "Shop user"}</Text>
            <Text style={styles.meta}>{user?.email || "No email"}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>{user?.role || "staff"}</Text>
            </View>
          </View>
        </View>
        <View style={styles.panel}>
          <Text style={styles.section}>Connection</Text>
          <SettingRow label="API server" value={API_BASE_URL} />
          <SettingRow label="Auth state" value={user ? "Signed in" : "Signed out"} positive={!!user} />
        </View>
        <View style={styles.panel}>
          <Text style={styles.section}>App modules</Text>
          <ModuleRow label="Inventory" status="Ready" />
          <ModuleRow label="Sales billing" status="Ready" />
          <ModuleRow label="Customers" status="Ready" />
          <ModuleRow label="Dashboard" status="Live data" />
          <TouchableOpacity onPress={() => navigation.navigate("Reports")} style={styles.moduleLink}>
            <Text style={styles.moduleLabel}>Reports</Text>
            <Text style={styles.moduleStatus}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Expenses")} style={styles.moduleLink}>
            <Text style={styles.moduleLabel}>Expenses</Text>
            <Text style={styles.moduleStatus}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Vendors")} style={styles.moduleLink}>
            <Text style={styles.moduleLabel}>Vendors</Text>
            <Text style={styles.moduleStatus}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Orders")} style={styles.moduleLink}>
            <Text style={styles.moduleLabel}>Orders</Text>
            <Text style={styles.moduleStatus}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("Purchases")} style={styles.moduleLink}>
            <Text style={styles.moduleLabel}>Purchases</Text>
            <Text style={styles.moduleStatus}>Open</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("InventoryAdjustments")} style={styles.moduleLink}>
            <Text style={styles.moduleLabel}>Inventory Adjustments</Text>
            <Text style={styles.moduleStatus}>Open</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.dangerPanel}>
          <Text style={styles.section}>Session</Text>
          <Text style={styles.dangerHint}>Sign out clears the saved access token from this device.</Text>
          <Button onPress={() => dispatch(logout())} title="Sign out" />
        </View>
      </ScrollView>
    </Screen>
  );
}

function SettingRow({ label, positive, value }: { label: string; positive?: boolean; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text numberOfLines={2} style={[styles.rowValue, positive && styles.positive]}>{value}</Text>
    </View>
  );
}

function ModuleRow({ label, status }: { label: string; status: string }) {
  return (
    <View style={styles.moduleRow}>
      <View style={styles.moduleDot} />
      <Text style={styles.moduleLabel}>{label}</Text>
      <Text style={styles.moduleStatus}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 2 },
  profileCard: { alignItems: "center", backgroundColor: colors.secondary, borderRadius: 8, flexDirection: "row", marginBottom: spacing.md, padding: spacing.md },
  profileAvatar: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: 8, height: 58, justifyContent: "center", marginRight: spacing.md, width: 58 },
  profileAvatarText: { color: colors.primaryDark, fontSize: 20, fontWeight: "900" },
  profileInfo: { flex: 1 },
  name: { color: "#fff", fontSize: 20, fontWeight: "900" },
  meta: { color: colors.blueSoft, marginTop: 4 },
  rolePill: { alignSelf: "flex-start", backgroundColor: colors.blueSoft, borderRadius: 999, marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  roleText: { color: colors.primaryDark, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  dangerPanel: { backgroundColor: colors.surface, borderColor: "#fed7aa", borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  section: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
  row: { borderTopColor: colors.border, borderTopWidth: 1, paddingVertical: spacing.sm },
  rowLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", marginBottom: 4, textTransform: "uppercase" },
  rowValue: { color: colors.text, fontWeight: "800" },
  positive: { color: colors.success },
  moduleRow: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", paddingVertical: spacing.sm },
  moduleDot: { backgroundColor: colors.success, borderRadius: 5, height: 10, marginRight: spacing.sm, width: 10 },
  moduleLabel: { color: colors.text, flex: 1, fontWeight: "800" },
  moduleStatus: { color: colors.primaryDark, fontWeight: "900" },
  moduleLink: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", minHeight: 48, paddingVertical: spacing.sm },
  dangerHint: { color: colors.muted, marginBottom: spacing.sm },
});
