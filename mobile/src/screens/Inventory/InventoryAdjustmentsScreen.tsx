import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
import { createInventoryAdjustment, getInventoryAdjustments, getProducts, InventoryAdjustment, Product } from "../../services/api";

export default function InventoryAdjustmentsScreen({ navigation }: any) {
  const [productId, setProductId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"increase" | "decrease">("increase");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [productSearch, setProductSearch] = useState("");
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
                <Pressable onPress={() => navigation.goBack()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Text style={styles.backText}>Back</Text></Pressable>
                <View style={styles.headerCopy}><Text style={styles.eyebrow}>Audit stock</Text><Text style={styles.title}>Adjustments</Text></View>
              </View>
            </View>
            <View style={styles.formCard}>
              <Text style={styles.label}>Product</Text>
              <Field onChangeText={setProductSearch} placeholder="Search product or SKU" value={productSearch} />
              {productOptions.map((item) => (
                <Pressable key={item._id} onPress={() => setProductId(item._id)} style={({ pressed }) => [styles.option, productId === item._id && styles.optionActive, pressed && styles.pressed]}>
                  <Text numberOfLines={1} style={styles.optionText}>{item.name} | {item.stockQty} left</Text>
                </Pressable>
              ))}
              <Text style={styles.label}>Adjustment type</Text>
              <View style={styles.segment}>
                <Pressable onPress={() => setAdjustmentType("increase")} style={({ pressed }) => [styles.segmentButton, adjustmentType === "increase" && styles.segmentActive, pressed && styles.pressed]}><Text style={styles.segmentText}>Increase</Text></Pressable>
                <Pressable onPress={() => setAdjustmentType("decrease")} style={({ pressed }) => [styles.segmentButton, adjustmentType === "decrease" && styles.segmentActive, pressed && styles.pressed]}><Text style={styles.segmentText}>Decrease</Text></Pressable>
              </View>
              <Text style={styles.label}>Quantity</Text>
              <Field keyboardType="numeric" onChangeText={setQuantity} value={quantity} />
              <Text style={styles.label}>Reason</Text>
              <Field onChangeText={setReason} placeholder="Cycle count, damaged item..." value={reason} />
              <Text style={styles.label}>Notes</Text>
              <Field multiline onChangeText={setNotes} value={notes} />
              <Button loading={save.isPending} onPress={() => save.mutate()} title="Save adjustment" />
            </View>
            <Text style={styles.section}>History</Text>
          </>
        )}
        ListEmptyComponent={<Empty text={adjustments.isLoading ? "Loading adjustments..." : "No adjustments yet."} />}
        renderItem={({ item }) => <AdjustmentRow item={item} />}
      />
    </Screen>
  );
}

function AdjustmentRow({ item }: { item: InventoryAdjustment }) {
  const product = typeof item.product === "string" ? null : item.product as Product;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.info}>
          <Text style={styles.name}>{product?.name || "Product"}</Text>
          <Text style={styles.meta}>{item.reason} | {new Date(item.createdAt).toISOString().slice(0, 10)}</Text>
          {!!item.notes && <Text style={styles.meta}>{item.notes}</Text>}
        </View>
        <View style={[styles.badge, item.adjustmentType === "increase" ? styles.inBadge : styles.outBadge]}>
          <Text style={styles.badgeText}>{item.adjustmentType === "increase" ? "+" : "-"}{item.quantity}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl },
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  headerLeft: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  headerCopy: { flex: 1 },
  backButton: { alignItems: "center", backgroundColor: colors.blueSoft, borderColor: colors.secondary, borderRadius: 8, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  backText: { color: colors.secondary, fontWeight: "900" },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  formCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.xs },
  option: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.xs, padding: spacing.sm },
  optionActive: { backgroundColor: colors.greenSoft, borderColor: colors.success },
  optionText: { color: colors.text, fontWeight: "800" },
  segment: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  segmentButton: { alignItems: "center", backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flex: 1, minHeight: 44, justifyContent: "center" },
  segmentActive: { backgroundColor: colors.orangeSoft, borderColor: colors.primary },
  segmentText: { color: colors.text, fontWeight: "900" },
  section: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, padding: spacing.md },
  cardTop: { alignItems: "center", flexDirection: "row" },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 8, minWidth: 58, padding: spacing.sm },
  inBadge: { backgroundColor: colors.greenSoft },
  outBadge: { backgroundColor: colors.redSoft },
  badgeText: { color: colors.text, fontWeight: "900", textAlign: "center" },
  pressed: { opacity: 0.84 },
});
