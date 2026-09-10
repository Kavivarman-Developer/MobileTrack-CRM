import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { Product, PurchaseOrder, createPurchaseOrder, getProducts, getPurchaseOrders, getVendors, receivePurchaseOrder } from "../../services/api";

const blankLine = { product: "", quantity: "1", costPrice: "" };
type DatePreset = "today" | "week" | "month" | "custom";

export default function PurchasesScreen({ navigation }: any) {
  const [open, setOpen] = useState(false);
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([blankLine]);
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("week");
  const [customDate, setCustomDate] = useState(todayKey());
  const [pickerMonth, setPickerMonth] = useState(todayKey().slice(0, 7));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const vendors = useQuery({ queryKey: ["vendors"], queryFn: () => getVendors("") });
  const products = useQuery({ queryKey: ["products", ""], queryFn: () => getProducts("") });
  const filterParams = useMemo(() => ({ ...getDateParams(datePreset, customDate), search: search.trim() || undefined }), [customDate, datePreset, search]);
  const purchaseOrders = useQuery({ queryKey: ["purchase-orders", filterParams], queryFn: () => getPurchaseOrders(filterParams) });
  const queryClient = useQueryClient();
  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.costPrice || 0), 0), [lines]);
  const orderItems = purchaseOrders.data?.items || [];
  const summary = purchaseOrders.data?.summary;
  const save = useMutation({
    mutationFn: () => createPurchaseOrder({ vendor, notes, status: "ordered", items: lines.map((line) => ({ product: line.product, quantity: Number(line.quantity), costPrice: Number(line.costPrice) })) as any }),
    onSuccess: () => {
      setOpen(false);
      setVendor("");
      setNotes("");
      setLines([blankLine]);
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      Alert.alert("Purchase order saved", "Use Receive stock when the vendor delivers the items.");
    },
    onError: (error: Error) => Alert.alert("Purchase order failed", error.message),
  });
  const receive = useMutation({
    mutationFn: receivePurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-summary"] });
      Alert.alert("Stock received", "Inventory stock has been updated.");
    },
    onError: (error: Error) => Alert.alert("Receive failed", error.message),
  });

  function vendorName(po: PurchaseOrder) {
    return typeof po.vendor === "string" ? "Vendor" : po.vendor.name;
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
            <Text style={styles.eyebrow}>STOCK BUYING</Text>
            <Text style={styles.title}>Purchases</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => setOpen(true)} style={styles.addButton}>
          <Ionicons color="#ffffff" name="add" size={24} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterPanel}>
        <Field onChangeText={setSearch} placeholder="Search vendor name..." value={search} />
        <View style={styles.filterRow}>
          <FilterChip active={datePreset === "today"} label="Today" onPress={() => setDatePreset("today")} />
          <FilterChip active={datePreset === "week"} label="7 Days" onPress={() => setDatePreset("week")} />
          <FilterChip active={datePreset === "month"} label="Month" onPress={() => setDatePreset("month")} />
          <FilterChip active={datePreset === "custom"} label="Select Date" onPress={() => { setDatePreset("custom"); setShowDatePicker(true); }} />
        </View>
        <DateSelectModal
          month={pickerMonth}
          onChangeMonth={setPickerMonth}
          onClose={() => setShowDatePicker(false)}
          onSelect={(date) => {
            setCustomDate(date);
            setDatePreset("custom");
            setShowDatePicker(false);
          }}
          selectedDate={customDate}
          visible={showDatePicker}
        />
        <View style={styles.summaryRow}>
          <SummaryCard label="Total PO Orders" value={summary?.orderCount || 0} />
          <SummaryCard label="Total PO Spend" value={`Rs ${formatMoney(summary?.totalAmount || 0)}`} />
        </View>
        {!!summary?.monthly?.length && (
          <View style={styles.monthBox}>
            <Text style={styles.monthTitle}>Monthly Purchase Breakdown</Text>
            {summary.monthly.slice(0, 3).map((month) => (
              <View key={month.month} style={styles.monthRow}>
                <Text style={styles.monthText}>{month.month}</Text>
                <Text style={styles.monthAmount}>Rs {formatMoney(month.totalAmount)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <FlatList
        data={orderItems}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Empty icon="cart-outline" text={purchaseOrders.isLoading ? "Loading purchase orders..." : "No purchases found for this filter."} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.main}>
              <View style={styles.info}>
                <Text style={styles.name}>{vendorName(item)}</Text>
                <Text style={styles.meta}>{item.items.length} line items • Rs {formatMoney(item.totalAmount)}</Text>
                <Text style={styles.meta}>Ordered date: {item.orderDate.slice(0, 10)}</Text>
                <View style={styles.lines}>
                  {item.items.slice(0, 3).map((line, index) => {
                    const product = typeof line.product === "string" ? null : line.product as Product;
                    return <Text key={`${item._id}-${index}`} numberOfLines={1} style={styles.lineText}>• {product?.name || "Product"} × {line.quantity}</Text>;
                  })}
                </View>
              </View>
              <Badge label={item.status.toUpperCase()} tone={item.status === "received" ? "success" : item.status === "cancelled" ? "danger" : "warning"} />
            </View>
            {item.status !== "received" && (
              <TouchableOpacity disabled={receive.isPending} onPress={() => receive.mutate(item._id)} style={styles.receiveButton}>
                <Ionicons color={colors.success} name="checkbox-outline" size={16} style={{ marginRight: 4 }} />
                <Text style={styles.receiveText}>Receive Stock into Inventory</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />

      {/* New PO Modal */}
      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>NEW PURCHASE</Text>
              <Text style={styles.title}>Purchase Order</Text>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" style={styles.formCard}>
            <Text style={styles.fieldLabel}>Select Vendor</Text>
            {(vendors.data || []).map((item) => (
              <TouchableOpacity key={item._id} onPress={() => setVendor(item._id)} style={[styles.option, vendor === item._id && styles.optionActive]}>
                <Text style={[styles.optionText, vendor === item._id && styles.optionTextActive]}>{item.name}</Text>
              </TouchableOpacity>
            ))}
            <Text style={styles.fieldLabel}>Product Lines</Text>
            {lines.map((line, index) => (
              <View key={index} style={styles.lineBox}>
                <ProductSelect products={products.data || []} value={line.product} onChange={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, product: value, costPrice: String((products.data || []).find((p) => p._id === value)?.costPrice || row.costPrice) } : row))} />
                <View style={styles.row}>
                  <View style={styles.half}><Text style={styles.fieldLabel}>Qty</Text><Field keyboardType="numeric" onChangeText={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, quantity: value } : row))} value={line.quantity} /></View>
                  <View style={styles.half}><Text style={styles.fieldLabel}>Cost Price (Rs)</Text><Field keyboardType="numeric" onChangeText={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, costPrice: value } : row))} value={line.costPrice} /></View>
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={() => setLines((prev) => [...prev, blankLine])} style={styles.linkButton}>
              <Ionicons color={colors.primary} name="add-circle-outline" size={16} style={{ marginRight: 4 }} />
              <Text style={styles.linkText}>+ Add Product Line</Text>
            </TouchableOpacity>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>PO Total</Text>
              <Text style={styles.totalValue}>Rs {formatMoney(total)}</Text>
            </View>
            <Text style={styles.fieldLabel}>Notes</Text>
            <Field onChangeText={setNotes} placeholder="Delivery or purchase notes" value={notes} />
            <Button icon="checkmark-circle-outline" loading={save.isPending} onPress={() => save.mutate()} title="Save Purchase Order" />
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

function ProductSelect({ onChange, products, value }: { onChange: (value: string) => void; products: Product[]; value: string }) {
  return (
    <View>
      <Text style={styles.fieldLabel}>Select Product</Text>
      {products.slice(0, 8).map((item) => (
        <TouchableOpacity key={item._id} onPress={() => onChange(item._id)} style={[styles.option, value === item._id && styles.optionActive]}>
          <Text numberOfLines={1} style={[styles.optionText, value === item._id && styles.optionTextActive]}>{item.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function DateSelectModal({ month, onChangeMonth, onClose, onSelect, selectedDate, visible }: { month: string; onChangeMonth: (month: string) => void; onClose: () => void; onSelect: (date: string) => void; selectedDate: string; visible: boolean }) {
  const days = daysInMonth(month);
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.dateOverlay}>
        <View style={styles.dateModal}>
          <View style={styles.dateHeader}>
            <TouchableOpacity onPress={() => onChangeMonth(shiftMonth(month, -1))} style={styles.dateNav}>
              <Ionicons color={colors.primary} name="chevron-back" size={18} />
            </TouchableOpacity>
            <Text style={styles.dateMonth}>{formatMonth(month)}</Text>
            <TouchableOpacity onPress={() => onChangeMonth(shiftMonth(month, 1))} style={styles.dateNav}>
              <Ionicons color={colors.primary} name="chevron-forward" size={18} />
            </TouchableOpacity>
          </View>
          <View style={styles.dateGrid}>
            {days.map((date) => (
              <TouchableOpacity key={date} onPress={() => onSelect(date)} style={[styles.dateCell, selectedDate === date && styles.dateCellActive]}>
                <Text style={[styles.dateCellText, selectedDate === date && styles.dateCellTextActive]}>{Number(date.slice(-2))}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.dateClose}>
            <Text style={styles.dateCloseText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return toDateKey(new Date());
}

function getDateParams(preset: DatePreset, customDate: string) {
  const now = new Date();
  if (preset === "custom") return { date: customDate };
  if (preset === "month") return { month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` };
  const from = new Date(now);
  if (preset === "today") from.setHours(0, 0, 0, 0);
  if (preset === "week") from.setDate(now.getDate() - 6);
  return { from: from.toISOString(), to: now.toISOString() };
}

function daysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, index) => `${monthKey}-${String(index + 1).padStart(2, "0")}`);
}

function shiftMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  headerLeft: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", height: 38, justifyContent: "center", paddingHorizontal: spacing.sm },
  backText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, marginTop: 2 },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, height: 44, justifyContent: "center", width: 44, ...shadows.card },

  filterPanel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  filterChip: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  filterChipTextActive: { color: "#ffffff" },

  summaryRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  summaryCard: { backgroundColor: colors.surfaceTint, borderRadius: radius.sm, flex: 1, padding: spacing.sm },
  summaryValue: { color: colors.text, fontSize: 16, fontWeight: "700" },
  summaryLabel: { color: colors.muted, fontSize: 11, fontWeight: "500", marginTop: 2 },

  monthBox: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: spacing.sm, paddingTop: spacing.sm },
  monthTitle: { color: colors.text, fontSize: 13, fontWeight: "600", marginBottom: spacing.xs },
  monthRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  monthText: { color: colors.muted, fontSize: 12 },
  monthAmount: { color: colors.primary, fontSize: 12, fontWeight: "700" },

  listContent: { paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden", ...shadows.card },
  main: { alignItems: "center", flexDirection: "row", padding: spacing.md },
  info: { flex: 1, paddingRight: spacing.sm },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  lines: { marginTop: spacing.xs },
  lineText: { color: colors.text, fontSize: 12, marginTop: 2 },

  receiveButton: { alignItems: "center", backgroundColor: colors.greenSoft, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", minHeight: 44, justifyContent: "center" },
  receiveText: { color: colors.success, fontWeight: "600", fontSize: 13 },

  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  closeButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 40, justifyContent: "center", width: 40 },
  formCard: { backgroundColor: colors.surface, borderRadius: radius.md },
  modalContent: { padding: spacing.md, paddingBottom: spacing.xl },
  fieldLabel: { color: colors.text, ...typography.label, marginBottom: spacing.xs, marginTop: spacing.xs },

  option: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginBottom: spacing.xs, padding: spacing.sm },
  optionActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  optionText: { color: colors.text, fontSize: 13, fontWeight: "500" },
  optionTextActive: { color: colors.primary, fontWeight: "700" },

  lineBox: { borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  linkButton: { alignItems: "center", borderColor: colors.primary, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", height: 44, justifyContent: "center", marginBottom: spacing.sm },
  linkText: { color: colors.primary, fontWeight: "600" },

  totalBox: { backgroundColor: colors.surfaceTint, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.md },
  totalLabel: { color: colors.muted, fontSize: 12, fontWeight: "500" },
  totalValue: { color: colors.primary, fontSize: 22, fontWeight: "700", marginTop: 2 },

  dateOverlay: { alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.45)", flex: 1, justifyContent: "center", padding: spacing.md },
  dateModal: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, width: "100%" },
  dateHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  dateNav: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 36, justifyContent: "center", width: 36 },
  dateMonth: { color: colors.text, fontSize: 15, fontWeight: "700" },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  dateCell: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 36, justifyContent: "center", width: "13%" },
  dateCellActive: { backgroundColor: colors.primary },
  dateCellText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  dateCellTextActive: { color: "#ffffff" },
  dateClose: { alignItems: "center", borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginTop: spacing.md, minHeight: 40, justifyContent: "center" },
  dateCloseText: { color: colors.text, fontWeight: "600" },
});
