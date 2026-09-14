import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useMemo, useRef, useState } from "react";
import { Alert, FlatList, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Badge, Button, Empty, Field, PageHeader, Screen, Sheet } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { getCompatibleAccessories, getProduct, getStockMovements, Product, restockProduct } from "../../services/api";

function stockTone(product: Product): "danger" | "warning" | "success" {
  if (product.stockQty <= 0) return "danger";
  if (product.stockQty <= product.lowStockThreshold) return "warning";
  return "success";
}

function stockLabel(product: Product): string {
  if (product.stockQty <= 0) return "Out of Stock";
  if (product.stockQty <= product.lowStockThreshold) return "Low Stock";
  return "In Stock";
}

export default function ProductDetailScreen({ route, navigation }: any) {
  const { productId } = route.params;
  const [restockOpen, setRestockOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [downloadingBarcode, setDownloadingBarcode] = useState(false);
  const qrRef = useRef<any>(null);
  const queryClient = useQueryClient();
  const product = useQuery({ queryKey: ["product", productId], queryFn: () => getProduct(productId) });
  const accessories = useQuery({
    queryKey: ["product-accessories", productId],
    queryFn: () => getCompatibleAccessories(productId),
    enabled: product.data?.type !== "accessory",
  });
  const movements = useQuery({ queryKey: ["stock-movements", productId], queryFn: () => getStockMovements(productId) });
  const movementItems = useMemo(() => movements.data?.items || [], [movements.data]);
  const restock = useMutation({
    mutationFn: () => restockProduct(productId, { quantity: Number(quantity), note }),
    onSuccess: () => {
      setRestockOpen(false);
      setQuantity("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-movements", productId] });
    },
    onError: (error: Error) => Alert.alert("Restock failed", error.message),
  });

  function getBarcodeDataUrl(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!qrRef.current) return reject(new Error("Barcode is not ready yet"));
      qrRef.current.toDataURL((data: string) => resolve(data));
    });
  }

  async function handleDownloadBarcode(value: string) {
    setDownloadingBarcode(true);
    try {
      const base64 = await getBarcodeDataUrl();
      const dir = new Directory(Paths.cache, "barcodes");
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
      const filename = `${value.replace(/[^a-zA-Z0-9-_]/g, "_")}.png`;
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
      setDownloadingBarcode(false);
    }
  }

  if (product.isLoading) return <Screen><Empty icon="cube-outline" text="Loading product..." /></Screen>;
  if (!product.data) return <Screen><Empty icon="alert-circle-outline" text="Product not found." /></Screen>;

  const tone = stockTone(product.data);
  const barcodeValue = product.data.barcode || product.data.sku;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <PageHeader
          left={(
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons color={colors.text} name="chevron-back" size={20} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>
          )}
          right={(
            <TouchableOpacity onPress={() => setRestockOpen(true)} style={styles.restockButton}>
              <Ionicons color="#ffffff" name="add-circle-outline" size={16} style={{ marginRight: 4 }} />
              <Text style={styles.restockText}>Restock</Text>
            </TouchableOpacity>
          )}
        />

        {/* Product Hero */}
        <View style={styles.hero}>
          {product.data.images?.[0] ? (
            <Image source={{ uri: product.data.images[0] }} style={styles.heroImage} />
          ) : (
            <View style={styles.heroInitial}>
              <Text style={styles.heroInitialText}>{product.data.name.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.heroInfo}>
            <Text style={styles.name}>{product.data.name}</Text>
            <Text style={styles.meta}>SKU: {product.data.sku}{product.data.barcode ? ` • ${product.data.barcode}` : ""}</Text>
            <View style={{ marginTop: spacing.xs }}>
              <Badge label={`${stockLabel(product.data)} (${product.data.stockQty} left)`} tone={tone} />
            </View>
            <Text style={styles.price}>₹{formatMoney(product.data.price)}</Text>
          </View>
        </View>

        {/* Product Barcode */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Product Barcode</Text>
          {barcodeValue ? (
            <View style={styles.barcodeWrap}>
              <View style={styles.barcodeBox}>
                <QRCode getRef={(c) => { qrRef.current = c; }} size={160} value={barcodeValue} />
              </View>
              <Text style={styles.barcodeValue}>{barcodeValue}</Text>
              <Text style={styles.barcodeHint}>Scan this with the Sales / Quick Sale scanner to add this product instantly.</Text>
              <Button
                icon="download-outline"
                loading={downloadingBarcode}
                onPress={() => handleDownloadBarcode(barcodeValue)}
                title="Download Barcode"
              />
            </View>
          ) : <Empty icon="barcode-outline" text="Add a SKU or barcode to this product to generate one." />}
        </View>

        {/* Compatible Accessories */}
        {product.data.type !== "accessory" && (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>Compatible Accessories</Text>
            {accessories.isLoading ? <Empty icon="cube-outline" text="Loading accessories..." /> : accessories.data?.length ? (
              <FlatList
                data={accessories.data}
                horizontal
                keyExtractor={(item) => item._id}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => <AccessoryCard item={item} />}
              />
            ) : <Empty icon="link-outline" text="No compatible accessories linked yet." />}
          </View>
        )}

        {/* Stock History */}
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Stock Movement History</Text>
          {movementItems.length ? movementItems.map((item) => (
            <View key={item._id} style={styles.movementRow}>
              <Badge icon={item.type === "IN" ? "arrow-down-circle-outline" : "arrow-up-circle-outline"} label={item.type} tone={item.type === "IN" ? "success" : "danger"} />
              <View style={styles.movementInfo}>
                <Text style={styles.movementTitle}>{item.quantity} units • {item.reason}</Text>
                <Text style={styles.movementMeta}>{new Date(item.createdAt).toLocaleString()}</Text>
                {!!item.note && <Text style={styles.movementMeta}>{item.note}</Text>}
              </View>
            </View>
          )) : <Empty icon="time-outline" text="No stock movements recorded yet." />}
        </View>
      </ScrollView>

      <Sheet hint="Add incoming stock to this SKU" onClose={() => setRestockOpen(false)} title="Restock quantity" visible={restockOpen}>
        <Field keyboardType="numeric" onChangeText={setQuantity} placeholder="Quantity to add (e.g. 10)" value={quantity} />
        <Field onChangeText={setNote} placeholder="Restock note / supplier reference" value={note} />
        <Button icon="checkmark-circle-outline" loading={restock.isPending} onPress={() => restock.mutate()} title="Confirm Add Stock" />
      </Sheet>
    </Screen>
  );
}

function AccessoryCard({ item }: { item: Product }) {
  const tone = stockTone(item);
  return (
    <View style={styles.accessoryCard}>
      {item.images?.[0] ? <Image source={{ uri: item.images[0] }} style={styles.accessoryImage} /> : <View style={styles.accessoryInitial}><Text style={styles.heroInitialText}>{item.name.slice(0, 2).toUpperCase()}</Text></View>}
      <Text numberOfLines={2} style={styles.accessoryName}>{item.name}</Text>
      <Text style={styles.accessoryPrice}>₹{formatMoney(item.price)}</Text>
      <View style={{ marginTop: 4 }}>
        <Badge label={stockLabel(item)} tone={tone} />
      </View>
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  container: { paddingBottom: spacing.xl },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", height: 38, justifyContent: "center", paddingHorizontal: spacing.sm },
  backText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  restockButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, flexDirection: "row", height: 38, justifyContent: "center", paddingHorizontal: spacing.md },
  restockText: { color: "#ffffff", fontWeight: "600", fontSize: 13 },

  hero: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  heroImage: { borderRadius: radius.sm, height: 100, marginRight: spacing.md, width: 100 },
  heroInitial: { alignItems: "center", backgroundColor: colors.primaryLight, borderRadius: radius.sm, height: 100, justifyContent: "center", marginRight: spacing.md, width: 100 },
  heroInitialText: { color: colors.primary, fontWeight: "700", fontSize: 20 },
  heroInfo: { flex: 1 },
  name: { color: colors.text, fontSize: 18, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  price: { color: colors.primary, fontSize: 18, fontWeight: "700", marginTop: spacing.xs },

  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  sectionTitle: { color: colors.text, ...typography.h3, marginBottom: spacing.sm },

  barcodeWrap: { alignItems: "center" },
  barcodeBox: { backgroundColor: "#ffffff", borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.md },
  barcodeValue: { color: colors.text, fontSize: 14, fontWeight: "700", letterSpacing: 1 },
  barcodeHint: { color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: spacing.sm, textAlign: "center" },

  accessoryCard: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginRight: spacing.xs, padding: spacing.sm, width: 130 },
  accessoryImage: { borderRadius: radius.sm, height: 60, marginBottom: spacing.xs, width: "100%" },
  accessoryInitial: { alignItems: "center", backgroundColor: colors.primaryLight, borderRadius: radius.sm, height: 60, justifyContent: "center", marginBottom: spacing.xs, width: "100%" },
  accessoryName: { color: colors.text, fontSize: 13, fontWeight: "600", minHeight: 34 },
  accessoryPrice: { color: colors.text, fontWeight: "700", marginTop: 2 },

  movementRow: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm, alignItems: "center" },
  movementInfo: { flex: 1 },
  movementTitle: { color: colors.text, fontSize: 13, fontWeight: "600" },
  movementMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },

  sheetBackdrop: { backgroundColor: "rgba(15, 23, 42, 0.45)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.md },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs },
});
