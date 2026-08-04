import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
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
    onSuccess: (purchaseOrder) => {
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
    onSuccess: (purchaseOrder) => {
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>Back</Text></TouchableOpacity>
          <View><Text style={styles.eyebrow}>Stock buying</Text><Text style={styles.title}>Purchases</Text></View>
        </View>
        <TouchableOpacity onPress={() => setOpen(true)} style={styles.addButton}><Text style={styles.addButtonText}>+</Text></TouchableOpacity>
      </View>
      <View style={styles.filterPanel}>
        <Field onChangeText={setSearch} placeholder="Search vendor name" value={search} />
        <View style={styles.filterRow}>
          <FilterChip active={datePreset === "today"} label="Today" onPress={() => setDatePreset("today")} />
          <FilterChip active={datePreset === "week"} label="7 Days" onPress={() => setDatePreset("week")} />
          <FilterChip active={datePreset === "month"} label="Month" onPress={() => setDatePreset("month")} />
          <FilterChip active={datePreset === "custom"} label="Date" onPress={() => { setDatePreset("custom"); setShowDatePicker(true); }} />
        </View>
        {showDatePicker && (
          <DateTimePicker
            mode="date"
            value={new Date(`${customDate}T00:00:00`)}
            onChange={(_, date) => {
              setShowDatePicker(false);
              if (date) {
                setCustomDate(toDateKey(date));
                setDatePreset("custom");
              }
            }}
          />
        )}
        <View style={styles.summaryRow}>
          <SummaryCard label="Orders" value={summary?.orderCount || 0} />
          <SummaryCard label="Spend" value={`Rs ${formatMoney(summary?.totalAmount || 0)}`} />
        </View>
        {!!summary?.monthly?.length && (
          <View style={styles.monthBox}>
            <Text style={styles.monthTitle}>Monthly purchase report</Text>
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
        ListEmptyComponent={<Empty text={purchaseOrders.isLoading ? "Loading purchase orders..." : "No purchases found for this filter."} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.main}>
              <View style={styles.info}>
                <Text style={styles.name}>{vendorName(item)}</Text>
                <Text style={styles.meta}>{item.items.length} items | Rs {formatMoney(item.totalAmount)}</Text>
                <Text style={styles.meta}>{item.orderDate.slice(0, 10)}</Text>
                <View style={styles.lines}>
                  {item.items.slice(0, 3).map((line, index) => {
                    const product = typeof line.product === "string" ? null : line.product as Product;
                    return <Text key={`${item._id}-${index}`} numberOfLines={1} style={styles.lineText}>{product?.name || "Product"} x {line.quantity}</Text>;
                  })}
                </View>
              </View>
              <View style={[styles.badge, statusStyle(item.status)]}><Text style={styles.badgeText}>{item.status}</Text></View>
            </View>
            {item.status !== "received" && (
              <TouchableOpacity disabled={receive.isPending} onPress={() => receive.mutate(item._id)} style={styles.receiveButton}><Text style={styles.receiveText}>Receive stock</Text></TouchableOpacity>
            )}
          </View>
        )}
      />
      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.header}>
            <Text style={styles.title}>New Purchase Order</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>x</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" style={styles.formCard}>
            <Text style={styles.label}>Vendor</Text>
            {(vendors.data || []).map((item) => (
              <TouchableOpacity key={item._id} onPress={() => setVendor(item._id)} style={[styles.option, vendor === item._id && styles.optionActive]}><Text style={styles.optionText}>{item.name}</Text></TouchableOpacity>
            ))}
            <Text style={styles.label}>Product lines</Text>
            {lines.map((line, index) => (
              <View key={index} style={styles.lineBox}>
                <ProductSelect products={products.data || []} value={line.product} onChange={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, product: value, costPrice: String((products.data || []).find((p) => p._id === value)?.costPrice || row.costPrice) } : row))} />
                <View style={styles.row}>
                  <View style={styles.half}><Text style={styles.label}>Qty</Text><Field keyboardType="numeric" onChangeText={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, quantity: value } : row))} value={line.quantity} /></View>
                  <View style={styles.half}><Text style={styles.label}>Cost price</Text><Field keyboardType="numeric" onChangeText={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, costPrice: value } : row))} value={line.costPrice} /></View>
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={() => setLines((prev) => [...prev, blankLine])} style={styles.linkButton}><Text style={styles.linkText}>+ Add product line</Text></TouchableOpacity>
            <Text style={styles.total}>Total Rs {formatMoney(total)}</Text>
            <Text style={styles.label}>Notes</Text>
            <Field onChangeText={setNotes} value={notes} />
            <Button loading={save.isPending} onPress={() => save.mutate()} title="Save purchase order" />
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

function ProductSelect({ onChange, products, value }: { onChange: (value: string) => void; products: Product[]; value: string }) {
  return (
    <View>
      <Text style={styles.label}>Product</Text>
      {products.slice(0, 8).map((item) => (
        <TouchableOpacity key={item._id} onPress={() => onChange(item._id)} style={[styles.option, value === item._id && styles.optionActive]}><Text numberOfLines={1} style={styles.optionText}>{item.name}</Text></TouchableOpacity>
      ))}
    </View>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <TouchableOpacity onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}><Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text></TouchableOpacity>;
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return <View style={styles.summaryCard}><Text style={styles.summaryValue}>{value}</Text><Text style={styles.summaryLabel}>{label}</Text></View>;
}

function statusStyle(status: string) {
  if (status === "received") return { backgroundColor: colors.greenSoft };
  if (status === "cancelled") return { backgroundColor: colors.redSoft };
  return { backgroundColor: colors.orangeSoft };
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

function formatDay(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function getDateParams(preset: DatePreset, customDate: string) {
  const now = new Date();
  if (preset === "custom") return { from: new Date(`${customDate}T00:00:00`).toISOString(), to: new Date(`${customDate}T23:59:59`).toISOString() };
  if (preset === "month") return { month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}` };
  const from = new Date(now);
  if (preset === "today") from.setHours(0, 0, 0, 0);
  if (preset === "week") from.setDate(now.getDate() - 6);
  return { from: from.toISOString(), to: now.toISOString() };
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  headerLeft: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  backButton: { alignItems: "center", backgroundColor: colors.blueSoft, borderColor: colors.secondary, borderRadius: 8, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  backText: { color: colors.secondary, fontWeight: "900" },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 48, justifyContent: "center", width: 48 },
  addButtonText: { color: "#fff", fontSize: 28, fontWeight: "700", marginTop: -2 },
  filterPanel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  filterChip: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  filterChipActive: { backgroundColor: colors.tealSoft, borderColor: colors.primary },
  filterChipText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  filterChipTextActive: { color: colors.primaryDark },
  summaryRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  summaryCard: { backgroundColor: colors.background, borderRadius: 8, flex: 1, padding: spacing.sm },
  summaryValue: { color: colors.text, fontSize: 16, fontWeight: "900" },
  summaryLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: 2 },
  monthBox: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: spacing.sm, paddingTop: spacing.sm },
  monthTitle: { color: colors.text, fontSize: 13, fontWeight: "900", marginBottom: spacing.xs },
  monthRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  monthText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  monthAmount: { color: colors.primaryDark, fontSize: 12, fontWeight: "900" },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, overflow: "hidden" },
  main: { alignItems: "center", flexDirection: "row", padding: spacing.md },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  lines: { marginTop: spacing.xs },
  lineText: { color: colors.text, fontSize: 12, fontWeight: "800", marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  receiveButton: { alignItems: "center", backgroundColor: colors.greenSoft, borderTopColor: colors.border, borderTopWidth: 1, minHeight: 48, justifyContent: "center" },
  receiveText: { color: colors.success, fontWeight: "900" },
  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  closeText: { color: colors.text, fontSize: 18, fontWeight: "900" },
  formCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1 },
  modalContent: { padding: spacing.md, paddingBottom: spacing.xl },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.xs },
  option: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.xs, padding: spacing.sm },
  optionActive: { backgroundColor: colors.greenSoft, borderColor: colors.success },
  optionText: { color: colors.text, fontWeight: "800" },
  lineBox: { borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  linkButton: { alignItems: "center", borderColor: colors.primary, borderRadius: 8, borderWidth: 1, minHeight: 44, justifyContent: "center", marginBottom: spacing.sm },
  linkText: { color: colors.primaryDark, fontWeight: "900" },
  total: { color: colors.accent, fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
});
