import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { useAppSelector } from "../../hooks/redux";
import { getDashboard, getStockSummary } from "../../services/api";

type DatePreset = "today" | "week" | "month";

const periodCopy: Record<DatePreset, string> = {
  today: "Today",
  week: "Last 7 days",
  month: "This month",
};

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const user = useAppSelector((state) => state.auth.user);
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [refreshing, setRefreshing] = useState(false);
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

  function go(name: string, params?: object) {
    const drawer = navigation.getParent();
    const stack = drawer?.getParent();
    if (name === "Items" || name === "BarcodeGenerator") return drawer?.navigate(name);
    if (name === "QuickSale" || name === "Billing" || name === "ProductDetail" || name === "LowStock") return (stack || drawer || navigation).navigate(name, params);
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
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={ios.secondary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity accessibilityLabel="Open menu" onPress={() => navigation.getParent()?.openDrawer?.()} style={styles.menuBtn}>
            <Ionicons color={ios.label} name="menu" size={22} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.greeting}>{greeting()}</Text>
            <Text numberOfLines={1} style={styles.ownerName}>{firstName}</Text>
            <Text numberOfLines={1} style={styles.shopCaption}>{shopName} · {formatToday()}</Text>
          </View>
          <View style={styles.profile}>
            <Text style={styles.profileText}>{(user?.name || shopName).slice(0, 1).toUpperCase()}</Text>
          </View>
        </View>

        {dashboard.error && (
          <TouchableOpacity onPress={() => dashboard.refetch()} style={styles.errorCard}>
            <Ionicons color={ios.red} name="cloud-offline-outline" size={22} />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Couldn’t load the shop</Text>
              <Text style={styles.errorText}>Tap to try again</Text>
            </View>
          </TouchableOpacity>
        )}

        {data && (
          <>
            {data.organization?.subscriptionStatus === "past_due" && (
              <View style={styles.alertCard}>
                <Ionicons color={ios.red} name="alert-circle" size={20} />
                <Text style={styles.alertText}>Subscription is overdue. Renew to keep billing open.</Text>
              </View>
            )}

            <View style={styles.moneyCard}>
              <Text style={styles.moneyOverline}>{periodCopy[datePreset]} collection</Text>
              <Text style={styles.moneyAmount}>₹{formatMoney(data.selectedSales)}</Text>
              <View style={styles.moneyPills}>
                <Text style={styles.moneyPill}>{bills} {bills === 1 ? "bill" : "bills"}</Text>
                <Text style={styles.moneyPill}>₹{formatMoney(data.todayProfit)} profit</Text>
              </View>
              <View style={styles.segment}>
                {(["today", "week", "month"] as DatePreset[]).map((key) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setDatePreset(key)}
                    style={[styles.segmentItem, datePreset === key && styles.segmentItemOn]}
                  >
                    <Text style={[styles.segmentText, datePreset === key && styles.segmentTextOn]}>
                      {key === "today" ? "Today" : key === "week" ? "7 days" : "Month"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity onPress={() => go("Sales")} style={styles.moneyCta}>
                <Text style={styles.moneyCtaText}>{bills ? "Open sales" : "Start a sale"}</Text>
                <Ionicons color={ios.dark} name="arrow-forward" size={16} />
              </TouchableOpacity>
            </View>

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

            <Text style={styles.sectionLabel}>Do this now</Text>
            <View style={styles.actionGrid}>
              <ActionTile color={ios.green} ion="bag-handle" label="New sale" onPress={() => go("Sales")} />
              <ActionTile color={ios.orange} ion="flash" label="Quick bill" onPress={() => go("QuickSale")} />
              <ActionTile color={ios.blue} ion="add" label="Add item" onPress={() => go("Items")} />
              <ActionTile color={ios.indigo} ion="receipt" label="Orders" onPress={() => go("Orders")} />
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabelInline}>Low stock</Text>
              {lowStockCount ? <Text style={styles.stockCount}>{lowStockCount}</Text> : null}
              {lowStockCount > 5 ? (
                <TouchableOpacity onPress={() => go("LowStock")} style={styles.viewAllBtn}>
                  <Text style={styles.viewAllText}>View all</Text>
                  <Ionicons color={ios.blue} name="chevron-forward" size={14} />
                </TouchableOpacity>
              ) : null}
            </View>
            {lowStock.length ? (
              <View style={styles.stockGrid}>
                {lowStock.slice(0, 5).map((item: any) => (
                  <LowStockCard
                    key={item._id}
                    item={item}
                    onPress={() => go("ProductDetail", { productId: item._id })}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.stockOk}>
                <View style={[styles.stockIcon, { backgroundColor: ios.green }]}>
                  <Ionicons color="#FFFFFF" name="checkmark" size={18} />
                </View>
                <View style={styles.stockBody}>
                  <Text style={styles.stockName}>Stock looks good</Text>
                  <Text style={styles.stockSku}>Everything is above reorder</Text>
                </View>
              </View>
            )}

            <Text style={styles.sectionLabel}>This month</Text>
            <View style={styles.statGrid}>
              <StatTile color={ios.teal} ion="trending-up" label="Sales" value={`₹${formatMoney(data.monthSales)}`} />
              <StatTile color={ios.blue} ion="albums" label="Items" value={`${data.totalProducts}`} />
              <StatTile color={ios.green} ion="arrow-down" label="Stock in" value={`${movementTotals.totalIn}`} />
              <StatTile color={ios.red} ion="arrow-up" label="Stock out" value={`${movementTotals.totalOut}`} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
      ? { bg: "#FFF4E5", icon: ios.orange, iconBg: "#FF950033" }
      : tone === "info"
      ? { bg: "#E8ECFE", icon: ios.blue, iconBg: "#4F6BF633" }
      : { bg: "#F0ECFF", icon: ios.purple, iconBg: "#8B7CF633" };
  const clickable = Boolean(banner.ctaAction);

  return (
    <TouchableOpacity
      activeOpacity={clickable ? 0.85 : 1}
      disabled={!clickable}
      onPress={onPress}
      style={[styles.promoBanner, { backgroundColor: palette.bg }]}
    >
      <View style={[styles.promoIcon, { backgroundColor: palette.iconBg }]}>
        <Ionicons color={palette.icon} name={tone === "warning" ? "warning" : tone === "info" ? "information-circle" : "megaphone"} size={20} />
      </View>
      <View style={styles.promoCopy}>
        {!!banner.title && <Text numberOfLines={1} style={styles.promoTitle}>{banner.title}</Text>}
        {!!banner.message && <Text numberOfLines={2} style={styles.promoMessage}>{banner.message}</Text>}
        {!!banner.ctaLabel && <Text style={[styles.promoCta, { color: palette.icon }]}>{banner.ctaLabel}</Text>}
      </View>
      {clickable ? <Ionicons color={palette.icon} name="chevron-forward" size={18} /> : null}
    </TouchableOpacity>
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
        <Ionicons color="#FFFFFF" name={ion} size={22} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatTile({
  color,
  ion,
  label,
  value,
}: {
  color: string;
  ion: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={[styles.statIcon, { backgroundColor: color }]}>
        <Ionicons color="#FFFFFF" name={ion} size={14} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
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
    <TouchableOpacity onPress={onPress} style={styles.stockCard}>
      <View style={styles.stockImageWrap}>
        {imageUrl ? (
          <Image resizeMode="cover" source={{ uri: imageUrl }} style={styles.stockImage} />
        ) : (
          <View style={[styles.stockImageFallback, { backgroundColor: out ? ios.red : ios.orange }]}>
            <Ionicons color="#FFFFFF" name={out ? "alert" : "cube"} size={22} />
          </View>
        )}
        <View style={[styles.stockQtyBadge, out && styles.stockQtyBadgeOut]}>
          <Text style={[styles.stockQtyText, out && styles.stockQtyTextOut]}>{out ? "Out" : `${qty}`}</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.stockName}>{item.name}</Text>
      <Text numberOfLines={1} style={styles.stockSku}>{item.sku || "No SKU"}</Text>
      <View style={styles.stockBarTrack}>
        <View style={[styles.stockBarFill, out && styles.stockBarOut, { width: `${ratio * 100}%` }]} />
      </View>
      <Text style={styles.stockLink}>View</Text>
    </TouchableOpacity>
  );
}

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

const styles = StyleSheet.create({
  safe: { backgroundColor: ios.bg, flex: 1 },
  content: { alignSelf: "center", maxWidth: 960, paddingBottom: 88, paddingHorizontal: spacing.md, width: "100%" },

  header: { alignItems: "flex-start", flexDirection: "row", marginBottom: spacing.md, marginTop: 4 },
  headerCopy: { flex: 1, justifyContent: "center", marginHorizontal: spacing.sm, minHeight: 34, minWidth: 0, paddingTop: 1 },
  greeting: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 16 },
  ownerName: { color: ios.label, fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.4, lineHeight: 26, marginTop: 2 },
  shopCaption: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 15, marginTop: 2 },
  menuBtn: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  profile: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  profileText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 15, lineHeight: 18, textAlign: "center" },

  errorCard: {
    alignItems: "center",
    backgroundColor: "#FF3B3014",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    padding: 10,
  },
  errorCopy: { flex: 1 },
  errorTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 15 },
  errorText: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  alertCard: {
    alignItems: "center",
    backgroundColor: "#FF3B3014",
    borderRadius: 12,
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: spacing.xs,
  },
  alertText: { color: ios.label, flex: 1, fontFamily: fonts.medium, fontSize: 13 },

  moneyCard: {
    backgroundColor: ios.dark,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    width: "100%",
  },
  moneyOverline: { color: "rgba(255,255,255,0.62)", fontFamily: fonts.medium, fontSize: 12 },
  moneyAmount: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 32, letterSpacing: -0.8, lineHeight: 38, marginTop: 2 },
  moneyPills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  moneyPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    color: "#FFFFFF",
    fontFamily: fonts.medium,
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  segment: { backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 10, flexDirection: "row", marginTop: spacing.sm, padding: 2 },
  segmentItem: { alignItems: "center", borderRadius: 8, flex: 1, justifyContent: "center", minHeight: 30 },
  segmentItemOn: { backgroundColor: "#FFFFFF" },
  segmentText: { color: "rgba(255,255,255,0.82)", fontFamily: fonts.medium, fontSize: 12 },
  segmentTextOn: { color: ios.label, fontFamily: fonts.semibold },
  moneyCta: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  moneyCtaText: { color: ios.dark, fontFamily: fonts.semibold, fontSize: 14 },

  promoBanner: {
    alignItems: "center",
    borderRadius: 16,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    padding: 10,
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
  promoTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 14, letterSpacing: -0.2 },
  promoMessage: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, lineHeight: 16, marginTop: 2 },
  promoCta: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 4 },

  sectionLabel: {
    color: ios.secondary,
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.2,
    marginBottom: spacing.xs,
    marginLeft: 2,
    marginTop: 14,
    textTransform: "uppercase",
  },
  sectionHead: { alignItems: "center", flexDirection: "row", marginBottom: spacing.xs, marginLeft: 2, marginTop: 14 },
  sectionLabelInline: { color: ios.secondary, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.2, textTransform: "uppercase" },
  viewAllBtn: { alignItems: "center", flexDirection: "row", gap: 2, marginLeft: "auto" },
  viewAllText: { color: ios.blue, fontFamily: fonts.semibold, fontSize: 12 },
  stockCount: {
    backgroundColor: "#FF95001F",
    borderRadius: 999,
    color: ios.orange,
    fontFamily: fonts.semibold,
    fontSize: 11,
    marginLeft: spacing.xs,
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  stockList: { gap: 8 },
  stockGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  stockCard: {
    backgroundColor: ios.card,
    borderRadius: 14,
    flexBasis: "31%",
    flexGrow: 1,
    minWidth: 100,
    maxWidth: 220,
    padding: spacing.xs,
  },
  stockOk: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 16,
    flexDirection: "row",
    padding: 10,
    width: "100%",
  },
  stockIcon: { alignItems: "center", borderRadius: 12, height: 36, justifyContent: "center", width: 36 },
  stockBody: { flex: 1, marginLeft: spacing.sm, minWidth: 0 },
  stockImageWrap: {
    backgroundColor: ios.fill,
    borderRadius: 10,
    height: 78,
    marginBottom: spacing.xs,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  stockImage: { height: "100%", width: "100%" },
  stockImageFallback: {
    alignItems: "center",
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  stockQtyBadge: {
    backgroundColor: "#FF9500E6",
    borderRadius: 999,
    bottom: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    position: "absolute",
    right: 4,
  },
  stockQtyBadgeOut: { backgroundColor: "#EF4444E6" },
  stockQtyText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 10.5 },
  stockQtyTextOut: { color: "#FFFFFF" },
  stockName: { color: ios.label, fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: -0.2, lineHeight: 14, minHeight: 22 },
  stockSku: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 9.5, marginTop: 1 },
  stockBarTrack: { backgroundColor: ios.fill, borderRadius: 999, height: 3, marginTop: spacing.xs, overflow: "hidden", width: "100%" },
  stockBarFill: { backgroundColor: ios.orange, borderRadius: 999, height: 3 },
  stockBarOut: { backgroundColor: ios.red },
  stockLink: { color: ios.blue, fontFamily: fonts.semibold, fontSize: 10.5, marginTop: 4 },

  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" },
  actionTile: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 16,
    flexBasis: "22%",
    flexGrow: 1,
    minWidth: 120,
    minHeight: 76,
    paddingVertical: 10,
  },
  actionIcon: { alignItems: "center", borderRadius: 14, height: 38, justifyContent: "center", width: 38 },
  actionLabel: { color: ios.label, fontFamily: fonts.semibold, fontSize: 13, marginTop: 6 },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, width: "100%" },
  statTile: {
    backgroundColor: ios.card,
    borderRadius: 14,
    flexBasis: "22%",
    flexGrow: 1,
    minWidth: 120,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  statIcon: { alignItems: "center", borderRadius: 8, height: 22, justifyContent: "center", width: 22 },
  statLabel: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 6 },
  statValue: { color: ios.label, fontFamily: fonts.bold, fontSize: 17, letterSpacing: -0.3, marginTop: 2 },
});
