import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useState } from "react";
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
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
    mutationFn: () => editing ? updateCustomer(editing._id, form) : createCustomer(form),
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
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.count}</Text>
          <Text style={styles.statLabel}>Customers</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, stats.pending > 0 && styles.pendingValue]}>Rs {formatMoney(stats.pending)}</Text>
          <Text style={styles.statLabel}>Pending balance</Text>
        </View>
      </View>
      <View style={styles.toolbar}>
        <Text style={styles.section}>Recent customers</Text>
        <TouchableOpacity onPress={() => openForm()} style={styles.toolbarButton}>
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
            onDelete={() => Alert.alert("Delete customer?", `Remove ${item.name}?`, [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => remove.mutate(item._id) },
            ])}
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
              <Text style={styles.closeButtonText}>x</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Customer name</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Name" value={form.name} />
            <Text style={styles.fieldLabel}>Phone number</Text>
            <Field keyboardType="phone-pad" onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="Phone" value={form.phone} />
            <Text style={styles.fieldLabel}>Address</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))} placeholder="Address" value={form.address} />
            <Button loading={save.isPending} onPress={() => save.mutate()} title="Save customer" />
          </View>
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
          <Text style={styles.meta}>{item.phone}</Text>
          <Text numberOfLines={1} style={styles.meta}>{item.address || "No address added"}</Text>
        </View>
        <View style={[styles.balancePill, hasPending ? styles.balanceHot : styles.balanceCalm]}>
          <Text style={[styles.balanceValue, hasPending ? styles.balanceHotText : styles.balanceCalmText]}>Rs {formatMoney(item.pendingBalance || 0)}</Text>
          <Text style={styles.balanceLabel}>pending</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.actionRow}>
        <TouchableOpacity onPress={onEdit} style={styles.actionButton}><Text style={styles.actionText}>Edit</Text></TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={[styles.actionButton, styles.deleteButton]}><Text style={styles.deleteText}>Delete</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 2 },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 46, justifyContent: "center", width: 46 },
  addButtonText: { color: "#fff", fontSize: 28, fontWeight: "700", marginTop: -2 },
  statsGrid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  statCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, padding: spacing.md },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  pendingValue: { color: colors.accent },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  toolbar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  section: { color: colors.text, fontSize: 18, fontWeight: "900" },
  toolbarButton: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  toolbarButtonText: { color: colors.primaryDark, fontWeight: "900" },
  listContent: { paddingBottom: spacing.lg },
  customerCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, overflow: "hidden" },
  customerMain: { alignItems: "center", flexDirection: "row", padding: spacing.md },
  avatar: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: 8, height: 48, justifyContent: "center", marginRight: spacing.sm, width: 48 },
  avatarText: { color: colors.primaryDark, fontWeight: "900" },
  customerInfo: { flex: 1, paddingRight: spacing.sm },
  name: { color: colors.text, fontSize: 16, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  balancePill: { alignItems: "center", borderRadius: 8, minWidth: 78, padding: spacing.xs },
  balanceHot: { backgroundColor: colors.orangeSoft },
  balanceCalm: { backgroundColor: colors.greenSoft },
  balanceValue: { fontSize: 12, fontWeight: "900" },
  balanceHotText: { color: colors.accent },
  balanceCalmText: { color: colors.success },
  balanceLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },
  actionRow: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row" },
  actionButton: { alignItems: "center", flex: 1, paddingVertical: spacing.sm },
  actionText: { color: colors.primaryDark, fontWeight: "900" },
  deleteButton: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  deleteText: { color: colors.danger, fontWeight: "900" },
  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  closeButtonText: { color: colors.text, fontSize: 18, fontWeight: "900" },
  formCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, padding: spacing.md },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.xs },
});
