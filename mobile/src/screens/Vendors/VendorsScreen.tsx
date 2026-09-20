import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Alert, AppState, FlatList, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, FabButton, Field, IconButton, IosScreenHeader, IosSearchBar, PageHeader, Screen, StatStrip } from "../../components/Layout";
import { colors, fonts, radius, shadows, spacing, typography } from "../../constants/theme";
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

  async function whatsappVendor(vendor: Vendor) {
    const phone = String(vendor.phone || "").trim().replace(/[^\d]/g, "");
    if (!phone) {
      Alert.alert("No phone number", "Add a valid phone number for this vendor first.");
      return;
    }
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const msg = `Vanakkam ${vendor.name}, regarding purchase order & supplies inquiry from our store.`;
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    Linking.openURL(url).catch(() => Alert.alert("WhatsApp error", "Could not open WhatsApp."));
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
        eyebrow="Suppliers & Contacts"
        right={
          <View style={styles.headerActions}>
            <TouchableOpacity accessibilityLabel="Pick call date" onPress={() => setShowDatePicker(true)} style={styles.headerIconBtn}>
              <Ionicons color={colors.primary} name="calendar-outline" size={18} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openForm()} style={styles.addHeaderBtn}>
              <Ionicons color="#FFFFFF" name="add" size={18} />
              <Text style={styles.addHeaderBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        }
        title="Vendors"
      />

      <FlatList
        data={filteredVendors}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={(
          <View>
            {/* Top Metric Cards */}
            <View style={styles.metricsRow}>
              {/* Total Vendors */}
              <View style={[styles.metricCard, { borderLeftColor: "#6366F1" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#EEF2FF" }]}>
                    <Ionicons color="#6366F1" name="business" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>Total</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  {vendorCount}
                </Text>
                <Text style={styles.metricSub}>Suppliers</Text>
              </View>

              {/* Today's Calls */}
              <View style={[styles.metricCard, { borderLeftColor: "#3B82F6" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#EFF6FF" }]}>
                    <Ionicons color="#3B82F6" name="call" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>Today Calls</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  {today?.total || 0}
                </Text>
                <Text style={styles.metricSub}>{today?.appOutgoing ?? today?.outgoing ?? 0} outgoing</Text>
              </View>

              {/* Missed Calls */}
              <View style={[styles.metricCard, { borderLeftColor: "#EF4444" }]}>
                <View style={styles.metricHeader}>
                  <View style={[styles.metricIconWrap, { backgroundColor: "#FEF2F2" }]}>
                    <Ionicons color="#EF4444" name="alert-circle" size={16} />
                  </View>
                  <Text style={styles.metricLabel}>Missed</Text>
                </View>
                <Text numberOfLines={1} style={styles.metricValue}>
                  {today?.missed || 0}
                </Text>
                <Text style={styles.metricSub}>Follow ups</Text>
              </View>
            </View>

            {/* Search Bar */}
            <IosSearchBar
              onChangeText={setSearch}
              placeholder="Search vendor, phone, GST…"
              style={styles.searchBar}
              value={search}
            />

            {syncingCalls ? <Text style={styles.syncText}>Syncing call logs…</Text> : null}
            {permissionWarning && Platform.OS === "android" ? (
              <View style={styles.permissionBanner}>
                <Ionicons color="#F59E0B" name="warning-outline" size={18} />
                <Text style={styles.permissionText}>Enable call log access to auto-track missed calls</Text>
                <TouchableOpacity onPress={openCallLogSettings} style={styles.permissionButton}>
                  <Text style={styles.permissionButtonText}>Settings</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabelInline}>Suppliers Directory</Text>
              <Text style={styles.listCount}>{filteredVendors.length}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons color={colors.primary} name="business-outline" size={32} />
            </View>
            <Text style={styles.emptyTitle}>{vendors.isLoading ? "Loading vendors…" : "No vendors yet"}</Text>
            <Text style={styles.emptyText}>{vendors.isLoading ? "Just a moment." : "Add your first supplier to start calling, tracking POs and logging interactions."}</Text>
            {!vendors.isLoading ? (
              <TouchableOpacity onPress={() => openForm()} style={styles.emptyBtn}>
                <Ionicons color="#FFFFFF" name="add-circle-outline" size={18} />
                <Text style={styles.emptyBtnText}>Add Vendor</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.vendorCard}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => openForm(item)} style={styles.vendorMain}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.vendorInfo}>
                <Text numberOfLines={1} style={styles.vendorName}>{item.name}</Text>
                <View style={styles.vendorMetaRow}>
                  <Ionicons color={colors.textMuted} name="call-outline" size={13} />
                  <Text numberOfLines={1} style={styles.vendorMeta}>{item.phone || "No phone"}</Text>
                </View>
                {(item.gstNumber || item.address) ? (
                  <Text numberOfLines={1} style={styles.vendorSub}>
                    {item.gstNumber ? `GST: ${item.gstNumber}` : item.address}
                  </Text>
                ) : null}
              </View>
              <Ionicons color={colors.border} name="chevron-forward" size={18} />
            </TouchableOpacity>

            <View style={styles.vendorActions}>
              <TouchableOpacity onPress={() => callVendor(item)} style={styles.vendorAction}>
                <Ionicons color="#10B981" name="call" size={15} />
                <Text style={[styles.vendorActionText, { color: "#10B981" }]}>Call</Text>
              </TouchableOpacity>
              {item.phone ? (
                <TouchableOpacity onPress={() => whatsappVendor(item)} style={styles.vendorAction}>
                  <Ionicons color="#25D366" name="logo-whatsapp" size={15} />
                  <Text style={[styles.vendorActionText, { color: "#10B981" }]}>WhatsApp</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={() => openCalls(item)} style={styles.vendorAction}>
                <Ionicons color="#3B82F6" name="time" size={15} />
                <Text style={[styles.vendorActionText, { color: "#3B82F6" }]}>Logs</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openForm(item)} style={styles.vendorAction}>
                <Ionicons color={colors.textSecondary} name="create-outline" size={15} />
                <Text style={styles.vendorActionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(item)} style={styles.vendorAction}>
                <Ionicons color="#EF4444" name="trash-outline" size={15} />
                <Text style={[styles.vendorActionText, { color: "#EF4444" }]}>Delete</Text>
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
            eyebrow={editing ? "Update supplier" : "New supplier"}
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
            <TouchableOpacity
              activeOpacity={0.8}
              disabled={save.isPending}
              onPress={() => save.mutate()}
              style={[styles.saveBtn, save.isPending && { opacity: 0.7 }]}
            >
              <Ionicons color="#FFFFFF" name="checkmark-circle-outline" size={18} />
              <Text style={styles.saveBtnText}>{save.isPending ? "Saving..." : "Save Vendor Profile"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </Screen>
      </Modal>

      <Modal animationType="slide" visible={callsOpen}>
        <Screen>
          <PageHeader
            eyebrow="Follow-up logs"
            right={<IconButton accessibilityLabel="Close" icon="close" onPress={() => setCallsOpen(false)} />}
            title={selectedVendor?.name || "Vendor Calls"}
          />
          <View style={styles.callsPanel}>
            <View style={styles.dateSwitcher}>
              <TouchableOpacity onPress={() => shiftCallDate(-1)} style={styles.dateButton}>
                <Ionicons color={colors.primary} name="chevron-back" size={18} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.dateCenter}>
                <Ionicons color={colors.primary} name="calendar-outline" size={16} />
                <View>
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
                <Text style={styles.logStatLabel}>App calls</Text>
              </View>
              <View style={styles.logStatItem}>
                <Text style={[styles.logStatValue, { color: "#EF4444" }]}>{callDayStats.missed}</Text>
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
                <Ionicons color="#EF4444" name="alert-circle-outline" size={16} />
                <Text style={styles.callActionTextMissed}>Missed</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => logCall.mutate({ type: "incoming", note: callNote || "Incoming call from vendor" })} style={styles.callAction}>
                <Ionicons color="#10B981" name="arrow-down-circle-outline" size={16} />
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
                      color={item.type === "missed" ? "#EF4444" : item.type === "incoming" ? "#10B981" : colors.primary}
                      name={item.type === "missed" ? "alert-circle" : item.type === "incoming" ? "arrow-down-circle-outline" : "call-outline"}
                      size={16}
                    />
                    <Text style={[styles.callType, item.type === "missed" && { color: "#EF4444" }, item.type === "incoming" && { color: "#10B981" }]}>{callTypeLabel[item.type]}</Text>
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
  screen: { backgroundColor: colors.background },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  headerIconBtn: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
    ...shadows.card,
  },
  addHeaderBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 4,
    height: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    ...shadows.card,
  },
  addHeaderBtnText: {
    color: "#FFFFFF",
    fontFamily: fonts.bold,
    fontSize: 14,
    fontWeight: "700",
  },
  content: { width: "100%", paddingBottom: 40 },

  // Top Metrics
  metricsRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  metricCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    flex: 1,
    padding: spacing.sm,
    ...shadows.card,
  },
  metricHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginBottom: spacing.xs,
  },
  metricIconWrap: {
    alignItems: "center",
    borderRadius: radius.sm,
    height: 26,
    justifyContent: "center",
    width: 26,
  },
  metricLabel: {
    color: colors.muted,
    fontFamily: fonts.medium,
    fontSize: 11,
    fontWeight: "500",
  },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  metricSub: {
    color: colors.muted,
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 2,
  },

  searchBar: {
    marginBottom: spacing.sm,
  },

  syncText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginBottom: spacing.xs },
  permissionBanner: {
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    borderColor: "#FDE68A",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  permissionText: { color: "#92400E", flex: 1, fontFamily: fonts.medium, fontSize: 12 },
  permissionButton: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  permissionButtonText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 12 },

  sectionHead: { alignItems: "center", flexDirection: "row", marginBottom: spacing.xs, marginLeft: spacing.xxs, marginTop: spacing.xs },
  sectionLabelInline: { color: colors.muted, flex: 1, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },
  listCount: {
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.pill,
    color: colors.muted,
    fontFamily: fonts.bold,
    fontSize: 12,
    overflow: "hidden",
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },

  vendorCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: "hidden",
    ...shadows.card,
  },
  vendorMain: { alignItems: "center", flexDirection: "row", padding: spacing.md },
  avatar: {
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: radius.md,
    height: 44,
    justifyContent: "center",
    marginRight: spacing.sm,
    width: 44,
  },
  avatarText: { color: "#6366F1", fontFamily: fonts.bold, fontSize: 16, fontWeight: "700" },
  vendorInfo: { flex: 1, minWidth: 0, paddingRight: spacing.xs },
  vendorName: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, fontWeight: "700" },
  vendorMetaRow: { alignItems: "center", flexDirection: "row", gap: 4, marginTop: 3 },
  vendorMeta: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  vendorSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  vendorActions: {
    backgroundColor: "#F8FAFC",
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
  },
  vendorAction: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    paddingVertical: 10,
  },
  vendorActionText: { color: colors.muted, fontFamily: fonts.bold, fontSize: 12, fontWeight: "600" },

  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    ...shadows.card,
  },
  emptyIcon: {
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: radius.pill,
    height: 64,
    justifyContent: "center",
    marginBottom: spacing.md,
    width: 64,
  },
  emptyTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 17, fontWeight: "700" },
  emptyText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 14, marginTop: spacing.xs, textAlign: "center" },
  emptyBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 6,
    marginTop: spacing.md,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  emptyBtnText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 14, fontWeight: "700" },

  modalContent: { padding: spacing.md, paddingBottom: spacing.xl },
  fieldBlock: { marginBottom: spacing.md },
  fieldLabelRow: { alignItems: "center", flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
  label: { color: colors.text, ...typography.label },
  saveBtn: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 6,
    height: 48,
    justifyContent: "center",
    marginTop: spacing.md,
    ...shadows.card,
  },
  saveBtnText: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 15, fontWeight: "700" },

  callsPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    ...shadows.card,
  },
  dateSwitcher: {
    alignItems: "center",
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.sm,
    padding: 3,
  },
  dateButton: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.pill, height: 34, justifyContent: "center", width: 34, ...shadows.card },
  dateCenter: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    height: 34,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    ...shadows.card,
  },
  dateTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 12, fontWeight: "600" },
  dateHint: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10 },
  logStatsRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  logStatItem: {
    alignItems: "center",
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.md,
    flex: 1,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  logStatValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 18, fontWeight: "700" },
  logStatLabel: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },
  callActions: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  callAction: {
    alignItems: "center",
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.md,
    flex: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    minHeight: 40,
  },
  callActionDial: { backgroundColor: "#10B981" },
  callActionMissed: { backgroundColor: "#FEE2E2" },
  callActionText: { color: colors.text, fontFamily: fonts.bold, fontSize: 12, fontWeight: "600" },
  callActionTextMissed: { color: "#EF4444", fontFamily: fonts.bold, fontSize: 12, fontWeight: "600" },
  callActionTextLight: { color: "#ffffff", fontFamily: fonts.bold, fontSize: 12, fontWeight: "700" },
  callsList: { paddingBottom: spacing.lg, paddingHorizontal: spacing.md },
  callLogCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.xs,
    overflow: "hidden",
    padding: spacing.md,
    ...shadows.card,
  },
  callLogCardMissed: { backgroundColor: "#FFF5F5" },
  missedStripe: { backgroundColor: "#EF4444", bottom: 0, left: 0, position: "absolute", top: 0, width: 4 },
  callLogTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.xxs },
  callTypeRow: { alignItems: "center", flex: 1, flexDirection: "row", gap: spacing.xs, paddingLeft: 2 },
  callType: { color: colors.text, fontFamily: fonts.bold, fontSize: 13, fontWeight: "600" },
  callDate: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11 },
  callPhone: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12 },
  callNote: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: spacing.xxs },
  callBackButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#10B981",
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 4,
    height: 32,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  callBackText: { color: "#ffffff", fontFamily: fonts.bold, fontSize: 12, fontWeight: "700" },

  dateOverlay: { alignItems: "center", backgroundColor: "rgba(15, 23, 42, 0.45)", flex: 1, justifyContent: "center", padding: spacing.md },
  dateModal: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, width: "100%", maxWidth: 400, ...shadows.overlay },
  dateHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  dateNav: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.pill, height: 36, justifyContent: "center", width: 36 },
  dateNavText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 16, fontWeight: "700" },
  dateMonth: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, fontWeight: "700" },
  dateGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  dateCell: { alignItems: "center", backgroundColor: colors.surfaceTint, borderRadius: radius.sm, height: 38, justifyContent: "center", width: "13%" },
  dateCellActive: { backgroundColor: colors.primary },
  dateCellText: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
  dateCellTextActive: { color: "#ffffff", fontWeight: "700" },
  dateClose: {
    alignItems: "center",
    backgroundColor: colors.surfaceTint,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    minHeight: 42,
    justifyContent: "center",
  },
  dateCloseText: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, fontWeight: "600" },
});
