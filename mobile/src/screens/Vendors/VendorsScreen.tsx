import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, AppState, FlatList, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, FabButton, Field, IconButton, IosScreenHeader, IosSearchBar, PageHeader, Screen, StatStrip } from "../../components/Layout";
import { ios } from "../../constants/ios";
import { colors, fonts, spacing, typography } from "../../constants/theme";
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

export default function VendorsScreen() {
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
  const [search, setSearch] = useState("");
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
  const filteredVendors = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return (vendors.data || []).filter((vendor) => {
      if (!keyword) return true;
      return `${vendor.name} ${vendor.phone || ""} ${vendor.email || ""} ${vendor.gstNumber || ""}`.toLowerCase().includes(keyword);
    });
  }, [search, vendors.data]);
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

  function confirmDelete(vendor: Vendor) {
    Alert.alert("Delete vendor", `Remove ${vendor.name}?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => remove.mutate(vendor._id) },
    ]);
  }

  const today = callSummary.data?.today;
  const vendorCount = vendors.data?.length || 0;

  return (
    <Screen style={styles.screen}>
      <IosScreenHeader
        eyebrow="Vendors"
        right={(
          <TouchableOpacity accessibilityLabel="Pick call date" onPress={() => setShowDatePicker(true)} style={styles.dateBtn}>
            <Ionicons color={ios.navy} name="calendar-outline" size={18} />
          </TouchableOpacity>
        )}
        title="Vendors"
      />

      <FlatList
        data={filteredVendors}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            <StatStrip
              items={[
                { label: "Calls", value: String(today?.total || 0), icon: "call-outline", tone: "purple" },
                { label: "Outgoing", value: String(today?.appOutgoing ?? today?.outgoing ?? 0), icon: "arrow-up-outline", tone: "blue" },
                { label: "Missed", value: String(today?.missed || 0), icon: "alert-circle-outline", tone: "orange" },
              ]}
            />
            <IosSearchBar onChangeText={setSearch} placeholder="Search vendor, phone, GST…" value={search} />

            {syncingCalls ? <Text style={styles.syncText}>Syncing call logs…</Text> : null}
            {permissionWarning && Platform.OS === "android" ? (
              <View style={styles.permissionBanner}>
                <Text style={styles.permissionText}>Enable call log access to auto-track missed calls</Text>
                <TouchableOpacity onPress={openCallLogSettings} style={styles.permissionButton}>
                  <Text style={styles.permissionButtonText}>Settings</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabelInline}>All vendors</Text>
              <Text style={styles.listCount}>{vendorCount}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons color={ios.blue} name="people-outline" size={28} />
            </View>
            <Text style={styles.emptyTitle}>{vendors.isLoading ? "Loading vendors…" : "No vendors yet"}</Text>
            <Text style={styles.emptyText}>{vendors.isLoading ? "Just a moment." : "Add your first supplier to start calling and logging."}</Text>
            {!vendors.isLoading ? (
              <TouchableOpacity onPress={() => openForm()} style={styles.emptyBtn}>
                <Text style={styles.emptyBtnText}>Add vendor</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.vendorCard}>
            <TouchableOpacity onPress={() => openForm(item)} style={styles.vendorMain}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.vendorInfo}>
                <Text numberOfLines={1} style={styles.vendorName}>{item.name}</Text>
                <Text numberOfLines={1} style={styles.vendorMeta}>{item.phone || "No phone"}</Text>
                <Text numberOfLines={1} style={styles.vendorSub}>{item.gstNumber || item.email || item.address || "No extra details"}</Text>
              </View>
              <Ionicons color="#C7C7CC" name="chevron-forward" size={16} />
            </TouchableOpacity>
            <View style={styles.vendorActions}>
              <TouchableOpacity onPress={() => callVendor(item)} style={styles.vendorAction}>
                <Ionicons color={ios.green} name="call" size={15} />
                <Text style={[styles.vendorActionText, { color: ios.green }]}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openCalls(item)} style={styles.vendorAction}>
                <Ionicons color={ios.blue} name="time" size={15} />
                <Text style={[styles.vendorActionText, { color: ios.blue }]}>Logs</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openForm(item)} style={styles.vendorAction}>
                <Ionicons color={ios.label} name="create-outline" size={15} />
                <Text style={styles.vendorActionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.vendorAction}>
                <Ionicons color={ios.red} name="trash-outline" size={15} />
                <Text style={[styles.vendorActionText, { color: ios.red }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

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

      <Modal animationType="slide" visible={open}>
        <Screen>
          <PageHeader
            eyebrow={editing ? "Update vendor" : "New vendor"}
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setOpen(false)} />}
            title={editing ? "Edit Vendor" : "Add Vendor"}
          />
          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
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

      <Modal animationType="slide" visible={callsOpen}>
        <Screen>
          <PageHeader
            eyebrow="Call follow-up logs"
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setCallsOpen(false)} />}
            title={selectedVendor?.name || "Vendor Calls"}
          />
          <View style={styles.callsPanel}>
            <View style={styles.dateSwitcher}>
              <TouchableOpacity onPress={() => shiftCallDate(-1)} style={styles.dateButton}>
                <Ionicons color={ios.blue} name="chevron-back" size={18} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateCenter}>
                <Ionicons color={ios.blue} name="calendar-outline" size={16} />
                <View>
                  <Text style={styles.dateTitle}>{formatDayLong(callDate)}</Text>
                  <Text style={styles.dateHint}>{callDate === todayKey() ? "Today" : callDate}</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => shiftCallDate(1)} style={styles.dateButton}>
                <Ionicons color={ios.blue} name="chevron-forward" size={18} />
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
                <Text style={styles.logStatLabel}>App calls</Text>
              </View>
              <View style={styles.logStatItem}>
                <Text style={[styles.logStatValue, { color: ios.red }]}>{callDayStats.missed}</Text>
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
                <Text style={styles.callActionTextLight}>Call now</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => logCall.mutate({ type: "missed", note: callNote || "Missed call from vendor" })} style={[styles.callAction, styles.callActionMissed]}>
                <Ionicons color={ios.red} name="call-outline" size={16} />
                <Text style={styles.callActionTextMissed}>Missed</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => logCall.mutate({ type: "incoming", note: callNote || "Incoming call from vendor" })} style={styles.callAction}>
                <Ionicons color={ios.green} name="arrow-down-circle-outline" size={16} />
                <Text style={styles.callActionText}>Received</Text>
              </TouchableOpacity>
            </View>
            <Field multiline onChangeText={setCallNote} placeholder="Add call note or discussion summary..." value={callNote} />
          </View>
          <FlatList
            data={calls.data || []}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.callsList}
            ListEmptyComponent={<Empty icon="call-outline" text={calls.isLoading ? "Loading call logs..." : "No call logs for this date."} />}
            renderItem={({ item }) => (
              <View style={[styles.callLogCard, item.type === "missed" && styles.callLogCardMissed]}>
                {item.type === "missed" && <View style={styles.missedStripe} />}
                <View style={styles.callLogTop}>
                  <View style={styles.callTypeRow}>
                    <Ionicons
                      color={item.type === "missed" ? ios.red : item.type === "incoming" ? ios.green : ios.blue}
                      name={item.type === "missed" ? "alert-circle" : item.type === "incoming" ? "arrow-down-circle-outline" : "call-outline"}
                      size={16}
                    />
                    <Text style={[styles.callType, item.type === "missed" && { color: ios.red }, item.type === "incoming" && { color: ios.green }]}>{callTypeLabel[item.type]}</Text>
                  </View>
                  <Text style={styles.callDate}>{new Date(item.occurredAt || item.createdAt).toLocaleString()}</Text>
                </View>
                <Text style={styles.callPhone}>{item.phone || selectedVendor?.phone || "No phone"}</Text>
                {!!item.note && <Text style={styles.callNote}>{item.note}</Text>}
                {item.type === "missed" && (
                  <TouchableOpacity onPress={() => selectedVendor && callVendor(selectedVendor)} style={styles.callBackButton}>
                    <Ionicons color="#ffffff" name="call" size={14} />
                    <Text style={styles.callBackText}>Call back now</Text>
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
  outgoing: "Outgoing call",
  incoming: "Received call",
  missed: "Missed call",
} as const;

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
  screen: { backgroundColor: ios.bg },
  header: { alignItems: "flex-start", flexDirection: "row", marginBottom: spacing.sm, marginTop: spacing.xxs, paddingHorizontal: spacing.md },
  headerCopy: { flex: 1, minWidth: 0, paddingRight: spacing.sm },
  greeting: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13 },
  title: { color: ios.label, fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.5, lineHeight: 32, marginTop: 1 },
  headerAdd: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    marginTop: spacing.xxs,
    width: 36,
  },
  content: { alignSelf: "center", maxWidth: 430, paddingBottom: 88, paddingHorizontal: spacing.md, width: "100%" },
  searchBox: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 14,
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: 11,
    minHeight: 40,
    paddingHorizontal: spacing.sm,
  },
  searchInput: { backgroundColor: "transparent", borderWidth: 0, flex: 1, marginBottom: 0, minHeight: 40, paddingHorizontal: 0 },

  hero: {
    backgroundColor: ios.dark,
    borderRadius: 22,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  heroOverline: { color: "rgba(255,255,255,0.62)", fontFamily: fonts.medium, fontSize: 13 },
  heroAmount: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 40, letterSpacing: -1, lineHeight: 46, marginTop: 2 },
  heroSub: { color: "rgba(255,255,255,0.55)", fontFamily: fonts.regular, fontSize: 14, marginTop: 2 },
  heroPills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.sm },
  heroPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
    color: "#FFFFFF",
    fontFamily: fonts.medium,
    fontSize: 13,
    overflow: "hidden",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  heroCta: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    marginTop: spacing.md,
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  heroCtaText: { color: ios.dark, fontFamily: fonts.semibold, fontSize: 15 },

  syncText: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginBottom: spacing.xs },
  permissionBanner: {
    alignItems: "center",
    backgroundColor: "#FF95001F",
    borderRadius: 14,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  permissionText: { color: ios.label, flex: 1, fontFamily: fonts.regular, fontSize: 13 },
  permissionButton: { backgroundColor: ios.card, borderRadius: 999, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  permissionButtonText: { color: ios.blue, fontFamily: fonts.semibold, fontSize: 12 },

  sectionHead: { alignItems: "center", flexDirection: "row", marginBottom: spacing.xs, marginLeft: spacing.xxs, marginTop: spacing.xs },
  sectionLabelInline: { color: ios.secondary, flex: 1, fontFamily: fonts.regular, fontSize: 13 },
  listCount: {
    backgroundColor: ios.fill,
    borderRadius: 999,
    color: ios.label,
    fontFamily: fonts.semibold,
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },

  vendorCard: {
    backgroundColor: ios.card,
    borderRadius: 18,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  vendorMain: { alignItems: "center", flexDirection: "row", padding: 11 },
  avatar: {
    alignItems: "center",
    backgroundColor: "#007AFF14",
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    marginRight: spacing.sm,
    width: 44,
  },
  avatarText: { color: ios.blue, fontFamily: fonts.bold, fontSize: 16 },
  vendorInfo: { flex: 1, minWidth: 0, paddingRight: spacing.xs },
  vendorName: { color: ios.label, fontFamily: fonts.semibold, fontSize: 16 },
  vendorMeta: { color: ios.label, fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  vendorSub: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  vendorActions: {
    borderTopColor: "rgba(60,60,67,0.12)",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
  vendorAction: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: spacing.xxs,
    justifyContent: "center",
    paddingVertical: spacing.sm,
  },
  vendorActionText: { color: ios.label, fontFamily: fonts.semibold, fontSize: 12 },

  emptyCard: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: 22,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "#007AFF14",
    borderRadius: 22,
    height: 56,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 56,
  },
  emptyTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 17 },
  emptyText: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 14, marginTop: spacing.xxs, textAlign: "center" },
  emptyBtn: {
    backgroundColor: ios.dark,
    borderRadius: 14,
    marginTop: spacing.md,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  emptyBtnText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 14, textAlign: "center" },

  modalContent: { padding: spacing.md, paddingBottom: spacing.xl },
  fieldBlock: { marginBottom: spacing.sm },
  fieldLabelRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
  label: { color: colors.text, ...typography.label },

  callsPanel: { backgroundColor: ios.card, borderRadius: 16, marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.md },
  dateSwitcher: { alignItems: "center", backgroundColor: ios.fill, borderRadius: 999, flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm, padding: spacing.xxs },
  dateButton: { alignItems: "center", backgroundColor: ios.card, borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  dateCenter: { alignItems: "center", backgroundColor: ios.card, borderRadius: 999, flex: 1, flexDirection: "row", gap: spacing.xs, height: 36, justifyContent: "center", paddingHorizontal: spacing.sm },
  dateTitle: { color: ios.label, fontFamily: fonts.semibold, fontSize: 12 },
  dateHint: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 10 },
  logStatsRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  logStatItem: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: 12,
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  logStatValue: { color: ios.label, fontFamily: fonts.bold, fontSize: 18 },
  logStatLabel: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  callActions: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  callAction: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: 12,
    flex: 1,
    flexDirection: "row",
    gap: spacing.xxs,
    justifyContent: "center",
    minHeight: 40,
  },
  callActionDial: { backgroundColor: ios.green },
  callActionMissed: { backgroundColor: "#FF3B301F" },
  callActionText: { color: ios.label, fontFamily: fonts.semibold, fontSize: 12 },
  callActionTextMissed: { color: ios.red, fontFamily: fonts.semibold, fontSize: 12 },
  callActionTextLight: { color: "#ffffff", fontFamily: fonts.semibold, fontSize: 12 },
  callsList: { paddingBottom: spacing.lg, paddingHorizontal: spacing.md },
  callLogCard: {
    backgroundColor: ios.card,
    borderRadius: 16,
    marginBottom: spacing.xs,
    overflow: "hidden",
    padding: 11,
  },
  callLogCardMissed: { backgroundColor: "#FF3B3014" },
  missedStripe: { backgroundColor: ios.red, bottom: 0, left: 0, position: "absolute", top: 0, width: 4 },
  callLogTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xxs },
  callTypeRow: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.xs, paddingLeft: 2 },
  callType: { color: ios.label, fontFamily: fonts.semibold, fontSize: 13 },
  callDate: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 11 },
  callPhone: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12 },
  callNote: { color: ios.secondary, fontFamily: fonts.regular, fontSize: 12, marginTop: spacing.xxs },
  callBackButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: ios.green,
    borderRadius: 999,
    flexDirection: "row",
    gap: spacing.xxs,
    height: 32,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  callBackText: { color: "#ffffff", fontFamily: fonts.semibold, fontSize: 12 },

  dateOverlay: { alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.45)", flex: 1, justifyContent: "center", padding: spacing.md },
  dateModal: { backgroundColor: ios.card, borderRadius: 16, padding: spacing.md, width: "100%" },
  dateHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  dateNav: { alignItems: "center", backgroundColor: ios.fill, borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  dateNavText: { color: ios.blue, fontFamily: fonts.bold, fontSize: 16 },
  dateMonth: { color: ios.label, fontFamily: fonts.bold, fontSize: 15 },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  dateCell: { alignItems: "center", backgroundColor: ios.fill, borderRadius: 10, height: 36, justifyContent: "center", width: "13%" },
  dateCellActive: { backgroundColor: ios.blue },
  dateCellText: { color: ios.label, fontFamily: fonts.semibold, fontSize: 12 },
  dateCellTextActive: { color: "#ffffff" },
  dateClose: { alignItems: "center", backgroundColor: ios.fill, borderRadius: 12, marginTop: spacing.md, minHeight: 40, justifyContent: "center" },
  dateCloseText: { color: ios.label, fontFamily: fonts.semibold },
  dateBtn: { alignItems: "center", backgroundColor: ios.fill, borderRadius: 14, height: 40, justifyContent: "center", width: 40 },
});
