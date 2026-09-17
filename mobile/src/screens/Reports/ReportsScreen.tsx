import DateTimePicker, { DateTimePickerAndroid, DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useQuery } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { createElement, useMemo, useState } from "react";
import { Alert, Dimensions, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BarChart } from "react-native-chart-kit";
import { Ionicons } from "@expo/vector-icons";
import {
  Badge,
  Empty,
  Field,
  IconButton,
  IosScreenHeader,
  Screen,
  StatStrip,
} from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, radius, spacing } from "../../constants/theme";
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
  const chartWidth = Math.min(Math.max(Dimensions.get("window").width - spacing.md * 4, 300), 960);

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
        <IosScreenHeader
          eyebrow="Reports"
          left={(
            <IconButton
              accessibilityLabel="Back"
              icon="chevron-back"
              onPress={() => navigation.goBack()}
              tone="primary"
            />
          )}
          title="Reports"
        />

        <StatStrip
          items={[
            { label: "Sales", value: data ? `₹${formatMoney(data.summary.totalSales)}` : "—", icon: "trending-up-outline", tone: "purple" },
            { label: "Profit", value: data ? `₹${formatMoney(data.summary.netProfit)}` : "—", icon: "cash-outline", tone: "green" },
            { label: "Expenses", value: data ? `₹${formatMoney(data.summary.totalExpenses)}` : "—", icon: "wallet-outline", tone: "orange" },
          ]}
        />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Date range</Text>
          <View style={styles.filters}>
            <DateField label="From" field="from" value={from} otherValue={to} onOpen={openDatePicker} onWebChange={applyDatePick} />
            <DateField label="To" field="to" value={to} otherValue={from} onOpen={openDatePicker} onWebChange={applyDatePick} />
          </View>
          <View style={styles.heroActions}>
            <TouchableOpacity
              disabled={downloading !== null}
              onPress={() => handleDownload("pdf")}
              style={[styles.heroCta, downloading === "pdf" && styles.downloadBusy]}
            >
              <Ionicons color={ios.navy} name="document-text-outline" size={16} />
              <Text style={styles.heroCtaText}>{downloading === "pdf" ? "Preparing…" : "Export PDF"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              disabled={downloading !== null}
              onPress={() => handleDownload("excel")}
              style={[styles.heroCta, downloading === "excel" && styles.downloadBusy]}
            >
              <Ionicons color={ios.navy} name="grid-outline" size={16} />
              <Text style={styles.heroCtaText}>{downloading === "excel" ? "Preparing…" : "Export Excel"}</Text>
            </TouchableOpacity>
          </View>
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

        <View style={styles.tabWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabTrack}>
            {TABS.map((t) => {
              const on = tab === t;
              return (
                <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabPill, on && styles.tabPillOn]}>
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {report.isLoading ? (
          <Empty icon="analytics-outline" text="Generating business report..." />
        ) : !data ? (
          <Empty icon="alert-circle-outline" text="Could not load report data." />
        ) : (
          <>
            {tab === "Sales" && (
              <>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Daily sales</Text>
                  <BarChart
                    data={{ labels: chartRows.map((row) => row.date.slice(5)), datasets: [{ data: chartRows.map((row) => row.totalSales) }] }}
                    width={chartWidth}
                    height={220}
                    yAxisLabel="₹"
                    yAxisSuffix=""
                    chartConfig={{
                      backgroundGradientFrom: ios.card,
                      backgroundGradientTo: ios.card,
                      color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
                      decimalPlaces: 0,
                      labelColor: () => ios.secondary,
                    }}
                    style={styles.chart}
                  />
                </View>
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Daily table</Text>
                  {salesRows.length ? salesRows.map((row, index) => (
                    <View key={row.date} style={[styles.row, index === 0 && styles.rowFirst]}>
                      <View>
                        <Text style={styles.rowTitle}>{row.date}</Text>
                        <Text style={styles.rowMeta}>{row.invoiceCount} invoices</Text>
                      </View>
                      <View style={styles.rowRight}>
                        <Text style={styles.rowAmount}>₹{formatMoney(row.totalSales)}</Text>
                        <Text style={styles.rowMeta}>Profit ₹{formatMoney(row.totalProfit)}</Text>
                      </View>
                    </View>
                  )) : <Empty icon="receipt-outline" text="No sales found for this period." />}
                </View>
              </>
            )}

            {tab === "Expenses" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>By category · ₹{formatMoney(data.expenses.total)}</Text>
                {data.expenses.byCategory.length ? data.expenses.byCategory.map((row, index) => (
                  <View key={row.category} style={[styles.row, index === 0 && styles.rowFirst]}>
                    <Text style={styles.rowTitle}>{row.category}</Text>
                    <Text style={styles.rowAmount}>₹{formatMoney(row.total)}</Text>
                  </View>
                )) : <Empty icon="wallet-outline" text="No expenses found for this period." />}
              </View>
            )}

            {tab === "Purchases" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>By vendor · ₹{formatMoney(data.purchases.total)}</Text>
                {data.purchases.byVendor.length ? data.purchases.byVendor.map((row, index) => (
                  <View key={row.vendorId || row.vendorName} style={[styles.row, index === 0 && styles.rowFirst]}>
                    <View>
                      <Text style={styles.rowTitle}>{row.vendorName}</Text>
                      <Text style={styles.rowMeta}>{row.orderCount} purchase orders</Text>
                    </View>
                    <Text style={styles.rowAmount}>₹{formatMoney(row.totalAmount)}</Text>
                  </View>
                )) : <Empty icon="cart-outline" text="No purchase orders found for this period." />}
              </View>
            )}

            {tab === "Inventory" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Inventory overview</Text>
                <View style={[styles.row, styles.rowFirst]}>
                  <Text style={styles.rowTitle}>Total products</Text>
                  <Text style={styles.rowAmount}>{data.inventory.totalProducts}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>Stock valuation</Text>
                  <Text style={styles.rowAmount}>₹{formatMoney(data.inventory.totalStockValue)}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.rowTitle}>Low stock items</Text>
                  <Text style={styles.rowAmount}>{data.inventory.lowStockCount}</Text>
                </View>
                {data.inventory.lowStockItems.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, styles.subSection]}>Low stock</Text>
                    {data.inventory.lowStockItems.map((item, index) => (
                      <View key={item.sku} style={[styles.row, index === 0 && styles.rowFirst]}>
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
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Vendors ({data.vendors.count})</Text>
                {data.vendors.byVendor.length ? data.vendors.byVendor.map((row, index) => (
                  <View key={row.vendorId || row.vendorName} style={[styles.row, index === 0 && styles.rowFirst]}>
                    <View>
                      <Text style={styles.rowTitle}>{row.vendorName}</Text>
                      <Text style={styles.rowMeta}>{row.orderCount} orders</Text>
                    </View>
                    <Text style={styles.rowAmount}>₹{formatMoney(row.totalAmount)}</Text>
                  </View>
                )) : <Empty icon="people-outline" text="No vendor purchases found for this period." />}
              </View>
            )}

            {tab === "Customers" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>
                  Customers ({data.customers.count}) · Pending ₹{formatMoney(data.customers.pendingBalanceTotal)}
                </Text>
                {data.customers.byCustomer.length ? data.customers.byCustomer.map((row, index) => (
                  <View key={row.customerId || row.customerName} style={[styles.row, index === 0 && styles.rowFirst]}>
                    <View>
                      <Text style={styles.rowTitle}>{row.customerName}</Text>
                      <Text style={styles.rowMeta}>{row.invoiceCount} orders</Text>
                    </View>
                    <View style={styles.rowRight}>
                      <Text style={styles.rowAmount}>₹{formatMoney(row.totalSales)}</Text>
                      {row.pendingBalance > 0 && <Text style={styles.rowMeta}>Pending ₹{formatMoney(row.pendingBalance)}</Text>}
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
  backgroundColor: ios.fill,
  borderColor: "transparent",
  borderRadius: 10,
  borderStyle: "solid",
  borderWidth: 0,
  boxSizing: "border-box",
  color: ios.label,
  fontSize: 15,
  fontWeight: 500,
  height: 48,
  outline: "none",
  padding: `0 ${spacing.md}px`,
  width: "100%",
} as const;

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xl },
  card: {
    backgroundColor: ios.card,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    color: ios.label,
    fontFamily: fonts.bold,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  subSection: { marginTop: spacing.md },
  fieldLabel: {
    color: ios.secondary,
    fontFamily: fonts.semibold,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },

  filters: { flexDirection: "row", gap: spacing.sm },
  filterHalf: { flex: 1 },

  heroActions: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.md },
  heroCta: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: radius.md,
    flex: 1,
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  heroCtaText: { color: ios.navy, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },
  downloadBusy: { opacity: 0.6 },

  tabWrap: {
    backgroundColor: ios.fill,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    padding: 2,
  },
  tabTrack: {
    flexDirection: "row",
    gap: spacing.xxs,
  },
  tabPill: {
    alignItems: "center",
    borderRadius: radius.sm,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 11,
  },
  tabPillOn: { backgroundColor: ios.card },
  tabText: { color: ios.secondary, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },
  tabTextOn: { color: ios.label },

  chart: { borderRadius: radius.sm, marginLeft: -spacing.sm },

  row: {
    alignItems: "center",
    borderTopColor: ios.separator,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
  },
  rowFirst: { borderTopWidth: StyleSheet.hairlineWidth },
  rowTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 14, fontWeight: "600" },
  rowMeta: { color: ios.secondary, fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: "flex-end" },
  rowAmount: { color: ios.blue, fontFamily: fonts.bold, fontSize: 14, fontWeight: "700" },
});
