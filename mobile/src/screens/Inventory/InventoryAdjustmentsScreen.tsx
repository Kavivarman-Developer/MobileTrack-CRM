import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Badge, Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
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
      .slice(0, 5);
  }, [productSearch, products.data]);
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

  return (
    <Screen>
      <FlatList
        data={adjustments.data || []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={(
          <>
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                  <Ionicons color={colors.text} name="chevron-back" size={20} />
                  <Text style={styles.backText}>Back</Text>
                </Pressable>
                <View style={styles.headerCopy}>
                  <Text style={styles.eyebrow}>AUDIT STOCK</Text>
                  <Text style={styles.title}>Adjustments</Text>
                </View>
              </View>
            </View>
            <View style={styles.formCard}>
              <Pressable onPress={() => setFormOpen((value) => !value)} style={({ pressed }) => [styles.formHeader, pressed && styles.pressed]}>
                <View>
                  <Text style={styles.sectionTitle}>New Stock Adjustment</Text>
                  <Text style={styles.formHint}>{formOpen ? "Update stock count details below" : "Tap to open stock adjustment form"}</Text>
                </View>
                <Ionicons color={colors.primary} name={formOpen ? "chevron-up" : "add-circle-outline"} size={22} />
              </Pressable>
              {formOpen && (
                <View style={{ marginTop: spacing.md }}>
                  <Text style={styles.label}>Select Product</Text>
                  <Field onChangeText={setProductSearch} placeholder="Search product name or SKU..." value={productSearch} />
                  {productOptions.map((item) => (
                    <Pressable key={item._id} onPress={() => setProductId(item._id)} style={({ pressed }) => [styles.option, productId === item._id && styles.optionActive, pressed && styles.pressed]}>
                      <Text numberOfLines={1} style={[styles.optionText, productId === item._id && styles.optionTextActive]}>{item.name} • {item.stockQty} in stock</Text>
                    </Pressable>
                  ))}
                  <Text style={styles.label}>Adjustment Type</Text>
                  <View style={styles.segment}>
                    <Pressable onPress={() => setAdjustmentType("increase")} style={({ pressed }) => [styles.segmentButton, adjustmentType === "increase" && styles.segmentActiveIn, pressed && styles.pressed]}>
                      <Ionicons color={adjustmentType === "increase" ? colors.success : colors.muted} name="add-circle-outline" size={18} style={{ marginRight: 4 }} />
                      <Text style={[styles.segmentText, adjustmentType === "increase" && styles.segmentTextActiveIn]}>Increase (+)</Text>
                    </Pressable>
                    <Pressable onPress={() => setAdjustmentType("decrease")} style={({ pressed }) => [styles.segmentButton, adjustmentType === "decrease" && styles.segmentActiveOut, pressed && styles.pressed]}>
                      <Ionicons color={adjustmentType === "decrease" ? colors.danger : colors.muted} name="remove-circle-outline" size={18} style={{ marginRight: 4 }} />
                      <Text style={[styles.segmentText, adjustmentType === "decrease" && styles.segmentTextActiveOut]}>Decrease (-)</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.label}>Quantity to Adjust</Text>
                  <Field keyboardType="numeric" onChangeText={setQuantity} placeholder="e.g. 5" value={quantity} />
                  <Text style={styles.label}>Reason</Text>
                  <Field onChangeText={setReason} placeholder="Cycle count, damaged item, restock..." value={reason} />
                  <Text style={styles.label}>Notes</Text>
                  <Field multiline onChangeText={setNotes} placeholder="Additional notes..." value={notes} />
                  <Button icon="checkmark-circle-outline" loading={save.isPending} onPress={() => save.mutate()} title="Save Stock Adjustment" />
                </View>
              )}
            </View>
            <Text style={styles.sectionTitle}>Adjustment History</Text>
          </>
        )}
        ListEmptyComponent={<Empty icon="options-outline" text={adjustments.isLoading ? "Loading adjustments..." : "No adjustments recorded yet."} />}
        renderItem={({ item }) => <AdjustmentRow item={item} />}
      />
    </Screen>
  );
}

function AdjustmentRow({ item }: { item: InventoryAdjustment }) {
  const product = typeof item.product === "string" ? null : item.product as Product;
  const isIncrease = item.adjustmentType === "increase";
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.info}>
          <Text style={styles.name}>{product?.name || "Product"}</Text>
          <Text style={styles.meta}>{item.reason} • {new Date(item.createdAt).toISOString().slice(0, 10)}</Text>
          {!!item.notes && <Text style={styles.metaHint}>{item.notes}</Text>}
        </View>
        <Badge
          icon={isIncrease ? "add-circle-outline" : "remove-circle-outline"}
          label={`${isIncrease ? "+" : "-"}${item.quantity} units`}
          tone={isIncrease ? "success" : "danger"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  headerLeft: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  headerCopy: { flex: 1 },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flexDirection: "row", height: 38, justifyContent: "center", paddingHorizontal: spacing.sm },
  backText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, marginTop: 2 },

  formCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  formHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  formHint: { color: colors.muted, fontSize: 12, marginTop: 2 },

  label: { color: colors.text, ...typography.label, marginBottom: spacing.xs, marginTop: spacing.xs },
  option: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginBottom: spacing.xs, padding: spacing.sm },
  optionActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  optionText: { color: colors.text, fontSize: 13, fontWeight: "500" },
  optionTextActive: { color: colors.primary, fontWeight: "700" },

  segment: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  segmentButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, flexDirection: "row", height: 44, justifyContent: "center" },
  segmentActiveIn: { backgroundColor: colors.greenSoft, borderColor: colors.success },
  segmentActiveOut: { backgroundColor: colors.redSoft, borderColor: colors.danger },
  segmentText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  segmentTextActiveIn: { color: colors.success, fontWeight: "700" },
  segmentTextActiveOut: { color: colors.danger, fontWeight: "700" },

  sectionTitle: { color: colors.text, ...typography.h3, marginBottom: spacing.xs },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.md, ...shadows.card },
  cardTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  info: { flex: 1, paddingRight: spacing.sm },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  metaHint: { color: colors.faint, fontSize: 11, marginTop: 2 },
  pressed: { opacity: 0.85 },
});
