import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { useAppSelector } from "../../hooks/redux";
import { getDashboard, getStockSummary, verifyActivationOrder } from "../../services/api";
import { SubscriptionModal } from "../../components/SubscriptionModal";

type DatePreset = "today" | "week" | "month";

const periodCopy: Record<DatePreset, string> = {
  today: "Today",
  week: "Last 7 days",
  month: "This month",
};

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const user = useAppSelector((state) => state.auth.user);
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [refreshing, setRefreshing] = useState(false);
  const [subModalOpen, setSubModalOpen] = useState(false);
  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  const dashboard = useQuery({
    queryFn: () => getDashboard(dateRange),
    queryKey: ["dashboard", dateRange],
    placeholderData: (previous) => previous,
  });

  const monthRange = useMemo(() => getDateRange("month"), []);
  const stockSummary = useQuery({
    queryFn: () => getStockSummary({ from: monthRange.dateFrom, to: monthRange.dateTo }),
    queryKey: ["stock-summary", monthRange],
  });

  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const orderId = params.get("order_id") || params.get("orderId");
        if (orderId) {
          verifyActivationOrder(orderId).then((res) => {
            if (res.success || res.status === "PAID") {
              Toast.show({
                type: "success",
                text1: "Shop Activated! 🎉",
                text2: "Your ₹1 activation was successful. Full access is unlocked.",
              });
              dashboard.refetch();
              window.history.replaceState({}, document.title, window.location.pathname);
            }
          }).catch(() => {});
        }
      } catch (e) {}
    }
  }, []);

  const data = dashboard.data;
  const movementTotals = useMemo(() => {
    const rows = stockSummary.data || [];
    return {
      totalIn: rows.reduce((sum, row) => sum + row.totalIn, 0),
      totalOut: rows.reduce((sum, row) => sum + row.totalOut, 0),
    };
  }, [stockSummary.data]);

  const shopName = data?.organization?.name || "Your Shop";
  const rawFirst = (user?.name || "").split(" ")[0];
  const firstName = !rawFirst || rawFirst.toLowerCase() === "admin" ? shopName.split(" ")[0] : rawFirst;
  const bills = data?.selectedOrderCount || 0;
  const lowStock = data?.lowStockProducts || [];
  const lowStockCount = data?.lowStockProductCount ?? lowStock.length;

  const isActivated = data?.organization?.subscriptionStatus === "active" || user?.subscriptionStatus === "active";

  function go(name: string, params?: object) {
    if (!isActivated && (name === "QuickSale" || name === "Billing" || name === "Sales" || name === "Items")) {
      setSubModalOpen(true);
      return;
    }
    const drawer = navigation.getParent();
    const stack = drawer?.getParent();
    if (name === "Items" || name === "BarcodeGenerator") return drawer?.navigate(name);
    if (name === "QuickSale" || name === "Billing" || name === "ProductDetail" || name === "LowStock") {
      return (stack || drawer || navigation).navigate(name, params);
    }
    navigation.navigate(name, params);
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([dashboard.refetch(), stockSummary.refetch()]);
    setRefreshing(false);
  }

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={ios.blue} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================== */}
        {/* 1. APP HEADER & PROFILE BAR                */}
        {/* ========================================== */}
        <View style={styles.header}>
          {!isDesktop && (
            <TouchableOpacity
              accessibilityLabel="Open menu"
              onPress={() => navigation.getParent()?.openDrawer?.()}
              style={styles.menuBtn}
              activeOpacity={0.7}
            >
              <Ionicons color="#0F172A" name="menu-outline" size={22} />
            </TouchableOpacity>
          )}

          <View style={[styles.headerCopy, !isDesktop && { marginLeft: 12 }]}>
            <View style={styles.greetingRow}>
              <View style={styles.greetingDot} />
              <Text numberOfLines={1} style={styles.greeting}>{greeting()}</Text>
            </View>
            <Text numberOfLines={1} style={styles.ownerName}>{firstName}</Text>
            <View style={styles.shopStatusRow}>
              <Text numberOfLines={1} style={styles.shopCaption}>{shopName}</Text>
              <Text style={styles.bulletSeparator}>•</Text>
              <Text style={styles.dateCaption}>{formatToday()}</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => go("Settings")}
            style={styles.profileBtn}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#0079F2", "#005AC2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileGradient}
            >
              <Text style={styles.profileText}>
                {(user?.name || shopName).slice(0, 1).toUpperCase()}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Error Notification Card */}
        {dashboard.error && (
          <TouchableOpacity onPress={() => dashboard.refetch()} style={styles.errorCard} activeOpacity={0.8}>
            <View style={styles.errorIconWrap}>
              <Ionicons color="#EF4444" name="cloud-offline-outline" size={20} />
            </View>
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Couldn’t load shop data</Text>
              <Text style={styles.errorText}>Tap here to retry connecting to cloud</Text>
            </View>
            <Ionicons color="#EF4444" name="refresh" size={16} />
          </TouchableOpacity>
        )}

        {/* Top Activation Reminder Banner (When not activated) */}
        {!isActivated && (
          <TouchableOpacity
            style={styles.trialActivationBanner}
            onPress={() => setSubModalOpen(true)}
            activeOpacity={0.88}
          >
            <View style={styles.trialBannerLeft}>
              <View style={styles.trialBannerIconWrap}>
                <Ionicons color="#D97706" name="flash" size={16} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.trialBannerTitle}>Activate Shop · ₹1 Launch Offer</Text>
                <Text style={styles.trialBannerSub}>Unlock full POS billing, cloud sync & customer khata</Text>
              </View>
            </View>
            <View style={styles.trialBannerBtn}>
              <Text style={styles.trialBannerBtnText}>Pay ₹1</Text>
              <Ionicons color="#FFFFFF" name="arrow-forward" size={12} />
            </View>
          </TouchableOpacity>
        )}

        {data && (
          <>

            {/* ========================================== */}
            {/* 2. REVENUE HERO CARD                      */}
            {/* ========================================== */}
            <View style={styles.moneyCardContainer}>
              <LinearGradient
                colors={["#001C34", "#082347", "#001830"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.moneyCard}
              >
                {/* Top Row: Period & Segment Picker */}
                <View style={styles.moneyHeaderRow}>
                  <View style={styles.moneyOverlineWrap}>
                    <Text style={styles.moneyOverline}>{periodCopy[datePreset].toUpperCase()} REVENUE</Text>
                  </View>

                  <View style={styles.segment}>
                    {(["today", "week", "month"] as DatePreset[]).map((key) => (
                      <TouchableOpacity
                        key={key}
                        onPress={() => setDatePreset(key)}
                        style={[styles.segmentItem, datePreset === key && styles.segmentItemOn]}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.segmentText, datePreset === key && styles.segmentTextOn]}>
                          {key === "today" ? "Today" : key === "week" ? "7D" : "Month"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Main Total Amount */}
                <View style={styles.amountContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <Text style={styles.moneyAmount}>{formatMoney(data.selectedSales)}</Text>
                </View>

                {/* Sub-Metrics Pills (Bills & Profit) */}
                <View style={styles.moneyPills}>
                  <View style={styles.moneyPill}>
                    <Ionicons color="#38BDF8" name="receipt-outline" size={13} style={{ marginRight: 4 }} />
                    <Text style={styles.moneyPillText}>
                      {bills} {bills === 1 ? "Bill" : "Bills"}
                    </Text>
                  </View>

                  <View style={[styles.moneyPill, styles.profitPill]}>
                    <Ionicons color="#34D399" name="trending-up" size={13} style={{ marginRight: 4 }} />
                    <Text style={styles.profitPillText}>
                      ₹{formatMoney(data.todayProfit)} Profit
                    </Text>
                  </View>
                </View>

                {/* Action CTA Button */}
                <TouchableOpacity onPress={() => go("Sales")} style={styles.moneyCta} activeOpacity={0.9}>
                  <Text style={styles.moneyCtaText}>{bills ? "Open Sales Register" : "Start New Sale"}</Text>
                  <Ionicons color="#001C34" name="arrow-forward" size={16} />
                </TouchableOpacity>
              </LinearGradient>
            </View>

            {/* Announcement / Promo Banner */}
            {data.homeBanner?.enabled ? (
              <HomePromoBanner
                banner={{
                  title: data.homeBanner.title || "Shop update",
                  message: data.homeBanner.message || "Check the latest announcement from your admin.",
                  ctaLabel: data.homeBanner.ctaLabel,
                  ctaAction: data.homeBanner.ctaAction,
                  tone: data.homeBanner.tone,
                }}
                onPress={() => {
                  const action = data.homeBanner?.ctaAction;
                  if (action) go(action);
                }}
              />
            ) : null}

            {/* ========================================== */}
            {/* 3. QUICK ACTIONS GRID                     */}
            {/* ========================================== */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>QUICK ACTIONS</Text>
            </View>

            <View style={styles.actionGrid}>
              <ActionTile
                color="#10B981"
                bg="#ECFDF5"
                border="#A7F3D0"
                ion="bag-handle"
                label="New Sale"
                sub="Fast counter POS"
                onPress={() => go("Sales")}
              />
              <ActionTile
                color="#F59E0B"
                bg="#FFFBEB"
                border="#FDE68A"
                ion="flash"
                label="Quick Bill"
                sub="1-Click checkout"
                onPress={() => go("QuickSale")}
              />
              <ActionTile
                color="#0079F2"
                bg="#EFF6FF"
                border="#BFDBFE"
                ion="add-circle"
                label="Add Item"
                sub="Scan / Barcode"
                onPress={() => go("Items")}
              />
              <ActionTile
                color="#6366F1"
                bg="#EEF2FF"
                border="#C7D2FE"
                ion="receipt"
                label="Orders"
                sub="Bills & Khata"
                onPress={() => go("Orders")}
              />
            </View>

            {/* ========================================== */}
            {/* 4. LOW STOCK INVENTORY ALERTS             */}
            {/* ========================================== */}
            <View style={styles.sectionHeaderBetween}>
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionTitle}>LOW STOCK ALERTS</Text>
                {lowStockCount > 0 ? (
                  <View style={styles.stockBadgeWrap}>
                    <Text style={styles.stockCountText}>{lowStockCount}</Text>
                  </View>
                ) : null}
              </View>

              {lowStockCount > 3 ? (
                <TouchableOpacity onPress={() => go("LowStock")} style={styles.viewAllBtn} activeOpacity={0.7}>
                  <Text style={styles.viewAllText}>View all</Text>
                  <Ionicons color="#0079F2" name="chevron-forward" size={14} />
                </TouchableOpacity>
              ) : null}
            </View>

            {lowStock.length > 0 ? (
              <View style={styles.stockGrid}>
                {lowStock.slice(0, 4).map((item: any) => (
                  <LowStockCard
                    key={item._id}
                    item={item}
                    onPress={() => go("ProductDetail", { productId: item._id })}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.stockOk}>
                <View style={styles.stockOkIconWrap}>
                  <Ionicons color="#10B981" name="checkmark-circle" size={24} />
                </View>
                <View style={styles.stockOkBody}>
                  <Text style={styles.stockOkTitle}>Inventory is Healthy</Text>
                  <Text style={styles.stockOkSubtitle}>All product stock levels are above the reorder limit.</Text>
                </View>
              </View>
            )}

            {/* ========================================== */}
            {/* 5. MONTHLY PERFORMANCE OVERVIEW            */}
            {/* ========================================== */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>THIS MONTH'S OVERVIEW</Text>
            </View>

            <View style={styles.statGrid}>
              <StatTile
                color="#0D9488"
                bg="#F0FDFA"
                border="#CCFBF1"
                ion="trending-up"
                label="Total Sales"
                value={`₹${formatMoney(data.monthSales)}`}
              />
              <StatTile
                color="#0079F2"
                bg="#EFF6FF"
                border="#DBEAFE"
                ion="cube"
                label="Total Catalog"
                value={`${data.totalProducts} Items`}
              />
              <StatTile
                color="#10B981"
                bg="#ECFDF5"
                border="#D1FAE5"
                ion="arrow-down-circle"
                label="Stock In"
                value={`${movementTotals.totalIn} Units`}
              />
              <StatTile
                color="#EF4444"
                bg="#FEF2F2"
                border="#FEE2E2"
                ion="arrow-up-circle"
                label="Stock Out"
                value={`${movementTotals.totalOut} Units`}
              />
            </View>
          </>
        )}
      </ScrollView>

      <SubscriptionModal
        visible={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        onActivated={() => dashboard.refetch()}
        currentStatus={data?.organization?.subscriptionStatus}
      />
    </SafeAreaView>
  );
}

/* ========================================== */
/* SUB-COMPONENTS                             */
/* ========================================== */

function HomePromoBanner({
  banner,
  onPress,
}: {
  banner: { title?: string; message?: string; ctaLabel?: string; ctaAction?: string; tone?: string };
  onPress: () => void;
}) {
  const tone = banner.tone || "promo";
  const palette =
    tone === "warning"
      ? { bg: "#FFFBEB", border: "#FDE68A", icon: "#D97706", iconBg: "#FEF3C7" }
      : tone === "info"
      ? { bg: "#EFF6FF", border: "#BFDBFE", icon: "#0079F2", iconBg: "#DBEAFE" }
      : { bg: "#F5F3FF", border: "#DDD6FE", icon: "#7C3AED", iconBg: "#EDE9FE" };
  const clickable = Boolean(banner.ctaAction);

  return (
    <TouchableOpacity
      activeOpacity={clickable ? 0.85 : 1}
      disabled={!clickable}
      onPress={onPress}
      style={[styles.promoBanner, { backgroundColor: palette.bg, borderColor: palette.border }]}
    >
      <View style={[styles.promoIcon, { backgroundColor: palette.iconBg }]}>
        <Ionicons
          color={palette.icon}
          name={tone === "warning" ? "warning" : tone === "info" ? "information-circle" : "megaphone"}
          size={20}
        />
      </View>
      <View style={styles.promoCopy}>
        {!!banner.title && <Text numberOfLines={1} style={styles.promoTitle}>{banner.title}</Text>}
        {!!banner.message && <Text numberOfLines={2} style={styles.promoMessage}>{banner.message}</Text>}
        {!!banner.ctaLabel && <Text style={[styles.promoCta, { color: palette.icon }]}>{banner.ctaLabel} →</Text>}
      </View>
      {clickable ? <Ionicons color={palette.icon} name="chevron-forward" size={18} /> : null}
    </TouchableOpacity>
  );
}

function ActionTile({
  color,
  bg,
  border,
  ion,
  label,
  sub,
  onPress,
}: {
  color: string;
  bg: string;
  border: string;
  ion: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.actionTile} activeOpacity={0.75}>
      <View style={[styles.actionIconWrap, { backgroundColor: bg, borderColor: border }]}>
        <Ionicons color={color} name={ion} size={22} />
      </View>
      <View style={styles.actionTextWrap}>
        <Text numberOfLines={1} style={styles.actionLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.actionSub}>{sub}</Text>
      </View>
    </TouchableOpacity>
  );
}

function StatTile({
  color,
  bg,
  border,
  ion,
  label,
  value,
}: {
  color: string;
  bg: string;
  border: string;
  ion: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statTopRow}>
        <View style={[styles.statIconWrap, { backgroundColor: bg, borderColor: border }]}>
          <Ionicons color={color} name={ion} size={15} />
        </View>
        <Text numberOfLines={1} style={styles.statLabel}>{label}</Text>
      </View>
      <Text numberOfLines={1} style={styles.statValue}>{value}</Text>
    </View>
  );
}

function LowStockCard({ item, onPress }: { item: any; onPress: () => void }) {
  const qty = Number(item.stockQty || 0);
  const limit = Number(item.lowStockThreshold ?? item.reorderPoint ?? 0);
  const out = qty <= 0;
  const ratio = limit > 0 ? Math.max(0.06, Math.min(1, qty / limit)) : qty > 0 ? 0.2 : 0.06;
  const imageUrl = Array.isArray(item.images) ? item.images[0] : item.imageUrl || item.image;

  return (
    <TouchableOpacity onPress={onPress} style={styles.stockCard} activeOpacity={0.8}>
      <View style={styles.stockImageWrap}>
        {imageUrl ? (
          <Image resizeMode="cover" source={{ uri: imageUrl }} style={styles.stockImage} />
        ) : (
          <View style={[styles.stockImageFallback, { backgroundColor: out ? "#FEE2E2" : "#FEF3C7" }]}>
            <Ionicons color={out ? "#EF4444" : "#D97706"} name={out ? "alert-circle" : "cube"} size={24} />
          </View>
        )}
        <View style={[styles.stockQtyBadge, out && styles.stockQtyBadgeOut]}>
          <Text style={styles.stockQtyText}>{out ? "Out of Stock" : `${qty} left`}</Text>
        </View>
      </View>

      <Text numberOfLines={1} style={styles.stockName}>{item.name}</Text>
      <Text numberOfLines={1} style={styles.stockSku}>{item.sku ? `SKU: ${item.sku}` : "General Item"}</Text>

      <View style={styles.stockBarTrack}>
        <View
          style={[
            styles.stockBarFill,
            out ? styles.stockBarOut : { backgroundColor: "#F59E0B" },
            { width: `${ratio * 100}%` },
          ]}
        />
      </View>

      <View style={styles.stockCardFooter}>
        <Text style={styles.stockActionText}>Restock</Text>
        <Ionicons color="#0079F2" name="arrow-forward" size={11} />
      </View>
    </TouchableOpacity>
  );
}

/* ========================================== */
/* HELPER FUNCTIONS                           */
/* ========================================== */

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatToday() {
  return new Date().toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
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

/* ========================================== */
/* STYLESHEET                                 */
/* ========================================== */

const styles = StyleSheet.create({
  safe: {
    backgroundColor: "#F8FAFC",
    flex: 1,
  },
  content: {
    alignSelf: "center",
    maxWidth: 1280,
    paddingBottom: 40,
    paddingHorizontal: 16,
    paddingTop: 8,
    width: "100%",
  },

  /* 1. Header */
  header: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 16,
    paddingVertical: 4,
  },
  menuBtn: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 8px rgba(0, 28, 52, 0.04)" } as any,
    }),
  },
  headerCopy: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  greetingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  greetingDot: {
    backgroundColor: "#10B981",
    borderRadius: 999,
    height: 6,
    width: 6,
  },
  greeting: {
    color: "#64748B",
    fontFamily: fonts.medium,
    fontSize: 12,
  },
  ownerName: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 20,
    letterSpacing: -0.4,
    lineHeight: 24,
    marginTop: 1,
  },
  shopStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 1,
  },
  shopCaption: {
    color: "#0079F2",
    fontFamily: fonts.semibold,
    fontSize: 11.5,
  },
  bulletSeparator: {
    color: "#CBD5E1",
    fontSize: 10,
  },
  dateCaption: {
    color: "#94A3B8",
    fontFamily: fonts.regular,
    fontSize: 11.5,
  },
  profileBtn: {
    borderRadius: 14,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#0079F2", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
      android: { elevation: 3 },
      web: { boxShadow: "0 4px 12px rgba(0, 121, 242, 0.25)" } as any,
    }),
  },
  profileGradient: {
    alignItems: "center",
    borderRadius: 14,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  profileText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 16,
    textAlign: "center",
  },

  /* Alerts & Error */
  errorCard: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#FEE2E2",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
    padding: 12,
  },
  errorIconWrap: {
    alignItems: "center",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  errorCopy: { flex: 1 },
  errorTitle: { color: "#991B1B", fontFamily: fonts.semibold, fontSize: 13.5 },
  errorText: { color: "#B91C1C", fontFamily: fonts.regular, fontSize: 11.5, marginTop: 1 },
  alertCard: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    padding: 12,
  },
  trialActivationBanner: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FDE68A",
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    padding: 12,
    ...Platform.select({
      ios: { shadowColor: "#F59926", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6 },
      android: { elevation: 3 },
      web: { boxShadow: "0 2px 8px rgba(245, 153, 38, 0.15)" } as any,
    }),
  },
  trialBannerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  trialBannerIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  trialBannerTitle: {
    fontSize: 13,
    fontFamily: fonts.bold,
    color: "#0D3666",
  },
  trialBannerSub: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: 2,
  },
  trialBannerBtn: {
    backgroundColor: "#F59926",
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  trialBannerBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 12,
  },
  pastDueBanner: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#F87171",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    padding: 12,
  },
  pastDueBannerText: {
    color: "#991B1B",
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12.5,
  },
  alertText: { color: "#991B1B", flex: 1, fontFamily: fonts.medium, fontSize: 12.5 },

  /* 2. Revenue Hero Card */
  moneyCardContainer: {
    borderRadius: 22,
    marginBottom: 18,
    overflow: "hidden",
    ...Platform.select({
      ios: { shadowColor: "#001C34", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16 },
      android: { elevation: 6 },
      web: { boxShadow: "0 10px 30px -5px rgba(0, 28, 52, 0.25)" } as any,
    }),
  },
  moneyCard: {
    borderRadius: 22,
    padding: 20,
    width: "100%",
  },
  moneyHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  moneyOverlineWrap: {
    flex: 1,
  },
  moneyOverline: {
    color: "#93C5FD",
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  segment: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: "row",
    padding: 2,
  },
  segmentItem: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minWidth: 46,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  segmentItemOn: {
    backgroundColor: "#FFFFFF",
  },
  segmentText: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: fonts.medium,
    fontSize: 11.5,
  },
  segmentTextOn: {
    color: "#001C34",
    fontFamily: fonts.bold,
  },
  amountContainer: {
    alignItems: "baseline",
    flexDirection: "row",
    marginTop: 8,
  },
  currencySymbol: {
    color: "#38BDF8",
    fontFamily: fonts.bold,
    fontSize: 24,
    marginRight: 2,
  },
  moneyAmount: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 34,
    letterSpacing: -1,
    lineHeight: 40,
  },
  moneyPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  moneyPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.10)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  moneyPillText: {
    color: "#FFFFFF",
    fontFamily: fonts.semibold,
    fontSize: 11.5,
  },
  profitPill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(52, 211, 153, 0.3)",
  },
  profitPillText: {
    color: "#86EFAC",
    fontFamily: fonts.bold,
    fontSize: 11.5,
  },
  moneyCta: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 16,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 8px rgba(0,0,0,0.15)" } as any,
    }),
  },
  moneyCtaText: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 14,
  },

  /* Promo Banner */
  promoBanner: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
    padding: 12,
    width: "100%",
  },
  promoIcon: {
    alignItems: "center",
    borderRadius: 12,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  promoCopy: { flex: 1, minWidth: 0 },
  promoTitle: { color: "#001C34", fontFamily: fonts.bold, fontSize: 13.5, letterSpacing: -0.2 },
  promoMessage: { color: "#475569", fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  promoCta: { fontFamily: fonts.bold, fontSize: 11.5, marginTop: 3 },

  /* Section Headers */
  sectionHeader: {
    marginBottom: 10,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  sectionHeaderBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    marginTop: 16,
    paddingHorizontal: 2,
  },
  sectionHeaderLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  sectionTitle: {
    color: "#64748B",
    fontFamily: fonts.bold,
    fontSize: 11.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  viewAllBtn: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  viewAllText: {
    color: "#0079F2",
    fontFamily: fonts.semibold,
    fontSize: 12,
  },
  stockBadgeWrap: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  stockCountText: {
    color: "#B45309",
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },

  /* 3. Action Grid */
  actionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  actionTile: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 18,
    borderWidth: 1,
    flexBasis: "23%",
    flexDirection: "row",
    flexGrow: 1,
    gap: 12,
    minHeight: 68,
    minWidth: 140,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Platform.select({
      ios: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 10px rgba(0, 28, 52, 0.03)" } as any,
    }),
  },
  actionIconWrap: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  actionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  actionLabel: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  actionSub: {
    color: "#64748B",
    fontFamily: fonts.regular,
    fontSize: 10.5,
    marginTop: 1,
  },

  /* 4. Low Stock Grid */
  stockGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  stockCard: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: "23%",
    flexGrow: 1,
    minWidth: 140,
    padding: 10,
    ...Platform.select({
      ios: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 10px rgba(0, 28, 52, 0.03)" } as any,
    }),
  },
  stockImageWrap: {
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    height: 84,
    marginBottom: 8,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  stockImage: {
    height: "100%",
    width: "100%",
  },
  stockImageFallback: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  stockQtyBadge: {
    backgroundColor: "rgba(217, 119, 6, 0.92)",
    borderRadius: 999,
    bottom: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: "absolute",
    right: 5,
  },
  stockQtyBadgeOut: {
    backgroundColor: "rgba(239, 68, 68, 0.92)",
  },
  stockQtyText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 9.5,
  },
  stockName: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 12.5,
    letterSpacing: -0.2,
    lineHeight: 16,
  },
  stockSku: {
    color: "#64748B",
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 2,
  },
  stockBarTrack: {
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    height: 4,
    marginTop: 8,
    overflow: "hidden",
    width: "100%",
  },
  stockBarFill: {
    borderRadius: 999,
    height: 4,
  },
  stockBarOut: {
    backgroundColor: "#EF4444",
  },
  stockCardFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 3,
    justifyContent: "flex-end",
    marginTop: 6,
  },
  stockActionText: {
    color: "#0079F2",
    fontFamily: fonts.bold,
    fontSize: 10.5,
  },
  stockOk: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    padding: 14,
    width: "100%",
  },
  stockOkIconWrap: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  stockOkBody: {
    flex: 1,
    minWidth: 0,
  },
  stockOkTitle: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 13.5,
  },
  stockOkSubtitle: {
    color: "#64748B",
    fontFamily: fonts.regular,
    fontSize: 11.5,
    marginTop: 1,
  },

  /* 5. Monthly Performance Grid */
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
  },
  statTile: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 16,
    borderWidth: 1,
    flexBasis: "23%",
    flexGrow: 1,
    minWidth: 140,
    padding: 12,
    ...Platform.select({
      ios: { shadowColor: "#0F172A", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6 },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 10px rgba(0, 28, 52, 0.03)" } as any,
    }),
  },
  statTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  statIconWrap: {
    alignItems: "center",
    borderRadius: 9,
    borderWidth: 1,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  statLabel: {
    color: "#64748B",
    fontFamily: fonts.semibold,
    fontSize: 11.5,
  },
  statValue: {
    color: "#001C34",
    fontFamily: fonts.bold,
    fontSize: 17,
    letterSpacing: -0.4,
    marginTop: 8,
  },
});
