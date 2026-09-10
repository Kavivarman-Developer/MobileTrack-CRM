import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { createBillingInvoice, Customer, getCustomers, getOrders, getProducts, Order, Product, recordOrderPayment } from "../../services/api";

type CartLine = { product: Product; qty: number };
type PaymentStatus = "paid" | "partial" | "pending";
type PaymentFilter = "all" | "paid" | "partial" | "pending";

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
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>INVOICE DESK</Text>
            <Text style={styles.title}>Billing</Text>
          </View>
          <View style={styles.headerTotal}>
            <Text style={styles.headerTotalLabel}>Total Due</Text>
            <Text style={styles.headerTotalValue}>Rs {formatMoney(dueTotal)}</Text>
          </View>
        </View>

        {/* Current Bill Hero Banner */}
        <View style={styles.totalPanel}>
          <Text style={styles.totalLabel}>Current Bill Total</Text>
          <Text style={styles.totalValue}>Rs {formatMoney(total)}</Text>
          <Text style={styles.totalHint}>Paid Rs {formatMoney(paidPreview)} | Balance Due Rs {formatMoney(balancePreview)}</Text>
        </View>

        {/* Select Customer */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Select Customer</Text>
          <FlatList
            data={customers.data || []}
            horizontal
            keyExtractor={(item) => item._id}
            showsHorizontalScrollIndicator={false}
            ListEmptyComponent={<Empty icon="people-outline" text={customers.isLoading ? "Loading customers..." : "No customers found."} />}
            renderItem={({ item }) => <CustomerChip active={customerId === item._id} customer={item} onPress={() => setCustomerId(item._id)} />}
          />
        </View>

        {/* Add Items to Bill */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Add Products</Text>
          <Field onChangeText={setProductSearch} placeholder="Search product name or SKU" value={productSearch} />
          <FlatList
            data={filteredProducts.slice(0, 12)}
            horizontal
            keyExtractor={(item) => item._id}
            showsHorizontalScrollIndicator={false}
            ListEmptyComponent={<Empty icon="cube-outline" text={products.isLoading ? "Loading products..." : "No products found."} />}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => add(item)} style={styles.productCard}>
                <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>Rs {formatMoney(item.price)}</Text>
                <Text style={item.stockQty <= item.lowStockThreshold ? styles.stockLow : styles.stockOk}>{item.stockQty} in stock</Text>
              </TouchableOpacity>
            )}
          />
          {cart.map((line) => (
            <View key={line.product._id} style={styles.cartLine}>
              <View style={styles.cartInfo}>
                <Text numberOfLines={1} style={styles.cartName}>{line.product.name}</Text>
                <Text style={styles.cartMeta}>Rs {formatMoney(line.product.price)} × {line.qty}</Text>
              </View>
              <View style={styles.qty}>
                <TouchableOpacity onPress={() => setQty(line.product._id, line.qty - 1)} style={styles.qtyButton}>
                  <Ionicons color={colors.primary} name="remove" size={16} />
                </TouchableOpacity>
                <Text style={styles.qtyValue}>{line.qty}</Text>
                <TouchableOpacity onPress={() => setQty(line.product._id, line.qty + 1)} style={styles.qtyButton}>
                  <Ionicons color={colors.primary} name="add" size={16} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Billing Options */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Billing Options</Text>
          <View style={styles.row}>
            <View style={styles.half}><Field keyboardType="numeric" onChangeText={setDiscount} placeholder="Discount (Rs)" value={discount} /></View>
            <View style={styles.half}><Field keyboardType="numeric" onChangeText={setGst} placeholder="GST (Rs)" value={gst} /></View>
          </View>
          <Text style={styles.fieldLabel}>Payment Status</Text>
          <View style={styles.chips}>
            <Choice active={paymentStatus === "paid"} label="Paid" onPress={() => setPaymentStatus("paid")} />
            <Choice active={paymentStatus === "partial"} label="Partial" onPress={() => setPaymentStatus("partial")} />
            <Choice active={paymentStatus === "pending"} label="Pending" onPress={() => setPaymentStatus("pending")} />
          </View>
          <Text style={styles.fieldLabel}>Payment Method</Text>
          <View style={styles.chips}>
            {["cash", "upi", "card"].map((method) => <Choice key={method} active={paymentMethod === method} label={method.toUpperCase()} onPress={() => setPaymentMethod(method)} />)}
          </View>
          {paymentStatus === "partial" && <Field keyboardType="numeric" onChangeText={setAmountPaid} placeholder="Amount Received (Rs)" value={amountPaid} />}
          {paymentStatus !== "paid" && <Field onChangeText={setDueDate} placeholder="Due Date (YYYY-MM-DD)" value={dueDate} />}
          <Field multiline onChangeText={setNotes} placeholder="Additional invoice notes" value={notes} />
          <Button icon="receipt-outline" loading={createInvoice.isPending} onPress={validateAndCreate} title="Save & Print Bill" />
        </View>

        {/* Past Invoices */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.sectionTitle}>Invoices History</Text>
            <Badge label={`${orders.data?.length || 0} bills`} tone="neutral" />
          </View>
          <View style={styles.chips}>
            {(["all", "pending", "partial", "paid"] as PaymentFilter[]).map((item) => <Choice key={item} active={filter === item} label={item.toUpperCase()} onPress={() => setFilter(item)} />)}
          </View>
          {(orders.data || []).length ? (orders.data || []).map((order) => (
            <View key={order._id} style={styles.invoiceCard}>
              <View style={styles.invoiceTop}>
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceNo}>{order.invoiceNumber || order._id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.invoiceMeta}>{order.customer?.name || "Walk-in customer"} • {new Date(order.createdAt).toLocaleDateString()}</Text>
                </View>
                <Badge label={order.paymentStatus} tone={order.paymentStatus === "paid" ? "success" : order.paymentStatus === "partial" ? "warning" : "danger"} />
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.invoiceAmount}>Rs {formatMoney(order.total)}</Text>
                {getBalance(order) > 0 && <Text style={styles.dueText}>Due: Rs {formatMoney(getBalance(order))}</Text>}
              </View>
              <View style={styles.invoiceActions}>
                <TouchableOpacity onPress={() => shareInvoice(order)} style={styles.actionButton}>
                  <Ionicons color={colors.primary} name="share-outline" size={16} style={{ marginRight: 4 }} />
                  <Text style={styles.actionText}>Share</Text>
                </TouchableOpacity>
                {getBalance(order) > 0 && (
                  <TouchableOpacity onPress={() => { setPaymentOrder(order); setCollectAmount(String(getBalance(order))); }} style={styles.actionButtonPrimary}>
                    <Ionicons color="#ffffff" name="cash-outline" size={16} style={{ marginRight: 4 }} />
                    <Text style={styles.actionTextPrimary}>Collect Payment</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )) : <Empty icon="receipt-outline" text={orders.isLoading ? "Loading invoices..." : "No invoices found."} />}
        </View>
      </ScrollView>

      {/* Collect Payment Modal */}
      <Modal transparent animationType="slide" visible={!!paymentOrder}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sectionTitle}>Collect Payment</Text>
              <TouchableOpacity onPress={() => setPaymentOrder(null)}>
                <Ionicons color={colors.text} name="close" size={20} />
              </TouchableOpacity>
            </View>
            <Text style={styles.invoiceMeta}>{paymentOrder?.invoiceNumber} balance due: Rs {formatMoney(paymentOrder ? getBalance(paymentOrder) : 0)}</Text>
            <Field keyboardType="numeric" onChangeText={setCollectAmount} placeholder="Amount to collect (Rs)" value={collectAmount} />
            <Text style={styles.fieldLabel}>Method</Text>
            <View style={styles.chips}>
              {["cash", "upi", "card"].map((method) => <Choice key={method} active={collectMethod === method} label={method.toUpperCase()} onPress={() => setCollectMethod(method)} />)}
            </View>
            <Button icon="checkmark-circle-outline" loading={collectPayment.isPending} onPress={() => collectPayment.mutate()} title="Update Invoice Balance" />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function CustomerChip({ active, customer, onPress }: { active: boolean; customer: Customer; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.customerChip, active && styles.customerChipActive]}>
      <Text numberOfLines={1} style={[styles.customerName, active && styles.customerNameActive]}>{customer.name}</Text>
      <Text style={styles.customerDue}>Due: Rs {formatMoney(customer.pendingBalance || 0)}</Text>
    </TouchableOpacity>
  );
}

function Choice({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.choice, active && styles.choiceActive]}>
      <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getBalance(order: Order) {
  return Math.max(Number(order.balanceDue ?? (order.total - Number(order.amountPaid || 0))), 0);
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xl },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, marginTop: 2 },
  headerTotal: { alignItems: "flex-end", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, minWidth: 100, padding: spacing.xs, ...shadows.card },
  headerTotalLabel: { color: colors.muted, fontSize: 10, fontWeight: "600" },
  headerTotalValue: { color: colors.danger, fontSize: 16, fontWeight: "700", marginTop: 2 },

  totalPanel: { backgroundColor: colors.secondary, borderRadius: radius.md, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  totalLabel: { color: colors.blueSoft, fontWeight: "600", fontSize: 13 },
  totalValue: { color: "#ffffff", fontSize: 32, fontWeight: "700", marginTop: 2 },
  totalHint: { color: colors.blueSoft, fontSize: 12, fontWeight: "500", marginTop: spacing.xs },

  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  panelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  sectionTitle: { color: colors.text, ...typography.h3, marginBottom: spacing.xs },
  fieldLabel: { color: colors.text, ...typography.label, marginBottom: spacing.xs, marginTop: spacing.xs },

  customerChip: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginRight: spacing.xs, minHeight: 56, padding: spacing.sm, width: 140 },
  customerChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  customerName: { color: colors.text, fontSize: 13, fontWeight: "600" },
  customerNameActive: { color: colors.primary, fontWeight: "700" },
  customerDue: { color: colors.muted, fontSize: 11, marginTop: 2 },

  productCard: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, height: 110, marginRight: spacing.xs, marginTop: spacing.xs, padding: spacing.sm, width: 130 },
  productName: { color: colors.text, fontSize: 13, fontWeight: "600", minHeight: 34 },
  productPrice: { color: colors.primary, fontSize: 15, fontWeight: "700", marginTop: 2 },
  stockOk: { color: colors.success, fontSize: 11, fontWeight: "500", marginTop: 2 },
  stockLow: { color: colors.danger, fontSize: 11, fontWeight: "500", marginTop: 2 },

  cartLine: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  cartInfo: { flex: 1, paddingRight: spacing.sm },
  cartName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  cartMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  qty: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  qtyButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 36, justifyContent: "center", width: 36 },
  qtyValue: { color: colors.text, fontWeight: "700", minWidth: 24, textAlign: "center" },

  row: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  choice: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, minHeight: 40, justifyContent: "center", paddingHorizontal: spacing.md },
  choiceActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  choiceText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  choiceTextActive: { color: colors.primary, fontWeight: "700" },

  invoiceCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.md, ...shadows.card },
  invoiceTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  invoiceInfo: { flex: 1, paddingRight: spacing.sm },
  invoiceNo: { color: colors.text, fontSize: 15, fontWeight: "700" },
  invoiceMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  amountRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  invoiceAmount: { color: colors.text, fontSize: 16, fontWeight: "700" },
  dueText: { color: colors.danger, fontSize: 13, fontWeight: "700" },
  invoiceActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, flexDirection: "row", minHeight: 44, justifyContent: "center" },
  actionButtonPrimary: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, flex: 1, flexDirection: "row", minHeight: 44, justifyContent: "center" },
  actionText: { color: colors.primary, fontWeight: "600", fontSize: 13 },
  actionTextPrimary: { color: "#ffffff", fontWeight: "600", fontSize: 13 },

  sheetBackdrop: { backgroundColor: "rgba(15, 23, 42, 0.45)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
});
