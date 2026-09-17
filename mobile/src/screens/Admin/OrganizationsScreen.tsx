import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Empty, Field, IosFormSheet, IosHero, IosScreenHeader, Screen, SelectOption } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { fonts, spacing } from "../../constants/theme";
import { AdminOrganizationRow, createShopOwner, getAdminHomeBanner, getAdminOrganizations, HomeBanner, updateAdminHomeBanner } from "../../services/api";

const blankOwner = { name: "", email: "", password: "", phone: "", businessName: "", plan: "basic", billingCycle: "monthly" as "monthly" | "yearly" };
const blankBanner: HomeBanner = {
  enabled: false,
  title: "",
  message: "",
  ctaLabel: "",
  ctaAction: "",
  tone: "promo",
};

export default function OrganizationsScreen({ navigation }: any) {
  const [open, setOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(false);
  const [form, setForm] = useState(blankOwner);
  const [bannerForm, setBannerForm] = useState<HomeBanner>(blankBanner);
  const organizations = useQuery({ queryKey: ["admin-organizations"], queryFn: getAdminOrganizations });
  const homeBanner = useQuery({ queryKey: ["admin-home-banner"], queryFn: getAdminHomeBanner });
  const queryClient = useQueryClient();
  const rows = organizations.data || [];
  const activeCount = useMemo(() => rows.filter((item) => item.isActive).length, [rows]);
  const createOwner = useMutation({
    mutationFn: () => createShopOwner(form),
    onSuccess: () => {
      setOpen(false);
      setForm(blankOwner);
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      Alert.alert("Shop owner created", `${form.email} can now log in with the password you set.`);
    },
    onError: (error: Error) => Alert.alert("Create failed", error.message),
  });
  const saveBanner = useMutation({
    mutationFn: () => updateAdminHomeBanner(bannerForm),
    onSuccess: () => {
      setBannerOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-home-banner"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      Alert.alert("Banner saved", bannerForm.enabled ? "Home banner is now live for all shops." : "Home banner is hidden.");
    },
    onError: (error: Error) => Alert.alert("Save failed", error.message),
  });

  function openBannerEditor() {
    const current = homeBanner.data;
    setBannerForm({
      enabled: current?.enabled ?? true,
      title: current?.title || "Welcome to your shop",
      message: current?.message || "Quick actions below — start a sale, add items, or check orders.",
      ctaLabel: current?.ctaLabel || "Start a sale",
      ctaAction: current?.ctaAction || "Sales",
      tone: current?.tone || "promo",
    });
    setBannerOpen(true);
  }

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="Platform monitor"
        right={(
          <View style={styles.headerActions}>
            <TouchableOpacity accessibilityLabel="Home banner" onPress={openBannerEditor} style={styles.bannerBtn}>
              <Ionicons color={ios.blue} name="megaphone-outline" size={20} />
            </TouchableOpacity>
            <TouchableOpacity accessibilityLabel="Add owner" onPress={() => setOpen(true)} style={styles.addBtn}>
              <Ionicons color="#FFFFFF" name="add" size={22} />
            </TouchableOpacity>
          </View>
        )}
        title="Super Admin"
      />

      <FlatList
        data={rows}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            <IosHero
              amount={String(rows.length)}
              ctaLabel="Create shop owner"
              onCta={() => setOpen(true)}
              overline="Organizations"
              pills={[`${activeCount} active`, `${rows.length - activeCount} paused`]}
              subtitle="Tenant shops on this platform"
            />
            <TouchableOpacity onPress={openBannerEditor} style={styles.bannerCard}>
              <View style={styles.bannerIcon}>
                <Ionicons color={ios.purple} name="megaphone" size={18} />
              </View>
              <View style={styles.bannerCopy}>
                <Text style={styles.bannerTitle}>Home banner</Text>
                <Text style={styles.bannerMeta}>
                  {homeBanner.data?.enabled
                    ? `${homeBanner.data.title || "Live banner"} · shown above Do this now`
                    : "Off · tap to control the Home promo banner"}
                </Text>
              </View>
              <Badge label={homeBanner.data?.enabled ? "ON" : "OFF"} tone={homeBanner.data?.enabled ? "success" : "neutral"} />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Empty icon="shield-checkmark-outline" text={organizations.isLoading ? "Loading organizations…" : "No organizations yet."} />}
        renderItem={({ item }) => <OrgRow item={item} onPress={() => navigation.navigate("OrganizationDetail", { organizationId: item._id })} />}
      />

      <IosFormSheet
        eyebrow="New tenant"
        footerLabel={createOwner.isPending ? "Creating…" : "Create shop owner"}
        footerLoading={createOwner.isPending}
        onClose={() => setOpen(false)}
        onFooterPress={() => createOwner.mutate()}
        title="Create Shop Owner"
        visible={open}
      >
        <Text style={styles.fieldLabel}>Shop / Business Name</Text>
        <Field onChangeText={(value) => setForm((prev) => ({ ...prev, businessName: value }))} placeholder="e.g. Metro Electronics" value={form.businessName} />
        <Text style={styles.fieldLabel}>Owner Full Name</Text>
        <Field onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))} placeholder="Owner name" value={form.name} />
        <Text style={styles.fieldLabel}>Email Address</Text>
        <Field autoCapitalize="none" keyboardType="email-address" onChangeText={(value) => setForm((prev) => ({ ...prev, email: value }))} placeholder="owner@shop.com" value={form.email} />
        <Text style={styles.fieldLabel}>Phone Number</Text>
        <Field keyboardType="phone-pad" onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))} placeholder="+91..." value={form.phone} />
        <Text style={styles.fieldLabel}>Temporary Password</Text>
        <Field secureTextEntry onChangeText={(value) => setForm((prev) => ({ ...prev, password: value }))} placeholder="Password (min 6 chars)" value={form.password} />
        <Text style={styles.fieldLabel}>Subscription Plan</Text>
        <View style={styles.segment}>
          {["basic", "premium", "enterprise"].map((plan) => (
            <SegmentButton key={plan} active={form.plan === plan} label={plan} onPress={() => setForm((prev) => ({ ...prev, plan }))} />
          ))}
        </View>
        <Text style={styles.fieldLabel}>Billing Cycle</Text>
        <View style={styles.segment}>
          <SegmentButton active={form.billingCycle === "monthly"} label="Monthly" onPress={() => setForm((prev) => ({ ...prev, billingCycle: "monthly" }))} />
          <SegmentButton active={form.billingCycle === "yearly"} label="Yearly" onPress={() => setForm((prev) => ({ ...prev, billingCycle: "yearly" }))} />
        </View>
      </IosFormSheet>

      <IosFormSheet
        eyebrow="Shown above Do this now"
        footerLabel={saveBanner.isPending ? "Saving…" : "Save banner"}
        footerLoading={saveBanner.isPending}
        icon="megaphone-outline"
        onClose={() => setBannerOpen(false)}
        onFooterPress={() => saveBanner.mutate()}
        title="Home Banner"
        visible={bannerOpen}
      >
        <SelectOption
          label="Show banner on Home"
          meta={bannerForm.enabled ? "Visible to all shops" : "Hidden from shops"}
          onPress={() => setBannerForm((prev) => ({ ...prev, enabled: !prev.enabled }))}
          selected={bannerForm.enabled}
        />
        <Text style={styles.fieldLabel}>Title</Text>
        <Field onChangeText={(value) => setBannerForm((prev) => ({ ...prev, title: value }))} placeholder="e.g. Festival offer" value={bannerForm.title} />
        <Text style={styles.fieldLabel}>Message</Text>
        <Field multiline onChangeText={(value) => setBannerForm((prev) => ({ ...prev, message: value }))} placeholder="Short promo or announcement" value={bannerForm.message} />
        <Text style={styles.fieldLabel}>Tone</Text>
        <View style={styles.segment}>
          {(["promo", "info", "warning"] as const).map((tone) => (
            <SegmentButton key={tone} active={bannerForm.tone === tone} label={tone} onPress={() => setBannerForm((prev) => ({ ...prev, tone }))} />
          ))}
        </View>
        <Text style={styles.fieldLabel}>CTA label (optional)</Text>
        <Field onChangeText={(value) => setBannerForm((prev) => ({ ...prev, ctaLabel: value }))} placeholder="e.g. Start sale" value={bannerForm.ctaLabel || ""} />
        <Text style={styles.fieldLabel}>CTA opens</Text>
        <SelectOption label="None" meta="Banner not tappable" onPress={() => setBannerForm((prev) => ({ ...prev, ctaAction: "" }))} selected={!bannerForm.ctaAction} />
        <SelectOption label="Sales" onPress={() => setBannerForm((prev) => ({ ...prev, ctaAction: "Sales" }))} selected={bannerForm.ctaAction === "Sales"} />
        <SelectOption label="Quick bill" onPress={() => setBannerForm((prev) => ({ ...prev, ctaAction: "QuickSale" }))} selected={bannerForm.ctaAction === "QuickSale"} />
        <SelectOption label="Items" onPress={() => setBannerForm((prev) => ({ ...prev, ctaAction: "Items" }))} selected={bannerForm.ctaAction === "Items"} />
        <SelectOption label="Orders" onPress={() => setBannerForm((prev) => ({ ...prev, ctaAction: "Orders" }))} selected={bannerForm.ctaAction === "Orders"} />
        <SelectOption label="Billing" onPress={() => setBannerForm((prev) => ({ ...prev, ctaAction: "Billing" }))} selected={bannerForm.ctaAction === "Billing"} />
      </IosFormSheet>
    </Screen>
  );
}

function OrgRow({ item, onPress }: { item: AdminOrganizationRow; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={[styles.accent, { backgroundColor: item.isActive ? ios.green : ios.red }]} />
      <View style={styles.cardInner}>
        <View style={styles.cardTop}>
          <View style={styles.orgIcon}>
            <Ionicons color={ios.blue} name="business-outline" size={18} />
          </View>
          <View style={styles.orgInfo}>
            <Text style={styles.orgName}>{item.name}</Text>
            <Text style={styles.meta}>{item.ownerEmail || "No owner email"}</Text>
          </View>
          <Badge label={item.isActive ? "Active" : "Paused"} tone={item.isActive ? "success" : "danger"} />
        </View>
        <Text style={styles.planText}>{item.plan || "free"} • {item.billingCycle || "monthly"}</Text>
        <View style={styles.statsRow}>
          <MiniStat label="Products" value={item.stats.productCount} />
          <MiniStat label="Orders" value={item.stats.totalOrders} />
          <MiniStat label="Sales" value={`₹${formatMoney(item.stats.totalSales)}`} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.stat}>
      <Text numberOfLines={1} style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.segmentButton, active && styles.segmentActive]}>
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  screen: { backgroundColor: ios.bg },
  content: { paddingBottom: spacing.xxl },
  bannerBtn: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  addBtn: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerActions: { alignItems: "center", flexDirection: "row", gap: spacing.xs, marginTop: spacing.xxs },
  bannerCard: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 16,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  bannerIcon: {
    alignItems: "center",
    backgroundColor: ios.purpleSoft,
    borderRadius: 12,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  bannerCopy: { flex: 1, minWidth: 0 },
  bannerTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 15, fontWeight: "600" },
  bannerMeta: { color: ios.secondary, fontSize: 12, marginTop: 2 },
  card: {
    backgroundColor: ios.card,
    borderRadius: 18,
    flexDirection: "row",
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  accent: { width: 4 },
  cardInner: { flex: 1, padding: spacing.md },
  cardTop: { alignItems: "center", flexDirection: "row", marginBottom: spacing.sm },
  orgIcon: { alignItems: "center", backgroundColor: ios.fill, borderRadius: 10, height: 40, justifyContent: "center", marginRight: spacing.sm, width: 40 },
  orgInfo: { flex: 1 },
  orgName: { color: ios.label, fontFamily: fonts.semibold, fontSize: 16, fontWeight: "600" },
  meta: { color: ios.secondary, fontSize: 12, marginTop: 2 },
  planText: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13, marginBottom: spacing.sm, textTransform: "capitalize" },
  fieldLabel: { color: ios.secondary, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600", marginBottom: 5, marginTop: spacing.xs },
  segment: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm },
  segmentButton: { backgroundColor: ios.fill, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8 },
  segmentActive: { backgroundColor: ios.blue },
  segmentText: { color: ios.label, fontSize: 13, fontWeight: "600", textTransform: "capitalize" },
  segmentTextActive: { color: "#fff" },
  statsRow: { flexDirection: "row", gap: spacing.xs },
  stat: { backgroundColor: ios.fill, borderRadius: 10, flex: 1, padding: 8 },
  statValue: { color: ios.label, fontFamily: fonts.bold, fontSize: 14, fontWeight: "700" },
  statLabel: { color: ios.secondary, fontSize: 11, marginTop: 2 },
});
