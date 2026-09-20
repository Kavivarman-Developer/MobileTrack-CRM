import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import barcodes from "jsbarcode/src/barcodes";
import { useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Barcode from "react-native-barcode-svg";
import { captureRef } from "react-native-view-shot";
import { Badge, Button, Empty, Field, IconButton, IosScreenHeader, IosSearchBar, IosSegment, Screen } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { getProducts, Product } from "../../services/api";

type BarcodeFormat = "CODE128" | "EAN13" | "UPC" | "CODE39";
type Tab = "custom" | "products";

const formats: { key: BarcodeFormat; label: string; hint: string }[] = [
  { key: "CODE128", label: "CODE128", hint: "Most flexible — letters + numbers" },
  { key: "EAN13", label: "EAN-13", hint: "Exactly 12-13 digit number" },
  { key: "UPC", label: "UPC-A", hint: "Exactly 11-12 digit number" },
  { key: "CODE39", label: "CODE39", hint: "Letters, numbers, - . $ / + % space" },
];

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function encodeCode128Rects(value: string, singleBarWidth: number, height: number) {
  const encoder = new barcodes.CODE128(value, {});
  if (!encoder.valid()) throw new Error(`"${value}" is not valid for CODE128`);
  const encoded = encoder.encode() as any;
  const flat: { data: string }[] = [];
  const flatten = (item: any) => (Array.isArray(item) ? item.forEach(flatten) : flat.push(item));
  flatten(encoded);

  const rects: string[] = [];
  let x = 0;
  for (const entry of flat) {
    const binary = entry.data;
    let barStart = -1;
    for (let i = 0; i <= binary.length; i++) {
      const bit = binary[i];
      if (bit === "1" && barStart === -1) barStart = i;
      if ((bit !== "1" || i === binary.length) && barStart !== -1) {
        const rectX = x + barStart * singleBarWidth;
        const rectWidth = (i - barStart) * singleBarWidth;
        rects.push(`<rect x="${rectX}" y="0" width="${rectWidth}" height="${height}" fill="#000000"/>`);
        barStart = -1;
      }
    }
    x += binary.length * singleBarWidth;
  }
  return { rects, totalWidth: x };
}

function buildStickerSheetHtml(items: { value: string; label: string }[]) {
  const barHeight = 55;
  const singleBarWidth = 2;
  const cells = items.map(({ value, label }) => {
    try {
      const { rects, totalWidth } = encodeCode128Rects(value, singleBarWidth, barHeight);
      return `
        <div class="cell">
          <svg width="${totalWidth}" height="${barHeight}" viewBox="0 0 ${totalWidth} ${barHeight}" preserveAspectRatio="xMidYMid meet">${rects.join("")}</svg>
          <div class="label">${escapeHtml(label)}</div>
        </div>
      `;
    } catch {
      return `<div class="cell"><div class="error">Invalid barcode: ${escapeHtml(label)}</div></div>`;
    }
  }).join("");

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Arial, sans-serif; margin: 0; padding: 12px; }
          .grid { display: flex; flex-wrap: wrap; gap: 10px; }
          .cell { border: 1px dashed #999999; border-radius: 6px; box-sizing: border-box; padding: 10px 8px; text-align: center; width: 31%; page-break-inside: avoid; }
          .cell svg { height: 45px; max-width: 100%; width: 100%; }
          .label { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; margin-top: 4px; word-break: break-all; }
          .error { color: #b91c1c; font-size: 11px; padding: 12px 0; }
        </style>
      </head>
      <body>
        <div class="grid">${cells}</div>
      </body>
    </html>
  `;
}

export default function BarcodeGeneratorScreen({ navigation }: any) {
  const [tab, setTab] = useState<Tab>("custom");
  const [value, setValue] = useState("");
  const [format, setFormat] = useState<BarcodeFormat>("CODE128");
  const [generated, setGenerated] = useState<{ value: string; format: BarcodeFormat } | null>(null);
  const [barcodeError, setBarcodeError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [sheetDownloading, setSheetDownloading] = useState(false);
  const [sheetPrinting, setSheetPrinting] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const shotRef = useRef<View>(null);
  const products = useQuery({ queryKey: ["products", ""], queryFn: () => getProducts("") });
  const productList = products.data || [];
  const filteredProducts = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    if (!keyword) return productList;
    return productList.filter((item) => `${item.name} ${item.sku} ${item.barcode || ""}`.toLowerCase().includes(keyword));
  }, [productList, productSearch]);
  const selectedProducts = useMemo(() => productList.filter((item) => !excludedIds.has(item._id)), [productList, excludedIds]);
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every((item) => !excludedIds.has(item._id));

  function toggleProduct(id: string) {
    setExcludedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setExcludedIds((current) => {
      const next = new Set(current);
      filteredProducts.forEach((item) => (allFilteredSelected ? next.add(item._id) : next.delete(item._id)));
      return next;
    });
  }

  function stickerItems() {
    return selectedProducts.map((item) => ({ value: item.barcode || item.sku, label: item.barcode || item.sku }));
  }

  async function handleDownloadSheet() {
    if (!selectedProducts.length) {
      Alert.alert("No products selected", "Select at least one product to build the sticker sheet.");
      return;
    }
    setSheetDownloading(true);
    try {
      const html = buildStickerSheetHtml(stickerItems());
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share barcode stickers" });
      } else {
        Alert.alert("Sticker sheet saved", uri);
      }
    } catch (error: any) {
      Alert.alert("Download failed", error?.message || "Could not build the sticker sheet.");
    } finally {
      setSheetDownloading(false);
    }
  }

  async function handlePrintSheet() {
    if (!selectedProducts.length) {
      Alert.alert("No products selected", "Select at least one product to print stickers.");
      return;
    }
    setSheetPrinting(true);
    try {
      const html = buildStickerSheetHtml(stickerItems());
      await Print.printAsync({ html });
    } catch (error: any) {
      Alert.alert("Print failed", error?.message || "Could not print. Make sure a printer is set up on this device.");
    } finally {
      setSheetPrinting(false);
    }
  }

  function handleGenerate() {
    const trimmed = value.trim();
    if (!trimmed) {
      Alert.alert("Missing value", "Enter a SKU or value to generate a barcode.");
      return;
    }
    setBarcodeError("");
    setGenerated({ value: trimmed, format });
  }

  async function captureBarcodePng(): Promise<string> {
    if (!shotRef.current) throw new Error("Barcode is not ready yet");
    return captureRef(shotRef, { format: "png", quality: 1, result: "base64" });
  }

  async function handleDownload() {
    if (!generated) return;
    setDownloading(true);
    try {
      const base64 = await captureBarcodePng();
      const dir = new Directory(Paths.cache, "barcodes");
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const filename = `${generated.value.replace(/[^a-zA-Z0-9-_]/g, "_")}.png`;
      const file = new File(dir, filename);
      file.create({ overwrite: true });
      file.write(base64, { encoding: "base64" });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, { mimeType: "image/png", dialogTitle: "Share barcode" });
      } else {
        Alert.alert("Barcode saved", file.uri);
      }
    } catch (error: any) {
      Alert.alert("Download failed", error?.message || "Could not download the barcode.");
    } finally {
      setDownloading(false);
    }
  }

  async function handlePrint() {
    if (!generated) return;
    setPrinting(true);
    try {
      const base64 = await captureBarcodePng();
      const html = `
        <html>
          <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
            <img src="data:image/png;base64,${base64}" style="max-width:90%;" />
          </body>
        </html>
      `;
      await Print.printAsync({ html });
    } catch (error: any) {
      Alert.alert("Print failed", error?.message || "Could not print. Make sure a printer is set up on this device.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="Inventory tools"
        left={<IconButton accessibilityLabel="Go back" icon="chevron-back" onPress={() => navigation.goBack()} />}
        right={<Badge icon="barcode-outline" label="Tool" tone="info" />}
        title="Barcodes"
      />

      <View style={styles.segmentWrap}>
        <IosSegment
          onChange={setTab}
          options={[
            { key: "custom", label: "Custom" },
            { key: "products", label: "Product sheet" },
          ]}
          value={tab}
        />
      </View>

      {tab === "custom" ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>SKU / barcode value</Text>
            <Text style={styles.cardHint}>Enter a SKU or code to generate a scannable barcode.</Text>
            <Field autoCapitalize="characters" onChangeText={setValue} placeholder="e.g. SKU-12345" value={value} />

            <Text style={[styles.cardTitle, styles.formatTitle]}>Barcode format</Text>
            <View style={styles.formatGrid}>
              {formats.map((item) => {
                const isActive = format === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    onPress={() => setFormat(item.key)}
                    style={[styles.formatChip, isActive && styles.formatChipActive]}
                  >
                    <Text style={[styles.formatLabel, isActive && styles.formatLabelActive]}>{item.label}</Text>
                    <Text style={[styles.formatHint, isActive && styles.formatHintActive]}>{item.hint}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Button icon="barcode-outline" onPress={handleGenerate} title="Generate barcode" />
          </View>

          <View style={styles.card}>
            {generated ? (
              <>
                <View style={styles.previewHeader}>
                  <Text style={styles.cardTitle}>Live preview</Text>
                  <Badge icon="checkmark-circle-outline" label="Ready" tone="success" />
                </View>
                <View collapsable={false} ref={shotRef} style={styles.barcodeCard}>
                  <Barcode
                    backgroundColor="#ffffff"
                    format={generated.format}
                    height={90}
                    lineColor="#000000"
                    maxWidth={280}
                    onError={(error: Error) => setBarcodeError(error.message)}
                    singleBarWidth={2}
                    value={generated.value}
                  />
                  <Text style={styles.barcodeValue}>{generated.value}</Text>
                </View>
                {!!barcodeError && <Text style={styles.errorText}>{barcodeError}</Text>}
                <View style={styles.infoCallout}>
                  <Ionicons color={ios.blue} name="information-circle-outline" size={18} />
                  <Text style={styles.infoCalloutText}>Display full-screen or print to scan with your barcode scanner.</Text>
                </View>
                <View style={styles.actionRow}>
                  <View style={styles.actionHalf}>
                    <Button icon="download-outline" loading={downloading} onPress={handleDownload} title="Download" />
                  </View>
                  <View style={styles.actionHalf}>
                    <Button icon="print-outline" loading={printing} onPress={handlePrint} title="Print" variant="secondary" />
                  </View>
                </View>
              </>
            ) : (
              <Empty icon="barcode-outline" text="Generate a barcode to preview, download, or print it." />
            )}
          </View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.listHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.previewHeader}>
                  <Text style={styles.cardTitle}>Product barcodes</Text>
                  <Badge
                    icon="cube-outline"
                    label={`${selectedProducts.length}/${productList.length}`}
                    tone={selectedProducts.length > 0 ? "info" : "neutral"}
                  />
                </View>
                <Text style={styles.cardHint}>Each selected item produces a CODE128 sticker.</Text>
              </View>
              <TouchableOpacity onPress={toggleSelectAll} style={styles.selectAll}>
                <Ionicons color={ios.blue} name={allFilteredSelected ? "checkbox" : "square-outline"} size={18} />
                <Text style={styles.selectAllText}>{allFilteredSelected ? "Deselect" : "Select all"}</Text>
              </TouchableOpacity>
            </View>

            <IosSearchBar onChangeText={setProductSearch} placeholder="Search name, SKU, barcode…" style={styles.search} value={productSearch} />

            {products.isLoading ? (
              <Empty icon="cube-outline" text="Loading products…" />
            ) : filteredProducts.length ? (
              filteredProducts.map((item: Product) => {
                const checked = !excludedIds.has(item._id);
                return (
                  <TouchableOpacity key={item._id} onPress={() => toggleProduct(item._id)} style={styles.productRow}>
                    <Ionicons color={checked ? ios.blue : ios.secondary} name={checked ? "checkbox" : "square-outline"} size={22} />
                    <View style={styles.productAvatar}>
                      <Ionicons color={ios.blue} name="cube-outline" size={16} />
                    </View>
                    <View style={styles.productInfo}>
                      <Text numberOfLines={1} style={styles.productName}>{item.name}</Text>
                      <Text style={styles.productMeta}>{item.barcode || item.sku}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <Empty
                icon="cube-outline"
                text={productList.length ? "No products match your search." : "No products in inventory yet."}
              />
            )}
          </View>

          <View style={styles.actionRow}>
            <View style={styles.actionHalf}>
              <Button icon="download-outline" loading={sheetDownloading} onPress={handleDownloadSheet} title="Download PDF" />
            </View>
            <View style={styles.actionHalf}>
              <Button icon="print-outline" loading={sheetPrinting} onPress={handlePrintSheet} title="Print all" variant="secondary" />
            </View>
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: ios.bg },
  segmentWrap: { marginBottom: spacing.xxs },
  content: { paddingBottom: spacing.xl, paddingTop: 8 },
  card: {
    backgroundColor: ios.card,
    borderRadius: 18,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  cardTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 16 },
  cardHint: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 13, marginBottom: 8, marginTop: 2 },
  formatTitle: { marginBottom: spacing.xs, marginTop: spacing.sm },
  formatGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: 11 },
  formatChip: {
    backgroundColor: ios.fill,
    borderRadius: 12,
    minWidth: "47%",
    padding: 8,
  },
  formatChipActive: { backgroundColor: "#007AFF14" },
  formatLabel: { color: ios.label, fontFamily: fonts.semibold, fontSize: 13 },
  formatLabelActive: { color: ios.blue },
  formatHint: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  formatHintActive: { color: ios.blue },
  previewHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  barcodeCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderColor: ios.separator,
    borderRadius: 14,
    borderStyle: "dashed",
    borderWidth: 1.5,
    marginBottom: 8,
    padding: spacing.md,
  },
  barcodeValue: { color: ios.label, fontFamily: fonts.bold, fontSize: 14, letterSpacing: 1.5, marginTop: spacing.xs },
  errorText: { color: ios.red, fontFamily: fonts.semibold, fontSize: 12, marginBottom: spacing.xs },
  infoCallout: {
    alignItems: "center",
    backgroundColor: "#007AFF14",
    borderRadius: 12,
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: 11,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  infoCalloutText: { color: ios.blue, flex: 1, fontFamily: fonts.medium, fontSize: 12 },
  listHeader: { marginBottom: spacing.xxs },
  selectAll: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#007AFF14",
    borderRadius: 999,
    flexDirection: "row",
    gap: spacing.xxs,
    marginTop: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.sm,
  },
  selectAllText: { color: ios.blue, fontFamily: fonts.semibold, fontSize: 12 },
  search: { marginBottom: spacing.xs, marginTop: spacing.xs },
  productRow: {
    alignItems: "center",
    borderTopColor: ios.separator,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.xs,
    minHeight: 42,
    paddingVertical: spacing.xs,
  },
  productAvatar: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: 10,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  productInfo: { flex: 1 },
  productName: { color: ios.label, fontFamily: fonts.semibold, fontSize: 14 },
  productMeta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionHalf: { flex: 1 },
});
