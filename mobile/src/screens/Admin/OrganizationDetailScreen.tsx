import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { blockAdminUser, getAdminOrganization, getAdminOrganizationUsers, unblockAdminUser, updateAdminOrganization } from "../../services/api";

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
    onError: (error: Error) => Alert.alert("Update failed", error.message),
  });
  const updateSub = useMutation({
    mutationFn: (payload: any) => updateAdminOrganization(organizationId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organization", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
    },
    onError: (error: Error) => Alert.alert("Update failed", error.message),
  });
  const blockUser = useMutation({
    mutationFn: (userId: string) => blockAdminUser(userId, "Blocked by super admin"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organization-users", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
    },
  });
  const unblockUser = useMutation({
    mutationFn: unblockAdminUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organization-users", organizationId] });
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
    },
  });
  const dashboard = detail.data?.dashboard;
  const organization = detail.data?.organization;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons color={colors.text} name="chevron-back" size={20} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>TENANT DETAIL</Text>
            <Text style={styles.title}>{organization?.name || "Organization"}</Text>
          </View>
        </View>

        {detail.isLoading && <Empty icon="business-outline" text="Loading organization details..." />}

        {dashboard && (
          <>
            <View style={styles.grid}>
              <Metric icon="cube-outline" label="Products" value={dashboard.productCount} />
              <Metric icon="people-outline" label="Customers" value={dashboard.customerCount} />
              <Metric icon="receipt-outline" label="Orders" value={dashboard.totalOrders} />
              <Metric icon="cash-outline" label="Sales Total" value={`Rs ${formatMoney(dashboard.totalSales)}`} />
              <Metric icon="trending-up-outline" label="Net Profit" value={`Rs ${formatMoney(dashboard.totalProfit)}`} />
              <Metric icon="alert-circle-outline" label="Low Stock" value={dashboard.lowStockProductCount} />
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Subscription Settings</Text>
              <View style={styles.subscriptionCard}>
                <Text style={styles.subscriptionTitle}>{organization?.plan || "free"} • {organization?.billingCycle || "monthly"}</Text>
                <Text style={styles.meta}>Status: {organization?.subscriptionStatus || "trial"}</Text>
                <Text style={styles.meta}>Ends: {organization?.subscriptionEndDate ? new Date(organization.subscriptionEndDate).toLocaleDateString() : "Not set"}</Text>
                <Text style={styles.fieldLabel}>Billing Cycle</Text>
                <View style={styles.segment}>
                  <Choice active={organization?.billingCycle === "monthly"} label="Monthly" onPress={() => updateSub.mutate({ billingCycle: "monthly", renewSubscription: true })} />
                  <Choice active={organization?.billingCycle === "yearly"} label="Yearly" onPress={() => updateSub.mutate({ billingCycle: "yearly", renewSubscription: true })} />
                </View>
                <Text style={styles.fieldLabel}>Subscription Status</Text>
                <View style={styles.segment}>
                  <Choice active={organization?.subscriptionStatus === "active"} label="Active" onPress={() => updateSub.mutate({ subscriptionStatus: "active", isActive: true })} />
                  <Choice active={organization?.subscriptionStatus === "past_due"} label="Past Due" onPress={() => updateSub.mutate({ subscriptionStatus: "past_due" })} />
                  <Choice active={organization?.subscriptionStatus === "cancelled"} label="Cancel" onPress={() => updateSub.mutate({ subscriptionStatus: "cancelled", isActive: false })} />
                </View>
              </View>

              <View style={styles.subscriptionCard}>
                <View style={styles.settingRow}>
                  <View style={styles.settingCopy}>
                    <Text style={styles.subscriptionTitle}>Forgot Password Reset</Text>
                    <Text style={styles.meta}>{organization?.forgotPasswordEnabled ? "Shop owner can reset password from login" : "Hidden from shop owner login"}</Text>
                  </View>
                  <TouchableOpacity
                    disabled={updateSub.isPending}
                    onPress={() => updateSub.mutate({ forgotPasswordEnabled: !organization?.forgotPasswordEnabled })}
                    style={[styles.togglePill, organization?.forgotPasswordEnabled && styles.togglePillOn]}
                  >
                    <View style={[styles.toggleKnob, organization?.forgotPasswordEnabled && styles.toggleKnobOn]} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Tenant Users & Permissions</Text>
              {(users.data || []).map((user) => (
                <View key={user._id} style={styles.userRow}>
                  <View style={styles.userInfo}>
                    <View style={styles.userNameLine}>
                      <Text style={styles.userName}>{user.name}</Text>
                      <Badge label={user.isActive === false ? "Blocked" : "Active"} tone={user.isActive === false ? "danger" : "success"} />
                    </View>
                    <Text style={styles.meta}>{user.email}</Text>
                    {!!user.blockedReason && <Text style={styles.metaReason}>Reason: {user.blockedReason}</Text>}
                  </View>
                  <View style={styles.userActions}>
                    <Badge label={user.role} tone="info" />
                    <TouchableOpacity
                      disabled={blockUser.isPending || unblockUser.isPending}
                      onPress={() => user.isActive === false ? unblockUser.mutate(user._id) : blockUser.mutate(user._id)}
                      style={[styles.userActionButton, user.isActive === false ? styles.unblockButton : styles.blockButton]}
                    >
                      <Text style={[styles.userActionText, user.isActive !== false && styles.blockText]}>{user.isActive === false ? "Unblock" : "Block User"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>

            <Button
              icon={organization?.isActive ? "pause-circle-outline" : "play-circle-outline"}
              loading={toggle.isPending}
              onPress={() => toggle.mutate()}
              title={organization?.isActive ? "Suspend Organization" : "Reactivate Organization"}
              variant={organization?.isActive ? "danger" : "primary"}
            />
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Metric({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <Ionicons color={colors.primary} name={icon} size={20} />
      <Text numberOfLines={1} style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  header: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  headerCopy: { flex: 1 },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", height: 38, justifyContent: "center", paddingHorizontal: spacing.sm },
  backText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, marginTop: 2 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  metric: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, minHeight: 100, padding: spacing.md, width: "48%", ...shadows.card },
  metricValue: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: spacing.xs },
  metricLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },

  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  sectionTitle: { color: colors.text, ...typography.h3, marginBottom: spacing.sm },
  fieldLabel: { color: colors.text, ...typography.label, marginBottom: spacing.xs, marginTop: spacing.sm },

  subscriptionCard: { backgroundColor: colors.surfaceTint, borderRadius: radius.sm, marginBottom: spacing.md, padding: spacing.md },
  subscriptionTitle: { color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 2, textTransform: "capitalize" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  metaReason: { color: colors.danger, fontSize: 12, marginTop: 2 },

  settingRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  settingCopy: { flex: 1 },
  togglePill: { backgroundColor: colors.border, borderRadius: radius.pill, height: 30, justifyContent: "center", paddingHorizontal: 3, width: 52 },
  togglePillOn: { backgroundColor: colors.greenSoft },
  toggleKnob: { backgroundColor: colors.surface, borderRadius: radius.pill, height: 24, width: 24, ...shadows.card },
  toggleKnobOn: { alignSelf: "flex-end", backgroundColor: colors.success },

  segment: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  choice: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 6 },
  choiceActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  choiceText: { color: colors.text, fontSize: 12, fontWeight: "500" },
  choiceTextActive: { color: colors.primary, fontWeight: "700" },

  userRow: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, paddingVertical: spacing.sm },
  userInfo: { flex: 1 },
  userNameLine: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  userName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  userActions: { alignItems: "flex-end", gap: spacing.xs },
  userActionButton: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6, marginTop: 4 },
  blockButton: { backgroundColor: colors.redSoft },
  unblockButton: { backgroundColor: colors.greenSoft },
  userActionText: { fontSize: 12, fontWeight: "600" },
  blockText: { color: colors.danger },
});
