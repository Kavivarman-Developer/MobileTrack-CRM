import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useMemo, useState } from "react";
import { Alert, FlatList, Image, Modal, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { z } from "zod";
import { Badge, Button, Empty, FabButton, Field, FilterChipRow, IconButton, IosFormSheet, IosScreenHeader, IosSearchBar, Screen, SelectOption, StatStrip } from "../../components/Layout";
import { SubscriptionModal } from "../../components/SubscriptionModal";
import { useAppSelector } from "../../hooks/redux";
import { ios } from "../../constants/ios";
import { radius, shadows, spacing } from "../../constants/theme";
import { apiErrorMessage, createInventoryAdjustment, createProduct, createVendor, getProducts, getVendors, Product, updateProduct, uploadProductImage, Vendor } from "../../services/api";

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
  const user = useAppSelector((state) => state.auth.user);
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width >= 1024;
  const [subModalOpen, setSubModalOpen] = useState(false);
  const isActivated = user?.subscriptionStatus === "active";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
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

  const catalog = products.data || [];
  const inventoryStats = useMemo(() => {
    return {
      total: catalog.length,
      inStock: catalog.filter((item) => item.stockQty > item.lowStockThreshold).length,
      lowStock: catalog.filter((item) => item.stockQty > 0 && item.stockQty <= item.lowStockThreshold).length,
      outStock: catalog.filter((item) => item.stockQty <= 0).length,
      needsAttention: catalog.filter((item) => item.stockQty <= item.lowStockThreshold).length,
      stockValue: catalog.reduce((sum, item) => sum + item.stockQty * item.costPrice, 0),
    };
  }, [catalog]);

  const categories = useMemo(() => {
    const names = new Set<string>();
    catalog.forEach((item) => {
      const name = typeof item.category === "object" ? item.category?.name : item.category;
      if (name) names.add(String(name));
    });
    return Array.from(names).sort();
  }, [catalog]);

  const filteredProducts = useMemo(() => {
    return catalog.filter((item) => {
      if (statusFilter === "in") return item.stockQty > item.lowStockThreshold;
      if (statusFilter === "low") return item.stockQty > 0 && item.stockQty <= item.lowStockThreshold;
      if (statusFilter === "out") return item.stockQty <= 0;
      return true;
    }).filter((item) => {
      if (categoryFilter === "all") return true;
      const name = typeof item.category === "object" ? item.category?.name : item.category;
      return String(name || "") === categoryFilter;
    });
  }, [catalog, statusFilter, categoryFilter]);

  const quickVendor = useMutation({
    mutationFn: () => createVendor({ name: vendorSearch }),
    onSuccess: (vendor) => {
      setForm((prev) => ({ ...prev, preferredVendor: vendor._id }));
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
  });
  const adjustStock = useMutation({
    mutationFn: ({ productId, type }: { productId: string; type: "increase" | "decrease" }) =>
      createInventoryAdjustment({
        productId,
        adjustmentType: type,
        quantity: 1,
        reason: "Quick stock adjust",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
    onError: (error: Error) => Alert.alert("Stock update failed", apiErrorMessage(error)),
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
    onError: (error: Error) => Alert.alert("Save failed", apiErrorMessage(error)),
  });

  function openForm(product?: Product) {
    if (!product && !isActivated) {
      setSubModalOpen(true);
      return;
    }
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
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="Stock control"
        left={
          !isDesktop ? (
            <TouchableOpacity accessibilityLabel="Open menu" onPress={() => navigation.getParent()?.openDrawer?.()} style={styles.menuBtn}>
              <Ionicons color={ios.label} name="menu" size={22} />
            </TouchableOpacity>
          ) : undefined
        }
        right={(
          <TouchableOpacity
            accessibilityLabel="Barcode generator"
            onPress={() => navigation.navigate("BarcodeGenerator")}
            style={styles.barcodeButton}
          >
            <Ionicons color={ios.navy} name="scan-outline" size={20} />
          </TouchableOpacity>
        )}
        title="Items"
      />

      <FlatList
        key={isDesktop ? "grid-4" : "grid-2"}
        data={filteredProducts}
        keyExtractor={(item) => item._id}
        numColumns={isDesktop ? 4 : 2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={(
          <View>
            {!isActivated && (
              <TouchableOpacity
                style={styles.activationBanner}
                onPress={() => setSubModalOpen(true)}
                activeOpacity={0.88}
              >
                <View style={styles.activationBannerLeft}>
                  <View style={styles.activationBannerIconWrap}>
                    <Ionicons color="#D97706" name="flash" size={15} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activationBannerTitle}>Activate Shop · ₹1 Launch Offer</Text>
                    <Text style={styles.activationBannerSub}>Unlock full inventory & unlimited products</Text>
                  </View>
                </View>
                <View style={styles.activationBannerBtn}>
                  <Text style={styles.activationBannerBtnText}>Pay ₹1</Text>
                  <Ionicons color="#FFFFFF" name="arrow-forward" size={11} />
                </View>
              </TouchableOpacity>
            )}
            <StatStrip
              items={[
                { label: "Total items", value: String(inventoryStats.total), icon: "cube-outline", tone: "purple" },
                { label: "Needs attention", value: String(inventoryStats.needsAttention), icon: "warning-outline", tone: "orange" },
                { label: "Stock value", value: `₹${formatMoney(inventoryStats.stockValue)}`, icon: "trending-up-outline", tone: "green" },
              ]}
            />
            <IosSearchBar
              onChangeText={setSearch}
              onFilterPress={openViewItems}
              placeholder="Search by name, SKU or category"
              value={search}
            />
            <FilterChipRow
              chips={[
                { key: "all", label: "All", count: inventoryStats.total },
                { key: "in", label: "In stock", count: inventoryStats.inStock },
                { key: "low", label: "Low stock", count: inventoryStats.lowStock },
                { key: "out", label: "Out of stock", count: inventoryStats.outStock },
              ]}
              onChange={setStatusFilter}
              value={statusFilter}
              variant="status"
            />
            <FilterChipRow
              chips={[
                { key: "all", label: "All" },
                ...categories.map((name) => ({ key: name, label: name })),
              ]}
              onChange={setCategoryFilter}
              value={categoryFilter}
              variant="category"
            />
          </View>
        )}
        ListEmptyComponent={<Empty icon="cube-outline" text={products.isLoading ? "Loading products..." : "No products added yet."} />}
        renderItem={({ item }) => (
          <ProductGridCard
            item={item}
            onDecrease={() => adjustStock.mutate({ productId: item._id, type: "decrease" })}
            onDetails={() => navigation.navigate("ProductDetail", { productId: item._id })}
            onIncrease={() => adjustStock.mutate({ productId: item._id, type: "increase" })}
            onLongPress={() => openForm(item)}
          />
        )}
      />

      <FabButton accessibilityLabel="Add item" onPress={() => openForm()} />

      {/* View Items */}
      <IosFormSheet
        eyebrow="All catalog items"
        onClose={closeViewItems}
        title="View Items"
        visible={viewItemsOpen}
      >
        <IosSearchBar onChangeText={setViewSearch} placeholder="Search item name or SKU…" value={viewSearch} />
        {(viewProducts.length ? viewProducts : []).map((item) => (
          <SelectOption
            key={item._id}
            label={item.name}
            meta={`${item.sku} · ₹${formatMoney(item.sellingPrice ?? item.price)} · ${item.stockQty} in stock`}
            onPress={() => { closeViewItems(); navigation.navigate("ProductDetail", { productId: item._id }); }}
            selected={false}
          />
        ))}
        {!viewProducts.length ? (
          <Empty icon="cube-outline" text={allProducts.isLoading ? "Loading all items..." : "No items found."} />
        ) : null}
      </IosFormSheet>

      {/* Product Form */}
      <IosFormSheet
        eyebrow={editing ? "Update item" : "New item"}
        footerLabel="Save Product"
        footerLoading={save.isPending}
        onClose={closeForm}
        onFooterPress={() => save.mutate()}
        title={editing ? "Edit Product" : "Add Product"}
        visible={open}
      >
        <Section title="Item Type">
          <Segment value={form.itemType} options={[["goods", "Goods"], ["service", "Service"]]} onChange={(value) => setForm((prev) => ({ ...prev, itemType: value as FormState["itemType"] }))} />
        </Section>
        <Section title="Basic Details">
          <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
            {selectedImage || editing?.images?.[0] ? (
              <Image source={{ uri: selectedImage || editing?.images?.[0] }} style={styles.previewImage} />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Ionicons color={ios.blue} name="image-outline" size={28} />
                <Text style={styles.previewTitle}>+ Upload Product Image</Text>
              </View>
            )}
          </TouchableOpacity>
          <FormField formKey="name" label="Item Name" setForm={setForm} value={form.name} />
          <ScanFieldInput formKey="sku" label="SKU / Barcode" onScan={() => openScanner("sku")} setForm={setForm} value={form.sku} />
          <FormField formKey="unit" label="Unit of Measure (pcs, kg, etc.)" setForm={setForm} value={form.unit} />
          <Text style={styles.fieldLabel}>Category</Text>
          <Segment value={form.category || "Smartphones"} options={[["Smartphones", "Smartphones"], ["Tablets", "Tablets"], ["Accessories", "Accessories"]]} onChange={(value) => setForm((prev) => ({ ...prev, category: value }))} />
          <FormField formKey="category" label="Category Name" setForm={setForm} value={form.category} />
          <Toggle label="Returnable Item" value={form.returnable} onChange={() => setForm((prev) => ({ ...prev, returnable: !prev.returnable }))} />
        </Section>
        <PanelToggle label="Sales Information" value={form.salesEnabled} onChange={() => setForm((prev) => ({ ...prev, salesEnabled: !prev.salesEnabled }))} />
        {form.salesEnabled && (
          <Section title="Sales Settings">
            <FormField formKey="sellingPrice" keyboardType="numeric" label="Selling Price (INR ₹)" setForm={setForm} value={form.sellingPrice} />
            <FormField formKey="salesAccount" label="Sales Account Name" setForm={setForm} value={form.salesAccount} />
            <FormField formKey="salesDescription" label="Sales Description" multiline setForm={setForm} value={form.salesDescription} />
          </Section>
        )}
        <PanelToggle label="Purchase Information" value={form.purchaseEnabled} onChange={() => setForm((prev) => ({ ...prev, purchaseEnabled: !prev.purchaseEnabled }))} />
        {form.purchaseEnabled && (
          <Section title="Purchase Settings">
            <FormField formKey="costPrice" keyboardType="numeric" label="Cost Price (INR ₹)" setForm={setForm} value={form.costPrice} />
            <FormField formKey="purchaseAccount" label="Purchase Account Name" setForm={setForm} value={form.purchaseAccount} />
            <FormField formKey="purchaseDescription" label="Purchase Description" multiline setForm={setForm} value={form.purchaseDescription} />
            <Text style={styles.fieldLabel}>Preferred Vendor</Text>
            <Field onChangeText={setVendorSearch} placeholder="Start typing vendor name..." value={vendorSearch} />
            {(vendors.data || []).slice(0, 5).map((vendor) => (
              <VendorOption key={vendor._id} selected={form.preferredVendor === vendor._id} vendor={vendor} onPress={() => setForm((prev) => ({ ...prev, preferredVendor: vendor._id }))} />
            ))}
            {!!vendorSearch && (
              <TouchableOpacity onPress={() => quickVendor.mutate()} style={styles.inlineAdd}>
                <Text style={styles.inlineAddText}>+ Add New Vendor</Text>
              </TouchableOpacity>
            )}
          </Section>
        )}
        <PanelToggle label="Track Inventory for this item" value={form.trackInventory} onChange={() => setForm((prev) => ({ ...prev, trackInventory: !prev.trackInventory }))} />
        {form.trackInventory && (
          <Section title="Stock Control Settings">
            <FormField formKey="inventoryAccount" label="Inventory Account Name" setForm={setForm} value={form.inventoryAccount} />
            <InfoField formKey="openingStock" keyboardType="numeric" label="Opening Stock Quantity" setForm={setForm} value={form.openingStock} />
            <InfoField formKey="openingStockRatePerUnit" keyboardType="numeric" label="Opening Stock Rate / Unit" setForm={setForm} value={form.openingStockRatePerUnit} />
            <Text style={styles.fieldLabel}>Valuation Method</Text>
            <Segment value={form.inventoryValuationMethod} options={[["FIFO", "FIFO"], ["LIFO", "LIFO"], ["Average", "Average"]]} onChange={(value) => setForm((prev) => ({ ...prev, inventoryValuationMethod: value as FormState["inventoryValuationMethod"] }))} />
            <InfoField formKey="reorderPoint" keyboardType="numeric" label="Reorder Threshold" setForm={setForm} value={form.reorderPoint} />
          </Section>
        )}
        <TouchableOpacity onPress={() => setForm((prev) => ({ ...prev, moreOpen: !prev.moreOpen }))} style={styles.collapseHeader}>
          <Text style={styles.sectionTitle}>Additional Fields (Dimensions, UPC, Brand)</Text>
          <Ionicons color={ios.label} name={form.moreOpen ? "chevron-up" : "chevron-down"} size={20} />
        </TouchableOpacity>
        {form.moreOpen && (
          <Section title="Dimensions & Barcodes">
            <View style={styles.formRow}>
              <View style={styles.formQuarter}><FormField formKey="dimensionLength" keyboardType="numeric" label="Length" setForm={setForm} value={form.dimensionLength} /></View>
              <View style={styles.formQuarter}><FormField formKey="dimensionWidth" keyboardType="numeric" label="Width" setForm={setForm} value={form.dimensionWidth} /></View>
              <View style={styles.formQuarter}><FormField formKey="dimensionHeight" keyboardType="numeric" label="Height" setForm={setForm} value={form.dimensionHeight} /></View>
              <View style={styles.formQuarter}><FormField formKey="dimensionUnit" label="Unit" setForm={setForm} value={form.dimensionUnit} /></View>
            </View>
            <View style={styles.formRow}>
              <View style={styles.formHalf}><FormField formKey="weight" keyboardType="numeric" label="Weight" setForm={setForm} value={form.weight} /></View>
              <View style={styles.formHalf}><FormField formKey="weightUnit" label="Unit" setForm={setForm} value={form.weightUnit} /></View>
            </View>
            <FormField formKey="manufacturer" label="Manufacturer" setForm={setForm} value={form.manufacturer} />
            <FormField formKey="brand" label="Brand" setForm={setForm} value={form.brand} />
            <ScanFieldInput formKey="upc" label="UPC" onScan={() => openScanner("upc")} setForm={setForm} value={form.upc} />
            <ScanFieldInput formKey="mpn" label="MPN" onScan={() => openScanner("mpn")} setForm={setForm} value={form.mpn} />
            <ScanFieldInput formKey="ean" label="EAN" onScan={() => openScanner("ean")} setForm={setForm} value={form.ean} />
            <ScanFieldInput formKey="isbn" label="ISBN" onScan={() => openScanner("isbn")} setForm={setForm} value={form.isbn} />
          </Section>
        )}
        <Toggle label="Is this an accessory?" value={form.type === "accessory"} onChange={() => setForm((prev) => ({ ...prev, type: prev.type === "accessory" ? "standalone" : "accessory", compatibleWith: prev.type === "accessory" ? [] : prev.compatibleWith }))} />
        {form.type === "accessory" && <CompatiblePicker allProducts={allProducts.data || []} editing={editing} form={form} setForm={setForm} />}
      </IosFormSheet>

      {/* Barcode Scanner Modal */}
      <Modal animationType="slide" onRequestClose={() => setScanOpen(false)} visible={scanOpen}>
        <Screen style={styles.screen}>
          <IosScreenHeader
            eyebrow="Barcode scanner"
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setScanOpen(false)} />}
            title={`Scan ${scanField.toUpperCase()}`}
          />
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
            <View style={styles.permissionCard}>
              <Text style={styles.previewTitle}>Camera Access Needed</Text>
              <Button onPress={() => requestPermission()} title="Allow Camera" />
            </View>
          )}
        </Screen>
      </Modal>

      <SubscriptionModal
        visible={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        onActivated={() => queryClient.invalidateQueries({ queryKey: ["products"] })}
      />
    </Screen>
  );
}

function Section({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View style={styles.sectionBox}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Segment({ onChange, options, value }: { onChange: (value: string) => void; options: string[][]; value: string }) {
  return (
    <View>
      {options.map(([key, label]) => (
        <SelectOption key={key} label={label} onPress={() => onChange(key)} selected={value === key} />
      ))}
    </View>
  );
}

function Toggle({ label, onChange, value }: { label: string; onChange: () => void; value: boolean }) {
  return (
    <TouchableOpacity onPress={onChange} style={styles.toggleLine}>
      <Text style={styles.toggleTitle}>{label}</Text>
      <Ionicons color={value ? ios.green : ios.secondary} name={value ? "checkbox" : "square-outline"} size={22} />
    </TouchableOpacity>
  );
}

function PanelToggle({ label, onChange, value }: { label: string; onChange: () => void; value: boolean }) {
  return (
    <TouchableOpacity onPress={onChange} style={[styles.toggleRow, value && styles.toggleActive]}>
      <Text style={styles.toggleTitle}>{label}</Text>
      <Badge label={value ? "ON" : "OFF"} tone={value ? "success" : "neutral"} />
    </TouchableOpacity>
  );
}

function VendorOption({ onPress, selected, vendor }: { onPress: () => void; selected: boolean; vendor: Vendor }) {
  return (
    <SelectOption
      label={vendor.name}
      meta={vendor.phone || vendor.email || "Vendor"}
      onPress={onPress}
      selected={selected}
    />
  );
}

function FormField({ formKey, keyboardType = "default", label, multiline, setForm, value }: { formKey: keyof FormState; keyboardType?: "default" | "numeric"; label: string; multiline?: boolean; setForm: React.Dispatch<React.SetStateAction<FormState>>; value: string }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Field keyboardType={keyboardType} multiline={multiline} onChangeText={(text) => setForm((prev) => ({ ...prev, [formKey]: text }))} placeholder={label} value={value} />
    </View>
  );
}

function ScanFieldInput(props: { formKey: keyof FormState; label: string; onScan: () => void; setForm: React.Dispatch<React.SetStateAction<FormState>>; value: string }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{props.label}</Text>
      <View style={styles.inputWithIcon}>
        <Field onChangeText={(text) => props.setForm((prev) => ({ ...prev, [props.formKey]: text }))} placeholder={props.label} value={props.value} />
        <TouchableOpacity onPress={props.onScan} style={styles.iconButton}>
          <Ionicons color={ios.blue} name="scan-outline" size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function InfoField(props: { formKey: keyof FormState; keyboardType?: "numeric"; label: string; setForm: React.Dispatch<React.SetStateAction<FormState>>; value: string }) {
  return (
    <View style={styles.fieldBlock}>
      <View style={styles.infoLabelRow}>
        <Text style={styles.fieldLabel}>{props.label}</Text>
        <TouchableOpacity onPress={() => Alert.alert(props.label, "Used for inventory valuation and reorder alerts.")}>
          <Ionicons color={ios.secondary} name="information-circle-outline" size={16} />
        </TouchableOpacity>
      </View>
      <Field keyboardType={props.keyboardType} onChangeText={(text) => props.setForm((prev) => ({ ...prev, [props.formKey]: text }))} value={props.value} />
    </View>
  );
}

function CompatiblePicker({ allProducts, editing, form, setForm }: { allProducts: Product[]; editing: Product | null; form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> }) {
  return (
    <View style={styles.compatPanel}>
      <Text style={styles.fieldLabel}>Compatible Phone Models</Text>
      {allProducts.filter((item) => item._id !== editing?._id && item.type !== "accessory").slice(0, 8).map((item) => {
        const selected = form.compatibleWith.includes(item._id);
        return (
          <SelectOption
            key={item._id}
            label={item.name}
            meta={item.sku}
            multi
            onPress={() => setForm((prev) => ({
              ...prev,
              compatibleWith: selected ? prev.compatibleWith.filter((id) => id !== item._id) : [...prev.compatibleWith, item._id],
            }))}
            selected={selected}
          />
        );
      })}
    </View>
  );
}

function ProductGridCard({
  item,
  onDecrease,
  onDetails,
  onIncrease,
  onLongPress,
}: {
  item: Product;
  onDecrease: () => void;
  onDetails: () => void;
  onIncrease: () => void;
  onLongPress: () => void;
}) {
  const out = item.stockQty <= 0;
  const low = !out && item.stockQty <= item.lowStockThreshold;
  const status = out ? "OUT" : low ? "LOW" : "IN STOCK";
  const statusColor = out ? ios.red : low ? ios.orange : ios.green;
  const target = Math.max(item.lowStockThreshold * 2, item.reorderPoint || 1, 1);
  const progress = Math.max(0.05, Math.min(1, item.stockQty / target));
  const imageUrl = item.images?.[0];
  const price = item.sellingPrice ?? item.price;

  return (
    <TouchableOpacity activeOpacity={0.92} onLongPress={onLongPress} onPress={onDetails} style={styles.gridCard}>
      <View style={styles.gridImageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.gridImage} />
        ) : (
          <View style={styles.gridImagePlaceholder}>
            <Text style={styles.gridImageInitials}>{item.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}22` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={styles.gridName}>{item.name}</Text>
      <View style={styles.gridMetaRow}>
        <Text style={styles.gridPrice}>₹{formatMoney(price)}</Text>
        <Text style={styles.gridStock}>{item.stockQty}/{item.lowStockThreshold || target}</Text>
      </View>
      <View style={styles.gridTrack}>
        <View style={[styles.gridFill, { backgroundColor: statusColor, width: `${Math.round(progress * 100)}%` as any }]} />
      </View>
      <View style={styles.gridActions}>
        <TouchableOpacity
          accessibilityLabel="Decrease stock"
          onPress={(e) => { e.stopPropagation?.(); onDecrease(); }}
          style={styles.gridActionBtn}
        >
          <Ionicons color="#FFFFFF" name="remove" size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="View details"
          onPress={(e) => { e.stopPropagation?.(); onDetails(); }}
          style={[styles.gridActionBtn, styles.gridViewBtn]}
        >
          <Ionicons color="#FFFFFF" name="eye-outline" size={16} />
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Increase stock"
          onPress={(e) => { e.stopPropagation?.(); onIncrease(); }}
          style={[styles.gridActionBtn, styles.gridPlusBtn]}
        >
          <Ionicons color="#FFFFFF" name="add" size={16} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

function nullableNumber(value: string) {
  return value === "" ? null : Number(value);
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  screen: { backgroundColor: ios.bg, flex: 1 },
  menuBtn: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  barcodeButton: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },

  listContent: { paddingBottom: 40 },
  gridRow: { gap: 12, marginBottom: 12 },
  gridCard: {
    backgroundColor: ios.card,
    borderRadius: radius.lg,
    flex: 1,
    overflow: "hidden",
    padding: 10,
    ...{
      shadowColor: "#1B1F3B",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
  },
  gridImageWrap: {
    borderRadius: radius.md,
    height: 120,
    marginBottom: 10,
    overflow: "hidden",
    position: "relative",
  },
  gridImage: { height: "100%", width: "100%" },
  gridImagePlaceholder: {
    alignItems: "center",
    backgroundColor: ios.fill,
    flex: 1,
    height: "100%",
    justifyContent: "center",
  },
  gridImageInitials: { color: ios.blue, fontSize: 22, fontWeight: "700" },
  statusBadge: {
    alignItems: "center",
    borderRadius: radius.pill,
    bottom: 8,
    flexDirection: "row",
    gap: 4,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: "absolute",
  },
  statusDot: { borderRadius: 4, height: 6, width: 6 },
  statusText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.3 },
  gridName: { color: ios.label, fontSize: 14, fontWeight: "700" },
  gridMetaRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  gridPrice: { color: ios.label, fontSize: 14, fontWeight: "700" },
  gridStock: { color: ios.secondary, fontSize: 12, fontWeight: "600" },
  gridTrack: { backgroundColor: ios.fill, borderRadius: radius.pill, height: 4, marginTop: 8, overflow: "hidden" },
  gridFill: { borderRadius: radius.pill, height: "100%" },
  gridActions: {
    backgroundColor: ios.actionBar,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
    padding: 6,
  },
  gridActionBtn: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    flex: 1,
    height: 34,
    justifyContent: "center",
  },
  gridViewBtn: { backgroundColor: ios.navy },
  gridPlusBtn: { backgroundColor: ios.blue },

  sectionBox: { borderBottomColor: ios.separator, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: spacing.md, paddingBottom: spacing.md },
  sectionTitle: { color: ios.label, fontSize: 16, fontWeight: "700", marginBottom: spacing.sm },

  toggleRow: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderColor: ios.fill,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  toggleActive: { borderColor: ios.blue },
  toggleLine: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm, minHeight: 44 },
  toggleTitle: { color: ios.label, fontSize: 14, fontWeight: "600" },

  imagePicker: {
    backgroundColor: ios.fill,
    borderRadius: radius.md,
    height: 140,
    justifyContent: "center",
    marginBottom: spacing.md,
    overflow: "hidden",
  },
  previewImage: { height: "100%", width: "100%" },
  previewPlaceholder: { alignItems: "center", padding: spacing.md },
  previewTitle: { color: ios.secondary, fontSize: 13, fontWeight: "500", marginTop: spacing.xs },

  fieldBlock: { marginBottom: spacing.xs },
  fieldLabel: { color: ios.secondary, fontSize: 13, fontWeight: "600", marginBottom: spacing.xs },
  inputWithIcon: { position: "relative" },
  iconButton: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: radius.sm,
    height: 42,
    justifyContent: "center",
    position: "absolute",
    right: 4,
    top: 3,
    width: 42,
    zIndex: 2,
  },
  infoLabelRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs },

  inlineAdd: {
    alignItems: "center",
    borderColor: ios.blue,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: "center",
    marginTop: spacing.xs,
    minHeight: 44,
  },
  inlineAddText: { color: ios.blue, fontWeight: "600" },
  collapseHeader: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderColor: ios.fill,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  formRow: { flexDirection: "row", gap: spacing.xs },
  formHalf: { flex: 1 },
  formQuarter: { flex: 1 },
  compatPanel: { marginBottom: spacing.sm },

  permissionCard: {
    backgroundColor: ios.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  camera: { borderRadius: radius.lg, flex: 1, marginBottom: spacing.md, overflow: "hidden" },
  scanOverlay: { alignItems: "center", flex: 1, justifyContent: "center" },
  scanFrame: { borderColor: "#FFFFFF", borderRadius: radius.md, borderWidth: 3, height: 220, width: 220 },
  scanHint: {
    backgroundColor: "rgba(28, 28, 30, 0.75)",
    borderRadius: radius.sm,
    color: "#FFFFFF",
    fontWeight: "600",
    marginTop: spacing.md,
    overflow: "hidden",
    padding: spacing.sm,
  },

  /* Activation Banner */
  activationBanner: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FDE68A",
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 10,
    ...shadows.sm,
  },
  activationBannerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  activationBannerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  activationBannerTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0D3666",
  },
  activationBannerSub: {
    fontSize: 11,
    color: "#64748B",
  },
  activationBannerBtn: {
    backgroundColor: "#F59926",
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  activationBannerBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 11.5,
  },
});
