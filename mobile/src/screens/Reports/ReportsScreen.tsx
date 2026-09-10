import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { createElement, useMemo, useState } from "react";
import { Alert, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BarChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import { Badge, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { api, getFullReport } from "../../services/api";

type RangeField = "from" | "to";

function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateInputValue(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 6);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const TABS = ["Sales", "Expenses", "Purchases", "Inventory", "Vendors", "Customers"] as const;
type Tab = (typeof TABS)[number];

export default function ReportsScreen({ navigation }: any) {
  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [tab, setTab] = useState<Tab>("Sales");
  const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);
  const [iosPickerField, setIosPickerField] = useState<RangeField | null>(null);

  function applyDatePick(field: RangeField, date: Date | undefined) {
    if (!date) return;
    const value = toDateInputValue(date);
    if (field === "from") {
      setFrom(value);
      if (value > to) setTo(value);
    } else {
      setTo(value);
      if (value < from) setFrom(value);
    }
  }

  function openDatePicker(field: RangeField) {
    const currentValue = parseDateInputValue(field === "from" ? from : to);
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: currentValue,
        mode: "date",
        maximumDate: field === "from" ? parseDateInputValue(to) : undefined,
        minimumDate: field === "to" ? parseDateInputValue(from) : undefined,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type !== "set") return;
          applyDatePick(field, date);
        },
      });
      return;
    }
    if (Platform.OS === "ios") {
      setIosPickerField(field);
    }
  }

  const report = useQuery({ queryKey: ["full-report", from, to], queryFn: () => getFullReport({ from, to }) });
  const data = report.data;
  const salesRows = data?.sales.daily || [];
  const chartRows = salesRows.length ? salesRows : [{ date: "No data", totalSales: 0, totalProfit: 0, invoiceCount: 0 }];
  const chartWidth = Math.max(Dimensions.get("window").width - spacing.md * 4, 300);

  async function handleDownload(format: "pdf" | "excel") {
    setDownloading(format);
    try {
      const isWeb = Platform.OS === "web";
      const response = await api.get("/reports/full/export", {
        params: { format, from, to },
        responseType: isWeb ? "blob" : "arraybuffer",
      });
      const ext = format === "pdf" ? "pdf" : "xlsx";
      const mimeType = format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      const filename = `full-report-${from}-to-${to}.${ext}`;

      if (isWeb) {
        const blobUrl = URL.createObjectURL(response.data as Blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(blobUrl);
      } else {
        const dir = new Directory(Paths.cache, "reports");
        if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
        const file = new File(dir, filename);
        file.create({ overwrite: true });
        file.write(new Uint8Array(response.data as ArrayBuffer));
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: "Share report" });
        } else {
          Alert.alert("Report saved", file.uri);
        }
      }
    } catch (error: any) {
      Alert.alert("Download failed", error?.response?.data?.message || error?.message || "Could not download the report.");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons color={colors.text} name="chevron-back" size={20} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.eyebrow}>BUSINESS REPORTS</Text>
            <Text style={styles.title}>Full Report</Text>
          </View>
        </View>

        {/* Date Filter Card */}
        <View style={styles.filters}>
          <DateField label="From Date" field="from" value={from} otherValue={to} onOpen={openDatePicker} onWebChange={applyDatePick} />
          <DateField label="To Date" field="to" value={to} otherValue={from} onOpen={openDatePicker} onWebChange={applyDatePick} />
        </View>

        {Platform.OS === "ios" && iosPickerField && (
          <DateTimePicker
            value={parseDateInputValue(iosPickerField === "from" ? from : to)}
            mode="date"
            display="default"
            maximumDate={iosPickerField === "from" ? parseDateInputValue(to) : undefined}
            minimumDate={iosPickerField === "to" ? parseDateInputValue(from) : undefined}
            onChange={(event: DateTimePickerEvent, date?: Date) => {
              const field = iosPickerField;
              setIosPickerField(null);
              if (!field || event.type !== "set") return;
              applyDatePick(field, date);
            }}
          />
        )}

        {/* Download Buttons */}
        <View style={styles.downloadRow}>
          <TouchableOpacity disabled={downloading !== null} onPress={() => handleDownload("pdf")} style={[styles.downloadButton, downloading === "pdf" && styles.downloadButtonBusy]}>
            <Ionicons color="#ffffff" name="document-text-outline" size={16} style={{ marginRight: 6 }} />
            <Text style={styles.downloadText}>{downloading === "pdf" ? "Preparing PDF..." : "Export PDF"}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={downloading !== null} onPress={() => handleDownload("excel")} style={[styles.downloadButton, styles.downloadButtonAlt, downloading === "excel" && styles.downloadButtonBusy]}>
            <Ionicons color="#ffffff" name="grid-outline" size={16} style={{ marginRight: 6 }} />
            <Text style={styles.downloadText}>{downloading === "excel" ? "Preparing Excel..." : "Export Excel"}</Text>
          </TouchableOpacity>
        </View>

        {/* High Level Metrics */}
        {data && (
          <View style={styles.grid}>
            <Metric accent={colors.primary} label="Total Sales" value={`Rs ${formatMoney(data.summary.totalSales)}`} />
            <Metric accent={colors.success} label="Net Profit" value={`Rs ${formatMoney(data.summary.netProfit)}`} />
            <Metric accent={colors.danger} label="Expenses" value={`Rs ${formatMoney(data.summary.totalExpenses)}`} />
          </View>
        )}

        {/* Module Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={styles.tabRowContent}>
          {TABS.map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {report.isLoading ? (
          <Empty icon="analytics-outline" text="Generating business report..." />
        ) : !data ? (
          <Empty icon="alert-circle-outline" text="Could not load report data." />
        ) : (
          <>
            {tab === "Sales" && (
              <>
                <View style={styles.panel}>
                  <Text style={styles.sectionTitle}>Daily Sales Breakdown</Text>
                  <BarChart
                    data={{ labels: chartRows.map((row) => row.date.slice(5)), datasets: [{ data: chartRows.map((row) => row.totalSales) }] }}
                    width={chartWidth}
                    height={220}
                    yAxisLabel="₹"
                    yAxisSuffix=""
                    chartConfig={{
                      backgroundGradientFrom: colors.surface,
                      backgroundGradientTo: colors.surface,
                      color: (opacity = 1) => `rgba(79, 70, 229, ${opacity})`,
                      decimalPlaces: 0,
                      labelColor: () => colors.muted,
                    }}
                    style={styles.chart}
                  />
                </View>
                <View style={styles.panel}>
                  <Text style={styles.sectionTitle}>Daily Sales Table</Text>
                  {salesRows.length ? salesRows.map((row) => (
                    <View key={row.date} style={styles.row}>
                      <View>
                        <Text style={styles.rowTitle}>{row.date}</Text>
                        <Text style={styles.rowMeta}>{row.invoiceCount} invoices</Text>
                      </View>
                      <View style={styles.rowRight}>
                        <Text style={styles.rowAmount}>Rs {formatMoney(row.totalSales)}</Text>
                        <Text style={styles.rowMeta}>Profit: Rs {formatMoney(row.totalProfit)}</Text>
                      </View>
                    </View>
                  )) : <Empty icon="receipt-outline" text="No sales found for this period." />}
                </View>
              </>
            )}

            {tab === "Expenses" && (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Expenses by Category (Total: Rs {formatMoney(data.expenses.total)})</Text>
                {data.expenses.byCategory.length ? data.expenses.byCategory.map((row) => (
                  <View key={row.category} style={styles.row}>
                    <Text style={styles.rowTitle}>{row.category}</Text>
                    <Text style={styles.rowAmount}>Rs {formatMoney(row.total)}</Text>
                  </View>
                )) : <Empty icon="wallet-outline" text="No expenses found for this period." />}
              </View>
            )}

            {tab === "Purchases" && (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Purchases by Vendor (Total: Rs {formatMoney(data.purchases.total)})</Text>
                {data.purchases.byVendor.length ? data.purchases.byVendor.map((row) => (
                  <View key={row.vendorId || row.vendorName} style={styles.row}>
                    <View>
                      <Text style={styles.rowTitle}>{row.vendorName}</Text>
                      <Text style={styles.rowMeta}>{row.orderCount} purchase orders</Text>
                    </View>
                    <Text style={styles.rowAmount}>Rs {formatMoney(row.totalAmount)}</Text>
                  </View>
                )) : <Empty icon="cart-outline" text="No purchase orders found for this period." />}
              </View>
            )}

            {tab === "Inventory" && (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Inventory Overview</Text>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>Total Products</Text>
                  <Text style={styles.rowAmount}>{data.inventory.totalProducts}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>Total Stock Valuation</Text>
                  <Text style={styles.rowAmount}>Rs {formatMoney(data.inventory.totalStockValue)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>Low Stock Items</Text>
                  <Text style={styles.rowAmount}>{data.inventory.lowStockCount}</Text>
                </View>
                {data.inventory.lowStockItems.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, styles.subSection]}>Low Stock Items List</Text>
                    {data.inventory.lowStockItems.map((item) => (
                      <View key={item.sku} style={styles.row}>
                        <View>
                          <Text style={styles.rowTitle}>{item.name}</Text>
                          <Text style={styles.rowMeta}>SKU: {item.sku}</Text>
                        </View>
                        <Badge label={`${item.stockQty} left`} tone="danger" />
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {tab === "Vendors" && (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Vendors ({data.vendors.count})</Text>
                {data.vendors.byVendor.length ? data.vendors.byVendor.map((row) => (
                  <View key={row.vendorId || row.vendorName} style={styles.row}>
                    <View>
                      <Text style={styles.rowTitle}>{row.vendorName}</Text>
                      <Text style={styles.rowMeta}>{row.orderCount} orders</Text>
                    </View>
                    <Text style={styles.rowAmount}>Rs {formatMoney(row.totalAmount)}</Text>
                  </View>
                )) : <Empty icon="people-outline" text="No vendor purchases found for this period." />}
              </View>
            )}

            {tab === "Customers" && (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>Customers ({data.customers.count}) • Pending: Rs {formatMoney(data.customers.pendingBalanceTotal)}</Text>
                {data.customers.byCustomer.length ? data.customers.byCustomer.map((row) => (
                  <View key={row.customerId || row.customerName} style={styles.row}>
                    <View>
                      <Text style={styles.rowTitle}>{row.customerName}</Text>
                      <Text style={styles.rowMeta}>{row.invoiceCount} orders</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowAmount}>Rs {formatMoney(row.totalSales)}</Text>
                      {row.pendingBalance > 0 && <Text style={styles.rowMeta}>Pending: Rs {formatMoney(row.pendingBalance)}</Text>}
                    </View>
                  </View>
                )) : <Empty icon="people-outline" text="No customer sales found for this period." />}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function DateField({
  label,
  field,
  value,
  otherValue,
  onOpen,
  onWebChange,
}: {
  label: string;
  field: RangeField;
  value: string;
  otherValue: string;
  onOpen: (field: RangeField) => void;
  onWebChange: (field: RangeField, date: Date | undefined) => void;
}) {
  if (Platform.OS === "web") {
    return (
      <View style={styles.filterHalf}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {createElement("input", {
          type: "date",
          value,
          min: field === "to" ? otherValue : undefined,
          max: field === "from" ? otherValue : undefined,
          onChange: (e: any) => onWebChange(field, e.target.value ? parseDateInputValue(e.target.value) : undefined),
          style: webDateInputStyle,
        })}
      </View>
    );
  }
  return (
    <View style={styles.filterHalf}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TouchableOpacity onPress={() => onOpen(field)} activeOpacity={0.7}>
        <Field value={value} editable={false} pointerEvents="none" />
      </TouchableOpacity>
    </View>
  );
}

const webDateInputStyle = {
  backgroundColor: colors.surface,
  borderColor: colors.border,
  borderRadius: radius.sm,
  borderStyle: "solid",
  borderWidth: 1,
  boxSizing: "border-box",
  color: colors.text,
  fontSize: 15,
  fontWeight: 500,
  height: 48,
  outline: "none",
  padding: `0 ${spacing.md}px`,
  width: "100%",
} as const;

function Metric({ accent, label, value }: { accent: string; label: string; value: string | number }) {
  return (
    <View style={styles.metric}>
      <View style={[styles.metricAccent, { backgroundColor: accent }]} />
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xl },
  header: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", height: 38, justifyContent: "center", paddingHorizontal: spacing.sm },
  backText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, marginTop: 2 },

  filters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  filterHalf: { flex: 1 },
  fieldLabel: { color: colors.text, ...typography.label, marginBottom: spacing.xs },

  downloadRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  downloadButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, flex: 1, flexDirection: "row", justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.sm },
  downloadButtonAlt: { backgroundColor: colors.success },
  downloadButtonBusy: { opacity: 0.6 },
  downloadText: { color: "#ffffff", fontSize: 14, fontWeight: "600" },

  grid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  metric: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, overflow: "hidden", padding: spacing.md, ...shadows.card },
  metricAccent: { borderRadius: radius.pill, height: 4, marginBottom: spacing.xs, width: 28 },
  metricValue: { color: colors.text, fontSize: 15, fontWeight: "700" },
  metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "500", marginTop: 2 },

  tabRow: { marginBottom: spacing.md },
  tabRowContent: { gap: spacing.xs, paddingRight: spacing.md },
  tab: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 8 },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: "500" },
  tabTextActive: { color: "#ffffff", fontWeight: "700" },

  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  sectionTitle: { color: colors.text, ...typography.h3, marginBottom: spacing.sm },
  subSection: { marginTop: spacing.md },
  chart: { borderRadius: radius.sm, marginLeft: -spacing.sm },

  row: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, alignItems: "center" },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: "600" },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rowAmount: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});
