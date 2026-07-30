import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useMemo } from "react";
import { useState } from "react";
import { Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
import { createProduct, deleteProduct, getProducts, Product, updateProduct, uploadProductImage } from "../../services/api";

const blank = { name: "", sku: "", barcode: "", price: "", costPrice: "", stockQty: "", lowStockThreshold: "5", type: "standalone" as "standalone" | "accessory", compatibleWith: [] as string[] };

export default function InventoryScreen() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(blank);
  const [selectedImage, setSelectedImage] = useState("");
  const [compatSearch, setCompatSearch] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [lastScan, setLastScan] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();
  const products = useQuery({ queryKey: ["products", search], queryFn: () => getProducts(search) });
  const allProducts = useQuery({ queryKey: ["products", ""], queryFn: () => getProducts("") });
  const inventoryStats = useMemo(() => {
    const list = products.data || [];
    return {
      total: list.length,
      lowStock: list.filter((item) => item.stockQty <= item.lowStockThreshold).length,
      stockValue: list.reduce((sum, item) => sum + item.stockQty * item.costPrice, 0),
    };
  }, [products.data]);
  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        sku: form.sku,
        barcode: form.barcode || undefined,
        price: Number(form.price),
        costPrice: Number(form.costPrice),
        stockQty: Number(form.stockQty),
        lowStockThreshold: Number(form.lowStockThreshold),
        type: form.type,
        compatibleWith: form.type === "accessory" ? form.compatibleWith : [],
      };
      const product = editing ? await updateProduct(editing._id, payload) : await createProduct(payload);
      if (selectedImage) return uploadProductImage(product._id, selectedImage);
      return product;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      closeForm();
    },
    onError: (error: Error) => Alert.alert("Save failed", error.message),
  });
  const remove = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  function openForm(product?: Product) {
    setEditing(product || null);
    setOpen(true);
    setForm(product ? {
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || "",
      price: String(product.price),
      costPrice: String(product.costPrice),
      stockQty: String(product.stockQty),
      lowStockThreshold: String(product.lowStockThreshold),
      type: product.type || "standalone",
      compatibleWith: (product.compatibleWith || []).map((item) => typeof item === "string" ? item : item._id),
    } : blank);
    setSelectedImage("");
    setCompatSearch("");
  }

  function closeForm() {
    setOpen(false);
    setEditing(null);
    setForm(blank);
    setSelectedImage("");
    setCompatSearch("");
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to add product images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ["images"],
      quality: 0.75,
    });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  }

  function handleBarcode(code: string) {
    if (!code || code === lastScan) return;
    setLastScan(code);
    setForm((prev) => ({ ...prev, sku: code, barcode: code }));
    setScanOpen(false);
    setTimeout(() => setLastScan(""), 1200);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Stock control</Text>
          <Text style={styles.title}>Inventory</Text>
        </View>
        <TouchableOpacity onPress={() => openForm()} style={styles.addButton}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.statsGrid}>
        <StatCard label="Items" value={inventoryStats.total} />
        <StatCard danger={inventoryStats.lowStock > 0} label="Low stock" value={inventoryStats.lowStock} />
        <StatCard label="Stock value" value={`Rs ${formatMoney(inventoryStats.stockValue)}`} wide />
      </View>
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>Search</Text>
          <Field onChangeText={setSearch} placeholder="Product name or SKU" value={search} />
        </View>
        <TouchableOpacity onPress={() => openForm()} style={styles.toolbarButton}>
          <Text style={styles.toolbarButtonText}>Add</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={products.data || []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Empty text={products.isLoading ? "Loading products..." : "No products yet."} />}
        renderItem={({ item }) => (
          <ProductRow
            item={item}
            onDelete={() => remove.mutate(item._id)}
            onDetails={() => navigation.navigate("ProductDetail", { productId: item._id })}
            onEdit={() => openForm(item)}
          />
        )}
      />
      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>{editing ? "Update item" : "New item"}</Text>
              <Text style={styles.title}>{editing ? "Edit Product" : "Add Product"}</Text>
            </View>
            <TouchableOpacity onPress={closeForm} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>x</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.formCard}>
            <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
              {selectedImage || editing?.images?.[0] ? (
                <Image source={{ uri: selectedImage || editing?.images?.[0] }} style={styles.previewImage} />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Text style={styles.previewTitle}>Add product image</Text>
                  <Text style={styles.previewHint}>Customer can see this in sales screen</Text>
                </View>
              )}
            </TouchableOpacity>
            <FormField formKey="name" label="Product name" setForm={setForm} value={form.name} />
            <FormField formKey="sku" label="SKU code" setForm={setForm} value={form.sku} />
            <TouchableOpacity onPress={() => setScanOpen(true)} style={styles.scanButton}>
              <Text style={styles.scanButtonText}>Scan Barcode</Text>
            </TouchableOpacity>
            <FormField formKey="barcode" label="Barcode / QR code" setForm={setForm} value={form.barcode} />
            <TouchableOpacity
              onPress={() => setForm((prev) => ({ ...prev, type: prev.type === "accessory" ? "standalone" : "accessory", compatibleWith: prev.type === "accessory" ? [] : prev.compatibleWith }))}
              style={[styles.toggleRow, form.type === "accessory" && styles.toggleActive]}
            >
              <View>
                <Text style={styles.toggleTitle}>Is this an accessory?</Text>
                <Text style={styles.toggleHint}>{form.type === "accessory" ? "Compatible phone models can be selected below." : "Enable for covers, glass, cables and similar items."}</Text>
              </View>
              <Text style={[styles.toggleValue, form.type === "accessory" && styles.toggleValueActive]}>{form.type === "accessory" ? "Yes" : "No"}</Text>
            </TouchableOpacity>
            {form.type === "accessory" && (
              <View style={styles.compatPanel}>
                <Text style={styles.fieldLabel}>Compatible phone models</Text>
                <Field onChangeText={setCompatSearch} placeholder="Search phone model" value={compatSearch} />
                {(allProducts.data || [])
                  .filter((item) => item._id !== editing?._id && item.type !== "accessory")
                  .filter((item) => `${item.name} ${item.sku}`.toLowerCase().includes(compatSearch.toLowerCase()))
                  .slice(0, 8)
                  .map((item) => {
                    const selected = form.compatibleWith.includes(item._id);
                    return (
                      <TouchableOpacity
                        key={item._id}
                        onPress={() => setForm((prev) => ({
                          ...prev,
                          compatibleWith: selected ? prev.compatibleWith.filter((id) => id !== item._id) : [...prev.compatibleWith, item._id],
                        }))}
                        style={[styles.compatOption, selected && styles.compatSelected]}
                      >
                        <Text style={[styles.compatName, selected && styles.compatNameSelected]}>{item.name}</Text>
                        <Text style={styles.compatSku}>{item.sku}</Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            )}
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <FormField formKey="price" keyboardType="numeric" label="Selling price" setForm={setForm} value={form.price} />
              </View>
              <View style={styles.formHalf}>
                <FormField formKey="costPrice" keyboardType="numeric" label="Cost price" setForm={setForm} value={form.costPrice} />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formHalf}>
                <FormField formKey="stockQty" keyboardType="numeric" label="Stock qty" setForm={setForm} value={form.stockQty} />
              </View>
              <View style={styles.formHalf}>
                <FormField formKey="lowStockThreshold" keyboardType="numeric" label="Low alert" setForm={setForm} value={form.lowStockThreshold} />
              </View>
            </View>
            <Button loading={save.isPending} onPress={() => save.mutate()} title="Save product" />
          </ScrollView>
        </Screen>
      </Modal>
      <Modal animationType="slide" visible={scanOpen}>
        <Screen>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>Barcode scanner</Text>
              <Text style={styles.title}>Scan SKU</Text>
            </View>
            <TouchableOpacity onPress={() => setScanOpen(false)} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>x</Text>
            </TouchableOpacity>
          </View>
          {permission?.granted ? (
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "code128", "upc_a", "upc_e"] } as any}
              onBarcodeScanned={(event: any) => handleBarcode(event.data)}
            >
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>Point camera at barcode</Text>
              </View>
            </CameraView>
          ) : (
            <View style={styles.formCard}>
              <Text style={styles.previewTitle}>Camera access needed</Text>
              <Button onPress={() => requestPermission()} title="Allow camera" />
            </View>
          )}
        </Screen>
      </Modal>
    </Screen>
  );
}

function StatCard({ danger, label, value, wide }: { danger?: boolean; label: string; value: string | number; wide?: boolean }) {
  return (
    <View style={[styles.statCard, wide && styles.statWide]}>
      <Text style={[styles.statValue, danger && styles.statDanger]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ProductRow({ item, onDelete, onDetails, onEdit }: { item: Product; onDelete: () => void; onDetails: () => void; onEdit: () => void }) {
  const isLow = item.stockQty <= item.lowStockThreshold;
  const progress = Math.max(0.08, Math.min(1, item.stockQty / Math.max(item.lowStockThreshold * 3, 1)));
  const imageUrl = item.images?.[0];

  return (
    <View style={styles.productCard}>
      <TouchableOpacity activeOpacity={0.8} onPress={onDetails} style={styles.productMain}>
        <View style={styles.avatar}>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>}
        </View>
        <View style={styles.productInfo}>
          <View style={styles.productTop}>
            <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
            <View style={[styles.statusPill, isLow ? styles.lowPill : styles.okPill]}>
              <Text style={[styles.statusText, isLow ? styles.lowText : styles.okText]}>{isLow ? "Low" : "OK"}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{item.sku} | Rs {formatMoney(item.price)}</Text>
          <View style={styles.stockTrack}>
            <View style={[styles.stockFill, { backgroundColor: isLow ? colors.danger : colors.primary, flex: progress }]} />
            <View style={{ flex: 1 - progress }} />
          </View>
          <Text style={styles.stockText}>{item.stockQty} in stock | Alert at {item.lowStockThreshold}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.actions}>
        <TouchableOpacity onPress={onEdit} style={styles.actionButton}>
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDetails} style={[styles.actionButton, styles.detailsButton]}>
          <Text style={styles.actionText}>Details</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} style={[styles.actionButton, styles.deleteButton]}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FormField({
  formKey,
  keyboardType = "default",
  label,
  setForm,
  value,
}: {
  formKey: keyof typeof blank;
  keyboardType?: "default" | "numeric";
  label: string;
  setForm: React.Dispatch<React.SetStateAction<typeof blank>>;
  value: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Field keyboardType={keyboardType} onChangeText={(text) => setForm((prev) => ({ ...prev, [formKey]: text }))} placeholder={label} value={value} />
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 25, fontWeight: "900", marginTop: 1 },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 46, justifyContent: "center", width: 46 },
  addButtonText: { color: "#fff", fontSize: 28, fontWeight: "700", marginTop: -2 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  statCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, padding: spacing.md, width: "31%" },
  statWide: { flex: 1, minWidth: "31%" },
  statValue: { color: colors.text, fontSize: 19, fontWeight: "900" },
  statDanger: { color: colors.danger },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  toolbar: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  searchWrap: { flex: 1 },
  searchIcon: { color: colors.muted, fontSize: 12, fontWeight: "800", marginBottom: spacing.xs, textTransform: "uppercase" },
  toolbarButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 52, justifyContent: "center", marginTop: 19, width: 72 },
  toolbarButtonText: { color: "#fff", fontWeight: "900" },
  scanButton: { alignItems: "center", backgroundColor: colors.background, borderColor: colors.primary, borderRadius: 8, borderWidth: 1, minHeight: 48, justifyContent: "center", marginBottom: spacing.sm },
  scanButtonText: { color: colors.primaryDark, fontWeight: "900" },
  listContent: { paddingBottom: spacing.lg },
  productCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, overflow: "hidden" },
  productMain: { flexDirection: "row", padding: spacing.md },
  avatar: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: 8, height: 48, justifyContent: "center", marginRight: spacing.sm, width: 48 },
  avatarImage: { borderRadius: 8, height: 48, width: 48 },
  avatarText: { color: colors.primaryDark, fontWeight: "900" },
  productInfo: { flex: 1 },
  productTop: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  name: { color: colors.text, flex: 1, fontSize: 16, fontWeight: "900" },
  meta: { color: colors.muted, marginTop: 4 },
  statusPill: { borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  okPill: { backgroundColor: colors.greenSoft },
  lowPill: { backgroundColor: colors.orangeSoft },
  statusText: { fontSize: 12, fontWeight: "900" },
  okText: { color: colors.success },
  lowText: { color: colors.danger },
  stockTrack: { backgroundColor: colors.background, borderRadius: 999, flexDirection: "row", height: 7, marginTop: spacing.sm, overflow: "hidden" },
  stockFill: { borderRadius: 999 },
  stockText: { color: colors.muted, fontSize: 12, marginTop: 5 },
  actions: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row" },
  actionButton: { alignItems: "center", flex: 1, paddingVertical: spacing.sm },
  actionText: { color: colors.primary, fontWeight: "900" },
  deleteButton: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  detailsButton: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  deleteText: { color: colors.danger, fontWeight: "900" },
  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 42, justifyContent: "center", width: 42 },
  closeButtonText: { color: colors.text, fontSize: 18, fontWeight: "900" },
  formCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, padding: spacing.md },
  toggleRow: { alignItems: "center", backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm, minHeight: 58, padding: spacing.md },
  toggleActive: { backgroundColor: colors.tealSoft, borderColor: colors.primary },
  toggleTitle: { color: colors.text, fontWeight: "900" },
  toggleHint: { color: colors.muted, fontSize: 12, marginTop: 3 },
  toggleValue: { color: colors.muted, fontWeight: "900" },
  toggleValueActive: { color: colors.primaryDark },
  compatPanel: { marginBottom: spacing.sm },
  compatOption: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.xs, padding: spacing.sm },
  compatSelected: { backgroundColor: colors.greenSoft, borderColor: colors.success },
  compatName: { color: colors.text, fontWeight: "900" },
  compatNameSelected: { color: colors.success },
  compatSku: { color: colors.muted, fontSize: 12, marginTop: 2 },
  imagePicker: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 170, justifyContent: "center", marginBottom: spacing.md, overflow: "hidden" },
  previewImage: { height: "100%", width: "100%" },
  previewPlaceholder: { alignItems: "center", padding: spacing.md },
  previewTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  previewHint: { color: colors.muted, marginTop: 5, textAlign: "center" },
  camera: { borderRadius: 8, flex: 1, overflow: "hidden" },
  scanOverlay: { alignItems: "center", flex: 1, justifyContent: "center" },
  scanFrame: { borderColor: "#fff", borderRadius: 8, borderWidth: 3, height: 220, width: 220 },
  scanHint: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, color: "#fff", fontWeight: "900", marginTop: spacing.md, padding: spacing.sm },
  formRow: { flexDirection: "row", gap: spacing.sm },
  formHalf: { flex: 1 },
  fieldBlock: { marginBottom: spacing.xs },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.xs },
});
