import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Platform, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";

type OrderStatus = "new" | "process" | "pending" | "shipped" | "delivered";
type StatusFilter = "all" | OrderStatus;
type DateFilter = "all" | "today" | "week" | "month" | "custom";

type ManualOrder = {
  id: string;
  customerName: string;
  phone: string;
  shippingAddress: string;
  itemName: string;
  quantity: number;
  status: OrderStatus;
  paymentStatus: "unpaid" | "paid";
  source: "Manual";
  createdAt: string;
  timeline: { status: OrderStatus; timestamp: string }[];
};

const STORAGE_KEY = "manual-orders-v1";
const blank = { customerName: "", phone: "", shippingAddress: "", itemName: "", quantity: "1" };
const statuses: OrderStatus[] = ["new", "process", "pending", "shipped", "delivered"];

export default function OrdersScreen() {
  const [orders, setOrders] = useState<ManualOrder[]>([]);
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

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((value) => {
      if (value) setOrders(JSON.parse(value));
    }).catch(() => {});
  }, []);

  async function saveOrders(next: ManualOrder[]) {
    setOrders(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function createOrder() {
    if (!form.customerName.trim() || !form.itemName.trim()) {
      Alert.alert("Missing details", "Customer name and item name are required.");
      return;
    }
    const now = new Date().toISOString();
    const order: ManualOrder = {
      id: nextOrderId(orders.length + 1),
      customerName: form.customerName.trim(),
      phone: form.phone.trim(),
      shippingAddress: form.shippingAddress.trim(),
      itemName: form.itemName.trim(),
      quantity: Math.max(Number(form.quantity || 1), 1),
      status: "new",
      paymentStatus: "unpaid",
      source: "Manual",
      createdAt: now,
      timeline: [{ status: "new", timestamp: now }],
    };
    saveOrders([order, ...orders]);
    setForm(blank);
    setFormOpen(false);
    setPastWeekOpen(true);
  }

  function updateStatus(order: ManualOrder, status: OrderStatus) {
    const now = new Date().toISOString();
    const next = orders.map((item) => item.id === order.id ? {
      ...item,
      status,
      timeline: item.status === status ? item.timeline : [{ status, timestamp: now }, ...item.timeline],
    } : item);
    saveOrders(next);
    setSelected((current) => current?.id === order.id ? next.find((item) => item.id === order.id) || current : current);
  }

  function updatePaymentStatus(order: ManualOrder, paymentStatus: ManualOrder["paymentStatus"]) {
    const next = orders.map((item) => item.id === order.id ? { ...item, paymentStatus } : item);
    saveOrders(next);
    setSelected((current) => current?.id === order.id ? next.find((item) => item.id === order.id) || current : current);
  }

  const filtered = useMemo(() => orders.filter((order) => {
    const statusMatch = filter === "all" || order.status === filter;
    const dateMatch = matchesDateFilter(order.createdAt, dateFilter, selectedDate);
    const keyword = search.trim().toLowerCase();
    const searchMatch = !keyword || `${order.id} ${order.customerName} ${order.phone} ${order.itemName} ${order.shippingAddress}`.toLowerCase().includes(keyword);
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
        <Text style={styles.title}>Orders</Text>
        <View style={styles.headerActions}>
          <Ionicons color={colors.text} name="checkbox-outline" size={24} />
          <Ionicons color={colors.text} name="filter-outline" size={25} />
          <TouchableOpacity onPress={() => setSearchOpen((open) => !open)} style={styles.searchIconButton}>
            <Ionicons color={colors.text} name={searchOpen ? "close" : "search-outline"} size={25} />
          </TouchableOpacity>
        </View>
      </View>
      {searchOpen && (
        <View style={styles.searchBox}>
          <Ionicons color={colors.muted} name="search-outline" size={17} />
          <Field onChangeText={setSearch} placeholder="Search order, customer, item" style={styles.searchInput} value={search} />
        </View>
      )}

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
        <FilterChip active={filter === "all"} label={`All ${orders.length}`} onPress={() => setFilter("all")} />
        <FilterChip active={filter === "new"} dot={colors.info} label="New" onPress={() => setFilter("new")} />
        <FilterChip active={filter === "process"} dot={colors.purple} label="Process" onPress={() => setFilter("process")} />
        <FilterChip active={filter === "pending"} dot={colors.warning} label="Pending" onPress={() => setFilter("pending")} />
        <FilterChip active={filter === "shipped"} dot="#12B6CB" label="Shipped" onPress={() => setFilter("shipped")} />
        <FilterChip active={filter === "delivered"} dot={colors.success} label="Delivered" onPress={() => setFilter("delivered")} />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dateFilters} contentContainerStyle={styles.filtersContent}>
        <FilterChip active={dateFilter === "all"} label="All Dates" onPress={() => setDateFilter("all")} />
        <FilterChip active={dateFilter === "today"} label="Today" onPress={() => setDateFilter("today")} />
        <FilterChip active={dateFilter === "week"} label="7 Days" onPress={() => setDateFilter("week")} />
        <FilterChip active={dateFilter === "month"} label="Month" onPress={() => setDateFilter("month")} />
        <FilterChip active={dateFilter === "custom"} label={dateFilter === "custom" ? formatDateShort(selectedDate) : "Select Date"} onPress={() => setDatePickerOpen(true)} />
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => setPastWeekOpen((open) => !open)} style={styles.groupHeader}>
          <Text style={styles.groupLabel}>{dateGroupLabel(dateFilter)}</Text>
          <Ionicons color={colors.muted} name={pastWeekOpen ? "chevron-up" : "chevron-down"} size={20} />
        </TouchableOpacity>
        {pastWeekOpen && (
          filtered.length ? filtered.map((order) => (
            <TouchableOpacity key={order.id} onPress={() => setSelected(order)} style={styles.orderCard}>
              <View style={styles.orderMainRow}>
                <View style={[styles.avatar, { backgroundColor: statusSoftTone[order.status] }]}>
                  <Text style={[styles.avatarText, { color: statusTone[order.status] }]}>{order.customerName.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.orderInfo}>
                  <Text style={styles.orderNo}>{order.id}</Text>
                  <Text numberOfLines={1} style={styles.orderMeta}>{order.customerName} - {order.quantity} item - {formatDateTime(order.createdAt)}</Text>
                </View>
                <View style={order.paymentStatus === "paid" ? styles.paidPill : styles.unpaidPill}>
                  <Text style={order.paymentStatus === "paid" ? styles.paidText : styles.unpaidText}>{order.paymentStatus === "paid" ? "Paid" : "Unpaid"}</Text>
                </View>
              </View>
              <View style={styles.sourceRow}>
                <Ionicons color={colors.muted} name="document-text-outline" size={13} />
                <Text style={styles.sourceText}>Manual</Text>
                <Ionicons color={colors.muted} name="chevron-forward" size={16} style={styles.sourceArrow} />
              </View>
            </TouchableOpacity>
          )) : <Empty text="No manual orders yet." />
        )}
      </ScrollView>

      <TouchableOpacity onPress={() => setFormOpen(true)} style={styles.fab}>
        <Ionicons color="#fff" name="add" size={34} />
      </TouchableOpacity>

      <CreateOrderModal form={form} onChange={setForm} onClose={() => setFormOpen(false)} onSave={createOrder} visible={formOpen} />
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

function CreateOrderModal({ form, onChange, onClose, onSave, visible }: { form: typeof blank; onChange: (form: typeof blank) => void; onClose: () => void; onSave: () => void; visible: boolean }) {
  return (
    <Modal animationType="slide" visible={visible}>
      <Screen>
        <View style={styles.modalHeader}>
          <Text style={styles.titleSmall}>Create Order</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}><Ionicons color={colors.text} name="close" size={20} /></TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <Text style={styles.fieldLabel}>Customer name</Text>
          <Field onChangeText={(value) => onChange({ ...form, customerName: value })} placeholder="Kevin" value={form.customerName} />
          <Text style={styles.fieldLabel}>Phone</Text>
          <Field keyboardType="phone-pad" onChangeText={(value) => onChange({ ...form, phone: value })} placeholder="+91..." value={form.phone} />
          <Text style={styles.fieldLabel}>Shipping address</Text>
          <Field onChangeText={(value) => onChange({ ...form, shippingAddress: value })} placeholder="Coimbatore" value={form.shippingAddress} />
          <Text style={styles.fieldLabel}>Item name</Text>
          <Field onChangeText={(value) => onChange({ ...form, itemName: value })} placeholder="Shopping" value={form.itemName} />
          <Text style={styles.fieldLabel}>Quantity</Text>
          <Field keyboardType="numeric" onChangeText={(value) => onChange({ ...form, quantity: value })} placeholder="1" value={form.quantity} />
          <Button onPress={onSave} title="Save order" />
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
          <TouchableOpacity onPress={onClose} style={styles.iconButton}><Ionicons color={colors.text} name="chevron-back" size={26} /></TouchableOpacity>
          <Text style={styles.detailNo}>{order.id}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusSoftTone[order.status] }]}>
            <View style={[styles.statusDot, { backgroundColor: statusTone[order.status] }]} />
            <Text style={[styles.statusPillText, { color: statusTone[order.status] }]}>{statusLabel(order.status)}</Text>
          </View>
          <View style={styles.iconButton}><Ionicons color={colors.text} name="ellipsis-horizontal" size={22} /></View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
          <DetailCard title="Status" icon="cube-outline">
            <View style={styles.statusGrid}>
              {statuses.map((status) => (
                <TouchableOpacity key={status} onPress={() => onStatusChange(order, status)} style={[styles.statusChoice, order.status === status && styles.statusChoiceActive]}>
                  <Text style={[styles.statusChoiceText, order.status === status && styles.statusChoiceTextActive]}>{statusLabel(status)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </DetailCard>
          <DetailCard title="Labels" icon="pricetag-outline">
            <View style={styles.labelChoices}>
              <TouchableOpacity onPress={() => onPaymentStatusChange(order, "unpaid")} style={[styles.labelChoice, order.paymentStatus === "unpaid" && styles.unpaidChoiceActive]}>
                <Ionicons color={colors.danger} name="pricetag" size={13} />
                <Text style={[styles.labelChoiceText, order.paymentStatus === "unpaid" && styles.unpaidChoiceText]}>Unpaid</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onPaymentStatusChange(order, "paid")} style={[styles.labelChoice, order.paymentStatus === "paid" && styles.paidChoiceActive]}>
                <Ionicons color={colors.success} name="checkmark-circle" size={13} />
                <Text style={[styles.labelChoiceText, order.paymentStatus === "paid" && styles.paidChoiceText]}>Paid</Text>
              </TouchableOpacity>
            </View>
          </DetailCard>
          <DetailCard title="Order Details" icon="document-text-outline">
            <InfoRow label="Order Number" value={order.id} />
            <InfoRow label="Status" value={statusLabel(order.status)} />
            <InfoRow label="Source" value={order.source} />
          </DetailCard>
          <DetailCard title="Customer Information" icon="person-outline">
            <InfoRow label="Name" value={order.customerName} />
            <InfoRow label="Phone" value={order.phone || "-"} />
          </DetailCard>
          <DetailCard title="Shipping Address" icon="location-outline">
            <Text style={styles.addressText}>{order.shippingAddress || "No address added"}</Text>
          </DetailCard>
          <DetailCard title="Items (1)" icon="cube-outline">
            <InfoRow label="Name" value={order.itemName} />
            <InfoRow label="Quantity" value={String(order.quantity)} />
          </DetailCard>
          <DetailCard title="Order Timeline" icon="time-outline">
            {order.timeline.map((row) => <Timeline key={`${row.status}-${row.timestamp}`} label={statusLabel(row.status)} date={formatDateTime(row.timestamp)} />)}
          </DetailCard>
        </ScrollView>

        <View style={styles.detailActions}>
          <TouchableOpacity onPress={() => printAddress(order)} style={styles.printButton}>
            <Ionicons color={colors.text} name="print-outline" size={20} />
            <Text style={styles.printText}>Print Address</Text>
          </TouchableOpacity>
          <View style={styles.disabledButton}>
            <Ionicons color="#fff" name="cube-outline" size={20} />
            <Text style={styles.disabledText}>{statusLabel(order.status)}</Text>
          </View>
        </View>
      </Screen>
    </Modal>
  );
}

async function printAddress(order: ManualOrder) {
  const address = order.shippingAddress.trim();
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
    `Order: ${order.id}`,
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
          <title>${order.id} Address</title>
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
            <p class="meta">${escapeHtml(order.id)} | ${escapeHtml(order.itemName)} x ${order.quantity}</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    return;
  }

  await Share.share({ message: text, title: `${order.id} Address` });
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function DetailCard({ children, icon, title }: { children: ReactNode; icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.detailCard}>
      <View style={styles.detailCardHeader}>
        <View style={styles.detailTitleRow}>
          <Ionicons color={colors.text} name={icon} size={20} />
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
        <Text style={styles.timelineBadge}>{label}</Text>
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
              <Ionicons color={colors.primaryDark} name="chevron-back" size={18} />
            </TouchableOpacity>
            <Text style={styles.dateMonth}>{formatMonth(month)}</Text>
            <TouchableOpacity onPress={() => onChangeMonth(shiftMonth(month, 1))} style={styles.dateNav}>
              <Ionicons color={colors.primaryDark} name="chevron-forward" size={18} />
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

function nextOrderId(count: number) {
  return `#SC${String(count).padStart(4, "0")}`;
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
const statusSoftTone = { new: colors.blueSoft, process: "#F1EAFF", pending: colors.orangeSoft, shipped: "#E5FAFC", delivered: colors.greenSoft } as const;

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  title: { color: colors.text, ...typography.h1, fontSize: 23 },
  titleSmall: { color: colors.text, ...typography.h1, fontSize: 22 },
  headerActions: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  searchIconButton: { alignItems: "center", height: 30, justifyContent: "center", width: 30 },
  searchBox: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs, minHeight: 38, paddingHorizontal: spacing.sm },
  searchInput: { backgroundColor: "transparent", borderWidth: 0, flex: 1, marginBottom: 0, minHeight: 36, paddingHorizontal: 0, paddingVertical: 0 },
  summaryPanel: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", marginBottom: spacing.sm, minHeight: 64, paddingHorizontal: spacing.md, ...shadows.card, shadowOpacity: 0.04 },
  summaryBlock: { flex: 1 },
  summaryBlockRight: { alignItems: "flex-end", flex: 1 },
  summaryDivider: { backgroundColor: colors.border, height: 34, marginHorizontal: spacing.md, width: 1 },
  summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: "900" },
  summaryValue: { color: colors.text, fontSize: 17, fontWeight: "900", marginTop: 4 },
  summaryUnpaid: { color: colors.danger },
  filters: { flexGrow: 0, height: 38, marginBottom: spacing.xs, marginHorizontal: -spacing.md },
  dateFilters: { flexGrow: 0, height: 38, marginBottom: spacing.xs, marginHorizontal: -spacing.md },
  filtersContent: { gap: spacing.xs, paddingHorizontal: spacing.md },
  filterChip: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 30, paddingHorizontal: spacing.sm },
  filterChipActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  filterDot: { borderRadius: radius.pill, height: 8, width: 8 },
  filterText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  filterTextActive: { color: "#fff" },
  content: { paddingBottom: 110, paddingTop: 2 },
  groupHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 4, minHeight: 24 },
  groupLabel: { color: colors.muted, fontSize: 12, fontWeight: "900" },
  orderCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden", padding: spacing.sm, ...shadows.card, shadowOpacity: 0.035 },
  orderMainRow: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  avatar: { alignItems: "center", borderRadius: radius.pill, height: 34, justifyContent: "center", width: 34 },
  avatarText: { fontSize: 13, fontWeight: "900" },
  orderInfo: { flex: 1, minWidth: 0 },
  orderTop: { alignItems: "center", flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
  statusDot: { borderRadius: radius.pill, height: 8, width: 8 },
  orderNo: { color: colors.text, fontSize: 14, fontWeight: "900" },
  orderMeta: { color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: 2 },
  unpaidPill: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.redSoft, borderRadius: radius.pill, flexDirection: "row", gap: 5, paddingHorizontal: spacing.xs, paddingVertical: 4 },
  unpaidText: { color: colors.danger, fontSize: 11, fontWeight: "900" },
  paidPill: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.greenSoft, borderRadius: radius.pill, flexDirection: "row", gap: 5, paddingHorizontal: spacing.xs, paddingVertical: 4 },
  paidText: { color: colors.success, fontSize: 11, fontWeight: "900" },
  labelChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  labelChoice: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: spacing.xs, paddingVertical: 6 },
  labelChoiceText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  unpaidChoiceActive: { backgroundColor: colors.redSoft, borderColor: colors.danger },
  unpaidChoiceText: { color: colors.danger },
  paidChoiceActive: { backgroundColor: colors.greenSoft, borderColor: colors.success },
  paidChoiceText: { color: colors.success },
  sourceRow: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", gap: spacing.xs, marginHorizontal: -spacing.sm, marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.xs },
  sourceIcon: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 28, justifyContent: "center", width: 28 },
  sourceText: { color: colors.muted, flex: 1, fontSize: 11, fontWeight: "800" },
  sourceArrow: { marginLeft: "auto" },
  fab: { alignItems: "center", backgroundColor: colors.secondary, borderRadius: radius.pill, bottom: spacing.lg, height: 56, justifyContent: "center", position: "absolute", right: spacing.lg, width: 56, ...shadows.floating },
  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.sm, height: 36, justifyContent: "center", width: 36, ...shadows.card },
  formContent: { paddingBottom: spacing.xl },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "800", marginBottom: spacing.xs, textTransform: "uppercase" },
  detailHeader: { alignItems: "center", flexDirection: "row", gap: spacing.xs, justifyContent: "space-between", marginBottom: spacing.xs },
  iconButton: { alignItems: "center", height: 36, justifyContent: "center", width: 36 },
  detailNo: { color: colors.text, fontSize: 16, fontWeight: "900" },
  statusPill: { alignItems: "center", borderRadius: radius.sm, flexDirection: "row", gap: 6, paddingHorizontal: spacing.xs, paddingVertical: 6 },
  statusPillText: { fontSize: 11, fontWeight: "900" },
  detailContent: { paddingBottom: 92 },
  detailCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden" },
  detailCardHeader: { padding: spacing.sm },
  detailTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  detailCardTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  detailBody: { borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.sm },
  infoRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  infoLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  infoValue: { color: colors.text, flex: 1, fontSize: 13, fontWeight: "900", textAlign: "right" },
  addressText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  statusChoice: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.xs, paddingVertical: 7 },
  statusChoiceActive: { backgroundColor: colors.secondary, borderColor: colors.secondary },
  statusChoiceText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  statusChoiceTextActive: { color: "#fff" },
  timelineRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
  timelineDot: { backgroundColor: colors.success, borderRadius: radius.pill, height: 8, marginTop: 6, width: 8 },
  timelineBadge: { alignSelf: "flex-start", backgroundColor: colors.greenSoft, borderRadius: 7, color: colors.success, fontSize: 11, fontWeight: "900", overflow: "hidden", paddingHorizontal: spacing.xs, paddingVertical: 3 },
  timelineDate: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  detailActions: { backgroundColor: colors.background, borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, flexDirection: "row", gap: spacing.xs, left: 0, padding: spacing.sm, position: "absolute", right: 0 },
  printButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, flexDirection: "row", gap: spacing.xs, justifyContent: "center", minHeight: 46 },
  printText: { color: colors.text, fontSize: 13, fontWeight: "900" },
  disabledButton: { alignItems: "center", backgroundColor: "#D0D4DD", borderRadius: radius.sm, flex: 1, flexDirection: "row", gap: spacing.xs, justifyContent: "center", minHeight: 46 },
  disabledText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  dateOverlay: { alignItems: "center", backgroundColor: "rgba(0,0,0,0.35)", flex: 1, justifyContent: "center", padding: spacing.md },
  dateModal: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, width: "100%" },
  dateHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  dateNav: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 36, justifyContent: "center", width: 36 },
  dateMonth: { color: colors.text, fontSize: 15, fontWeight: "900" },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  dateCell: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 36, justifyContent: "center", width: "13%" },
  dateCellActive: { backgroundColor: colors.primary },
  dateCellText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  dateCellTextActive: { color: "#fff" },
  dateClose: { alignItems: "center", borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginTop: spacing.md, minHeight: 40, justifyContent: "center" },
  dateCloseText: { color: colors.text, fontWeight: "900" },
});
