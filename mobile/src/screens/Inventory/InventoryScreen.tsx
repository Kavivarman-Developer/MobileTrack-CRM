import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { Alert, FlatList, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { z } from "zod";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, spacing } from "../../constants/theme";
import { createProduct, createVendor, deleteProduct, getProducts, getVendors, Product, updateProduct, uploadProductImage, Vendor } from "../../services/api";

const blank = {
  itemType: "goods" as "goods" | "service",
  name: "",
  sku: "",
  barcode: "",
  unit: "pcs",
  category: "",
  returnable: true,
  salesEnabled: true,
  sellingPrice: "",
  salesAccount: "Sales",
  salesDescription: "",
  purchaseEnabled: true,
  costPrice: "",
  purchaseAccount: "Cost of Goods Sold",
  purchaseDescription: "",
  preferredVendor: "",
  trackInventory: true,
  inventoryAccount: "Inventory Asset",
  openingStock: "",
  openingStockRatePerUnit: "",
  inventoryValuationMethod: "FIFO" as "FIFO" | "LIFO" | "Average",
  reorderPoint: "5",
  moreOpen: false,
  dimensionLength: "",
  dimensionWidth: "",
  dimensionHeight: "",
  dimensionUnit: "cm",
  weight: "",
  weightUnit: "kg",
  manufacturer: "",
  brand: "",
  upc: "",
  mpn: "",
  ean: "",
  isbn: "",
  type: "standalone" as "standalone" | "accessory",
  compatibleWith: [] as string[],
};

const productSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  sku: z.string().min(1, "SKU is required"),
  sellingPrice: z.coerce.number().min(0, "Selling price is required"),
  costPrice: z.coerce.number().min(0, "Cost price is required"),
  inventoryValuationMethod: z.enum(["FIFO", "LIFO", "Average"]),
});

type FormState = typeof blank;
type ScanField = "sku" | "upc" | "mpn" | "ean" | "isbn";

export default function InventoryScreen() {
  const [search, setSearch] = useState("");
  const [viewItemsOpen, setViewItemsOpen] = useState(false);
  const [viewSearch, setViewSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [selectedImage, setSelectedImage] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanField, setScanField] = useState<ScanField>("sku");
  const [lastScan, setLastScan] = useState("");
  const [permission, requestPermission] = useCameraPermissions();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();
  const products = useQuery({ queryKey: ["products", search], queryFn: () => getProducts(search) });
  const allProducts = useQuery({ queryKey: ["products", ""], queryFn: () => getProducts("") });
  const vendors = useQuery({ queryKey: ["vendors", vendorSearch], queryFn: () => getVendors(vendorSearch) });
  const inventoryStats = useMemo(() => {
    const list = products.data || [];
    return {
      total: list.length,
      lowStock: list.filter((item) => item.stockQty <= item.lowStockThreshold).length,
      stockValue: list.reduce((sum, item) => sum + item.stockQty * item.costPrice, 0),
    };
  }, [products.data]);
  const quickVendor = useMutation({
    mutationFn: () => createVendor({ name: vendorSearch }),
    onSuccess: (vendor) => {
      setForm((prev) => ({ ...prev, preferredVendor: vendor._id }));
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });

  const viewProducts = useMemo(() => {
    const keyword = viewSearch.trim().toLowerCase();
    return (allProducts.data || []).filter((item) => item.name.toLowerCase().includes(keyword) || item.sku.toLowerCase().includes(keyword));
  }, [viewSearch, allProducts.data]);

  function openViewItems() {
    setViewSearch("");
    setViewItemsOpen(true);
  }

  function closeViewItems() {
    setViewItemsOpen(false);
  }
  const save = useMutation({
    mutationFn: async () => {
      const parsed = productSchema.parse(form);
      const payload = {
        itemType: form.itemType,
        name: parsed.name,
        sku: parsed.sku,
        barcode: form.barcode || form.sku,
        unit: form.unit || "pcs",
        category: form.category,
        returnable: form.returnable,
        price: parsed.sellingPrice,
        sellingPrice: parsed.sellingPrice,
        salesAccount: form.salesAccount,
        salesDescription: form.salesDescription,
        costPrice: parsed.costPrice,
        purchaseAccount: form.purchaseAccount,
        purchaseDescription: form.purchaseDescription,
        preferredVendor: form.preferredVendor || null,
        trackInventory: form.trackInventory,
        inventoryAccount: form.inventoryAccount,
        openingStock: Number(form.openingStock || 0),
        openingStockRatePerUnit: Number(form.openingStockRatePerUnit || 0),
        inventoryValuationMethod: parsed.inventoryValuationMethod,
        // reorderPoint lives alongside lowStockThreshold until all legacy screens switch over.
        reorderPoint: Number(form.reorderPoint || 0),
        lowStockThreshold: Number(form.reorderPoint || 0),
        stockQty: Number(form.openingStock || 0),
        dimensions: {
          length: nullableNumber(form.dimensionLength),
          width: nullableNumber(form.dimensionWidth),
          height: nullableNumber(form.dimensionHeight),
          unit: form.dimensionUnit || "cm",
        },
        weight: nullableNumber(form.weight),
        weightUnit: form.weightUnit || "kg",
        manufacturer: form.manufacturer,
        brand: form.brand,
        upc: form.upc,
        mpn: form.mpn,
        ean: form.ean,
        isbn: form.isbn,
        type: form.type,
        compatibleWith: form.type === "accessory" ? form.compatibleWith : [],
      };
      const product = editing ? await updateProduct(editing._id, payload as Partial<Product>) : await createProduct(payload as Partial<Product>);
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
      ...blank,
      itemType: product.itemType || "goods",
      name: product.name,
      sku: product.sku,
      barcode: product.barcode || "",
      unit: product.unit || "pcs",
      category: typeof product.category === "object" ? product.category?.name || "" : "",
      returnable: product.returnable ?? true,
      sellingPrice: String(product.sellingPrice ?? product.price),
      salesAccount: product.salesAccount || "Sales",
      salesDescription: product.salesDescription || "",
      costPrice: String(product.costPrice),
      purchaseAccount: product.purchaseAccount || "Cost of Goods Sold",
      purchaseDescription: product.purchaseDescription || "",
      preferredVendor: typeof product.preferredVendor === "string" ? product.preferredVendor : product.preferredVendor?._id || "",
      trackInventory: product.trackInventory ?? true,
      inventoryAccount: product.inventoryAccount || "Inventory Asset",
      openingStock: String(product.openingStock ?? product.stockQty),
      openingStockRatePerUnit: String(product.openingStockRatePerUnit ?? product.costPrice),
      inventoryValuationMethod: product.inventoryValuationMethod || "FIFO",
      reorderPoint: String(product.reorderPoint ?? product.lowStockThreshold),
      dimensionLength: String(product.dimensions?.length ?? ""),
      dimensionWidth: String(product.dimensions?.width ?? ""),
      dimensionHeight: String(product.dimensions?.height ?? ""),
      dimensionUnit: product.dimensions?.unit || "cm",
      weight: String(product.weight ?? ""),
      weightUnit: product.weightUnit || "kg",
      manufacturer: product.manufacturer || "",
      brand: typeof product.brand === "object" ? product.brand?.name || "" : "",
      upc: product.upc || "",
      mpn: product.mpn || "",
      ean: product.ean || "",
      isbn: product.isbn || "",
      type: product.type || "standalone",
      compatibleWith: (product.compatibleWith || []).map((item) => typeof item === "string" ? item : item._id),
    } : blank);
    setSelectedImage("");
    setVendorSearch("");
  }

  function closeForm() {
    setOpen(false);
    setEditing(null);
    setForm(blank);
    setSelectedImage("");
    setVendorSearch("");
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to add product images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ["images"], quality: 0.75 });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  }

  function openScanner(field: ScanField) {
    setScanField(field);
    setScanOpen(true);
  }

  function handleBarcode(code: string) {
    if (!code || code === lastScan) return;
    setLastScan(code);
    setForm((prev) => ({ ...prev, [scanField]: code, barcode: scanField === "sku" ? code : prev.barcode }));
    setScanOpen(false);
    setTimeout(() => setLastScan(""), 1200);
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Stock control</Text>
          <Text style={styles.title}>Items</Text>
        </View>
        <TouchableOpacity onPress={() => openForm()} style={styles.addButton}><Text style={styles.addButtonText}>+</Text></TouchableOpacity>
      </View>
      <View style={styles.statsGrid}>
        <StatCard label="Items" value={inventoryStats.total} />
        <StatCard danger={inventoryStats.lowStock > 0} label="Low stock" value={inventoryStats.lowStock} />
        <StatCard label="Stock value" value={`Rs ${formatMoney(inventoryStats.stockValue)}`} wide />
      </View>
      <View style={styles.toolbar}>
        <View style={styles.searchWrap}><Text style={styles.searchIcon}>Search</Text><Field style={styles.compactSearchField} onChangeText={setSearch} placeholder="Product name or SKU" value={search} /></View>
        <TouchableOpacity onPress={openViewItems} style={styles.toolbarButton}><Text style={styles.toolbarButtonText}>View
          </Text></TouchableOpacity>
        <TouchableOpacity onPress={() => openForm()} style={styles.toolbarButton}><Text style={styles.toolbarButtonText}>Add</Text></TouchableOpacity>
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
      <Modal animationType="slide" visible={viewItemsOpen}>
        <Screen>
          <View style={styles.modalHeader}>
            <View><Text style={styles.eyebrow}>All items</Text><Text style={styles.title}>View Items</Text></View>
            <TouchableOpacity onPress={closeViewItems} style={styles.closeButton}><Text style={styles.closeButtonText}>x</Text></TouchableOpacity>
          </View>
          <View style={styles.toolbar}>
            <View style={styles.searchWrap}><Text style={styles.searchIcon}>Search</Text><Field style={styles.compactSearchField} onChangeText={setViewSearch} placeholder="Search item name or SKU" value={viewSearch} /></View>
          </View>
          <FlatList
            data={viewProducts}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Empty text={allProducts.isLoading ? "Loading all items..." : "No items found."} />}
            renderItem={({ item }) => (
              <ProductRow
                item={item}
                onDelete={() => remove.mutate(item._id)}
                onDetails={() => { closeViewItems(); navigation.navigate("ProductDetail", { productId: item._id }); }}
                onEdit={() => { closeViewItems(); openForm(item); }}
              />
            )}
          />
        </Screen>
      </Modal>
      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.modalHeader}>
            <View><Text style={styles.eyebrow}>{editing ? "Update item" : "New item"}</Text><Text style={styles.title}>{editing ? "Edit Product" : "Add Product"}</Text></View>
            <TouchableOpacity onPress={closeForm} style={styles.closeButton}><Text style={styles.closeButtonText}>x</Text></TouchableOpacity>
          </View>
          <ScrollView style={styles.formCard}>
            <Section title="Item Type">
              <Segment value={form.itemType} options={[["goods", "Goods"], ["service", "Service"]]} onChange={(value) => setForm((prev) => ({ ...prev, itemType: value as FormState["itemType"] }))} />
            </Section>
            <Section title="Basics">
              <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
                {selectedImage || editing?.images?.[0] ? <Image source={{ uri: selectedImage || editing?.images?.[0] }} style={styles.previewImage} /> : <View style={styles.previewPlaceholder}><Ionicons color={colors.primary} name="image-outline" size={26} /><Text style={styles.previewTitle}>+ Add Image</Text></View>}
              </TouchableOpacity>
              <FormField formKey="name" label="Item Name" setForm={setForm} value={form.name} />
              <ScanFieldInput formKey="sku" label="SKU" onScan={() => openScanner("sku")} setForm={setForm} value={form.sku} />
              <FormField formKey="unit" label="Unit" setForm={setForm} value={form.unit} />
              <TouchableOpacity onPress={() => Alert.alert("Configure Units", "Unit management can be added here.")} style={styles.inlineLink}><Text style={styles.inlineLinkText}>Configure Units</Text></TouchableOpacity>
              <Text style={styles.fieldLabel}>Category</Text>
              <Segment value={form.category || "Smartphones"} options={[["Smartphones", "Smartphones"], ["Tablets", "Tablets"], ["Accessories", "Accessories"]]} onChange={(value) => setForm((prev) => ({ ...prev, category: value }))} />
              <FormField formKey="category" label="Category name" setForm={setForm} value={form.category} />
              <Toggle label="Returnable Item" value={form.returnable} onChange={() => setForm((prev) => ({ ...prev, returnable: !prev.returnable }))} />
            </Section>
            <PanelToggle label="Sales Information" value={form.salesEnabled} onChange={() => setForm((prev) => ({ ...prev, salesEnabled: !prev.salesEnabled }))} />
            {form.salesEnabled && <Section title="Sales Information">
              <FormField formKey="sellingPrice" keyboardType="numeric" label="Selling Price (INR)" setForm={setForm} value={form.sellingPrice} />
              <Text style={styles.fieldLabel}>Account</Text>
              <Segment value={form.salesAccount} options={[["Sales", "Sales"], ["Service Sales", "Service Sales"], ["Other Income", "Other Income"]]} onChange={(value) => setForm((prev) => ({ ...prev, salesAccount: value }))} />
              <FormField formKey="salesAccount" label="Account name" setForm={setForm} value={form.salesAccount} />
              <FormField formKey="salesDescription" label="Description" multiline setForm={setForm} value={form.salesDescription} />
            </Section>}
            <PanelToggle label="Purchase Information" value={form.purchaseEnabled} onChange={() => setForm((prev) => ({ ...prev, purchaseEnabled: !prev.purchaseEnabled }))} />
            {form.purchaseEnabled && <Section title="Purchase Information">
              <FormField formKey="costPrice" keyboardType="numeric" label="Cost Price (INR)" setForm={setForm} value={form.costPrice} />
              <Text style={styles.fieldLabel}>Account</Text>
              <Segment value={form.purchaseAccount} options={[["Cost of Goods Sold", "Cost of Goods Sold"], ["Purchases", "Purchases"], ["Inventory Expense", "Inventory Expense"]]} onChange={(value) => setForm((prev) => ({ ...prev, purchaseAccount: value }))} />
              <FormField formKey="purchaseAccount" label="Account name" setForm={setForm} value={form.purchaseAccount} />
              <FormField formKey="purchaseDescription" label="Description" multiline setForm={setForm} value={form.purchaseDescription} />
              <Text style={styles.fieldLabel}>Preferred Vendor</Text>
              <Field onChangeText={setVendorSearch} placeholder="Start typing to select a Vendor" value={vendorSearch} />
              {(vendors.data || []).slice(0, 5).map((vendor) => <VendorOption key={vendor._id} selected={form.preferredVendor === vendor._id} vendor={vendor} onPress={() => setForm((prev) => ({ ...prev, preferredVendor: vendor._id }))} />)}
              {!!vendorSearch && <TouchableOpacity onPress={() => quickVendor.mutate()} style={styles.inlineAdd}><Text style={styles.inlineAddText}>+ Add Vendor</Text></TouchableOpacity>}
            </Section>}
            <PanelToggle label="Track Inventory for this item" value={form.trackInventory} onChange={() => setForm((prev) => ({ ...prev, trackInventory: !prev.trackInventory }))} />
            {form.trackInventory && <Section title="Inventory Tracking">
              <Text style={styles.fieldLabel}>Inventory Account</Text>
              <Segment value={form.inventoryAccount} options={[["Inventory Asset", "Inventory Asset"], ["Finished Goods", "Finished Goods"], ["Stock in Hand", "Stock in Hand"]]} onChange={(value) => setForm((prev) => ({ ...prev, inventoryAccount: value }))} />
              <FormField formKey="inventoryAccount" label="Inventory account name" setForm={setForm} value={form.inventoryAccount} />
              <InfoField formKey="openingStock" keyboardType="numeric" label="Opening Stock" setForm={setForm} value={form.openingStock} />
              <InfoField formKey="openingStockRatePerUnit" keyboardType="numeric" label="Opening Stock Rate per Unit" setForm={setForm} value={form.openingStockRatePerUnit} />
              <Text style={styles.fieldLabel}>Inventory Valuation Method</Text>
              <Segment value={form.inventoryValuationMethod} options={[["FIFO", "FIFO"], ["LIFO", "LIFO"], ["Average", "Average"]]} onChange={(value) => setForm((prev) => ({ ...prev, inventoryValuationMethod: value as FormState["inventoryValuationMethod"] }))} />
              <InfoField formKey="reorderPoint" keyboardType="numeric" label="Reorder Point" setForm={setForm} value={form.reorderPoint} />
            </Section>}
            <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, moreOpen: !prev.moreOpen }))} style={styles.collapseHeader}>
              <Text style={styles.sectionTitle}>More fields</Text>
              <Ionicons color={colors.text} name={form.moreOpen ? "chevron-up" : "chevron-down"} size={20} />
            </TouchableOpacity>
            {form.moreOpen && <Section title="More fields">
              <Text style={styles.fieldLabel}>Dimensions</Text>
              <View style={styles.formRow}>
                <View style={styles.formQuarter}><FormField formKey="dimensionLength" keyboardType="numeric" label="Length" setForm={setForm} value={form.dimensionLength} /></View>
                <View style={styles.formQuarter}><FormField formKey="dimensionWidth" keyboardType="numeric" label="Width" setForm={setForm} value={form.dimensionWidth} /></View>
                <View style={styles.formQuarter}><FormField formKey="dimensionHeight" keyboardType="numeric" label="Height" setForm={setForm} value={form.dimensionHeight} /></View>
                <View style={styles.formQuarter}><FormField formKey="dimensionUnit" label="Unit" setForm={setForm} value={form.dimensionUnit} /></View>
              </View>
              <View style={styles.formRow}><View style={styles.formHalf}><FormField formKey="weight" keyboardType="numeric" label="Weight" setForm={setForm} value={form.weight} /></View><View style={styles.formHalf}><FormField formKey="weightUnit" label="Unit" setForm={setForm} value={form.weightUnit} /></View></View>
              <FormField formKey="manufacturer" label="Manufacturer" setForm={setForm} value={form.manufacturer} />
              <FormField formKey="brand" label="Brand" setForm={setForm} value={form.brand} />
              <ScanFieldInput formKey="upc" label="UPC" onScan={() => openScanner("upc")} setForm={setForm} value={form.upc} />
              <ScanFieldInput formKey="mpn" label="MPN" onScan={() => openScanner("mpn")} setForm={setForm} value={form.mpn} />
              <ScanFieldInput formKey="ean" label="EAN" onScan={() => openScanner("ean")} setForm={setForm} value={form.ean} />
              <ScanFieldInput formKey="isbn" label="ISBN" onScan={() => openScanner("isbn")} setForm={setForm} value={form.isbn} />
            </Section>}
            <Toggle label="Is this an accessory?" value={form.type === "accessory"} onChange={() => setForm((prev) => ({ ...prev, type: prev.type === "accessory" ? "standalone" : "accessory", compatibleWith: prev.type === "accessory" ? [] : prev.compatibleWith }))} />
            {form.type === "accessory" && <CompatiblePicker allProducts={allProducts.data || []} editing={editing} form={form} setForm={setForm} />}
            <Button loading={save.isPending} onPress={() => save.mutate()} title="Save product" />
          </ScrollView>
        </Screen>
      </Modal>
      <Modal animationType="slide" visible={scanOpen}>
        <Screen>
          <View style={styles.modalHeader}>
            <View><Text style={styles.eyebrow}>Barcode scanner</Text><Text style={styles.title}>Scan {scanField.toUpperCase()}</Text></View>
            <TouchableOpacity onPress={() => setScanOpen(false)} style={styles.closeButton}><Text style={styles.closeButtonText}>x</Text></TouchableOpacity>
          </View>
          {permission?.granted ? (
            <CameraView style={styles.camera} barcodeScannerSettings={{ barcodeTypes: ["qr", "ean13", "code128", "upc_a", "upc_e"] } as any} onBarcodeScanned={(event: any) => handleBarcode(event.data)}>
              <View style={styles.scanOverlay}><View style={styles.scanFrame} /><Text style={styles.scanHint}>Point camera at barcode</Text></View>
            </CameraView>
          ) : <View style={styles.formCard}><Text style={styles.previewTitle}>Camera access needed</Text><Button onPress={() => requestPermission()} title="Allow camera" /></View>}
        </Screen>
      </Modal>
    </Screen>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return <View style={styles.sectionBox}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

function Segment({ onChange, options, value }: { onChange: (value: string) => void; options: string[][]; value: string }) {
  return <View style={styles.segment}>{options.map(([key, label]) => <TouchableOpacity key={key} onPress={() => onChange(key)} style={[styles.segmentButton, value === key && styles.segmentActive]}><Text style={styles.segmentText}>{label}</Text></TouchableOpacity>)}</View>;
}

function Toggle({ label, onChange, value }: { label: string; onChange: () => void; value: boolean }) {
  return <TouchableOpacity onPress={onChange} style={styles.toggleLine}><Text style={styles.toggleTitle}>{label}</Text><Ionicons color={value ? colors.success : colors.muted} name={value ? "checkbox-outline" : "square-outline"} size={24} /></TouchableOpacity>;
}

function PanelToggle({ label, onChange, value }: { label: string; onChange: () => void; value: boolean }) {
  return <TouchableOpacity onPress={onChange} style={[styles.toggleRow, value && styles.toggleActive]}><Text style={styles.toggleTitle}>{label}</Text><Text style={[styles.toggleValue, value && styles.toggleValueActive]}>{value ? "On" : "Off"}</Text></TouchableOpacity>;
}

function VendorOption({ onPress, selected, vendor }: { onPress: () => void; selected: boolean; vendor: Vendor }) {
  return <TouchableOpacity onPress={onPress} style={[styles.vendorOption, selected && styles.vendorSelected]}><Text style={styles.compatName}>{vendor.name}</Text><Text style={styles.compatSku}>{vendor.phone || vendor.email || "Vendor"}</Text></TouchableOpacity>;
}

function FormField({ formKey, keyboardType = "default", label, multiline, setForm, value }: { formKey: keyof FormState; keyboardType?: "default" | "numeric"; label: string; multiline?: boolean; setForm: React.Dispatch<React.SetStateAction<FormState>>; value: string }) {
  return <View style={styles.fieldBlock}><Text style={styles.fieldLabel}>{label}</Text><Field keyboardType={keyboardType} multiline={multiline} onChangeText={(text) => setForm((prev) => ({ ...prev, [formKey]: text }))} placeholder={label} value={value} /></View>;
}

function ScanFieldInput(props: { formKey: keyof FormState; label: string; onScan: () => void; setForm: React.Dispatch<React.SetStateAction<FormState>>; value: string }) {
  return <View style={styles.fieldBlock}><Text style={styles.fieldLabel}>{props.label}</Text><View style={styles.inputWithIcon}><Field onChangeText={(text) => props.setForm((prev) => ({ ...prev, [props.formKey]: text }))} placeholder={props.label} value={props.value} /><TouchableOpacity onPress={props.onScan} style={styles.iconButton}><Ionicons color={colors.primaryDark} name="scan-outline" size={22} /></TouchableOpacity></View></View>;
}

function InfoField(props: { formKey: keyof FormState; keyboardType?: "numeric"; label: string; setForm: React.Dispatch<React.SetStateAction<FormState>>; value: string }) {
  return <View style={styles.fieldBlock}><View style={styles.infoLabelRow}><Text style={styles.fieldLabel}>{props.label}</Text><TouchableOpacity onPress={() => Alert.alert(props.label, "Used for inventory valuation and reorder alerts.")}><Ionicons color={colors.muted} name="information-circle-outline" size={18} /></TouchableOpacity></View><Field keyboardType={props.keyboardType} onChangeText={(text) => props.setForm((prev) => ({ ...prev, [props.formKey]: text }))} value={props.value} /></View>;
}

function CompatiblePicker({ allProducts, editing, form, setForm }: { allProducts: Product[]; editing: Product | null; form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return <View style={styles.compatPanel}><Text style={styles.fieldLabel}>Compatible phone models</Text>{allProducts.filter((item) => item._id !== editing?._id && item.type !== "accessory").slice(0, 8).map((item) => {
    const selected = form.compatibleWith.includes(item._id);
    return <TouchableOpacity key={item._id} onPress={() => setForm((prev) => ({ ...prev, compatibleWith: selected ? prev.compatibleWith.filter((id) => id !== item._id) : [...prev.compatibleWith, item._id] }))} style={[styles.compatOption, selected && styles.compatSelected]}><Text style={[styles.compatName, selected && styles.compatNameSelected]}>{item.name}</Text><Text style={styles.compatSku}>{item.sku}</Text></TouchableOpacity>;
  })}</View>;
}

function StatCard({ danger, label, value, wide }: { danger?: boolean; label: string; value: string | number; wide?: boolean }) {
  return <View style={[styles.statCard, wide && styles.statWide]}><Text style={[styles.statValue, danger && styles.statDanger]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function ProductRow({ item, onDelete, onDetails, onEdit }: { item: Product; onDelete: () => void; onDetails: () => void; onEdit: () => void }) {
  const isLow = item.stockQty <= item.lowStockThreshold;
  const progress = Math.max(0.08, Math.min(1, item.stockQty / Math.max(item.lowStockThreshold * 3, 1)));
  const imageUrl = item.images?.[0];
  return (
    <View style={styles.productCard}>
      <TouchableOpacity activeOpacity={0.8} onPress={onDetails} style={styles.productMain}>
        <View style={styles.avatar}>{imageUrl ? <Image source={{ uri: imageUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>}</View>
        <View style={styles.productInfo}>
          <View style={styles.productTop}><Text numberOfLines={1} style={styles.name}>{item.name}</Text><View style={[styles.statusPill, isLow ? styles.lowPill : styles.okPill]}><Text style={[styles.statusText, isLow ? styles.lowText : styles.okText]}>{isLow ? "Low" : "OK"}</Text></View></View>
          <Text style={styles.meta}>{item.sku} | Rs {formatMoney(item.sellingPrice ?? item.price)}</Text>
          <View style={styles.stockTrack}><View style={[styles.stockFill, { backgroundColor: isLow ? colors.danger : colors.primary, flex: progress }]} /><View style={{ flex: 1 - progress }} /></View>
          <Text style={styles.stockText}>{item.stockQty} in stock | Alert at {item.lowStockThreshold}</Text>
        </View>
      </TouchableOpacity>
      <View style={styles.actions}><TouchableOpacity onPress={onEdit} style={styles.actionButton}><Text style={styles.actionText}>Edit</Text></TouchableOpacity><TouchableOpacity onPress={onDetails} style={[styles.actionButton, styles.detailsButton]}><Text style={styles.actionText}>Details</Text></TouchableOpacity><TouchableOpacity onPress={onDelete} style={[styles.actionButton, styles.deleteButton]}><Text style={styles.deleteText}>Delete</Text></TouchableOpacity></View>
    </View>
  );
}

function nullableNumber(value: string) {
  return value === "" ? null : Number(value);
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
  statValue: { color: colors.text, fontSize: 12, fontWeight: "900" },
  statDanger: { color: colors.danger },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 4 },
  toolbar: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  searchWrap: { flex: 1 },
  searchIcon: { color: colors.muted, fontSize: 10, fontWeight: "800", marginBottom: spacing.xs, textTransform: "uppercase" },
  toolbarButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, minHeight: 42, justifyContent: "center", width: 66, paddingHorizontal: spacing.sm },
  toolbarButtonText: { color: "#fff", fontWeight: "900", fontSize: 12, },
  compactSearchField: { minHeight: 40, paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  listContent: { paddingBottom: spacing.lg },
  productCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.md, overflow: "hidden" },
  productMain: { flexDirection: "row", padding: spacing.md },
  avatar: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: 8, height: 48, justifyContent: "center", marginRight: spacing.sm, width: 48 },
  avatarImage: { borderRadius: 8, height: 48, width: 48 },
  avatarText: { color: colors.primaryDark, fontWeight: "900" },
  productInfo: { flex: 1 },
  productTop: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  name: { color: colors.text, flex: 1, fontSize: 12, fontWeight: "900" },
  meta: { color: colors.muted, marginTop: 2, fontSize: 12 },
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
  sectionBox: { borderBottomColor: colors.border, borderBottomWidth: 1, marginBottom: spacing.md, paddingBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "900", marginBottom: spacing.sm },
  segment: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  segmentButton: { alignItems: "center", backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, minHeight: 42, justifyContent: "center", minWidth: 86, paddingHorizontal: spacing.md },
  segmentActive: { backgroundColor: colors.orangeSoft, borderColor: colors.primary },
  segmentText: { color: colors.text, fontWeight: "900" },
  toggleRow: { alignItems: "center", backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm, minHeight: 54, padding: spacing.md },
  toggleActive: { backgroundColor: colors.tealSoft, borderColor: colors.primary },
  toggleLine: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm, minHeight: 44 },
  toggleTitle: { color: colors.text, fontWeight: "900" },
  toggleValue: { color: colors.muted, fontWeight: "900" },
  toggleValueActive: { color: colors.primaryDark },
  imagePicker: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 150, justifyContent: "center", marginBottom: spacing.md, overflow: "hidden" },
  previewImage: { height: "100%", width: "100%" },
  previewPlaceholder: { alignItems: "center", padding: spacing.md },
  previewTitle: { color: colors.text, fontSize: 17, fontWeight: "900", marginTop: spacing.xs },
  fieldBlock: { marginBottom: spacing.xs },
  fieldLabel: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: spacing.xs },
  inputWithIcon: { position: "relative" },
  iconButton: { alignItems: "center", backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, height: 42, justifyContent: "center", position: "absolute", right: 4, top: 3, width: 42, zIndex: 2 },
  infoLabelRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs },
  inlineLink: { alignSelf: "flex-start", marginBottom: spacing.sm },
  inlineLinkText: { color: colors.primaryDark, fontWeight: "900" },
  inlineAdd: { alignItems: "center", borderColor: colors.primary, borderRadius: 8, borderWidth: 1, minHeight: 42, justifyContent: "center", marginTop: spacing.xs },
  inlineAddText: { color: colors.primaryDark, fontWeight: "900" },
  vendorOption: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.xs, padding: spacing.sm },
  vendorSelected: { backgroundColor: colors.greenSoft, borderColor: colors.success },
  collapseHeader: { alignItems: "center", backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md, minHeight: 52, padding: spacing.md },
  formRow: { flexDirection: "row", gap: spacing.sm },
  formHalf: { flex: 1 },
  formQuarter: { flex: 1 },
  compatPanel: { marginBottom: spacing.sm },
  compatOption: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 8, borderWidth: 1, marginBottom: spacing.xs, padding: spacing.sm },
  compatSelected: { backgroundColor: colors.greenSoft, borderColor: colors.success },
  compatName: { color: colors.text, fontWeight: "900" },
  compatNameSelected: { color: colors.success },
  compatSku: { color: colors.muted, fontSize: 12, marginTop: 2 },
  camera: { borderRadius: 8, flex: 1, overflow: "hidden" },
  scanOverlay: { alignItems: "center", flex: 1, justifyContent: "center" },
  scanFrame: { borderColor: "#fff", borderRadius: 8, borderWidth: 3, height: 220, width: 220 },
  scanHint: { backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8, color: "#fff", fontWeight: "900", marginTop: spacing.md, padding: spacing.sm },
});
