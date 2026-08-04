import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Alert, Platform } from "react-native";
import { logout } from "../redux/authSlice";
import { store } from "../redux/store";

const LOCAL_WEB_API_URL = "http://localhost:8000/api";
const DEFAULT_API_URL = Platform.OS === "web" ? LOCAL_WEB_API_URL : "http://192.168.7.4:8000/api";

function resolveApiBaseUrl() {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  const hostname = Platform.OS === "web" && typeof window !== "undefined" ? window.location.hostname : "";
  const isLocalWebPreview = hostname === "localhost" || hostname === "127.0.0.1";
  if (isLocalWebPreview) return LOCAL_WEB_API_URL;
  return envUrl || DEFAULT_API_URL;
}

export const API_BASE_URL = resolveApiBaseUrl();

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use(async (config) => {
  const token = store.getState().auth.accessToken || await AsyncStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let sessionAlertShown = false;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const message = error.response?.data?.message;
    const shouldLogout = (error.response?.status === 401 || (error.response?.status === 403 && ["Account is blocked", "Organization is inactive", "Subscription is cancelled"].includes(message))) && !String(error.config?.url || "").includes("/auth/login");
    if (shouldLogout) {
      store.dispatch(logout());
      if (!sessionAlertShown) {
        sessionAlertShown = true;
        Alert.alert("Access stopped", message || "Please log in again.", [
          { text: "OK", onPress: () => { sessionAlertShown = false; } },
        ]);
      }
    }
    return Promise.reject(error);
  }
);

export type Product = {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
  price: number;
  sellingPrice?: number;
  costPrice: number;
  stockQty: number;
  lowStockThreshold: number;
  itemType?: "goods" | "service";
  unit?: string;
  returnable?: boolean;
  salesAccount?: string;
  salesDescription?: string;
  purchaseAccount?: string;
  purchaseDescription?: string;
  preferredVendor?: string | Vendor;
  trackInventory?: boolean;
  inventoryAccount?: string;
  openingStock?: number;
  openingStockRatePerUnit?: number;
  inventoryValuationMethod?: "FIFO" | "LIFO" | "Average";
  reorderPoint?: number;
  dimensions?: { length?: number | null; width?: number | null; height?: number | null; unit?: string };
  weight?: number | null;
  weightUnit?: string;
  manufacturer?: string;
  upc?: string;
  mpn?: string;
  ean?: string;
  isbn?: string;
  images?: string[];
  type?: "standalone" | "accessory";
  compatibleWith?: string[] | Product[];
  category?: string | { _id: string; name: string };
  brand?: string | { _id: string; name: string };
};

export type Order = {
  _id: string;
  customer?: Customer;
  items: { _id: string; product: Product; qty: number; price: number }[];
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  paymentStatus: string;
  paymentMethod?: string;
  paymentRef?: string;
  createdAt: string;
};

export type StockMovement = {
  _id: string;
  product: string | Product;
  type: "IN" | "OUT";
  quantity: number;
  reason: "purchase" | "sale" | "return" | "damage" | "adjustment";
  note?: string;
  createdAt: string;
};

export type StockSummary = {
  product?: Product;
  totalIn: number;
  totalOut: number;
  currentStock: number;
};

export type SalesReportRow = {
  date: string;
  totalSales: number;
  totalProfit: number;
  invoiceCount: number;
};

export type Expense = {
  _id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
};

export type Vendor = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  gstNumber?: string;
  notes?: string;
};

export type VendorCall = {
  _id: string;
  vendor: string;
  type: "outgoing" | "incoming" | "missed";
  phone?: string;
  note?: string;
  occurredAt: string;
  createdAt: string;
  source?: "manual" | "auto";
  nativeId?: string;
};

export type VendorCallSummary = {
  today: { date?: string; total: number; outgoing: number; incoming: number; missed: number };
  daily: { date: string; total: number; outgoing: number; incoming: number; missed: number }[];
};

export type PurchaseOrder = {
  _id: string;
  vendor: string | Vendor;
  items: { product: string | Product; quantity: number; costPrice: number }[];
  status: "draft" | "ordered" | "received" | "cancelled";
  totalAmount: number;
  orderDate: string;
  receivedDate?: string;
  notes?: string;
};

export type InventoryAdjustment = {
  _id: string;
  product: string | Product;
  adjustmentType: "increase" | "decrease";
  quantity: number;
  reason: string;
  notes?: string;
  createdAt: string;
};

export type Customer = {
  _id: string;
  name: string;
  phone: string;
  address?: string;
  pendingBalance: number;
};

export type AdminOrganizationRow = {
  _id: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  createdAt: string;
  isActive: boolean;
  plan: string;
  billingCycle?: "monthly" | "yearly";
  subscriptionStatus?: "trial" | "active" | "past_due" | "cancelled";
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  stats: {
    productCount: number;
    customerCount: number;
    totalSales: number;
    totalOrders: number;
    todaySales: number;
    monthSales: number;
    totalExpenses: number;
    totalProfit: number;
    lowStockProductCount: number;
  };
};

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function googleLogin(idToken: string, businessName?: string) {
  const { data } = await api.post("/auth/google", { idToken, businessName });
  return data;
}

export async function getDashboard(params?: { dateFrom?: string; dateTo?: string }) {
  const { data } = await api.get("/dashboard", { params });
  return data;
}

export async function getProducts(search = "") {
  const { data } = await api.get<Product[]>("/inventory/products", { params: { search } });
  return data;
}

export async function getProduct(id: string) {
  const { data } = await api.get<Product>(`/inventory/products/${id}`);
  return data;
}

export async function createProduct(payload: Partial<Product>) {
  const { data } = await api.post<Product>("/inventory/products", payload);
  return data;
}

export async function updateProduct(id: string, payload: Partial<Product>) {
  const { data } = await api.put<Product>(`/inventory/products/${id}`, payload);
  return data;
}

export async function uploadProductImage(id: string, uri: string) {
  const formData = new FormData();
  if (Platform.OS === "web") {
    const file = await fetch(uri).then((response) => response.blob());
    formData.append("image", file, `product-${Date.now()}.jpg`);
  } else {
    formData.append("image", {
      uri,
      name: `product-${Date.now()}.jpg`,
      type: "image/jpeg",
    } as unknown as Blob);
  }
  const { data } = await api.post<{ imageUrl: string; product: Product }>(`/inventory/products/${id}/images`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function getCompatibleAccessories(id: string) {
  const { data } = await api.get<Product[]>(`/inventory/products/${id}/accessories`);
  return data;
}

export async function restockProduct(id: string, payload: { quantity: number; note?: string }) {
  const { data } = await api.post<Product>(`/inventory/products/${id}/restock`, payload);
  return data;
}

export async function getStockMovements(id: string) {
  const { data } = await api.get<{ items: StockMovement[]; page: number; limit: number; total: number; hasMore: boolean }>(`/inventory/products/${id}/movements`);
  return data;
}

export async function getStockSummary(params?: { from?: string; to?: string }) {
  const { data } = await api.get<StockSummary[]>("/inventory/stock-summary", { params });
  return data;
}

export async function scanProduct(code: string) {
  const { data } = await api.get<Product>(`/inventory/products/scan/${encodeURIComponent(code)}`);
  return data;
}

export async function deleteProduct(id: string) {
  await api.delete(`/inventory/products/${id}`);
}

export async function getCustomers() {
  const { data } = await api.get<Customer[]>("/customers");
  return data;
}

export async function createCustomer(payload: Partial<Customer>) {
  const { data } = await api.post<Customer>("/customers", payload);
  return data;
}

export async function updateCustomer(id: string, payload: Partial<Customer>) {
  const { data } = await api.put<Customer>(`/customers/${id}`, payload);
  return data;
}

export async function deleteCustomer(id: string) {
  await api.delete(`/customers/${id}`);
}

export async function createOrder(payload: unknown) {
  const { data } = await api.post("/orders", payload);
  return data;
}

export async function quickSale(payload: { items: { productId: string; qty: number }[]; customerId?: string; paymentMethod?: string; paymentRef?: string }) {
  const { data } = await api.post<Order>("/orders/quick-sale", payload);
  return data;
}

export async function getOrders(params?: { dateFrom?: string; dateTo?: string; customer?: string }) {
  const { data } = await api.get<Order[]>("/orders", { params });
  return data;
}

export async function getUpiConfig() {
  const { data } = await api.get<{ upiId: string; payeeName: string }>("/config/upi");
  return data;
}

export async function getSalesReport(params?: { from?: string; to?: string }) {
  const { data } = await api.get<SalesReportRow[]>("/reports/sales", { params });
  return data;
}

export async function getExpenses(params?: { from?: string; to?: string }) {
  const { data } = await api.get<{ items: Expense[]; total: number }>("/expenses", { params });
  return data;
}

export async function createExpense(payload: Partial<Expense>) {
  const { data } = await api.post<Expense>("/expenses", payload);
  return data;
}

export async function updateExpense(id: string, payload: Partial<Expense>) {
  const { data } = await api.put<Expense>(`/expenses/${id}`, payload);
  return data;
}

export async function deleteExpense(id: string) {
  await api.delete(`/expenses/${id}`);
}

export async function getVendors(search = "") {
  const { data } = await api.get<Vendor[]>("/vendors", { params: { search } });
  return data;
}

export async function createVendor(payload: Partial<Vendor>) {
  const { data } = await api.post<Vendor>("/vendors", payload);
  return data;
}

export async function updateVendor(id: string, payload: Partial<Vendor>) {
  const { data } = await api.put<Vendor>(`/vendors/${id}`, payload);
  return data;
}

export async function deleteVendor(id: string) {
  await api.delete(`/vendors/${id}`);
}

export async function getVendorCalls(id: string, date?: string) {
  const { data } = await api.get<VendorCall[]>(`/vendors/${id}/calls`, { params: { date } });
  return data;
}

export async function createVendorCall(id: string, payload: Partial<VendorCall>) {
  const { data } = await api.post<VendorCall>(`/vendors/${id}/calls`, payload);
  return data;
}

export async function getVendorCallSummary(days = 7, date?: string) {
  const { data } = await api.get<VendorCallSummary>("/vendors/calls/summary", { params: { days, date } });
  return data;
}

export async function getPurchaseOrders() {
  const { data } = await api.get<PurchaseOrder[]>("/purchase-orders");
  return data;
}

export async function createPurchaseOrder(payload: Partial<PurchaseOrder>) {
  const { data } = await api.post<PurchaseOrder>("/purchase-orders", payload);
  return data;
}

export async function updatePurchaseOrder(id: string, payload: Partial<PurchaseOrder>) {
  const { data } = await api.put<PurchaseOrder>(`/purchase-orders/${id}`, payload);
  return data;
}

export async function deletePurchaseOrder(id: string) {
  await api.delete(`/purchase-orders/${id}`);
}

export async function receivePurchaseOrder(id: string) {
  const { data } = await api.post<PurchaseOrder>(`/purchase-orders/${id}/receive`);
  return data;
}

export async function createInventoryAdjustment(payload: { productId: string; adjustmentType: "increase" | "decrease"; quantity: number; reason: string; notes?: string }) {
  const { data } = await api.post<InventoryAdjustment>("/inventory-adjustments", payload);
  return data;
}

export async function getInventoryAdjustments() {
  const { data } = await api.get<InventoryAdjustment[]>("/inventory-adjustments");
  return data;
}

export async function getAdminOrganizations() {
  const { data } = await api.get<AdminOrganizationRow[]>("/admin/organizations");
  return data;
}

export async function getAdminOrganization(id: string) {
  const { data } = await api.get<{ organization: AdminOrganizationRow; dashboard: AdminOrganizationRow["stats"] }>(`/admin/organizations/${id}`);
  return data;
}

export async function getAdminOrganizationUsers(id: string) {
  const { data } = await api.get<{ _id: string; name: string; email: string; role: string; authProvider?: string; isActive?: boolean; blockedAt?: string | null; blockedReason?: string | null }[]>(`/admin/organizations/${id}/users`);
  return data;
}

export async function createShopOwner(payload: { name: string; email: string; password: string; phone?: string; businessName: string; plan?: string; billingCycle?: "monthly" | "yearly" }) {
  const { data } = await api.post("/admin/shop-owners", payload);
  return data;
}

export async function updateAdminOrganization(id: string, payload: { isActive?: boolean; plan?: string; billingCycle?: "monthly" | "yearly"; subscriptionStatus?: "trial" | "active" | "past_due" | "cancelled"; renewSubscription?: boolean }) {
  const { data } = await api.patch(`/admin/organizations/${id}`, payload);
  return data;
}

export async function blockAdminUser(id: string, reason?: string) {
  const { data } = await api.patch(`/admin/users/${id}/block`, { reason });
  return data;
}

export async function unblockAdminUser(id: string) {
  const { data } = await api.patch(`/admin/users/${id}/unblock`);
  return data;
}
