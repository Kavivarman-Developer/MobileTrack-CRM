import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, useMemo, useState } from "react";
import { Alert, Modal, Platform, RefreshControl, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, FabButton, Field, IconButton, IosScreenHeader, IosSearchBar, PageHeader, Screen, StatStrip } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { colors, fonts, radius, shadows, spacing, typography } from "../../constants/theme";
import { apiErrorMessage, createManualOrder, getManualOrders, ManualOrder, ManualOrderStatus, updateManualOrderPaymentStatus, updateManualOrderStatus } from "../../services/api";

type OrderStatus = ManualOrderStatus;
type StatusFilter = "all" | OrderStatus;
type DateFilter = "all" | "today" | "week" | "month" | "custom";

const blank = { customerName: "", phone: "", shippingAddress: "", itemName: "", quantity: "1" };
const statuses: OrderStatus[] = ["new", "process", "pending", "shipped", "delivered"];

const statusColor: Record<OrderStatus, string> = {
  new: ios.blue,
  process: ios.indigo,
  pending: ios.orange,
  shipped: ios.teal,
  delivered: ios.green,
};

const statusIcon: Record<OrderStatus, keyof typeof Ionicons.glyphMap> = {
  new: "sparkles",
  process: "sync",
  pending: "time",
  shipped: "airplane",
  delivered: "checkmark-circle",
};

export default function OrdersScreen() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(todayKey().slice(0, 7));
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<ManualOrder | null>(null);
  const [form, setForm] = useState(blank);
  const [refreshing, setRefreshing] = useState(false);
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

  async function onRefresh() {
    setRefreshing(true);
    await ordersQuery.refetch();
    setRefreshing(false);
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
      newCount: monthOrders.filter((order) => order.status === "new").length,
    };
  }, [orders, selectedDate]);

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader eyebrow="Orders" title="Orders" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={ios.secondary} />}
        showsVerticalScrollIndicator={false}
      >
        <StatStrip
          items={[
            { label: "This month", value: String(monthStats.total), icon: "file-tray-full-outline", tone: "purple" },
            { label: "New", value: String(monthStats.newCount), icon: "sparkles-outline", tone: "blue" },
            { label: "Unpaid", value: String(monthStats.unpaid), icon: "time-outline", tone: "orange" },
          ]}
        />
        <IosSearchBar onChangeText={setSearch} placeholder="Search orders, customers, items…" value={search} />

        <View style={styles.segment}>
          {([
            ["today", "Today"],
            ["week", "7 days"],
            ["month", "Month"],
            ["all", "All"],
          ] as [DateFilter, string][]).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setDateFilter(key)}
              style={[styles.segmentItem, dateFilter === key && styles.segmentItemOn]}
            >
              <Text style={[styles.segmentText, dateFilter === key && styles.segmentTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          onPress={() => setDatePickerOpen(true)}
          style={[styles.datePick, dateFilter === "custom" && styles.datePickOn]}
        >
          <Ionicons color={dateFilter === "custom" ? ios.blue : ios.secondary} name="calendar-outline" size={16} />
          <Text style={[styles.datePickText, dateFilter === "custom" && styles.datePickTextOn]}>
            {dateFilter === "custom" ? formatDateShort(selectedDate) : "Pick a date"}
          </Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip active={filter === "all"} label="All" onPress={() => setFilter("all")} />
          {statuses.map((status) => (
            <FilterChip
              key={status}
              active={filter === status}
              color={statusColor[status]}
              icon={statusIcon[status]}
              label={statusLabel(status)}
              onPress={() => setFilter(status)}
            />
          ))}
        </ScrollView>

        <View style={styles.listHead}>
          <Text style={styles.sectionLabelInline}>{dateGroupLabel(dateFilter)}</Text>
          <Text style={styles.listCount}>{filtered.length}</Text>
        </View>

        {filtered.length ? (
          <View style={styles.list}>
            {filtered.map((order) => (
              <TouchableOpacity key={order._id} onPress={() => setSelected(order)} style={styles.orderCard}>
                <View style={[styles.accent, { backgroundColor: statusColor[order.status] }]} />
                <View style={styles.orderInner}>
                  <View style={styles.orderTop}>
                    <View style={[styles.avatar, { backgroundColor: `${statusColor[order.status]}1F` }]}>
                      <Ionicons color={statusColor[order.status]} name={statusIcon[order.status]} size={18} />
                    </View>
                    <View style={styles.orderTitleBlock}>
                      <Text numberOfLines={1} style={styles.orderNo}>{order.orderNo}</Text>
                      <Text numberOfLines={1} style={styles.orderCustomer}>{order.customerName}</Text>
                    </View>
                    <View style={[styles.payPill, order.paymentStatus === "paid" ? styles.payPaid : styles.payUnpaid]}>
                      <Text style={[styles.payPillText, order.paymentStatus === "paid" ? styles.payPaidText : styles.payUnpaidText]}>
                        {order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                      </Text>
                    </View>
                  </View>
                  <Text numberOfLines={1} style={styles.orderItem}>{order.itemName}</Text>
                  <View style={styles.orderFoot}>
                    <Text style={styles.orderMeta}>{order.quantity} qty · {formatDateTime(order.createdAt)}</Text>
                    <View style={styles.orderFootRight}>
                      <Text style={[styles.statusText, { color: statusColor[order.status] }]}>{statusLabel(order.status)}</Text>
                      <Ionicons color="#C7C7CC" name="chevron-forward" size={16} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons color={ios.blue} name="receipt-outline" size={28} />
            </View>
            <Text style={styles.emptyTitle}>{ordersQuery.isLoading ? "Loading orders…" : "No orders here"}</Text>
            <Text style={styles.emptyText}>
              {ordersQuery.isLoading ? "Pull to refresh if this takes a moment." : "Try another filter, or create a new manual order."}
            </Text>
            {!ordersQuery.isLoading ? (
              <TouchableOpacity onPress={() => setFormOpen(true)} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>Create order</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>

      <FabButton accessibilityLabel="Create order" onPress={() => setFormOpen(true)} />

      <CreateOrderModal form={form} onChange={setForm} onClose={() => setFormOpen(false)} onSave={createOrder} saving={createMutation.isPending} visible={formOpen} />
      <OrderDetailSheet
        order={selected}
        onClose={() => setSelected(null)}
        onPaymentStatusChange={(order, paymentStatus) => paymentStatusMutation.mutate({ order, paymentStatus })}
        onStatusChange={(order, status) => statusMutation.mutate({ order, status })}
      />
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

function FilterChip({
  active,
  color,
  icon,
  label,
  onPress,
}: {
  active: boolean;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipOn]}>
      {icon ? <Ionicons color={active ? "#FFFFFF" : color || ios.label} name={icon} size={14} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function CreateOrderModal({ form, onChange, onClose, onSave, saving, visible }: { form: typeof blank; onChange: (form: typeof blank) => void; onClose: () => void; onSave: () => void; saving: boolean; visible: boolean }) {
  return (
    <Modal animationType="slide" visible={visible}>
      <Screen>
        <PageHeader
          eyebrow="Manual order"
          right={<IconButton accessibilityLabel="Close" icon="close" onPress={onClose} />}
          title="Create New Order"
        />
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
        <PageHeader
          left={(
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
              <Ionicons color={colors.text} name="chevron-back" size={24} />
            </TouchableOpacity>
          )}
          right={<Badge label={statusLabel(order.status)} tone={order.status === "delivered" ? "success" : "info"} />}
          title={order.orderNo}
        />

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
  return status.charAt(0).toUpperCase() + status.slice(1);
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
  if (filter === "today") return "Today";
  if (filter === "week") return "Last 7 days";
  if (filter === "month") return "This month";
  if (filter === "custom") return "Selected date";
  return "All orders";
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

const styles = StyleSheet.create({
  screen: { backgroundColor: ios.bg },
  header: { alignItems: "flex-start", flexDirection: "row", marginBottom: spacing.sm, marginTop: spacing.xxs, paddingHorizontal: spacing.md },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  greeting: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 12 },
  title: { color: ios.label, fontFamily: fonts.bold, fontSize: 24, letterSpacing: -0.5, lineHeight: 28, marginTop: 1 },
  headerAdd: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    marginTop: spacing.xxs,
    width: 36,
  },
  content: { alignSelf: "center", maxWidth: 960, paddingBottom: 88, paddingHorizontal: spacing.md, width: "100%" },
  searchBox: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 12,
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  searchInput: { backgroundColor: "transparent", borderWidth: 0, flex: 1, marginBottom: 0, minHeight: 40, paddingHorizontal: 0, fontSize: 14 },

  hero: {
    backgroundColor: ios.dark,
    borderRadius: 18,
    marginBottom: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    width: "100%",
  },
  heroOverline: { color: "rgba(255,255,255,0.62)", fontFamily: fonts.medium, fontSize: 12 },
  heroAmount: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 30, letterSpacing: -0.8, lineHeight: 36, marginTop: 2 },
  heroSub: { color: "rgba(255,255,255,0.55)", fontFamily: fonts.regular, fontSize: 12.5, marginTop: 2 },
  heroPills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  heroPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    color: "#FFFFFF",
    fontFamily: fonts.medium,
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  heroCta: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  heroCtaText: { color: ios.dark, fontFamily: fonts.semibold, fontSize: 14 },

  segment: { backgroundColor: ios.fill, borderRadius: 10, flexDirection: "row", padding: 2 },
  segmentItem: { alignItems: "center", borderRadius: 8, flex: 1, justifyContent: "center", minHeight: 32 },
  segmentItemOn: { backgroundColor: ios.card },
  segmentText: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 12 },
  segmentTextOn: { color: ios.label, fontFamily: fonts.semibold },
  datePick: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: ios.card,
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  datePickOn: { backgroundColor: "#007AFF14" },
  datePickText: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 12 },
  datePickTextOn: { color: ios.blue },

  chipRow: { gap: spacing.xs, marginTop: 10, paddingBottom: 2 },
  chip: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  chipOn: { backgroundColor: ios.label },
  chipText: { color: ios.label, fontFamily: fonts.semibold, fontSize: 12 },
  chipTextOn: { color: "#FFFFFF" },

  listHead: { alignItems: "center", flexDirection: "row", marginBottom: spacing.xs, marginLeft: 2, marginTop: 12 },
  sectionLabelInline: { color: ios.secondary, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.2, textTransform: "uppercase" },
  listCount: {
    backgroundColor: ios.fill,
    borderRadius: 999,
    color: ios.label,
    fontFamily: fonts.semibold,
    fontSize: 11,
    marginLeft: spacing.xs,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  list: { gap: 8, width: "100%" },
  orderCard: {
    backgroundColor: ios.card,
    borderRadius: 16,
    flexDirection: "row",
    overflow: "hidden",
    width: "100%",
  },
  accent: { width: 4 },
  orderInner: { flex: 1, minWidth: 0, padding: 11 },
  orderTop: { alignItems: "center", flexDirection: "row", gap: 8 },
  avatar: { alignItems: "center", borderRadius: 12, height: 36, justifyContent: "center", width: 36 },
  orderTitleBlock: { flex: 1, minWidth: 0 },
  orderNo: { color: ios.label, fontFamily: fonts.semibold, fontSize: 15, letterSpacing: -0.3 },
  orderCustomer: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12.5, marginTop: 1 },
  payPill: { borderRadius: 999, paddingHorizontal: spacing.xs, paddingVertical: 2 },
  payPaid: { backgroundColor: "#34C7591F" },
  payUnpaid: { backgroundColor: "#FF3B301F" },
  payPillText: { fontFamily: fonts.semibold, fontSize: 10.5 },
  payPaidText: { color: ios.green },
  payUnpaidText: { color: ios.red },
  orderItem: { color: ios.label, fontFamily: fonts.medium, fontSize: 13, marginTop: 6 },
  orderFoot: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  orderMeta: { color: ios.secondary, flex: 1, fontFamily: fonts.regular, fontSize: 11.5 },
  orderFootRight: { alignItems: "center", flexDirection: "row", gap: spacing.xxs },
  statusText: { fontFamily: fonts.semibold, fontSize: 11.5 },

  emptyCard: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingVertical: 20,
    width: "100%",
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "#007AFF14",
    borderRadius: 20,
    height: 42,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 48,
  },
  emptyTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 15 },
  emptyText: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 13, marginTop: spacing.xxs, textAlign: "center" },
  emptyBtn: {
    backgroundColor: ios.dark,
    borderRadius: 12,
    marginTop: spacing.md,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 13, textAlign: "center" },

  formContent: { paddingBottom: spacing.xl, maxWidth: 640, alignSelf: "center", width: "100%" },
  fieldLabel: { color: colors.text, ...typography.label, marginBottom: spacing.xs },

  labelChoices: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  labelChoice: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  labelChoiceText: { color: colors.text, fontSize: 12.5, fontWeight: "600" },
  unpaidChoiceActive: { backgroundColor: colors.redSoft, borderColor: colors.danger },
  unpaidChoiceText: { color: colors.danger },
  paidChoiceActive: { backgroundColor: colors.greenSoft, borderColor: colors.success },
  paidChoiceText: { color: colors.success },

  iconButton: { alignItems: "center", height: 38, justifyContent: "center", width: 38 },
  detailContent: { paddingBottom: 64, maxWidth: 640, alignSelf: "center", width: "100%" },
  detailCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden", ...shadows.card },
  detailCardHeader: { padding: spacing.sm },
  detailTitleRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  detailCardTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  detailBody: { borderTopColor: colors.border, borderTopWidth: 1, padding: spacing.sm },
  infoRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xs },
  infoLabel: { color: colors.muted, fontSize: 12.5, fontWeight: "500" },
  infoValue: { color: colors.text, flex: 1, fontSize: 12.5, fontWeight: "700", textAlign: "right" },
  addressText: { color: colors.text, fontSize: 13, fontWeight: "500", lineHeight: 18 },
  statusGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  statusChoice: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  statusChoiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusChoiceText: { color: colors.text, fontSize: 11.5, fontWeight: "600" },
  statusChoiceTextActive: { color: "#ffffff" },

  timelineRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
  timelineDot: { backgroundColor: colors.success, borderRadius: radius.pill, height: 8, marginTop: 5, width: 8 },
  timelineDate: { color: colors.muted, fontSize: 11.5, fontWeight: "500", marginTop: 2 },
  detailActions: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, left: 0, padding: spacing.md, position: "absolute", right: 0 },
  printButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", minHeight: 40, justifyContent: "center" },
  printText: { color: colors.text, fontSize: 13, fontWeight: "600" },

  dateOverlay: { alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.45)", flex: 1, justifyContent: "center", padding: spacing.md },
  dateModal: { backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, width: "100%", maxWidth: 420 },
  dateHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  dateNav: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 34, justifyContent: "center", width: 34 },
  dateMonth: { color: colors.text, fontSize: 14, fontWeight: "700" },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  dateCell: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 34, justifyContent: "center", width: "13%" },
  dateCellActive: { backgroundColor: colors.primary },
  dateCellText: { color: colors.text, fontSize: 11.5, fontWeight: "600" },
  dateCellTextActive: { color: "#ffffff" },
  dateClose: { alignItems: "center", borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginTop: spacing.md, minHeight: 38, justifyContent: "center" },
  dateCloseText: { color: colors.text, fontWeight: "600", fontSize: 13 },
});
