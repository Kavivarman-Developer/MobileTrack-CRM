import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  Badge,
  Button,
  Empty,
  Field,
  IosScreenHeader,
  IosSearchBar,
  IosSegment,
  Screen,
  SelectOption,
  Sheet,
  StatStrip,
} from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, radius, spacing } from "../../constants/theme";
import { createBillingInvoice, Customer, getCustomers, getOrders, getProducts, Order, Product, recordOrderPayment } from "../../services/api";

type CartLine = { product: Product; qty: number };
type PaymentStatus = "paid" | "partial" | "pending";
type PaymentFilter = "all" | "paid" | "partial" | "pending";

const FILTER_OPTIONS: { key: PaymentFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "partial", label: "Partial" },
  { key: "paid", label: "Paid" },
];

export default function BillingScreen() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [discount, setDiscount] = useState("0");
  const [gst, setGst] = useState("0");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("paid");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<PaymentFilter>("all");
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const [collectAmount, setCollectAmount] = useState("");
  const [collectMethod, setCollectMethod] = useState("cash");
  const queryClient = useQueryClient();

  const products = useQuery({ queryKey: ["products", ""], queryFn: () => getProducts("") });
  const customers = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
  const orders = useQuery({ queryKey: ["orders", "billing", filter], queryFn: () => getOrders({ paymentStatus: filter }) });

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + Number(line.product.price || 0) * line.qty, 0), [cart]);
  const total = Math.max(subtotal - Number(discount || 0) + Number(gst || 0), 0);
  const paidPreview = paymentStatus === "paid" ? total : paymentStatus === "pending" ? 0 : Math.min(Number(amountPaid || 0), total);
  const balancePreview = Math.max(total - paidPreview, 0);
  const dueTotal = useMemo(() => (orders.data || []).reduce((sum, order) => sum + getBalance(order), 0), [orders.data]);
  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    return (products.data || []).filter((product) => {
      const text = `${product.name} ${product.sku || ""} ${typeof product.category === "object" ? product.category?.name || "" : ""}`.toLowerCase();
      return !keyword || text.includes(keyword);
    });
  }, [productSearch, products.data]);

  const createInvoice = useMutation({
    mutationFn: () => createBillingInvoice({
      customer: customerId || undefined,
      items: cart.map((line) => ({ product: line.product._id, qty: line.qty })),
      discount: Number(discount || 0),
      gst: Number(gst || 0),
      paymentStatus,
      paymentMethod,
      amountPaid: paidPreview,
      dueDate: dueDate || undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: (invoice) => {
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      Alert.alert("Bill saved", `${invoice.invoiceNumber || "Invoice"} total Rs ${formatMoney(invoice.total)}`);
    },
    onError: (error: Error) => Alert.alert("Billing failed", error.message),
  });

  const collectPayment = useMutation({
    mutationFn: () => recordOrderPayment(paymentOrder!._id, { amount: Number(collectAmount || 0), method: collectMethod }),
    onSuccess: () => {
      setPaymentOrder(null);
      setCollectAmount("");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      Alert.alert("Payment updated", "Invoice balance updated.");
    },
    onError: (error: Error) => Alert.alert("Payment failed", error.message),
  });

  function add(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.product._id === product._id);
      if (existing) return current.map((line) => line.product._id === product._id ? { ...line, qty: line.qty + 1 } : line);
      return [...current, { product, qty: 1 }];
    });
  }

  function setQty(productId: string, qty: number) {
    setCart((current) => current.map((line) => line.product._id === productId ? { ...line, qty: Math.max(1, qty) } : line));
  }

  function resetForm() {
    setCart([]);
    setCustomerId("");
    setDiscount("0");
    setGst("0");
    setPaymentStatus("paid");
    setPaymentMethod("cash");
    setAmountPaid("");
    setDueDate("");
    setNotes("");
  }

  function validateAndCreate() {
    if (!cart.length) return Alert.alert("Cart is empty", "Add products before saving a bill.");
    if (paymentStatus !== "paid" && !customerId) return Alert.alert("Customer required", "Select a customer for pending or partial bills.");
    if (paymentStatus === "partial" && Number(amountPaid || 0) <= 0) return Alert.alert("Paid amount required", "Enter the amount received.");
    createInvoice.mutate();
  }

  async function shareInvoice(order: Order) {
    const lines = order.items.map((item) => `${item.product.name} x ${item.qty} = Rs ${formatMoney(item.price * item.qty)}`).join("\n");
    await Share.share({
      message: `${order.invoiceNumber || "Invoice"}\n${order.customer?.name || "Walk-in customer"}\n${new Date(order.createdAt).toLocaleString()}\n\n${lines}\n\nTotal: Rs ${formatMoney(order.total)}\nPaid: Rs ${formatMoney(Number(order.amountPaid || 0))}\nDue: Rs ${formatMoney(getBalance(order))}`,
    });
  }

  return (
    <Screen style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <IosScreenHeader eyebrow="POS & Invoicing" title="Billing" />

        {/* Top Metric Cards */}
        <View style={styles.metricsRow}>
          {/* Due Total */}
          <View style={[styles.metricCard, { borderLeftColor: "#EF4444" }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#FEF2F2" }]}>
                <Ionicons color="#EF4444" name="alert-circle" size={16} />
              </View>
              <Text style={styles.metricLabel}>Due Total</Text>
            </View>
            <Text numberOfLines={1} style={styles.metricValue}>
              ₹{formatMoney(dueTotal)}
            </Text>
            <Text style={styles.metricSub}>Receivable</Text>
          </View>

          {/* Current Cart */}
          <View style={[styles.metricCard, { borderLeftColor: "#6366F1" }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#EEF2FF" }]}>
                <Ionicons color="#6366F1" name="cart" size={16} />
              </View>
              <Text style={styles.metricLabel}>Cart Value</Text>
            </View>
            <Text numberOfLines={1} style={styles.metricValue}>
              ₹{formatMoney(total)}
            </Text>
            <Text style={styles.metricSub}>{cart.length} item{cart.length === 1 ? "" : "s"}</Text>
          </View>

          {/* Balance Pending */}
          <View style={[styles.metricCard, { borderLeftColor: "#10B981" }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#ECFDF5" }]}>
                <Ionicons color="#10B981" name="wallet" size={16} />
              </View>
              <Text style={styles.metricLabel}>Balance</Text>
            </View>
            <Text numberOfLines={1} style={styles.metricValue}>
              ₹{formatMoney(balancePreview)}
            </Text>
            <Text style={styles.metricSub}>After bill</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Customer</Text>
          {(customers.data || []).length ? (
            (customers.data || []).slice(0, 8).map((item) => (
              <SelectOption
                key={item._id}
                label={item.name}
                meta={`Due ₹${formatMoney(item.pendingBalance || 0)}`}
                onPress={() => setCustomerId(item._id)}
                selected={customerId === item._id}
              />
            ))
          ) : (
            <Empty icon="people-outline" text={customers.isLoading ? "Loading customers..." : "No customers found."} />
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Add products</Text>
          <IosSearchBar onChangeText={setProductSearch} placeholder="Search name or SKU" value={productSearch} />
          {filteredProducts.slice(0, 12).length ? (
            filteredProducts.slice(0, 12).map((item) => {
              const inCart = cart.find((line) => line.product._id === item._id);
              return (
                <SelectOption
                  key={item._id}
                  label={item.name}
                  meta={`₹${formatMoney(item.price)} · ${item.stockQty} in stock${inCart ? ` · Cart ${inCart.qty}` : ""}`}
                  onPress={() => add(item)}
                  selected={Boolean(inCart)}
                />
              );
            })
          ) : (
            <Empty icon="cube-outline" text={products.isLoading ? "Loading products..." : "No products found."} />
          )}
          {cart.map((line, index) => (
            <View key={line.product._id} style={[styles.cartLine, index === 0 && styles.cartLineFirst]}>
              <View style={styles.cartInfo}>
                <Text numberOfLines={1} style={styles.cartName}>{line.product.name}</Text>
                <Text style={styles.cartMeta}>₹{formatMoney(line.product.price)} × {line.qty}</Text>
              </View>
              <View style={styles.qty}>
                <TouchableOpacity onPress={() => setQty(line.product._id, line.qty - 1)} style={styles.qtyButton}>
                  <Ionicons color={colors.text} name="remove" size={16} />
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{line.qty}</Text>
                <TouchableOpacity onPress={() => setQty(line.product._id, line.qty + 1)} style={styles.qtyButton}>
                  <Ionicons color={colors.text} name="add" size={16} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment options</Text>
          <View style={styles.row}>
            <View style={styles.half}><Field keyboardType="numeric" onChangeText={setDiscount} placeholder="Discount (₹)" value={discount} /></View>
            <View style={styles.half}><Field keyboardType="numeric" onChangeText={setGst} placeholder="GST (₹)" value={gst} /></View>
          </View>
          <Text style={styles.fieldLabel}>Status</Text>
          <SelectOption label="Paid" meta="Full amount received" onPress={() => setPaymentStatus("paid")} selected={paymentStatus === "paid"} />
          <SelectOption label="Partial" meta="Some amount received" onPress={() => setPaymentStatus("partial")} selected={paymentStatus === "partial"} />
          <SelectOption label="Pending" meta="Pay later" onPress={() => setPaymentStatus("pending")} selected={paymentStatus === "pending"} />
          <Text style={styles.fieldLabel}>Method</Text>
          {["cash", "upi", "card"].map((method) => (
            <SelectOption
              key={method}
              label={method.toUpperCase()}
              onPress={() => setPaymentMethod(method)}
              selected={paymentMethod === method}
            />
          ))}
          {paymentStatus === "partial" && <Field keyboardType="numeric" onChangeText={setAmountPaid} placeholder="Amount received (₹)" value={amountPaid} />}
          {paymentStatus !== "paid" && <Field onChangeText={setDueDate} placeholder="Due date (YYYY-MM-DD)" value={dueDate} />}
          <Field multiline onChangeText={setNotes} placeholder="Invoice notes" value={notes} />
          <Button icon="receipt-outline" loading={createInvoice.isPending} onPress={validateAndCreate} title="Save bill" />
        </View>

        <View style={styles.card}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitleInline}>Invoices</Text>
            <Badge label={`${orders.data?.length || 0}`} tone="neutral" />
          </View>
          <IosSegment options={FILTER_OPTIONS} value={filter} onChange={setFilter} />
          {(orders.data || []).length ? (orders.data || []).map((order) => {
            const balance = getBalance(order);
            const accent =
              order.paymentStatus === "paid" ? "#10B981" : order.paymentStatus === "partial" ? "#F59E0B" : "#EF4444";
            return (
              <View key={order._id} style={styles.invoiceCard}>
                <View style={[styles.invoiceAccent, { backgroundColor: accent }]} />
                <View style={styles.invoiceBody}>
                  <View style={styles.invoiceTop}>
                    <View style={styles.invoiceInfo}>
                      <Text style={styles.invoiceNo}>{order.invoiceNumber || order._id.slice(-6).toUpperCase()}</Text>
                      <Text style={styles.invoiceMeta}>
                        {order.customer?.name || "Walk-in"} · {new Date(order.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Badge
                      label={order.paymentStatus}
                      tone={order.paymentStatus === "paid" ? "success" : order.paymentStatus === "partial" ? "warning" : "danger"}
                    />
                  </View>
                  <View style={styles.amountRow}>
                    <Text style={styles.invoiceAmount}>₹{formatMoney(order.total)}</Text>
                    {balance > 0 && <Text style={styles.dueText}>Due ₹{formatMoney(balance)}</Text>}
                  </View>
                  <View style={styles.invoiceActions}>
                    <TouchableOpacity onPress={() => shareInvoice(order)} style={styles.actionButton}>
                      <Ionicons color={colors.primary} name="share-outline" size={16} style={{ marginRight: 4 }} />
                      <Text style={styles.actionText}>Share</Text>
                    </TouchableOpacity>
                    {balance > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setPaymentOrder(order);
                          setCollectAmount(String(balance));
                        }}
                        style={styles.actionButtonPrimary}
                      >
                        <Ionicons color="#ffffff" name="cash-outline" size={16} style={{ marginRight: 4 }} />
                        <Text style={styles.actionTextPrimary}>Collect</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          }) : <Empty icon="receipt-outline" text={orders.isLoading ? "Loading invoices..." : "No invoices found."} />}
        </View>
      </ScrollView>

      <Sheet
        hint={`${paymentOrder?.invoiceNumber || "Invoice"} balance due: ₹${formatMoney(paymentOrder ? getBalance(paymentOrder) : 0)}`}
        onClose={() => setPaymentOrder(null)}
        title="Collect payment"
        visible={!!paymentOrder}
      >
        <Field keyboardType="numeric" onChangeText={setCollectAmount} placeholder="Amount to collect (₹)" value={collectAmount} />
        <Text style={styles.fieldLabel}>Method</Text>
        {["cash", "upi", "card"].map((method) => (
          <SelectOption
            key={method}
            label={method.toUpperCase()}
            onPress={() => setCollectMethod(method)}
            selected={collectMethod === method}
          />
        ))}
        <View style={styles.sheetFooter}>
          <Button
            icon="checkmark-circle-outline"
            loading={collectPayment.isPending}
            onPress={() => collectPayment.mutate()}
            title="Update balance"
          />
        </View>
      </Sheet>
    </Screen>
  );
}

function getBalance(order: Order) {
  return Math.max(Number(order.balanceDue ?? (order.total - Number(order.amountPaid || 0))), 0);
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.backgroundDark },
  container: { alignSelf: "center", maxWidth: 480, paddingBottom: spacing.xl, paddingHorizontal: spacing.md, width: "100%" },

  // Top Metrics
  metricsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    flex: 1,
    padding: spacing.sm,
    ...shadows.sm,
  },
  metricHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.xs,
  },
  metricIconWrap: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.medium,
    fontSize: 11,
    fontWeight: "500",
  },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  metricSub: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 2,
  },

  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  sectionTitleInline: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  fieldLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },

  customerChip: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.md,
    marginRight: spacing.xs,
    minHeight: 40,
    padding: spacing.sm,
    width: 140,
  },
  customerChipActive: { backgroundColor: colors.primary },
  customerName: { color: colors.text, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },
  customerNameActive: { color: "#FFFFFF" },
  customerDue: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  customerDueActive: { color: "rgba(255,255,255,0.8)" },

  productCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.md,
    height: 88,
    marginRight: spacing.xs,
    marginTop: spacing.xs,
    padding: spacing.sm,
    width: 130,
  },
  productName: { color: colors.text, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600", minHeight: 34 },
  productPrice: { color: colors.primary, fontFamily: fonts.bold, fontSize: 15, fontWeight: "700", marginTop: 2 },
  stockOk: { color: "#10B981", fontSize: 11, fontWeight: "500", marginTop: 2 },
  stockLow: { color: "#EF4444", fontSize: 11, fontWeight: "500", marginTop: 2 },

  cartLine: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  cartLineFirst: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.sm },
  cartInfo: { flex: 1, paddingRight: spacing.sm },
  cartName: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14, fontWeight: "600" },
  cartMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  qty: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  qtyButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.sm,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  qtyValue: { color: colors.text, fontFamily: fonts.bold, fontWeight: "700", minWidth: 24, textAlign: "center" },

  row: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  choice: {
    alignItems: "center",
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.full,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  choiceActive: { backgroundColor: colors.primary },
  choiceText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 12, fontWeight: "600" },
  choiceTextActive: { color: "#FFFFFF" },

  invoiceCard: {
    backgroundColor: colors.surfaceVariant,
    borderRadius: radius.md,
    flexDirection: "row",
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  invoiceAccent: { width: 4 },
  invoiceBody: { flex: 1, padding: spacing.md },
  invoiceTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  invoiceInfo: { flex: 1, paddingRight: spacing.sm },
  invoiceNo: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, fontWeight: "700" },
  invoiceMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  amountRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  invoiceAmount: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, fontWeight: "700" },
  dueText: { color: "#EF4444", fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },
  invoiceActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 40,
    ...shadows.sm,
  },
  actionButtonPrimary: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    minHeight: 40,
    ...shadows.sm,
  },
  actionText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },
  actionTextPrimary: { color: "#ffffff", fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },

  sheetFooter: { marginTop: spacing.sm },
});
