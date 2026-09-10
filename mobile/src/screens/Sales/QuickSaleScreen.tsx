import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMutation, useQuery } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { getUpiConfig, Order, Product, quickSale, scanProduct } from "../../services/api";

type Step = "scan" | "cart" | "payment" | "invoice";
type PaymentMethod = "upi" | "cash" | "card";
type CartLine = { product: Product; qty: number };

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
    onError: (error: Error) => Alert.alert("Scan failed", error.message),
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
    onError: (error: Error) => Alert.alert("Checkout failed", error.message),
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
    const lines = invoice.items.map((item) => `${item.product.name} x ${item.qty} = Rs ${formatMoney(item.price * item.qty)}`).join("\n");
    await Share.share({ message: `MobileTrack CRM Invoice\n${new Date(invoice.createdAt).toLocaleString()}\n\n${lines}\n\nTotal: Rs ${formatMoney(invoice.total)}\nPayment: ${invoice.paymentMethod || paymentMethod}` });
  }

  return (
    <Screen>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons color={colors.text} name="chevron-back" size={20} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Quick Sale</Text>
        <TouchableOpacity onPress={() => setStep("cart")} style={styles.cartButton}>
          <Ionicons color="#ffffff" name="cart-outline" size={18} />
          <Text style={styles.cartText}>{cart.length}</Text>
        </TouchableOpacity>
      </View>

      {/* Progress Step Indicator */}
      <View style={styles.stepBar}>
        <StepPill active={step === "scan"} done={step !== "scan"} label="1. Scan" />
        <StepPill active={step === "cart"} done={step === "payment" || step === "invoice"} label="2. Cart" />
        <StepPill active={step === "payment"} done={step === "invoice"} label="3. Pay" />
        <StepPill active={step === "invoice"} done={false} label="4. Receipt" />
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
                <Text style={styles.scanHint}>{scanner.isPending ? "Adding product to cart..." : "Scan barcode or QR code"}</Text>
              </View>
            </CameraView>
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.sectionTitle}>Camera Access Needed</Text>
              <Button onPress={() => requestPermission()} title="Allow Camera Access" />
            </View>
          )}
          <View style={styles.scanActions}>
            <TouchableOpacity onPress={() => setTorch((value) => !value)} style={styles.secondaryButton}>
              <Ionicons color={colors.text} name={torch ? "flash-off-outline" : "flash-outline"} size={18} style={{ marginRight: 6 }} />
              <Text style={styles.secondaryText}>{torch ? "Flash Off" : "Flash On"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setManualOpen(true)} style={styles.secondaryButton}>
              <Ionicons color={colors.text} name="keypad-outline" size={18} style={{ marginRight: 6 }} />
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
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.totalPanel}>
            <Text style={styles.totalLabel}>Amount Payable</Text>
            <Text style={styles.totalValue}>Rs {formatMoney(totals.total)}</Text>
          </View>
          <Text style={styles.sectionLabel}>Select Payment Method</Text>
          <View style={styles.chips}>
            {(["upi", "cash", "card"] as PaymentMethod[]).map((method) => (
              <TouchableOpacity key={method} onPress={() => setPaymentMethod(method)} style={[styles.chip, paymentMethod === method && styles.chipActive]}>
                <Ionicons
                  color={paymentMethod === method ? colors.primary : colors.muted}
                  name={method === "upi" ? "qr-code-outline" : method === "cash" ? "cash-outline" : "card-outline"}
                  size={18}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.chipText, paymentMethod === method && styles.chipTextActive]}>{method.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {paymentMethod === "upi" && (
            <View style={styles.qrPanel}>
              {upi.data?.upiId ? (
                <>
                  <QRCode value={upiLink} size={200} />
                  <Text style={styles.qrHint}>Scan with GPay, PhonePe, Paytm, or UPI App</Text>
                </>
              ) : (
                <Empty icon="qr-code-outline" text="UPI ID is not configured on the backend." />
              )}
            </View>
          )}
          <Button icon="checkmark-circle-outline" loading={checkout.isPending} onPress={() => checkout.mutate()} title="Confirm Payment Received" />
          <TouchableOpacity onPress={() => setStep("cart")} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Back to Cart</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {step === "invoice" && invoice && (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.invoice}>
            <Text style={styles.invoiceShop}>MobileTrack CRM</Text>
            <Text style={styles.invoiceMeta}>{new Date(invoice.createdAt).toLocaleString()}</Text>
            <View style={{ marginVertical: spacing.sm }}>
              {invoice.items.map((item) => (
                <View key={item._id} style={styles.invoiceRow}>
                  <View style={styles.invoiceInfo}>
                    <Text style={styles.invoiceName}>{item.product.name}</Text>
                    <Text style={styles.invoiceMeta}>Qty {item.qty} × Rs {formatMoney(item.price)}</Text>
                  </View>
                  <Text style={styles.invoiceAmount}>Rs {formatMoney(item.price * item.qty)}</Text>
                </View>
              ))}
            </View>
            <View style={styles.invoiceTotal}>
              <Text style={styles.totalLabel}>Total Paid</Text>
              <Text style={styles.totalValueDark}>Rs {formatMoney(invoice.total)}</Text>
            </View>
            <View style={{ marginTop: spacing.xs }}>
              <Badge label={`Paid via ${(invoice.paymentMethod || paymentMethod).toUpperCase()}`} tone="success" />
            </View>
          </View>
          <Button icon="share-outline" onPress={shareInvoice} title="Share Receipt / Invoice" />
          <TouchableOpacity onPress={restart} style={styles.newSaleButton}>
            <Text style={styles.newSaleText}>+ Start New Quick Sale</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Manual SKU Modal */}
      <Modal transparent animationType="slide" visible={manualOpen}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sectionTitle}>Enter Product SKU / Barcode</Text>
              <TouchableOpacity onPress={() => setManualOpen(false)}>
                <Ionicons color={colors.text} name="close" size={20} />
              </TouchableOpacity>
            </View>
            <Field autoCapitalize="characters" onChangeText={setManualCode} placeholder="Enter SKU or scan number" value={manualCode} />
            <Button loading={scanner.isPending} onPress={() => { setManualOpen(false); handleCode(manualCode.trim()); setManualCode(""); }} title="Add Item to Cart" />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function StepPill({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  return (
    <View style={[styles.stepPill, active && styles.stepPillActive, done && styles.stepPillDone]}>
      <Text style={[styles.stepPillText, (active || done) && styles.stepPillTextActive]}>{label}</Text>
    </View>
  );
}

function CartStep({ cart, hasInvalidStock, onPay, onRemove, onScan, setQty, totals }: { cart: CartLine[]; hasInvalidStock: boolean; onPay: () => void; onRemove: (id: string) => void; onScan: () => void; setQty: (id: string, qty: number) => void; totals: { subtotal: number; total: number } }) {
  return (
    <View style={styles.flex}>
      <FlatList
        data={cart}
        keyExtractor={(item) => item.product._id}
        ListEmptyComponent={<Empty icon="scan-outline" text="Scan products to build a quick sale cart." />}
        renderItem={({ item }) => {
          const invalid = item.qty > item.product.stockQty || item.product.stockQty <= 0;
          return (
            <View style={[styles.cartLine, invalid && styles.cartInvalid]}>
              <View style={styles.cartInfo}>
                <Text style={styles.cartName}>{item.product.name}</Text>
                <Text style={styles.cartMeta}>Rs {formatMoney(item.product.price)} | Stock available: {item.product.stockQty}</Text>
                {invalid && <Text style={styles.outText}>Exceeds available stock!</Text>}
              </View>
              <View style={styles.cartActionRow}>
                <View style={styles.qty}>
                  <TouchableOpacity onPress={() => setQty(item.product._id, item.qty - 1)} style={styles.qtyButton}>
                    <Ionicons color={colors.primary} name="remove" size={16} />
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{item.qty}</Text>
                  <TouchableOpacity onPress={() => setQty(item.product._id, item.qty + 1)} style={styles.qtyButton}>
                    <Ionicons color={colors.primary} name="add" size={16} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => onRemove(item.product._id)} style={styles.removeButton}>
                  <Ionicons color={colors.danger} name="trash-outline" size={18} />
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.checkoutBar}>
        <View>
          <Text style={styles.totalLabelSmall}>Total Amount</Text>
          <Text style={styles.checkoutTotal}>Rs {formatMoney(totals.total)}</Text>
        </View>
        <View style={styles.checkoutBarButtons}>
          <TouchableOpacity onPress={onScan} style={styles.scanMoreButton}>
            <Ionicons color={colors.primary} name="scan-outline" size={16} style={{ marginRight: 4 }} />
            <Text style={styles.scanMoreText}>Scan</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={!cart.length || hasInvalidStock} onPress={onPay} style={[styles.payButton, (!cart.length || hasInvalidStock) && styles.payDisabled]}>
            <Text style={styles.payText}>Pay Rs {formatMoney(totals.total)}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", height: 38, justifyContent: "center", paddingHorizontal: spacing.sm },
  backText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  title: { color: colors.text, ...typography.h2 },
  cartButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, flexDirection: "row", gap: 4, height: 38, justifyContent: "center", paddingHorizontal: spacing.sm },
  cartText: { color: "#ffffff", fontWeight: "700" },

  stepBar: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
  stepPill: { flex: 1, backgroundColor: colors.surfaceTint, borderRadius: radius.pill, paddingVertical: 6, alignItems: "center" },
  stepPillActive: { backgroundColor: colors.primary },
  stepPillDone: { backgroundColor: colors.greenSoft },
  stepPillText: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  stepPillTextActive: { color: "#ffffff", fontWeight: "700" },

  scanWrap: { flex: 1 },
  camera: { borderRadius: radius.md, flex: 1, overflow: "hidden" },
  scanOverlay: { alignItems: "center", flex: 1, justifyContent: "center" },
  scanFrame: { borderColor: "#ffffff", borderRadius: radius.md, borderWidth: 3, height: 220, width: 220 },
  scanHint: { backgroundColor: "rgba(15, 23, 42, 0.65)", borderRadius: radius.sm, color: "#ffffff", fontWeight: "600", marginTop: spacing.md, padding: spacing.sm },
  scanActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  permissionBox: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, padding: spacing.md },
  sectionTitle: { color: colors.text, ...typography.h3, marginBottom: spacing.xs },
  sectionLabel: { color: colors.text, ...typography.label, marginBottom: spacing.xs },

  secondaryButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, flexDirection: "row", height: 44, justifyContent: "center" },
  secondaryText: { color: colors.text, fontSize: 13, fontWeight: "600" },

  cartLine: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.md, ...shadows.card },
  cartInvalid: { borderColor: colors.danger },
  cartInfo: { marginBottom: spacing.xs },
  cartName: { color: colors.text, fontSize: 15, fontWeight: "600" },
  cartMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  cartActionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  qty: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  qtyButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 36, justifyContent: "center", width: 36 },
  qtyValue: { color: colors.text, fontWeight: "700", minWidth: 24, textAlign: "center" },
  removeButton: { padding: spacing.xs },

  checkoutBar: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", padding: spacing.md, ...shadows.floating },
  totalLabelSmall: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  checkoutTotal: { color: colors.text, fontSize: 18, fontWeight: "700" },
  checkoutBarButtons: { flexDirection: "row", gap: spacing.xs },
  scanMoreButton: { alignItems: "center", backgroundColor: colors.primaryLight, borderColor: colors.primary, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", height: 44, justifyContent: "center", paddingHorizontal: spacing.sm },
  scanMoreText: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  payButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, height: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  payDisabled: { opacity: 0.5 },
  payText: { color: "#ffffff", fontWeight: "700" },

  totalPanel: { backgroundColor: colors.secondary, borderRadius: radius.md, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  totalLabel: { color: colors.blueSoft, fontWeight: "600", fontSize: 13 },
  totalValue: { color: "#ffffff", fontSize: 32, fontWeight: "700", marginTop: 2 },
  totalValueDark: { color: colors.text, fontSize: 24, fontWeight: "700" },
  chips: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  chip: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, flexDirection: "row", height: 44, justifyContent: "center" },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.primary, fontWeight: "700" },

  qrPanel: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.lg, ...shadows.card },
  qrHint: { color: colors.muted, fontSize: 12, fontWeight: "500", marginTop: spacing.md },

  invoice: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  invoiceShop: { color: colors.text, fontSize: 22, fontWeight: "700" },
  invoiceMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  invoiceRow: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xs },
  invoiceInfo: { flex: 1, paddingRight: spacing.sm },
  invoiceName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  invoiceAmount: { color: colors.text, fontWeight: "700" },
  invoiceTotal: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: spacing.xs, paddingTop: spacing.xs },
  newSaleButton: { alignItems: "center", height: 48, justifyContent: "center", marginTop: spacing.sm },
  newSaleText: { color: colors.primary, fontWeight: "700" },

  sheetBackdrop: { backgroundColor: "rgba(15, 23, 42, 0.45)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  cancelButton: { alignItems: "center", height: 44, justifyContent: "center", marginTop: spacing.xs },
  cancelText: { color: colors.muted, fontWeight: "600" },
  outText: { color: colors.danger, fontSize: 12, fontWeight: "600", marginTop: 2 },
});
