import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
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

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View>
          <Text style={styles.eyebrow}>Shop spending</Text>
          <Text style={styles.title}>Expenses</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => openForm()} style={styles.addButton}><Text style={styles.addButtonText}>+</Text></TouchableOpacity>
      </View>
      <View style={styles.filters}>
        <View style={styles.filterHalf}><Text style={styles.label}>From</Text><Field onChangeText={setFrom} value={from} /></View>
        <View style={styles.filterHalf}><Text style={styles.label}>To</Text><Field onChangeText={setTo} value={to} /></View>
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Selected period total</Text>
        <Text style={styles.totalValue}>Rs {formatMoney(expenses.data?.total || 0)}</Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        ListEmptyComponent={<Empty text={expenses.isLoading ? "Loading expenses..." : "No expenses for this period."} />}
        renderItem={({ item }) => (
          <View style={styles.expenseCard}>
            <TouchableOpacity onPress={() => openForm(item)} style={styles.expenseMain}>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseTitle}>{item.description}</Text>
                <Text style={styles.expenseMeta}>{item.category} | {item.date.slice(0, 10)}</Text>
              </View>
              <Text style={styles.expenseAmount}>Rs {formatMoney(item.amount)}</Text>
            </TouchableOpacity>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => openForm(item)} style={styles.actionButton}><Text style={styles.actionText}>Edit</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => remove.mutate(item._id)} style={[styles.actionButton, styles.deleteButton]}><Text style={styles.deleteText}>Delete</Text></TouchableOpacity>
            </View>
          </View>
        )}
      />
      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.header}>
            <Text style={styles.title}>{editing ? "Edit Expense" : "Add Expense"}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>x</Text></TouchableOpacity>
          </View>
          <View style={styles.formCard}>
            <Text style={styles.label}>Description</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))} value={form.description} />
            <Text style={styles.label}>Amount</Text>
            <Field keyboardType="numeric" onChangeText={(value) => setForm((prev) => ({ ...prev, amount: value }))} value={form.amount} />
            <Text style={styles.label}>Category</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, category: value }))} value={form.category} />
            <Text style={styles.label}>Date</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, date: value }))} value={form.date} />
            <Text style={styles.label}>Notes</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))} value={form.notes} />
            <Button loading={save.isPending} onPress={() => save.mutate()} title="Save expense" />
          </View>
        </Screen>
      </Modal>
    </Screen>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  headerLeft: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  backButton: { alignItems: "center", backgroundColor: colors.blueSoft, borderColor: colors.secondary, borderRadius: 8, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  backText: { color: colors.secondary, fontWeight: "900" },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900" },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 48, justifyContent: "center", width: 48 },
  addButtonText: { color: "#fff", fontSize: 28, fontWeight: "700", marginTop: -2 },
  filters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  filterHalf: { flex: 1 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.xs },
  totalCard: { backgroundColor: colors.accent, borderRadius: 8, marginBottom: spacing.md, padding: spacing.md },
  totalLabel: { color: "#fff7ed", fontWeight: "800" },
  totalValue: { color: "#fff", fontSize: 28, fontWeight: "900", marginTop: 2 },
  expenseCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, overflow: "hidden" },
  expenseMain: { alignItems: "center", flexDirection: "row", padding: spacing.md },
  expenseInfo: { flex: 1 },
  expenseTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  expenseMeta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  expenseAmount: { color: colors.accent, fontWeight: "900" },
  actions: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row" },
  actionButton: { alignItems: "center", flex: 1, minHeight: 44, justifyContent: "center" },
  actionText: { color: colors.primaryDark, fontWeight: "900" },
  deleteButton: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  deleteText: { color: colors.danger, fontWeight: "900" },
  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  closeText: { color: colors.text, fontSize: 18, fontWeight: "900" },
  formCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, padding: spacing.md },
});
