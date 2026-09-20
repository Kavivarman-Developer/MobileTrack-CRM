import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Badge, Button, FabButton, Field, IconButton, IosScreenHeader, IosSearchBar, PageHeader, Screen } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { colors, fonts, radius, shadows, spacing, typography } from "../../constants/theme";
import {
  apiErrorMessage,
  createManualOrder,
  getManualOrders,
  ManualOrder,
  ManualOrderStatus,
  updateManualOrderPaymentStatus,
  updateManualOrderStatus,
} from "../../services/api";

type OrderStatus = ManualOrderStatus;
type StatusFilter = "all" | OrderStatus;
type DateFilter = "all" | "today" | "week" | "month" | "custom";

const blank = { customerName: "", phone: "", shippingAddress: "", itemName: "", quantity: "1" };
const statuses: OrderStatus[] = ["new", "process", "pending", "shipped", "delivered"];

const statusColor: Record<OrderStatus, string> = {
  new: "#0079F2",
  process: "#6366F1",
  pending: "#F59E0B",
  shipped: "#0D9488",
  delivered: "#10B981",
};

const statusBg: Record<OrderStatus, string> = {
  new: "#EFF6FF",
  process: "#EEF2FF",
  pending: "#FFFBEB",
  shipped: "#F0FDFA",
  delivered: "#ECFDF5",
};

const statusBorder: Record<OrderStatus, string> = {
  new: "#BFDBFE",
  process: "#C7D2FE",
  pending: "#FDE68A",
  shipped: "#CCFBF1",
  delivered: "#A7F3D0",
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
    mutationFn: () =>
      createManualOrder({
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
    mutationFn: ({ order, status }: { order: ManualOrder; status: OrderStatus }) =>
      updateManualOrderStatus(order._id, status),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["manual-orders"] });
      setSelected((current) => (current?._id === updated._id ? updated : current));
    },
    onError: (error) => Alert.alert("Failed to update status", apiErrorMessage(error)),
  });

  const paymentStatusMutation = useMutation({
    mutationFn: ({
      order,
      paymentStatus,
    }: {
      order: ManualOrder;
      paymentStatus: ManualOrder["paymentStatus"];
    }) => updateManualOrderPaymentStatus(order._id, paymentStatus),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["manual-orders"] });
      setSelected((current) => (current?._id === updated._id ? updated : current));
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

  const filtered = useMemo(
    () =>
      orders.filter((order) => {
        const statusMatch = filter === "all" || order.status === filter;
        const dateMatch = matchesDateFilter(order.createdAt, dateFilter, selectedDate);
        const keyword = search.trim().toLowerCase();
        const searchMatch =
          !keyword ||
          `${order.orderNo} ${order.customerName} ${order.phone || ""} ${order.itemName} ${order.shippingAddress || ""}`
            .toLowerCase()
            .includes(keyword);
        return statusMatch && dateMatch && searchMatch;
      }),
    [dateFilter, filter, orders, search, selectedDate]
  );

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
      <IosScreenHeader eyebrow="Sales & Orders" title="Orders" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor="#0079F2" />}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================== */}
        {/* 1. TOP SUMMARY CARDS                       */}
        {/* ========================================== */}
        <View style={styles.summaryGrid}>
          <View style={[styles.summaryCard, { borderLeftColor: "#6366F1" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons color="#6366F1" name="file-tray-full-outline" size={18} />
            </View>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.summaryLabel}>THIS MONTH</Text>
              <Text style={styles.summaryValue}>{monthStats.total}</Text>
            </View>
          </View>

          <View style={[styles.summaryCard, { borderLeftColor: "#0079F2" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#EFF6FF" }]}>
              <Ionicons color="#0079F2" name="sparkles-outline" size={18} />
            </View>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.summaryLabel}>NEW ORDERS</Text>
              <Text style={styles.summaryValue}>{monthStats.newCount}</Text>
            </View>
          </View>

          <View style={[styles.summaryCard, { borderLeftColor: "#F59E0B" }]}>
            <View style={[styles.summaryIconWrap, { backgroundColor: "#FFFBEB" }]}>
              <Ionicons color="#F59E0B" name="time-outline" size={18} />
            </View>
            <View style={styles.summaryTextWrap}>
              <Text style={styles.summaryLabel}>UNPAID</Text>
              <Text style={styles.summaryValue}>{monthStats.unpaid}</Text>
            </View>
          </View>
        </View>

        {/* ========================================== */}
        {/* 2. SEARCH & DATE FILTER BAR                */}
        {/* ========================================== */}
        <IosSearchBar onChangeText={setSearch} placeholder="Search order #, customer, item, phone…" value={search} />

        <View style={styles.filterControlRow}>
          {/* Period Tabs */}
          <View style={styles.segment}>
            {(
              [
                ["today", "Today"],
                ["week", "7 Days"],
                ["month", "Month"],
                ["all", "All"],
              ] as [DateFilter, string][]
            ).map(([key, label]) => (
              <TouchableOpacity
                key={key}
                onPress={() => setDateFilter(key)}
                style={[styles.segmentItem, dateFilter === key && styles.segmentItemOn]}
                activeOpacity={0.75}
              >
                <Text style={[styles.segmentText, dateFilter === key && styles.segmentTextOn]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date Picker Button */}
          <TouchableOpacity
            onPress={() => setDatePickerOpen(true)}
            style={[styles.datePick, dateFilter === "custom" && styles.datePickOn]}
            activeOpacity={0.75}
          >
            <Ionicons color={dateFilter === "custom" ? "#0079F2" : "#64748B"} name="calendar-outline" size={15} />
            <Text style={[styles.datePickText, dateFilter === "custom" && styles.datePickTextOn]}>
              {dateFilter === "custom" ? formatDateShort(selectedDate) : "Calendar"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Status Filter Horizontal Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip active={filter === "all"} label="All Orders" count={orders.length} onPress={() => setFilter("all")} />
          {statuses.map((status) => {
            const count = orders.filter((o) => o.status === status).length;
            return (
              <FilterChip
                key={status}
                active={filter === status}
                color={statusColor[status]}
                icon={statusIcon[status]}
                label={statusLabel(status)}
                count={count}
                onPress={() => setFilter(status)}
              />
            );
          })}
        </ScrollView>

        {/* List Header Count */}
        <View style={styles.listHead}>
          <Text style={styles.sectionLabelInline}>{dateGroupLabel(dateFilter).toUpperCase()}</Text>
          <View style={styles.listCountWrap}>
            <Text style={styles.listCountText}>{filtered.length} {filtered.length === 1 ? "order" : "orders"}</Text>
          </View>
        </View>

        {/* ========================================== */}
        {/* 3. ORDERS LIST                             */}
        {/* ========================================== */}
        {filtered.length ? (
          <View style={styles.list}>
            {filtered.map((order) => (
              <TouchableOpacity
                key={order._id}
                onPress={() => setSelected(order)}
                style={styles.orderCard}
                activeOpacity={0.8}
              >
                {/* Left Colored Accent Stripe */}
                <View style={[styles.accent, { backgroundColor: statusColor[order.status] }]} />

                <View style={styles.orderInner}>
                  {/* Top Bar: Icon, Order No, Customer, Payment Pill */}
                  <View style={styles.orderTop}>
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: statusBg[order.status],
                          borderColor: statusBorder[order.status],
                        },
                      ]}
                    >
                      <Ionicons color={statusColor[order.status]} name={statusIcon[order.status]} size={18} />
                    </View>

                    <View style={styles.orderTitleBlock}>
                      <View style={styles.orderNoRow}>
                        <Text numberOfLines={1} style={styles.orderNo}>{order.orderNo}</Text>
                        <View style={[styles.statusBadge, { backgroundColor: statusBg[order.status], borderColor: statusBorder[order.status] }]}>
                          <Text style={[styles.statusBadgeText, { color: statusColor[order.status] }]}>
                            {statusLabel(order.status)}
                          </Text>
                        </View>
                      </View>
                      <Text numberOfLines={1} style={styles.orderCustomer}>{order.customerName}</Text>
                    </View>

                    <View style={[styles.payPill, order.paymentStatus === "paid" ? styles.payPaid : styles.payUnpaid]}>
                      <Ionicons
                        color={order.paymentStatus === "paid" ? "#10B981" : "#F59E0B"}
                        name={order.paymentStatus === "paid" ? "checkmark-circle" : "time-outline"}
                        size={11}
                        style={{ marginRight: 3 }}
                      />
                      <Text
                        style={[
                          styles.payPillText,
                          order.paymentStatus === "paid" ? styles.payPaidText : styles.payUnpaidText,
                        ]}
                      >
                        {order.paymentStatus === "paid" ? "Paid" : "Unpaid"}
                      </Text>
                    </View>
                  </View>

                  {/* Middle Item Description */}
                  <View style={styles.orderItemBox}>
                    <Ionicons color="#64748B" name="cube-outline" size={14} style={{ marginRight: 6 }} />
                    <Text numberOfLines={1} style={styles.orderItem}>{order.itemName}</Text>
                    <Text style={styles.orderQtyText}>x {order.quantity}</Text>
                  </View>

                  {/* Shipping Address Preview if exists */}
                  {order.shippingAddress ? (
                    <View style={styles.shippingRow}>
                      <Ionicons color="#94A3B8" name="location-outline" size={13} style={{ marginRight: 4 }} />
                      <Text numberOfLines={1} style={styles.shippingText}>{order.shippingAddress}</Text>
                    </View>
                  ) : null}

                  {/* Footer Bar: Date & Details Button */}
                  <View style={styles.orderFoot}>
                    <Text style={styles.orderMeta}>{formatDateTime(order.createdAt)}</Text>
                    <View style={styles.orderFootRight}>
                      <Text style={styles.viewDetailsText}>Manage</Text>
                      <Ionicons color="#0079F2" name="chevron-forward" size={14} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          /* Empty State */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons color="#0079F2" name="receipt-outline" size={32} />
            </View>
            <Text style={styles.emptyTitle}>{ordersQuery.isLoading ? "Loading orders…" : "No orders found"}</Text>
            <Text style={styles.emptyText}>
              {ordersQuery.isLoading
                ? "Connecting to store database..."
                : "No matching orders for the selected filters. Tap below to create a new manual order."}
            </Text>
            {!ordersQuery.isLoading ? (
              <TouchableOpacity onPress={() => setFormOpen(true)} style={styles.emptyBtn} activeOpacity={0.85}>
                <LinearGradient
                  colors={["#0079F2", "#005AC2"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.emptyBtnGradient}
                >
                  <Ionicons color="#FFFFFF" name="add" size={18} style={{ marginRight: 4 }} />
                  <Text style={styles.emptyBtnText}>Create New Order</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <FabButton accessibilityLabel="Create order" onPress={() => setFormOpen(true)} />

      {/* Create Order Modal */}
      <CreateOrderModal
        form={form}
        onChange={setForm}
        onClose={() => setFormOpen(false)}
        onSave={createOrder}
        saving={createMutation.isPending}
        visible={formOpen}
      />

      {/* Order Detail Sheet */}
      <OrderDetailSheet
        order={selected}
        onClose={() => setSelected(null)}
        onPaymentStatusChange={(order, paymentStatus) => paymentStatusMutation.mutate({ order, paymentStatus })}
        onStatusChange={(order, status) => statusMutation.mutate({ order, status })}
      />

      {/* Custom Calendar Modal */}
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

/* ========================================== */
/* SUB-COMPONENTS                             */
/* ========================================== */

function FilterChip({
  active,
  color,
  icon,
  label,
  count,
  onPress,
}: {
  active: boolean;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  count?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipOn]} activeOpacity={0.75}>
      {icon ? <Ionicons color={active ? "#FFFFFF" : color || "#0F172A"} name={icon} size={13} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
      {count !== undefined && count > 0 ? (
        <View style={[styles.chipCountBadge, active && styles.chipCountBadgeOn]}>
          <Text style={[styles.chipCountText, active && styles.chipCountTextOn]}>{count}</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

function CreateOrderModal({
  form,
  onChange,
  onClose,
  onSave,
  saving,
  visible,
}: {
  form: typeof blank;
  onChange: (form: typeof blank) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  visible: boolean;
}) {
  return (
    <Modal animationType="slide" visible={visible}>
      <Screen style={{ backgroundColor: "#F8FAFC" }}>
        <PageHeader
          eyebrow="New manual order"
          right={<IconButton accessibilityLabel="Close" icon="close" onPress={onClose} />}
          title="Create Customer Order"
        />
        <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <Text style={styles.fieldLabel}>Customer Name <Text style={{ color: "#EF4444" }}>*</Text></Text>
            <Field onChangeText={(value) => onChange({ ...form, customerName: value })} placeholder="e.g. Rahul Sharma" value={form.customerName} />

            <Text style={styles.fieldLabel}>Phone Number</Text>
            <Field keyboardType="phone-pad" onChangeText={(value) => onChange({ ...form, phone: value })} placeholder="+91 98765 43210" value={form.phone} />

            <Text style={styles.fieldLabel}>Shipping / Delivery Address</Text>
            <Field onChangeText={(value) => onChange({ ...form, shippingAddress: value })} placeholder="House no, Street, City, Pincode" value={form.shippingAddress} />

            <Text style={styles.fieldLabel}>Item Name <Text style={{ color: "#EF4444" }}>*</Text></Text>
            <Field onChangeText={(value) => onChange({ ...form, itemName: value })} placeholder="e.g. Basmati Rice 5kg" value={form.itemName} />

            <Text style={styles.fieldLabel}>Quantity</Text>
            <Field keyboardType="numeric" onChangeText={(value) => onChange({ ...form, quantity: value })} placeholder="1" value={form.quantity} />

            <View style={{ marginTop: 12 }}>
              <Button icon="checkmark-circle-outline" loading={saving} onPress={onSave} title="Save & Place Order" />
            </View>
          </View>
        </ScrollView>
      </Screen>
    </Modal>
  );
}

function OrderDetailSheet({
  order,
  onClose,
  onPaymentStatusChange,
  onStatusChange,
}: {
  order: ManualOrder | null;
  onClose: () => void;
  onPaymentStatusChange: (order: ManualOrder, paymentStatus: ManualOrder["paymentStatus"]) => void;
  onStatusChange: (order: ManualOrder, status: OrderStatus) => void;
}) {
  if (!order) return null;
  return (
    <Modal animationType="slide" visible={!!order}>
      <Screen style={{ backgroundColor: "#F8FAFC" }}>
        <PageHeader
          left={(
            <TouchableOpacity onPress={onClose} style={styles.iconButton} activeOpacity={0.7}>
              <Ionicons color="#001C34" name="chevron-back" size={24} />
            </TouchableOpacity>
          )}
          right={<Badge label={statusLabel(order.status)} tone={order.status === "delivered" ? "success" : "info"} />}
          title={`Order ${order.orderNo}`}
        />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
          {/* Status Stepper Card */}
          <DetailCard icon="sync-outline" title="Update Order Progress">
            <View style={styles.statusGrid}>
              {statuses.map((status) => (
                <TouchableOpacity
                  key={status}
                  onPress={() => onStatusChange(order, status)}
                  style={[
                    styles.statusChoice,
                    { borderColor: statusBorder[status] },
                    order.status === status && { backgroundColor: statusColor[status], borderColor: statusColor[status] },
                  ]}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    color={order.status === status ? "#FFFFFF" : statusColor[status]}
                    name={statusIcon[status]}
                    size={14}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={[
                      styles.statusChoiceText,
                      order.status === status && styles.statusChoiceTextActive,
                    ]}
                  >
                    {statusLabel(status)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </DetailCard>

          {/* Payment Status Card */}
          <DetailCard icon="card-outline" title="Payment Status">
            <View style={styles.labelChoices}>
              <TouchableOpacity
                onPress={() => onPaymentStatusChange(order, "unpaid")}
                style={[styles.labelChoice, order.paymentStatus === "unpaid" && styles.unpaidChoiceActive]}
                activeOpacity={0.75}
              >
                <Ionicons color={order.paymentStatus === "unpaid" ? "#B45309" : "#64748B"} name="alert-circle-outline" size={16} />
                <Text style={[styles.labelChoiceText, order.paymentStatus === "unpaid" && styles.unpaidChoiceText]}>Unpaid</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onPaymentStatusChange(order, "paid")}
                style={[styles.labelChoice, order.paymentStatus === "paid" && styles.paidChoiceActive]}
                activeOpacity={0.75}
              >
                <Ionicons color={order.paymentStatus === "paid" ? "#047857" : "#64748B"} name="checkmark-circle-outline" size={16} />
                <Text style={[styles.labelChoiceText, order.paymentStatus === "paid" && styles.paidChoiceText]}>Paid in Full</Text>
              </TouchableOpacity>
            </View>
          </DetailCard>

          {/* Order Details */}
          <DetailCard icon="document-text-outline" title="Order Information">
            <InfoRow label="Order Number" value={order.orderNo} />
            <InfoRow label="Item Ordered" value={`${order.itemName} (Qty: ${order.quantity})`} />
            <InfoRow label="Created Date" value={formatDateTime(order.createdAt)} />
            <InfoRow label="Source" value="Manual Store Entry" />
          </DetailCard>

          {/* Customer Details */}
          <DetailCard icon="person-outline" title="Customer Details">
            <InfoRow label="Customer Name" value={order.customerName} />
            <InfoRow label="Mobile Phone" value={order.phone || "Not provided"} />
            <View style={styles.infoRowAddress}>
              <Text style={styles.infoLabel}>Delivery Address</Text>
              <Text style={styles.addressText}>{order.shippingAddress || "No shipping address added"}</Text>
            </View>
          </DetailCard>

          {/* Order Timeline */}
          {order.timeline?.length ? (
            <DetailCard icon="time-outline" title="Status History">
              {order.timeline.map((row) => (
                <Timeline key={`${row.status}-${row.timestamp}`} date={formatDateTime(row.timestamp)} label={statusLabel(row.status)} />
              ))}
            </DetailCard>
          ) : null}
        </ScrollView>

        <View style={styles.detailActions}>
          <TouchableOpacity onPress={() => printAddress(order)} style={styles.printButton} activeOpacity={0.8}>
            <Ionicons color="#0079F2" name="print-outline" size={18} style={{ marginRight: 6 }} />
            <Text style={styles.printText}>Print Shipping Address Label</Text>
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
  ]
    .filter(Boolean)
    .join("\n");

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
            .label { border: 2px solid #001C34; border-radius: 12px; padding: 20px; max-width: 360px; }
            h2 { margin: 0 0 16px; font-size: 20px; color: #001C34; }
            p { margin: 6px 0; font-size: 15px; line-height: 1.45; }
            .meta { margin-top: 18px; color: #6b7280; font-size: 12px; border-top: 1px dashed #d1d5db; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="label">
            <h2>📦 Kadai Kanakku Shipping Label</h2>
            <p><strong>Deliver To:</strong> ${escapeHtml(order.customerName)}</p>
            ${order.phone ? `<p><strong>Phone:</strong> ${escapeHtml(order.phone)}</p>` : ""}
            <p><strong>Address:</strong><br />${escapeHtml(address).replace(/\n/g, "<br />")}</p>
            <p class="meta"><strong>Order:</strong> ${escapeHtml(order.orderNo)} | <strong>Item:</strong> ${escapeHtml(order.itemName)} x ${order.quantity}</p>
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
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function DetailCard({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.detailCard}>
      <View style={styles.detailCardHeader}>
        <View style={styles.detailTitleRow}>
          <Ionicons color="#0079F2" name={icon} size={18} />
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
      <View style={{ flex: 1 }}>
        <Text style={styles.timelineLabel}>{label}</Text>
        <Text style={styles.timelineDate}>{date}</Text>
      </View>
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
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.dateOverlay}>
        <View style={styles.dateModal}>
          <View style={styles.dateHeader}>
            <TouchableOpacity onPress={() => onChangeMonth(shiftMonth(month, -1))} style={styles.dateNav} activeOpacity={0.7}>
              <Ionicons color="#0079F2" name="chevron-back" size={18} />
            </TouchableOpacity>
            <Text style={styles.dateMonth}>{formatMonth(month)}</Text>
            <TouchableOpacity onPress={() => onChangeMonth(shiftMonth(month, 1))} style={styles.dateNav} activeOpacity={0.7}>
              <Ionicons color="#0079F2" name="chevron-forward" size={18} />
            </TouchableOpacity>
          </View>
          <View style={styles.dateGrid}>
            {daysInMonth(month).map((date) => (
              <TouchableOpacity
                key={date}
                onPress={() => onSelect(date)}
                style={[styles.dateCell, selectedDate === date && styles.dateCellActive]}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateCellText, selectedDate === date && styles.dateCellTextActive]}>
                  {Number(date.slice(-2))}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.dateClose} activeOpacity={0.7}>
            <Text style={styles.dateCloseText}>Close Calendar</Text>
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
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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
  if (filter === "today") return "Today's Orders";
  if (filter === "week") return "Last 7 Days";
  if (filter === "month") return "This Month";
  if (filter === "custom") return "Selected Date";
  return "All Orders";
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

/* ========================================== */
/* STYLESHEET                                 */
/* ========================================== */

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#F8FAFC",
  },
  content: {
    alignSelf: "center",
    maxWidth: 1360,
    paddingBottom: 96,
    paddingHorizontal: 16,
    width: "100%",
  },

  /* 1. Summary Cards */
  summaryGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
    marginTop: 4,
    width: "100%",
  },
  summaryCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 10,
    ...Platform.select({
      ios: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 8px rgba(0, 28, 52, 0.04)" } as any,
    }),
  },
  summaryIconWrap: {
    alignItems: "center",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  summaryTextWrap: {
    flex: 1,
    justifyContent: "center",
  },
  summaryLabel: {
    color: "#64748B",
    fontFamily: fonts.bold,
    fontSize: 9.5,
    letterSpacing: 0.5,
  },
  summaryValue: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 18,
    letterSpacing: -0.4,
    marginTop: 1,
  },

  /* 2. Filters */
  filterControlRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    marginTop: 4,
  },
  segment: {
    backgroundColor: "#F1F5F9",
    borderColor: "#E2E8F0",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    padding: 3,
  },
  segmentItem: {
    alignItems: "center",
    borderRadius: 9,
    flex: 1,
    justifyContent: "center",
    minHeight: 32,
  },
  segmentItemOn: {
    backgroundColor: "#FFFFFF",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2 },
      android: { elevation: 1 },
      web: { boxShadow: "0 1px 3px rgba(0,0,0,0.1)" } as any,
    }),
  },
  segmentText: {
    color: "#64748B",
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  segmentTextOn: {
    color: "#001C34",
    fontFamily: fonts.bold,
  },
  datePick: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 12,
  },
  datePickOn: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  datePickText: {
    color: "#64748B",
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  datePickTextOn: {
    color: "#0079F2",
  },

  /* Status Chips */
  chipRow: {
    gap: 8,
    paddingBottom: 4,
    paddingTop: 2,
  },
  chip: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  chipOn: {
    backgroundColor: "#001C34",
    borderColor: "#001C34",
  },
  chipText: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  chipTextOn: {
    color: "#FFFFFF",
  },
  chipCountBadge: {
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  chipCountBadgeOn: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  chipCountText: {
    color: "#64748B",
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  chipCountTextOn: {
    color: "#FFFFFF",
  },

  /* List Section */
  listHead: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 16,
    paddingHorizontal: 2,
  },
  sectionLabelInline: {
    color: "#64748B",
    fontFamily: fonts.bold,
    fontSize: 11.5,
    letterSpacing: 0.8,
  },
  listCountWrap: {
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  listCountText: {
    color: "#475569",
    fontFamily: fonts.semibold,
    fontSize: 11,
  },

  /* Order Cards */
  list: {
    gap: 10,
    width: "100%",
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    width: "100%",
    ...Platform.select({
      ios: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 10px rgba(0, 28, 52, 0.04)" } as any,
    }),
  },
  accent: {
    width: 5,
  },
  orderInner: {
    flex: 1,
    minWidth: 0,
    padding: 14,
  },
  orderTop: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  avatar: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  orderTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  orderNoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  orderNo: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 15,
    letterSpacing: -0.3,
  },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 9.5,
  },
  orderCustomer: {
    color: "#64748B",
    fontFamily: fonts.medium,
    fontSize: 12.5,
    marginTop: 2,
  },
  payPill: {
    alignItems: "center",
    borderRadius: 999,
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  payPaid: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
  },
  payUnpaid: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
    borderWidth: 1,
  },
  payPillText: {
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  payPaidText: {
    color: "#047857",
  },
  payUnpaidText: {
    color: "#B45309",
  },
  orderItemBox: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#F1F5F9",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  orderItem: {
    color: "#001C34",
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12.5,
  },
  orderQtyText: {
    color: "#64748B",
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  shippingRow: {
    alignItems: "center",
    flexDirection: "row",
    marginTop: 6,
    paddingHorizontal: 2,
  },
  shippingText: {
    color: "#64748B",
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11.5,
  },
  orderFoot: {
    alignItems: "center",
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 8,
  },
  orderMeta: {
    color: "#94A3B8",
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  orderFootRight: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  viewDetailsText: {
    color: "#0079F2",
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },

  /* Empty State */
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 24,
    paddingVertical: 36,
    width: "100%",
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 20,
    height: 56,
    justifyContent: "center",
    marginBottom: 12,
    width: 56,
  },
  emptyTitle: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 17,
  },
  emptyText: {
    color: "#64748B",
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    textAlign: "center",
  },
  emptyBtn: {
    borderRadius: 14,
    marginTop: 18,
    overflow: "hidden",
  },
  emptyBtnGradient: {
    alignItems: "center",
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  emptyBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },

  /* Form & Modals */
  formContent: {
    alignSelf: "center",
    maxWidth: 640,
    padding: 16,
    paddingBottom: 40,
    width: "100%",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    ...Platform.select({
      ios: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 10px rgba(0, 28, 52, 0.04)" } as any,
    }),
  },
  fieldLabel: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 12.5,
    marginBottom: 6,
    marginTop: 10,
  },

  /* Detail Sheet */
  iconButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  detailContent: {
    alignSelf: "center",
    maxWidth: 640,
    padding: 16,
    paddingBottom: 84,
    width: "100%",
  },
  detailCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 8px rgba(0, 28, 52, 0.03)" } as any,
    }),
  },
  detailCardHeader: {
    borderBottomColor: "#F1F5F9",
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  detailTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  detailCardTitle: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  detailBody: {
    padding: 14,
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChoice: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChoiceText: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
  statusChoiceTextActive: {
    color: "#FFFFFF",
  },
  labelChoices: {
    flexDirection: "row",
    gap: 10,
  },
  labelChoice: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: 12,
  },
  labelChoiceText: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  unpaidChoiceActive: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  unpaidChoiceText: {
    color: "#B45309",
  },
  paidChoiceActive: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  paidChoiceText: {
    color: "#047857",
  },
  infoRow: {
    alignItems: "center",
    borderBottomColor: "#F8FAFC",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  infoRowAddress: {
    marginTop: 8,
  },
  infoLabel: {
    color: "#64748B",
    fontFamily: fonts.medium,
    fontSize: 12.5,
  },
  infoValue: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 12.5,
    textAlign: "right",
  },
  addressText: {
    color: "#001C34",
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  timelineRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  timelineDot: {
    backgroundColor: "#10B981",
    borderRadius: 999,
    height: 8,
    marginTop: 5,
    width: 8,
  },
  timelineLabel: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 12.5,
  },
  timelineDate: {
    color: "#94A3B8",
    fontFamily: fonts.regular,
    fontSize: 11,
    marginTop: 1,
  },
  detailActions: {
    backgroundColor: "#FFFFFF",
    borderTopColor: "#E2E8F0",
    borderTopWidth: 1,
    bottom: 0,
    left: 0,
    padding: 14,
    position: "absolute",
    right: 0,
  },
  printButton: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 44,
  },
  printText: {
    color: "#0079F2",
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },

  /* Date Modal */
  dateOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  dateModal: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    maxWidth: 400,
    padding: 18,
    width: "100%",
  },
  dateHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dateNav: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  dateMonth: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  dateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dateCell: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#F1F5F9",
    borderRadius: 10,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: "12.8%",
  },
  dateCellActive: {
    backgroundColor: "#0079F2",
    borderColor: "#0079F2",
  },
  dateCellText: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  dateCellTextActive: {
    color: "#FFFFFF",
  },
  dateClose: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    marginTop: 14,
    minHeight: 40,
    justifyContent: "center",
  },
  dateCloseText: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
