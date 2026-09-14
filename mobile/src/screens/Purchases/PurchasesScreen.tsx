import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Empty, FabButton, Field, IconButton, IosScreenHeader, IosSearchBar, PageHeader, Screen, SelectOption, StatStrip } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { Product, PurchaseOrder, createPurchaseOrder, getProducts, getPurchaseOrders, getVendors, receivePurchaseOrder } from "../../services/api";

const blankLine = { product: "", quantity: "1", costPrice: "" };
type DatePreset = "today" | "week" | "month" | "custom";

const statusColor: Record<string, string> = {
  ordered: ios.orange,
  received: ios.green,
  cancelled: ios.red,
  draft: ios.blue,
};

export default function PurchasesScreen() {
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
  const pendingCount = useMemo(() => orderItems.filter((item) => item.status !== "received" && item.status !== "cancelled").length, [orderItems]);

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

  function statusLabel(status: string) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader eyebrow="Purchases" title="Purchases" />

      <FlatList
        data={orderItems}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            <StatStrip
              items={[
                { label: "Spend", value: `₹${formatMoney(summary?.totalAmount || 0)}`, icon: "cart-outline", tone: "purple" },
                { label: "Orders", value: String(summary?.orderCount || 0), icon: "document-text-outline", tone: "blue" },
                { label: "Pending", value: String(pendingCount), icon: "time-outline", tone: "orange" },
              ]}
            />
            <IosSearchBar onChangeText={setSearch} placeholder="Search vendor name…" value={search} />

            <View style={styles.segment}>
              {([
                ["today", "Today"],
                ["week", "7 days"],
                ["month", "Month"],
              ] as [DatePreset, string][]).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => setDatePreset(key)}
                  style={[styles.segmentItem, datePreset === key && styles.segmentItemOn]}
                >
                  <Text style={[styles.segmentText, datePreset === key && styles.segmentTextOn]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => {
                setDatePreset("custom");
                setShowDatePicker(true);
              }}
              style={[styles.datePick, datePreset === "custom" && styles.datePickOn]}
            >
              <Ionicons color={datePreset === "custom" ? ios.blue : ios.secondary} name="calendar-outline" size={16} />
              <Text style={[styles.datePickText, datePreset === "custom" && styles.datePickTextOn]}>
                {datePreset === "custom" ? formatDateShort(customDate) : "Pick a date"}
              </Text>
            </TouchableOpacity>

            {!!summary?.monthly?.length && (
              <View style={styles.monthCard}>
                <Text style={styles.monthTitle}>Monthly spend</Text>
                {summary.monthly.slice(0, 3).map((month) => (
                  <View key={month.month} style={styles.monthRow}>
                    <Text style={styles.monthText}>{month.month}</Text>
                    <Text style={styles.monthAmount}>₹{formatMoney(month.totalAmount)}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabelInline}>Purchase orders</Text>
              <Text style={styles.listCount}>{orderItems.length}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons color={ios.blue} name="cart-outline" size={28} />
            </View>
            <Text style={styles.emptyTitle}>{purchaseOrders.isLoading ? "Loading purchases…" : "No purchases here"}</Text>
            <Text style={styles.emptyText}>
              {purchaseOrders.isLoading ? "Just a moment." : "Try another date filter, or create a new purchase order."}
            </Text>
            {!purchaseOrders.isLoading ? (
              <TouchableOpacity onPress={() => setOpen(true)} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>New purchase order</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => {
          const tone = statusColor[item.status] || ios.blue;
          return (
            <View style={styles.poCard}>
              <View style={[styles.accent, { backgroundColor: tone }]} />
              <View style={styles.poInner}>
                <View style={styles.poTop}>
                  <View style={[styles.avatar, { backgroundColor: `${tone}1F` }]}>
                    <Ionicons color={tone} name="cart" size={18} />
                  </View>
                  <View style={styles.poCopy}>
                    <Text numberOfLines={1} style={styles.poName}>{vendorName(item)}</Text>
                    <Text style={styles.poMeta}>Ordered {item.orderDate.slice(0, 10)}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: `${tone}1F` }]}>
                    <Text style={[styles.statusPillText, { color: tone }]}>{statusLabel(item.status)}</Text>
                  </View>
                </View>
                <Text style={styles.poAmount}>₹{formatMoney(item.totalAmount)}</Text>
                <Text style={styles.poLines}>{item.items.length} line items</Text>
                <View style={styles.linePreview}>
                  {item.items.slice(0, 3).map((line, index) => {
                    const product = typeof line.product === "string" ? null : line.product as Product;
                    return (
                      <Text key={`${item._id}-${index}`} numberOfLines={1} style={styles.lineText}>
                        {product?.name || "Product"} × {line.quantity}
                      </Text>
                    );
                  })}
                </View>
                {item.status !== "received" && item.status !== "cancelled" ? (
                  <TouchableOpacity
                    disabled={receive.isPending}
                    onPress={() => receive.mutate(item._id)}
                    style={styles.receiveBtn}
                  >
                    <Ionicons color="#FFFFFF" name="checkbox" size={16} />
                    <Text style={styles.receiveText}>{receive.isPending ? "Receiving…" : "Receive stock"}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      <FabButton accessibilityLabel="New purchase order" onPress={() => setOpen(true)} />

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

      <Modal animationType="slide" visible={open}>
        <Screen>
          <PageHeader
            eyebrow="New purchase"
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setOpen(false)} />}
            title="Purchase Order"
          />
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Select Vendor</Text>
            {(vendors.data || []).map((item) => (
              <SelectOption
                key={item._id}
                label={item.name}
                meta={item.phone || item.email || "Vendor"}
                onPress={() => setVendor(item._id)}
                selected={vendor === item._id}
              />
            ))}
            <Text style={styles.fieldLabel}>Product Lines</Text>
            {lines.map((line, index) => (
              <View key={index} style={styles.lineBox}>
                <ProductSelect
                  products={products.data || []}
                  value={line.product}
                  onChange={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, product: value, costPrice: String((products.data || []).find((p) => p._id === value)?.costPrice || row.costPrice) } : row))}
                />
                <View style={styles.row}>
                  <View style={styles.half}><Text style={styles.fieldLabel}>Qty</Text><Field keyboardType="numeric" onChangeText={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, quantity: value } : row))} value={line.quantity} /></View>
                  <View style={styles.half}><Text style={styles.fieldLabel}>Cost Price (₹)</Text><Field keyboardType="numeric" onChangeText={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, costPrice: value } : row))} value={line.costPrice} /></View>
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={() => setLines((prev) => [...prev, blankLine])} style={styles.linkButton}>
              <Ionicons color={ios.blue} name="add-circle-outline" size={16} />
              <Text style={styles.linkText}>Add product line</Text>
            </TouchableOpacity>
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>PO total</Text>
              <Text style={styles.totalValue}>₹{formatMoney(total)}</Text>
            </View>
            <Text style={styles.fieldLabel}>Notes</Text>
            <Field onChangeText={setNotes} placeholder="Delivery or purchase notes" value={notes} />
            <TouchableOpacity onPress={() => save.mutate()} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{save.isPending ? "Saving…" : "Save purchase order"}</Text>
            </TouchableOpacity>
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
        <SelectOption
          key={item._id}
          label={item.name}
          meta={`₹${formatMoney(item.costPrice)} cost · ${item.stockQty} stock`}
          onPress={() => onChange(item._id)}
          selected={value === item._id}
        />
      ))}
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
              <Ionicons color={ios.blue} name="chevron-back" size={18} />
            </TouchableOpacity>
            <Text style={styles.dateMonth}>{formatMonth(month)}</Text>
            <TouchableOpacity onPress={() => onChangeMonth(shiftMonth(month, 1))} style={styles.dateNav}>
              <Ionicons color={ios.blue} name="chevron-forward" size={18} />
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

function formatDateShort(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
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
  screen: { backgroundColor: ios.bg },
  header: { alignItems: "flex-start", flexDirection: "row", marginBottom: 12, marginTop: 4, paddingHorizontal: spacing.md },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 10 },
  greeting: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13 },
  title: { color: ios.label, fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.5, lineHeight: 32, marginTop: 1 },
  headerAdd: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    marginTop: 4,
    width: 36,
  },
  content: { alignSelf: "center", maxWidth: 430, paddingBottom: 110, paddingHorizontal: spacing.md, width: "100%" },
  searchBox: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchInput: { backgroundColor: "transparent", borderWidth: 0, flex: 1, marginBottom: 0, minHeight: 40, paddingHorizontal: 0 },

  hero: {
    backgroundColor: ios.dark,
    borderRadius: 22,
    marginBottom: 14,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  heroOverline: { color: "rgba(255,255,255,0.62)", fontFamily: fonts.medium, fontSize: 13 },
  heroAmount: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 40, letterSpacing: -1, lineHeight: 46, marginTop: 2 },
  heroSub: { color: "rgba(255,255,255,0.55)", fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  heroPills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  heroPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    color: "#FFFFFF",
    fontFamily: fonts.medium,
    fontSize: 13,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroCta: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  heroCtaText: { color: ios.dark, fontFamily: fonts.semibold, fontSize: 15 },

  segment: { backgroundColor: ios.fill, borderRadius: 12, flexDirection: "row", padding: 3 },
  segmentItem: { alignItems: "center", borderRadius: 9, flex: 1, justifyContent: "center", minHeight: 34 },
  segmentItemOn: { backgroundColor: ios.card },
  segmentText: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13 },
  segmentTextOn: { color: ios.label, fontFamily: fonts.semibold },
  datePick: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: ios.card,
    borderRadius: 999,
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  datePickOn: { backgroundColor: "#007AFF14" },
  datePickText: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13 },
  datePickTextOn: { color: ios.blue },

  monthCard: { backgroundColor: ios.card, borderRadius: 16, marginTop: 12, padding: 14 },
  monthTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 14, marginBottom: 8 },
  monthRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  monthText: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 13 },
  monthAmount: { color: ios.label, fontFamily: fonts.semibold, fontSize: 13 },

  sectionHead: { alignItems: "center", flexDirection: "row", marginBottom: 8, marginLeft: 4, marginTop: 18 },
  sectionLabelInline: { color: ios.secondary, flex: 1, fontFamily: fonts.regular, fontSize: 13 },
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

  poCard: {
    backgroundColor: ios.card,
    borderRadius: 18,
    flexDirection: "row",
    marginBottom: 10,
    overflow: "hidden",
  },
  accent: { width: 4 },
  poInner: { flex: 1, minWidth: 0, padding: 14 },
  poTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  avatar: { alignItems: "center", borderRadius: 14, height: 40, justifyContent: "center", width: 40 },
  poCopy: { flex: 1, minWidth: 0 },
  poName: { color: ios.label, fontFamily: fonts.semibold, fontSize: 16 },
  poMeta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },
  statusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillText: { fontFamily: fonts.semibold, fontSize: 11 },
  poAmount: { color: ios.label, fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.4, marginTop: 10 },
  poLines: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  linePreview: { marginTop: 8 },
  lineText: { color: ios.label, fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  receiveBtn: {
    alignItems: "center",
    backgroundColor: ios.green,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 42,
  },
  receiveText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 14 },

  emptyCard: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "#007AFF14",
    borderRadius: 22,
    height: 56,
    justifyContent: "center",
    marginBottom: 12,
    width: 56,
  },
  emptyTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 17 },
  emptyText: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 14, marginTop: 4, textAlign: "center" },
  emptyBtn: {
    backgroundColor: ios.dark,
    borderRadius: 14,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 18,
  },
  emptyBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 14, textAlign: "center" },

  modalContent: { padding: spacing.md, paddingBottom: spacing.xl },
  fieldLabel: { color: ios.label, fontFamily: fonts.semibold, fontSize: 13, marginBottom: spacing.xs, marginTop: spacing.xs },
  option: { backgroundColor: ios.fill, borderRadius: 12, marginBottom: 6, padding: 12 },
  optionActive: { backgroundColor: `${ios.blue}14` },
  optionText: { color: ios.label, fontFamily: fonts.medium, fontSize: 14 },
  optionTextActive: { color: ios.blue, fontFamily: fonts.semibold },
  lineBox: { backgroundColor: ios.card, borderRadius: 14, marginBottom: 10, padding: 12 },
  row: { flexDirection: "row", gap: 10 },
  half: { flex: 1 },
  linkButton: {
    alignItems: "center",
    backgroundColor: `${ios.blue}14`,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    height: 44,
    justifyContent: "center",
    marginBottom: 12,
  },
  linkText: { color: ios.blue, fontFamily: fonts.semibold, fontSize: 14 },
  totalBox: { backgroundColor: ios.dark, borderRadius: 16, marginBottom: 12, padding: 16 },
  totalLabel: { color: "rgba(255,255,255,0.6)", fontFamily: fonts.medium, fontSize: 12 },
  totalValue: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 28, marginTop: 2 },
  saveBtn: {
    alignItems: "center",
    backgroundColor: ios.dark,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 48,
  },
  saveBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 15 },

  dateOverlay: { alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.45)", flex: 1, justifyContent: "center", padding: spacing.md },
  dateModal: { backgroundColor: ios.card, borderRadius: 16, padding: spacing.md, width: "100%" },
  dateHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  dateNav: { alignItems: "center", backgroundColor: ios.fill, borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  dateMonth: { color: ios.label, fontFamily: fonts.bold, fontSize: 15 },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  dateCell: { alignItems: "center", backgroundColor: ios.fill, borderRadius: 10, height: 36, justifyContent: "center", width: "13%" },
  dateCellActive: { backgroundColor: ios.blue },
  dateCellText: { color: ios.label, fontFamily: fonts.semibold, fontSize: 12 },
  dateCellTextActive: { color: "#ffffff" },
  dateClose: { alignItems: "center", backgroundColor: ios.fill, borderRadius: 12, marginTop: spacing.md, minHeight: 40, justifyContent: "center" },
  dateCloseText: { color: ios.label, fontFamily: fonts.semibold },
});
