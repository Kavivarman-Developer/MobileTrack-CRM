import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { AdminOrganizationRow, createShopOwner, getAdminOrganizations } from "../../services/api";

const blankOwner = { name: "", email: "", password: "", phone: "", businessName: "", plan: "basic", billingCycle: "monthly" as "monthly" | "yearly" };

export default function OrganizationsScreen({ navigation }: any) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blankOwner);
  const organizations = useQuery({ queryKey: ["admin-organizations"], queryFn: getAdminOrganizations });
  const queryClient = useQueryClient();
  const createOwner = useMutation({
    mutationFn: () => createShopOwner(form),
    onSuccess: () => {
      setOpen(false);
      setForm(blankOwner);
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      Alert.alert("Shop owner created", `${form.email} can now log in with the password you set.`);
    },
    onError: (error: Error) => Alert.alert("Create failed", error.message),
  });

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>PLATFORM MONITOR</Text>
          <Text style={styles.title}>Super Admin</Text>
        </View>
        <TouchableOpacity onPress={() => setOpen(true)} style={styles.addOwnerButton}>
          <Ionicons color="#ffffff" name="person-add-outline" size={16} style={{ marginRight: 4 }} />
          <Text style={styles.addOwnerText}>+ Owner</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={organizations.data || []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={<Empty icon="shield-checkmark-outline" text={organizations.isLoading ? "Loading organizations..." : "No organizations registered yet."} />}
        renderItem={({ item }) => <OrgRow item={item} onPress={() => navigation.navigate("OrganizationDetail", { organizationId: item._id })} />}
      />

      {/* Create Shop Owner Modal */}
      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>NEW TENANT</Text>
              <Text style={styles.title}>Create Shop Owner</Text>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.formCard}>
            <Text style={styles.fieldLabel}>Shop / Business Name</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, businessName: value }))} placeholder="e.g. Metro Electronics" value={form.businessName} />
            <Text style={styles.fieldLabel}>Owner Full Name</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Owner name" value={form.name} />
            <Text style={styles.fieldLabel}>Email Address</Text>
            <Field autoCapitalize="none" keyboardType="email-address" onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))} placeholder="owner@shop.com" value={form.email} />
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <Field keyboardType="phone-pad" onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="+91..." value={form.phone} />
            <Text style={styles.fieldLabel}>Temporary Password</Text>
            <Field secureTextEntry onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))} placeholder="Password (min 6 chars)" value={form.password} />
            <Text style={styles.fieldLabel}>Subscription Plan</Text>
            <View style={styles.segment}>
              {["basic", "premium", "enterprise"].map((plan) => <SegmentButton key={plan} active={form.plan === plan} label={plan} onPress={() => setForm((prev) => ({ ...prev, plan }))} />)}
            </View>
            <Text style={styles.fieldLabel}>Billing Cycle</Text>
            <View style={styles.segment}>
              <SegmentButton active={form.billingCycle === "monthly"} label="Monthly" onPress={() => setForm((prev) => ({ ...prev, billingCycle: "monthly" }))} />
              <SegmentButton active={form.billingCycle === "yearly"} label="Yearly" onPress={() => setForm((prev) => ({ ...prev, billingCycle: "yearly" }))} />
            </View>
            <Button icon="checkmark-circle-outline" loading={createOwner.isPending} onPress={() => createOwner.mutate()} title="Create Shop Owner Login" />
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

function OrgRow({ item, onPress }: { item: AdminOrganizationRow; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.orgIcon}>
          <Ionicons color={colors.primary} name="business-outline" size={20} />
        </View>
        <View style={styles.orgInfo}>
          <Text style={styles.orgName}>{item.name}</Text>
          <Text style={styles.meta}>{item.ownerEmail || "No owner email"}</Text>
        </View>
        <Badge label={item.isActive ? "Active" : "Paused"} tone={item.isActive ? "success" : "danger"} />
      </View>
      <View style={styles.subRow}>
        <Text style={styles.planText}>{item.plan || "free"} • {item.billingCycle || "monthly"}</Text>
        <Text style={styles.subText}>Status: {item.subscriptionStatus || "trial"}{item.subscriptionEndDate ? ` until ${formatDate(item.subscriptionEndDate)}` : ""}</Text>
      </View>
      <View style={styles.statsRow}>
        <MiniStat label="Products" value={item.stats.productCount} />
        <MiniStat label="Orders" value={item.stats.totalOrders} />
        <MiniStat label="Sales" value={`Rs ${formatMoney(item.stats.totalSales)}`} />
      </View>
    </TouchableOpacity>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text numberOfLines={1} style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.segmentButton, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, marginTop: 2 },
  content: { paddingBottom: spacing.xl },

  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  cardTop: { alignItems: "center", flexDirection: "row", marginBottom: spacing.sm },
  orgIcon: { alignItems: "center", backgroundColor: colors.primaryLight, borderRadius: radius.sm, height: 42, justifyContent: "center", marginRight: spacing.sm, width: 42 },
  orgInfo: { flex: 1 },
  orgName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },

  addOwnerButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, flexDirection: "row", minHeight: 40, paddingHorizontal: spacing.md },
  addOwnerText: { color: "#ffffff", fontWeight: "600", fontSize: 13 },

  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  closeButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 40, justifyContent: "center", width: 40 },
  formCard: { backgroundColor: colors.surface, borderRadius: radius.md },
  fieldLabel: { color: colors.text, ...typography.label, marginBottom: spacing.xs, marginTop: spacing.xs },

  segment: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  segmentButton: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 8 },
  segmentActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  segmentText: { color: colors.text, fontSize: 12, fontWeight: "500", textTransform: "capitalize" },
  segmentTextActive: { color: colors.primary, fontWeight: "700" },

  subRow: { backgroundColor: colors.surfaceTint, borderRadius: radius.sm, marginBottom: spacing.sm, padding: spacing.sm },
  planText: { color: colors.text, fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  subText: { color: colors.muted, fontSize: 11, marginTop: 2, textTransform: "capitalize" },

  statsRow: { flexDirection: "row", gap: spacing.xs },
  stat: { backgroundColor: colors.surfaceTint, borderRadius: radius.sm, flex: 1, padding: spacing.sm },
  statValue: { color: colors.text, fontWeight: "700", fontSize: 14 },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
