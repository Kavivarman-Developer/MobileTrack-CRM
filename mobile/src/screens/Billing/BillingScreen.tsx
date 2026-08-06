import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Invoice desk</Text>
            <Text style={styles.title}>Billing</Text>
          </View>
          <View style={styles.headerTotal}>
            <Text style={styles.headerTotalLabel}>Due</Text>
            <Text style={styles.headerTotalValue}>Rs {formatMoney(dueTotal)}</Text>
          </View>
        </View>

        <View style={styles.totalPanel}>
          <Text style={styles.totalLabel}>Current bill</Text>
          <Text style={styles.totalValue}>Rs {formatMoney(total)}</Text>
          <Text style={styles.totalHint}>Paid Rs {formatMoney(paidPreview)} | Balance Rs {formatMoney(balancePreview)}</Text>
        </View>

        <View style={styles.panel}>
          <Text style={styles.section}>Customer</Text>
          <FlatList
            data={customers.data || []}
            horizontal
            keyExtractor={(item) => item._id}
            showsHorizontalScrollIndicator={false}
            ListEmptyComponent={<Empty text={customers.isLoading ? "Loading customers..." : "No customers found."} />}
            renderItem={({ item }) => <CustomerChip active={customerId === item._id} customer={item} onPress={() => setCustomerId(item._id)} />}
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.section}>Items</Text>
          <Field onChangeText={setProductSearch} placeholder="Search product or SKU" value={productSearch} />
          <FlatList
            data={filteredProducts.slice(0, 12)}
            horizontal
            keyExtractor={(item) => item._id}
            showsHorizontalScrollIndicator={false}
            ListEmptyComponent={<Empty text={products.isLoading ? "Loading products..." : "No products found."} />}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => add(item)} style={styles.product}>
                <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>Rs {formatMoney(item.price)}</Text>
                <Text style={item.stockQty <= item.lowStockThreshold ? styles.stockLow : styles.stockOk}>{item.stockQty} stock</Text>
              </TouchableOpacity>
            )}
          />
          {cart.map((line) => (
            <View key={line.product._id} style={styles.cartLine}>
              <View style={styles.cartInfo}>
                <Text numberOfLines={1} style={styles.cartName}>{line.product.name}</Text>
                <Text style={styles.cartMeta}>Rs {formatMoney(line.product.price)} x {line.qty}</Text>
              </View>
              <View style={styles.qty}>
                <TouchableOpacity onPress={() => setQty(line.product._id, line.qty - 1)} style={styles.qtyButton}><Text style={styles.qtyText}>-</Text></TouchableOpacity>
                <Text style={styles.qtyValue}>{line.qty}</Text>
                <TouchableOpacity onPress={() => setQty(line.product._id, line.qty + 1)} style={styles.qtyButton}><Text style={styles.qtyText}>+</Text></TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.panel}>
          <Text style={styles.section}>Billing options</Text>
          <View style={styles.row}>
            <View style={styles.half}><Field keyboardType="numeric" onChangeText={setDiscount} placeholder="Discount" value={discount} /></View>
            <View style={styles.half}><Field keyboardType="numeric" onChangeText={setGst} placeholder="GST" value={gst} /></View>
          </View>
          <View style={styles.chips}>
            <Choice active={paymentStatus === "paid"} label="Paid" onPress={() => setPaymentStatus("paid")} />
            <Choice active={paymentStatus === "partial"} label="Partial" onPress={() => setPaymentStatus("partial")} />
            <Choice active={paymentStatus === "pending"} label="Pending" onPress={() => setPaymentStatus("pending")} />
          </View>
          <View style={styles.chips}>
            {["cash", "upi", "card"].map((method) => <Choice key={method} active={paymentMethod === method} label={method.toUpperCase()} onPress={() => setPaymentMethod(method)} />)}
          </View>
          {paymentStatus === "partial" && <Field keyboardType="numeric" onChangeText={setAmountPaid} placeholder="Amount received" value={amountPaid} />}
          {paymentStatus !== "paid" && <Field onChangeText={setDueDate} placeholder="Due date YYYY-MM-DD" value={dueDate} />}
          <Field multiline onChangeText={setNotes} placeholder="Notes" value={notes} />
          <Button loading={createInvoice.isPending} onPress={validateAndCreate} title="Save bill" />
        </View>

        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.section}>Invoices</Text>
            <Text style={styles.countPill}>{orders.data?.length || 0}</Text>
          </View>
          <View style={styles.chips}>
            {(["all", "pending", "partial", "paid"] as PaymentFilter[]).map((item) => <Choice key={item} active={filter === item} label={item.toUpperCase()} onPress={() => setFilter(item)} />)}
          </View>
          {(orders.data || []).length ? (orders.data || []).map((order) => (
            <View key={order._id} style={styles.invoiceRow}>
              <View style={styles.invoiceTop}>
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceNo}>{order.invoiceNumber || order._id.slice(-6).toUpperCase()}</Text>
                  <Text style={styles.invoiceMeta}>{order.customer?.name || "Walk-in customer"} | {new Date(order.createdAt).toLocaleDateString()}</Text>
                </View>
                <Badge label={order.paymentStatus} tone={order.paymentStatus === "paid" ? "success" : order.paymentStatus === "partial" ? "warning" : "danger"} />
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.invoiceAmount}>Rs {formatMoney(order.total)}</Text>
                <Text style={styles.dueText}>Due Rs {formatMoney(getBalance(order))}</Text>
              </View>
              <View style={styles.invoiceActions}>
                <TouchableOpacity onPress={() => shareInvoice(order)} style={styles.actionButton}><Text style={styles.actionText}>Share</Text></TouchableOpacity>
                {getBalance(order) > 0 && <TouchableOpacity onPress={() => { setPaymentOrder(order); setCollectAmount(String(getBalance(order))); }} style={styles.actionButtonPrimary}><Text style={styles.actionTextPrimary}>Collect</Text></TouchableOpacity>}
              </View>
            </View>
          )) : <Empty text={orders.isLoading ? "Loading invoices..." : "No invoices found."} />}
        </View>
      </ScrollView>

      <Modal transparent animationType="slide" visible={!!paymentOrder}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.section}>Collect payment</Text>
            <Text style={styles.invoiceMeta}>{paymentOrder?.invoiceNumber} balance Rs {formatMoney(paymentOrder ? getBalance(paymentOrder) : 0)}</Text>
            <Field keyboardType="numeric" onChangeText={setCollectAmount} placeholder="Amount" value={collectAmount} />
            <View style={styles.chips}>
              {["cash", "upi", "card"].map((method) => <Choice key={method} active={collectMethod === method} label={method.toUpperCase()} onPress={() => setCollectMethod(method)} />)}
            </View>
            <Button loading={collectPayment.isPending} onPress={() => collectPayment.mutate()} title="Update payment" />
            <TouchableOpacity onPress={() => setPaymentOrder(null)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
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
      <Text style={styles.customerDue}>Due Rs {formatMoney(customer.pendingBalance || 0)}</Text>
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
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 2 },
  headerTotal: { alignItems: "flex-end", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, minWidth: 108, padding: spacing.sm },
  headerTotalLabel: { color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
  headerTotalValue: { color: colors.danger, fontSize: 16, fontWeight: "900", marginTop: 2 },
  totalPanel: { backgroundColor: colors.secondary, borderRadius: 8, marginBottom: spacing.md, padding: spacing.md },
  totalLabel: { color: colors.blueSoft, fontWeight: "800" },
  totalValue: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 2 },
  totalHint: { color: colors.blueSoft, fontSize: 12, fontWeight: "700", marginTop: spacing.xs },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  panelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  section: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
  customerChip: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginRight: spacing.sm, minHeight: 62, padding: spacing.sm, width: 150 },
  customerChipActive: { backgroundColor: colors.tealSoft, borderColor: colors.primary },
  customerName: { color: colors.text, fontWeight: "900" },
  customerNameActive: { color: colors.primaryDark },
  customerDue: { color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 4 },
  product: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 118, marginRight: spacing.sm, marginTop: spacing.xs, padding: spacing.sm, width: 136 },
  productName: { color: colors.text, fontWeight: "900", minHeight: 38 },
  productPrice: { color: colors.primaryDark, fontSize: 16, fontWeight: "900", marginTop: spacing.xs },
  stockOk: { color: colors.success, fontSize: 12, fontWeight: "800", marginTop: 4 },
  stockLow: { color: colors.danger, fontSize: 12, fontWeight: "800", marginTop: 4 },
  cartLine: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  cartInfo: { flex: 1, paddingRight: spacing.sm },
  cartName: { color: colors.text, fontWeight: "900" },
  cartMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  qty: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  qtyButton: { alignItems: "center", backgroundColor: colors.background, borderRadius: 8, height: 34, justifyContent: "center", width: 34 },
  qtyText: { color: colors.primary, fontSize: 20, fontWeight: "900", marginTop: -2 },
  qtyValue: { color: colors.text, fontWeight: "900", minWidth: 22, textAlign: "center" },
  row: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  choice: { alignItems: "center", backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, minHeight: 42, justifyContent: "center", paddingHorizontal: spacing.md },
  choiceActive: { backgroundColor: colors.tealSoft, borderColor: colors.primary },
  choiceText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  choiceTextActive: { color: colors.primaryDark },
  countPill: { backgroundColor: colors.background, borderRadius: 999, color: colors.primaryDark, fontWeight: "900", minWidth: 34, overflow: "hidden", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, textAlign: "center" },
  invoiceRow: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.sm },
  invoiceTop: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  invoiceInfo: { flex: 1, paddingRight: spacing.sm },
  invoiceNo: { color: colors.text, fontSize: 15, fontWeight: "900" },
  invoiceMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: spacing.sm, marginTop: 3 },
  amountRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  invoiceAmount: { color: colors.text, fontSize: 18, fontWeight: "900" },
  dueText: { color: colors.danger, fontWeight: "900" },
  invoiceActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  actionButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 42, justifyContent: "center" },
  actionButtonPrimary: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, flex: 1, minHeight: 42, justifyContent: "center" },
  actionText: { color: colors.primaryDark, fontWeight: "900" },
  actionTextPrimary: { color: "#fff", fontWeight: "900" },
  sheetBackdrop: { backgroundColor: "rgba(0,0,0,0.35)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: spacing.md },
  cancelButton: { alignItems: "center", minHeight: 48, justifyContent: "center", marginTop: spacing.sm },
  cancelText: { color: colors.muted, fontWeight: "900" },
});
