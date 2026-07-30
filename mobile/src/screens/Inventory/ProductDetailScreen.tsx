import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
import { getCompatibleAccessories, getProduct, getStockMovements, Product, restockProduct } from "../../services/api";

function stockState(product: Product) {
  if (product.stockQty <= 0) return { label: "Out", color: colors.danger, bg: colors.redSoft };
  if (product.stockQty <= product.lowStockThreshold) return { label: "Low", color: colors.warning, bg: colors.orangeSoft };
  return { label: "In stock", color: colors.success, bg: colors.greenSoft };
}

export default function ProductDetailScreen({ route, navigation }: any) {
  const { productId } = route.params;
  const [restockOpen, setRestockOpen] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const product = useQuery({ queryKey: ["product", productId], queryFn: () => getProduct(productId) });
  const accessories = useQuery({
    queryKey: ["product-accessories", productId],
    queryFn: () => getCompatibleAccessories(productId),
    enabled: product.data?.type !== "accessory",
  });
  const movements = useQuery({ queryKey: ["stock-movements", productId], queryFn: () => getStockMovements(productId) });
  const status = product.data ? stockState(product.data) : null;
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

  if (product.isLoading) return <Screen><Empty text="Loading product..." /></Screen>;
  if (!product.data) return <Screen><Empty text="Product not found." /></Screen>;

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setRestockOpen(true)} style={styles.restockButton}>
            <Text style={styles.restockText}>Restock</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.hero}>
          {product.data.images?.[0] ? <Image source={{ uri: product.data.images[0] }} style={styles.heroImage} /> : <View style={styles.heroInitial}><Text style={styles.heroInitialText}>{product.data.name.slice(0, 2).toUpperCase()}</Text></View>}
          <View style={styles.heroInfo}>
            <Text style={styles.name}>{product.data.name}</Text>
            <Text style={styles.meta}>{product.data.sku}{product.data.barcode ? ` | ${product.data.barcode}` : ""}</Text>
            <View style={[styles.stockBadge, { backgroundColor: status?.bg }]}>
              <Text style={[styles.stockBadgeText, { color: status?.color }]}>{status?.label} | {product.data.stockQty} left</Text>
            </View>
            <Text style={styles.price}>Rs {formatMoney(product.data.price)}</Text>
          </View>
        </View>

        {product.data.type !== "accessory" && (
          <View style={styles.panel}>
            <Text style={styles.section}>Compatible Accessories</Text>
            {accessories.isLoading ? <Empty text="Loading accessories..." /> : accessories.data?.length ? (
              <FlatList
                data={accessories.data}
                horizontal
                keyExtractor={(item) => item._id}
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => <AccessoryCard item={item} />}
              />
            ) : <Empty text="No accessories linked yet." />}
          </View>
        )}

        <View style={styles.panel}>
          <Text style={styles.section}>Stock History</Text>
          {movementItems.length ? movementItems.map((item) => (
            <View key={item._id} style={styles.movementRow}>
              <View style={[styles.movementBadge, item.type === "IN" ? styles.inBadge : styles.outBadge]}>
                <Text style={[styles.movementBadgeText, item.type === "IN" ? styles.inText : styles.outText]}>{item.type}</Text>
              </View>
              <View style={styles.movementInfo}>
                <Text style={styles.movementTitle}>{item.quantity} units | {item.reason}</Text>
                <Text style={styles.movementMeta}>{new Date(item.createdAt).toLocaleString()}</Text>
                {!!item.note && <Text style={styles.movementMeta}>{item.note}</Text>}
              </View>
            </View>
          )) : <Empty text="No stock movements yet." />}
        </View>
      </ScrollView>

      <Modal transparent animationType="slide" visible={restockOpen}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <Text style={styles.section}>Restock Product</Text>
            <Field keyboardType="numeric" onChangeText={setQuantity} placeholder="Quantity" value={quantity} />
            <Field onChangeText={setNote} placeholder="Note" value={note} />
            <Button loading={restock.isPending} onPress={() => restock.mutate()} title="Add stock" />
            <TouchableOpacity onPress={() => setRestockOpen(false)} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function AccessoryCard({ item }: { item: Product }) {
  const status = stockState(item);
  return (
    <View style={styles.accessoryCard}>
      {item.images?.[0] ? <Image source={{ uri: item.images[0] }} style={styles.accessoryImage} /> : <View style={styles.accessoryInitial}><Text style={styles.heroInitialText}>{item.name.slice(0, 2).toUpperCase()}</Text></View>}
      <Text numberOfLines={2} style={styles.accessoryName}>{item.name}</Text>
      <Text style={styles.accessoryPrice}>Rs {formatMoney(item.price)}</Text>
      <View style={[styles.smallBadge, { backgroundColor: status.bg }]}>
        <Text style={[styles.smallBadgeText, { color: status.color }]}>{status.label}</Text>
      </View>
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  backButton: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.md },
  backText: { color: colors.primaryDark, fontWeight: "900" },
  restockButton: { backgroundColor: colors.primary, borderRadius: 8, minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.md },
  restockText: { color: "#fff", fontWeight: "900" },
  hero: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: "row", marginBottom: spacing.md, padding: spacing.md },
  heroImage: { borderRadius: 8, height: 108, marginRight: spacing.md, width: 108 },
  heroInitial: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: 8, height: 108, justifyContent: "center", marginRight: spacing.md, width: 108 },
  heroInitialText: { color: colors.primaryDark, fontWeight: "900" },
  heroInfo: { flex: 1 },
  name: { color: colors.text, fontSize: 22, fontWeight: "900" },
  meta: { color: colors.muted, marginTop: 4 },
  price: { color: colors.text, fontSize: 20, fontWeight: "900", marginTop: spacing.sm },
  stockBadge: { alignSelf: "flex-start", borderRadius: 999, marginTop: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  stockBadgeText: { fontSize: 12, fontWeight: "900" },
  panel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  section: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
  accessoryCard: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginRight: spacing.sm, padding: spacing.sm, width: 140 },
  accessoryImage: { borderRadius: 8, height: 66, marginBottom: spacing.sm, width: "100%" },
  accessoryInitial: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: 8, height: 66, justifyContent: "center", marginBottom: spacing.sm, width: "100%" },
  accessoryName: { color: colors.text, fontWeight: "900", minHeight: 38 },
  accessoryPrice: { color: colors.text, fontWeight: "900", marginTop: 3 },
  smallBadge: { alignSelf: "flex-start", borderRadius: 999, marginTop: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  smallBadgeText: { fontSize: 11, fontWeight: "900" },
  movementRow: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", paddingVertical: spacing.sm },
  movementBadge: { alignItems: "center", borderRadius: 8, height: 36, justifyContent: "center", marginRight: spacing.sm, width: 46 },
  inBadge: { backgroundColor: colors.greenSoft },
  outBadge: { backgroundColor: colors.redSoft },
  movementBadgeText: { fontWeight: "900" },
  inText: { color: colors.success },
  outText: { color: colors.danger },
  movementInfo: { flex: 1 },
  movementTitle: { color: colors.text, fontWeight: "900" },
  movementMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  sheetBackdrop: { backgroundColor: "rgba(0,0,0,0.35)", flex: 1, justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 8, borderTopRightRadius: 8, padding: spacing.md },
  cancelButton: { alignItems: "center", minHeight: 48, justifyContent: "center", marginTop: spacing.sm },
  cancelText: { color: colors.muted, fontWeight: "900" },
});
