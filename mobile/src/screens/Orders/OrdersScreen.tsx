import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, useMemo, useState } from "react";
import { Alert, Modal, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { apiErrorMessage, createManualOrder, getManualOrders, ManualOrder, ManualOrderStatus, updateManualOrderPaymentStatus, updateManualOrderStatus } from "../../services/api";

type OrderStatus = ManualOrderStatus;
type StatusFilter = "all" | OrderStatus;
type DateFilter = "all" | "today" | "week" | "month" | "custom";

const blank = { customerName: "", phone: "", shippingAddress: "", itemName: "", quantity: "1" };
const statuses: OrderStatus[] = ["new", "process", "pending", "shipped", "delivered"];

export default function OrdersScreen() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(todayKey().slice(0, 7));
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [pastWeekOpen, setPastWeekOpen] = useState(false);
  const [selected, setSelected] = useState<ManualOrder | null>(null);
  const [form, setForm] = useState(blank);
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({ queryKey: ["manual-orders"], queryFn: getManualOrders });
  const orders = ordersQuery.data || [];

  const createMutation = useMutation({
    mutationFn: () => createManualOrder({
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      shippingAddress: form.shippingAddress.trim(),
      itemName: form.itemName.trim(),
      quantity: Math.max(Number(form.quantity || 1), 1),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-orders"] });
      setForm(blank);
      setFormOpen(false);
      setPastWeekOpen(true);
    },
    onError: (error) => Alert.alert("Failed to save order", apiErrorMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ order, status }: { order: ManualOrder; status: OrderStatus }) => updateManualOrderStatus(order._id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["manual-orders"] });
      setSelected((current) => current?._id === updated._id ? updated : current);
    },
    onError: (error) => Alert.alert("Failed to update status", apiErrorMessage(error)),
  });

  const paymentStatusMutation = useMutation({
    mutationFn: ({ order, paymentStatus }: { order: ManualOrder; paymentStatus: ManualOrder["paymentStatus"] }) => updateManualOrderPaymentStatus(order._id, paymentStatus),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["manual-orders"] });
      setSelected((current) => current?._id === updated._id ? updated : current);
    },
    onError: (error) => Alert.alert("Failed to update payment status", apiErrorMessage(error)),
  });

  function createOrder() {
    if (!form.customerName.trim() || !form.itemName.trim()) {
      Alert.alert("Missing details", "Customer name and item name are required.");
      return;
    }
    createMutation.mutate();
  }

  function updateStatus(order: ManualOrder, status: OrderStatus) {
    statusMutation.mutate({ order, status });
  }

  function updatePaymentStatus(order: ManualOrder, paymentStatus: ManualOrder["paymentStatus"]) {
    paymentStatusMutation.mutate({ order, paymentStatus });
  }

  const filtered = useMemo(() => orders.filter((order) => {
    const statusMatch = filter === "all" || order.status === filter;
    const dateMatch = matchesDateFilter(order.createdAt, dateFilter, selectedDate);
    const keyword = search.trim().toLowerCase();
    const searchMatch = !keyword || `${order.orderNo} ${order.customerName} ${order.phone || ""} ${order.itemName} ${order.shippingAddress || ""}`.toLowerCase().includes(keyword);
    return statusMatch && dateMatch && searchMatch;
  }), [dateFilter, filter, orders, search, selectedDate]);
  const monthStats = useMemo(() => {
    const monthOrders = orders.filter((order) => matchesDateFilter(order.createdAt, "month", selectedDate));
    return {
      total: monthOrders.length,
      unpaid: monthOrders.filter((order) => order.paymentStatus === "unpaid").length,
    };
  }, [orders, selectedDate]);

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ORDER MANAGEMENT</Text>
          <Text style={styles.title}>Orders</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setSearchOpen((open) => !open)} style={styles.searchIconButton}>
            <Ionicons color={colors.text} name={searchOpen ? "close" : "search-outline"} size={22} />
          </TouchableOpacity>
        </View>
      </View>

      {searchOpen && (
        <View style={styles.searchBox}>
          <Ionicons color={colors.muted} name="search-outline" size={18} />
          <Field onChangeText={setSearch} placeholder="Search order ID, customer, item..." style={styles.searchInput} value={search} />
        </View>
      )}

      {/* Summary Banner */}
      <View style={styles.summaryPanel}>
        <View style={styles.summaryBlock}>
          <Text style={styles.summaryLabel}>THIS MONTH</Text>
          <Text style={styles.summaryValue}>{monthStats.total} {monthStats.total === 1 ? "order" : "orders"}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryBlockRight}>
          <Text style={styles.summaryLabel}>UNPAID</Text>
          <Text style={[styles.summaryValue, styles.summaryUnpaid]}>{monthStats.unpaid} {monthStats.unpaid === 1 ? "order" : "orders"}</Text>
        </View>
      </View>

      {/* Status Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
        <FilterChip active={filter === "all"} label={`All ${orders.length}`} onPress={() => setFilter("all")} />
        <FilterChip active={filter === "new"} dot={colors.info} label="New" onPress={() => setFilter("new")} />
        <FilterChip active={filter === "process"} dot={colors.purple} label="Process" onPress={() => setFilter("process")} />
        <FilterChip active={filter === "pending"} dot={colors.warning} label="Pending" onPress={() => setFilter("pending")} />
        <FilterChip active={filter === "shipped"} dot="#12B6CB" label="Shipped" onPress={() => setFilter("shipped")} />
        <FilterChip active={filter === "delivered"} dot={colors.success} label="Delivered" onPress={() => setFilter("delivered")} />
      </ScrollView>

      {/* Date Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateFilters} contentContainerStyle={styles.filtersContent}>
        <FilterChip active={dateFilter === "all"} label="All Dates" onPress={() => setDateFilter("all")} />
        <FilterChip active={dateFilter === "today"} label="Today" onPress={() => setDateFilter("today")} />
        <FilterChip active={dateFilter === "week"} label="7 Days" onPress={() => setDateFilter("week")} />
        <FilterChip active={dateFilter === "month"} label="Month" onPress={() => setDateFilter("month")} />
        <FilterChip active={dateFilter === "custom"} label={dateFilter === "custom" ? formatDateShort(selectedDate) : "Select Date"} onPress={() => setDatePickerOpen(true)} />
      </ScrollView>

      {/* Orders List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => setPastWeekOpen((open) => !open)} style={styles.groupHeader}>
          <Text style={styles.groupLabel}>{dateGroupLabel(dateFilter)}</Text>
          <Ionicons color={colors.muted} name={pastWeekOpen ? "chevron-up" : "chevron-down"} size={18} />
        </TouchableOpacity>
        {pastWeekOpen && (
          filtered.length ? filtered.map((order) => (
            <TouchableOpacity key={order._id} onPress={() => setSelected(order)} style={styles.orderCard}>
              <View style={styles.orderMainRow}>
                <View style={[styles.avatar, { backgroundColor: statusSoftTone[order.status] }]}>
                  <Text style={[styles.avatarText, { color: statusTone[order.status] }]}>{order.customerName.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderNo}>{order.orderNo}</Text>
                  <Text numberOfLines={1} style={styles.orderMeta}>{order.customerName} • {order.quantity} item • {formatDateTime(order.createdAt)}</Text>
                </View>
                <Badge label={order.paymentStatus === "paid" ? "Paid" : "Unpaid"} tone={order.paymentStatus === "paid" ? "success" : "danger"} />
              </View>
              <View style={styles.sourceRow}>
                <Ionicons color={colors.muted} name="document-text-outline" size={14} />
                <Text style={styles.sourceText}>Manual Order</Text>
                <Badge label={order.status.toUpperCase()} tone={order.status === "delivered" ? "success" : order.status === "pending" ? "warning" : "info"} />
              </View>
            </TouchableOpacity>
          )) : <Empty icon="receipt-outline" text={ordersQuery.isLoading ? "Loading orders..." : "No manual orders found."} />
        )}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity onPress={() => setFormOpen(true)} style={styles.fab}>
        <Ionicons color="#ffffff" name="add" size={28} />
      </TouchableOpacity>

      <CreateOrderModal form={form} onChange={setForm} onClose={() => setFormOpen(false)} onSave={createOrder} saving={createMutation.isPending} visible={formOpen} />
      <OrderDetailSheet order={selected} onClose={() => setSelected(null)} onPaymentStatusChange={updatePaymentStatus} onStatusChange={updateStatus} />
      <DateSelectModal
        month={pickerMonth}
        onChangeMonth={setPickerMonth}
        onClose={() => setDatePickerOpen(false)}
        onSelect={(date) => {
          setSelectedDate(date);
          setDateFilter("custom");
          setDatePickerOpen(false);
        }}
        selectedDate={selectedDate}
        visible={datePickerOpen}
      />
    </Screen>
  );
}

function CreateOrderModal({ form, onChange, onClose, onSave, saving, visible }: { form: typeof blank; onChange: (form: typeof blank) => void; onClose: () => void; onSave: () => void; saving: boolean; visible: boolean }) {
  return (
    <Modal animationType="slide" visible={visible}>
      <Screen>
        <View style={styles.modalHeader}>
          <Text style={styles.titleSmall}>Create New Order</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons color={colors.text} name="close" size={20} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Customer Name</Text>
          <Field onChangeText={(value) => onChange({ ...form, customerName: value })} placeholder="e.g. Rahul Sharma" value={form.customerName} />
          <Text style={styles.fieldLabel}>Phone Number</Text>
          <Field keyboardType="phone-pad" onChangeText={(value) => onChange({ ...form, phone: value })} placeholder="+91..." value={form.phone} />
          <Text style={styles.fieldLabel}>Shipping Address</Text>
          <Field onChangeText={(value) => onChange({ ...form, shippingAddress: value })} placeholder="City / Address" value={form.shippingAddress} />
          <Text style={styles.fieldLabel}>Item Name</Text>
          <Field onChangeText={(value) => onChange({ ...form, itemName: value })} placeholder="Item title" value={form.itemName} />
          <Text style={styles.fieldLabel}>Quantity</Text>
          <Field keyboardType="numeric" onChangeText={(value) => onChange({ ...form, quantity: value })} placeholder="1" value={form.quantity} />
          <Button icon="checkmark-circle-outline" loading={saving} onPress={onSave} title="Save Order" />
        </ScrollView>
      </Screen>
    </Modal>
  );
}

function OrderDetailSheet({ order, onClose, onPaymentStatusChange, onStatusChange }: { order: ManualOrder | null; onClose: () => void; onPaymentStatusChange: (order: ManualOrder, paymentStatus: ManualOrder["paymentStatus"]) => void; onStatusChange: (order: ManualOrder, status: OrderStatus) => void }) {
  if (!order) return null;
  return (
    <Modal animationType="slide" visible={!!order}>
      <Screen>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={onClose} style={styles.iconButton}>
            <Ionicons color={colors.text} name="chevron-back" size={24} />
          </TouchableOpacity>
          <Text style={styles.detailNo}>{order.orderNo}</Text>
          <Badge label={statusLabel(order.status)} tone={order.status === "delivered" ? "success" : "info"} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
          <DetailCard icon="cube-outline" title="Order Status">
            <View style={styles.statusGrid}>
              {statuses.map((status) => (
                <TouchableOpacity key={status} onPress={() => onStatusChange(order, status)} style={[styles.statusChoice, order.status === status && styles.statusChoiceActive]}>
                  <Text style={[styles.statusChoiceText, order.status === status && styles.statusChoiceTextActive]}>{statusLabel(status)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </DetailCard>

          <DetailCard icon="pricetag-outline" title="Payment Status">
            <View style={styles.labelChoices}>
              <TouchableOpacity onPress={() => onPaymentStatusChange(order, "unpaid")} style={[styles.labelChoice, order.paymentStatus === "unpaid" && styles.unpaidChoiceActive]}>
                <Ionicons color={colors.danger} name="alert-circle-outline" size={14} />
                <Text style={[styles.labelChoiceText, order.paymentStatus === "unpaid" && styles.unpaidChoiceText]}>Unpaid</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onPaymentStatusChange(order, "paid")} style={[styles.labelChoice, order.paymentStatus === "paid" && styles.paidChoiceActive]}>
                <Ionicons color={colors.success} name="checkmark-circle-outline" size={14} />
                <Text style={[styles.labelChoiceText, order.paymentStatus === "paid" && styles.paidChoiceText]}>Paid</Text>
              </TouchableOpacity>
            </View>
          </DetailCard>

          <DetailCard icon="document-text-outline" title="Order Details">
            <InfoRow label="Order ID" value={order.orderNo} />
            <InfoRow label="Current Status" value={statusLabel(order.status)} />
            <InfoRow label="Source" value="Manual" />
          </DetailCard>

          <DetailCard icon="person-outline" title="Customer Information">
            <InfoRow label="Name" value={order.customerName} />
            <InfoRow label="Phone" value={order.phone || "-"} />
          </DetailCard>

          <DetailCard icon="location-outline" title="Shipping Address">
            <Text style={styles.addressText}>{order.shippingAddress || "No shipping address added"}</Text>
          </DetailCard>

          <DetailCard icon="cube-outline" title="Items Purchased">
            <InfoRow label="Item Name" value={order.itemName} />
            <InfoRow label="Quantity" value={String(order.quantity)} />
          </DetailCard>

          <DetailCard icon="time-outline" title="Order Timeline">
            {order.timeline.map((row) => <Timeline key={`${row.status}-${row.timestamp}`} date={formatDateTime(row.timestamp)} label={statusLabel(row.status)} />)}
          </DetailCard>
        </ScrollView>

        <View style={styles.detailActions}>
          <TouchableOpacity onPress={() => printAddress(order)} style={styles.printButton}>
            <Ionicons color={colors.text} name="print-outline" size={18} style={{ marginRight: 6 }} />
            <Text style={styles.printText}>Print Shipping Address</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    </Modal>
  );
}

async function printAddress(order: ManualOrder) {
  const address = (order.shippingAddress || "").trim();
  if (!address) {
    Alert.alert("No address", "Shipping address is empty for this order.");
    return;
  }

  const text = [
    "Shipping Address",
    "",
    order.customerName,
    order.phone,
    address,
    "",
    `Order: ${order.orderNo}`,
    `Item: ${order.itemName} x ${order.quantity}`,
  ].filter(Boolean).join("\n");

  if (Platform.OS === "web" && typeof window !== "undefined") {
    const printWindow = window.open("", "_blank", "width=420,height=640");
    if (!printWindow) {
      Alert.alert("Print blocked", "Allow pop-ups to print the address.");
      return;
    }
    printWindow.document.write(`
      <html>
        <head>
          <title>${order.orderNo} Address</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111827; }
            .label { border: 1px solid #d1d5db; border-radius: 12px; padding: 20px; max-width: 360px; }
            h2 { margin: 0 0 16px; font-size: 20px; }
            p { margin: 6px 0; font-size: 15px; line-height: 1.45; }
            .meta { margin-top: 18px; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="label">
            <h2>Shipping Address</h2>
            <p><strong>${escapeHtml(order.customerName)}</strong></p>
            ${order.phone ? `<p>${escapeHtml(order.phone)}</p>` : ""}
            <p>${escapeHtml(address).replace(/\n/g, "<br />")}</p>
            <p class="meta">${escapeHtml(order.orderNo)} | ${escapeHtml(order.itemName)} x ${order.quantity}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return;
  }

  await Share.share({ message: text, title: `${order.orderNo} Address` });
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function DetailCard({ children, icon, title }: { children: ReactNode; icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.detailCard}>
      <View style={styles.detailCardHeader}>
        <View style={styles.detailTitleRow}>
          <Ionicons color={colors.primary} name={icon} size={18} />
          <Text style={styles.detailCardTitle}>{title}</Text>
        </View>
      </View>
      <View style={styles.detailBody}>{children}</View>
    </View>
  );
}

function FilterChip({ active, dot, label, onPress }: { active: boolean; dot?: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      {dot && <View style={[styles.filterDot, { backgroundColor: dot }]} />}
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Timeline({ date, label }: { date: string; label: string }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineDot} />
      <View>
        <Badge label={label} tone="success" />
        <Text style={styles.timelineDate}>{date}</Text>
      </View>
    </View>
  );
}

function DateSelectModal({ month, onChangeMonth, onClose, onSelect, selectedDate, visible }: { month: string; onChangeMonth: (month: string) => void; onClose: () => void; onSelect: (date: string) => void; selectedDate: string; visible: boolean }) {
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
            {daysInMonth(month).map((date) => (
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

function statusLabel(status: OrderStatus) {
  return status.toUpperCase();
}

function formatDateTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function matchesDateFilter(value: string, filter: DateFilter, selectedDate: string) {
  if (filter === "all") return true;
  const date = new Date(value);
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (filter === "today") return date >= start;
  if (filter === "week") {
    start.setDate(now.getDate() - 6);
    return date >= start;
  }
  if (filter === "custom") return toDateKey(date) === selectedDate;
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function dateGroupLabel(filter: DateFilter) {
  if (filter === "today") return "TODAY";
  if (filter === "week") return "LAST 7 DAYS";
  if (filter === "month") return "THIS MONTH";
  if (filter === "custom") return "SELECTED DATE";
  return "ALL DATES";
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
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

const statusTone = { new: colors.info, process: colors.purple, pending: colors.warning, shipped: "#12B6CB", delivered: colors.success } as const;
const statusSoftTone = { new: colors.blueSoft, process: colors.purpleSoft, pending: colors.orangeSoft, shipped: "#E5FAFC", delivered: colors.greenSoft } as const;

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, fontSize: 24 },
  titleSmall: { color: colors.text, ...typography.h2 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  searchIconButton: { alignItems: "center", height: 38, justifyContent: "center", width: 38 },
  searchBox: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs, minHeight: 44, paddingHorizontal: spacing.sm },
  searchInput: { backgroundColor: "transparent", borderWidth: 0, flex: 1, marginBottom: 0, minHeight: 40, paddingHorizontal: 0 },

  summaryPanel: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", marginBottom: spacing.sm, minHeight: 64, paddingHorizontal: spacing.md, ...shadows.card },
  summaryBlock: { flex: 1 },
  summaryBlockRight: { alignItems: "flex-end", flex: 1 },
  summaryDivider: { backgroundColor: colors.border, height: 34, marginHorizontal: spacing.md, width: 1 },
  summaryLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  summaryValue: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 2 },
  summaryUnpaid: { color: colors.danger },

  filters: { flexGrow: 0, height: 38, marginBottom: spacing.xs, marginHorizontal: -spacing.md },
  dateFilters: { flexGrow: 0, height: 38, marginBottom: spacing.xs, marginHorizontal: -spacing.md },
  filtersContent: { gap: spacing.xs, paddingHorizontal: spacing.md },
  filterChip: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 32, paddingHorizontal: spacing.sm },
  filterChipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  filterDot: { borderRadius: radius.pill, height: 8, width: 8 },
  filterText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: "#ffffff" },

  content: { paddingBottom: 110, paddingTop: 4 },
  groupHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 6, minHeight: 24 },
  groupLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  orderCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.md, ...shadows.card },
  orderMainRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  avatar: { alignItems: "center", borderRadius: radius.pill, height: 38, justifyContent: "center", width: 38 },
  avatarText: { fontSize: 14, fontWeight: "700" },
  orderInfo: { flex: 1, minWidth: 0 },
  orderNo: { color: colors.text, fontSize: 15, fontWeight: "700" },
  orderMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },

  labelChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  labelChoice: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  labelChoiceText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  unpaidChoiceActive: { backgroundColor: colors.redSoft, borderColor: colors.danger },
  unpaidChoiceText: { color: colors.danger },
  paidChoiceActive: { backgroundColor: colors.greenSoft, borderColor: colors.success },
  paidChoiceText: { color: colors.success },

  sourceRow: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm, paddingTop: spacing.xs },
  sourceText: { color: colors.muted, fontSize: 12, fontWeight: "500" },

  fab: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.pill, bottom: spacing.lg, height: 52, justifyContent: "center", position: "absolute", right: spacing.lg, width: 52, ...shadows.floating },
  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  closeButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 40, justifyContent: "center", width: 40 },
  formContent: { paddingBottom: spacing.xl },
  fieldLabel: { color: colors.text, ...typography.label, marginBottom: spacing.xs },

  detailHeader: { alignItems: "center", flexDirection: "row", gap: spacing.xs, justifyContent: "space-between", marginBottom: spacing.sm },
  iconButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  detailNo: { color: colors.text, fontSize: 18, fontWeight: "700" },
  detailContent: { paddingBottom: 80 },
  detailCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden", ...shadows.card },
  detailCardHeader: { padding: spacing.sm },
  detailTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  detailCardTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  detailBody: { borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.sm },
  infoRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  infoLabel: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  infoValue: { color: colors.text, flex: 1, fontSize: 13, fontWeight: "700", textAlign: "right" },
  addressText: { color: colors.text, fontSize: 14, fontWeight: "500", lineHeight: 20 },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  statusChoice: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: 8 },
  statusChoiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusChoiceText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  statusChoiceTextActive: { color: "#ffffff" },

  timelineRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
  timelineDot: { backgroundColor: colors.success, borderRadius: radius.pill, height: 8, marginTop: 6, width: 8 },
  timelineDate: { color: colors.muted, fontSize: 12, fontWeight: "500", marginTop: 2 },
  detailActions: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, left: 0, padding: spacing.md, position: "absolute", right: 0 },
  printButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", minHeight: 48, justifyContent: "center" },
  printText: { color: colors.text, fontSize: 14, fontWeight: "600" },

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
