import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, AppState, FlatList, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Badge, Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { hasCallLogPermissionWarning, openCallLogSettings, syncVendorCallLogs } from "../../services/callLogSync";
import { createVendor, createVendorCall, deleteVendor, getVendorCalls, getVendorCallSummary, getVendors, updateVendor, Vendor } from "../../services/api";

const blank = { name: "", email: "", phone: "", address: "", gstNumber: "", notes: "" };
const fieldMeta: { key: keyof typeof blank; label: string; icon: keyof typeof Ionicons.glyphMap; multiline?: boolean }[] = [
  { key: "name", label: "Vendor Name", icon: "business-outline" },
  { key: "email", label: "Email Address", icon: "mail-outline" },
  { key: "phone", label: "Phone Number", icon: "call-outline" },
  { key: "address", label: "Office Address", icon: "location-outline", multiline: true },
  { key: "gstNumber", label: "GST Number", icon: "document-text-outline" },
  { key: "notes", label: "Vendor Notes", icon: "reader-outline", multiline: true },
];

export default function VendorsScreen({ navigation }: any) {
  const [open, setOpen] = useState(false);
  const [callsOpen, setCallsOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [callDate, setCallDate] = useState(todayKey());
  const [pickerMonth, setPickerMonth] = useState(todayKey().slice(0, 7));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [syncingCalls, setSyncingCalls] = useState(false);
  const [permissionWarning, setPermissionWarning] = useState(false);
  const [callNote, setCallNote] = useState("");
  const [form, setForm] = useState(blank);
  const vendors = useQuery({ queryKey: ["vendors"], queryFn: () => getVendors("") });
  const callSummary = useQuery({ queryKey: ["vendor-call-summary", callDate], queryFn: () => getVendorCallSummary(7, callDate) });
  const calls = useQuery({ queryKey: ["vendor-calls", selectedVendor?._id, callDate], queryFn: () => getVendorCalls(selectedVendor!._id, callDate), enabled: !!selectedVendor?._id && callsOpen });
  const callDayStats = useMemo(() => {
    const rows = calls.data || [];
    return rows.reduce(
      (summary, call) => {
        summary.total += 1;
        if (call.type === "missed") summary.missed += 1;
        if (call.type === "outgoing" && call.source !== "auto") summary.appOutgoing += 1;
        return summary;
      },
      { total: 0, appOutgoing: 0, missed: 0 }
    );
  }, [calls.data]);
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
    const phone = String(vendor.phone || "").trim();
    const dialNumber = phone.replace(/[^\d+]/g, "");
    if (!dialNumber) {
      Alert.alert("No phone number", "Add a phone number for this vendor first.");
      return;
    }
    setSelectedVendor(vendor);
    Linking.openURL(`tel:${dialNumber}`).catch(() => {
      Alert.alert("Call not supported", "This device or browser cannot open the phone dialer.");
    });
    createVendorCall(vendor._id, { type: "outgoing", phone, note: "Call started from app" }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["vendor-calls", vendor._id] });
    queryClient.invalidateQueries({ queryKey: ["vendor-call-summary"] });
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

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons color={colors.text} name="chevron-back" size={20} />
          </TouchableOpacity>
          <View>
            <Text style={styles.eyebrow}>SUPPLIER BOOK</Text>
            <Text style={styles.title}>Vendors</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => openForm()} style={styles.addButton}>
          <Ionicons color="#ffffff" name="add" size={24} />
        </TouchableOpacity>
      </View>

      {/* Call Summary Panel */}
      <View style={styles.summaryPanel}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryTitleRow}>
            <View style={styles.summaryIcon}>
              <Ionicons color={colors.primary} name="call-outline" size={18} />
            </View>
            <View>
              <Text style={styles.sectionLabel}>Call Activity Summary</Text>
              <Text style={styles.summaryHint}>Vendor call logs & follow-ups</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.datePill}>
            <Ionicons color={colors.primary} name="calendar-outline" size={14} />
            <Text style={styles.datePillText}>{formatDayLong(callDate)}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.summaryGrid}>
          <CallStat label="Total Calls" value={callSummary.data?.today.total || 0} />
          <CallStat label="App Outgoing" tone="success" value={callSummary.data?.today.appOutgoing ?? callSummary.data?.today.outgoing ?? 0} />
          <CallStat label="Received" tone="info" value={callSummary.data?.today.incoming || 0} />
          <CallStat label="Missed" tone="warning" value={callSummary.data?.today.missed || 0} />
        </View>
        <DateSelectModal
          month={pickerMonth}
          onChangeMonth={setPickerMonth}
          onClose={() => setShowDatePicker(false)}
          onSelect={(date) => {
            setCallDate(date);
            setShowDatePicker(false);
          }}
          selectedDate={callDate}
          visible={showDatePicker && !callsOpen}
        />
        {syncingCalls && <Text style={styles.syncText}>Syncing call logs...</Text>}
        {permissionWarning && Platform.OS === "android" && (
          <View style={styles.permissionBanner}>
            <Text style={styles.permissionText}>Enable call log access in Settings to auto-track missed calls</Text>
            <TouchableOpacity onPress={openCallLogSettings} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>Settings</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <FlatList
        data={vendors.data || []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Empty icon="people-outline" text={vendors.isLoading ? "Loading vendors..." : "No vendors added yet."} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity onPress={() => openForm(item)} style={styles.main}>
              <View style={styles.avatar}>
                <Ionicons color={colors.primary} name="business" size={22} />
              </View>
              <View style={styles.info}>
                <Text style={styles.name}>{item.name}</Text>
                <View style={styles.metaRow}>
                  <Ionicons color={colors.muted} name="call-outline" size={13} />
                  <Text style={styles.meta}>{item.phone || "No phone number"}</Text>
                </View>
                <Text numberOfLines={1} style={styles.metaSub}>{item.gstNumber || item.address || item.email || "No further details"}</Text>
              </View>
              <Ionicons color={colors.muted} name="chevron-forward" size={18} />
            </TouchableOpacity>
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => callVendor(item)} style={styles.actionButton}>
                <Ionicons color={colors.success} name="call-outline" size={15} style={{ marginRight: 4 }} />
                <Text style={styles.callText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openCalls(item)} style={[styles.actionButton, styles.borderLeft]}>
                <Ionicons color={colors.primary} name="time-outline" size={15} style={{ marginRight: 4 }} />
                <Text style={styles.actionText}>Logs</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openForm(item)} style={styles.actionButton}>
                <Ionicons color={colors.text} name="create-outline" size={15} style={{ marginRight: 4 }} />
                <Text style={styles.actionTextDark}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove.mutate(item._id)} style={[styles.actionButton, styles.deleteButton]}>
                <Ionicons color={colors.danger} name="trash-outline" size={15} style={{ marginRight: 4 }} />
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Vendor Form Modal */}
      <Modal animationType="slide" visible={open}>
        <Screen>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>{editing ? "UPDATE VENDOR" : "NEW VENDOR"}</Text>
              <Text style={styles.title}>{editing ? "Edit Vendor" : "Add Vendor"}</Text>
            </View>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" style={styles.formCard}>
            {fieldMeta.map(({ key, label, icon, multiline }) => (
              <View key={key} style={styles.fieldBlock}>
                <View style={styles.fieldLabelRow}>
                  <Ionicons color={colors.primary} name={icon} size={14} />
                  <Text style={styles.label}>{label}</Text>
                </View>
                <Field multiline={multiline} onChangeText={(value) => setForm((prev) => ({ ...prev, [key]: value }))} value={form[key]} />
              </View>
            ))}
            <Button icon="checkmark-circle-outline" loading={save.isPending} onPress={() => save.mutate()} title="Save Vendor Profile" />
          </ScrollView>
        </Screen>
      </Modal>

      {/* Call Logs Modal */}
      <Modal animationType="slide" visible={callsOpen}>
        <Screen>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.eyebrow}>CALL FOLLOW-UP LOGS</Text>
              <Text style={styles.title}>{selectedVendor?.name || "Vendor Calls"}</Text>
            </View>
            <TouchableOpacity onPress={() => setCallsOpen(false)} style={styles.closeButton}>
              <Ionicons color={colors.text} name="close" size={20} />
            </TouchableOpacity>
          </View>
          <View style={styles.formCard}>
            <View style={styles.dateSwitcher}>
              <TouchableOpacity onPress={() => shiftCallDate(-1)} style={styles.dateButton}>
                <Ionicons color={colors.primary} name="chevron-back" size={18} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateCenter}>
                <Ionicons color={colors.primary} name="calendar-outline" size={16} />
                <View style={styles.dateTextBlock}>
                  <Text style={styles.dateTitle}>{formatDayLong(callDate)}</Text>
                  <Text style={styles.dateHint}>{callDate === todayKey() ? "Today" : callDate}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => shiftCallDate(1)} style={styles.dateButton}>
                <Ionicons color={colors.primary} name="chevron-forward" size={18} />
              </TouchableOpacity>
            </View>
            <DateSelectModal
              month={pickerMonth}
              onChangeMonth={setPickerMonth}
              onClose={() => setShowDatePicker(false)}
              onSelect={(date) => {
                setCallDate(date);
                setShowDatePicker(false);
              }}
              selectedDate={callDate}
              visible={showDatePicker && callsOpen}
            />
            <View style={styles.logStatsRow}>
              <View style={styles.logStatItem}>
                <Text style={styles.logStatValue}>{callDayStats.appOutgoing}</Text>
                <Text style={styles.logStatLabel}>App Calls</Text>
              </View>
              <View style={styles.logStatItem}>
                <Text style={[styles.logStatValue, styles.logStatMissed]}>{callDayStats.missed}</Text>
                <Text style={styles.logStatLabel}>Missed</Text>
              </View>
              <View style={styles.logStatItem}>
                <Text style={styles.logStatValue}>{callDayStats.total}</Text>
                <Text style={styles.logStatLabel}>Total</Text>
              </View>
            </View>
            <View style={styles.callActions}>
              <TouchableOpacity onPress={() => selectedVendor && callVendor(selectedVendor)} style={[styles.callAction, styles.callActionDial]}>
                <Ionicons color="#ffffff" name="call" size={16} />
                <Text style={styles.callActionTextLight}>Call Now</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => logCall.mutate({ type: "missed", note: callNote || "Missed call from vendor" })} style={[styles.callAction, styles.callActionMissed]}>
                <Ionicons color={colors.danger} name="call-outline" size={16} />
                <Text style={styles.callActionTextMissed}>Missed</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => logCall.mutate({ type: "incoming", note: callNote || "Incoming call from vendor" })} style={styles.callAction}>
                <Ionicons color={colors.success} name="arrow-down-circle-outline" size={16} />
                <Text style={styles.callActionText}>Received</Text>
              </TouchableOpacity>
            </View>
            <Field multiline onChangeText={setCallNote} placeholder="Add call note or discussion summary..." value={callNote} />
          </View>
          <FlatList
            data={calls.data || []}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Empty icon="call-outline" text={calls.isLoading ? "Loading call logs..." : "No call logs for this date."} />}
            renderItem={({ item }) => (
              <View style={[styles.callLogCard, item.type === "missed" && styles.callLogCardMissed]}>
                {item.type === "missed" && <View style={styles.missedStripe} />}
                <View style={styles.callLogTop}>
                  <View style={styles.callTypeRow}>
                    <Ionicons
                      color={item.type === "missed" ? colors.danger : item.type === "incoming" ? colors.success : colors.primary}
                      name={item.type === "missed" ? "alert-circle" : item.type === "incoming" ? "arrow-down-circle-outline" : "call-outline"}
                      size={16}
                    />
                    <Text style={[styles.callType, item.type === "missed" && styles.callTypeMissed, item.type === "incoming" && styles.callTypeIncoming]}>{callTypeLabel[item.type]}</Text>
                  </View>
                  <Text style={styles.callDate}>{new Date(item.occurredAt || item.createdAt).toLocaleString()}</Text>
                </View>
                <Text style={styles.meta}>{item.phone || selectedVendor?.phone || "No phone"}</Text>
                {!!item.note && <Text style={styles.metaSub}>{item.note}</Text>}
                {item.type === "missed" && (
                  <TouchableOpacity onPress={() => selectedVendor && callVendor(selectedVendor)} style={styles.callBackButton}>
                    <Ionicons color="#ffffff" name="call" size={14} />
                    <Text style={styles.callBackText}>Call Back Now</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          />
        </Screen>
      </Modal>
    </Screen>
  );
}

const callTypeLabel = {
  outgoing: "Outgoing Call",
  incoming: "Received Call",
  missed: "Missed Call",
} as const;

function CallStat({ label, tone, value }: { label: string; tone?: "success" | "info" | "warning"; value: number }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, tone === "success" && styles.statSuccess, tone === "info" && styles.statInfo, tone === "warning" && styles.statWarning]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DateSelectModal({ month, onChangeMonth, onClose, onSelect, selectedDate, visible }: { month: string; onChangeMonth: (month: string) => void; onClose: () => void; onSelect: (date: string) => void; selectedDate: string; visible: boolean }) {
  const days = daysInMonth(month);
  return (
    <Modal animationType="fade" transparent visible={visible}>
      <View style={styles.dateOverlay}>
        <View style={styles.dateModal}>
          <View style={styles.dateHeader}>
            <TouchableOpacity onPress={() => onChangeMonth(shiftMonth(month, -1))} style={styles.dateNav}><Text style={styles.dateNavText}>{"<"}</Text></TouchableOpacity>
            <Text style={styles.dateMonth}>{formatMonth(month)}</Text>
            <TouchableOpacity onPress={() => onChangeMonth(shiftMonth(month, 1))} style={styles.dateNav}><Text style={styles.dateNavText}>{">"}</Text></TouchableOpacity>
          </View>
          <View style={styles.dateGrid}>
            {days.map((date) => (
              <TouchableOpacity key={date} onPress={() => onSelect(date)} style={[styles.dateCell, selectedDate === date && styles.dateCellActive]}>
                <Text style={[styles.dateCellText, selectedDate === date && styles.dateCellTextActive]}>{Number(date.slice(-2))}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.dateClose}><Text style={styles.dateCloseText}>Close</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
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

function daysInMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const count = new Date(year, month, 0).getDate();
  return Array.from({ length: count }, (_, index) => `${monthKey}-${String(index + 1).padStart(2, "0")}`);
}

function shiftMonth(monthKey: string, amount: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  headerLeft: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  backButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, height: 38, justifyContent: "center", width: 38 },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, marginTop: 2 },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, height: 44, justifyContent: "center", width: 44, ...shadows.card },

  summaryPanel: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.md, padding: spacing.sm, ...shadows.card },
  summaryHeader: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between", marginBottom: spacing.sm },
  summaryTitleRow: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.sm, minWidth: 0 },
  summaryIcon: { alignItems: "center", backgroundColor: colors.primaryLight, borderRadius: radius.sm, height: 36, justifyContent: "center", width: 36 },
  sectionLabel: { color: colors.text, fontSize: 15, fontWeight: "700" },
  summaryHint: { color: colors.muted, fontSize: 12, marginTop: 1 },
  summaryGrid: { flexDirection: "row", gap: spacing.xs },
  datePill: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: "row", gap: 5, minHeight: 32, paddingHorizontal: spacing.sm },
  datePillText: { color: colors.primary, fontSize: 11, fontWeight: "600" },
  syncText: { color: colors.muted, fontSize: 12, marginBottom: spacing.sm },
  permissionBanner: { alignItems: "center", backgroundColor: colors.orangeSoft, borderRadius: radius.sm, flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm, padding: spacing.sm },
  permissionText: { color: colors.text, flex: 1, fontSize: 12 },
  permissionButton: { backgroundColor: colors.surface, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  permissionButtonText: { color: colors.primary, fontSize: 12, fontWeight: "700" },

  dateOverlay: { alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.45)", flex: 1, justifyContent: "center", padding: spacing.md },
  dateModal: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, width: "100%" },
  dateHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  dateNav: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 36, justifyContent: "center", width: 36 },
  dateNavText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  dateMonth: { color: colors.text, fontSize: 15, fontWeight: "700" },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  dateCell: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 36, justifyContent: "center", width: "13%" },
  dateCellActive: { backgroundColor: colors.primary },
  dateCellText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  dateCellTextActive: { color: "#ffffff" },
  dateClose: { alignItems: "center", borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, marginTop: spacing.md, minHeight: 40, justifyContent: "center" },
  dateCloseText: { color: colors.text, fontWeight: "600" },

  statCard: { backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, minHeight: 56, paddingHorizontal: spacing.xs, paddingVertical: spacing.xs },
  statValue: { color: colors.text, fontSize: 16, fontWeight: "700", textAlign: "center" },
  statSuccess: { color: colors.success },
  statInfo: { color: colors.info },
  statWarning: { color: colors.warning },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: "500", marginTop: 2, textAlign: "center" },

  listContent: { paddingBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden", ...shadows.card },
  main: { alignItems: "center", flexDirection: "row", padding: spacing.md },
  avatar: { alignItems: "center", backgroundColor: colors.primaryLight, borderRadius: radius.sm, height: 46, justifyContent: "center", marginRight: spacing.sm, width: 46 },
  info: { flex: 1, paddingRight: spacing.sm },
  name: { color: colors.text, fontSize: 15, fontWeight: "600" },
  metaRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 3 },
  meta: { color: colors.muted, fontSize: 12 },
  metaSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  actions: { borderTopColor: colors.border, borderTopWidth: 1, flexDirection: "row" },
  actionButton: { alignItems: "center", flex: 1, flexDirection: "row", justifyContent: "center", paddingVertical: 10 },
  actionText: { color: colors.primary, fontSize: 12, fontWeight: "600" },
  actionTextDark: { color: colors.text, fontSize: 12, fontWeight: "600" },
  callText: { color: colors.success, fontSize: 12, fontWeight: "600" },
  borderLeft: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  deleteButton: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: "600" },

  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  closeButton: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 40, justifyContent: "center", width: 40 },
  formCard: { backgroundColor: colors.surface, borderRadius: radius.md },
  modalContent: { padding: spacing.md, paddingBottom: spacing.xl },
  fieldBlock: { marginBottom: spacing.sm },
  fieldLabelRow: { alignItems: "center", flexDirection: "row", gap: 6, marginBottom: spacing.xs },
  label: { color: colors.text, ...typography.label },

  callActions: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  dateSwitcher: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm, padding: 4 },
  dateButton: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 36, justifyContent: "center", width: 36 },
  dateCenter: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flex: 1, flexDirection: "row", gap: spacing.xs, height: 36, justifyContent: "center", paddingHorizontal: spacing.sm },
  dateTextBlock: { alignItems: "center" },
  dateTitle: { color: colors.text, fontSize: 12, fontWeight: "700" },
  dateHint: { color: colors.muted, fontSize: 10 },

  logStatsRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  logStatItem: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: spacing.xs },
  logStatValue: { color: colors.success, fontSize: 16, fontWeight: "700" },
  logStatMissed: { color: colors.danger },
  logStatLabel: { color: colors.muted, fontSize: 10, marginTop: 2 },

  callAction: { alignItems: "center", backgroundColor: colors.surfaceTint, borderColor: colors.border, borderRadius: radius.sm, borderWidth: 1, flex: 1, flexDirection: "row", gap: 4, justifyContent: "center", minHeight: 44 },
  callActionDial: { backgroundColor: colors.success, borderColor: colors.success },
  callActionMissed: { backgroundColor: colors.redSoft, borderColor: colors.danger },
  callActionText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  callActionTextMissed: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  callActionTextLight: { color: "#ffffff", fontSize: 12, fontWeight: "700" },

  callLogCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm, overflow: "hidden", padding: spacing.md, ...shadows.card },
  callLogCardMissed: { backgroundColor: colors.redSoft, borderColor: colors.danger, borderWidth: 1 },
  missedStripe: { backgroundColor: colors.danger, bottom: 0, left: 0, position: "absolute", top: 0, width: 4 },
  callLogTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  callTypeRow: { alignItems: "center", flexDirection: "row", flex: 1, gap: 6, paddingLeft: 2 },
  callType: { color: colors.text, fontSize: 13, fontWeight: "600" },
  callTypeMissed: { color: colors.danger },
  callTypeIncoming: { color: colors.success },
  callDate: { color: colors.muted, fontSize: 11 },
  callBackButton: { alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.success, borderRadius: radius.pill, flexDirection: "row", gap: 4, marginTop: spacing.sm, height: 32, paddingHorizontal: spacing.md },
  callBackText: { color: "#ffffff", fontSize: 12, fontWeight: "700" },
});
