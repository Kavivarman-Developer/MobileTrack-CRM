import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Badge,
  Empty,
  FabButton,
  Field,
  IconButton,
  IosFormSheet,
  IosScreenHeader,
  PageHeader,
  Screen,
} from "../../components/Layout";
import { colors, fonts, radius, shadows, spacing, typography } from "../../constants/theme";
import {
  apiErrorMessage,
  createExpense,
  deleteExpense,
  Expense,
  getExpenses,
  updateExpense,
} from "../../services/api";

const CATEGORIES = [
  { id: "utilities", label: "Utilities", icon: "flash-outline", color: "#F59E0B" },
  { id: "rent", label: "Rent", icon: "business-outline", color: "#6366F1" },
  { id: "salary", label: "Salary / Staff", icon: "people-outline", color: "#10B981" },
  { id: "stock", label: "Stock / Supplies", icon: "cube-outline", color: "#0079F2" },
  { id: "transport", label: "Transport", icon: "car-outline", color: "#8B5CF6" },
  { id: "maintenance", label: "Repairs", icon: "construct-outline", color: "#EC4899" },
  { id: "general", label: "General", icon: "receipt-outline", color: "#64748B" },
];

const blank = {
  description: "",
  amount: "",
  category: "general",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

type DatePreset = "month" | "last30" | "today";

export default function ExpensesScreen({ navigation }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState(blank);
  const [datePreset, setDatePreset] = useState<DatePreset>("month");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (datePreset === "today") {
      return { from: todayStr, to: todayStr };
    }
    if (datePreset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { from: firstDay, to: todayStr };
    }
    // last30
    const past = new Date(now);
    past.setDate(past.getDate() - 30);
    return { from: past.toISOString().slice(0, 10), to: todayStr };
  }, [datePreset]);

  const queryClient = useQueryClient();
  const expensesQuery = useQuery({
    queryKey: ["expenses", dateRange.from, dateRange.to],
    queryFn: () => getExpenses(dateRange),
  });

  const rawItems = useMemo(() => expensesQuery.data?.items || [], [expensesQuery.data]);
  const totalAmount = expensesQuery.data?.total || rawItems.reduce((sum, it) => sum + Number(it.amount || 0), 0);

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return rawItems;
    return rawItems.filter((item) => (item.category || "general").toLowerCase() === selectedCategory.toLowerCase());
  }, [rawItems, selectedCategory]);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        description: form.description.trim(),
        amount: Number(form.amount),
        category: form.category,
        date: form.date,
        notes: form.notes.trim(),
      };
      return editing ? updateExpense(editing._id, payload) : createExpense(payload);
    },
    onSuccess: () => {
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => Alert.alert("Expense save failed", apiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: deleteExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error: Error) => Alert.alert("Delete failed", apiErrorMessage(error)),
  });

  function openForm(expense?: Expense) {
    setEditing(expense || null);
    setForm(
      expense
        ? {
            description: expense.description,
            amount: String(expense.amount),
            category: expense.category || "general",
            date: expense.date.slice(0, 10),
            notes: expense.notes || "",
          }
        : blank
    );
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
    setEditing(null);
    setForm(blank);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await expensesQuery.refetch();
    setRefreshing(false);
  };

  const avgEntry = rawItems.length ? Math.round(totalAmount / rawItems.length) : 0;

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="Shop Operations"
        left={<IconButton accessibilityLabel="Go back" icon="chevron-back" onPress={() => navigation.goBack()} />}
        right={
          <TouchableOpacity onPress={() => openForm()} style={styles.addHeaderBtn}>
            <Ionicons color="#FFFFFF" name="add" size={18} />
            <Text style={styles.addHeaderBtnText}>Record</Text>
          </TouchableOpacity>
        }
        title="Expenses"
      />

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            {/* Top Metric Cards */}
            <View style={styles.metricsRow}>
              {/* Total Spend */}
              <View style={[styles.metricCard, { borderLeftColor: "#EF4444" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#FEF2F2" }]}>
                    <Ionicons color="#EF4444" name="wallet" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>{datePreset === "today" ? "Today" : datePreset === "month" ? "Month" : "30 Days"}</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  ₹{formatMoney(totalAmount)}
                </Text>
                <Text style={styles.metricSub}>Total spend</Text>
              </View>

              {/* Total Entries */}
              <View style={[styles.metricCard, { borderLeftColor: "#6366F1" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#EEF2FF" }]}>
                    <Ionicons color="#6366F1" name="list" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>Entries</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  {rawItems.length}
                </Text>
                <Text style={styles.metricSub}>Expense records</Text>
              </View>

              {/* Average Spend */}
              <View style={[styles.metricCard, { borderLeftColor: "#0079F2" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}>
                    <Ionicons color="#0079F2" name="calculator" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>Average</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  ₹{formatMoney(avgEntry)}
                </Text>
                <Text style={styles.metricSub}>Per expense</Text>
              </View>
            </View>

            {/* Date Preset Segment */}
            <View style={styles.segmentContainer}>
              {(
                [
                  ["month", "This Month"],
                  ["last30", "Last 30 Days"],
                  ["today", "Today"],
                ] as [DatePreset, string][]
              ).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setDatePreset(key)}
                  style={[styles.segmentBtn, datePreset === key && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentBtnText, datePreset === key && styles.segmentBtnTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Category Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
              <TouchableOpacity
                onPress={() => setSelectedCategory("all")}
                style={[styles.categoryChip, selectedCategory === "all" && styles.categoryChipActive]}
              >
                <Text style={[styles.categoryChipText, selectedCategory === "all" && styles.categoryChipTextActive]}>
                  All Categories
                </Text>
              </TouchableOpacity>
              {CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => setSelectedCategory(cat.id)}
                    style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                  >
                    <Ionicons
                      color={isSelected ? "#FFFFFF" : colors.textSecondary}
                      name={cat.icon as any}
                      size={13}
                    />
                    <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>Expense Records</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{filteredItems.length}</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons color={colors.textMuted} name="receipt-outline" size={44} />
            <Text style={styles.emptyTitle}>
              {expensesQuery.isLoading ? "Loading expenses…" : "No expenses recorded"}
            </Text>
            <Text style={styles.emptySub}>
              {expensesQuery.isLoading ? "Fetching data..." : "Add rent, bills, or operational costs to track your cash outflow."}
            </Text>
            {!expensesQuery.isLoading && (
              <TouchableOpacity onPress={() => openForm()} style={styles.emptyBtn}>
                <Ionicons color="#FFFFFF" name="add" size={18} />
                <Text style={styles.emptyBtnText}>Add First Expense</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <ExpenseCard
            item={item}
            onDelete={() =>
              Alert.alert("Delete Expense?", `Remove ₹${formatMoney(item.amount)} (${item.description})?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => remove.mutate(item._id) },
              ])
            }
            onEdit={() => openForm(item)}
          />
        )}
      />

      <FabButton accessibilityLabel="Add expense" onPress={() => openForm()} />

      <IosFormSheet
        eyebrow={editing ? "Update details" : "New record"}
        footerLabel={save.isPending ? "Saving…" : "Save Expense"}
        footerLoading={save.isPending}
        onClose={closeForm}
        onFooterPress={() => save.mutate()}
        title={editing ? "Edit Expense" : "Add Expense"}
        visible={open}
      >
        <Text style={styles.fieldLabel}>Expense Description</Text>
        <Field
          onChangeText={(value) => setForm((prev) => ({ ...prev, description: value }))}
          placeholder="e.g. Shop Electricity Bill"
          value={form.description}
        />

        <Text style={styles.fieldLabel}>Amount (₹)</Text>
        <Field
          keyboardType="numeric"
          onChangeText={(value) => setForm((prev) => ({ ...prev, amount: value }))}
          placeholder="0.00"
          value={form.amount}
        />

        <Text style={styles.fieldLabel}>Category</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => {
            const isSelected = form.category.toLowerCase() === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setForm((prev) => ({ ...prev, category: cat.id }))}
                style={[styles.modalCatPill, isSelected && { backgroundColor: cat.color, borderColor: cat.color }]}
              >
                <Ionicons color={isSelected ? "#FFFFFF" : colors.textSecondary} name={cat.icon as any} size={14} />
                <Text style={[styles.modalCatText, isSelected && { color: "#FFFFFF", fontWeight: "700" }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
        <Field
          onChangeText={(value) => setForm((prev) => ({ ...prev, date: value }))}
          placeholder="YYYY-MM-DD"
          value={form.date}
        />

        <Text style={styles.fieldLabel}>Notes / Vendor / Bill # (Optional)</Text>
        <Field
          multiline
          onChangeText={(value) => setForm((prev) => ({ ...prev, notes: value }))}
          placeholder="Additional details, invoice number, payment ref..."
          value={form.notes}
        />
      </IosFormSheet>
    </Screen>
  );
}

function ExpenseCard({ item, onEdit, onDelete }: { item: Expense; onEdit: () => void; onDelete: () => void }) {
  const catConfig = CATEGORIES.find((c) => c.id === item.category?.toLowerCase()) || {
    label: item.category || "General",
    icon: "receipt-outline",
    color: "#64748B",
  };

  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: catConfig.color }]} />
      <View style={styles.cardContent}>
        <TouchableOpacity onPress={onEdit} style={styles.cardMain} activeOpacity={0.7}>
          <View style={[styles.avatar, { backgroundColor: `${catConfig.color}18` }]}>
            <Ionicons color={catConfig.color} name={catConfig.icon as any} size={20} />
          </View>
          <View style={styles.cardCopy}>
            <Text numberOfLines={1} style={styles.cardTitle}>
              {item.description}
            </Text>
            <View style={styles.metaRow}>
              <View style={[styles.catBadge, { backgroundColor: `${catConfig.color}15` }]}>
                <Text style={[styles.catBadgeText, { color: catConfig.color }]}>{catConfig.label}</Text>
              </View>
              <Text style={styles.metaDate}>
                {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
            {Boolean(item.notes) && (
              <Text numberOfLines={1} style={styles.notesText}>
                {item.notes}
              </Text>
            )}
          </View>
          <View style={styles.amountCol}>
            <Text style={styles.amountText}>-₹{formatMoney(item.amount)}</Text>
          </View>
        </TouchableOpacity>

        <View style={styles.cardActions}>
          <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
            <Ionicons color={colors.textSecondary} name="create-outline" size={15} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
            <Ionicons color="#EF4444" name="trash-outline" size={15} />
            <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Delete</Text>
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
  screen: { backgroundColor: "#F8FAFC" },
  content: { width: "100%", paddingBottom: 40 },

  addHeaderBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...shadows.sm,
  },
  addHeaderBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 13 },

  // Metric Cards
  metricsRow: { flexDirection: "row", gap: 8, marginTop: spacing.xs, marginBottom: spacing.md },
  metricCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderLeftWidth: 4,
    flex: 1,
    padding: 12,
    ...shadows.sm,
  },
  metricHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  metricIconWrap: { alignItems: "center", borderRadius: 8, height: 26, justifyContent: "center", width: 26 },
  metricLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 11 },
  metricValue: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.3 },
  metricSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, marginTop: 2 },

  // Date Preset Segment
  segmentContainer: {
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: spacing.md,
    padding: 3,
  },
  segmentBtn: { alignItems: "center", borderRadius: 9, flex: 1, paddingVertical: 7 },
  segmentBtnActive: { backgroundColor: colors.card, ...shadows.sm },
  segmentBtnText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12 },
  segmentBtnTextActive: { color: colors.textPrimary, fontFamily: fonts.semibold },

  // Category Chips
  categoryChips: { gap: 6, paddingBottom: 10 },
  categoryChip: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12 },
  categoryChipTextActive: { color: "#FFFFFF", fontFamily: fonts.semibold },

  sectionHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10, marginTop: 6 },
  sectionLabel: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 16 },
  countBadge: {
    backgroundColor: colors.backgroundDark,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: { color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: 11 },

  // Expense Card
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 10,
    overflow: "hidden",
    ...shadows.sm,
  },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, minWidth: 0 },
  cardMain: { alignItems: "center", flexDirection: "row", gap: 10, padding: 12 },
  avatar: { alignItems: "center", borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 15 },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 6, marginTop: 4 },
  catBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  catBadgeText: { fontFamily: fonts.semibold, fontSize: 11 },
  metaDate: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  notesText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, marginTop: 3 },
  amountCol: { alignItems: "flex-end" },
  amountText: { color: "#EF4444", fontFamily: fonts.bold, fontSize: 16 },

  cardActions: {
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
    flexDirection: "row",
  },
  actionBtn: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    paddingVertical: 10,
  },
  actionBtnText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12 },

  // Empty Card
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.xl,
    marginTop: 10,
  },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 15, marginTop: 10 },
  emptySub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2, textAlign: "center" },
  emptyBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadows.sm,
  },
  emptyBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 13 },

  fieldLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 13, marginBottom: 4, marginTop: 12 },

  // Category Grid in Modal Form
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  modalCatPill: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  modalCatText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12 },
});

