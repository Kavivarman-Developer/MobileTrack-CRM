import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Badge,
  Empty,
  FabButton,
  Field,
  IconButton,
  IosFormSheet,
  IosScreenHeader,
  IosSearchBar,
  PageHeader,
  Screen,
} from "../../components/Layout";
import { colors, fonts, radius, shadows, spacing, typography } from "../../constants/theme";
import {
  apiErrorMessage,
  createCustomer,
  Customer,
  deleteCustomer,
  getCustomers,
  updateCustomer,
} from "../../services/api";

const blank = { name: "", phone: "", address: "" };
type FilterType = "all" | "pending" | "clear";

export default function CustomersScreen({ navigation }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);

  const customersQuery = useQuery({ queryKey: ["customers"], queryFn: getCustomers });
  const queryClient = useQueryClient();
  const customers = customersQuery.data || [];

  const stats = useMemo(() => {
    return {
      count: customers.length,
      pending: customers.reduce((sum, item) => sum + Number(item.pendingBalance || 0), 0),
      pendingCount: customers.filter((item) => Number(item.pendingBalance || 0) > 0).length,
      clearCount: customers.filter((item) => Number(item.pendingBalance || 0) <= 0).length,
    };
  }, [customers]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return customers.filter((item) => {
      const matchesSearch =
        !keyword || `${item.name} ${item.phone || ""} ${item.address || ""}`.toLowerCase().includes(keyword);
      const isPending = Number(item.pendingBalance || 0) > 0;
      if (!matchesSearch) return false;
      if (filter === "pending") return isPending;
      if (filter === "clear") return !isPending;
      return true;
    });
  }, [customers, search, filter]);

  const save = useMutation({
    mutationFn: () => (editing ? updateCustomer(editing._id, form) : createCustomer(form)),
    onSuccess: () => {
      closeForm();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (error: Error) => Alert.alert("Customer save failed", apiErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
    onError: (error: Error) => Alert.alert("Customer delete failed", apiErrorMessage(error)),
  });

  function openForm(customer?: Customer) {
    setEditing(customer || null);
    setForm(customer ? { name: customer.name, phone: customer.phone, address: customer.address || "" } : blank);
    setOpen(true);
  }

  function closeForm() {
    setEditing(null);
    setForm(blank);
    setOpen(false);
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await customersQuery.refetch();
    setRefreshing(false);
  };

  function callCustomer(phone?: string) {
    if (!phone) {
      Alert.alert("No Phone Number", "This customer doesn't have a phone number saved.");
      return;
    }
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, "")}`);
  }

  function messageWhatsApp(customer: Customer) {
    if (!customer.phone) {
      Alert.alert("No Phone Number", "This customer doesn't have a phone number saved.");
      return;
    }
    const cleanPhone = customer.phone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.startsWith("91") ? cleanPhone : `91${cleanPhone}`;
    const pending = Number(customer.pendingBalance || 0);
    const text = pending > 0
      ? `Vanakkam ${customer.name}, your current balance with Kadai Kanakku is ₹${formatMoney(pending)}. Kindly clear at your earliest convenience. Thank you!`
      : `Vanakkam ${customer.name}, thank you for shopping with us! Have a wonderful day.`;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
    if (Platform.OS === "web") {
      window.open(url, "_blank");
    } else {
      Linking.openURL(url);
    }
  }

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="CRM & Directory"
        right={
          <TouchableOpacity onPress={() => openForm()} style={styles.addHeaderBtn}>
            <Ionicons color="#FFFFFF" name="add" size={18} />
            <Text style={styles.addHeaderBtnText}>Add</Text>
          </TouchableOpacity>
        }
        title="Customers"
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={colors.primary} />}
        ListHeaderComponent={
          <View>
            {/* Top Metric Cards */}
            <View style={styles.metricsRow}>
              {/* Total Customers */}
              <View style={[styles.metricCard, { borderLeftColor: "#6366F1" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#EEF2FF" }]}>
                    <Ionicons color="#6366F1" name="people" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>Total</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  {stats.count}
                </Text>
                <Text style={styles.metricSub}>Registered</Text>
              </View>

              {/* Outstanding Due */}
              <View style={[styles.metricCard, { borderLeftColor: "#EF4444" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#FEF2F2" }]}>
                    <Ionicons color="#EF4444" name="wallet" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>Balance Due</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  ₹{formatMoney(stats.pending)}
                </Text>
                <Text style={styles.metricSub}>{stats.pendingCount} accounts</Text>
              </View>

              {/* Clear Accounts */}
              <View style={[styles.metricCard, { borderLeftColor: "#10B981" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#ECFDF5" }]}>
                    <Ionicons color="#10B981" name="checkmark-circle" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>Clear</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  {stats.clearCount}
                </Text>
                <Text style={styles.metricSub}>Zero balance</Text>
              </View>
            </View>

            {/* Search Bar */}
            <IosSearchBar
              onChangeText={setSearch}
              placeholder="Search by customer name, phone, address..."
              style={styles.searchBar}
              value={search}
            />

            {/* Filter Tabs */}
            <View style={styles.filterTabs}>
              {(
                [
                  ["all", `All (${stats.count})`],
                  ["pending", `Due (${stats.pendingCount})`],
                  ["clear", `Clear (${stats.clearCount})`],
                ] as [FilterType, string][]
              ).map(([key, label]) => {
                const isActive = filter === key;
                return (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setFilter(key)}
                    style={[styles.filterTab, isActive && styles.filterTabActive]}
                  >
                    <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>Customer Directory</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{filtered.length}</Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Ionicons color={colors.textMuted} name="people-outline" size={44} />
            <Text style={styles.emptyTitle}>
              {customersQuery.isLoading ? "Loading customers…" : "No customers found"}
            </Text>
            <Text style={styles.emptySub}>
              {customersQuery.isLoading ? "Fetching data..." : "Add your first customer to start tracking balances."}
            </Text>
            {!customersQuery.isLoading && (
              <TouchableOpacity onPress={() => openForm()} style={styles.emptyBtn}>
                <Ionicons color="#FFFFFF" name="add" size={18} />
                <Text style={styles.emptyBtnText}>Add New Customer</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <CustomerCard
            item={item}
            onCall={() => callCustomer(item.phone)}
            onDelete={() =>
              Alert.alert("Delete customer?", `Are you sure you want to remove ${item.name}?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Delete", style: "destructive", onPress: () => remove.mutate(item._id) },
              ])
            }
            onEdit={() => openForm(item)}
            onWhatsApp={() => messageWhatsApp(item)}
          />
        )}
      />

      <FabButton accessibilityLabel="Add customer" onPress={() => openForm()} />

      <IosFormSheet
        eyebrow={editing ? "Update details" : "New record"}
        footerLabel={save.isPending ? "Saving…" : "Save Customer"}
        footerLoading={save.isPending}
        onClose={closeForm}
        onFooterPress={() => save.mutate()}
        title={editing ? "Edit Customer" : "Add Customer"}
        visible={open}
      >
        <Text style={styles.fieldLabel}>Customer Full Name</Text>
        <Field
          onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
          placeholder="e.g. Ramesh Kumar"
          value={form.name}
        />
        <Text style={styles.fieldLabel}>Phone Number</Text>
        <Field
          keyboardType="phone-pad"
          onChangeText={(value) => setForm((prev) => ({ ...prev, phone: value }))}
          placeholder="e.g. +91 98765 43210"
          value={form.phone}
        />
        <Text style={styles.fieldLabel}>Address / Location (Optional)</Text>
        <Field
          onChangeText={(value) => setForm((prev) => ({ ...prev, address: value }))}
          placeholder="e.g. Shop #4, Gandhi Road, Chennai"
          value={form.address}
        />
      </IosFormSheet>
    </Screen>
  );
}

function CustomerCard({
  item,
  onCall,
  onWhatsApp,
  onEdit,
  onDelete,
}: {
  item: Customer;
  onCall: () => void;
  onWhatsApp: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pending = Number(item.pendingBalance || 0);
  const hasPending = pending > 0;
  const initials = item.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <View style={styles.card}>
      <View style={[styles.cardAccent, { backgroundColor: hasPending ? "#EF4444" : "#10B981" }]} />
      <View style={styles.cardContent}>
        {/* Top Info Row */}
        <TouchableOpacity onPress={onEdit} style={styles.cardMain} activeOpacity={0.7}>
          <View style={[styles.avatar, { backgroundColor: hasPending ? "#FEF2F2" : "#ECFDF5" }]}>
            <Text style={[styles.avatarText, { color: hasPending ? "#EF4444" : "#10B981" }]}>
              {initials || "CU"}
            </Text>
          </View>
          <View style={styles.cardCopy}>
            <Text numberOfLines={1} style={styles.name}>
              {item.name}
            </Text>
            {Boolean(item.phone) && (
              <View style={styles.phoneRow}>
                <Ionicons color={colors.textSecondary} name="call-outline" size={12} />
                <Text style={styles.phoneText}>{item.phone}</Text>
              </View>
            )}
            {Boolean(item.address) && (
              <Text numberOfLines={1} style={styles.addressText}>
                {item.address}
              </Text>
            )}
          </View>
          <View style={styles.balanceCol}>
            <Text style={[styles.balanceNum, { color: hasPending ? "#EF4444" : "#10B981" }]}>
              ₹{formatMoney(pending)}
            </Text>
            <View style={[styles.statusPill, hasPending ? styles.statusPillDue : styles.statusPillClear]}>
              <Text style={[styles.statusPillText, hasPending ? styles.statusTextDue : styles.statusTextClear]}>
                {hasPending ? "DUE" : "CLEAR"}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Action Toolbar */}
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={onCall} style={styles.actionBtn}>
            <Ionicons color={colors.primary} name="call-outline" size={15} />
            <Text style={[styles.actionBtnText, { color: colors.primary }]}>Call</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onWhatsApp} style={styles.actionBtn}>
            <Ionicons color="#25D366" name="logo-whatsapp" size={15} />
            <Text style={[styles.actionBtnText, { color: "#25D366" }]}>WhatsApp</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onEdit} style={styles.actionBtn}>
            <Ionicons color={colors.textSecondary} name="create-outline" size={15} />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDelete} style={styles.actionBtn}>
            <Ionicons color="#EF4444" name="trash-outline" size={15} />
            <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  screen: { backgroundColor: "#F8FAFC" },
  content: { alignSelf: "center", maxWidth: 1280, paddingBottom: 110, width: "100%", paddingHorizontal: spacing.md },

  addHeaderBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 999,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    ...shadows.sm,
  },
  addHeaderBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 13 },

  // Metric Cards
  metricsRow: { flexDirection: "row", gap: 8, marginTop: spacing.xs, marginBottom: spacing.md },
  metricCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderLeftWidth: 4,
    flex: 1,
    padding: 12,
    ...shadows.sm,
  },
  metricHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  metricIconWrap: { alignItems: "center", borderRadius: 8, height: 26, justifyContent: "center", width: 26 },
  metricLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 11 },
  metricValue: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 16, letterSpacing: -0.3 },
  metricSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, marginTop: 2 },

  searchBar: { marginBottom: 10 },

  // Filter Tabs
  filterTabs: {
    backgroundColor: "#E2E8F0",
    borderRadius: 12,
    flexDirection: "row",
    marginBottom: spacing.md,
    padding: 3,
  },
  filterTab: { alignItems: "center", borderRadius: 9, flex: 1, paddingVertical: 7 },
  filterTabActive: { backgroundColor: colors.card, ...shadows.sm },
  filterTabText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12 },
  filterTabTextActive: { color: colors.textPrimary, fontFamily: fonts.semibold },

  sectionHead: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  sectionLabel: { color: colors.textPrimary, fontFamily: fonts.bold, fontSize: 16 },
  countBadge: {
    backgroundColor: colors.backgroundDark,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  countBadgeText: { color: colors.textSecondary, fontFamily: fonts.semibold, fontSize: 11 },

  // Customer Card
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 10,
    overflow: "hidden",
    ...shadows.sm,
  },
  cardAccent: { width: 4 },
  cardContent: { flex: 1, minWidth: 0 },
  cardMain: { alignItems: "center", flexDirection: "row", gap: 10, padding: 12 },
  avatar: { alignItems: "center", borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  avatarText: { fontFamily: fonts.bold, fontSize: 14 },
  cardCopy: { flex: 1, minWidth: 0 },
  name: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 15 },
  phoneRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 2 },
  phoneText: { color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 12 },
  addressText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  balanceCol: { alignItems: "flex-end" },
  balanceNum: { fontFamily: fonts.bold, fontSize: 15 },
  statusPill: { borderRadius: 6, marginTop: 3, paddingHorizontal: 6, paddingVertical: 2 },
  statusPillDue: { backgroundColor: "#FEF2F2" },
  statusPillClear: { backgroundColor: "#ECFDF5" },
  statusPillText: { fontFamily: fonts.bold, fontSize: 10 },
  statusTextDue: { color: "#EF4444" },
  statusTextClear: { color: "#10B981" },

  cardActions: {
    borderTopColor: "#F1F5F9",
    borderTopWidth: 1,
    flexDirection: "row",
  },
  actionBtn: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    paddingVertical: 10,
  },
  actionBtnText: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 12 },

  // Empty Card
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: spacing.xl,
    marginTop: 10,
  },
  emptyTitle: { color: colors.textPrimary, fontFamily: fonts.semibold, fontSize: 15, marginTop: 10 },
  emptySub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2, textAlign: "center" },
  emptyBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadows.sm,
  },
  emptyBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 13 },

  fieldLabel: { color: colors.textSecondary, fontFamily: fonts.medium, fontSize: 13, marginBottom: 4, marginTop: 12 },
});

