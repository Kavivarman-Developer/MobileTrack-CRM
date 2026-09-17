import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMemo, useState } from "react";
import { Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, FabButton, Field, IconButton, IosScreenHeader, IosSearchBar, PageHeader, Screen, SearchField, SelectOption, StatStrip } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, radius, spacing } from "../../constants/theme";
import { apiErrorMessage, createOrder, getCustomers, getOrders, getProducts, Product, scanProduct } from "../../services/api";

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
  const periodSales = useMemo(() => (orders.data || []).reduce((sum, order) => sum + Number(order.total || 0), 0), [orders.data]);

  const save = useMutation({
    mutationFn: () => createOrder({ customer: customer || undefined, discount: Number(discount || 0), gst: Number(gst || 0), paymentStatus: "paid", items: cart.map((line) => ({ product: line.product._id, qty: line.qty })) }),
    onSuccess: () => {
      setCart([]);
      setCartOpen(false);
      setTotalsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      Alert.alert("Invoice saved", `Total: ₹${formatMoney(total)}`);
    },
    onError: (error: Error) => Alert.alert("Invoice failed", apiErrorMessage(error)),
  });
  const scanner = useMutation({
    mutationFn: scanProduct,
    onSuccess: (product) => {
      add(product);
      setScanOpen(false);
      Alert.alert("Added to cart", product.name);
    },
    onError: (error: Error) => Alert.alert("Scan failed", apiErrorMessage(error)),
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

  function saveInvoice() {
    if (!cart.length) {
      Alert.alert("Cart is empty", "Add a product first.");
      return;
    }
    save.mutate();
  }

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="Sales desk"
        right={(
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeValue}>{itemCount}</Text>
            <Text style={styles.cartBadgeLabel}>cart</Text>
          </View>
        )}
        title="Sales"
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <StatStrip
          items={[
            { label: "Invoice", value: `₹${formatMoney(total)}`, icon: "receipt-outline", tone: "purple" },
            { label: "Cart items", value: String(itemCount), icon: "cart-outline", tone: "blue" },
            { label: "Period sales", value: `₹${formatMoney(periodSales)}`, icon: "trending-up-outline", tone: "green" },
          ]}
        />

        <Text style={styles.sectionLabel}>Do this now</Text>
        <View style={styles.actionGrid}>
          <ActionTile color={ios.blue} ion="scan" label="Scan" onPress={() => setScanOpen(true)} />
          <ActionTile color={ios.green} ion="search" label="Browse" onPress={() => setProductPickerOpen(true)} />
          <ActionTile color={ios.orange} ion="flash" label="Quick sale" onPress={() => navigation.navigate("QuickSale")} />
          <ActionTile color={ios.indigo} ion="people" label="Customer" onPress={() => setTotalsOpen(true)} />
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabelInline}>Quick add</Text>
          <Text style={styles.listCount}>{products.data?.length || 0}</Text>
        </View>
        <IosSearchBar
          onChangeText={setProductSearch}
          placeholder="Search products…"
          style={styles.quickSearch}
          value={productSearch}
        />
        {(filteredProducts.slice(0, 12).length ? filteredProducts.slice(0, 12) : []).length ? (
          filteredProducts.slice(0, 12).map((item) => {
            const line = cart.find((row) => row.product._id === item._id);
            return (
              <SelectOption
                key={item._id}
                label={item.name}
                meta={`₹${formatMoney(item.price)} · ${item.stockQty} left${line ? ` · Cart ${line.qty}` : ""}`}
                onPress={() => add(item)}
                selected={Boolean(line)}
              />
            );
          })
        ) : (
          <View style={styles.emptyInline}>
            <Text style={styles.emptyInlineText}>{products.isLoading ? "Loading…" : "No products"}</Text>
          </View>
        )}

        {cart.length > 0 && cartOpen && (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabelInline}>Current cart</Text>
              <TouchableOpacity onPress={closeCart} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>Clear</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.cartCard}>
              {cart.map((line, index) => (
                <View key={line.product._id} style={[styles.cartLine, index < cart.length - 1 && styles.cartLineBorder]}>
                  <View style={styles.cartInfo}>
                    <Text numberOfLines={1} style={styles.cartText}>{line.product.name}</Text>
                    <Text style={styles.cartMeta}>₹{formatMoney(line.product.price)} × {line.qty}</Text>
                  </View>
                  <View style={styles.qty}>
                    <TouchableOpacity
                      onPress={() => setCart((items) => items.map((x) => x.product._id === line.product._id ? { ...x, qty: Math.max(1, x.qty - 1) } : x))}
                      style={styles.qtyButton}
                    >
                      <Ionicons color={ios.label} name="remove" size={16} />
                    </TouchableOpacity>
                    <Text style={styles.qtyValue}>{line.qty}</Text>
                    <TouchableOpacity onPress={() => add(line.product)} style={styles.qtyButton}>
                      <Ionicons color={ios.label} name="add" size={16} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <TouchableOpacity onPress={() => setTotalsOpen((value) => !value)} style={styles.collapseCard}>
          <View style={styles.collapseCopy}>
            <Text style={styles.collapseTitle}>Customer & totals</Text>
            <Text style={styles.collapseHint}>{totalsOpen ? "Discount, GST, customer" : "Tap to edit"}</Text>
          </View>
          <Ionicons color={ios.secondary} name={totalsOpen ? "chevron-up" : "chevron-down"} size={18} />
        </TouchableOpacity>
        {totalsOpen && (
          <View style={styles.totalsCard}>
            {(customers.data || []).map((item) => (
              <SelectOption
                key={item._id}
                label={item.name}
                meta={item.phone || "Customer"}
                onPress={() => setCustomer(item._id)}
                selected={customer === item._id}
              />
            ))}
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}><Field keyboardType="numeric" onChangeText={setDiscount} placeholder="Discount (₹)" value={discount} /></View>
              <View style={styles.inputHalf}><Field keyboardType="numeric" onChangeText={setGst} placeholder="GST (₹)" value={gst} /></View>
            </View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Subtotal</Text><Text style={styles.summaryValue}>₹{formatMoney(subtotal)}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Grand total</Text><Text style={styles.summaryStrong}>₹{formatMoney(total)}</Text></View>
            <TouchableOpacity onPress={saveInvoice} style={styles.saveBtn}>
              <Text style={styles.saveBtnText}>{save.isPending ? "Saving…" : "Save invoice"}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.sectionHead}>
          <Text style={styles.sectionLabelInline}>Recent invoices</Text>
          <Text style={styles.listCount}>{orders.data?.length || 0}</Text>
        </View>
        <View style={styles.segment}>
          {([
            ["today", "Today"],
            ["week", "7 days"],
            ["month", "Month"],
          ] as [DatePreset, string][]).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setDatePreset(key)}
              style={[styles.segmentItem, datePreset === key && styles.segmentItemOn]}
            >
              <Text style={[styles.segmentText, datePreset === key && styles.segmentTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.periodSales}>₹{formatMoney(periodSales)} in this period</Text>

        {orders.data?.length ? (
          <View style={styles.invoiceList}>
            {orders.data.slice(0, 8).map((order) => (
              <View key={order._id} style={styles.invoiceCard}>
                <View style={styles.invoiceIcon}>
                  <Ionicons color={ios.blue} name="receipt" size={16} />
                </View>
                <View style={styles.invoiceCopy}>
                  <Text numberOfLines={1} style={styles.invoiceTitle}>{order.customer?.name || "Walk-in customer"}</Text>
                  <Text style={styles.invoiceMeta}>
                    {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · {order.items?.length || 0} lines
                  </Text>
                </View>
                <Text style={styles.invoiceTotal}>₹{formatMoney(order.total)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>{orders.isLoading ? "Loading invoices…" : "No invoices yet"}</Text>
            <Text style={styles.emptyText}>{orders.isLoading ? "Just a moment." : "Save a bill to see it here."}</Text>
          </View>
        )}
      </ScrollView>

      <FabButton accessibilityLabel="Browse products" onPress={() => setProductPickerOpen(true)} />

      <Modal animationType="slide" visible={scanOpen}>
        <Screen>
          <PageHeader
            eyebrow="Cart scanner"
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setScanOpen(false)} />}
            title="Scan Barcode"
          />
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
            <View style={styles.permissionCard}>
              <Text style={styles.collapseTitle}>Camera access needed</Text>
              <Button onPress={() => requestPermission()} title="Allow Camera" />
            </View>
          )}
        </Screen>
      </Modal>

      <Modal animationType="slide" visible={productPickerOpen}>
        <Screen>
          <PageHeader
            eyebrow="Product browser"
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setProductPickerOpen(false)} />}
            title="Add Items"
          />
          <View style={styles.searchPanel}>
            <SearchField onChangeText={setProductSearch} placeholder="Search product name, SKU, or category" value={productSearch} />
            <View style={styles.searchMetaRow}>
              <Text style={styles.searchMeta}>{filteredProducts.length} items found</Text>
              <Text style={styles.searchMeta}>{itemCount} in cart</Text>
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
                <SelectOption
                  key={item._id}
                  label={item.name}
                  meta={`${item.sku || "No SKU"} · ₹${formatMoney(item.price)} · ${item.stockQty} stock${line ? ` · Cart ${line.qty}` : ""}`}
                  onPress={() => add(item)}
                  selected={Boolean(line)}
                />
              );
            }}
          />
        </Screen>
      </Modal>
    </Screen>
  );
}

function ActionTile({
  color,
  ion,
  label,
  onPress,
}: {
  color: string;
  ion: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.actionTile}>
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        <Ionicons color="#FFFFFF" name={ion} size={20} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
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
  screen: { backgroundColor: ios.bg },
  header: { alignItems: "flex-start", flexDirection: "row", marginBottom: spacing.sm, marginTop: spacing.xxs, paddingHorizontal: spacing.md },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: 8 },
  greeting: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13 },
  title: { color: ios.label, fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.5, lineHeight: 32, marginTop: 1 },
  cartBadge: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 14,
    minWidth: 56,
    paddingHorizontal: 8,
    paddingVertical: spacing.xs,
  },
  cartBadgeValue: { color: ios.label, fontFamily: fonts.bold, fontSize: 18 },
  cartBadgeLabel: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 11 },

  content: { alignSelf: "center", maxWidth: 430, paddingBottom: 88, width: "100%" },
  quickSearch: { marginBottom: spacing.xxs },

  hero: {
    backgroundColor: ios.navy,
    borderRadius: 22,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  heroOverline: { color: "rgba(255,255,255,0.62)", fontFamily: fonts.medium, fontSize: 13 },
  heroAmount: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 40, letterSpacing: -1, lineHeight: 46, marginTop: 2 },
  heroPills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  heroPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    color: "#FFFFFF",
    fontFamily: fonts.medium,
    fontSize: 13,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroHint: { color: "rgba(255,255,255,0.5)", fontFamily: fonts.regular, fontSize: 12, marginTop: 8 },
  heroCta: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  heroCtaText: { color: ios.dark, fontFamily: fonts.semibold, fontSize: 15 },

  sectionLabel: {
    color: ios.secondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    marginBottom: spacing.xs,
    marginLeft: spacing.xxs,
    marginTop: spacing.md,
  },
  sectionHead: { alignItems: "center", flexDirection: "row", marginBottom: spacing.xs, marginLeft: spacing.xxs, marginTop: 14 },
  sectionLabelInline: { color: ios.secondary, flex: 1, fontFamily: fonts.regular, fontSize: 13 },
  listCount: {
    backgroundColor: ios.fill,
    borderRadius: 999,
    color: ios.label,
    fontFamily: fonts.semibold,
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionTile: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 18,
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 77,
    paddingVertical: spacing.md,
  },
  actionIcon: { alignItems: "center", borderRadius: 14, height: 40, justifyContent: "center", width: 40 },
  actionLabel: { color: ios.label, fontFamily: fonts.semibold, fontSize: 14, marginTop: spacing.xs },

  productStrip: { gap: 8, paddingBottom: 2 },
  productCard: {
    backgroundColor: ios.card,
    borderRadius: 16,
    padding: spacing.sm,
    width: 132,
  },
  productImage: { borderRadius: 12, height: 45, marginBottom: spacing.xs, width: "100%" },
  productInitial: {
    alignItems: "center",
    backgroundColor: `${ios.blue}14`,
    borderRadius: 12,
    height: 45,
    justifyContent: "center",
    marginBottom: spacing.xs,
    width: "100%",
  },
  productInitialText: { color: ios.blue, fontFamily: fonts.bold, fontSize: 15 },
  productName: { color: ios.label, fontFamily: fonts.semibold, fontSize: 13, minHeight: 34 },
  productPrice: { color: ios.label, fontFamily: fonts.bold, fontSize: 15, marginTop: spacing.xxs },
  stockOk: { color: ios.green, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
  stockLow: { color: ios.red, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
  emptyInline: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xs },
  emptyInlineText: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 14 },

  clearBtn: { backgroundColor: "#FF3B3014", borderRadius: 999, paddingHorizontal: 8, paddingVertical: spacing.xxs },
  clearBtnText: { color: ios.red, fontFamily: fonts.semibold, fontSize: 12 },
  cartCard: { backgroundColor: ios.card, borderRadius: 18, overflow: "hidden", paddingHorizontal: 11 },
  cartLine: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  cartLineBorder: { borderBottomColor: "rgba(60,60,67,0.12)", borderBottomWidth: StyleSheet.hairlineWidth },
  cartInfo: { flex: 1, paddingRight: 8 },
  cartText: { color: ios.label, fontFamily: fonts.semibold, fontSize: 15 },
  cartMeta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  qty: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  qtyButton: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  qtyValue: { color: ios.label, fontFamily: fonts.bold, fontSize: 15, minWidth: 20, textAlign: "center" },

  collapseCard: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 16,
    flexDirection: "row",
    marginTop: spacing.md,
    paddingHorizontal: 11,
    paddingVertical: 11,
  },
  collapseCopy: { flex: 1 },
  collapseTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 16 },
  collapseHint: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  totalsCard: { backgroundColor: ios.card, borderRadius: 16, marginTop: spacing.xs, padding: 11 },
  chipRow: { gap: spacing.xs, marginBottom: 8 },
  chip: {
    backgroundColor: ios.fill,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipOn: { backgroundColor: ios.label },
  chipText: { color: ios.label, fontFamily: fonts.medium, fontSize: 13 },
  chipTextOn: { color: "#FFFFFF" },
  inputRow: { flexDirection: "row", gap: 8 },
  inputHalf: { flex: 1 },
  summaryRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.xxs },
  summaryLabel: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 14 },
  summaryValue: { color: ios.label, fontFamily: fonts.semibold, fontSize: 14 },
  summaryStrong: { color: ios.label, fontFamily: fonts.bold, fontSize: 18 },
  saveBtn: {
    alignItems: "center",
    backgroundColor: ios.navy,
    borderRadius: 14,
    justifyContent: "center",
    marginTop: 8,
    minHeight: 40,
  },
  saveBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 15 },

  segment: { backgroundColor: ios.fill, borderRadius: 12, flexDirection: "row", padding: 3 },
  segmentItem: { alignItems: "center", borderRadius: 9, flex: 1, justifyContent: "center", minHeight: 34 },
  segmentItemOn: { backgroundColor: ios.card },
  segmentText: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13 },
  segmentTextOn: { color: ios.label, fontFamily: fonts.semibold },
  periodSales: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 13, marginBottom: 8, marginLeft: spacing.xxs, marginTop: spacing.xs },
  invoiceList: { gap: spacing.xs },
  invoiceCard: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 16,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: 11,
    paddingVertical: spacing.sm,
  },
  invoiceIcon: {
    alignItems: "center",
    backgroundColor: `${ios.blue}14`,
    borderRadius: 12,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  invoiceCopy: { flex: 1, minWidth: 0 },
  invoiceTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 15 },
  invoiceMeta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  invoiceTotal: { color: ios.label, fontFamily: fonts.bold, fontSize: 15 },
  emptyCard: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
  },
  emptyTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 16 },
  emptyText: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 13, marginTop: spacing.xxs },

  camera: { borderRadius: radius.md, flex: 1, overflow: "hidden" },
  scanOverlay: { alignItems: "center", flex: 1, justifyContent: "center" },
  scanFrame: { borderColor: "#ffffff", borderRadius: radius.md, borderWidth: 3, height: 176, width: 220 },
  scanHint: { backgroundColor: "rgba(15, 23, 42, 0.65)", borderRadius: radius.sm, color: "#ffffff", fontWeight: "600", marginTop: spacing.md, padding: spacing.sm },
  permissionCard: { backgroundColor: ios.card, borderRadius: 16, margin: spacing.md, padding: spacing.md },

  searchPanel: { backgroundColor: ios.card, borderRadius: 16, marginBottom: spacing.md, marginHorizontal: spacing.md, padding: spacing.md },
  searchMetaRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.xxs },
  searchMeta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12 },
  productListContent: { paddingBottom: spacing.xl, paddingHorizontal: spacing.md },
  productRow: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 16,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xs,
    padding: spacing.sm,
  },
  productRowImage: { borderRadius: 12, height: 40, width: 48 },
  productRowInitial: {
    alignItems: "center",
    backgroundColor: `${ios.blue}14`,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 48,
  },
  productRowInfo: { flex: 1, minWidth: 0 },
  productRowName: { color: ios.label, fontFamily: fonts.semibold, fontSize: 15 },
  productRowMeta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  addBtn: {
    backgroundColor: ios.navy,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  addBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 13 },
});
