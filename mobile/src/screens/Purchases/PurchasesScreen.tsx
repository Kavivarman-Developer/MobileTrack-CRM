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
  IosScreenHeader,
  IosSearchBar,
  PageHeader,
  Screen,
  SelectOption,
} from "../../components/Layout";
import { colors, fonts, radius, shadows, spacing, typography } from "../../constants/theme";
import {
  apiErrorMessage,
  createPurchaseOrder,
  getProducts,
  getPurchaseOrders,
  getVendors,
  Product,
  PurchaseOrder,
  receivePurchaseOrder,
} from "../../services/api";

const blankLine = { product: "", quantity: "1", costPrice: "" };
type DatePreset = "today" | "week" | "month" | "custom";

const statusColor: Record<string, { bg: string; text: string; dot: string }> = {
  ordered: { bg: "#FFFBEB", text: "#F59E0B", dot: "#F59E0B" },
  received: { bg: "#ECFDF5", text: "#10B981", dot: "#10B981" },
  cancelled: { bg: "#FEF2F2", text: "#EF4444", dot: "#EF4444" },
  draft: { bg: "#EFF6FF", text: "#0079F2", dot: "#0079F2" },
};

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
  const [refreshing, setRefreshing] = useState(false);

  const vendors = useQuery({ queryKey: ["vendors"], queryFn: () => getVendors("") });
  const products = useQuery({ queryKey: ["products", ""], queryFn: () => getProducts("") });
  const filterParams = useMemo(
    () => ({ ...getDateParams(datePreset, customDate), search: search.trim() || undefined }),
    [customDate, datePreset, search]
  );
  const purchaseOrders = useQuery({
    queryKey: ["purchase-orders", filterParams],
    queryFn: () => getPurchaseOrders(filterParams),
  });
  const queryClient = useQueryClient();

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.costPrice || 0), 0),
    [lines]
  );
  const orderItems = purchaseOrders.data?.items || [];
  const summary = purchaseOrders.data?.summary;
  const pendingCount = useMemo(
    () => orderItems.filter((item) => item.status !== "received" && item.status !== "cancelled").length,
    [orderItems]
  );

  const save = useMutation({
    mutationFn: () =>
      createPurchaseOrder({
        vendor,
        notes,
        status: "ordered",
        items: lines.map((line) => ({
          product: line.product,
          quantity: Number(line.quantity),
          costPrice: Number(line.costPrice),
        })) as any,
      }),
    onSuccess: () => {
      setOpen(false);
      setVendor("");
      setNotes("");
      setLines([blankLine]);
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      Alert.alert("Purchase Order Saved", "Use 'Receive Stock' once the vendor delivers the products.");
    },
    onError: (error: Error) => Alert.alert("Order Failed", apiErrorMessage(error)),
  });

  const receive = useMutation({
    mutationFn: receivePurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-summary"] });
      Alert.alert("Stock Received", "Inventory stocks have been updated successfully.");
    },
    onError: (error: Error) => Alert.alert("Receive Failed", apiErrorMessage(error)),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await purchaseOrders.refetch();
    setRefreshing(false);
  };

  function vendorName(po: PurchaseOrder) {
    return typeof po.vendor === "string" ? "Vendor" : po.vendor.name;
  }

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="Supplier Orders"
        right={
          <TouchableOpacity onPress={() => setOpen(true)} style={styles.addHeaderBtn}>
            <Ionicons color="#FFFFFF" name="add" size={18} />
            <Text style={styles.addHeaderBtnText}>New PO</Text>
          </TouchableOpacity>
        }
        title="Purchases"
      />

      <FlatList
        data={orderItems}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            {/* Top Metric Cards */}
            <View style={styles.metricsRow}>
              {/* Total Spend */}
              <View style={[styles.metricCard, { borderLeftColor: "#6366F1" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#EEF2FF" }]}>
                    <Ionicons color="#6366F1" name="cart" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>Spend</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  ₹{formatMoney(summary?.totalAmount || 0)}
                </Text>
                <Text style={styles.metricSub}>{summary?.orderCount || 0} Orders</Text>
              </View>

              {/* Total Orders */}
              <View style={[styles.metricCard, { borderLeftColor: "#0079F2" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}>
                    <Ionicons color="#0079F2" name="document-text" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>Orders</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  {orderItems.length}
                </Text>
                <Text style={styles.metricSub}>In this period</Text>
              </View>

              {/* Pending Delivery */}
              <View style={[styles.metricCard, { borderLeftColor: "#F59E0B" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#FFFBEB" }]}>
                    <Ionicons color="#F59E0B" name="time" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>Pending</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  {pendingCount}
                </Text>
                <Text style={styles.metricSub}>Awaiting stock</Text>
              </View>
            </View>

            {/* Search Bar */}
            <IosSearchBar
              onChangeText={setSearch}
              placeholder="Search vendor or order number..."
              style={styles.searchBar}
              value={search}
            />

            {/* Date Preset Segment */}
            <View style={styles.segmentContainer}>
              {(
                [
                  ["week", "7 Days"],
                  ["month", "Month"],
                  ["today", "Today"],
                  ["custom", "Custom"],
                ] as [DatePreset, string][]
              ).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  onPress={() => {
                    setDatePreset(key);
                    if (key === "custom") setShowDatePicker(true);
                  }}
                  style={[styles.segmentBtn, datePreset === key && styles.segmentBtnActive]}
                >
                  <Text style={[styles.segmentBtnText, datePreset === key && styles.segmentBtnTextActive]}>
                    {key === "custom" && datePreset === "custom" ? formatDateShort(customDate) : label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>Purchase Orders</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{orderItems.length}</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons color={colors.textMuted} name="cart-outline" size={44} />
            <Text style={styles.emptyTitle}>
              {purchaseOrders.isLoading ? "Loading purchase orders…" : "No purchase orders found"}
            </Text>
            <Text style={styles.emptySub}>
              {purchaseOrders.isLoading
                ? "Fetching data..."
                : "Create a purchase order when ordering stock from vendors."}
            </Text>
            {!purchaseOrders.isLoading && (
              <TouchableOpacity onPress={() => setOpen(true)} style={styles.emptyBtn}>
                <Ionicons color="#FFFFFF" name="add" size={18} />
                <Text style={styles.emptyBtnText}>New Purchase Order</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const cfg = statusColor[item.status] || { bg: "#EFF6FF", text: "#0079F2", dot: "#0079F2" };
          const canReceive = item.status !== "received" && item.status !== "cancelled";

          return (
            <View style={styles.poCard}>
              <View style={[styles.cardAccent, { backgroundColor: cfg.dot }]} />
              <View style={styles.poContent}>
                {/* Header Row */}
                <View style={styles.poHeaderRow}>
                  <View style={styles.poVendorInfo}>
                    <Text numberOfLines={1} style={styles.poVendorName}>
                      {vendorName(item)}
                    </Text>
                    <Text style={styles.poDate}>
                      Ordered on{" "}
                      {new Date(item.orderDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.text }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Items & Amount */}
                <View style={styles.poBody}>
                  <View style={styles.linesList}>
                    {item.items.slice(0, 3).map((line, idx) => {
                      const product = typeof line.product === "string" ? null : (line.product as Product);
                      return (
                        <Text key={idx} numberOfLines={1} style={styles.lineItemText}>
                          • {product?.name || "Product"} × {line.quantity}
                        </Text>
                      );
                    })}
                    {item.items.length > 3 && (
                      <Text style={styles.moreLinesText}>+{item.items.length - 3} more items</Text>
                    )}
                  </View>
                  <View style={styles.amountWrap}>
                    <Text style={styles.amountLabel}>Total Value</Text>
                    <Text style={styles.amountNum}>₹{formatMoney(item.totalAmount)}</Text>
                  </View>
                </View>

                {/* Action Bar */}
                {canReceive && (
                  <View style={styles.poActionRow}>
                    <TouchableOpacity
                      disabled={receive.isPending}
                      onPress={() => receive.mutate(item._id)}
                      style={styles.receiveBtn}
                      activeOpacity={0.8}
                    >
                      <Ionicons color="#FFFFFF" name="checkmark-done" size={16} />
                      <Text style={styles.receiveBtnText}>
                        {receive.isPending ? "Receiving Stock…" : "Receive Stock into Inventory"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
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

      {/* CREATE PURCHASE ORDER MODAL */}
      <Modal animationType="slide" visible={open}>
        <Screen style={styles.screen}>
          <PageHeader
            eyebrow="Create Purchase Order"
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setOpen(false)} />}
            title="New Order"
          />
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Select Supplier / Vendor</Text>
            {(vendors.data || []).map((item) => (
              <SelectOption
                key={item._id}
                label={item.name}
                meta={item.phone || item.email || "Vendor"}
                onPress={() => setVendor(item._id)}
                selected={vendor === item._id}
              />
            ))}

            <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Product Lines</Text>
            {lines.map((line, index) => (
              <View key={index} style={styles.lineBox}>
                <ProductSelect
                  products={products.data || []}
                  value={line.product}
                  onChange={(value) =>
                    setLines((prev) =>
                      prev.map((row, i) =>
                        i === index
                          ? {
                              ...row,
                              product: value,
                              costPrice: String(
                                (products.data || []).find((p) => p._id === value)?.costPrice || row.costPrice
                              ),
                            }
                          : row
                      )
                    )
                  }
                />
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.miniLabel}>Qty</Text>
                    <Field
                      keyboardType="numeric"
                      onChangeText={(value) =>
                        setLines((prev) => prev.map((row, i) => (i === index ? { ...row, quantity: value } : row)))
                      }
                      value={line.quantity}
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.miniLabel}>Cost Price (₹)</Text>
                    <Field
                      keyboardType="numeric"
                      onChangeText={(value) =>
                        setLines((prev) => prev.map((row, i) => (i === index ? { ...row, costPrice: value } : row)))
                      }
                      value={line.costPrice}
                    />
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity onPress={() => setLines((prev) => [...prev, blankLine])} style={styles.linkButton}>
              <Ionicons color={colors.primary} name="add-circle-outline" size={18} />
              <Text style={styles.linkText}>Add Another Product Line</Text>
            </TouchableOpacity>

            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total PO Amount</Text>
              <Text style={styles.totalValue}>₹{formatMoney(total)}</Text>
            </View>

            <Text style={styles.fieldLabel}>Order Notes / Instructions</Text>
            <Field onChangeText={setNotes} placeholder="Delivery expectations, invoice notes..." value={notes} />

            <TouchableOpacity
              disabled={save.isPending || !vendor}
              onPress={() => save.mutate()}
              style={[styles.saveBtn, (!vendor || save.isPending) && styles.saveBtnDisabled]}
              activeOpacity={0.8}
            >
              <Text style={styles.saveBtnText}>{save.isPending ? "Saving PO…" : "Create Purchase Order"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

function ProductSelect({
  onChange,
  products,
  value,
}: {
  onChange: (value: string) => void;
  products: Product[];
  value: string;
}) {
  return (
    <View style={{ marginBottom: 6 }}>
      <Text style={styles.miniLabel}>Item</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {products.slice(0, 10).map((item) => {
          const isSelected = value === item._id;
          return (
            <TouchableOpacity
              key={item._id}
              onPress={() => onChange(item._id)}
              style={[styles.itemPickChip, isSelected && styles.itemPickChipActive]}
            >
              <Text style={[styles.itemPickChipText, isSelected && styles.itemPickChipTextActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function DateSelectModal({
  month,
  onChangeMonth,
  onClose,
  onSelect,
  selectedDate,
  visible,
}: {
  month: string;
  onChangeMonth: (month: string) => void;
  onClose: () => void;
  onSelect: (date: string) => void;
  selectedDate: string;
  visible: boolean;
}) {
  const days = daysInMonth(month);
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.dateOverlay}>
        <View style={styles.dateModal}>
          <View style={styles.dateHeader}>
            <TouchableOpacity onPress={() => onChangeMonth(shiftMonth(month, -1))} style={styles.dateNav}>
              <Ionicons color={colors.textPrimary} name="chevron-back" size={18} />
            </TouchableOpacity>
            <Text style={styles.dateMonth}>{formatMonth(month)}</Text>
            <TouchableOpacity onPress={() => onChangeMonth(shiftMonth(month, 1))} style={styles.dateNav}>
              <Ionicons color={colors.textPrimary} name="chevron-forward" size={18} />
            </TouchableOpacity>
          </View>
          <View style={styles.dateGrid}>
            {days.map((date) => (
              <TouchableOpacity
                key={date}
                onPress={() => onSelect(date)}
                style={[styles.dateCell, selectedDate === date && styles.dateCellActive]}
              >
                <Text style={[styles.dateCellText, selectedDate === date && styles.dateCellTextActive]}>
                  {Number(date.slice(-2))}
                </Text>
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

  searchBar: { marginBottom: 10 },

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

  sectionHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  sectionLabel: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 16 },
  countBadge: {
    backgroundColor: colors.backgroundDark,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: { color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: 11 },

  // PO Card
  poCard: {
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
  poContent: { flex: 1, minWidth: 0, padding: 12 },
  poHeaderRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  poVendorInfo: { flex: 1, minWidth: 0, paddingRight: 8 },
  poVendorName: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 15 },
  poDate: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, marginTop: 1 },
  statusPill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontFamily: fonts.bold, fontSize: 10 },

  poBody: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
  },
  linesList: { flex: 1, minWidth: 0 },
  lineItemText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12, marginTop: 1 },
  moreLinesText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  amountWrap: { alignItems: "flex-end" },
  amountLabel: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10 },
  amountNum: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 16, marginTop: 1 },

  poActionRow: {
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 10,
  },
  receiveBtn: {
    alignItems: "center",
    backgroundColor: "#10B981",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingVertical: 9,
  },
  receiveBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 13 },

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

  // Modal
  modalContent: { padding: spacing.md, paddingBottom: 40 },
  fieldLabel: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 14, marginBottom: 8 },
  miniLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 11, marginBottom: 4 },
  lineBox: {
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    padding: 10,
  },
  row: { flexDirection: "row", gap: 8, marginTop: 6 },
  half: { flex: 1 },
  linkButton: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginBottom: 12,
    paddingVertical: 10,
  },
  linkText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 13 },
  totalBox: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    padding: 14,
  },
  totalLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 13 },
  totalValue: { color: colors.primary, fontFamily: fonts.bold, fontSize: 20 },
  saveBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    justifyContent: "center",
    marginTop: 10,
    paddingVertical: 14,
    ...shadows.sm,
  },
  saveBtnDisabled: { backgroundColor: "#CBD5E1" },
  saveBtnText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 15 },

  itemPickChip: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  itemPickChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  itemPickChipText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12 },
  itemPickChipTextActive: { color: "#FFFFFF", fontFamily: fonts.semibold },

  // Date Modal
  dateOverlay: { alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.5)", flex: 1, justifyContent: "center", padding: spacing.md },
  dateModal: { backgroundColor: colors.card, borderRadius: 20, padding: 16, width: "100%", maxWidth: 360 },
  dateHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  dateNav: { alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 10, height: 34, justifyContent: "center", width: 34 },
  dateMonth: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 15 },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dateCell: { alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 8, height: 38, justifyContent: "center", width: "12.8%" },
  dateCellActive: { backgroundColor: colors.primary },
  dateCellText: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 12 },
  dateCellTextActive: { color: "#FFFFFF" },
  dateClose: { alignItems: "center", backgroundColor: "#F1F5F9", borderRadius: 12, marginTop: 14, paddingVertical: 10 },
  dateCloseText: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 13 },
});

