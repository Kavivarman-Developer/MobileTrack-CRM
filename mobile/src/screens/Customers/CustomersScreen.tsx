import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { createCustomer, Customer, deleteCustomer, getCustomers, updateCustomer } from "../../services/api";

const blank = { name: "", phone: "", address: "" };

export default function CustomersScreen() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(blank);
  const customers = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
  const queryClient = useQueryClient();
  const stats = useMemo(() => {
    const list = customers.data || [];
    return {
      count: list.length,
      pending: list.reduce((sum, item) => sum + Number(item.pendingBalance || 0), 0),
    };
  }, [customers.data]);
  const save = useMutation({
    mutationFn: () => (editing ? updateCustomer(editing._id, form) : createCustomer(form)),
    onSuccess: () => {
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: Error) => Alert.alert("Customer save failed", error.message),
  });
  const remove = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
    onError: (error: Error) => Alert.alert("Customer delete failed", error.message),
  });

  function openForm(customer?: Customer) {
    setEditing(customer || null);
    setForm(customer ? { name: customer.name, phone: customer.phone, address: customer.address || "" } : blank);
    setOpen(true);
  }

  function closeForm() {
    setEditing(null);
    setForm(blank);
    setOpen(false);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Customer book</Text>
          <Text style={styles.title}>Customers</Text>
        </View>
        <TouchableOpacity onPress={() => openForm()} style={styles.addButton}>
          <Ionicons color="#fff" name="add" size={22} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <View style={[styles.statIconWrap, { backgroundColor: colors.blueSoft }]}>
            <Ionicons color={colors.info} name="people-outline" size={16} />
          </View>
          <Text style={styles.statValue}>{stats.count}</Text>
          <Text style={styles.statLabel}>Customers</Text>
        </View>
        <View style={[styles.statCard, styles.statCardLast]}>
          <View style={[styles.statIconWrap, { backgroundColor: colors.orangeSoft }]}>
            <Ionicons color={colors.accent} name="alert-circle-outline" size={16} />
          </View>
          <Text style={[styles.statValue, stats.pending > 0 && styles.pendingValue]}>₹{formatMoney(stats.pending)}</Text>
          <Text style={styles.statLabel}>Pending balance</Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <Text style={styles.section}>Recent customers</Text>
        <TouchableOpacity onPress={() => openForm()} style={styles.toolbarButton}>
          <Ionicons color={colors.primaryDark} name="add" size={15} />
          <Text style={styles.toolbarButtonText}>Add new</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={customers.data || []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Empty text={customers.isLoading ? "Loading customers..." : "No customers yet."} />}
        renderItem={({ item }) => (
          <CustomerRow
            item={item}
            onDelete={() =>
              Alert.alert("Delete customer?", `Remove ${item.name}?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => remove.mutate(item._id) },
              ])
            }
            onEdit={() => openForm(item)}
          />
        )}
      />

      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>{editing ? "Update profile" : "New profile"}</Text>
              <Text style={styles.title}>{editing ? "Edit Customer" : "Add Customer"}</Text>
            </View>
            <TouchableOpacity onPress={closeForm} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" style={styles.formCard}>
            <Text style={styles.fieldLabel}>Customer name</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Name" value={form.name} />
            <Text style={styles.fieldLabel}>Phone number</Text>
            <Field keyboardType="phone-pad" onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="Phone" value={form.phone} />
            <Text style={styles.fieldLabel}>Address</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))} placeholder="Address" value={form.address} />
            <Button loading={save.isPending} onPress={() => save.mutate()} title="Save customer" />
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

function CustomerRow({ item, onDelete, onEdit }: { item: Customer; onDelete: () => void; onEdit: () => void }) {
  const hasPending = Number(item.pendingBalance || 0) > 0;
  return (
    <View style={styles.customerCard}>
      <TouchableOpacity onPress={onEdit} style={styles.customerMain}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.customerInfo}>
          <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons color={colors.muted} name="call-outline" size={12} />
            <Text style={styles.meta}>{item.phone}</Text>
          </View>
          <Text numberOfLines={1} style={styles.address}>{item.address || "No address added"}</Text>
        </View>
        <View style={styles.balanceCol}>
          <Text style={[styles.balanceValue, hasPending ? styles.balanceHotText : styles.balanceCalmText]}>₹{formatMoney(item.pendingBalance || 0)}</Text>
          <Badge label="Pending" tone={hasPending ? "danger" : "success"} />
        </View>
      </TouchableOpacity>
      <View style={styles.actionRow}>
        <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
          <Ionicons color={colors.primaryDark} name="create-outline" size={15} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={[styles.actionButton, styles.deleteButton]}>
          <Ionicons color={colors.danger} name="trash-outline" size={15} />
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, fontSize: 24, marginTop: 2 },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, height: 44, justifyContent: "center", width: 44, ...shadows.card, shadowOpacity: 0.18 },

  statsGrid: { flexDirection: "row", marginBottom: spacing.sm },
  statCard: { backgroundColor: colors.surface, borderRadius: radius.md, flex: 1, marginRight: spacing.sm, padding: spacing.sm, ...shadows.card },
  statCardLast: { marginRight: 0 },
  statIconWrap: { alignItems: "center", borderRadius: radius.sm, height: 28, justifyContent: "center", marginBottom: 6, width: 28 },
  statValue: { color: colors.text, fontSize: 17, fontWeight: "900" },
  pendingValue: { color: colors.accent },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 3 },

  toolbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  section: { color: colors.text, ...typography.h3, fontSize: 15 },
  toolbarButton: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.sm, flexDirection: "row", gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 7, ...shadows.card },
  toolbarButtonText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },

  listContent: { paddingBottom: spacing.lg },
  customerCard: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.sm, overflow: "hidden", ...shadows.card },
  customerMain: { alignItems: "center", flexDirection: "row", padding: spacing.md },
  avatar: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: radius.sm, height: 46, justifyContent: "center", marginRight: spacing.sm, width: 46 },
  avatarText: { color: colors.primaryDark, fontWeight: "900" },
  customerInfo: { flex: 1, paddingRight: spacing.sm },
  name: { color: colors.text, fontSize: 15, fontWeight: "800" },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 3 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  address: { color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  balanceCol: { alignItems: "flex-end" },
  balanceValue: { fontSize: 14, fontWeight: "900", marginBottom: 4 },
  balanceHotText: { color: colors.accent },
  balanceCalmText: { color: colors.success },

  actionRow: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row" },
  actionButton: { alignItems: "center", flex: 1, flexDirection: "row", gap: 5, justifyContent: "center", paddingVertical: spacing.sm },
  actionText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  deleteButton: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: "800" },

  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.sm, height: 40, justifyContent: "center", width: 40, ...shadows.card },
  formCard: { backgroundColor: colors.surface, borderRadius: radius.md, ...shadows.card },
  modalContent: { padding: spacing.md, paddingBottom: spacing.xl },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "800", marginBottom: spacing.xs, textTransform: "uppercase", letterSpacing: 0.3 },
});