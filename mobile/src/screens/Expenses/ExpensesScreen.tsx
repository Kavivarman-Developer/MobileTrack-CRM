import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Empty, FabButton, Field, IconButton, IosFormSheet, IosScreenHeader, Screen, StatStrip } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { createExpense, deleteExpense, Expense, getExpenses, updateExpense } from "../../services/api";

const blank = { description: "", amount: "", category: "general", date: new Date().toISOString().slice(0, 10), notes: "" };

export default function ExpensesScreen({ navigation }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(blank);
  const [from, setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const queryClient = useQueryClient();
  const expenses = useQuery({ queryKey: ["expenses", from, to], queryFn: () => getExpenses({ from, to }) });
  const items = useMemo(() => expenses.data?.items || [], [expenses.data]);
  const save = useMutation({
    mutationFn: () => {
      const payload = { description: form.description, amount: Number(form.amount), category: form.category, date: form.date, notes: form.notes };
      return editing ? updateExpense(editing._id, payload) : createExpense(payload);
    },
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      setForm(blank);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => Alert.alert("Expense save failed", error.message),
  });
  const remove = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  function openForm(expense?: Expense) {
    setEditing(expense || null);
    setForm(expense ? {
      description: expense.description,
      amount: String(expense.amount),
      category: expense.category,
      date: expense.date.slice(0, 10),
      notes: expense.notes || "",
    } : blank);
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditing(null);
    setForm(blank);
  }

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="Expenses"
        left={<IconButton accessibilityLabel="Go back" icon="chevron-back" onPress={() => navigation.goBack()} />}
        title="Expenses"
      />

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            <StatStrip
              items={[
                { label: "Total spend", value: `₹${formatMoney(expenses.data?.total || 0)}`, icon: "wallet-outline", tone: "orange" },
                { label: "Entries", value: String(items.length), icon: "list-outline", tone: "purple" },
                { label: "Avg entry", value: `₹${formatMoney(items.length ? (expenses.data?.total || 0) / items.length : 0)}`, icon: "trending-up-outline", tone: "blue" },
              ]}
            />

            <View style={styles.filters}>
              <View style={styles.filterHalf}>
                <Text style={styles.fieldLabel}>From</Text>
                <Field onChangeText={setFrom} placeholder="YYYY-MM-DD" style={styles.filterField} value={from} />
              </View>
              <View style={styles.filterHalf}>
                <Text style={styles.fieldLabel}>To</Text>
                <Field onChangeText={setTo} placeholder="YYYY-MM-DD" style={styles.filterField} value={to} />
              </View>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>Expenses</Text>
              <Text style={styles.listCount}>{items.length}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Empty icon="wallet-outline" text={expenses.isLoading ? "Loading expenses…" : "No expenses for this period."} />
            {!expenses.isLoading ? (
              <TouchableOpacity onPress={() => openForm()} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>Add expense</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={[styles.accent, { backgroundColor: ios.orange }]} />
            <View style={styles.cardInner}>
              <TouchableOpacity onPress={() => openForm(item)} style={styles.cardMain}>
                <View style={[styles.avatar, { backgroundColor: "#FF95001F" }]}>
                  <Ionicons color={ios.orange} name="wallet" size={18} />
                </View>
                <View style={styles.cardCopy}>
                  <Text numberOfLines={1} style={styles.cardTitle}>{item.description}</Text>
                  <View style={styles.metaRow}>
                    <Badge label={item.category} tone="neutral" />
                    <Text style={styles.meta}>{item.date.slice(0, 10)}</Text>
                  </View>
                </View>
                <Text style={styles.amount}>₹{formatMoney(item.amount)}</Text>
              </TouchableOpacity>
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => openForm(item)} style={styles.actionBtn}>
                  <Ionicons color={ios.blue} name="create-outline" size={15} />
                  <Text style={styles.actionEdit}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove.mutate(item._id)} style={[styles.actionBtn, styles.actionDelete]}>
                  <Ionicons color={ios.red} name="trash-outline" size={15} />
                  <Text style={styles.actionDeleteText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      />

      <FabButton accessibilityLabel="Add expense" onPress={() => openForm()} />

      <IosFormSheet
        eyebrow={editing ? "Update expense" : "New expense"}
        footerLabel={save.isPending ? "Saving…" : "Save"}
        footerLoading={save.isPending}
        onClose={closeForm}
        onFooterPress={() => save.mutate()}
        title={editing ? "Edit Expense" : "Add Expense"}
        visible={open}
      >
        <Text style={styles.fieldLabel}>Description</Text>
        <Field onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))} placeholder="e.g. Electricity bill" value={form.description} />
        <Text style={styles.fieldLabel}>Amount (₹)</Text>
        <Field keyboardType="numeric" onChangeText={(value) => setForm((prev) => ({ ...prev, amount: value }))} placeholder="0.00" value={form.amount} />
        <Text style={styles.fieldLabel}>Category</Text>
        <Field onChangeText={(value) => setForm((prev) => ({ ...prev, category: value }))} placeholder="Utilities, Rent…" value={form.category} />
        <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
        <Field onChangeText={(value) => setForm((prev) => ({ ...prev, date: value }))} value={form.date} />
        <Text style={styles.fieldLabel}>Notes</Text>
        <Field multiline onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))} placeholder="Additional notes…" value={form.notes} />
      </IosFormSheet>
    </Screen>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  screen: { backgroundColor: ios.bg },
  content: { alignSelf: "center", maxWidth: 430, paddingBottom: 110, width: "100%" },
  filters: { flexDirection: "row", gap: 10, marginBottom: 4, marginTop: 14 },
  filterHalf: { flex: 1 },
  filterField: { marginBottom: 0 },
  fieldLabel: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13, marginBottom: 6, marginTop: 10 },
  sectionHead: { alignItems: "center", flexDirection: "row", marginBottom: 8, marginLeft: 4, marginTop: 14 },
  sectionLabel: { color: ios.secondary, flex: 1, fontFamily: fonts.regular, fontSize: 13 },
  listCount: {
    backgroundColor: ios.fill,
    borderRadius: 999,
    color: ios.label,
    fontFamily: fonts.semibold,
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  card: {
    backgroundColor: ios.card,
    borderRadius: 18,
    flexDirection: "row",
    marginBottom: 10,
    overflow: "hidden",
  },
  accent: { width: 4 },
  cardInner: { flex: 1, minWidth: 0 },
  cardMain: { alignItems: "center", flexDirection: "row", gap: 10, padding: 14 },
  avatar: { alignItems: "center", borderRadius: 14, height: 40, justifyContent: "center", width: 40 },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 16 },
  metaRow: { alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  meta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12 },
  amount: { color: ios.label, fontFamily: fonts.bold, fontSize: 17 },
  actions: { borderTopColor: ios.separator, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: "row" },
  actionBtn: { alignItems: "center", flex: 1, flexDirection: "row", gap: 4, justifyContent: "center", paddingVertical: 12 },
  actionEdit: { color: ios.blue, fontFamily: fonts.semibold, fontSize: 13 },
  actionDelete: { borderLeftColor: ios.separator, borderLeftWidth: StyleSheet.hairlineWidth },
  actionDeleteText: { color: ios.red, fontFamily: fonts.semibold, fontSize: 13 },
  emptyCard: { alignItems: "center", backgroundColor: ios.card, borderRadius: 18, padding: 20 },
  emptyBtn: {
    backgroundColor: ios.dark,
    borderRadius: 14,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 18,
  },
  emptyBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 14, textAlign: "center" },
});
