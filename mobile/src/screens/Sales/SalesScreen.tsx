import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMemo, useState } from "react";
import { Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { createOrder, getCustomers, getOrders, getProducts, Product, scanProduct } from "../../services/api";

type CartLine = { product: Product; qty: number };
type DatePreset = "today" | "week" | "month";

export default function SalesScreen() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [discount, setDiscount] = useState("0");
  const [gst, setGst] = useState("0");
  const [customer, setCustomer] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [scanOpen, setScanOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
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
  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    return (products.data || []).filter((item) => {
      const searchable = `${item.name} ${item.sku || ""} ${typeof item.category === "object" ? item.category?.name || "" : ""}`.toLowerCase();
      return !keyword || searchable.includes(keyword);
    });
  }, [productSearch, products.data]);
  const total = Math.max(subtotal - Number(discount || 0) + Number(gst || 0), 0);
  const save = useMutation({
    mutationFn: () => createOrder({ customer: customer || undefined, discount: Number(discount || 0), gst: Number(gst || 0), paymentStatus: "paid", items: cart.map((line) => ({ product: line.product._id, qty: line.qty })) }),
    onSuccess: () => {
      setCart([]);
      setCartOpen(false);
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
    setCartOpen(true);
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

  function closeCart() {
    setCart([]);
    setCartOpen(false);
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>BILLING COUNTER</Text>
            <Text style={styles.title}>Sales</Text>
          </View>
          <View style={styles.invoiceBadge}>
            <Text style={styles.invoiceBadgeValue}>{itemCount}</Text>
            <Text style={styles.invoiceBadgeLabel}>items in cart</Text>
          </View>
        </View>

        {/* Invoice Total Banner */}
        <View style={styles.totalBanner}>
          <Text style={styles.totalLabel}>Invoice total</Text>
          <Text style={styles.totalValue}>Rs {formatMoney(total)}</Text>
          <Text style={styles.totalHint}>Subtotal Rs {formatMoney(subtotal)} | Discount Rs {formatMoney(Number(discount || 0))} | GST Rs {formatMoney(Number(gst || 0))}</Text>
        </View>

        {/* Product Picker Panel */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.sectionTitle}>Product Picker</Text>
              <Text style={styles.sectionHint}>Tap an item to add to cart</Text>
            </View>
            <View style={styles.productHeaderActions}>
              <TouchableOpacity onPress={() => setProductPickerOpen(true)} style={styles.viewButton}>
                <Ionicons color="#ffffff" name="search" size={14} style={{ marginRight: 4 }} />
                <Text style={styles.viewButtonText}>Browse</Text>
              </TouchableOpacity>
              <Badge label={String(products.data?.length || 0)} tone="neutral" />
            </View>
          </View>
          <TouchableOpacity onPress={() => setScanOpen(true)} style={styles.scanButton}>
            <Ionicons color={colors.primary} name="scan-outline" size={18} style={{ marginRight: 6 }} />
            <Text style={styles.scanButtonText}>Scan Barcode to Add</Text>
          </TouchableOpacity>
          <FlatList
            data={products.data || []}
            horizontal
            keyExtractor={(item) => item._id}
            ListEmptyComponent={<Empty icon="cube-outline" text="No products available." />}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => add(item)} style={styles.productCard}>
                {item.images?.[0] ? (
                  <Image source={{ uri: item.images[0] }} style={styles.productImage} />
                ) : (
                  <View style={styles.productInitial}>
                    <Text style={styles.productInitialText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                )}
                <Text numberOfLines={2} style={styles.productName}>{item.name}</Text>
                <Text style={styles.productPrice}>Rs {formatMoney(item.price)}</Text>
                <Text style={item.stockQty <= item.lowStockThreshold ? styles.stockLow : styles.stockOk}>
                  {item.stockQty} in stock
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Cart Panel */}
        {cart.length > 0 && cartOpen && (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.sectionTitle}>Current Cart</Text>
                <Text style={styles.sectionHint}>Adjust quantities before saving invoice</Text>
              </View>
              <View style={styles.cartHeaderActions}>
                <Badge label={`${cart.length} lines`} tone="info" />
                <TouchableOpacity onPress={closeCart} style={styles.cartCloseButton}>
                  <Ionicons color={colors.text} name="close" size={18} />
                </TouchableOpacity>
              </View>
            </View>
            {cart.map((line) => (
              <View key={line.product._id} style={styles.cartLine}>
                <View style={styles.cartInfo}>
                  <Text numberOfLines={1} style={styles.cartText}>{line.product.name}</Text>
                  <Text style={styles.cartMeta}>Rs {formatMoney(line.product.price)} × {line.qty}</Text>
                </View>
                <View style={styles.qty}>
                  <TouchableOpacity onPress={() => setCart((items) => items.map((x) => x.product._id === line.product._id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))} style={styles.qtyButton}>
                    <Ionicons color={colors.primary} name="remove" size={16} />
                  </TouchableOpacity>
                  <Text style={styles.qtyValue}>{line.qty}</Text>
                  <TouchableOpacity onPress={() => add(line.product)} style={styles.qtyButton}>
                    <Ionicons color={colors.primary} name="add" size={16} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Customer & Totals Panel */}
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => setTotalsOpen((value) => !value)} style={styles.panelHeader}>
            <View>
              <Text style={styles.sectionTitle}>Customer & Totals</Text>
              <Text style={styles.sectionHint}>{totalsOpen ? "Optional customer & discount settings" : "Tap to set customer, discount, GST"}</Text>
            </View>
            <Ionicons color={colors.primary} name={totalsOpen ? "chevron-up" : "chevron-down"} size={20} />
          </TouchableOpacity>
          {totalsOpen && (
            <>
              <FlatList
                data={customers.data || []}
                horizontal
                keyExtractor={(item) => item._id}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => setCustomer(item._id)} style={[styles.chip, customer === item._id && styles.chipActive]}>
                    <Text style={[styles.chipText, customer === item._id && styles.chipTextActive]}>{item.name}</Text>
                  </TouchableOpacity>
                )}
              />
              <View style={styles.inputRow}>
                <View style={styles.inputHalf}><Field keyboardType="numeric" onChangeText={setDiscount} placeholder="Discount (Rs)" value={discount} /></View>
                <View style={styles.inputHalf}><Field keyboardType="numeric" onChangeText={setGst} placeholder="GST (Rs)" value={gst} /></View>
              </View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>Rs {formatMoney(subtotal)}</Text></View>
              <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Grand Total</Text><Text style={styles.summaryStrong}>Rs {formatMoney(total)}</Text></View>
              <Button icon="checkmark-circle-outline" loading={save.isPending} onPress={() => cart.length ? save.mutate() : Alert.alert("Cart is empty")} title="Save Invoice" />
            </>
          )}
        </View>

        {/* Date-wise Invoices List */}
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.sectionTitle}>Date-wise Invoices</Text>
              <Text style={styles.sectionHint}>Filter sales history by invoice date</Text>
            </View>
            <Badge label={String(orders.data?.length || 0)} tone="neutral" />
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
                <Text style={styles.orderMeta}>{new Date(order.createdAt).toLocaleDateString()} | {order.items?.length || 0} line items</Text>
              </View>
              <Text style={styles.orderTotal}>Rs {formatMoney(order.total)}</Text>
            </View>
          )) : <Empty icon="receipt-outline" text={orders.isLoading ? "Loading invoices..." : "No invoices for this filter."} />}
        </View>
      </ScrollView>

      {/* Floating Action Button for Quick Sale */}
      <TouchableOpacity onPress={() => navigation.navigate("QuickSale")} style={styles.fab}>
        <Ionicons color="#ffffff" name="flash" size={18} style={{ marginRight: 6 }} />
        <Text style={styles.fabText}>Quick Sale</Text>
      </TouchableOpacity>

      {/* Barcode Scanner Modal */}
      <Modal animationType="slide" visible={scanOpen}>
        <Screen>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>CART SCANNER</Text>
              <Text style={styles.title}>Scan Barcode</Text>
            </View>
            <TouchableOpacity onPress={() => setScanOpen(false)} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={20} />
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
              <Text style={styles.sectionTitle}>Camera Access Needed</Text>
              <Button onPress={() => requestPermission()} title="Allow Camera" />
            </View>
          )}
        </Screen>
      </Modal>

      {/* Product Browser Modal */}
      <Modal animationType="slide" visible={productPickerOpen}>
        <Screen>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>PRODUCT BROWSER</Text>
              <Text style={styles.title}>Add Items</Text>
            </View>
            <TouchableOpacity onPress={() => setProductPickerOpen(false)} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={20} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchPanel}>
            <Field onChangeText={setProductSearch} placeholder="Search product name, SKU, or category" value={productSearch} />
            <View style={styles.searchMetaRow}>
              <Text style={styles.searchMeta}>{filteredProducts.length} items found</Text>
              <Text style={styles.searchMeta}>{itemCount} items in cart</Text>
            </View>
          </View>
          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.productListContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Empty icon="cube-outline" text={products.isLoading ? "Loading products..." : "No matching products."} />}
            renderItem={({ item }) => {
              const line = cart.find((row) => row.product._id === item._id);
              return (
                <View style={styles.productRow}>
                  {item.images?.[0] ? (
                    <Image source={{ uri: item.images[0] }} style={styles.productRowImage} />
                  ) : (
                    <View style={styles.productRowInitial}>
                      <Text style={styles.productInitialText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.productRowInfo}>
                    <Text numberOfLines={1} style={styles.productRowName}>{item.name}</Text>
                    <Text numberOfLines={1} style={styles.productRowMeta}>{item.sku || "No SKU"} | Rs {formatMoney(item.price)}</Text>
                    <Text style={item.stockQty <= item.lowStockThreshold ? styles.stockLow : styles.stockOk}>
                      {item.stockQty} in stock{line ? ` | Cart: ${line.qty}` : ""}
                    </Text>
                  </View>
                  <Button icon="add-circle-outline" onPress={() => add(item)} style={{ minHeight: 40, paddingHorizontal: 12 }} title="Add" />
                </View>
              );
            }}
          />
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
  container: { paddingBottom: 90 },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, marginTop: 2 },
  invoiceBadge: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, minWidth: 70, padding: spacing.xs, ...shadows.card },
  invoiceBadgeValue: { color: colors.primary, fontSize: 18, fontWeight: "700" },
  invoiceBadgeLabel: { color: colors.muted, fontSize: 10, fontWeight: "600" },

  totalBanner: { backgroundColor: colors.secondary, borderRadius: radius.md, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  totalLabel: { color: colors.blueSoft, fontWeight: "600", fontSize: 13 },
  totalValue: { color: "#ffffff", fontSize: 30, fontWeight: "700", marginTop: 2 },
  totalHint: { color: colors.blueSoft, fontSize: 12, marginTop: spacing.xs },

  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  panelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  productHeaderActions: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  viewButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, flexDirection: "row", height: 36, justifyContent: "center", paddingHorizontal: spacing.sm },
  viewButtonText: { color: "#ffffff", fontSize: 12, fontWeight: "600" },
  cartHeaderActions: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  cartCloseButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 32, justifyContent: "center", width: 32 },

  sectionTitle: { color: colors.text, ...typography.h3 },
  sectionHint: { color: colors.muted, fontSize: 12, fontWeight: "500", marginTop: 2 },

  scanButton: { alignItems: "center", backgroundColor: colors.primaryLight, borderColor: colors.primary, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", height: 44, justifyContent: "center", marginBottom: spacing.sm },
  scanButtonText: { color: colors.primary, fontWeight: "600" },

  productCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, height: 160, marginRight: spacing.sm, padding: spacing.sm, width: 140, ...shadows.card },
  productInitial: { alignItems: "center", backgroundColor: colors.primaryLight, borderRadius: radius.sm, height: 50, justifyContent: "center", marginBottom: spacing.xs, width: "100%" },
  productImage: { borderRadius: radius.sm, height: 50, marginBottom: spacing.xs, width: "100%" },
  productInitialText: { color: colors.primary, fontWeight: "700" },
  productName: { color: colors.text, fontSize: 13, fontWeight: "600", minHeight: 34 },
  productPrice: { color: colors.text, fontSize: 14, fontWeight: "700", marginTop: 2 },
  stockOk: { color: colors.success, fontSize: 11, fontWeight: "600", marginTop: 2 },
  stockLow: { color: colors.danger, fontSize: 11, fontWeight: "600", marginTop: 2 },

  cartLine: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  cartInfo: { flex: 1, paddingRight: spacing.sm },
  cartText: { color: colors.text, fontWeight: "600" },
  cartMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  qty: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  qtyButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 36, justifyContent: "center", width: 36 },
  qtyValue: { color: colors.text, fontWeight: "700", minWidth: 24, textAlign: "center" },

  chip: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginBottom: spacing.sm, marginRight: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  chipText: { color: colors.text, fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: colors.primary, fontWeight: "700" },

  inputRow: { flexDirection: "row", gap: spacing.sm },
  inputHalf: { flex: 1 },
  summaryRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  summaryLabel: { color: colors.muted, fontSize: 14, fontWeight: "500" },
  summaryValue: { color: colors.text, fontSize: 14, fontWeight: "600" },
  summaryStrong: { color: colors.primary, fontSize: 18, fontWeight: "700" },

  filterRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  filterChip: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 6 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  filterChipTextActive: { color: "#ffffff" },

  orderRow: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  orderTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  orderMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  orderTotal: { color: colors.primary, fontSize: 15, fontWeight: "700" },

  fab: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.pill, bottom: spacing.md, flexDirection: "row", minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.lg, position: "absolute", right: spacing.md, ...shadows.floating },
  fabText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },

  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  closeButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 40, justifyContent: "center", width: 40 },
  camera: { borderRadius: radius.md, flex: 1, overflow: "hidden" },
  scanOverlay: { alignItems: "center", flex: 1, justifyContent: "center" },
  scanFrame: { borderColor: "#ffffff", borderRadius: radius.md, borderWidth: 3, height: 220, width: 220 },
  scanHint: { backgroundColor: "rgba(15, 23, 42, 0.65)", borderRadius: radius.sm, color: "#ffffff", fontWeight: "600", marginTop: spacing.md, padding: spacing.sm },

  searchPanel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  searchMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  searchMeta: { color: colors.muted, fontSize: 12, fontWeight: "500" },
  productListContent: { paddingBottom: spacing.xl },
  productRow: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing.sm, marginBottom: spacing.xs, padding: spacing.sm },
  productRowImage: { borderRadius: radius.sm, height: 50, width: 50 },
  productRowInitial: { alignItems: "center", backgroundColor: colors.primaryLight, borderRadius: radius.sm, height: 50, justifyContent: "center", width: 50 },
  productRowInfo: { flex: 1 },
  productRowName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  productRowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
