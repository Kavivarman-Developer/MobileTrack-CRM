import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Alert, AppState, FlatList, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { hasCallLogPermissionWarning, openCallLogSettings, syncVendorCallLogs } from "../../services/callLogSync";
import { createVendor, createVendorCall, deleteVendor, getVendorCalls, getVendorCallSummary, getVendors, updateVendor, Vendor } from "../../services/api";

const blank = { name: "", email: "", phone: "", address: "", gstNumber: "", notes: "" };
const fieldMeta: { key: keyof typeof blank; label: string; icon: any; multiline?: boolean }[] = [
  { key: "name", label: "Vendor name", icon: "business-outline" },
  { key: "email", label: "Email", icon: "mail-outline" },
  { key: "phone", label: "Phone", icon: "call-outline" },
  { key: "address", label: "Address", icon: "location-outline", multiline: true },
  { key: "gstNumber", label: "GST Number", icon: "document-text-outline" },
  { key: "notes", label: "Notes", icon: "reader-outline", multiline: true },
];

export default function VendorsScreen({ navigation }: any) {
  const [open, setOpen] = useState(false);
  const [callsOpen, setCallsOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [callDate, setCallDate] = useState(todayKey());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [syncingCalls, setSyncingCalls] = useState(false);
  const [permissionWarning, setPermissionWarning] = useState(false);
  const [callNote, setCallNote] = useState("");
  const [form, setForm] = useState(blank);
  const vendors = useQuery({ queryKey: ["vendors"], queryFn: () => getVendors("") });
  const callSummary = useQuery({ queryKey: ["vendor-call-summary", callDate], queryFn: () => getVendorCallSummary(7, callDate) });
  const calls = useQuery({ queryKey: ["vendor-calls", selectedVendor?._id, callDate], queryFn: () => getVendorCalls(selectedVendor!._id, callDate), enabled: !!selectedVendor?._id && callsOpen });
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: () => (editing ? updateVendor(editing._id, form) : createVendor(form)),
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      setForm(blank);
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (error: Error) => Alert.alert("Vendor save failed", error.message),
  });
  const remove = useMutation({
    mutationFn: deleteVendor,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendors"] }),
  });
  const logCall = useMutation({
    mutationFn: ({ type, note }: { type: "outgoing" | "incoming" | "missed"; note?: string }) =>
      createVendorCall(selectedVendor!._id, { type, note, phone: selectedVendor?.phone }),
    onSuccess: () => {
      setCallNote("");
      queryClient.invalidateQueries({ queryKey: ["vendor-calls", selectedVendor?._id, callDate] });
      queryClient.invalidateQueries({ queryKey: ["vendor-call-summary"] });
    },
    onError: (error: Error) => Alert.alert("Call log failed", error.message),
  });

  useEffect(() => {
    let mounted = true;
    async function runSync() {
      setSyncingCalls(true);
      try {
        const result = await syncVendorCallLogs();
        if (result.synced > 0) {
          queryClient.invalidateQueries({ queryKey: ["vendor-calls"] });
          queryClient.invalidateQueries({ queryKey: ["vendor-call-summary"] });
        }
        if (mounted) setPermissionWarning(result.permissionDenied || await hasCallLogPermissionWarning());
      } catch {
        if (mounted) setPermissionWarning(await hasCallLogPermissionWarning());
      } finally {
        if (mounted) setSyncingCalls(false);
      }
    }
    runSync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") runSync();
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [queryClient]);

  function openForm(vendor?: Vendor) {
    setEditing(vendor || null);
    setForm(
      vendor
        ? { name: vendor.name, email: vendor.email || "", phone: vendor.phone || "", address: vendor.address || "", gstNumber: vendor.gstNumber || "", notes: vendor.notes || "" }
        : blank
    );
    setOpen(true);
  }

  async function callVendor(vendor: Vendor) {
    if (!vendor.phone) {
      Alert.alert("No phone number", "Add a phone number for this vendor first.");
      return;
    }
    setSelectedVendor(vendor);
    await createVendorCall(vendor._id, { type: "outgoing", phone: vendor.phone, note: "Call started from app" }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["vendor-calls", vendor._id] });
    queryClient.invalidateQueries({ queryKey: ["vendor-call-summary"] });
    Linking.openURL(`tel:${vendor.phone}`);
  }

  function openCalls(vendor: Vendor) {
    setSelectedVendor(vendor);
    setCallNote("");
    setCallDate(todayKey());
    setCallsOpen(true);
  }

  function shiftCallDate(days: number) {
    const date = new Date(`${callDate}T00:00:00`);
    date.setDate(date.getDate() + days);
    setCallDate(toDateKey(date));
  }

  function changeCallDate(date?: Date) {
    setShowDatePicker(false);
    if (date) setCallDate(toDateKey(date));
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons color={colors.secondary} name="chevron-back" size={18} />
          </TouchableOpacity>
          <View>
            <Text style={styles.eyebrow}>Supplier book</Text>
            <Text style={styles.title}>Vendors</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => openForm()} style={styles.addButton}>
          <Ionicons color="#fff" name="add" size={22} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryPanel}>
        <View style={styles.summaryHeader}>
          <View>
            <Text style={styles.sectionLabel}>Call summary</Text>
            <Text style={styles.summaryHint}>Vendor call activity</Text>
          </View>
          <Ionicons color={colors.primaryDark} name="analytics-outline" size={20} />
        </View>
        <View style={styles.summaryGrid}>
          <CallStat label="Total" value={callSummary.data?.today.total || 0} />
          <CallStat label="Outgoing" tone="success" value={callSummary.data?.today.outgoing || 0} />
          <CallStat label="Received" tone="info" value={callSummary.data?.today.incoming || 0} />
          <CallStat label="Missed" tone="warning" value={callSummary.data?.today.missed || 0} />
        </View>
        <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePill}>
          <Ionicons color={colors.primaryDark} name="calendar-outline" size={16} />
          <Text style={styles.datePillText}>{formatDayLong(callDate)}</Text>
        </TouchableOpacity>
        {showDatePicker && (
          <DateTimePicker
            mode="date"
            value={new Date(`${callDate}T00:00:00`)}
            onChange={(_, date) => changeCallDate(date)}
          />
        )}
        {syncingCalls && <Text style={styles.syncText}>Syncing call logs...</Text>}
        {permissionWarning && Platform.OS === "android" && (
          <View style={styles.permissionBanner}>
            <Text style={styles.permissionText}>Enable call log access in Settings to auto-track missed calls</Text>
            <TouchableOpacity onPress={openCallLogSettings} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.dayList}>
          {(callSummary.data?.daily || []).slice(0, 4).map((day) => (
            <View key={day.date} style={styles.dayRow}>
              <Text style={styles.dayDate}>{formatDay(day.date)}</Text>
              <Text style={styles.dayMeta}>Total {day.total} | Out {day.outgoing} | In {day.incoming} | Missed {day.missed}</Text>
            </View>
          ))}
        </View>
      </View>

      <FlatList
        data={vendors.data || []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Empty text={vendors.isLoading ? "Loading vendors..." : "No vendors yet."} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity onPress={() => openForm(item)} style={styles.main}>
              <View style={styles.avatar}>
                <Ionicons color={colors.primaryDark} name="business" size={20} />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={styles.metaRow}>
                  <Ionicons color={colors.muted} name="call-outline" size={12} />
                  <Text style={styles.meta}>{item.phone || "No phone"}</Text>
                </View>
                <Text numberOfLines={1} style={styles.metaSub}>{item.gstNumber || item.address || item.email || "No further details"}</Text>
              </View>
              <Ionicons color={colors.muted} name="chevron-forward" size={18} />
            </TouchableOpacity>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => callVendor(item)} style={styles.actionButton}>
                <Ionicons color={colors.success} name="call-outline" size={15} />
                <Text style={styles.callText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openCalls(item)} style={[styles.actionButton, styles.borderLeft]}>
                <Ionicons color={colors.primaryDark} name="time-outline" size={15} />
                <Text style={styles.actionText}>Logs</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openForm(item)} style={styles.actionButton}>
                <Ionicons color={colors.primaryDark} name="create-outline" size={15} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove.mutate(item._id)} style={[styles.actionButton, styles.deleteButton]}>
                <Ionicons color={colors.danger} name="trash-outline" size={15} />
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.header}>
            <Text style={styles.title}>{editing ? "Edit Vendor" : "Add Vendor"}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" style={styles.formCard}>
            {fieldMeta.map(({ key, label, icon, multiline }) => (
              <View key={key} style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons color={colors.muted} name={icon} size={14} />
                  <Text style={styles.label}>{label}</Text>
                </View>
                <Field multiline={multiline} onChangeText={(value) => setForm((prev) => ({ ...prev, [key]: value }))} value={form[key]} />
              </View>
            ))}
            <Button loading={save.isPending} onPress={() => save.mutate()} title="Save vendor" />
          </ScrollView>
        </Screen>
      </Modal>

      <Modal animationType="slide" visible={callsOpen}>
        <Screen>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Call follow-up</Text>
              <Text style={styles.title}>{selectedVendor?.name || "Vendor calls"}</Text>
            </View>
            <TouchableOpacity onPress={() => setCallsOpen(false)} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={20} />
            </TouchableOpacity>
          </View>
          <View style={styles.formCard}>
            <View style={styles.dateSwitcher}>
              <TouchableOpacity onPress={() => shiftCallDate(-1)} style={styles.dateButton}><Ionicons color={colors.primaryDark} name="chevron-back" size={18} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setCallDate(todayKey())} style={styles.dateCenter}>
                <Text style={styles.dateTitle}>{formatDayLong(callDate)}</Text>
                <Text style={styles.dateHint}>{callDate === todayKey() ? "Today selected" : callDate}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => shiftCallDate(1)} style={styles.dateButton}><Ionicons color={colors.primaryDark} name="chevron-forward" size={18} /></TouchableOpacity>
            </View>
            <View style={styles.callActions}>
              <TouchableOpacity onPress={() => selectedVendor && callVendor(selectedVendor)} style={[styles.callAction, styles.callActionDial]}>
                <Ionicons color="#fff" name="call" size={18} />
                <Text style={styles.callActionTextLight}>Call now</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => logCall.mutate({ type: "missed", note: callNote || "Missed call from vendor" })} style={styles.callAction}>
                <Ionicons color={colors.warning} name="call-outline" size={18} />
                <Text style={styles.callActionText}>Missed</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => logCall.mutate({ type: "incoming", note: callNote || "Incoming call from vendor" })} style={styles.callAction}>
                <Ionicons color={colors.success} name="arrow-down-circle-outline" size={18} />
                <Text style={styles.callActionText}>Received</Text>
              </TouchableOpacity>
            </View>
            <Field multiline onChangeText={setCallNote} placeholder="Call note" value={callNote} />
          </View>
          <FlatList
            data={calls.data || []}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Empty text={calls.isLoading ? "Loading call logs..." : "No call logs yet."} />}
            renderItem={({ item }) => (
              <View style={styles.callLogCard}>
                <View style={styles.callLogTop}>
                  <Text style={styles.callType}>{callTypeLabel[item.type]}</Text>
                  <Text style={styles.callDate}>{new Date(item.occurredAt || item.createdAt).toLocaleString()}</Text>
                </View>
                <Text style={styles.meta}>{item.phone || selectedVendor?.phone || "No phone"}</Text>
                {!!item.note && <Text style={styles.metaSub}>{item.note}</Text>}
              </View>
            )}
          />
        </Screen>
      </Modal>
    </Screen>
  );
}

const callTypeLabel = {
  outgoing: "Outgoing call",
  incoming: "Received call",
  missed: "Missed call",
} as const;

function CallStat({ label, tone, value }: { label: string; tone?: "success" | "info" | "warning"; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, tone === "success" && styles.statSuccess, tone === "info" && styles.statInfo, tone === "warning" && styles.statWarning]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function formatDayLong(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function todayKey() {
  return toDateKey(new Date());
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  headerLeft: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  backButton: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: radius.sm, height: 40, justifyContent: "center", width: 40 },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, fontSize: 24, marginTop: 2 },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, height: 44, justifyContent: "center", width: 44, ...shadows.card, shadowOpacity: 0.18 },
  summaryPanel: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.md, padding: spacing.md, ...shadows.card },
  summaryHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  sectionLabel: { color: colors.text, fontSize: 16, fontWeight: "900" },
  summaryHint: { color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
  summaryGrid: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  datePill: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.blueSoft, borderColor: colors.secondary, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row", gap: 6, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 9 },
  datePillText: { color: colors.primaryDark, fontSize: 12, fontWeight: "900" },
  syncText: { color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: spacing.sm },
  permissionBanner: { alignItems: "center", backgroundColor: colors.orangeSoft, borderRadius: radius.sm, flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm, padding: spacing.sm },
  permissionText: { color: colors.text, flex: 1, fontSize: 12, fontWeight: "700" },
  permissionButton: { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  permissionButtonText: { color: colors.primaryDark, fontSize: 12, fontWeight: "900" },
  statCard: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, padding: spacing.sm },
  statValue: { color: colors.text, fontSize: 18, fontWeight: "900" },
  statSuccess: { color: colors.success },
  statInfo: { color: colors.info },
  statWarning: { color: colors.warning },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: "800", marginTop: 2 },
  dayList: { gap: spacing.xs },
  dayRow: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingTop: spacing.xs },
  dayDate: { color: colors.text, fontSize: 12, fontWeight: "900" },
  dayMeta: { color: colors.muted, flex: 1, fontSize: 11, fontWeight: "700", textAlign: "right" },

  listContent: { paddingBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.sm, overflow: "hidden", ...shadows.card },
  main: { alignItems: "center", flexDirection: "row", padding: spacing.md },
  avatar: { alignItems: "center", backgroundColor: colors.tealSoft, borderRadius: radius.sm, height: 46, justifyContent: "center", marginRight: spacing.sm, width: 46 },
  info: { flex: 1, paddingRight: spacing.sm },
  name: { color: colors.text, fontSize: 15, fontWeight: "800" },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 3 },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  metaSub: { color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  actions: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row" },
  actionButton: { alignItems: "center", flex: 1, flexDirection: "row", gap: 5, justifyContent: "center", paddingVertical: spacing.sm },
  actionText: { color: colors.primaryDark, fontSize: 12, fontWeight: "800" },
  callText: { color: colors.success, fontSize: 12, fontWeight: "800" },
  borderLeft: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  deleteButton: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: "800" },

  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.sm, height: 40, justifyContent: "center", width: 40, ...shadows.card },
  formCard: { backgroundColor: colors.surface, borderRadius: radius.md, ...shadows.card },
  modalContent: { padding: spacing.md, paddingBottom: spacing.xl },
  fieldBlock: { marginBottom: spacing.sm },
  fieldLabelRow: { alignItems: "center", flexDirection: "row", gap: 5, marginBottom: spacing.xs },
  label: { color: colors.text, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
  callActions: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  dateSwitcher: { alignItems: "center", flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  dateButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, height: 44, justifyContent: "center", width: 44 },
  dateCenter: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, minHeight: 44, justifyContent: "center" },
  dateTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  dateHint: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  callAction: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, gap: 4, justifyContent: "center", minHeight: 58 },
  callActionDial: { backgroundColor: colors.success, borderColor: colors.success },
  callActionText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  callActionTextLight: { color: "#fff", fontSize: 12, fontWeight: "800" },
  callLogCard: { backgroundColor: colors.surface, borderRadius: radius.md, marginBottom: spacing.sm, padding: spacing.md, ...shadows.card },
  callLogTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  callType: { color: colors.text, fontSize: 14, fontWeight: "900" },
  callDate: { color: colors.muted, fontSize: 11, fontWeight: "700" },
});
