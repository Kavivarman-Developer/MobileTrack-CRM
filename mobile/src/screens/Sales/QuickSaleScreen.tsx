import { CameraView, useCameraPermissions } from "expo-camera";
import { useMutation, useQuery } from "@tanstack/react-query";
import QRCode from "react-native-qrcode-svg";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
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
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>Back</Text></TouchableOpacity>
        <Text style={styles.title}>Quick Sale</Text>
        <TouchableOpacity onPress={() => setStep("cart")} style={styles.cartButton}><Text style={styles.cartText}>{cart.length}</Text></TouchableOpacity>
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
                <Text style={styles.scanHint}>{scanner.isPending ? "Adding product..." : "Scan barcode or QR"}</Text>
              </View>
            </CameraView>
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.section}>Camera access needed</Text>
              <Button onPress={() => requestPermission()} title="Allow camera" />
            </View>
          )}
          <View style={styles.scanActions}>
            <TouchableOpacity onPress={() => setTorch((value) => !value)} style={styles.secondaryButton}><Text style={styles.secondaryText}>{torch ? "Torch off" : "Torch on"}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setManualOpen(true)} style={styles.secondaryButton}><Text style={styles.secondaryText}>Enter SKU manually</Text></TouchableOpacity>
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
        <ScrollView>
          <View style={styles.totalPanel}>
            <Text style={styles.totalLabel}>Amount payable</Text>
            <Text style={styles.totalValue}>Rs {formatMoney(totals.total)}</Text>
          </View>
          <View style={styles.chips}>
            {(["upi", "cash", "card"] as PaymentMethod[]).map((method) => (
              <TouchableOpacity key={method} onPress={() => setPaymentMethod(method)} style={[styles.chip, paymentMethod === method && styles.chipActive]}>
                <Text style={[styles.chipText, paymentMethod === method && styles.chipTextActive]}>{method.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {paymentMethod === "upi" && (
            <View style={styles.qrPanel}>
              {upi.data?.upiId ? <QRCode value={upiLink} size={220} /> : <Empty text="UPI ID is not configured on the backend." />}
            </View>
          )}
          <Button loading={checkout.isPending} onPress={() => checkout.mutate()} title="Payment Received" />
          <TouchableOpacity onPress={() => setStep("cart")} style={styles.cancelButton}><Text style={styles.cancelText}>Back to cart</Text></TouchableOpacity>
        </ScrollView>
      )}

      {step === "invoice" && invoice && (
        <ScrollView>
          <View style={styles.invoice}>
            <Text style={styles.invoiceShop}>MobileTrack CRM</Text>
            <Text style={styles.invoiceMeta}>{new Date(invoice.createdAt).toLocaleString()}</Text>
            {invoice.items.map((item) => (
              <View key={item._id} style={styles.invoiceRow}>
                <View style={styles.invoiceInfo}>
                  <Text style={styles.invoiceName}>{item.product.name}</Text>
                  <Text style={styles.invoiceMeta}>Qty {item.qty} | Rs {formatMoney(item.price)}</Text>
                </View>
                <Text style={styles.invoiceAmount}>Rs {formatMoney(item.price * item.qty)}</Text>
              </View>
            ))}
            <View style={styles.invoiceTotal}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>Rs {formatMoney(invoice.total)}</Text>
            </View>
            <Text style={styles.invoiceMeta}>Payment: {(invoice.paymentMethod || paymentMethod).toUpperCase()}</Text>
          </View>
          <Button onPress={shareInvoice} title="Share Invoice" />
          <TouchableOpacity onPress={restart} style={styles.newSaleButton}><Text style={styles.newSaleText}>New Sale</Text></TouchableOpacity>
        </ScrollView>
      )}

      <Modal transparent animationType="slide" visible={manualOpen}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.section}>Enter SKU manually</Text>
            <Field autoCapitalize="characters" onChangeText={setManualCode} placeholder="SKU or barcode" value={manualCode} />
            <Button loading={scanner.isPending} onPress={() => { setManualOpen(false); handleCode(manualCode.trim()); setManualCode(""); }} title="Add to cart" />
            <TouchableOpacity onPress={() => setManualOpen(false)} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function CartStep({ cart, hasInvalidStock, onPay, onRemove, onScan, setQty, totals }: { cart: CartLine[]; hasInvalidStock: boolean; onPay: () => void; onRemove: (id: string) => void; onScan: () => void; setQty: (id: string, qty: number) => void; totals: { subtotal: number; total: number } }) {
  return (
    <View style={styles.flex}>
      <FlatList
        data={cart}
        keyExtractor={(item) => item.product._id}
        ListEmptyComponent={<Empty text="Scan products to build a cart." />}
        renderItem={({ item }) => {
          const invalid = item.qty > item.product.stockQty || item.product.stockQty <= 0;
          return (
            <View style={[styles.cartLine, invalid && styles.cartInvalid]}>
              <View style={styles.cartInfo}>
                <Text style={styles.cartName}>{item.product.name}</Text>
                <Text style={styles.cartMeta}>Rs {formatMoney(item.product.price)} | Stock {item.product.stockQty}</Text>
                {invalid && <Text style={styles.outText}>Out of stock</Text>}
              </View>
              <View style={styles.qty}>
                <TouchableOpacity onPress={() => setQty(item.product._id, item.qty - 1)} style={styles.qtyButton}><Text style={styles.qtyText}>-</Text></TouchableOpacity>
                <Text style={styles.qtyValue}>{item.qty}</Text>
                <TouchableOpacity onPress={() => setQty(item.product._id, item.qty + 1)} style={styles.qtyButton}><Text style={styles.qtyText}>+</Text></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => onRemove(item.product._id)} style={styles.removeButton}><Text style={styles.removeText}>Remove</Text></TouchableOpacity>
            </View>
          );
        }}
      />
      <View style={styles.checkoutBar}>
        <View>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.checkoutTotal}>Rs {formatMoney(totals.total)}</Text>
        </View>
        <TouchableOpacity onPress={onScan} style={styles.secondaryButton}><Text style={styles.secondaryText}>Scan more</Text></TouchableOpacity>
        <TouchableOpacity disabled={!cart.length || hasInvalidStock} onPress={onPay} style={[styles.payButton, (!cart.length || hasInvalidStock) && styles.payDisabled]}><Text style={styles.payText}>Pay</Text></TouchableOpacity>
      </View>
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  backButton: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.md },
  backText: { color: colors.primaryDark, fontWeight: "900" },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  cartButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 48, justifyContent: "center", width: 48 },
  cartText: { color: "#fff", fontWeight: "900" },
  scanWrap: { flex: 1 },
  camera: { borderRadius: 8, flex: 1, overflow: "hidden" },
  scanOverlay: { alignItems: "center", flex: 1, justifyContent: "center" },
  scanFrame: { borderColor: "#fff", borderRadius: 8, borderWidth: 3, height: 220, width: 220 },
  scanHint: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, color: "#fff", fontWeight: "900", marginTop: spacing.md, padding: spacing.sm },
  scanActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  permissionBox: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, padding: spacing.md },
  section: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
  secondaryButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.sm },
  secondaryText: { color: colors.primaryDark, fontWeight: "900" },
  cartLine: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.md },
  cartInvalid: { borderColor: colors.danger },
  cartInfo: { marginBottom: spacing.sm },
  cartName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  cartMeta: { color: colors.muted, marginTop: 4 },
  qty: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  qtyButton: { alignItems: "center", backgroundColor: colors.background, borderRadius: 8, height: 42, justifyContent: "center", width: 42 },
  qtyText: { color: colors.primary, fontSize: 22, fontWeight: "900" },
  qtyValue: { color: colors.text, fontWeight: "900", minWidth: 28, textAlign: "center" },
  removeButton: { alignItems: "center", minHeight: 42, justifyContent: "center", position: "absolute", right: spacing.md, top: spacing.md },
  removeText: { color: colors.danger, fontWeight: "900" },
  checkoutBar: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.sm },
  checkoutTotal: { color: colors.text, fontSize: 18, fontWeight: "900" },
  payButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.lg },
  payDisabled: { backgroundColor: colors.muted },
  payText: { color: "#fff", fontWeight: "900" },
  totalPanel: { backgroundColor: colors.secondary, borderRadius: 8, marginBottom: spacing.md, padding: spacing.md },
  totalLabel: { color: colors.muted, fontWeight: "800" },
  totalValue: { color: "#fff", fontSize: 32, fontWeight: "900" },
  chips: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  chip: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 48, justifyContent: "center" },
  chipActive: { backgroundColor: colors.tealSoft, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "900" },
  chipTextActive: { color: colors.primaryDark },
  qrPanel: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.lg },
  invoice: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  invoiceShop: { color: colors.text, fontSize: 24, fontWeight: "900" },
  invoiceMeta: { color: colors.muted, marginTop: 4 },
  invoiceRow: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  invoiceInfo: { flex: 1, paddingRight: spacing.sm },
  invoiceName: { color: colors.text, fontWeight: "900" },
  invoiceAmount: { color: colors.text, fontWeight: "900" },
  invoiceTotal: { borderTopColor: colors.border, borderTopWidth: 1, marginTop: spacing.sm, paddingTop: spacing.sm },
  newSaleButton: { alignItems: "center", minHeight: 48, justifyContent: "center", marginTop: spacing.sm },
  newSaleText: { color: colors.primaryDark, fontWeight: "900" },
  sheetBackdrop: { backgroundColor: "rgba(0,0,0,0.35)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: spacing.md },
  cancelButton: { alignItems: "center", minHeight: 48, justifyContent: "center", marginTop: spacing.sm },
  cancelText: { color: colors.muted, fontWeight: "900" },
  outText: { color: colors.danger, fontWeight: "900", marginTop: 4 },
});
