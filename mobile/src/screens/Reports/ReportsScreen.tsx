import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BarChart } from "react-native-chart-kit";
import { Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
import { getSalesReport } from "../../services/api";

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export default function ReportsScreen({ navigation }: any) {
  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const report = useQuery({ queryKey: ["sales-report", from, to], queryFn: () => getSalesReport({ from, to }) });
  const rows = report.data || [];
  const totals = rows.reduce((acc, row) => ({
    sales: acc.sales + row.totalSales,
    profit: acc.profit + row.totalProfit,
    invoices: acc.invoices + row.invoiceCount,
  }), { sales: 0, profit: 0, invoices: 0 });
  const chartRows = rows.length ? rows : [{ date: "No data", totalSales: 0, totalProfit: 0, invoiceCount: 0 }];

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.eyebrow}>Business reports</Text>
            <Text style={styles.title}>Sales Report</Text>
          </View>
        </View>
        <View style={styles.filters}>
          <View style={styles.filterHalf}>
            <Text style={styles.label}>From</Text>
            <Field onChangeText={setFrom} placeholder="YYYY-MM-DD" value={from} />
          </View>
          <View style={styles.filterHalf}>
            <Text style={styles.label}>To</Text>
            <Field onChangeText={setTo} placeholder="YYYY-MM-DD" value={to} />
          </View>
        </View>
        <View style={styles.grid}>
          <Metric accent={colors.primary} label="Sales" value={`Rs ${formatMoney(totals.sales)}`} />
          <Metric accent={colors.success} label="Profit" value={`Rs ${formatMoney(totals.profit)}`} />
          <Metric accent={colors.secondary} label="Invoices" value={totals.invoices} />
        </View>
        <View style={styles.panel}>
          <Text style={styles.section}>Daily sales</Text>
          {report.isLoading ? <Empty text="Loading report..." /> : (
            <BarChart
              data={{ labels: chartRows.map((row) => row.date.slice(5)), datasets: [{ data: chartRows.map((row) => row.totalSales) }] }}
              width={Dimensions.get("window").width - 64}
              height={220}
              yAxisLabel="Rs "
              yAxisSuffix=""
              chartConfig={{
                backgroundGradientFrom: colors.surface,
                backgroundGradientTo: colors.surface,
                color: (opacity = 1) => `rgba(252, 128, 25, ${opacity})`,
                decimalPlaces: 0,
                labelColor: () => colors.muted,
              }}
              style={styles.chart}
            />
          )}
        </View>
        <View style={styles.panel}>
          <Text style={styles.section}>Summary table</Text>
          {rows.length ? rows.map((row) => (
            <View key={row.date} style={styles.row}>
              <View>
                <Text style={styles.rowTitle}>{row.date}</Text>
                <Text style={styles.rowMeta}>{row.invoiceCount} invoices</Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.rowAmount}>Rs {formatMoney(row.totalSales)}</Text>
                <Text style={styles.rowMeta}>Profit Rs {formatMoney(row.totalProfit)}</Text>
              </View>
            </View>
          )) : <Empty text="No sales found for this period." />}
        </View>
      </ScrollView>
    </Screen>
  );
}

function Metric({ accent, label, value }: { accent: string; label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  backButton: { alignItems: "center", backgroundColor: colors.blueSoft, borderColor: colors.secondary, borderRadius: 8, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  backText: { color: colors.secondary, fontWeight: "900" },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 2 },
  filters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  filterHalf: { flex: 1 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.xs },
  grid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  metric: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, overflow: "hidden", padding: spacing.md },
  metricAccent: { borderRadius: 999, height: 5, marginBottom: spacing.sm, width: 34 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: "900" },
  metricLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  section: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
  chart: { borderRadius: 8, marginLeft: -spacing.sm },
  row: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  rowTitle: { color: colors.text, fontWeight: "900" },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  rowRight: { alignItems: "flex-end" },
  rowAmount: { color: colors.primaryDark, fontWeight: "900" },
});
