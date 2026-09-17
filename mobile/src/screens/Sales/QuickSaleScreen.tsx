import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMutation, useQuery } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import { useMemo, useState } from "react";
import { Alert, FlatList, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Field, IconButton, IosScreenHeader, Screen, SelectOption, Sheet } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { apiErrorMessage, getUpiConfig, Order, Product, quickSale, scanProduct } from "../../services/api";

type Step = "scan" | "cart" | "payment" | "invoice";
type PaymentMethod = "upi" | "cash" | "card";
type CartLine = { product: Product; qty: number };

const steps: { key: Step; label: string }[] = [
  { key: "scan", label: "Scan" },
  { key: "cart", label: "Cart" },
  { key: "payment", label: "Pay" },
  { key: "invoice", label: "Receipt" },
];

export default function QuickSaleScreen({ navigation }: any) {
  const [step, setStep] = useState<Step>("scan");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [torch, setTorch] = useState(false);
  const [lastScan, setLastScan] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("upi");
  const [invoice, setInvoice] = useState<Order | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const upi = useQuery({ queryKey: ["upi-config"], queryFn: getUpiConfig });
  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, line) => sum + line.product.price * line.qty, 0);
    return { subtotal, gst: 0, discount: 0, total: subtotal };
  }, [cart]);
  const hasInvalidStock = cart.some((line) => line.qty > line.product.stockQty || line.product.stockQty <= 0);
  const tempRef = useMemo(() => `QS-${Date.now()}`, [invoice]);
  const upiLink = `upi://pay?pa=${encodeURIComponent(upi.data?.upiId || "")}&pn=${encodeURIComponent(upi.data?.payeeName || "MobileTrack CRM")}&am=${totals.total}&cu=INR&tn=Invoice-${tempRef}`;
  const scanner = useMutation({
    mutationFn: scanProduct,
    onSuccess: (product) => {
      addToCart(product);
      setStep("cart");
    },
    onError: (error: Error) => Alert.alert("Scan failed", apiErrorMessage(error)),
  });
  const checkout = useMutation({
    mutationFn: () => quickSale({
      items: cart.map((line) => ({ productId: line.product._id, qty: line.qty })),
      paymentMethod,
      paymentRef: `${paymentMethod.toUpperCase()}-${tempRef}`,
    }),
    onSuccess: (order) => {
      setInvoice(order);
      setStep("invoice");
    },
    onError: (error: Error) => Alert.alert("Checkout failed", apiErrorMessage(error)),
  });

  function handleCode(code: string) {
    if (!code || scanner.isPending || code === lastScan) return;
    setLastScan(code);
    scanner.mutate(code);
    setTimeout(() => setLastScan(""), 1600);
  }

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.product._id === product._id);
      if (existing) return current.map((line) => line.product._id === product._id ? { ...line, qty: line.qty + 1 } : line);
      return [...current, { product, qty: 1 }];
    });
  }

  function setQty(productId: string, qty: number) {
    setCart((current) => current.map((line) => line.product._id === productId ? { ...line, qty: Math.max(1, qty) } : line));
  }

  function restart() {
    setCart([]);
    setInvoice(null);
    setStep("scan");
  }

  async function shareInvoice() {
    if (!invoice) return;
    const lines = invoice.items.map((item) => `${item.product.name} x ${item.qty} = ₹${formatMoney(item.price * item.qty)}`).join("\n");
    await Share.share({ message: `Kadai Kanakku Invoice\n${new Date(invoice.createdAt).toLocaleString()}\n\n${lines}\n\nTotal: ₹${formatMoney(invoice.total)}\nPayment: ${invoice.paymentMethod || paymentMethod}` });
  }

  const stepIndex = steps.findIndex((item) => item.key === step);

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        left={<IconButton accessibilityLabel="Go back" icon="chevron-back" onPress={() => navigation.goBack()} />}
        right={(
          <TouchableOpacity onPress={() => setStep("cart")} style={styles.cartBadge}>
            <Ionicons color="#FFFFFF" name="cart-outline" size={16} />
            <Text style={styles.cartBadgeText}>{cart.length}</Text>
          </TouchableOpacity>
        )}
        title="Quick Sale"
      />

      <View style={styles.stepBar}>
        {steps.map((item, index) => {
          const active = item.key === step;
          const done = index < stepIndex;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => {
                if (done || item.key === "scan" || (item.key === "cart" && cart.length) || (item.key === "payment" && cart.length)) {
                  if (item.key === "invoice" && !invoice) return;
                  setStep(item.key);
                }
              }}
              style={[styles.stepChip, done && styles.stepChipDone, active && styles.stepChipActive]}
            >
              <Text style={[styles.stepChipText, done && styles.stepChipTextDone, active && styles.stepChipTextOn]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {step === "scan" && (
        <View style={styles.scanWrap}>
          {permission?.granted ? (
            <CameraView
              style={styles.camera}
              enableTorch={torch}
              barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "code128", "upc_a", "upc_e"] } as any}
              onBarcodeScanned={(event: any) => handleCode(event.data)}
            >
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>{scanner.isPending ? "Adding product…" : "Scan barcode or QR"}</Text>
              </View>
            </CameraView>
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.sectionTitle}>Camera access needed</Text>
              <Button onPress={() => requestPermission()} title="Allow camera" />
            </View>
          )}
          <View style={styles.scanActions}>
            <TouchableOpacity onPress={() => setTorch((value) => !value)} style={styles.secondaryButton}>
              <Ionicons color={ios.label} name={torch ? "flash-off-outline" : "flash-outline"} size={18} />
              <Text style={styles.secondaryText}>{torch ? "Flash off" : "Flash on"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setManualOpen(true)} style={styles.secondaryButton}>
              <Ionicons color={ios.label} name="keypad-outline" size={18} />
              <Text style={styles.secondaryText}>Manual SKU</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === "cart" && (
        <CartStep
          cart={cart}
          hasInvalidStock={hasInvalidStock}
          onPay={() => setStep("payment")}
          onRemove={(id) => setCart((current) => current.filter((line) => line.product._id !== id))}
          onScan={() => setStep("scan")}
          setQty={setQty}
          totals={totals}
        />
      )}

      {step === "payment" && (
        <View style={styles.flex}>
          <ScrollView contentContainerStyle={styles.payContent} showsVerticalScrollIndicator={false}>
            <View style={styles.hero}>
              <Text style={styles.heroOverline}>Amount payable</Text>
              <Text style={styles.heroAmount}>₹{formatMoney(totals.total)}</Text>
            </View>
            <Text style={styles.fieldLabel}>Payment method</Text>
            <SelectOption
              label="UPI"
              meta="GPay, PhonePe, Paytm"
              onPress={() => setPaymentMethod("upi")}
              selected={paymentMethod === "upi"}
            />
            <SelectOption
              label="Cash"
              meta="Cash at counter"
              onPress={() => setPaymentMethod("cash")}
              selected={paymentMethod === "cash"}
            />
            <SelectOption
              label="Card"
              meta="Debit / credit"
              onPress={() => setPaymentMethod("card")}
              selected={paymentMethod === "card"}
            />
            {paymentMethod === "upi" && (
              <View style={styles.qrPanel}>
                {upi.data?.upiId ? (
                  <>
                    <QRCode value={upiLink} size={200} />
                    <Text style={styles.qrHint}>Scan with GPay, PhonePe, Paytm, or UPI</Text>
                  </>
                ) : (
                  <Empty icon="qr-code-outline" text="UPI ID is not configured on the backend." />
                )}
              </View>
            )}
            <TouchableOpacity onPress={() => setStep("cart")} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Back to cart</Text>
            </TouchableOpacity>
          </ScrollView>
          <View style={styles.stickyPay}>
            <TouchableOpacity
              disabled={checkout.isPending}
              onPress={() => checkout.mutate()}
              style={[styles.stickyPayBtn, checkout.isPending && styles.payDisabled]}
            >
              <Text style={styles.stickyPayText}>{checkout.isPending ? "Confirming…" : "Confirm payment"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === "invoice" && invoice && (
        <ScrollView contentContainerStyle={styles.payContent} showsVerticalScrollIndicator={false}>
          <View style={styles.invoice}>
            <Text style={styles.invoiceShop}>MobileTrack CRM</Text>
            <Text style={styles.invoiceMeta}>{new Date(invoice.createdAt).toLocaleString()}</Text>
            <View style={{ marginVertical: spacing.sm }}>
              {invoice.items.map((item) => (
                <View key={item._id} style={styles.invoiceRow}>
                  <View style={styles.invoiceInfo}>
                    <Text style={styles.invoiceName}>{item.product.name}</Text>
                    <Text style={styles.invoiceMeta}>Qty {item.qty} × ₹{formatMoney(item.price)}</Text>
                  </View>
                  <Text style={styles.invoiceAmount}>₹{formatMoney(item.price * item.qty)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.invoiceTotal}>
              <Text style={styles.heroOverline}>Total paid</Text>
              <Text style={styles.invoiceTotalValue}>₹{formatMoney(invoice.total)}</Text>
            </View>
            <View style={{ marginTop: spacing.xs }}>
              <Badge label={`Paid via ${(invoice.paymentMethod || paymentMethod).toUpperCase()}`} tone="success" />
            </View>
          </View>
          <Button icon="share-outline" onPress={shareInvoice} title="Share receipt" />
          <TouchableOpacity onPress={restart} style={styles.newSaleButton}>
            <Text style={styles.newSaleText}>Start new quick sale</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      <Sheet hint="Type a SKU or barcode number" onClose={() => setManualOpen(false)} title="Enter product SKU" visible={manualOpen}>
        <Field autoCapitalize="characters" onChangeText={setManualCode} placeholder="Enter SKU or scan number" value={manualCode} />
        <Button loading={scanner.isPending} onPress={() => { setManualOpen(false); handleCode(manualCode.trim()); setManualCode(""); }} title="Add to cart" />
      </Sheet>
    </Screen>
  );
}

function CartStep({ cart, hasInvalidStock, onPay, onRemove, onScan, setQty, totals }: { cart: CartLine[]; hasInvalidStock: boolean; onPay: () => void; onRemove: (id: string) => void; onScan: () => void; setQty: (id: string, qty: number) => void; totals: { subtotal: number; total: number } }) {
  return (
    <View style={styles.flex}>
      <FlatList
        data={cart}
        contentContainerStyle={styles.cartList}
        keyExtractor={(item) => item.product._id}
        ListEmptyComponent={<Empty icon="scan-outline" text="Scan products to build a quick sale cart." />}
        renderItem={({ item }) => {
          const invalid = item.qty > item.product.stockQty || item.product.stockQty <= 0;
          return (
            <View style={[styles.cartLine, invalid && styles.cartInvalid]}>
              <View style={styles.cartInfo}>
                <Text style={styles.cartName}>{item.product.name}</Text>
                <Text style={styles.cartMeta}>₹{formatMoney(item.product.price)} · Stock {item.product.stockQty}</Text>
                {invalid && <Text style={styles.outText}>Exceeds available stock</Text>}
              </View>
              <View style={styles.cartActionRow}>
                <View style={styles.qty}>
                  <TouchableOpacity onPress={() => setQty(item.product._id, item.qty - 1)} style={styles.qtyButton}>
                    <Ionicons color={ios.blue} name="remove" size={16} />
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.qty}</Text>
                  <TouchableOpacity onPress={() => setQty(item.product._id, item.qty + 1)} style={styles.qtyButton}>
                    <Ionicons color={ios.blue} name="add" size={16} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => onRemove(item.product._id)} style={styles.removeButton}>
                  <Ionicons color={ios.red} name="trash-outline" size={18} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.stickyPay}>
        <View style={styles.stickyMeta}>
          <Text style={styles.stickyLabel}>Total</Text>
          <Text style={styles.stickyTotal}>₹{formatMoney(totals.total)}</Text>
        </View>
        <TouchableOpacity onPress={onScan} style={styles.scanMore}>
          <Ionicons color={ios.blue} name="scan-outline" size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          disabled={!cart.length || hasInvalidStock}
          onPress={onPay}
          style={[styles.stickyPayBtn, styles.stickyPayFlex, (!cart.length || hasInvalidStock) && styles.payDisabled]}
        >
          <Text style={styles.stickyPayText}>Pay ₹{formatMoney(totals.total)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  screen: { backgroundColor: ios.bg },
  flex: { flex: 1 },
  cartBadge: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 18,
    flexDirection: "row",
    gap: spacing.xxs,
    height: 36,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  cartBadgeText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 13 },
  stepBar: { flexDirection: "row", gap: 5, marginBottom: spacing.sm },
  stepChip: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: 999,
    flex: 1,
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: spacing.xxs,
  },
  stepChipActive: { backgroundColor: ios.blue },
  stepChipDone: { backgroundColor: "#34C75933" },
  stepChipText: { color: ios.secondary, fontFamily: fonts.semibold, fontSize: 12 },
  stepChipTextDone: { color: ios.green },
  stepChipTextOn: { color: "#FFFFFF" },
  scanWrap: { flex: 1 },
  camera: { borderRadius: 18, flex: 1, overflow: "hidden" },
  scanOverlay: { alignItems: "center", flex: 1, justifyContent: "center" },
  scanFrame: { borderColor: "#FFFFFF", borderRadius: 18, borderWidth: 3, height: 220, width: 220 },
  scanHint: {
    backgroundColor: "rgba(28, 28, 30, 0.72)",
    borderRadius: 12,
    color: "#FFFFFF",
    fontFamily: fonts.semibold,
    marginTop: spacing.md,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  scanActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  permissionBox: { backgroundColor: ios.card, borderRadius: 18, padding: spacing.md },
  sectionTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 16, marginBottom: 8 },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 14,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    height: 44,
    justifyContent: "center",
  },
  secondaryText: { color: ios.label, fontFamily: fonts.semibold, fontSize: 13 },
  cartList: { paddingBottom: spacing.sm },
  cartLine: {
    backgroundColor: ios.card,
    borderRadius: 18,
    marginBottom: 8,
    padding: 11,
  },
  cartInvalid: { borderColor: ios.red, borderWidth: 1 },
  cartInfo: { marginBottom: spacing.xs },
  cartName: { color: ios.label, fontFamily: fonts.semibold, fontSize: 15 },
  cartMeta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  cartActionRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  qty: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  qtyButton: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: 10,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  qtyValue: { color: ios.label, fontFamily: fonts.bold, minWidth: 24, textAlign: "center" },
  removeButton: { padding: spacing.xs },
  outText: { color: ios.red, fontFamily: fonts.semibold, fontSize: 12, marginTop: 2 },
  stickyPay: {
    alignItems: "center",
    backgroundColor: ios.dark,
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing.xxs,
    padding: spacing.sm,
  },
  stickyMeta: { minWidth: 72 },
  stickyLabel: { color: "rgba(255,255,255,0.55)", fontFamily: fonts.medium, fontSize: 11 },
  stickyTotal: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 18 },
  scanMore: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  stickyPayBtn: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  stickyPayFlex: { flex: 1 },
  stickyPayText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 15 },
  payDisabled: { opacity: 0.45 },
  payContent: { paddingBottom: spacing.xl },
  hero: {
    backgroundColor: ios.dark,
    borderRadius: 18,
    marginBottom: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  heroOverline: { color: "rgba(255,255,255,0.62)", fontFamily: fonts.medium, fontSize: 12 },
  heroAmount: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 30, letterSpacing: -0.8, marginTop: 2 },
  fieldLabel: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 12, marginBottom: spacing.xs },
  chips: { flexDirection: "row", gap: spacing.xs, marginBottom: 10 },
  chip: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    height: 40,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: "#007AFF14" },
  chipText: { color: ios.label, fontFamily: fonts.semibold, fontSize: 12 },
  chipTextActive: { color: ios.blue },
  qrPanel: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 16,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  qrHint: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 12, marginTop: 10 },
  cancelButton: { alignItems: "center", height: 42, justifyContent: "center" },
  cancelText: { color: ios.secondary, fontFamily: fonts.semibold, fontSize: 13 },
  invoice: {
    backgroundColor: ios.card,
    borderRadius: 16,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  invoiceShop: { color: ios.label, fontFamily: fonts.bold, fontSize: 18 },
  invoiceMeta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  invoiceRow: {
    borderTopColor: ios.separator,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  invoiceInfo: { flex: 1, paddingRight: 8 },
  invoiceName: { color: ios.label, fontFamily: fonts.semibold, fontSize: 13 },
  invoiceAmount: { color: ios.label, fontFamily: fonts.bold, fontSize: 13 },
  invoiceTotal: {
    borderTopColor: ios.separator,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: spacing.xxs,
    paddingTop: 6,
  },
  invoiceTotalValue: { color: ios.label, fontFamily: fonts.bold, fontSize: 24, marginTop: 2 },
  newSaleButton: { alignItems: "center", height: 44, justifyContent: "center", marginTop: spacing.xs },
  newSaleText: { color: ios.blue, fontFamily: fonts.bold, fontSize: 14 },
});
