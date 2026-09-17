import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Empty, IosScreenHeader, IosSearchBar, Screen } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { getProducts, Product } from "../../services/api";

export default function LowStockScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");
  const products = useQuery({ queryKey: ["products", ""], queryFn: () => getProducts("") });

  const lowStock = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (products.data || [])
      .filter((item) => item.stockQty <= item.lowStockThreshold)
      .filter((item) => {
        if (!keyword) return true;
        return item.name.toLowerCase().includes(keyword) || item.sku.toLowerCase().includes(keyword);
      })
      .sort((a, b) => a.stockQty - b.stockQty);
  }, [products.data, search]);

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="Stock alerts"
        left={(
          <TouchableOpacity accessibilityLabel="Back" onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons color={ios.label} name="chevron-back" size={22} />
          </TouchableOpacity>
        )}
        title="Low stock"
      />

      <FlatList
        data={lowStock}
        keyExtractor={(item) => item._id}
        numColumns={3}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View>
            <IosSearchBar onChangeText={setSearch} placeholder="Search low stock items…" value={search} />
            <Text style={styles.countLabel}>
              {products.isLoading ? "Loading…" : `${lowStock.length} item${lowStock.length === 1 ? "" : "s"} need attention`}
            </Text>
          </View>
        )}
        ListEmptyComponent={(
          <Empty
            icon="checkmark-circle-outline"
            text={products.isLoading ? "Loading low stock…" : "No low stock items right now."}
          />
        )}
        renderItem={({ item }) => (
          <LowStockTile
            item={item}
            onPress={() => navigation.navigate("ProductDetail", { productId: item._id })}
          />
        )}
      />
    </Screen>
  );
}

function LowStockTile({ item, onPress }: { item: Product; onPress: () => void }) {
  const qty = Number(item.stockQty || 0);
  const limit = Number(item.lowStockThreshold ?? item.reorderPoint ?? 0);
  const out = qty <= 0;
  const ratio = limit > 0 ? Math.max(0.06, Math.min(1, qty / limit)) : qty > 0 ? 0.2 : 0.06;
  const imageUrl = item.images?.[0];

  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.imageWrap}>
        {imageUrl ? (
          <Image resizeMode="cover" source={{ uri: imageUrl }} style={styles.image} />
        ) : (
          <View style={[styles.imageFallback, { backgroundColor: out ? ios.red : ios.orange }]}>
            <Ionicons color="#FFFFFF" name={out ? "alert" : "cube"} size={22} />
          </View>
        )}
        <View style={[styles.qtyBadge, out && styles.qtyBadgeOut]}>
          <Text style={styles.qtyText}>{out ? "Out" : `${qty}`}</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.name}>{item.name}</Text>
      <Text numberOfLines={1} style={styles.sku}>{item.sku || "No SKU"}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, out && styles.barOut, { width: `${ratio * 100}%` }]} />
      </View>
      <Text style={styles.meta}>{limit ? `Reorder at ${limit}` : "Below reorder"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: ios.bg, flex: 1 },
  backBtn: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  listContent: { paddingBottom: spacing.xxxl },
  countLabel: {
    color: ios.secondary,
    fontFamily: fonts.medium,
    fontSize: 13,
    marginBottom: spacing.sm,
    marginTop: spacing.xxs,
  },
  gridRow: { gap: 8, marginBottom: 8 },
  card: {
    backgroundColor: ios.card,
    borderRadius: 16,
    flex: 1,
    maxWidth: "32%",
    padding: spacing.xs,
  },
  imageWrap: {
    backgroundColor: ios.fill,
    borderRadius: 12,
    height: 86,
    marginBottom: spacing.xs,
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  image: { height: "100%", width: "100%" },
  imageFallback: { alignItems: "center", height: "100%", justifyContent: "center", width: "100%" },
  qtyBadge: {
    backgroundColor: "#FF9500E6",
    borderRadius: 999,
    bottom: 6,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    position: "absolute",
    right: 6,
  },
  qtyBadgeOut: { backgroundColor: "#EF4444E6" },
  qtyText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 11 },
  name: { color: ios.label, fontFamily: fonts.semibold, fontSize: 12, letterSpacing: -0.2, lineHeight: 15, minHeight: 24 },
  sku: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 10, marginTop: 2 },
  barTrack: { backgroundColor: ios.fill, borderRadius: 999, height: 4, marginTop: spacing.xs, overflow: "hidden", width: "100%" },
  barFill: { backgroundColor: ios.orange, borderRadius: 999, height: 4 },
  barOut: { backgroundColor: ios.red },
  meta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 10, marginTop: 5 },
});
