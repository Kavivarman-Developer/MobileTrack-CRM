import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Button, IosScreenHeader, Screen } from "../../components/Layout";
import { SubscriptionModal } from "../../components/SubscriptionModal";
import { colors, fonts, radius, shadows, spacing, typography } from "../../constants/theme";
import { useAppDispatch, useAppSelector } from "../../hooks/redux";
import { logout } from "../../redux/authSlice";
import { getSubscriptionStatus } from "../../services/api";

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const navigation = useNavigation<any>();
  const [subModalOpen, setSubModalOpen] = useState(false);

  const subQuery = useQuery({
    queryKey: ["subscription-status"],
    queryFn: getSubscriptionStatus,
    staleTime: 30000,
  });
  const sub = subQuery.data;

  const initials = (user?.name || "Shop Owner")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function confirmLogout() {
    Alert.alert("Sign Out", "Are you sure you want to log out from this device?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: () => dispatch(logout()) },
    ]);
  }

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader eyebrow="Control Center" title="Settings" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        {/* User & Store Hero Profile Card */}
        <View style={styles.heroCard}>
          <LinearGradient
            colors={["#0F172A", "#1E293B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroTop}>
              <View style={styles.avatarWrap}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
              <View style={styles.heroInfo}>
                <Text numberOfLines={1} style={styles.heroName}>
                  {user?.name || "Store Admin"}
                </Text>
                <Text numberOfLines={1} style={styles.heroEmail}>
                  {user?.email || user?.phone || "Kadai Kanakku Retailer"}
                </Text>
              </View>
            </View>

            <View style={styles.heroPillsRow}>
              <View style={styles.heroPill}>
                <Ionicons color="#10B981" name="shield-checkmark" size={13} />
                <Text style={styles.heroPillText}>{(user?.role || "Owner").toUpperCase()}</Text>
              </View>
              <View style={styles.heroPill}>
                <Ionicons color="#38BDF8" name="cloud-done" size={13} />
                <Text style={styles.heroPillText}>Cloud Synced</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Subscription / Shop Activation Card */}
        <View style={styles.subCard}>
          <View style={styles.subCardLeft}>
            <View style={[styles.subIconWrap, { backgroundColor: sub?.isActive ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 153, 38, 0.15)" }]}>
              <Ionicons
                name={sub?.isActive ? "shield-checkmark" : "flash"}
                size={18}
                color={sub?.isActive ? "#10B981" : "#F59926"}
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text numberOfLines={1} style={styles.subPlanTitle}>{sub?.organizationName || "Shop Plan"}</Text>
                <View style={[styles.statusBadge, { backgroundColor: sub?.isActive ? "#ECFDF5" : "#FFF7ED" }]}>
                  <Text style={[styles.statusBadgeText, { color: sub?.isActive ? "#059669" : "#D97706" }]}>
                    {sub?.subscriptionStatus === "active" ? "ACTIVE" : sub?.subscriptionStatus === "past_due" ? "EXPIRED" : "TRIAL"}
                  </Text>
                </View>
              </View>
              <Text numberOfLines={1} style={styles.subPlanSubtitle}>
                {sub?.isActive && sub?.daysLeft !== undefined
                  ? `${sub.daysLeft} days remaining in cycle`
                  : "Activate shop for ₹1 (30 days access)"}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.subActionBtn, { backgroundColor: sub?.isActive ? "#0079F2" : "#F59926" }]}
            onPress={() => setSubModalOpen(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.subActionBtnText, { color: sub?.isActive ? "#FFFFFF" : "#0D1B2A" }]}>
              {sub?.isActive ? "Renew" : "Pay ₹1"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sell & POS Module */}
        <Text style={styles.groupLabel}>Point of Sale & Orders</Text>
        <View style={styles.groupCard}>
          <SettingRow
            icon="bag"
            iconColor="#0079F2"
            iconBg="#EFF6FF"
            label="Sales Desk"
            subtitle="Counter billing, active cart, and invoices"
            onPress={() => navigation.navigate("Sales")}
          />
          <SettingRow
            icon="flash"
            iconColor="#FF8800"
            iconBg="#FFF7ED"
            label="Quick Sale / Express POS"
            subtitle="Fast barcode scan with UPI QR payment"
            onPress={() => navigation.navigate("QuickSale")}
          />
          <SettingRow
            icon="receipt"
            iconColor="#6366F1"
            iconBg="#EEF2FF"
            label="Orders Management"
            subtitle="Track order delivery, shipping & payment"
            onPress={() => navigation.navigate("Orders")}
            last
          />
        </View>

        {/* Stock & Catalog */}
        <Text style={styles.groupLabel}>Inventory & Supplies</Text>
        <View style={styles.groupCard}>
          <SettingRow
            icon="cube"
            iconColor="#10B981"
            iconBg="#ECFDF5"
            label="Product Catalog"
            subtitle="Add, edit items, prices, and categories"
            onPress={() => navigation.navigate("Items")}
          />
          <SettingRow
            icon="scan"
            iconColor="#8B5CF6"
            iconBg="#F5F3FF"
            label="Barcode Generator"
            subtitle="Generate & print barcode labels"
            onPress={() => navigation.navigate("BarcodeGenerator")}
          />
          <SettingRow
            icon="cart"
            iconColor="#0079F2"
            iconBg="#EFF6FF"
            label="Purchase Orders"
            subtitle="Supplier purchase orders & receive stock"
            onPress={() => navigation.navigate("Purchases")}
          />
          <SettingRow
            icon="business"
            iconColor="#F59E0B"
            iconBg="#FFFBEB"
            label="Vendors & Suppliers"
            subtitle="Supplier contacts and purchase history"
            onPress={() => navigation.navigate("Vendors")}
            last
          />
        </View>

        {/* Finance & Reports */}
        <Text style={styles.groupLabel}>Finance & Reports</Text>
        <View style={styles.groupCard}>
          <SettingRow
            icon="bar-chart"
            iconColor="#6366F1"
            iconBg="#EEF2FF"
            label="Business Analytics & Reports"
            subtitle="P&L, gross sales, and profit margin analysis"
            onPress={() => navigation.navigate("Reports")}
          />
          <SettingRow
            icon="wallet"
            iconColor="#EF4444"
            iconBg="#FEF2F2"
            label="Expenses Tracker"
            subtitle="Track rent, utilities, salary, and overheads"
            onPress={() => navigation.navigate("Expenses")}
          />
          <SettingRow
            icon="people"
            iconColor="#10B981"
            iconBg="#ECFDF5"
            label="Customer Directory & Due"
            subtitle="Customer ledger and balance reminders"
            onPress={() => navigation.navigate("Customers")}
            last
          />
        </View>

        {/* System & Session */}
        <Text style={styles.groupLabel}>App Information</Text>
        <View style={styles.groupCard}>
          <View style={styles.infoRow}>
            <View style={[styles.iconWrap, { backgroundColor: "#F1F5F9" }]}>
              <Ionicons color="#64748B" name="information-circle-outline" size={18} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>App Version</Text>
              <Text style={styles.infoSubtitle}>Kadai Kanakku v2.4 (Enterprise Edition)</Text>
            </View>
          </View>
        </View>

        {/* Sign Out Card */}
        <View style={styles.logoutCard}>
          <TouchableOpacity onPress={confirmLogout} style={styles.logoutBtn} activeOpacity={0.8}>
            <Ionicons color="#EF4444" name="log-out-outline" size={20} />
            <Text style={styles.logoutBtnText}>Sign Out from Device</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <SubscriptionModal
        visible={subModalOpen}
        onClose={() => setSubModalOpen(false)}
        onActivated={() => subQuery.refetch()}
        currentStatus={sub?.subscriptionStatus}
      />
    </Screen>
  );
}

function SettingRow({
  icon,
  iconColor,
  iconBg,
  label,
  subtitle,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.settingRow, !last && styles.settingRowBorder]} activeOpacity={0.7}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons color={iconColor} name={icon} size={20} />
      </View>
      <View style={styles.settingCopy}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text numberOfLines={1} style={styles.settingSub}>
          {subtitle}
        </Text>
      </View>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F8FAFC" },
  container: { alignSelf: "center", maxWidth: 500, paddingBottom: 110, width: "100%", paddingHorizontal: spacing.md },

  // Hero Card
  heroCard: { borderRadius: 20, overflow: "hidden", marginBottom: spacing.lg, ...shadows.md },
  heroGradient: { padding: 18 },
  heroTop: { alignItems: "center", flexDirection: "row", gap: 14 },
  avatarWrap: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: 16,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  avatarText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 18 },
  heroInfo: { flex: 1, minWidth: 0 },
  heroName: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 18 },
  heroEmail: { color: "rgba(255,255,255,0.7)", fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
  heroPillsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
  heroPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  heroPillText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 11 },

  // Subscription Card
  subCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.lg,
    padding: 14,
    ...shadows.sm,
  },
  subCardLeft: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 12,
    marginRight: 10,
  },
  subIconWrap: {
    alignItems: "center",
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  subPlanTitle: {
    color: colors.textPrimary,
    fontFamily: fonts.bold,
    fontSize: 15,
  },
  subPlanSubtitle: {
    color: colors.textMuted,
    fontFamily: fonts.regular,
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  subActionBtn: {
    alignItems: "center",
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  subActionBtnText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },

  // Grouped Settings Cards
  groupLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
  },
  groupCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: spacing.lg,
    overflow: "hidden",
    ...shadows.sm,
  },

  settingRow: { alignItems: "center", flexDirection: "row", gap: 12, padding: 14 },
  settingRowBorder: { borderBottomColor: "#F1F5F9", borderBottomWidth: 1 },
  iconWrap: { alignItems: "center", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
  settingCopy: { flex: 1, minWidth: 0 },
  settingLabel: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 15 },
  settingSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },

  // Info Row
  infoRow: { alignItems: "center", flexDirection: "row", gap: 12, padding: 14 },
  infoRowBorder: { borderBottomColor: "#F1F5F9", borderBottomWidth: 1 },
  infoCopy: { flex: 1, minWidth: 0 },
  infoTitle: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 14 },
  infoSubtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  liveBadge: {
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderRadius: 6,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  liveDot: { backgroundColor: "#10B981", borderRadius: 999, height: 6, width: 6 },
  liveText: { color: "#10B981", fontFamily: fonts.bold, fontSize: 10 },

  // Logout Card
  logoutCard: {
    backgroundColor: colors.card,
    borderColor: "#FEE2E2",
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
    ...shadows.sm,
  },
  logoutBtn: {
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 14,
  },
  logoutBtnText: { color: "#EF4444", fontFamily: fonts.bold, fontSize: 15 },
});

