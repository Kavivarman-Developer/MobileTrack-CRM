import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Alert, Platform } from "react-native";
import { logout } from "../redux/authSlice";
import { store } from "../redux/store";

const DEFAULT_API_URL = Platform.OS === "web" ? "http://localhost:8000/api" : "http://192.168.7.4:8000/api";

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

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
    if (error.response?.status === 401 && !String(error.config?.url || "").includes("/auth/login")) {
      store.dispatch(logout());
      if (!sessionAlertShown) {
        sessionAlertShown = true;
        Alert.alert("Session expired", "Please log in again.", [
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
  costPrice: number;
  stockQty: number;
  lowStockThreshold: number;
  images?: string[];
  type?: "standalone" | "accessory";
  compatibleWith?: string[] | Product[];
  category?: { _id: string; name: string };
  brand?: { _id: string; name: string };
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

export type Customer = {
  _id: string;
  name: string;
  phone: string;
  address?: string;
  pendingBalance: number;
};

export async function login(email: string, password: string) {
  const { data } = await api.post("/auth/login", { email, password });
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
