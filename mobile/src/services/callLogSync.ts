import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking, PermissionsAndroid, Platform } from "react-native";
import { createVendorCall, getVendors, Vendor } from "./api";

declare const require: (name: string) => any;

const LAST_SYNC_KEY = "vendorCallLogLastSyncAt";
const DENIED_KEY = "vendorCallLogPermissionDenied";

type SyncResult = { synced: number; permissionDenied: boolean; unsupported: boolean };

function normalizePhone(value?: string) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("91")) return digits.slice(-10);
  return digits.slice(-10);
}

function callType(value: unknown): "outgoing" | "incoming" | "missed" | null {
  const text = String(value || "").toLowerCase();
  if (text === "2" || text.includes("out")) return "outgoing";
  if (text === "1" || text.includes("in")) return "incoming";
  if (text === "3" || text.includes("miss")) return "missed";
  return null;
}

function vendorByPhone(vendors: Vendor[]) {
  const rows = new Map<string, Vendor>();
  vendors.forEach((vendor) => {
    const phone = normalizePhone(vendor.phone);
    if (phone) rows.set(phone, vendor);
  });
  return rows;
}

async function ensurePermission() {
  if (Platform.OS !== "android") return false;
  const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
  if (granted) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CALL_LOG);
  const allowed = result === PermissionsAndroid.RESULTS.GRANTED;
  if (!allowed) await AsyncStorage.setItem(DENIED_KEY, "1");
  return allowed;
}

export async function openCallLogSettings() {
  await Linking.openSettings();
}

export async function hasCallLogPermissionWarning() {
  return (await AsyncStorage.getItem(DENIED_KEY)) === "1";
}

export async function syncVendorCallLogs(): Promise<SyncResult> {
  if (Platform.OS !== "android") return { synced: 0, permissionDenied: false, unsupported: true };

  // READ_CALL_LOG is a Play Store restricted permission. This is intended for internal/sideloaded APK builds unless Play policy approval is granted.
  const allowed = await ensurePermission();
  if (!allowed) return { synced: 0, permissionDenied: true, unsupported: false };

  const callLogModule = require("react-native-call-log");
  const CallLogs = callLogModule.default || callLogModule;
  const [vendors, lastSyncRaw] = await Promise.all([getVendors(""), AsyncStorage.getItem(LAST_SYNC_KEY)]);
  const vendorsByPhone = vendorByPhone(vendors);
  const lastSyncAt = Number(lastSyncRaw || 0);
  const entries = await CallLogs.load(500);
  let synced = 0;
  let newest = lastSyncAt;

  for (const entry of entries) {
    const timestamp = Number(entry.timestamp || Date.parse(String(entry.dateTime || "")));
    if (!timestamp || timestamp <= lastSyncAt) continue;
    const phone = normalizePhone(entry.phoneNumber);
    const vendor = vendorsByPhone.get(phone);
    const type = callType(entry.type);
    if (!vendor || !type) continue;
    await createVendorCall(vendor._id, {
      type,
      phone: entry.phoneNumber || vendor.phone,
      note: "Synced from phone call log",
      occurredAt: new Date(timestamp).toISOString(),
      source: "auto",
      nativeId: entry.id || `${timestamp}-${phone}-${type}`,
    });
    synced += 1;
    newest = Math.max(newest, timestamp);
  }

  if (newest > lastSyncAt) await AsyncStorage.setItem(LAST_SYNC_KEY, String(newest));
  return { synced, permissionDenied: false, unsupported: false };
}
