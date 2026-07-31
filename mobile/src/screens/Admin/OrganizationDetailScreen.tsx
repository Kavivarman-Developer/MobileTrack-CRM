import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing } from "../../constants/theme";
import { getAdminOrganization, getAdminOrganizationUsers, updateAdminOrganization } from "../../services/api";

export default function OrganizationDetailScreen({ navigation, route }: any) {
  const organizationId = route.params?.organizationId;
  const detail = useQuery({ queryKey: ["admin-organization", organizationId], queryFn: () => getAdminOrganization(organizationId), enabled: !!organizationId });
  const users = useQuery({ queryKey: ["admin-organization-users", organizationId], queryFn: () => getAdminOrganizationUsers(organizationId), enabled: !!organizationId });
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: () => updateAdminOrganization(organizationId, { isActive: !detail.data?.organization.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organization", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
    },
  });
  const dashboard = detail.data?.dashboard;
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>Back</Text></TouchableOpacity>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>Tenant detail</Text><Text style={styles.title}>{detail.data?.organization.name || "Organization"}</Text></View>
        </View>
        {detail.isLoading && <Empty text="Loading organization..." />}
        {dashboard && (
          <>
            <View style={styles.grid}>
              <Metric icon="cube-outline" label="Products" value={dashboard.productCount} />
              <Metric icon="people-outline" label="Customers" value={dashboard.customerCount} />
              <Metric icon="receipt-outline" label="Orders" value={dashboard.totalOrders} />
              <Metric icon="cash-outline" label="Sales" value={`Rs ${formatMoney(dashboard.totalSales)}`} />
              <Metric icon="trending-up-outline" label="Profit" value={`Rs ${formatMoney(dashboard.totalProfit)}`} />
              <Metric icon="alert-circle-outline" label="Low Stock" value={dashboard.lowStockProductCount} />
            </View>
            <View style={styles.panel}>
              <Text style={styles.section}>Users</Text>
              {(users.data || []).map((user) => (
                <View key={user._id} style={styles.userRow}>
                  <View><Text style={styles.userName}>{user.name}</Text><Text style={styles.meta}>{user.email}</Text></View>
                  <Text style={styles.role}>{user.role}</Text>
                </View>
              ))}
            </View>
            <Button loading={toggle.isPending} onPress={() => toggle.mutate()} title={detail.data?.organization.isActive ? "Suspend organization" : "Reactivate organization"} />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Metric({ icon, label, value }: { icon: any; label: string; value: string | number }) {
  return <View style={styles.metric}><Ionicons color={colors.primaryDark} name={icon} size={20} /><Text numberOfLines={1} style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  header: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  headerCopy: { flex: 1 },
  backButton: { alignItems: "center", backgroundColor: colors.blueSoft, borderColor: colors.secondary, borderRadius: radius.md, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  backText: { color: colors.secondary, fontWeight: "900" },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  metric: { backgroundColor: colors.surface, borderRadius: radius.md, minHeight: 108, padding: spacing.md, width: "48%", ...shadows.card },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: spacing.sm },
  metricLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  panel: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  section: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
  userRow: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  userName: { color: colors.text, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  role: { color: colors.primaryDark, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
});
