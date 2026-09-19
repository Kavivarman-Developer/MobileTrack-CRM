import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Badge, Button, Card, Empty, Field, IosSearchBar, Screen } from "../../components/Layout";
import { colors, fonts, spacing, typography } from "../../constants/theme";
import { apiErrorMessage, createGuestStoreOrder, getStoreProducts, StoreProduct, verifyGuestStoreOrder } from "../../services/api";
import { showErrorToast, showSuccessToast } from "../../utils/toast";

type CartLine = { product: StoreProduct; qty: number };

function rupee(value: number) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function productCategory(product: StoreProduct) {
  const category = product.category;
  if (!category) return "Grocery";
  if (typeof category === "string") return category;
  return category.name || "Grocery";
}

export default function GroceryStoreScreen({ navigation }: any) {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "", email: "", address: "", city: "", state: "", pincode: "" });
  const [latestOrderId, setLatestOrderId] = useState("");

  const catalog = useQuery({
    queryKey: ["store-products", search],
    queryFn: () => getStoreProducts(search),
  });

  const lines = Object.values(cart);
  const subtotal = lines.reduce((sum, line) => sum + line.product.price * line.qty, 0);
  const deliveryFee = subtotal > 0 && subtotal < 499 ? 35 : 0;
  const total = subtotal + deliveryFee;

  const categories = useMemo(() => {
    const names = new Set((catalog.data?.products || []).map(productCategory));
    return Array.from(names).slice(0, 4);
  }, [catalog.data?.products]);

  function addProduct(product: StoreProduct) {
    setCart((current) => {
      const existing = current[product._id];
      const nextQty = Math.min((existing?.qty || 0) + 1, product.stockQty || 1);
      return { ...current, [product._id]: { product, qty: nextQty } };
    });
  }

  function setQty(productId: string, qty: number) {
    setCart((current) => {
      const line = current[productId];
      if (!line) return current;
      if (qty <= 0) {
        const next = { ...current };
        delete next[productId];
        return next;
      }
      return { ...current, [productId]: { ...line, qty: Math.min(qty, line.product.stockQty || qty) } };
    });
  }

  const createOrder = useMutation({
    mutationFn: () => createGuestStoreOrder({
      customer,
      items: lines.map((line) => ({ productId: line.product._id, qty: line.qty })),
    }),
    onSuccess: async (data) => {
      const orderId = data.order?.invoiceNumber;
      setLatestOrderId(orderId || "");
      const paymentUrl = data.payment?.payment_link || data.payment?.payments?.url || data.payment?.payment_url;
      if (paymentUrl) {
        await WebBrowser.openBrowserAsync(paymentUrl);
        showSuccessToast("Payment opened", "Return here after paying to verify your order.");
      } else if (data.payment?.payment_session_id) {
        Alert.alert("Cashfree session ready", `Payment session created: ${data.payment.payment_session_id}`);
      } else {
        Alert.alert("Order created", data.payment?.message || "Cashfree credentials are not configured yet.");
      }
      setCheckoutOpen(false);
    },
    onError: (error) => showErrorToast(apiErrorMessage(error), "Checkout failed"),
  });

  const verifyOrder = useMutation({
    mutationFn: () => verifyGuestStoreOrder(latestOrderId),
    onSuccess: (data) => {
      if (data.order?.paymentStatus === "paid") {
        setCart({});
        showSuccessToast("Payment verified", "Your grocery order is confirmed.");
      } else {
        Alert.alert("Payment pending", `Current status: ${data.cashfree?.order_status || data.order?.paymentStatus || "pending"}`);
      }
    },
    onError: (error) => showErrorToast(apiErrorMessage(error), "Verification failed"),
  });

  function submitCheckout() {
    if (!customer.name.trim() || !customer.phone.trim() || !customer.address.trim()) {
      return Alert.alert("Delivery details", "Name, phone, and address are required.");
    }
    if (!lines.length) return Alert.alert("Cart empty", "Add grocery items first.");
    createOrder.mutate();
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="chevron-back" size={22} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Guest grocery checkout</Text>
          <Text style={styles.title}>{catalog.data?.store.name || "Fresh Basket"}</Text>
        </View>
        <View style={styles.cartBadge}>
          <Ionicons color="#FFFFFF" name="cart" size={18} />
          <Text style={styles.cartBadgeText}>{lines.reduce((sum, line) => sum + line.qty, 0)}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View>
            <Text style={styles.heroTitle}>Daily groceries, quick checkout</Text>
            <Text style={styles.heroSub}>Shop as guest and pay securely with Cashfree.</Text>
          </View>
          <Ionicons color="#FFFFFF" name="leaf" size={30} />
        </View>

        <IosSearchBar onChangeText={setSearch} placeholder="Search rice, milk, fruits..." value={search} />

        {categories.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {categories.map((category) => (
              <View key={category} style={styles.categoryPill}>
                <Text style={styles.categoryText}>{category}</Text>
              </View>
            ))}
          </ScrollView>
        ) : null}

        {catalog.isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : catalog.data?.products.length ? (
          <View style={styles.grid}>
            {catalog.data.products.map((product) => {
              const qty = cart[product._id]?.qty || 0;
              return (
                <Card key={product._id} style={styles.productCard}>
                  <View style={styles.productImageWrap}>
                    {product.images?.[0] ? (
                      <Image source={{ uri: product.images[0] }} style={styles.productImage} />
                    ) : (
                      <Ionicons color={colors.success} name="basket-outline" size={34} />
                    )}
                  </View>
                  <Badge label={productCategory(product)} tone="success" />
                  <Text numberOfLines={2} style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productMeta}>{product.unit || "pcs"} · {product.stockQty} left</Text>
                  <View style={styles.productFooter}>
                    <Text style={styles.price}>{rupee(product.price)}</Text>
                    {qty ? (
                      <View style={styles.qtyControl}>
                        <Pressable onPress={() => setQty(product._id, qty - 1)} style={styles.qtyButton}>
                          <Ionicons color={colors.text} name="remove" size={16} />
                        </Pressable>
                        <Text style={styles.qtyText}>{qty}</Text>
                        <Pressable onPress={() => setQty(product._id, qty + 1)} style={styles.qtyButton}>
                          <Ionicons color={colors.text} name="add" size={16} />
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable onPress={() => addProduct(product)} style={styles.addButton}>
                        <Ionicons color="#FFFFFF" name="add" size={18} />
                      </Pressable>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        ) : (
          <Empty icon="storefront-outline" text="No grocery products found. Seed products or add stock in inventory." />
        )}

        {lines.length ? (
          <Card style={styles.cartCard}>
            <Text style={styles.sectionTitle}>Cart</Text>
            {lines.map((line) => (
              <View key={line.product._id} style={styles.cartLine}>
                <Text numberOfLines={1} style={styles.cartName}>{line.product.name}</Text>
                <Text style={styles.cartAmount}>{line.qty} x {rupee(line.product.price)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{rupee(subtotal)}</Text></View>
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Delivery</Text><Text style={styles.totalValue}>{deliveryFee ? rupee(deliveryFee) : "Free"}</Text></View>
            <View style={styles.grandRow}><Text style={styles.grandLabel}>Total</Text><Text style={styles.grandValue}>{rupee(total)}</Text></View>
            <Button icon="card-outline" onPress={() => setCheckoutOpen(true)} title="Guest checkout with Cashfree" />
            {latestOrderId ? (
              <Button loading={verifyOrder.isPending} onPress={() => verifyOrder.mutate()} style={styles.verifyButton} title={`Verify ${latestOrderId}`} variant="secondary" />
            ) : null}
          </Card>
        ) : null}

        {checkoutOpen ? (
          <Card style={styles.checkoutCard}>
            <Text style={styles.sectionTitle}>Delivery details</Text>
            <Text style={styles.label}>Name</Text>
            <Field onChangeText={(name) => setCustomer((current) => ({ ...current, name }))} placeholder="Customer name" value={customer.name} />
            <Text style={styles.label}>Phone</Text>
            <Field keyboardType="phone-pad" onChangeText={(phone) => setCustomer((current) => ({ ...current, phone }))} placeholder="10-digit mobile number" value={customer.phone} />
            <Text style={styles.label}>Email</Text>
            <Field autoCapitalize="none" keyboardType="email-address" onChangeText={(email) => setCustomer((current) => ({ ...current, email }))} placeholder="Optional" value={customer.email} />
            <Text style={styles.label}>Address</Text>
            <Field multiline onChangeText={(address) => setCustomer((current) => ({ ...current, address }))} placeholder="House, street, area" value={customer.address} />
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.label}>City</Text>
                <Field onChangeText={(city) => setCustomer((current) => ({ ...current, city }))} placeholder="City" value={customer.city} />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>Pincode</Text>
                <Field keyboardType="number-pad" onChangeText={(pincode) => setCustomer((current) => ({ ...current, pincode }))} placeholder="Pincode" value={customer.pincode} />
              </View>
            </View>
            <Button loading={createOrder.isPending} onPress={submitCheckout} title={`Pay ${rupee(total)}`} />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: spacing.md },
  header: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  iconButton: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 14, height: 42, justifyContent: "center", width: 42 },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.muted, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h2 },
  cartBadge: { alignItems: "center", backgroundColor: colors.success, borderRadius: 14, flexDirection: "row", gap: spacing.xxs, minHeight: 42, paddingHorizontal: spacing.sm },
  cartBadgeText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 14, fontWeight: "700" },
  content: { paddingBottom: spacing.xxl },
  hero: { alignItems: "center", backgroundColor: "#14532D", borderRadius: 8, flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md, padding: spacing.lg },
  heroTitle: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 22, fontWeight: "700", maxWidth: 240 },
  heroSub: { color: "rgba(255,255,255,0.78)", fontFamily: fonts.medium, fontSize: 13, marginTop: spacing.xxs },
  categoryRow: { gap: spacing.xs, paddingBottom: spacing.md },
  categoryPill: { backgroundColor: colors.greenSoft, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  categoryText: { color: colors.success, fontFamily: fonts.semibold, fontSize: 12, fontWeight: "600" },
  loader: { marginVertical: spacing.xl },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  productCard: { borderRadius: 8, marginBottom: 0, padding: spacing.sm, width: "48%" },
  productImageWrap: { alignItems: "center", aspectRatio: 1.45, backgroundColor: colors.greenSoft, borderRadius: 8, justifyContent: "center", marginBottom: spacing.sm, overflow: "hidden" },
  productImage: { height: "100%", width: "100%" },
  productName: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14, fontWeight: "600", lineHeight: 19, marginTop: spacing.xs, minHeight: 30 },
  productMeta: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, marginTop: spacing.xxs },
  productFooter: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm },
  price: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, fontWeight: "700" },
  addButton: { alignItems: "center", backgroundColor: colors.success, borderRadius: 12, height: 34, justifyContent: "center", width: 38 },
  qtyControl: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: 12, flexDirection: "row", gap: spacing.xs, minHeight: 34, paddingHorizontal: spacing.xs },
  qtyButton: { alignItems: "center", height: 28, justifyContent: "center", width: 26 },
  qtyText: { color: colors.text, fontFamily: fonts.bold, fontSize: 13, fontWeight: "700" },
  cartCard: { borderRadius: 8, marginTop: spacing.md },
  sectionTitle: { color: colors.text, ...typography.h3, marginBottom: spacing.sm },
  cartLine: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, marginBottom: spacing.xs },
  cartName: { color: colors.text, flex: 1, fontFamily: fonts.medium, fontSize: 14 },
  cartAmount: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xs },
  totalLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 14 },
  totalValue: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14, fontWeight: "600" },
  grandRow: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: spacing.sm, paddingTop: spacing.sm, marginBottom: 11 },
  grandLabel: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, fontWeight: "700" },
  grandValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, fontWeight: "700" },
  verifyButton: { marginTop: spacing.sm },
  checkoutCard: { borderRadius: 8, marginTop: spacing.md },
  label: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 12, fontWeight: "600", marginBottom: spacing.xxs },
  twoCol: { flexDirection: "row", gap: spacing.sm },
  col: { flex: 1 },
});
