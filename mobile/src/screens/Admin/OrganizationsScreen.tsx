import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing } from "../../constants/theme";
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
          <Text style={styles.eyebrow}>Platform monitor</Text>
          <Text style={styles.title}>Admin</Text>
        </View>
        <TouchableOpacity onPress={() => setOpen(true)} style={styles.addOwnerButton}>
          <Ionicons color="#fff" name="person-add-outline" size={18} />
          <Text style={styles.addOwnerText}>Owner</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={organizations.data || []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={<Empty text={organizations.isLoading ? "Loading organizations..." : "No organizations yet."} />}
        renderItem={({ item }) => <OrgRow item={item} onPress={() => navigation.navigate("OrganizationDetail", { organizationId: item._id })} />}
      />
      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.modalHeader}>
            <View><Text style={styles.eyebrow}>New tenant</Text><Text style={styles.title}>Create Shop Owner</Text></View>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}><Ionicons color={colors.text} name="close" size={20} /></TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.formCard}>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, businessName: value }))} placeholder="Shop / business name" value={form.businessName} />
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Owner name" value={form.name} />
            <Field autoCapitalize="none" keyboardType="email-address" onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))} placeholder="Owner email" value={form.email} />
            <Field keyboardType="phone-pad" onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="Phone" value={form.phone} />
            <Field secureTextEntry onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))} placeholder="Temporary password" value={form.password} />
            <Text style={styles.label}>Subscription</Text>
            <View style={styles.segment}>
              {["basic", "premium", "enterprise"].map((plan) => <SegmentButton key={plan} active={form.plan === plan} label={plan} onPress={() => setForm((prev) => ({ ...prev, plan }))} />)}
            </View>
            <View style={styles.segment}>
              <SegmentButton active={form.billingCycle === "monthly"} label="monthly" onPress={() => setForm((prev) => ({ ...prev, billingCycle: "monthly" }))} />
              <SegmentButton active={form.billingCycle === "yearly"} label="yearly" onPress={() => setForm((prev) => ({ ...prev, billingCycle: "yearly" }))} />
            </View>
            <Button loading={createOwner.isPending} onPress={() => createOwner.mutate()} title="Create owner login" />
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
        <View style={styles.orgIcon}><Ionicons color={colors.primaryDark} name="business-outline" size={22} /></View>
        <View style={styles.orgInfo}>
          <Text style={styles.orgName}>{item.name}</Text>
          <Text style={styles.meta}>{item.ownerEmail || "No owner email"}</Text>
        </View>
        <View style={[styles.statusPill, item.isActive ? styles.activePill : styles.inactivePill]}>
          <Text style={styles.statusText}>{item.isActive ? "Active" : "Paused"}</Text>
        </View>
      </View>
      <View style={styles.subRow}>
        <Text style={styles.planText}>{item.plan || "free"} / {item.billingCycle || "monthly"}</Text>
        <Text style={styles.subText}>{item.subscriptionStatus || "trial"}{item.subscriptionEndDate ? ` until ${formatDate(item.subscriptionEndDate)}` : ""}</Text>
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
  return <View style={styles.stat}><Text numberOfLines={1} style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[styles.segmentButton, active && styles.segmentActive]}><Text style={styles.segmentText}>{label}</Text></TouchableOpacity>;
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  content: { paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  cardTop: { alignItems: "center", flexDirection: "row", marginBottom: spacing.md },
  orgIcon: { alignItems: "center", backgroundColor: colors.orangeSoft, borderRadius: radius.sm, height: 44, justifyContent: "center", marginRight: spacing.sm, width: 44 },
  orgInfo: { flex: 1 },
  orgName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  activePill: { backgroundColor: colors.greenSoft },
  inactivePill: { backgroundColor: colors.redSoft },
  statusText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  addOwnerButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, flexDirection: "row", gap: 5, minHeight: 42, paddingHorizontal: spacing.md },
  addOwnerText: { color: "#fff", fontWeight: "900" },
  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.sm, height: 42, justifyContent: "center", width: 42, ...shadows.card },
  formCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, ...shadows.card },
  label: { color: colors.text, fontSize: 12, fontWeight: "900", marginBottom: spacing.xs, textTransform: "uppercase" },
  segment: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  segmentButton: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  segmentActive: { backgroundColor: colors.orangeSoft, borderColor: colors.primary },
  segmentText: { color: colors.text, fontWeight: "900", textTransform: "capitalize" },
  subRow: { backgroundColor: colors.background, borderRadius: radius.sm, marginBottom: spacing.sm, padding: spacing.sm },
  planText: { color: colors.text, fontSize: 12, fontWeight: "900", textTransform: "capitalize" },
  subText: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 2, textTransform: "capitalize" },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  stat: { backgroundColor: colors.background, borderRadius: radius.sm, flex: 1, padding: spacing.sm },
  statValue: { color: colors.text, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
