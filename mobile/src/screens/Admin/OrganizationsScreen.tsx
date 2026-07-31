import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Empty, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing } from "../../constants/theme";
import { AdminOrganizationRow, getAdminOrganizations } from "../../services/api";

export default function OrganizationsScreen({ navigation }: any) {
  const organizations = useQuery({ queryKey: ["admin-organizations"], queryFn: getAdminOrganizations });
  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Platform monitor</Text>
          <Text style={styles.title}>Admin</Text>
        </View>
      </View>
      <FlatList
        data={organizations.data || []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListEmptyComponent={<Empty text={organizations.isLoading ? "Loading organizations..." : "No organizations yet."} />}
        renderItem={({ item }) => <OrgRow item={item} onPress={() => navigation.navigate("OrganizationDetail", { organizationId: item._id })} />}
      />
    </Screen>
  );
}

function OrgRow({ item, onPress }: { item: AdminOrganizationRow; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.orgIcon}><Ionicons color={colors.primaryDark} name="business-outline" size={22} /></View>
        <View style={styles.orgInfo}>
          <Text style={styles.orgName}>{item.name}</Text>
          <Text style={styles.meta}>{item.ownerEmail || "No owner email"}</Text>
        </View>
        <View style={[styles.statusPill, item.isActive ? styles.activePill : styles.inactivePill]}>
          <Text style={styles.statusText}>{item.isActive ? "Active" : "Paused"}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <MiniStat label="Products" value={item.stats.productCount} />
        <MiniStat label="Orders" value={item.stats.totalOrders} />
        <MiniStat label="Sales" value={`Rs ${formatMoney(item.stats.totalSales)}`} />
      </View>
    </TouchableOpacity>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return <View style={styles.stat}><Text numberOfLines={1} style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function formatMoney(value: number) {
  return Number(value || 0).toLocaleString("en-IN");
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 13, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  content: { paddingBottom: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  cardTop: { alignItems: "center", flexDirection: "row", marginBottom: spacing.md },
  orgIcon: { alignItems: "center", backgroundColor: colors.orangeSoft, borderRadius: radius.sm, height: 44, justifyContent: "center", marginRight: spacing.sm, width: 44 },
  orgInfo: { flex: 1 },
  orgName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  statusPill: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  activePill: { backgroundColor: colors.greenSoft },
  inactivePill: { backgroundColor: colors.redSoft },
  statusText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  stat: { backgroundColor: colors.background, borderRadius: radius.sm, flex: 1, padding: spacing.sm },
  statValue: { color: colors.text, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 11, marginTop: 2 },
});
