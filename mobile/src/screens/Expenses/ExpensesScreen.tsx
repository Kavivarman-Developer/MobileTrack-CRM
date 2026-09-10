import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
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
            <Ionicons color={colors.text} name="chevron-back" size={20} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.eyebrow}>SHOP SPENDING</Text>
            <Text style={styles.title}>Expenses</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => openForm()} style={styles.addButton}>
          <Ionicons color="#ffffff" name="add" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <View style={styles.filterHalf}><Text style={styles.fieldLabel}>From Date</Text><Field onChangeText={setFrom} value={from} /></View>
        <View style={styles.filterHalf}><Text style={styles.fieldLabel}>To Date</Text><Field onChangeText={setTo} value={to} /></View>
      </View>

      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Selected Period Expense Total</Text>
        <Text style={styles.totalValue}>Rs {formatMoney(expenses.data?.total || 0)}</Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Empty icon="wallet-outline" text={expenses.isLoading ? "Loading expenses..." : "No expenses recorded for this period."} />}
        renderItem={({ item }) => (
          <View style={styles.expenseCard}>
            <TouchableOpacity onPress={() => openForm(item)} style={styles.expenseMain}>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseTitle}>{item.description}</Text>
                <View style={styles.categoryRow}>
                  <Badge label={item.category} tone="neutral" />
                  <Text style={styles.expenseMeta}>{item.date.slice(0, 10)}</Text>
                </View>
              </View>
              <Text style={styles.expenseAmount}>Rs {formatMoney(item.amount)}</Text>
            </TouchableOpacity>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => openForm(item)} style={styles.actionButton}>
                <Ionicons color={colors.primary} name="create-outline" size={15} style={{ marginRight: 4 }} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove.mutate(item._id)} style={[styles.actionButton, styles.deleteButton]}>
                <Ionicons color={colors.danger} name="trash-outline" size={15} style={{ marginRight: 4 }} />
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>{editing ? "UPDATE EXPENSE" : "NEW EXPENSE"}</Text>
              <Text style={styles.title}>{editing ? "Edit Expense" : "Add Expense"}</Text>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" style={styles.formCard}>
            <Text style={styles.fieldLabel}>Expense Description</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))} placeholder="e.g. Electricity bill, Tea/Snacks" value={form.description} />
            <Text style={styles.fieldLabel}>Amount (INR ₹)</Text>
            <Field keyboardType="numeric" onChangeText={(value) => setForm((prev) => ({ ...prev, amount: value }))} placeholder="0.00" value={form.amount} />
            <Text style={styles.fieldLabel}>Category</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, category: value }))} placeholder="e.g. Utilities, Rent, Maintenance" value={form.category} />
            <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
            <Field onChangeText={(value) => setForm((prev) => ({ ...prev, date: value }))} value={form.date} />
            <Text style={styles.fieldLabel}>Notes</Text>
            <Field multiline onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))} placeholder="Additional notes..." value={form.notes} />
            <Button icon="checkmark-circle-outline" loading={save.isPending} onPress={() => save.mutate()} title="Save Expense" />
          </ScrollView>
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
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", height: 38, justifyContent: "center", paddingHorizontal: spacing.sm },
  backText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, marginTop: 2 },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, height: 44, justifyContent: "center", width: 44, ...shadows.card },

  filters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  filterHalf: { flex: 1 },
  fieldLabel: { color: colors.text, ...typography.label, marginBottom: spacing.xs },

  totalCard: { backgroundColor: colors.accent, borderRadius: radius.md, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  totalLabel: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  totalValue: { color: "#ffffff", fontSize: 28, fontWeight: "700", marginTop: 2 },

  listContent: { paddingBottom: spacing.lg },
  expenseCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden", ...shadows.card },
  expenseMain: { alignItems: "center", flexDirection: "row", padding: spacing.md },
  expenseInfo: { flex: 1, paddingRight: spacing.sm },
  expenseTitle: { color: colors.text, fontSize: 15, fontWeight: "600" },
  categoryRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, marginTop: 4 },
  expenseMeta: { color: colors.muted, fontSize: 12 },
  expenseAmount: { color: colors.accent, fontSize: 16, fontWeight: "700" },

  actions: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row" },
  actionButton: { alignItems: "center", flex: 1, flexDirection: "row", justifyContent: "center", paddingVertical: 10 },
  actionText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  deleteButton: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  deleteText: { color: colors.danger, fontSize: 13, fontWeight: "600" },

  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  closeButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 40, justifyContent: "center", width: 40 },
  formCard: { backgroundColor: colors.surface, borderRadius: radius.md },
  modalContent: { padding: spacing.md, paddingBottom: spacing.xl },
});
