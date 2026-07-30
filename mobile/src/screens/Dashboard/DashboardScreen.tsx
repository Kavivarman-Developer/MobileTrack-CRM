import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Card, Empty, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
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
  const chartData = data?.monthlySales?.length ? data.monthlySales : [{ month: "Now", total: 0 }];
  const chartWidth = Dimensions.get("window").width - 64;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Shop overview</Text>
            <Text style={styles.title}>Dashboard</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>
        {isLoading && <Empty text="Loading dashboard..." />}
        {error && <Empty text="Could not load dashboard." />}
        {data && (
          <>
            <View style={styles.filterRow}>
              <FilterChip active={datePreset === "today"} label="Today" onPress={() => setDatePreset("today")} />
              <FilterChip active={datePreset === "week"} label="7 Days" onPress={() => setDatePreset("week")} />
              <FilterChip active={datePreset === "month"} label="Month" onPress={() => setDatePreset("month")} />
            </View>
            <View style={[styles.alertBanner, data.lowStockProductCount > 0 ? styles.alertHot : styles.alertCalm]}>
              <View>
                <Text style={styles.alertTitle}>
                  {data.lowStockProductCount > 0 ? "Stock needs attention" : "Inventory looks healthy"}
                </Text>
                <Text style={styles.alertText}>
                  {data.lowStockProductCount > 0
                    ? `${data.lowStockProductCount} product${data.lowStockProductCount === 1 ? "" : "s"} near reorder level`
                    : "No low-stock products right now"}
                </Text>
              </View>
              <Text style={styles.alertCount}>{data.lowStockProductCount}</Text>
            </View>
            <View style={styles.grid}>
              <Metric accent={colors.primary} label="Products" sublabel="Active SKUs" value={data.totalProducts} />
              <Metric accent={colors.info} label="Filtered Sales" sublabel={`${data.selectedOrderCount || 0} invoices`} value={`Rs ${formatMoney(data.selectedSales)}`} />
              <Metric accent={colors.purple} label="Month Sales" sublabel="Running month" value={`Rs ${formatMoney(data.monthSales)}`} />
              <Metric accent={colors.accent} label="Filtered Profit" sublabel="Gross margin" value={`Rs ${formatMoney(data.todayProfit)}`} />
            </View>
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.section}>Stock Movement</Text>
                  <Text style={styles.sectionHint}>This month stock in vs stock out</Text>
                </View>
                <Text style={styles.panelPill}>Month</Text>
              </View>
              <View style={styles.movementGrid}>
                <View style={styles.movementBox}>
                  <Text style={styles.movementIn}>{movementTotals.totalIn}</Text>
                  <Text style={styles.movementLabel}>Stock In</Text>
                </View>
                <View style={styles.movementBox}>
                  <Text style={styles.movementOut}>{movementTotals.totalOut}</Text>
                  <Text style={styles.movementLabel}>Stock Out</Text>
                </View>
              </View>
            </View>
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.section}>Monthly sales</Text>
                  <Text style={styles.sectionHint}>Last available sales totals</Text>
                </View>
                <Text style={styles.panelPill}>Rs</Text>
              </View>
              <LineChart
                data={{ labels: chartData.map((item: any) => item.month), datasets: [{ data: chartData.map((item: any) => item.total) }] }}
                width={chartWidth}
                height={210}
                chartConfig={{
                  backgroundGradientFrom: colors.surface,
                  backgroundGradientTo: colors.surface,
                  color: (opacity = 1) => `rgba(252, 128, 25, ${opacity})`,
                  decimalPlaces: 0,
                  labelColor: () => colors.muted,
                  propsForBackgroundLines: { stroke: "#dbeafe" },
                  propsForDots: { r: "4", strokeWidth: "2", stroke: colors.surface },
                }}
                bezier
                style={styles.chart}
              />
            </View>
            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <View>
                  <Text style={styles.section}>Low stock alerts</Text>
                  <Text style={styles.sectionHint}>Products below threshold</Text>
                </View>
                <Text style={styles.panelPill}>{data.lowStockProductCount}</Text>
              </View>
              {data.lowStockProducts?.length ? (
                data.lowStockProducts.map((item: any) => (
                  <View key={item._id} style={styles.stockRow}>
                    <View style={styles.stockMarker} />
                    <View style={styles.stockInfo}>
                      <Text style={styles.stockName}>{item.name}</Text>
                      <Text style={styles.stockSku}>{item.sku || "No SKU"}</Text>
                    </View>
                    <View style={styles.stockQty}>
                      <Text style={styles.stockQtyNumber}>{item.stockQty}</Text>
                      <Text style={styles.stockQtyLabel}>left</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Empty text="No low stock items." />
              )}
            </View>
          </>
        )}
      </ScrollView>
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

function Metric({ accent, label, sublabel, value }: { accent: string; label: string; sublabel: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
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
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "800", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 2 },
  liveBadge: { alignItems: "center", backgroundColor: colors.greenSoft, borderColor: colors.success, borderRadius: 999, borderWidth: 1, flexDirection: "row", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  liveDot: { backgroundColor: colors.success, borderRadius: 5, height: 10, marginRight: 6, width: 10 },
  liveText: { color: colors.text, fontWeight: "800" },
  filterRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  filterChip: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  filterChipActive: { backgroundColor: colors.tealSoft, borderColor: colors.primary },
  filterChipText: { color: colors.text, fontWeight: "800" },
  filterChipTextActive: { color: colors.primaryDark },
  alertBanner: { alignItems: "center", borderRadius: 8, flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md, padding: spacing.md },
  alertHot: { backgroundColor: colors.orangeSoft, borderColor: colors.warning, borderWidth: 1 },
  alertCalm: { backgroundColor: colors.greenSoft, borderColor: colors.success, borderWidth: 1 },
  alertTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  alertText: { color: colors.muted, marginTop: 4 },
  alertCount: { color: colors.accent, fontSize: 30, fontWeight: "900" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  metric: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, minHeight: 126, overflow: "hidden", padding: spacing.md, width: "48%" },
  metricAccent: { borderRadius: 999, height: 5, marginBottom: spacing.md, width: 42 },
  metricValue: { color: colors.text, fontSize: 22, fontWeight: "900" },
  metricLabel: { color: colors.text, fontWeight: "800", marginTop: spacing.xs },
  metricSubLabel: { color: colors.muted, fontSize: 12, marginTop: 3 },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  panelHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  section: { color: colors.text, fontSize: 18, fontWeight: "900" },
  sectionHint: { color: colors.muted, fontSize: 12, marginTop: 3 },
  panelPill: { backgroundColor: colors.background, borderRadius: 999, color: colors.primaryDark, fontWeight: "900", minWidth: 34, overflow: "hidden", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, textAlign: "center" },
  chart: { borderRadius: 8, marginLeft: -spacing.sm },
  stockRow: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", paddingVertical: spacing.sm },
  stockMarker: { backgroundColor: colors.danger, borderRadius: 999, height: 34, marginRight: spacing.sm, width: 5 },
  stockInfo: { flex: 1 },
  stockName: { color: colors.text, fontWeight: "800" },
  stockSku: { color: colors.muted, fontSize: 12, marginTop: 3 },
  stockQty: { alignItems: "center", backgroundColor: colors.orangeSoft, borderRadius: 8, minWidth: 58, padding: spacing.xs },
  stockQtyNumber: { color: colors.danger, fontSize: 18, fontWeight: "900" },
  stockQtyLabel: { color: colors.muted, fontSize: 11 },
  movementGrid: { flexDirection: "row", gap: spacing.sm },
  movementBox: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, padding: spacing.md },
  movementIn: { color: colors.success, fontSize: 26, fontWeight: "900" },
  movementOut: { color: colors.danger, fontSize: 26, fontWeight: "900" },
  movementLabel: { color: colors.muted, fontWeight: "800", marginTop: 4 },
});
