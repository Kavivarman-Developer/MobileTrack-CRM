import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewNavigation } from "react-native-webview";
import { LinearGradient } from "expo-linear-gradient";
import { API_BASE_URL, createActivationOrder, verifyActivationOrder } from "../services/api";
import { useAppDispatch } from "../hooks/redux";

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
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;

    function handleWindowMessage(event: MessageEvent) {
      try {
        let data = event.data;
        if (typeof data === "string") {
          data = JSON.parse(data);
        }
        if (
          data &&
          (data.type === "PAYMENT_SUCCESS" ||
            data.type === "CHECKOUT_COMPLETE" ||
            data.status === "SUCCESS" ||
            data.type === "SUCCESS")
        ) {
          handleVerify(data.orderId || pendingOrderId || undefined);
        }
      } catch (e) {}
    }

    window.addEventListener("message", handleWindowMessage);
    return () => window.removeEventListener("message", handleWindowMessage);
  }, [pendingOrderId]);

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("pending_activation_order_id");
      if (saved && !pendingOrderId) {
        setPendingOrderId(saved);
      }
    }
  }, []);

  async function handlePay() {
    try {
      setLoading(true);
      const res = await createActivationOrder();
      const orderId = res.orderId;
      setPendingOrderId(orderId);

      if (typeof localStorage !== "undefined") {
        localStorage.setItem("pending_activation_order_id", orderId);
      }

      const baseUrl = API_BASE_URL.replace(/\/api\/?$/, "");
      const fullCheckoutUrl = baseUrl + res.checkoutUrl;

      // Navigate directly to Cashfree secure payment page
      if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.href = fullCheckoutUrl;
        return;
      }

      // On native mobile app, launch browser or UPI intent handler
      const canOpen = await Linking.canOpenURL(fullCheckoutUrl).catch(() => false);
      if (canOpen) {
        await Linking.openURL(fullCheckoutUrl);
      } else {
        setCheckoutUrl(fullCheckoutUrl);
      }
    } catch (error: any) {
      Alert.alert(
        "Payment Initiation Failed",
        error?.response?.data?.message || error?.message || "Could not connect to Cashfree payment gateway. Please check your internet connection."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(orderIdToVerify?: string) {
    const id = orderIdToVerify || pendingOrderId;
    if (!id) {
      return Alert.alert("No Order", "Please tap Pay ₹1 first.");
    }

    try {
      setVerifying(true);
      const res = await verifyActivationOrder(id);
      if (res.success || res.status === "PAID") {
        setIsSuccess(true);
        setCheckoutUrl(null);
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("pending_activation_order_id");
        }
        setTimeout(() => {
          onActivated?.();
          onClose();
          setIsSuccess(false);
          setPendingOrderId(null);
        }, 1800);
      } else {
        Alert.alert(
          "Payment Processing",
          res.message || "Payment is not confirmed yet. If you have completed the UPI payment, please wait a few seconds and tap Check Status again."
        );
      }
    } catch (error: any) {
      Alert.alert("Verification Check", error?.response?.data?.message || error?.message || "Could not verify payment status.");
    } finally {
      setVerifying(false);
    }
  }

  function handleNavigationStateChange(navState: WebViewNavigation) {
    const url = navState.url || "";
    // Detect Cashfree completion / return redirect
    if (
      url.includes("/subscription") ||
      url.includes("order_id=") ||
      url.includes("orderId=") ||
      url.includes("order_status=PAID") ||
      url.includes("status=SUCCESS") ||
      url.includes("www.kadaikanakku.in")
    ) {
      handleVerify();
    }
  }

  function handleShouldStartLoadWithRequest(request: any) {
    const url = request.url || "";
    // Handle external UPI links (e.g. PhonePe, GPay, Paytm)
    if (url.startsWith("upi://") || url.startsWith("phonepe://") || url.startsWith("paytmmp://") || url.startsWith("gpay://")) {
      Linking.openURL(url).catch(() => {
        Alert.alert("UPI App", "Could not launch UPI app. You can complete payment using QR code or Cards on the screen.");
      });
      return false;
    }
    return true;
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* ================= SUCCESS CELEBRATION VIEW ================= */}
        {isSuccess ? (
          <View style={styles.modalCard}>
            <View style={styles.successIconBadge}>
              <Ionicons name="checkmark-circle" size={56} color="#10B981" />
            </View>
            <Text style={styles.successTitle}>Shop Activated! 🎉</Text>
            <Text style={styles.successSub}>
              Your ₹1 activation is confirmed. All billing, stock management, and customer khata modules are now fully unlocked!
            </Text>
            <View style={styles.successPill}>
              <Ionicons name="shield-checkmark" size={16} color="#166534" style={{ marginRight: 6 }} />
              <Text style={styles.successPillText}>30-Day Full Access Enabled</Text>
            </View>
          </View>
        ) : checkoutUrl ? (
          /* ================= IN-APP CASHFREE PAYMENT WEBVIEW ================= */
          <SafeAreaView edges={["top", "bottom"]} style={styles.webViewContainer}>
            <View style={styles.webViewHeader}>
              <View style={styles.webViewHeaderLeft}>
                <Ionicons name="lock-closed" size={16} color="#0D3666" style={{ marginRight: 6 }} />
                <Text style={styles.webViewHeaderTitle}>Cashfree Checkout · ₹1.00</Text>
              </View>

              <View style={styles.webViewHeaderRight}>
                <TouchableOpacity
                  style={styles.verifySmallBtn}
                  onPress={() => handleVerify()}
                  disabled={verifying}
                >
                  {verifying ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.verifySmallBtnText}>Check Status</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeRoundBtn}
                  onPress={() => {
                    setCheckoutUrl(null);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </View>

            {Platform.OS === "web" ? (
              <iframe
                src={checkoutUrl}
                style={{ width: "100%", height: "100%", border: "none", backgroundColor: "#FFFFFF" } as any}
                title="Cashfree Secure Checkout"
                allow="payment *; bluetooth *; camera *; microphone *; clipboard-write *"
              />
            ) : (
              <WebView
                source={{ uri: checkoutUrl }}
                onNavigationStateChange={handleNavigationStateChange}
                onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                startInLoadingState={true}
                renderLoading={() => (
                  <View style={styles.webLoadingOverlay}>
                    <ActivityIndicator size="large" color="#0D3666" />
                    <Text style={styles.webLoadingText}>Connecting to Cashfree Secure Payment...</Text>
                  </View>
                )}
                style={styles.webView}
              />
            )}
          </SafeAreaView>
        ) : (
          /* ================= POLISHED WHITE ACTIVATION CARD ================= */
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color="#64748B" />
            </TouchableOpacity>

            {/* Launch Offer Badge */}
            <View style={styles.badge}>
              <Ionicons name="flash" size={13} color="#D97706" />
              <Text style={styles.badgeText}>SPECIAL ₹1 LAUNCH OFFER</Text>
            </View>

            <Text style={styles.title}>Activate Kadai Kanakku</Text>
            <Text style={styles.subtitle}>
              Unlock 30 days of unlimited access to fast POS billing, barcode scanning, stock tracking, and customer khata ledger.
            </Text>

            {/* Price Box */}
            <View style={styles.priceCard}>
              <View style={styles.priceLeft}>
                <View style={styles.priceRow}>
                  <Text style={styles.rupeeSymbol}>₹</Text>
                  <Text style={styles.priceAmount}>1</Text>
                  <Text style={styles.pricePeriod}> / 30 Days</Text>
                </View>
                <Text style={styles.priceNotice}>Full Access • No auto-debit</Text>
              </View>
              <View style={styles.priceRight}>
                <Text style={styles.discountBadge}>SAVE 99%</Text>
                <Text style={styles.originalPrice}>₹499</Text>
              </View>
            </View>

            {/* Feature List */}
            <View style={styles.featureList}>
              <FeatureItem text="Unlimited Counter POS & Thermal / PDF Bills" />
              <FeatureItem text="Barcode Generator & Live Stock Alerts" />
              <FeatureItem text="Customer Credit Khata & WhatsApp Reminders" />
              <FeatureItem text="Multi-Device Cloud Sync & Daily GST Reports" />
            </View>

            {/* Actions */}
            {pendingOrderId ? (
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={styles.verifyBtn}
                  onPress={() => handleVerify()}
                  disabled={verifying}
                  activeOpacity={0.85}
                >
                  {verifying ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-done" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.verifyBtnText}>Check ₹1 Status</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.retryBtn} onPress={handlePay} disabled={loading} activeOpacity={0.85}>
                  <Text style={styles.retryBtnText}>Pay Again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.payBtnWrapper}
                onPress={handlePay}
                disabled={loading}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={["#F59926", "#E08518"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.payBtnGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <>
                      <Ionicons name="shield-checkmark" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.payBtnText}>Pay ₹1 & Activate Shop</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Trust Footer */}
            <View style={styles.secureFooter}>
              <Ionicons name="lock-closed-outline" size={13} color="#94A3B8" />
              <Text style={styles.secureText}>
                Secured by Cashfree (UPI / GPay / PhonePe / Cards / NetBanking)
              </Text>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIconWrap}>
        <Ionicons name="checkmark" size={12} color="#166534" />
      </View>
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  closeBtn: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  badge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#92400E",
    marginLeft: 4,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0D3666",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginBottom: 16,
  },
  priceCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  priceLeft: {
    flex: 1,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  rupeeSymbol: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0D3666",
  },
  priceAmount: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0D3666",
  },
  pricePeriod: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  priceNotice: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  priceRight: {
    alignItems: "flex-end",
  },
  discountBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#166534",
    backgroundColor: "#DCFCE7",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 2,
  },
  originalPrice: {
    fontSize: 12,
    color: "#94A3B8",
    textDecorationLine: "line-through",
    marginRight: 2,
  },
  featureList: {
    marginBottom: 18,
    gap: 8,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  featureText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    flex: 1,
  },
  payBtnWrapper: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#F59926",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  payBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  verifyBtn: {
    flex: 2,
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
  },
  verifyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  retryBtn: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  secureFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    gap: 4,
  },
  secureText: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
  },

  /* WebView Container */
  webViewContainer: {
    width: "100%",
    maxWidth: 480,
    height: "92%",
    maxHeight: 700,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    alignSelf: "center",
  },
  webViewHeader: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  webViewHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  webViewHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0D3666",
  },
  webViewHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  verifySmallBtn: {
    backgroundColor: "#10B981",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  verifySmallBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  closeRoundBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  webView: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  webLoadingOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  webLoadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
    color: "#0D3666",
  },

  /* Success View */
  successIconBadge: {
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0D3666",
    textAlign: "center",
    marginBottom: 8,
  },
  successSub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
  },
  successPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DCFCE7",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  successPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#166534",
  },
});
