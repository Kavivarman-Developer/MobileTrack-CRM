import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
import { Product, PurchaseOrder, createPurchaseOrder, getProducts, getPurchaseOrders, getVendors, receivePurchaseOrder } from "../../services/api";

const blankLine = { product: "", quantity: "1", costPrice: "" };

export default function PurchasesScreen({ navigation }: any) {
  const [open, setOpen] = useState(false);
  const [vendor, setVendor] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([blankLine]);
  const vendors = useQuery({ queryKey: ["vendors"], queryFn: () => getVendors("") });
  const products = useQuery({ queryKey: ["products", ""], queryFn: () => getProducts("") });
  const purchaseOrders = useQuery({ queryKey: ["purchase-orders"], queryFn: getPurchaseOrders });
  const queryClient = useQueryClient();
  const total = useMemo(() => lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.costPrice || 0), 0), [lines]);
  const save = useMutation({
    mutationFn: () => createPurchaseOrder({ vendor, notes, status: "ordered", items: lines.map((line) => ({ product: line.product, quantity: Number(line.quantity), costPrice: Number(line.costPrice) })) as any }),
    onSuccess: () => {
      setOpen(false);
      setVendor("");
      setNotes("");
      setLines([blankLine]);
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (error: Error) => Alert.alert("Purchase order failed", error.message),
  });
  const receive = useMutation({
    mutationFn: receivePurchaseOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  function vendorName(po: PurchaseOrder) {
    return typeof po.vendor === "string" ? "Vendor" : po.vendor.name;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Text style={styles.backText}>Back</Text></TouchableOpacity>
          <View><Text style={styles.eyebrow}>Stock buying</Text><Text style={styles.title}>Purchases</Text></View>
        </View>
        <TouchableOpacity onPress={() => setOpen(true)} style={styles.addButton}><Text style={styles.addButtonText}>+</Text></TouchableOpacity>
      </View>
      <FlatList
        data={purchaseOrders.data || []}
        keyExtractor={(item) => item._id}
        ListEmptyComponent={<Empty text={purchaseOrders.isLoading ? "Loading purchase orders..." : "No purchase orders yet."} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.main}>
              <View style={styles.info}>
                <Text style={styles.name}>{vendorName(item)}</Text>
                <Text style={styles.meta}>{item.items.length} items | Rs {formatMoney(item.totalAmount)}</Text>
                <Text style={styles.meta}>{item.orderDate.slice(0, 10)}</Text>
              </View>
              <View style={[styles.badge, statusStyle(item.status)]}><Text style={styles.badgeText}>{item.status}</Text></View>
            </View>
            {item.status !== "received" && (
              <TouchableOpacity onPress={() => receive.mutate(item._id)} style={styles.receiveButton}><Text style={styles.receiveText}>Mark Received</Text></TouchableOpacity>
            )}
          </View>
        )}
      />
      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.header}>
            <Text style={styles.title}>New Purchase Order</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}><Text style={styles.closeText}>x</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" style={styles.formCard}>
            <Text style={styles.label}>Vendor</Text>
            {(vendors.data || []).map((item) => (
              <TouchableOpacity key={item._id} onPress={() => setVendor(item._id)} style={[styles.option, vendor === item._id && styles.optionActive]}><Text style={styles.optionText}>{item.name}</Text></TouchableOpacity>
            ))}
            <Text style={styles.label}>Product lines</Text>
            {lines.map((line, index) => (
              <View key={index} style={styles.lineBox}>
                <ProductSelect products={products.data || []} value={line.product} onChange={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, product: value, costPrice: String((products.data || []).find((p) => p._id === value)?.costPrice || row.costPrice) } : row))} />
                <View style={styles.row}>
                  <View style={styles.half}><Text style={styles.label}>Qty</Text><Field keyboardType="numeric" onChangeText={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, quantity: value } : row))} value={line.quantity} /></View>
                  <View style={styles.half}><Text style={styles.label}>Cost price</Text><Field keyboardType="numeric" onChangeText={(value) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, costPrice: value } : row))} value={line.costPrice} /></View>
                </View>
              </View>
            ))}
            <TouchableOpacity onPress={() => setLines((prev) => [...prev, blankLine])} style={styles.linkButton}><Text style={styles.linkText}>+ Add product line</Text></TouchableOpacity>
            <Text style={styles.total}>Total Rs {formatMoney(total)}</Text>
            <Text style={styles.label}>Notes</Text>
            <Field onChangeText={setNotes} value={notes} />
            <Button loading={save.isPending} onPress={() => save.mutate()} title="Save purchase order" />
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

function ProductSelect({ onChange, products, value }: { onChange: (value: string) => void; products: Product[]; value: string }) {
  return (
    <View>
      <Text style={styles.label}>Product</Text>
      {products.slice(0, 8).map((item) => (
        <TouchableOpacity key={item._id} onPress={() => onChange(item._id)} style={[styles.option, value === item._id && styles.optionActive]}><Text numberOfLines={1} style={styles.optionText}>{item.name}</Text></TouchableOpacity>
      ))}
    </View>
  );
}

function statusStyle(status: string) {
  if (status === "received") return { backgroundColor: colors.greenSoft };
  if (status === "cancelled") return { backgroundColor: colors.redSoft };
  return { backgroundColor: colors.orangeSoft };
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  headerLeft: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  backButton: { alignItems: "center", backgroundColor: colors.blueSoft, borderColor: colors.secondary, borderRadius: 8, borderWidth: 1, minHeight: 44, justifyContent: "center", paddingHorizontal: spacing.md },
  backText: { color: colors.secondary, fontWeight: "900" },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 26, fontWeight: "900" },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 48, justifyContent: "center", width: 48 },
  addButtonText: { color: "#fff", fontSize: 28, fontWeight: "700", marginTop: -2 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, overflow: "hidden" },
  main: { alignItems: "center", flexDirection: "row", padding: spacing.md },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 4 },
  badge: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  badgeText: { color: colors.text, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  receiveButton: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, minHeight: 44, justifyContent: "center" },
  receiveText: { color: colors.primaryDark, fontWeight: "900" },
  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  closeText: { color: colors.text, fontSize: 18, fontWeight: "900" },
  formCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1 },
  modalContent: { padding: spacing.md, paddingBottom: spacing.xl },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.xs },
  option: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.xs, padding: spacing.sm },
  optionActive: { backgroundColor: colors.greenSoft, borderColor: colors.success },
  optionText: { color: colors.text, fontWeight: "800" },
  lineBox: { borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.sm, padding: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  half: { flex: 1 },
  linkButton: { alignItems: "center", borderColor: colors.primary, borderRadius: 8, borderWidth: 1, minHeight: 44, justifyContent: "center", marginBottom: spacing.sm },
  linkText: { color: colors.primaryDark, fontWeight: "900" },
  total: { color: colors.accent, fontSize: 18, fontWeight: "900", marginBottom: spacing.sm },
});
