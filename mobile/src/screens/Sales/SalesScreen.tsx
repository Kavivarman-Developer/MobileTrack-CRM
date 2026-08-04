import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMemo, useState } from "react";
import { Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
import { createOrder, getCustomers, getOrders, getProducts, Product, scanProduct } from "../../services/api";

type CartLine = { product: Product; qty: number };
type DatePreset = "today" | "week" | "month";

export default function SalesScreen() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [gst, setGst] = useState("0");
  const [customer, setCustomer] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [scanOpen, setScanOpen] = useState(false);
  const [totalsOpen, setTotalsOpen] = useState(false);
  const [lastScan, setLastScan] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);
  const products = useQuery({ queryKey: ["products", ""], queryFn: () => getProducts("") });
  const customers = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
  const orders = useQuery({ queryKey: ["orders", dateRange], queryFn: () => getOrders(dateRange) });
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.product.price * line.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.qty, 0), [cart]);
  const total = Math.max(subtotal - Number(discount || 0) + Number(gst || 0), 0);
  const save = useMutation({
    mutationFn: () => createOrder({ customer: customer || undefined, discount: Number(discount || 0), gst: Number(gst || 0), paymentStatus: "paid", items: cart.map((line) => ({ product: line.product._id, qty: line.qty })) }),
    onSuccess: () => {
      setCart([]);
      setTotalsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      Alert.alert("Invoice saved", `Total: Rs ${total}`);
    },
    onError: (error: Error) => Alert.alert("Invoice failed", error.message),
  });
  const scanner = useMutation({
    mutationFn: scanProduct,
    onSuccess: (product) => {
      add(product);
      setScanOpen(false);
      Alert.alert("Added to cart", product.name);
    },
    onError: (error: Error) => Alert.alert("Scan failed", error.message),
  });

  function add(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.product._id === product._id);
      if (existing) return current.map((line) => line.product._id === product._id ? { ...line, qty: line.qty + 1 } : line);
      return [...current, { product, qty: 1 }];
    });
  }

  function handleScan(code: string) {
    if (!code || code === lastScan || scanner.isPending) return;
    setLastScan(code);
    scanner.mutate(code);
    setTimeout(() => setLastScan(""), 1200);
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Billing counter</Text>
            <Text style={styles.title}>Sales</Text>
          </View>
          <View style={styles.invoiceBadge}>
            <Text style={styles.invoiceBadgeValue}>{itemCount}</Text>
            <Text style={styles.invoiceBadgeLabel}>items</Text>
          </View>
        </View>
        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>Invoice total</Text>
          <Text style={styles.totalValue}>Rs {formatMoney(total)}</Text>
          <Text style={styles.totalHint}>Subtotal Rs {formatMoney(subtotal)} | Discount Rs {formatMoney(Number(discount || 0))} | GST Rs {formatMoney(Number(gst || 0))}</Text>
        </View>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.section}>Product picker</Text>
              <Text style={styles.sectionHint}>Tap an item to add it to cart</Text>
            </View>
            <Text style={styles.panelPill}>{products.data?.length || 0}</Text>
          </View>
          <TouchableOpacity onPress={() => setScanOpen(true)} style={styles.scanButton}>
            <Text style={styles.scanButtonText}>Scan to Add</Text>
          </TouchableOpacity>
          <FlatList
            data={products.data || []}
            horizontal
            keyExtractor={(item) => item._id}
            ListEmptyComponent={<Empty text="No products available." />}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => add(item)} style={styles.product}>
                {item.images?.[0] ? (
                  <Image source={{ uri: item.images[0] }} style={styles.productImage} />
                ) : (
                  <View style={styles.productInitial}>
                    <Text style={styles.productInitialText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>Rs {formatMoney(item.price)}</Text>
                <Text style={item.stockQty <= item.lowStockThreshold ? styles.stockLow : styles.stockOk}>{item.stockQty} in stock</Text>
              </TouchableOpacity>
            )}
          />
        </View>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.section}>Cart</Text>
              <Text style={styles.sectionHint}>Adjust quantity before billing</Text>
            </View>
            <Text style={styles.panelPill}>{cart.length}</Text>
          </View>
          {cart.length ? cart.map((line) => (
            <View key={line.product._id} style={styles.cartLine}>
              <View style={styles.cartInfo}>
                <Text numberOfLines={1} style={styles.cartText}>{line.product.name}</Text>
                <Text style={styles.cartMeta}>Rs {formatMoney(line.product.price)} x {line.qty}</Text>
              </View>
              <View style={styles.qty}>
                <TouchableOpacity onPress={() => setCart((items) => items.map((x) => x.product._id === line.product._id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))} style={styles.qtyButton}><Text style={styles.qtyButtonText}>-</Text></TouchableOpacity>
                <Text style={styles.qtyValue}>{line.qty}</Text>
                <TouchableOpacity onPress={() => add(line.product)} style={styles.qtyButton}><Text style={styles.qtyButtonText}>+</Text></TouchableOpacity>
              </View>
            </View>
          )) : <Empty text="Tap products to build an invoice." />}
        </View>
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => setTotalsOpen((value) => !value)} style={styles.panelHeader}>
            <View>
              <Text style={styles.section}>Customer & totals</Text>
              <Text style={styles.sectionHint}>{totalsOpen ? "Optional customer selection" : "Tap to add discount, GST, customer"}</Text>
            </View>
            <Text style={styles.expandIcon}>{totalsOpen ? "x" : "+"}</Text>
          </TouchableOpacity>
          {totalsOpen && (
            <>
              <FlatList
                data={customers.data || []}
                horizontal
                keyExtractor={(item) => item._id}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => <TouchableOpacity onPress={() => setCustomer(item._id)} style={[styles.chip, customer === item._id && styles.chipActive]}><Text style={[styles.chipText, customer === item._id && styles.chipTextActive]}>{item.name}</Text></TouchableOpacity>}
              />
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}><Field keyboardType="numeric" onChangeText={setDiscount} placeholder="Discount" value={discount} /></View>
                <View style={styles.inputHalf}><Field keyboardType="numeric" onChangeText={setGst} placeholder="GST" value={gst} /></View>
              </View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>Rs {formatMoney(subtotal)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Total</Text><Text style={styles.summaryStrong}>Rs {formatMoney(total)}</Text></View>
              <Button loading={save.isPending} onPress={() => cart.length ? save.mutate() : Alert.alert("Cart is empty")} title="Save invoice" />
            </>
          )}
        </View>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.section}>Date-wise invoices</Text>
              <Text style={styles.sectionHint}>Filter sales by invoice date</Text>
            </View>
            <Text style={styles.panelPill}>{orders.data?.length || 0}</Text>
          </View>
          <View style={styles.filterRow}>
            <FilterChip active={datePreset === "today"} label="Today" onPress={() => setDatePreset("today")} />
            <FilterChip active={datePreset === "week"} label="7 Days" onPress={() => setDatePreset("week")} />
            <FilterChip active={datePreset === "month"} label="Month" onPress={() => setDatePreset("month")} />
          </View>
          {orders.data?.length ? orders.data.slice(0, 8).map((order) => (
            <View key={order._id} style={styles.orderRow}>
              <View>
                <Text style={styles.orderTitle}>{order.customer?.name || "Walk-in customer"}</Text>
                <Text style={styles.orderMeta}>{new Date(order.createdAt).toLocaleDateString()} | {order.items?.length || 0} lines</Text>
              </View>
              <Text style={styles.orderTotal}>Rs {formatMoney(order.total)}</Text>
            </View>
          )) : <Empty text={orders.isLoading ? "Loading invoices..." : "No invoices for this date filter."} />}
        </View>
      </ScrollView>
      <TouchableOpacity onPress={() => navigation.navigate("QuickSale")} style={styles.fab}>
        <Text style={styles.fabText}>Quick Sale</Text>
      </TouchableOpacity>
      <Modal animationType="slide" visible={scanOpen}>
        <Screen>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Cart scanner</Text>
              <Text style={styles.title}>Scan Product</Text>
            </View>
            <TouchableOpacity onPress={() => setScanOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>x</Text>
            </TouchableOpacity>
          </View>
          {permission?.granted ? (
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "code128", "upc_a", "upc_e"] } as any}
              onBarcodeScanned={(event: any) => handleScan(event.data)}
            >
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>{scanner.isPending ? "Adding product..." : "Point camera at barcode"}</Text>
              </View>
            </CameraView>
          ) : (
            <View style={styles.panel}>
              <Text style={styles.section}>Camera access needed</Text>
              <Button onPress={() => requestPermission()} title="Allow camera" />
            </View>
          )}
        </Screen>
      </Modal>
    </Screen>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function getDateRange(preset: DatePreset) {
  const now = new Date();
  const from = new Date(now);
  if (preset === "today") from.setHours(0, 0, 0, 0);
  if (preset === "week") from.setDate(now.getDate() - 6);
  if (preset === "month") from.setDate(1);
  return { dateFrom: from.toISOString(), dateTo: now.toISOString() };
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 2 },
  invoiceBadge: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, minWidth: 62, padding: spacing.sm },
  invoiceBadgeValue: { color: colors.primaryDark, fontSize: 20, fontWeight: "900" },
  invoiceBadgeLabel: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  totalBanner: { backgroundColor: colors.secondary, borderRadius: 8, marginBottom: spacing.md, padding: spacing.md },
  totalLabel: { color: colors.blueSoft, fontWeight: "800" },
  totalValue: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 2 },
  totalHint: { color: colors.blueSoft, fontSize: 12, marginTop: spacing.xs },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  panelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  expandIcon: { color: colors.primaryDark, fontSize: 24, fontWeight: "900", minWidth: 34, textAlign: "center" },
  section: { color: colors.text, fontSize: 18, fontWeight: "900" },
  sectionHint: { color: colors.muted, fontSize: 12, marginTop: 3 },
  panelPill: { backgroundColor: colors.background, borderRadius: 999, color: colors.primaryDark, fontWeight: "900", minWidth: 34, overflow: "hidden", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, textAlign: "center" },
  scanButton: { alignItems: "center", backgroundColor: colors.background, borderColor: colors.primary, borderRadius: 8, borderWidth: 1, minHeight: 48, justifyContent: "center", marginBottom: spacing.sm },
  scanButtonText: { color: colors.primaryDark, fontWeight: "900" },
  product: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 158, marginRight: spacing.sm, padding: spacing.md, width: 150 },
  productInitial: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: 8, height: 38, justifyContent: "center", marginBottom: spacing.sm, width: 38 },
  productImage: { borderRadius: 8, height: 58, marginBottom: spacing.sm, width: "100%" },
  productInitialText: { color: colors.primaryDark, fontWeight: "900" },
  productName: { color: colors.text, fontWeight: "900", minHeight: 38 },
  productPrice: { color: colors.text, fontSize: 16, fontWeight: "900", marginTop: spacing.xs },
  stockOk: { color: colors.success, fontSize: 12, fontWeight: "800", marginTop: 4 },
  stockLow: { color: colors.danger, fontSize: 12, fontWeight: "800", marginTop: 4 },
  cartLine: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  cartInfo: { flex: 1, paddingRight: spacing.sm },
  cartText: { color: colors.text, fontWeight: "900" },
  cartMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  qty: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  qtyButton: { alignItems: "center", backgroundColor: colors.background, borderRadius: 8, height: 34, justifyContent: "center", width: 34 },
  qtyButtonText: { color: colors.primary, fontSize: 20, fontWeight: "900", marginTop: -2 },
  qtyValue: { color: colors.text, fontWeight: "900", minWidth: 22, textAlign: "center" },
  chip: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.sm, marginRight: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipActive: { backgroundColor: colors.tealSoft, borderColor: colors.primary },
  chipText: { color: colors.text, fontWeight: "800" },
  chipTextActive: { color: colors.primaryDark },
  inputRow: { flexDirection: "row", gap: spacing.sm },
  inputHalf: { flex: 1 },
  summaryRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  summaryLabel: { color: colors.muted, fontWeight: "800" },
  summaryValue: { color: colors.text, fontWeight: "900" },
  summaryStrong: { color: colors.primaryDark, fontSize: 20, fontWeight: "900" },
  filterRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  filterChip: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  filterChipActive: { backgroundColor: colors.tealSoft, borderColor: colors.primary },
  filterChipText: { color: colors.text, fontWeight: "800" },
  filterChipTextActive: { color: colors.primaryDark },
  orderRow: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  orderTitle: { color: colors.text, fontWeight: "900" },
  orderMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  orderTotal: { color: colors.primaryDark, fontWeight: "900" },
  fab: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, bottom: spacing.md, minHeight: 52, justifyContent: "center", paddingHorizontal: spacing.lg, position: "absolute", right: spacing.md },
  fabText: { color: "#fff", fontWeight: "900" },
  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  closeButtonText: { color: colors.text, fontSize: 18, fontWeight: "900" },
  camera: { borderRadius: 8, flex: 1, overflow: "hidden" },
  scanOverlay: { alignItems: "center", flex: 1, justifyContent: "center" },
  scanFrame: { borderColor: "#fff", borderRadius: 8, borderWidth: 3, height: 220, width: 220 },
  scanHint: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, color: "#fff", fontWeight: "900", marginTop: spacing.md, padding: spacing.sm },
});
