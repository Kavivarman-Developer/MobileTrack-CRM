import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Empty, FabButton, Field, IconButton, IosFormSheet, IosScreenHeader, IosSearchBar, Screen, SelectOption, StatStrip } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { createInventoryAdjustment, getInventoryAdjustments, getProducts, InventoryAdjustment, Product } from "../../services/api";

export default function InventoryAdjustmentsScreen({ navigation }: any) {
  const [productId, setProductId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"increase" | "decrease">("increase");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const products = useQuery({ queryKey: ["products", ""], queryFn: () => getProducts("") });
  const adjustments = useQuery({ queryKey: ["inventory-adjustments"], queryFn: getInventoryAdjustments });
  const queryClient = useQueryClient();
  const productOptions = useMemo(() => {
    const keyword = productSearch.trim().toLowerCase();
    return (products.data || [])
      .filter((item) => !keyword || `${item.name} ${item.sku}`.toLowerCase().includes(keyword))
      .slice(0, 8);
  }, [productSearch, products.data]);
  const items = adjustments.data || [];
  const adjustmentStats = useMemo(() => {
    const increases = items.filter((item) => item.adjustmentType === "increase").length;
    return {
      total: items.length,
      increases,
      decreases: items.length - increases,
    };
  }, [items]);
  const save = useMutation({
    mutationFn: () => createInventoryAdjustment({ productId, adjustmentType, quantity: Number(quantity), reason, notes }),
    onSuccess: () => {
      setProductId("");
      setAdjustmentType("increase");
      setQuantity("");
      setReason("");
      setNotes("");
      setProductSearch("");
      setFormOpen(false);
      queryClient.invalidateQueries({ queryKey: ["inventory-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: Error) => Alert.alert("Adjustment failed", error.message),
  });

  function closeForm() {
    setFormOpen(false);
  }

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="Stock moves"
        left={<IconButton accessibilityLabel="Go back" icon="chevron-back" onPress={() => navigation.goBack()} />}
        title="Adjustments"
      />

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <View>
            <StatStrip
              items={[
                { label: "Moves", value: String(adjustmentStats.total), icon: "swap-vertical-outline", tone: "purple" },
                { label: "Increases", value: String(adjustmentStats.increases), icon: "arrow-up-outline", tone: "green" },
                { label: "Decreases", value: String(adjustmentStats.decreases), icon: "arrow-down-outline", tone: "orange" },
              ]}
            />
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>Adjustment history</Text>
              <Text style={styles.listCount}>{items.length}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Empty icon="options-outline" text={adjustments.isLoading ? "Loading adjustments…" : "No adjustments recorded yet."} />
            {!adjustments.isLoading ? (
              <TouchableOpacity onPress={() => setFormOpen(true)} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>New adjustment</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => <AdjustmentRow item={item} />}
      />

      <FabButton accessibilityLabel="New adjustment" onPress={() => setFormOpen(true)} />

      <IosFormSheet
        eyebrow="Stock count"
        footerLabel={save.isPending ? "Saving…" : "Save"}
        footerLoading={save.isPending}
        onClose={closeForm}
        onFooterPress={() => save.mutate()}
        title="New Adjustment"
        visible={formOpen}
      >
        <Text style={styles.fieldLabel}>Select product</Text>
        <IosSearchBar onChangeText={setProductSearch} placeholder="Search name or SKU…" style={styles.search} value={productSearch} />
        {productOptions.map((item) => (
          <SelectOption
            key={item._id}
            label={item.name}
            meta={`${item.sku || "No SKU"} · ${item.stockQty} in stock`}
            onPress={() => setProductId(item._id)}
            selected={productId === item._id}
          />
        ))}

        <Text style={styles.fieldLabel}>Adjustment type</Text>
        <SelectOption label="Increase (+)" meta="Add stock" onPress={() => setAdjustmentType("increase")} selected={adjustmentType === "increase"} />
        <SelectOption label="Decrease (−)" meta="Remove stock" onPress={() => setAdjustmentType("decrease")} selected={adjustmentType === "decrease"} />

        <Text style={styles.fieldLabel}>Quantity</Text>
        <Field keyboardType="numeric" onChangeText={setQuantity} placeholder="e.g. 5" value={quantity} />
        <Text style={styles.fieldLabel}>Reason</Text>
        <Field onChangeText={setReason} placeholder="Cycle count, damaged, restock…" value={reason} />
        <Text style={styles.fieldLabel}>Notes</Text>
        <Field multiline onChangeText={setNotes} placeholder="Additional notes…" value={notes} />
      </IosFormSheet>
    </Screen>
  );
}

function AdjustmentRow({ item }: { item: InventoryAdjustment }) {
  const product = typeof item.product === "string" ? null : item.product as Product;
  const isIncrease = item.adjustmentType === "increase";
  const tone = isIncrease ? ios.green : ios.red;
  return (
    <View style={styles.card}>
      <View style={[styles.accent, { backgroundColor: tone }]} />
      <View style={styles.cardInner}>
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: `${tone}1F` }]}>
            <Ionicons color={tone} name={isIncrease ? "add" : "remove"} size={18} />
          </View>
          <View style={styles.info}>
            <Text numberOfLines={1} style={styles.name}>{product?.name || "Product"}</Text>
            <Text style={styles.meta}>{item.reason} · {new Date(item.createdAt).toISOString().slice(0, 10)}</Text>
            {!!item.notes && <Text numberOfLines={1} style={styles.notes}>{item.notes}</Text>}
          </View>
          <Badge
            icon={isIncrease ? "add-circle-outline" : "remove-circle-outline"}
            label={`${isIncrease ? "+" : "−"}${item.quantity}`}
            tone={isIncrease ? "success" : "danger"}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: ios.bg },
  content: { alignSelf: "center", maxWidth: 430, paddingBottom: 110, width: "100%" },
  sectionHead: { alignItems: "center", flexDirection: "row", marginBottom: 8, marginLeft: 4, marginTop: 4 },
  sectionLabel: { color: ios.secondary, flex: 1, fontFamily: fonts.regular, fontSize: 13 },
  listCount: {
    backgroundColor: ios.fill,
    borderRadius: 999,
    color: ios.label,
    fontFamily: fonts.semibold,
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  card: {
    backgroundColor: ios.card,
    borderRadius: 18,
    flexDirection: "row",
    marginBottom: 10,
    overflow: "hidden",
  },
  accent: { width: 4 },
  cardInner: { flex: 1, minWidth: 0, padding: 14 },
  cardTop: { alignItems: "center", flexDirection: "row", gap: 10 },
  avatar: { alignItems: "center", borderRadius: 14, height: 40, justifyContent: "center", width: 40 },
  info: { flex: 1, minWidth: 0 },
  name: { color: ios.label, fontFamily: fonts.semibold, fontSize: 16 },
  meta: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  notes: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  emptyCard: { alignItems: "center", backgroundColor: ios.card, borderRadius: 18, padding: 20 },
  emptyBtn: {
    backgroundColor: ios.dark,
    borderRadius: 14,
    justifyContent: "center",
    marginTop: spacing.sm,
    minHeight: 44,
    paddingHorizontal: 18,
  },
  emptyBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 14, textAlign: "center" },
  fieldLabel: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13, marginBottom: 6, marginTop: 12 },
  search: { marginBottom: 8 },
  option: { backgroundColor: ios.fill, borderRadius: 12, marginBottom: 6, padding: 12 },
  optionActive: { backgroundColor: "#007AFF14" },
  optionText: { color: ios.label, fontFamily: fonts.medium, fontSize: 14 },
  optionTextActive: { color: ios.blue, fontFamily: fonts.semibold },
});
