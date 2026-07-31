import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Button, Empty, Field, Screen } from "../../components/Layout";
import { colors, radius, shadows, spacing, typography } from "../../constants/theme";
import { createVendor, deleteVendor, getVendors, updateVendor, Vendor } from "../../services/api";

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
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [form, setForm] = useState(blank);
  const vendors = useQuery({ queryKey: ["vendors"], queryFn: () => getVendors("") });
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

  function openForm(vendor?: Vendor) {
    setEditing(vendor || null);
    setForm(
      vendor
        ? { name: vendor.name, email: vendor.email || "", phone: vendor.phone || "", address: vendor.address || "", gstNumber: vendor.gstNumber || "", notes: vendor.notes || "" }
        : blank
    );
    setOpen(true);
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  headerLeft: { alignItems: "center", flexDirection: "row", flex: 1, gap: spacing.sm },
  backButton: { alignItems: "center", backgroundColor: colors.blueSoft, borderRadius: radius.sm, height: 40, justifyContent: "center", width: 40 },
  eyebrow: { color: colors.primary, ...typography.eyebrow },
  title: { color: colors.text, ...typography.h1, fontSize: 24, marginTop: 2 },
  addButton: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radius.sm, height: 44, justifyContent: "center", width: 44, ...shadows.card, shadowOpacity: 0.18 },

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
  deleteButton: { borderLeftColor: colors.border, borderLeftWidth: 1 },
  deleteText: { color: colors.danger, fontSize: 12, fontWeight: "800" },

  closeButton: { alignItems: "center", backgroundColor: colors.surface, borderRadius: radius.sm, height: 40, justifyContent: "center", width: 40, ...shadows.card },
  formCard: { backgroundColor: colors.surface, borderRadius: radius.md, ...shadows.card },
  modalContent: { padding: spacing.md, paddingBottom: spacing.xl },
  fieldBlock: { marginBottom: spacing.sm },
  fieldLabelRow: { alignItems: "center", flexDirection: "row", gap: 5, marginBottom: spacing.xs },
  label: { color: colors.text, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.3 },
});