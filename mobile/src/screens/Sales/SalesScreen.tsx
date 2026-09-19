import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Badge,
  Button,
  Empty,
  FabButton,
  Field,
  IconButton,
  IosScreenHeader,
  IosSearchBar,
  PageHeader,
  Screen,
  SearchField,
  SelectOption,
} from "../../components/Layout";
import { SubscriptionModal } from "../../components/SubscriptionModal";
import { useAppSelector } from "../../hooks/redux";
import { ios } from "../../constants/ios";
import { colors, fonts, radius, shadows, spacing, typography } from "../../constants/theme";
import {
  apiErrorMessage,
  createOrder,
  Customer,
  getCustomers,
  getOrders,
  getProducts,
  Order,
  Product,
  scanProduct,
} from "../../services/api";

type CartLine = { product: Product; qty: number };
type DatePreset = "today" | "week" | "month";
type PaymentMode = "cash" | "upi" | "card" | "pending";

export default function SalesScreen() {
  const user = useAppSelector((state) => state.auth.user);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const isActivated = user?.subscriptionStatus === "active";

  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState("0");
  const [gst, setGst] = useState("0");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("cash");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [scanOpen, setScanOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedReceipt, setSelectedReceipt] = useState<Order | null>(null);
  const [cartExpanded, setCartExpanded] = useState(true);
  const [lastScan, setLastScan] = useState("");
  const [torch, setTorch] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);
  const productsQuery = useQuery({ queryKey: ["products", ""], queryFn: () => getProducts("") });
  const customersQuery = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
  const ordersQuery = useQuery({ queryKey: ["orders", dateRange], queryFn: () => getOrders(dateRange) });
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  const products = productsQuery.data || [];
  const customers = customersQuery.data || [];
  const orders = ordersQuery.data || [];

  // Categories extracted from products
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const catName = typeof p.category === "object" ? p.category?.name : p.category;
      if (catName) set.add(catName);
    });
    return ["all", ...Array.from(set)];
  }, [products]);

  // Subtotal & Calculations
  const subtotal = useMemo(() => cart.reduce((sum, line) => sum + line.product.price * line.qty, 0), [cart]);
  const itemCount = useMemo(() => cart.reduce((sum, line) => sum + line.qty, 0), [cart]);
  const discountNum = Number(discount) || 0;
  const gstNum = Number(gst) || 0;
  const total = Math.max(subtotal - discountNum + gstNum, 0);

  // Period sales & stats
  const periodSales = useMemo(() => orders.reduce((sum, order) => sum + Number(order.total || 0), 0), [orders]);
  const paidOrdersCount = useMemo(() => orders.filter((o) => o.paymentStatus === "paid").length, [orders]);

  // Filtered products for quick add
  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    return products.filter((item) => {
      const catName = typeof item.category === "object" ? item.category?.name || "" : item.category || "";
      const matchesCategory = selectedCategory === "all" || catName.toLowerCase() === selectedCategory.toLowerCase();
      const searchable = `${item.name} ${item.sku || ""} ${catName}`.toLowerCase();
      const matchesKeyword = !keyword || searchable.includes(keyword);
      return matchesCategory && matchesKeyword;
    });
  }, [productSearch, selectedCategory, products]);

  // Filtered customers for customer picker
  const filteredCustomers = useMemo(() => {
    const keyword = customerSearch.trim().toLowerCase();
    if (!keyword) return customers;
    return customers.filter((c) => c.name.toLowerCase().includes(keyword) || c.phone?.includes(keyword));
  }, [customerSearch, customers]);

  // Create Order Mutation
  const saveMutation = useMutation({
    mutationFn: () =>
      createOrder({
        customer: customer?._id || undefined,
        discount: discountNum,
        gst: gstNum,
        paymentStatus: paymentMode === "pending" ? "pending" : "paid",
        paymentMethod: paymentMode,
        items: cart.map((line) => ({ product: line.product._id, qty: line.qty })),
      }),
    onSuccess: (newOrder: any) => {
      setCart([]);
      setDiscount("0");
      setGst("0");
      setCustomer(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      if (newOrder && newOrder._id) {
        setSelectedReceipt(newOrder);
      } else {
        Alert.alert("Invoice Generated", `Bill saved successfully for ₹${formatMoney(total)}`);
      }
    },
    onError: (error: Error) => Alert.alert("Billing Failed", apiErrorMessage(error)),
  });

  const scanner = useMutation({
    mutationFn: scanProduct,
    onSuccess: (product) => {
      addToCart(product);
      setScanOpen(false);
      Alert.alert("Added to Cart", product.name);
    },
    onError: (error: Error) => Alert.alert("Scan Failed", apiErrorMessage(error)),
  });

  function addToCart(product: Product) {
    setCart((current) => {
      const existing = current.find((line) => line.product._id === product._id);
      if (existing) {
        return current.map((line) => (line.product._id === product._id ? { ...line, qty: line.qty + 1 } : line));
      }
      return [...current, { product, qty: 1 }];
    });
  }

  function decrementQty(productId: string) {
    setCart((current) =>
      current
        .map((line) => {
          if (line.product._id === productId) {
            return { ...line, qty: line.qty - 1 };
          }
          return line;
        })
        .filter((line) => line.qty > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) => current.filter((line) => line.product._id !== productId));
  }

  function handleScan(code: string) {
    if (!code || code === lastScan || scanner.isPending) return;
    setLastScan(code);
    scanner.mutate(code);
    setTimeout(() => setLastScan(""), 1500);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([productsQuery.refetch(), customersQuery.refetch(), ordersQuery.refetch()]);
    setRefreshing(false);
  };

  async function shareReceipt(order: Order) {
    const dateStr = new Date(order.createdAt).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const itemsList = (order.items || [])
      .map((it) => `• ${it.product?.name || "Item"} x ${it.qty} = ₹${formatMoney((it.price || 0) * it.qty)}`)
      .join("\n");

    const message = `🧾 *KADAI KANAKKU - INVOICE*\n📅 Date: ${dateStr}\n👤 Customer: ${
      order.customer?.name || "Walk-in Customer"
    }\n${order.customer?.phone ? `📞 Phone: ${order.customer.phone}\n` : ""}\n*ITEMS:*\n${itemsList}\n\n*Subtotal:* ₹${formatMoney(
      order.subtotal || order.total
    )}\n${order.discount ? `*Discount:* -₹${formatMoney(order.discount)}\n` : ""}${
      order.gst ? `*GST / Tax:* +₹${formatMoney(order.gst)}\n` : ""
    }━━━━━━━━━━━━━━━━━━\n*GRAND TOTAL: ₹${formatMoney(order.total)}*\n*Payment:* ${
      order.paymentStatus === "paid" ? `PAID via ${(order.paymentMethod || "CASH").toUpperCase()}` : "UNPAID / PENDING"
    }\n\nThank you for shopping with us! 🙏`;

    if (Platform.OS === "web") {
      const url = `https://wa.me/${order.customer?.phone ? `91${order.customer.phone.replace(/[^0-9]/g, "")}` : ""}?text=${encodeURIComponent(
        message
      )}`;
      window.open(url, "_blank");
    } else {
      await Share.share({ message });
    }
  }

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="POS & Billing Desk"
        right={
          cart.length > 0 ? (
            <TouchableOpacity onPress={() => setCartExpanded((prev) => !prev)} style={styles.cartBadgeActive}>
              <Ionicons color="#FFFFFF" name="cart" size={15} />
              <Text style={styles.cartBadgeActiveText}>{itemCount}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.cartBadgeEmpty}>
              <Ionicons color={colors.textSecondary} name="cart-outline" size={16} />
              <Text style={styles.cartBadgeEmptyText}>0</Text>
            </View>
          )
        }
        title="Sales"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} />}
      >
        {/* Top Activation Reminder Banner (When not activated) */}
        {!isActivated && (
          <TouchableOpacity
            style={styles.activationBanner}
            onPress={() => setSubModalOpen(true)}
            activeOpacity={0.88}
          >
            <View style={styles.activationBannerLeft}>
              <View style={styles.activationBannerIconWrap}>
                <Ionicons color="#D97706" name="flash" size={15} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activationBannerTitle}>Activate Shop · ₹1 Launch Offer</Text>
                <Text style={styles.activationBannerSub}>Unlock live billing, cloud sync & reports</Text>
              </View>
            </View>
            <View style={styles.activationBannerBtn}>
              <Text style={styles.activationBannerBtnText}>Pay ₹1</Text>
              <Ionicons color="#FFFFFF" name="arrow-forward" size={11} />
            </View>
          </TouchableOpacity>
        )}

        {/* Metric Summary Cards */}
        <View style={styles.metricsRow}>
          {/* Revenue */}
          <View style={[styles.metricCard, { borderLeftColor: "#10B981" }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#ECFDF5" }]}>
                <Ionicons color="#10B981" name="trending-up" size={16} />
              </View>
              <Text style={styles.metricLabel}>{datePreset === "today" ? "Today" : datePreset === "week" ? "7 Days" : "Month"}</Text>
            </View>
            <Text numberOfLines={1} style={styles.metricValue}>
              ₹{formatMoney(periodSales)}
            </Text>
            <Text style={styles.metricSub}>{orders.length} Invoices</Text>
          </View>

          {/* Active Cart */}
          <View style={[styles.metricCard, { borderLeftColor: "#0079F2" }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}>
                <Ionicons color="#0079F2" name="bag-check" size={16} />
              </View>
              <Text style={styles.metricLabel}>Active Cart</Text>
            </View>
            <Text numberOfLines={1} style={styles.metricValue}>
              ₹{formatMoney(total)}
            </Text>
            <Text style={styles.metricSub}>{itemCount} items</Text>
          </View>

          {/* Paid Count */}
          <View style={[styles.metricCard, { borderLeftColor: "#8B5CF6" }]}>
            <View style={styles.metricHeader}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#F5F3FF" }]}>
                <Ionicons color="#8B5CF6" name="receipt" size={16} />
              </View>
              <Text style={styles.metricLabel}>Completed</Text>
            </View>
            <Text numberOfLines={1} style={styles.metricValue}>
              {paidOrdersCount}
            </Text>
            <Text style={styles.metricSub}>Bills Paid</Text>
          </View>
        </View>

        {/* Quick Action Shortcuts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.actionGrid}>
          <TouchableOpacity onPress={() => navigation.navigate("QuickSale")} style={styles.actionCard} activeOpacity={0.75}>
            <LinearGradient colors={["#FF6B00", "#FF8800"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionIconGrad}>
              <Ionicons color="#FFFFFF" name="flash" size={20} />
            </LinearGradient>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Quick POS</Text>
              <Text style={styles.actionDesc}>Fast counter sale</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setScanOpen(true)} style={styles.actionCard} activeOpacity={0.75}>
            <LinearGradient colors={["#0079F2", "#00A3FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionIconGrad}>
              <Ionicons color="#FFFFFF" name="barcode" size={20} />
            </LinearGradient>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Scan Barcode</Text>
              <Text style={styles.actionDesc}>Point & add to cart</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setProductPickerOpen(true)} style={styles.actionCard} activeOpacity={0.75}>
            <LinearGradient colors={["#10B981", "#34D399"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionIconGrad}>
              <Ionicons color="#FFFFFF" name="grid" size={20} />
            </LinearGradient>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Browse Catalog</Text>
              <Text style={styles.actionDesc}>{products.length} Products</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setCustomerPickerOpen(true)} style={styles.actionCard} activeOpacity={0.75}>
            <LinearGradient colors={["#6366F1", "#818CF8"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.actionIconGrad}>
              <Ionicons color="#FFFFFF" name="person" size={20} />
            </LinearGradient>
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>{customer ? customer.name : "Select Customer"}</Text>
              <Text numberOfLines={1} style={styles.actionDesc}>
                {customer ? customer.phone || "Selected" : "Walk-in Customer"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ACTIVE BILLING CART DOCK */}
        {cart.length > 0 && (
          <View style={styles.cartContainer}>
            <View style={styles.cartHeadBar}>
              <View style={styles.cartHeadLeft}>
                <Ionicons color={colors.primary} name="cart" size={20} />
                <Text style={styles.cartHeadTitle}>Current Bill Cart</Text>
                <View style={styles.cartItemCountPill}>
                  <Text style={styles.cartItemCountText}>{itemCount} items</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setCart([])} style={styles.cartClearBtn}>
                <Text style={styles.cartClearText}>Clear</Text>
              </TouchableOpacity>
            </View>

            {/* Cart Items List */}
            <View style={styles.cartItemsWrap}>
              {cart.map((line, idx) => (
                <View key={line.product._id} style={[styles.cartItemRow, idx > 0 && styles.cartItemBorder]}>
                  <View style={styles.cartItemLeft}>
                    <Text numberOfLines={1} style={styles.cartItemName}>
                      {line.product.name}
                    </Text>
                    <Text style={styles.cartItemMeta}>
                      ₹{formatMoney(line.product.price)} × {line.qty} ={" "}
                      <Text style={styles.cartItemLineTotal}>₹{formatMoney(line.product.price * line.qty)}</Text>
                    </Text>
                  </View>
                  <View style={styles.cartItemStepper}>
                    <TouchableOpacity onPress={() => decrementQty(line.product._id)} style={styles.stepBtn}>
                      <Ionicons color={colors.textPrimary} name="remove" size={15} />
                    </TouchableOpacity>
                    <Text style={styles.stepQty}>{line.qty}</Text>
                    <TouchableOpacity onPress={() => addToCart(line.product)} style={styles.stepBtn}>
                      <Ionicons color={colors.textPrimary} name="add" size={15} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => removeFromCart(line.product._id)} style={styles.cartItemDel}>
                    <Ionicons color="#EF4444" name="trash-outline" size={16} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Customer & Calculation Section */}
            <View style={styles.cartBillingSection}>
              {/* Customer Selector Row */}
              <TouchableOpacity onPress={() => setCustomerPickerOpen(true)} style={styles.customerSelectBar}>
                <View style={styles.customerIconWrap}>
                  <Ionicons color={colors.primary} name="person" size={16} />
                </View>
                <View style={styles.customerSelectCopy}>
                  <Text style={styles.customerSelectLabel}>Bill to Customer</Text>
                  <Text style={styles.customerSelectValue}>
                    {customer ? `${customer.name} (${customer.phone || "No Phone"})` : "Walk-in Customer (Tap to change)"}
                  </Text>
                </View>
                <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
              </TouchableOpacity>

              {/* Discount & GST Inputs */}
              <View style={styles.discountRow}>
                <View style={styles.discountInputWrap}>
                  <Text style={styles.inputMiniLabel}>Discount (₹)</Text>
                  <TextInput
                    keyboardType="numeric"
                    onChangeText={setDiscount}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={styles.miniInput}
                    value={discount}
                  />
                </View>
                <View style={styles.discountInputWrap}>
                  <Text style={styles.inputMiniLabel}>GST / Tax (₹)</Text>
                  <TextInput
                    keyboardType="numeric"
                    onChangeText={setGst}
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                    style={styles.miniInput}
                    value={gst}
                  />
                </View>
              </View>

              {/* Payment Mode Pills */}
              <Text style={styles.paymentModeLabel}>Payment Method</Text>
              <View style={styles.paymentModeRow}>
                {(
                  [
                    { id: "cash", label: "Cash", icon: "cash-outline" },
                    { id: "upi", label: "UPI", icon: "qr-code-outline" },
                    { id: "card", label: "Card", icon: "card-outline" },
                    { id: "pending", label: "Credit", icon: "time-outline" },
                  ] as const
                ).map((pm) => {
                  const isSelected = paymentMode === pm.id;
                  return (
                    <TouchableOpacity
                      key={pm.id}
                      onPress={() => setPaymentMode(pm.id)}
                      style={[styles.paymentPill, isSelected && styles.paymentPillActive]}
                    >
                      <Ionicons
                        color={isSelected ? "#FFFFFF" : colors.textSecondary}
                        name={pm.icon as keyof typeof Ionicons.glyphMap}
                        size={15}
                      />
                      <Text style={[styles.paymentPillText, isSelected && styles.paymentPillTextActive]}>{pm.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Bill Totals Summary */}
              <View style={styles.billTotalBreakdown}>
                <View style={styles.billTotalRow}>
                  <Text style={styles.billTotalText}>Subtotal</Text>
                  <Text style={styles.billTotalNum}>₹{formatMoney(subtotal)}</Text>
                </View>
                {discountNum > 0 && (
                  <View style={styles.billTotalRow}>
                    <Text style={[styles.billTotalText, { color: "#10B981" }]}>Discount</Text>
                    <Text style={[styles.billTotalNum, { color: "#10B981" }]}>-₹{formatMoney(discountNum)}</Text>
                  </View>
                )}
                {gstNum > 0 && (
                  <View style={styles.billTotalRow}>
                    <Text style={styles.billTotalText}>GST / Tax</Text>
                    <Text style={styles.billTotalNum}>+₹{formatMoney(gstNum)}</Text>
                  </View>
                )}
                <View style={styles.billGrandTotalDivider} />
                <View style={styles.billTotalRow}>
                  <Text style={styles.billGrandTotalLabel}>Grand Total</Text>
                  <Text style={styles.billGrandTotalVal}>₹{formatMoney(total)}</Text>
                </View>
              </View>

              {/* Save & Complete Bill CTA */}
              <TouchableOpacity
                disabled={saveMutation.isPending}
                onPress={() => {
                  if (!isActivated) {
                    setSubModalOpen(true);
                    return;
                  }
                  if (!cart.length) return Alert.alert("Empty Cart", "Add at least one item.");
                  saveMutation.mutate();
                }}
                style={styles.completeBillBtn}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#0079F2", "#005bb5"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.completeBillBtnGrad}
                >
                  <Ionicons color="#FFFFFF" name="checkmark-circle" size={20} />
                  <Text style={styles.completeBillBtnText}>
                    {saveMutation.isPending ? "Generating Invoice…" : `Complete Sale · ₹${formatMoney(total)}`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* QUICK PRODUCT CATALOG ADD */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>Catalog Quick Add</Text>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{filteredProducts.length}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setProductPickerOpen(true)}>
            <Text style={styles.sectionActionText}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <IosSearchBar
          onChangeText={setProductSearch}
          placeholder="Search products by name, SKU..."
          style={styles.searchBar}
          value={productSearch}
        />

        {/* Category Horizontal Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
              >
                <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                  {cat === "all" ? "All Products" : cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Product Cards List */}
        {filteredProducts.length > 0 ? (
          <View style={styles.productGrid}>
            {filteredProducts.slice(0, 12).map((item) => {
              const inCart = cart.find((c) => c.product._id === item._id);
              const isLowStock = item.stockQty <= 5 && item.stockQty > 0;
              const isOutOfStock = item.stockQty <= 0;

              return (
                <TouchableOpacity
                  key={item._id}
                  onPress={() => addToCart(item)}
                  style={[styles.productCard, Boolean(inCart) && styles.productCardInCart]}
                  activeOpacity={0.7}
                >
                  <View style={styles.productCardTop}>
                    <View style={styles.productAvatar}>
                      <Ionicons color={colors.primary} name="cube" size={20} />
                    </View>
                    <View style={styles.productMainInfo}>
                      <Text numberOfLines={1} style={styles.productName}>
                        {item.name}
                      </Text>
                      <Text style={styles.productSku}>{item.sku || "No SKU"}</Text>
                    </View>
                    <View
                      style={[
                        styles.stockPill,
                        isOutOfStock ? styles.stockPillOut : isLowStock ? styles.stockPillLow : styles.stockPillOk,
                      ]}
                    >
                      <Text
                        style={[
                          styles.stockPillText,
                          isOutOfStock ? styles.stockTextOut : isLowStock ? styles.stockTextLow : styles.stockTextOk,
                        ]}
                      >
                        {isOutOfStock ? "Out" : `${item.stockQty} left`}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.productCardBottom}>
                    <Text style={styles.productPrice}>₹{formatMoney(item.price)}</Text>
                    {inCart ? (
                      <View style={styles.inCartBadge}>
                        <Ionicons color="#FFFFFF" name="checkmark" size={12} />
                        <Text style={styles.inCartBadgeText}>{inCart.qty} in cart</Text>
                      </View>
                    ) : (
                      <View style={styles.addCartBtn}>
                        <Ionicons color={colors.primary} name="add" size={16} />
                        <Text style={styles.addCartBtnText}>Add</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyProductsBox}>
            <Ionicons color={colors.textMuted} name="cube-outline" size={36} />
            <Text style={styles.emptyTitle}>{productsQuery.isLoading ? "Loading products…" : "No products found"}</Text>
            <Text style={styles.emptySub}>
              {productsQuery.isLoading ? "Please wait a moment." : "Try adjusting your search or category."}
            </Text>
          </View>
        )}

        {/* RECENT INVOICES SECTION */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>Recent Invoices</Text>
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{orders.length}</Text>
            </View>
          </View>
        </View>

        {/* Segmented Filter */}
        <View style={styles.segmentContainer}>
          {(
            [
              ["today", "Today"],
              ["week", "7 Days"],
              ["month", "This Month"],
            ] as [DatePreset, string][]
          ).map(([key, label]) => (
            <TouchableOpacity
              key={key}
              onPress={() => setDatePreset(key)}
              style={[styles.segmentBtn, datePreset === key && styles.segmentBtnActive]}
            >
              <Text style={[styles.segmentBtnText, datePreset === key && styles.segmentBtnTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Invoices List */}
        {orders.length > 0 ? (
          <View style={styles.invoicesList}>
            {orders.slice(0, 10).map((order) => {
              const isPaid = order.paymentStatus === "paid";
              return (
                <TouchableOpacity
                  key={order._id}
                  onPress={() => setSelectedReceipt(order)}
                  style={styles.invoiceCard}
                  activeOpacity={0.7}
                >
                  <View style={styles.invoiceCardLeft}>
                    <View style={[styles.invoiceIconWrap, isPaid ? styles.invoiceIconPaid : styles.invoiceIconPending]}>
                      <Ionicons color={isPaid ? "#10B981" : "#F59E0B"} name={isPaid ? "receipt" : "time"} size={18} />
                    </View>
                    <View style={styles.invoiceCardInfo}>
                      <Text numberOfLines={1} style={styles.invoiceCustomer}>
                        {order.customer?.name || "Walk-in Customer"}
                      </Text>
                      <Text style={styles.invoiceMeta}>
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {order.items?.length || 0} items
                      </Text>
                    </View>
                  </View>

                  <View style={styles.invoiceCardRight}>
                    <Text style={styles.invoiceAmount}>₹{formatMoney(order.total)}</Text>
                    <View style={[styles.invoiceStatusPill, isPaid ? styles.statusPillPaid : styles.statusPillPending]}>
                      <Text style={[styles.invoiceStatusText, isPaid ? styles.statusTextPaid : styles.statusTextPending]}>
                        {isPaid ? (order.paymentMethod || "PAID").toUpperCase() : "UNPAID"}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyOrdersCard}>
            <Ionicons color={colors.textMuted} name="receipt-outline" size={40} />
            <Text style={styles.emptyTitle}>{ordersQuery.isLoading ? "Loading invoices…" : "No invoices found"}</Text>
            <Text style={styles.emptySub}>
              {ordersQuery.isLoading ? "Fetching recent sales..." : "Sales made in this period will appear here."}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button for Catalog Browser */}
      <FabButton accessibilityLabel="Browse Catalog" onPress={() => setProductPickerOpen(true)} />

      {/* MODAL: BARCODE SCANNER */}
      <Modal animationType="slide" visible={scanOpen}>
        <Screen style={{ backgroundColor: "#000000" }}>
          <PageHeader
            eyebrow="Barcode POS"
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setScanOpen(false)} />}
            title="Scan Barcode"
          />
          {permission?.granted ? (
            <View style={styles.scannerWrapper}>
              <CameraView
                enableTorch={torch}
                style={styles.cameraView}
                barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "code128", "upc_a", "upc_e"] } as any}
                onBarcodeScanned={(event: any) => handleScan(event.data)}
              >
                <View style={styles.scannerOverlay}>
                  <View style={styles.scannerTarget}>
                    <View style={[styles.cornerMarker, styles.topLeft]} />
                    <View style={[styles.cornerMarker, styles.topRight]} />
                    <View style={[styles.cornerMarker, styles.bottomLeft]} />
                    <View style={[styles.cornerMarker, styles.bottomRight]} />
                    <View style={styles.laserLine} />
                  </View>
                  <Text style={styles.scannerPrompt}>
                    {scanner.isPending ? "Adding product to cart..." : "Align barcode within frame"}
                  </Text>
                </View>
              </CameraView>
              <View style={styles.scannerControls}>
                <TouchableOpacity onPress={() => setTorch((prev) => !prev)} style={styles.torchBtn}>
                  <Ionicons color="#FFFFFF" name={torch ? "flash" : "flash-outline"} size={22} />
                  <Text style={styles.torchBtnText}>{torch ? "Flash On" : "Flash Off"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.permissionBox}>
              <Ionicons color={colors.primary} name="camera" size={48} />
              <Text style={styles.permissionTitle}>Camera Access Required</Text>
              <Text style={styles.permissionDesc}>Allow camera access to scan product barcodes and QR codes quickly.</Text>
              <Button onPress={() => requestPermission()} title="Grant Permission" />
            </View>
          )}
        </Screen>
      </Modal>

      {/* MODAL: PRODUCT BROWSER CATALOG */}
      <Modal animationType="slide" visible={productPickerOpen}>
        <Screen style={styles.screen}>
          <PageHeader
            eyebrow="Product Catalog"
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setProductPickerOpen(false)} />}
            title="Browse & Add"
          />
          <View style={styles.modalSearchArea}>
            <SearchField
              onChangeText={setProductSearch}
              placeholder="Search by name, category, SKU..."
              value={productSearch}
            />
            <View style={styles.modalSearchMeta}>
              <Text style={styles.modalSearchMetaText}>{filteredProducts.length} items found</Text>
              <Text style={styles.modalSearchMetaText}>{itemCount} in current cart</Text>
            </View>
          </View>

          <FlatList
            data={filteredProducts}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.catalogListContent}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Empty icon="cube-outline" text={productsQuery.isLoading ? "Loading products..." : "No products found."} />
            }
            renderItem={({ item }) => {
              const inCart = cart.find((c) => c.product._id === item._id);
              const isOutOfStock = item.stockQty <= 0;
              return (
                <View style={styles.catalogItemRow}>
                  <View style={styles.catalogItemIcon}>
                    <Ionicons color={colors.primary} name="cube" size={22} />
                  </View>
                  <View style={styles.catalogItemInfo}>
                    <Text numberOfLines={1} style={styles.catalogItemName}>
                      {item.name}
                    </Text>
                    <Text style={styles.catalogItemMeta}>
                      SKU: {item.sku || "N/A"} · Stock: {item.stockQty}
                    </Text>
                  </View>
                  <View style={styles.catalogItemRight}>
                    <Text style={styles.catalogItemPrice}>₹{formatMoney(item.price)}</Text>
                    {inCart ? (
                      <View style={styles.catalogItemInCart}>
                        <TouchableOpacity onPress={() => decrementQty(item._id)} style={styles.catalogQtyBtn}>
                          <Ionicons color={colors.textPrimary} name="remove" size={14} />
                        </TouchableOpacity>
                        <Text style={styles.catalogQtyText}>{inCart.qty}</Text>
                        <TouchableOpacity onPress={() => addToCart(item)} style={styles.catalogQtyBtn}>
                          <Ionicons color={colors.textPrimary} name="add" size={14} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        disabled={isOutOfStock}
                        onPress={() => addToCart(item)}
                        style={[styles.catalogAddBtn, isOutOfStock && styles.catalogAddBtnDisabled]}
                      >
                        <Text style={styles.catalogAddBtnText}>{isOutOfStock ? "Out of Stock" : "Add"}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        </Screen>
      </Modal>

      {/* MODAL: CUSTOMER PICKER */}
      <Modal animationType="slide" visible={customerPickerOpen}>
        <Screen style={styles.screen}>
          <PageHeader
            eyebrow="Customer Selection"
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setCustomerPickerOpen(false)} />}
            title="Assign Customer"
          />
          <View style={styles.modalSearchArea}>
            <SearchField
              onChangeText={setCustomerSearch}
              placeholder="Search customer by name or phone..."
              value={customerSearch}
            />
          </View>

          <FlatList
            data={filteredCustomers}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.catalogListContent}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <TouchableOpacity
                onPress={() => {
                  setCustomer(null);
                  setCustomerPickerOpen(false);
                }}
                style={[styles.customerOptionCard, !customer && styles.customerOptionSelected]}
              >
                <View style={styles.customerOptionAvatar}>
                  <Ionicons color={colors.primary} name="people" size={20} />
                </View>
                <View style={styles.customerOptionInfo}>
                  <Text style={styles.customerOptionName}>Walk-in Customer</Text>
                  <Text style={styles.customerOptionPhone}>No ledger / Instant Cash Sale</Text>
                </View>
                {!customer && <Ionicons color={colors.primary} name="checkmark-circle" size={22} />}
              </TouchableOpacity>
            }
            ListEmptyComponent={
              <Empty icon="people-outline" text={customersQuery.isLoading ? "Loading customers..." : "No customers found."} />
            }
            renderItem={({ item }) => {
              const isSelected = customer?._id === item._id;
              return (
                <TouchableOpacity
                  onPress={() => {
                    setCustomer(item);
                    setCustomerPickerOpen(false);
                  }}
                  style={[styles.customerOptionCard, isSelected && styles.customerOptionSelected]}
                >
                  <View style={styles.customerOptionAvatar}>
                    <Ionicons color={colors.primary} name="person" size={20} />
                  </View>
                  <View style={styles.customerOptionInfo}>
                    <Text style={styles.customerOptionName}>{item.name}</Text>
                    <Text style={styles.customerOptionPhone}>{item.phone || "No phone number"}</Text>
                  </View>
                  {isSelected && <Ionicons color={colors.primary} name="checkmark-circle" size={22} />}
                </TouchableOpacity>
              );
            }}
          />
        </Screen>
      </Modal>

      {/* MODAL: INVOICE RECEIPT VIEWER */}
      <Modal animationType="slide" visible={Boolean(selectedReceipt)}>
        <Screen style={styles.screen}>
          <PageHeader
            eyebrow="Tax Invoice Receipt"
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setSelectedReceipt(null)} />}
            title="Invoice Receipt"
          />
          {selectedReceipt && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.receiptContainer}>
              <View style={styles.receiptPaper}>
                {/* Receipt Header */}
                <View style={styles.receiptBrand}>
                  <View style={styles.receiptLogoBadge}>
                    <Ionicons color="#FFFFFF" name="storefront" size={24} />
                  </View>
                  <Text style={styles.receiptBrandTitle}>KADAI KANAKKU</Text>
                  <Text style={styles.receiptBrandSub}>Smart Retail & Inventory Management</Text>
                </View>

                <View style={styles.receiptDividerDashed} />

                {/* Receipt Meta */}
                <View style={styles.receiptMetaGrid}>
                  <View>
                    <Text style={styles.receiptMetaLabel}>Date & Time</Text>
                    <Text style={styles.receiptMetaVal}>
                      {new Date(selectedReceipt.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.receiptMetaLabel}>Payment Status</Text>
                    <Text
                      style={[
                        styles.receiptMetaVal,
                        { color: selectedReceipt.paymentStatus === "paid" ? "#10B981" : "#F59E0B", fontWeight: "700" },
                      ]}
                    >
                      {selectedReceipt.paymentStatus === "paid"
                        ? `PAID (${(selectedReceipt.paymentMethod || "CASH").toUpperCase()})`
                        : "UNPAID"}
                    </Text>
                  </View>
                </View>

                {/* Customer Row */}
                <View style={styles.receiptCustomerRow}>
                  <Text style={styles.receiptMetaLabel}>Customer</Text>
                  <Text style={styles.receiptMetaVal}>
                    {selectedReceipt.customer?.name || "Walk-in Customer"}
                    {selectedReceipt.customer?.phone ? ` (${selectedReceipt.customer.phone})` : ""}
                  </Text>
                </View>

                <View style={styles.receiptDividerDashed} />

                {/* Items Table */}
                <View style={styles.receiptTable}>
                  <View style={styles.receiptTableHeader}>
                    <Text style={[styles.receiptTableCol, { flex: 2 }]}>Item</Text>
                    <Text style={[styles.receiptTableCol, { textAlign: "center" }]}>Qty</Text>
                    <Text style={[styles.receiptTableCol, { textAlign: "right" }]}>Price</Text>
                    <Text style={[styles.receiptTableCol, { textAlign: "right" }]}>Total</Text>
                  </View>

                  {(selectedReceipt.items || []).map((it, i) => (
                    <View key={i} style={styles.receiptTableRow}>
                      <Text numberOfLines={1} style={[styles.receiptTableCell, { flex: 2, fontWeight: "600" }]}>
                        {it.product?.name || "Item"}
                      </Text>
                      <Text style={[styles.receiptTableCell, { textAlign: "center" }]}>{it.qty}</Text>
                      <Text style={[styles.receiptTableCell, { textAlign: "right" }]}>₹{formatMoney(it.price || 0)}</Text>
                      <Text style={[styles.receiptTableCell, { textAlign: "right", fontWeight: "600" }]}>
                        ₹{formatMoney((it.price || 0) * it.qty)}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={styles.receiptDividerDashed} />

                {/* Totals */}
                <View style={styles.receiptTotalsWrap}>
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptTotalLabel}>Subtotal</Text>
                    <Text style={styles.receiptTotalVal}>
                      ₹{formatMoney(selectedReceipt.subtotal || selectedReceipt.total)}
                    </Text>
                  </View>
                  {Boolean(selectedReceipt.discount) && (
                    <View style={styles.receiptTotalRow}>
                      <Text style={[styles.receiptTotalLabel, { color: "#10B981" }]}>Discount</Text>
                      <Text style={[styles.receiptTotalVal, { color: "#10B981" }]}>
                        -₹{formatMoney(selectedReceipt.discount)}
                      </Text>
                    </View>
                  )}
                  {Boolean(selectedReceipt.gst) && (
                    <View style={styles.receiptTotalRow}>
                      <Text style={styles.receiptTotalLabel}>GST / Tax</Text>
                      <Text style={styles.receiptTotalVal}>+₹{formatMoney(selectedReceipt.gst)}</Text>
                    </View>
                  )}
                  <View style={styles.receiptDividerSolid} />
                  <View style={styles.receiptTotalRow}>
                    <Text style={styles.receiptGrandTotalLabel}>Grand Total</Text>
                    <Text style={styles.receiptGrandTotalVal}>₹{formatMoney(selectedReceipt.total)}</Text>
                  </View>
                </View>

                <View style={styles.receiptFooter}>
                  <Text style={styles.receiptFooterText}>Thank you for your business! 🙏</Text>
                  <Text style={styles.receiptFooterSub}>Powered by Kadai Kanakku</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.receiptActions}>
                <TouchableOpacity onPress={() => shareReceipt(selectedReceipt)} style={styles.shareWhatsAppBtn}>
                  <Ionicons color="#FFFFFF" name="logo-whatsapp" size={20} />
                  <Text style={styles.shareWhatsAppText}>Share via WhatsApp</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setSelectedReceipt(null)} style={styles.receiptDoneBtn}>
                  <Text style={styles.receiptDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </Screen>
      </Modal>

      <SubscriptionModal
        visible={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        onActivated={() => {
          queryClient.invalidateQueries({ queryKey: ["orders"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        }}
      />
    </Screen>
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
  screen: { backgroundColor: "#F8FAFC" },
  content: { alignSelf: "center", maxWidth: 500, paddingBottom: 110, width: "100%", paddingHorizontal: spacing.md },

  // Cart Badge Top Right
  cartBadgeActive: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    ...shadows.sm,
  },
  cartBadgeActiveText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 13 },
  cartBadgeEmpty: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cartBadgeEmptyText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 13 },

  // Metric Cards
  metricsRow: { flexDirection: "row", gap: 8, marginTop: spacing.xs, marginBottom: spacing.md },
  metricCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderLeftWidth: 4,
    flex: 1,
    padding: 12,
    ...shadows.sm,
  },
  metricHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  metricIconWrap: { alignItems: "center", borderRadius: 8, height: 26, justifyContent: "center", width: 26 },
  metricLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 11 },
  metricValue: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.3 },
  metricSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, marginTop: 2 },

  // Section Headers
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionHeaderLeft: { alignItems: "center", flexDirection: "row", gap: 8 },
  sectionTitle: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.3 },
  sectionActionText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 13 },
  badgeCount: {
    backgroundColor: colors.backgroundDark,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeCountText: { color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: 11 },

  // Action Grid
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  actionCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    flexBasis: "48%",
    flexDirection: "row",
    flexGrow: 1,
    gap: 10,
    padding: 12,
    ...shadows.sm,
  },
  actionIconGrad: { alignItems: "center", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
  actionInfo: { flex: 1, minWidth: 0 },
  actionTitle: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 13 },
  actionDesc: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },

  // Active Billing Cart Dock
  cartContainer: {
    backgroundColor: colors.card,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: "hidden",
    ...shadows.md,
  },
  cartHeadBar: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cartHeadLeft: { alignItems: "center", flexDirection: "row", gap: 8 },
  cartHeadTitle: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 15 },
  cartItemCountPill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cartItemCountText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 11 },
  cartClearBtn: { paddingHorizontal: 6, paddingVertical: 2 },
  cartClearText: { color: "#EF4444", fontFamily: fonts.semibold, fontSize: 13 },

  cartItemsWrap: { paddingHorizontal: 14, paddingVertical: 6 },
  cartItemRow: { alignItems: "center", flexDirection: "row", paddingVertical: 10 },
  cartItemBorder: { borderTopColor: "#F1F5F9", borderTopWidth: 1 },
  cartItemLeft: { flex: 1, minWidth: 0, paddingRight: 8 },
  cartItemName: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 14 },
  cartItemMeta: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  cartItemLineTotal: { color: colors.textPrimary, fontFamily: fonts.bold },
  cartItemStepper: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    padding: 2,
  },
  stepBtn: { alignItems: "center", borderRadius: 8, height: 26, justifyContent: "center", width: 26 },
  stepQty: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 13, minWidth: 20, textAlign: "center" },
  cartItemDel: { paddingLeft: 10 },

  cartBillingSection: {
    backgroundColor: "#FAFAFA",
    borderTopColor: "#E2E8F0",
    borderTopWidth: 1,
    padding: 14,
  },
  customerSelectBar: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    padding: 10,
  },
  customerIconWrap: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  customerSelectCopy: { flex: 1, minWidth: 0 },
  customerSelectLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 10 },
  customerSelectValue: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 13 },

  discountRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  discountInputWrap: { flex: 1 },
  inputMiniLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 11, marginBottom: 4 },
  miniInput: {
    backgroundColor: colors.card,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    borderWidth: 1,
    color: colors.textPrimary,
    fontFamily: fonts.semibold,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },

  paymentModeLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 11, marginBottom: 6 },
  paymentModeRow: { flexDirection: "row", gap: 6, marginBottom: 14 },
  paymentPill: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    paddingVertical: 8,
  },
  paymentPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  paymentPillText: { color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: 12 },
  paymentPillTextActive: { color: "#FFFFFF" },

  billTotalBreakdown: {
    backgroundColor: colors.card,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14,
    padding: 12,
  },
  billTotalRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  billTotalText: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13 },
  billTotalNum: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 13 },
  billGrandTotalDivider: { backgroundColor: "#E2E8F0", height: 1, marginVertical: 6 },
  billGrandTotalLabel: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 16 },
  billGrandTotalVal: { color: colors.primary, fontFamily: fonts.bold, fontSize: 20 },

  completeBillBtn: { borderRadius: 14, overflow: "hidden", ...shadows.md },
  completeBillBtnGrad: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 14,
  },
  completeBillBtnText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 16 },

  // Catalog Section
  searchBar: { marginBottom: 8 },
  categoryChips: { gap: 6, paddingBottom: 10 },
  categoryChip: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12 },
  categoryChipTextActive: { color: "#FFFFFF", fontFamily: fonts.semibold },

  // Product Grid / Cards
  productGrid: { gap: 8 },
  productCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    ...shadows.sm,
  },
  productCardInCart: { borderColor: "#93C5FD", backgroundColor: "#F0F7FF" },
  productCardTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  productAvatar: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  productMainInfo: { flex: 1, minWidth: 0 },
  productName: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 14 },
  productSku: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, marginTop: 1 },
  stockPill: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  stockPillOk: { backgroundColor: "#ECFDF5" },
  stockPillLow: { backgroundColor: "#FFFBEB" },
  stockPillOut: { backgroundColor: "#FEF2F2" },
  stockPillText: { fontFamily: fonts.semibold, fontSize: 10 },
  stockTextOk: { color: "#10B981" },
  stockTextLow: { color: "#F59E0B" },
  stockTextOut: { color: "#EF4444" },

  productCardBottom: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
  },
  productPrice: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 16 },
  addCartBtn: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addCartBtnText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 12 },
  inCartBadge: {
    alignItems: "center",
    backgroundColor: "#10B981",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  inCartBadgeText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 12 },

  emptyProductsBox: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.xl,
    marginTop: spacing.xs,
  },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 15, marginTop: 8 },
  emptySub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },

  // Recent Invoices Segment
  segmentContainer: {
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: spacing.md,
    padding: 3,
  },
  segmentBtn: { alignItems: "center", borderRadius: 9, flex: 1, paddingVertical: 7 },
  segmentBtnActive: { backgroundColor: colors.card, ...shadows.sm },
  segmentBtnText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 13 },
  segmentBtnTextActive: { color: colors.textPrimary, fontFamily: fonts.semibold },

  invoicesList: { gap: 8 },
  invoiceCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    ...shadows.sm,
  },
  invoiceCardLeft: { alignItems: "center", flex: 1, flexDirection: "row", gap: 10, minWidth: 0 },
  invoiceIconWrap: { alignItems: "center", borderRadius: 10, height: 38, justifyContent: "center", width: 38 },
  invoiceIconPaid: { backgroundColor: "#ECFDF5" },
  invoiceIconPending: { backgroundColor: "#FFFBEB" },
  invoiceCardInfo: { flex: 1, minWidth: 0 },
  invoiceCustomer: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 14 },
  invoiceMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  invoiceCardRight: { alignItems: "flex-end" },
  invoiceAmount: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 15 },
  invoiceStatusPill: { borderRadius: 6, marginTop: 3, paddingHorizontal: 6, paddingVertical: 2 },
  statusPillPaid: { backgroundColor: "#ECFDF5" },
  statusPillPending: { backgroundColor: "#FFFBEB" },
  invoiceStatusText: { fontFamily: fonts.bold, fontSize: 10 },
  statusTextPaid: { color: "#10B981" },
  statusTextPending: { color: "#F59E0B" },

  emptyOrdersCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.xl,
  },

  // MODAL STYLES
  modalSearchArea: {
    backgroundColor: colors.card,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    padding: spacing.md,
  },
  modalSearchMeta: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  modalSearchMetaText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  catalogListContent: { padding: spacing.md, paddingBottom: 40 },
  catalogItemRow: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    padding: 12,
    ...shadows.sm,
  },
  catalogItemIcon: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  catalogItemInfo: { flex: 1, minWidth: 0 },
  catalogItemName: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 14 },
  catalogItemMeta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  catalogItemRight: { alignItems: "flex-end", gap: 6 },
  catalogItemPrice: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 15 },
  catalogAddBtn: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  catalogAddBtnDisabled: { backgroundColor: "#CBD5E1" },
  catalogAddBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 12 },
  catalogItemInCart: {
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    padding: 2,
  },
  catalogQtyBtn: { alignItems: "center", borderRadius: 6, height: 24, justifyContent: "center", width: 24 },
  catalogQtyText: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 12, minWidth: 16, textAlign: "center" },

  // Customer Option Card
  customerOptionCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 8,
    padding: 12,
  },
  customerOptionSelected: { borderColor: colors.primary, backgroundColor: "#F0F7FF" },
  customerOptionAvatar: {
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  customerOptionInfo: { flex: 1, minWidth: 0 },
  customerOptionName: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 14 },
  customerOptionPhone: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 1 },

  // SCANNER STYLES
  scannerWrapper: { flex: 1 },
  cameraView: { flex: 1 },
  scannerOverlay: { alignItems: "center", flex: 1, justifyContent: "center" },
  scannerTarget: {
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 20,
    borderWidth: 1,
    height: 220,
    position: "relative",
    width: 260,
  },
  cornerMarker: { borderColor: colors.primary, position: "absolute", width: 24, height: 24 },
  topLeft: { borderLeftWidth: 4, borderTopWidth: 4, top: -2, left: -2, borderTopLeftRadius: 18 },
  topRight: { borderRightWidth: 4, borderTopWidth: 4, top: -2, right: -2, borderTopRightRadius: 18 },
  bottomLeft: { borderLeftWidth: 4, borderBottomWidth: 4, bottom: -2, left: -2, borderBottomLeftRadius: 18 },
  bottomRight: { borderRightWidth: 4, borderBottomWidth: 4, bottom: -2, right: -2, borderBottomRightRadius: 18 },
  laserLine: { backgroundColor: "#FF3B30", height: 2, top: "50%", width: "100%", opacity: 0.8 },
  scannerPrompt: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    borderRadius: 8,
    color: "#FFFFFF",
    fontFamily: fonts.semibold,
    fontSize: 13,
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  scannerControls: {
    alignItems: "center",
    backgroundColor: "#0F172A",
    flexDirection: "row",
    justifyContent: "center",
    paddingVertical: 20,
  },
  torchBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  torchBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 14 },
  permissionBox: { alignItems: "center", flex: 1, justifyContent: "center", padding: spacing.xl },
  permissionTitle: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 18, marginTop: 12 },
  permissionDesc: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 14, marginVertical: 8, textAlign: "center" },

  // RECEIPT MODAL
  receiptContainer: { alignSelf: "center", maxWidth: 460, padding: spacing.md, paddingBottom: 40, width: "100%" },
  receiptPaper: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    ...shadows.md,
  },
  receiptBrand: { alignItems: "center", marginBottom: 12 },
  receiptLogoBadge: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 48,
    justifyContent: "center",
    marginBottom: 8,
    width: 48,
  },
  receiptBrandTitle: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 18, letterSpacing: 1 },
  receiptBrandSub: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  receiptDividerDashed: {
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderWidth: 1,
    marginVertical: 14,
  },
  receiptDividerSolid: {
    backgroundColor: "#E2E8F0",
    height: 1,
    marginVertical: 8,
  },
  receiptMetaGrid: { flexDirection: "row", justifyContent: "space-between" },
  receiptMetaLabel: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 11 },
  receiptMetaVal: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 13, marginTop: 2 },
  receiptCustomerRow: { marginTop: 8 },
  receiptTable: { marginTop: 4 },
  receiptTableHeader: { flexDirection: "row", paddingBottom: 6, borderBottomColor: "#F1F5F9", borderBottomWidth: 1 },
  receiptTableCol: { color: colors.textMuted, fontFamily: fonts.bold, fontSize: 11, flex: 1 },
  receiptTableRow: { flexDirection: "row", paddingVertical: 8, borderBottomColor: "#F8FAFC", borderBottomWidth: 1 },
  receiptTableCell: { color: colors.textPrimary, fontFamily: fonts.regular, fontSize: 12, flex: 1 },
  receiptTotalsWrap: { marginTop: 4 },
  receiptTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  receiptTotalLabel: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 13 },
  receiptTotalVal: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 13 },
  receiptGrandTotalLabel: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 16 },
  receiptGrandTotalVal: { color: colors.primary, fontFamily: fonts.bold, fontSize: 20 },
  receiptFooter: { alignItems: "center", marginTop: 20 },
  receiptFooterText: { color: colors.textPrimary, fontFamily: fonts.medium, fontSize: 13 },
  receiptFooterSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },

  receiptActions: { gap: 10, marginTop: 16 },
  shareWhatsAppBtn: {
    alignItems: "center",
    backgroundColor: "#25D366",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 14,
    ...shadows.sm,
  },
  shareWhatsAppText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 15 },
  receiptDoneBtn: {
    alignItems: "center",
    backgroundColor: "#E2E8F0",
    borderRadius: 14,
    paddingVertical: 12,
  },
  receiptDoneText: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 14 },

  /* Activation Banner */
  activationBanner: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FDE68A",
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 10,
    ...shadows.sm,
  },
  activationBannerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activationBannerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  activationBannerTitle: {
    fontSize: 12.5,
    fontFamily: fonts.bold,
    color: "#0D3666",
  },
  activationBannerSub: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#64748B",
  },
  activationBannerBtn: {
    backgroundColor: "#F59926",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activationBannerBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
});
