import { Platform } from "react-native";
import Toast from "react-native-toast-message";
import { registerFcmToken } from "./api";

/**
 * Request notification permission and initialize push messaging
 */
export async function initializeNotifications() {
  try {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
      }
    }
  } catch (error: any) {
    console.warn("Notifications init warning:", error?.message || error);
  }
}

/**
 * Display a low stock alert banner and optional native notification
 */
export function displayLowStockAlert(product: {
  name: string;
  sku?: string;
  stockQty: number;
  lowStockThreshold?: number;
}) {
  const title = `⚠️ Low Stock Alert: ${product.name}`;
  const message = `Only ${product.stockQty} left in stock! (Reorder point: ${product.lowStockThreshold ?? 5})`;

  // 1. Show Toast in App
  Toast.show({
    type: "error",
    text1: title,
    text2: message,
    visibilityTime: 6000,
    autoHide: true,
  });

  // 2. If Web and browser notifications permitted, show system notification
  if (Platform.OS === "web" && typeof window !== "undefined" && "Notification" in window) {
    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: message,
          icon: "/favicon.ico",
        });
      } catch (e) {}
    }
  }
}
