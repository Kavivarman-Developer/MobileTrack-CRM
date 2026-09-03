import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { createElement, useMemo, useState } from "react";
import { Alert, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BarChart } from "react-native-chart-kit";
import { Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
import { api, getFullReport } from "../../services/api";

type RangeField = "from" | "to";

// Builds/reads YYYY-MM-DD using local date parts (not toISOString/UTC) so the
// picker never shifts a day off in timezones ahead of or behind UTC.
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

  // From must never be after To. Rather than blocking the pick with an alert,
  // the other bound is nudged to match — the native/web pickers also constrain
  // the selectable range via min/max so this is mostly a defensive fallback.
  function applyDatePick(field: RangeField, date: Date | undefined) {
    if (!date) return; // cancelled/dismissed - leave existing dates untouched
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.eyebrow}>Business reports</Text>
            <Text style={styles.title}>Full Report</Text>
          </View>
        </View>

        <View style={styles.filters}>
          <DateField label="From" field="from" value={from} otherValue={to} onOpen={openDatePicker} onWebChange={applyDatePick} />
          <DateField label="To" field="to" value={to} otherValue={from} onOpen={openDatePicker} onWebChange={applyDatePick} />
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

        <View style={styles.downloadRow}>
          <TouchableOpacity disabled={downloading !== null} onPress={() => handleDownload("pdf")} style={[styles.downloadButton, downloading === "pdf" && styles.downloadButtonBusy]}>
            <Text style={styles.downloadText}>{downloading === "pdf" ? "Preparing PDF..." : "Download PDF"}</Text>
          </TouchableOpacity>
          <TouchableOpacity disabled={downloading !== null} onPress={() => handleDownload("excel")} style={[styles.downloadButton, styles.downloadButtonAlt, downloading === "excel" && styles.downloadButtonBusy]}>
            <Text style={[styles.downloadText, styles.downloadTextAlt]}>{downloading === "excel" ? "Preparing Excel..." : "Download Excel"}</Text>
          </TouchableOpacity>
        </View>

        {data && (
          <View style={styles.grid}>
            <Metric accent={colors.primary} label="Total Sales" value={`Rs ${formatMoney(data.summary.totalSales)}`} />
            <Metric accent={colors.success} label="Net Profit" value={`Rs ${formatMoney(data.summary.netProfit)}`} />
            <Metric accent={colors.danger} label="Expenses" value={`Rs ${formatMoney(data.summary.totalExpenses)}`} />
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabRow} contentContainerStyle={styles.tabRowContent}>
          {TABS.map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {report.isLoading ? (
          <Empty text="Loading report..." />
        ) : !data ? (
          <Empty text="Could not load report." />
        ) : (
          <>
            {tab === "Sales" && (
              <>
                <View style={styles.panel}>
                  <Text style={styles.section}>Daily sales</Text>
                  <BarChart
                    data={{ labels: chartRows.map((row) => row.date.slice(5)), datasets: [{ data: chartRows.map((row) => row.totalSales) }] }}
                    width={Dimensions.get("window").width - 64}
                    height={220}
                    yAxisLabel="Rs "
                    yAxisSuffix=""
                    chartConfig={{
                      backgroundGradientFrom: colors.surface,
                      backgroundGradientTo: colors.surface,
                      color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                      decimalPlaces: 0,
                      labelColor: () => colors.muted,
                    }}
                    style={styles.chart}
                  />
                </View>
                <View style={styles.panel}>
                  <Text style={styles.section}>Summary table</Text>
                  {salesRows.length ? salesRows.map((row) => (
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
              </>
            )}

            {tab === "Expenses" && (
              <View style={styles.panel}>
                <Text style={styles.section}>Expenses by category (Total Rs {formatMoney(data.expenses.total)})</Text>
                {data.expenses.byCategory.length ? data.expenses.byCategory.map((row) => (
                  <View key={row.category} style={styles.row}>
                    <Text style={styles.rowTitle}>{row.category}</Text>
                    <Text style={styles.rowAmount}>Rs {formatMoney(row.total)}</Text>
                  </View>
                )) : <Empty text="No expenses found for this period." />}
              </View>
            )}

            {tab === "Purchases" && (
              <View style={styles.panel}>
                <Text style={styles.section}>Purchases by vendor (Total Rs {formatMoney(data.purchases.total)})</Text>
                {data.purchases.byVendor.length ? data.purchases.byVendor.map((row) => (
                  <View key={row.vendorId || row.vendorName} style={styles.row}>
                    <View>
                      <Text style={styles.rowTitle}>{row.vendorName}</Text>
                      <Text style={styles.rowMeta}>{row.orderCount} orders</Text>
                    </View>
                    <Text style={styles.rowAmount}>Rs {formatMoney(row.totalAmount)}</Text>
                  </View>
                )) : <Empty text="No purchase orders found for this period." />}
              </View>
            )}

            {tab === "Inventory" && (
              <View style={styles.panel}>
                <Text style={styles.section}>Inventory overview</Text>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>Total products</Text>
                  <Text style={styles.rowAmount}>{data.inventory.totalProducts}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>Total stock value</Text>
                  <Text style={styles.rowAmount}>Rs {formatMoney(data.inventory.totalStockValue)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>Low stock items</Text>
                  <Text style={styles.rowAmount}>{data.inventory.lowStockCount}</Text>
                </View>
                {data.inventory.lowStockItems.length > 0 && (
                  <>
                    <Text style={[styles.section, styles.subSection]}>Low stock</Text>
                    {data.inventory.lowStockItems.map((item) => (
                      <View key={item.sku} style={styles.row}>
                        <View>
                          <Text style={styles.rowTitle}>{item.name}</Text>
                          <Text style={styles.rowMeta}>{item.sku}</Text>
                        </View>
                        <Text style={styles.rowAmount}>{item.stockQty} left</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {tab === "Vendors" && (
              <View style={styles.panel}>
                <Text style={styles.section}>Vendors ({data.vendors.count})</Text>
                {data.vendors.byVendor.length ? data.vendors.byVendor.map((row) => (
                  <View key={row.vendorId || row.vendorName} style={styles.row}>
                    <View>
                      <Text style={styles.rowTitle}>{row.vendorName}</Text>
                      <Text style={styles.rowMeta}>{row.orderCount} orders</Text>
                    </View>
                    <Text style={styles.rowAmount}>Rs {formatMoney(row.totalAmount)}</Text>
                  </View>
                )) : <Empty text="No vendor purchases found for this period." />}
              </View>
            )}

            {tab === "Customers" && (
              <View style={styles.panel}>
                <Text style={styles.section}>Customers ({data.customers.count}) - Pending Rs {formatMoney(data.customers.pendingBalanceTotal)}</Text>
                {data.customers.byCustomer.length ? data.customers.byCustomer.map((row) => (
                  <View key={row.customerId || row.customerName} style={styles.row}>
                    <View>
                      <Text style={styles.rowTitle}>{row.customerName}</Text>
                      <Text style={styles.rowMeta}>{row.invoiceCount} orders</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowAmount}>Rs {formatMoney(row.totalSales)}</Text>
                      {row.pendingBalance > 0 && <Text style={styles.rowMeta}>Pending Rs {formatMoney(row.pendingBalance)}</Text>}
                    </View>
                  </View>
                )) : <Empty text="No customer sales found for this period." />}
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
        <Text style={styles.label}>{label}</Text>
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
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={() => onOpen(field)} activeOpacity={0.7}>
        <Field value={value} editable={false} pointerEvents="none" />
      </TouchableOpacity>
    </View>
  );
}

const webDateInputStyle = {
  backgroundColor: colors.surfaceTint,
  borderColor: colors.border,
  borderRadius: 8,
  borderStyle: "solid",
  borderWidth: 1,
  boxSizing: "border-box",
  color: colors.text,
  fontSize: 15,
  fontWeight: 600,
  height: 50,
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
  header: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  backButton: { alignItems: "center", backgroundColor: colors.blueSoft, borderColor: colors.secondary, borderRadius: 8, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  backText: { color: colors.secondary, fontWeight: "900" },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 2 },
  filters: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  filterHalf: { flex: 1 },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.xs },
  downloadRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  downloadButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, flex: 1, justifyContent: "center", minHeight: 48, paddingHorizontal: spacing.sm },
  downloadButtonAlt: { backgroundColor: colors.success },
  downloadButtonBusy: { opacity: 0.7 },
  downloadText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  downloadTextAlt: { color: "#fff" },
  grid: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  metric: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, overflow: "hidden", padding: spacing.md },
  metricAccent: { borderRadius: 999, height: 5, marginBottom: spacing.sm, width: 34 },
  metricValue: { color: colors.text, fontSize: 16, fontWeight: "900" },
  metricLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  tabRow: { marginBottom: spacing.md },
  tabRowContent: { gap: spacing.xs, paddingRight: spacing.md },
  tab: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  tabTextActive: { color: "#fff" },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  section: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: spacing.sm },
  subSection: { marginTop: spacing.md },
  chart: { borderRadius: 8, marginLeft: -spacing.sm },
  row: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm },
  rowTitle: { color: colors.text, fontWeight: "900" },
  rowMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  rowRight: { alignItems: "flex-end" },
  rowAmount: { color: colors.primaryDark, fontWeight: "900" },
});
