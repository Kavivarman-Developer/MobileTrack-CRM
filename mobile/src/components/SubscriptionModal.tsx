import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, fonts, radius, shadows, spacing, typography } from "../constants/theme";
import { API_BASE_URL, createActivationOrder, verifyActivationOrder } from "../services/api";

interface SubscriptionModalProps {
  visible: boolean;
  onClose: () => void;
  onActivated?: () => void;
  currentStatus?: string;
}

export function SubscriptionModal({
  visible,
  onClose,
  onActivated,
  currentStatus = "trial",
}: SubscriptionModalProps) {
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);

  async function handlePay() {
    try {
      setLoading(true);
      const res = await createActivationOrder();
      const orderId = res.orderId;
      setPendingOrderId(orderId);

      const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "");
      const paymentUrl = baseUrl + res.checkoutUrl;

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") {
          window.open(paymentUrl, "_blank");
        }
      } else {
        await WebBrowser.openBrowserAsync(paymentUrl);
      }

      Alert.alert(
        "Complete Payment",
        "After completing the Rs. 1 payment on Cashfree, tap Verify to activate your shop.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Verify Payment", onPress: () => handleVerify(orderId) },
        ]
      );
    } catch (error: any) {
      Alert.alert("Payment Error", error?.response?.data?.message || error?.message || "Failed to initiate Cashfree payment.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(orderIdToVerify?: string) {
    const id = orderIdToVerify || pendingOrderId;
    if (!id) {
      return Alert.alert("No order", "Please tap Pay Rs. 1 first.");
    }

    try {
      setVerifying(true);
      const res = await verifyActivationOrder(id);
      if (res.success || res.status === "PAID") {
        Alert.alert("Success!", res.message || "Account activated successfully for 30 days!");
        setPendingOrderId(null);
        onActivated?.();
        onClose();
      } else {
        Alert.alert("Payment Pending", res.message || "Payment is not confirmed yet. If already paid, please wait a moment and try again.");
      }
    } catch (error: any) {
      Alert.alert("Verification Error", error?.response?.data?.message || error?.message || "Failed to verify payment.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={20} color="#94A3B8" />
          </TouchableOpacity>

          <View style={styles.badge}>
            <Ionicons name="flash" size={12} color="#F59926" />
            <Text style={styles.badgeText}>SPECIAL LAUNCH OFFER</Text>
          </View>

          <Text style={styles.title}>Activate Kadai Kanakku</Text>
          <Text style={styles.subtitle}>
            Unlock 30 days of full, unrestricted access to multi-device POS, inventory management, and cloud ledger.
          </Text>

          <View style={styles.priceCard}>
            <View style={styles.priceLeft}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <Text style={styles.priceAmount}>1</Text>
              <Text style={styles.pricePeriod}>/ 30 Days</Text>
            </View>
            <View style={styles.priceRight}>
              <Text style={styles.priceDiscount}>Instant Verification</Text>
              <Text style={styles.priceOrg}>₹499</Text>
            </View>
          </View>

          <View style={styles.featureList}>
            <FeatureRow icon="checkmark-circle" text="Unlimited POS Invoices and Barcode Billing" />
            <FeatureRow icon="checkmark-circle" text="Customer Khata and Vendor Management" />
            <FeatureRow icon="checkmark-circle" text="Multi-device Cloud Sync and Instant Backups" />
            <FeatureRow icon="checkmark-circle" text="GST Reports and Business Analytics" />
          </View>

          {pendingOrderId ? (
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.btn, styles.verifyBtn]}
                onPress={() => handleVerify()}
                disabled={verifying}
              >
                {verifying ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                    <Text style={styles.verifyBtnText}>Verify ₹1 Payment</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={handlePay} disabled={loading}>
                <Text style={styles.secondaryBtnText}>Pay Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.btn, styles.payBtn]}
              onPress={handlePay}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#0D1B2A" size="small" />
              ) : (
                <>
                  <Ionicons name="card" size={18} color="#0D1B2A" />
                  <Text style={styles.payBtnText}>Pay ₹1 via Cashfree</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          <Text style={styles.secureText}>
            🔒 Secured by Cashfree Production (UPI / Cards / NetBanking)
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function FeatureRow({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.featureRow}>
      <Ionicons name={icon} size={16} color="#10B981" style={{ marginRight: 8 }} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0D1B2A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#1E3A5F",
    padding: spacing.xl,
    alignItems: "center",
    ...shadows.lg,
  },
  closeBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    padding: 6,
    borderRadius: 14,
    backgroundColor: "#1E293B",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 153, 38, 0.15)",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(245, 153, 38, 0.3)",
  },
  badgeText: {
    color: "#F59926",
    fontSize: 11,
    fontFamily: fonts.bold,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.bold,
    color: "#FFFFFF",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
  priceCard: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#1B2E4B",
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: "#2B4C7E",
  },
  priceLeft: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  rupeeSymbol: {
    fontSize: 20,
    fontFamily: fonts.bold,
    color: "#22C55E",
  },
  priceAmount: {
    fontSize: 32,
    fontFamily: fonts.bold,
    color: "#22C55E",
    marginHorizontal: 2,
  },
  pricePeriod: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#94A3B8",
  },
  priceRight: {
    alignItems: "flex-end",
  },
  priceDiscount: {
    fontSize: 12,
    fontFamily: fonts.semibold,
    color: "#F59926",
  },
  priceOrg: {
    fontSize: 12,
    fontFamily: fonts.regular,
    color: "#64748B",
    textDecorationLine: "line-through",
  },
  featureList: {
    width: "100%",
    marginBottom: spacing.xl,
    gap: 10,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: "#E2E8F0",
  },
  btn: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  payBtn: {
    backgroundColor: "#F59926",
  },
  payBtnText: {
    color: "#0D1B2A",
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  actionsRow: {
    width: "100%",
    gap: 8,
  },
  verifyBtn: {
    backgroundColor: "#10B981",
  },
  verifyBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: fonts.bold,
  },
  secondaryBtn: {
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: "#94A3B8",
    fontSize: 13,
    fontFamily: fonts.medium,
  },
  secureText: {
    fontSize: 11,
    fontFamily: fonts.regular,
    color: "#64748B",
    marginTop: spacing.md,
    textAlign: "center",
  },
});
