import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Badge, Empty, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { getDashboard, getStockSummary } from "../../services/api";

type DatePreset = "today" | "week" | "month";

export default function DashboardScreen() {
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard", dateRange], queryFn: () => getDashboard(dateRange) });
  const monthRange = useMemo(() => getDateRange("month"), []);
  const stockSummary = useQuery({ queryKey: ["stock-summary", monthRange], queryFn: () => getStockSummary({ from: monthRange.dateFrom, to: monthRange.dateTo }) });
  const movementTotals = useMemo(() => {
    const rows = stockSummary.data || [];
    return {
      totalIn: rows.reduce((sum, row) => sum + row.totalIn, 0),
      totalOut: rows.reduce((sum, row) => sum + row.totalOut, 0),
    };
  }, [stockSummary.data]);
  const chartData = (data?.monthlySales?.length ? data.monthlySales : [{ month: "Now", total: 0 }]).map((item: any) => ({
    month: String(item.month || "Now"),
    total: Number.isFinite(Number(item.total)) ? Number(item.total) : 0,
  }));
  const chartValues = chartData.map((item: any) => item.total);
  const chartWidth = Dimensions.get("window").width - spacing.md * 2 - spacing.md * 2;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>SHOP OVERVIEW</Text>
            <Text style={styles.title}>Dashboard</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>

        {isLoading && <Empty icon="cloud-download-outline" text="Loading shop analytics..." />}
        {error && <Empty icon="warning-outline" text="Could not load dashboard data." />}

        {data && (
          <>
            {/* Subscription Alert */}
            {data.organization?.subscriptionStatus === "past_due" && (
              <View style={[styles.alertBanner, styles.alertDue]}>
                <View style={[styles.alertIconWrap, { backgroundColor: colors.orangeSoft }]}>
                  <Ionicons color={colors.warning} name="card-outline" size={20} />
                </View>
                <View style={styles.alertCopy}>
                  <Text style={styles.alertTitle}>Subscription Past Due</Text>
                  <Text style={styles.alertText}>Service is active, but billing requires your attention.</Text>
                </View>
              </View>
            )}

            {/* Date filter chips */}
            <View style={styles.filterRow}>
              <FilterChip active={datePreset === "today"} icon="calendar-outline" label="Today" onPress={() => setDatePreset("today")} />
              <FilterChip active={datePreset === "week"} icon="time-outline" label="7 Days" onPress={() => setDatePreset("week")} />
              <FilterChip active={datePreset === "month"} icon="stats-chart-outline" label="Month" onPress={() => setDatePreset("month")} />
            </View>

            {/* Inventory Status Alert Banner */}
            <View style={[styles.alertBanner, data.lowStockProductCount > 0 ? styles.alertHot : styles.alertCalm]}>
              <View style={[styles.alertIconWrap, { backgroundColor: data.lowStockProductCount > 0 ? colors.orangeSoft : colors.greenSoft }]}>
                <Ionicons
                  color={data.lowStockProductCount > 0 ? colors.warning : colors.success}
                  name={data.lowStockProductCount > 0 ? "alert-circle" : "checkmark-circle"}
                  size={22}
                />
              </View>
              <View style={styles.alertCopy}>
                <Text style={styles.alertTitle}>
                  {data.lowStockProductCount > 0 ? "Stock Needs Attention" : "Inventory Looks Healthy"}
                </Text>
                <Text style={styles.alertText}>
                  {data.lowStockProductCount > 0
                    ? `${data.lowStockProductCount} product${data.lowStockProductCount === 1 ? "" : "s"} near reorder level`
                    : "All active items are above threshold"}
                </Text>
              </View>
            </View>

            {/* Metric grid */}
            <View style={styles.grid}>
              <Metric icon="cube-outline" iconBg={colors.blueSoft} iconColor={colors.info} label="Active Products" sublabel="Total SKUs" value={data.totalProducts} />
              <Metric icon="receipt-outline" iconBg={colors.tealSoft} iconColor={colors.primary} label="Filtered Sales" sublabel={`${data.selectedOrderCount || 0} invoices`} value={`₹${formatMoney(data.selectedSales)}`} />
              <Metric icon="trending-up-outline" iconBg={colors.purpleSoft} iconColor={colors.purple} label="Month Sales" sublabel="Running month" value={`₹${formatMoney(data.monthSales)}`} />
              <Metric icon="cash-outline" iconBg={colors.orangeSoft} iconColor={colors.accent} label="Filtered Profit" sublabel="Gross margin" value={`₹${formatMoney(data.todayProfit)}`} />
            </View>

            {/* Stock movement */}
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Stock Movement</Text>
                  <Text style={styles.sectionHint}>Stock In vs Stock Out this month</Text>
                </View>
                <Badge label="Month" tone="info" />
              </View>
              <View style={styles.movementGrid}>
                <View style={[styles.movementBox, styles.movementBoxIn]}>
                  <Ionicons color={colors.success} name="arrow-down-circle" size={22} />
                  <Text style={styles.movementIn}>{movementTotals.totalIn}</Text>
                  <Text style={styles.movementLabel}>Stock In</Text>
                </View>
                <View style={[styles.movementBox, styles.movementBoxOut]}>
                  <Ionicons color={colors.danger} name="arrow-up-circle" size={22} />
                  <Text style={styles.movementOut}>{movementTotals.totalOut}</Text>
                  <Text style={styles.movementLabel}>Stock Out</Text>
                </View>
              </View>
            </View>

            {/* Sales chart */}
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Monthly Sales Trend</Text>
                  <Text style={styles.sectionHint}>Last available sales total progression</Text>
                </View>
                <Badge label="INR ₹" tone="neutral" />
              </View>
              <LineChart
                data={{ labels: chartData.map((item: any) => item.month), datasets: [{ data: chartValues.length ? chartValues : [0] }] }}
                width={chartWidth}
                height={200}
                chartConfig={{
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
                  decimalPlaces: 0,
                  labelColor: () => colors.muted,
                  propsForBackgroundLines: { stroke: colors.border, strokeDasharray: "4" },
                  propsForDots: { r: "4", strokeWidth: "2", stroke: colors.surface },
                }}
                bezier
                style={styles.chart}
              />
            </View>

            {/* Low stock list */}
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Low Stock Alerts</Text>
                  <Text style={styles.sectionHint}>Items requiring immediate reorder</Text>
                </View>
                <Badge label={String(data.lowStockProductCount)} tone={data.lowStockProductCount > 0 ? "warning" : "success"} />
              </View>
              {data.lowStockProducts?.length ? (
                data.lowStockProducts.map((item: any) => (
                  <View key={item._id} style={styles.stockRow}>
                    <View style={styles.stockMarker} />
                    <View style={styles.stockInfo}>
                      <Text style={styles.stockName}>{item.name}</Text>
                      <Text style={styles.stockSku}>SKU: {item.sku || "N/A"}</Text>
                    </View>
                    <View style={styles.stockQty}>
                      <Text style={styles.stockQtyNumber}>{item.stockQty}</Text>
                      <Text style={styles.stockQtyLabel}>units left</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Empty icon="checkmark-done-circle-outline" text="No low stock items right now." />
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function FilterChip({ active, icon, label, onPress }: { active: boolean; icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <Ionicons color={active ? "#ffffff" : colors.text} name={icon} size={14} style={{ marginRight: 5 }} />
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

function Metric({ icon, iconBg, iconColor, label, sublabel, value }: { icon: keyof typeof Ionicons.glyphMap; iconBg: string; iconColor: string; label: string; sublabel: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons color={iconColor} name={icon} size={18} />
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricSubLabel}>{sublabel}</Text>
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xl },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, marginTop: 2 },
  liveBadge: { alignItems: "center", backgroundColor: colors.greenSoft, borderRadius: radius.pill, flexDirection: "row", paddingHorizontal: spacing.sm, paddingVertical: 6 },
  liveDot: { backgroundColor: colors.success, borderRadius: 4, height: 8, marginRight: 6, width: 8 },
  liveText: { color: colors.success, fontSize: 12, fontWeight: "700" },

  filterRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.md },
  filterChip: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row", paddingHorizontal: spacing.md, paddingVertical: 8, minHeight: 38 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  filterChipTextActive: { color: "#ffffff" },

  alertBanner: { alignItems: "center", borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, flexDirection: "row", marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  alertHot: { backgroundColor: colors.orangeSoft, borderColor: colors.warning },
  alertCalm: { backgroundColor: colors.greenSoft, borderColor: colors.success },
  alertDue: { backgroundColor: colors.redSoft, borderColor: colors.danger },
  alertIconWrap: { alignItems: "center", borderRadius: radius.pill, height: 36, justifyContent: "center", marginRight: spacing.sm, width: 36 },
  alertCopy: { flex: 1 },
  alertTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  alertText: { color: colors.muted, fontSize: 12, fontWeight: "500", marginTop: 2 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  metric: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, minHeight: 128, padding: spacing.md, width: "48%", ...shadows.card },
  metricIconWrap: { alignItems: "center", borderRadius: radius.sm, height: 36, justifyContent: "center", marginBottom: spacing.sm, width: 36 },
  metricValue: { color: colors.text, ...typography.metricNumber },
  metricLabel: { color: colors.text, fontSize: 13, fontWeight: "600", marginTop: 4 },
  metricSubLabel: { color: colors.muted, fontSize: 11, fontWeight: "500", marginTop: 2 },

  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  panelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  sectionTitle: { color: colors.text, ...typography.h3 },
  sectionHint: { color: colors.muted, fontSize: 12, fontWeight: "500", marginTop: 2 },

  chart: { borderRadius: radius.sm, marginLeft: -spacing.sm },

  movementGrid: { flexDirection: "row", gap: spacing.sm },
  movementBox: { alignItems: "flex-start", borderRadius: radius.sm, flex: 1, padding: spacing.md },
  movementBoxIn: { backgroundColor: colors.greenSoft },
  movementBoxOut: { backgroundColor: colors.redSoft },
  movementIn: { color: colors.success, fontSize: 24, fontWeight: "700", marginTop: 6 },
  movementOut: { color: colors.danger, fontSize: 24, fontWeight: "700", marginTop: 6 },
  movementLabel: { color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },

  stockRow: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", paddingVertical: spacing.sm },
  stockMarker: { backgroundColor: colors.warning, borderRadius: radius.pill, height: 28, marginRight: spacing.sm, width: 4 },
  stockInfo: { flex: 1 },
  stockName: { color: colors.text, fontSize: 14, fontWeight: "600" },
  stockSku: { color: colors.muted, fontSize: 12, fontWeight: "500", marginTop: 2 },
  stockQty: { alignItems: "center", backgroundColor: colors.orangeSoft, borderRadius: radius.sm, minWidth: 64, paddingHorizontal: spacing.xs, paddingVertical: 6 },
  stockQtyNumber: { color: colors.danger, fontSize: 16, fontWeight: "700" },
  stockQtyLabel: { color: colors.muted, fontSize: 10, fontWeight: "600" },
});
