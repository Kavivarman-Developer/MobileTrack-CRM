import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Empty, FabButton, Field, IosFormSheet, IosScreenHeader, IosSearchBar, Screen, StatStrip } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { createCustomer, Customer, deleteCustomer, getCustomers, updateCustomer } from "../../services/api";

const blank = { name: "", phone: "", address: "" };

export default function CustomersScreen() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState("");
  const customers = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
  const queryClient = useQueryClient();
  const stats = useMemo(() => {
    const list = customers.data || [];
    return {
      count: list.length,
      pending: list.reduce((sum, item) => sum + Number(item.pendingBalance || 0), 0),
      pendingCount: list.filter((item) => Number(item.pendingBalance || 0) > 0).length,
    };
  }, [customers.data]);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (customers.data || []).filter((item) => {
      if (!keyword) return true;
      return `${item.name} ${item.phone || ""} ${item.address || ""}`.toLowerCase().includes(keyword);
    });
  }, [customers.data, search]);
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
    <Screen style={styles.screen}>
      <IosScreenHeader eyebrow="Customers" title="Customers" />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            <StatStrip
              items={[
                { label: "Customers", value: String(stats.count), icon: "people-outline", tone: "purple" },
                { label: "Pending", value: String(stats.pendingCount), icon: "time-outline", tone: "orange" },
                { label: "Balance due", value: `₹${formatMoney(stats.pending)}`, icon: "wallet-outline", tone: "green" },
              ]}
            />
            <IosSearchBar onChangeText={setSearch} placeholder="Search name, phone…" value={search} />
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>Customer profiles</Text>
              <Text style={styles.listCount}>{filtered.length}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Empty icon="people-outline" text={customers.isLoading ? "Loading customers…" : "No customers yet."} />
            {!customers.isLoading ? (
              <TouchableOpacity onPress={() => openForm()} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>Add customer</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
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

      <FabButton accessibilityLabel="Add customer" onPress={() => openForm()} />

      <IosFormSheet
        eyebrow={editing ? "Update profile" : "New profile"}
        footerLabel={save.isPending ? "Saving…" : "Save"}
        footerLoading={save.isPending}
        onClose={closeForm}
        onFooterPress={() => save.mutate()}
        title={editing ? "Edit Customer" : "Add Customer"}
        visible={open}
      >
        <Text style={styles.fieldLabel}>Customer name</Text>
        <Field onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Full customer name" value={form.name} />
        <Text style={styles.fieldLabel}>Phone number</Text>
        <Field keyboardType="phone-pad" onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="+91…" value={form.phone} />
        <Text style={styles.fieldLabel}>Address / location</Text>
        <Field onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))} placeholder="Billing or delivery address" value={form.address} />
      </IosFormSheet>
    </Screen>
  );
}

function CustomerRow({ item, onDelete, onEdit }: { item: Customer; onDelete: () => void; onEdit: () => void }) {
  const hasPending = Number(item.pendingBalance || 0) > 0;
  const tone = hasPending ? ios.orange : ios.green;
  return (
    <View style={styles.card}>
      <View style={[styles.accent, { backgroundColor: tone }]} />
      <View style={styles.cardInner}>
        <TouchableOpacity onPress={onEdit} style={styles.cardMain}>
          <View style={[styles.avatar, { backgroundColor: `${tone}1F` }]}>
            <Text style={[styles.avatarText, { color: tone }]}>{item.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.cardCopy}>
            <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
            <View style={styles.metaRow}>
              <Ionicons color={ios.secondary} name="call-outline" size={12} />
              <Text style={styles.meta}>{item.phone || "No phone"}</Text>
            </View>
            <Text numberOfLines={1} style={styles.address}>{item.address || "No address added"}</Text>
          </View>
          <View style={styles.balanceCol}>
            <Text style={[styles.balance, { color: tone }]}>₹{formatMoney(item.pendingBalance || 0)}</Text>
            <Badge label={hasPending ? "Pending" : "Clear"} tone={hasPending ? "warning" : "success"} />
          </View>
        </TouchableOpacity>
        <View style={styles.actions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
            <Ionicons color={ios.blue} name="create-outline" size={15} />
            <Text style={styles.actionEdit}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={[styles.actionBtn, styles.actionDelete]}>
            <Ionicons color={ios.red} name="trash-outline" size={15} />
            <Text style={styles.actionDeleteText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  screen: { backgroundColor: ios.bg },
  content: { alignSelf: "center", maxWidth: 430, paddingBottom: 85, width: "100%" },
  sectionHead: { alignItems: "center", flexDirection: "row", marginBottom: spacing.xs, marginLeft: spacing.xxs, marginTop: 11 },
  sectionLabel: { color: ios.secondary, flex: 1, fontFamily: fonts.regular, fontSize: 13 },
  listCount: {
    backgroundColor: ios.fill,
    borderRadius: 999,
    color: ios.label,
    fontFamily: fonts.semibold,
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  card: {
    backgroundColor: ios.card,
    borderRadius: 18,
    flexDirection: "row",
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  accent: { width: 4 },
  cardInner: { flex: 1, minWidth: 0 },
  cardMain: { alignItems: "center", flexDirection: "row", gap: spacing.sm, padding: 11 },
  avatar: { alignItems: "center", borderRadius: 14, height: 44, justifyContent: "center", width: 44 },
  avatarText: { fontFamily: fonts.bold, fontSize: 14 },
  cardCopy: { flex: 1, minWidth: 0 },
  name: { color: ios.label, fontFamily: fonts.semibold, fontSize: 16 },
  metaRow: { alignItems: "center", flexDirection: "row", gap: spacing.xxs, marginTop: 2 },
  meta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12 },
  address: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  balanceCol: { alignItems: "flex-end", gap: spacing.xxs },
  balance: { fontFamily: fonts.bold, fontSize: 15 },
  actions: { borderTopColor: ios.separator, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
  actionBtn: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.xxs, justifyContent: "center", paddingVertical: spacing.sm },
  actionEdit: { color: ios.blue, fontFamily: fonts.semibold, fontSize: 13 },
  actionDelete: { borderLeftColor: ios.separator, borderLeftWidth: StyleSheet.hairlineWidth },
  actionDeleteText: { color: ios.red, fontFamily: fonts.semibold, fontSize: 13 },
  emptyCard: { alignItems: "center", backgroundColor: ios.card, borderRadius: 18, padding: spacing.lg },
  emptyBtn: {
    backgroundColor: ios.dark,
    borderRadius: 14,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 14,
  },
  emptyBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 14, textAlign: "center" },
  fieldLabel: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13, marginBottom: spacing.xs, marginTop: spacing.sm },
});
