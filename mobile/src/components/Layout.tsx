import { ReactNode, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ios } from "../constants/ios";
import { colors, fonts, radius, shadows, spacing, typography } from "../constants/theme";

export function Screen({ children, style }: { children: ReactNode; style?: any }) {
  return <SafeAreaView edges={["top", "left", "right"]} style={[styles.screen, style]}>{children}</SafeAreaView>;
}

export function Card({ children, style }: { children: ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Title({ children, style }: { children: ReactNode; style?: any }) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Eyebrow({ children, icon }: { children: ReactNode; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.eyebrowWrap}>
      {icon && <Ionicons color={ios.secondary} name={icon} size={13} style={styles.eyebrowIcon} />}
      <Text style={styles.eyebrow}>{children}</Text>
    </View>
  );
}

export function PageHeader({
  eyebrow,
  title,
  left,
  right,
}: {
  eyebrow?: string;
  title?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={styles.pageHeader}>
      {left ? <View style={styles.pageHeaderLeft}>{left}</View> : null}
      {(eyebrow || title) ? (
        <View style={styles.pageHeaderCopy}>
          {eyebrow ? <Text style={styles.pageEyebrow}>{eyebrow}</Text> : null}
          {title ? <Text style={styles.pageTitle}>{title}</Text> : null}
        </View>
      ) : <View style={styles.pageHeaderCopy} />}
      {right}
    </View>
  );
}

/** Emergent page header: purple uppercase eyebrow + bold title */
export function IosScreenHeader({
  eyebrow,
  title,
  onAdd,
  addLabel = "Add",
  left,
  right,
}: {
  eyebrow?: string;
  title: string;
  onAdd?: () => void;
  addLabel?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <View style={styles.iosHeader}>
      {left ? <View style={styles.iosHeaderSide}>{left}</View> : null}
      <View style={styles.iosHeaderCopy}>
        {eyebrow ? <Text style={styles.iosGreeting}>{eyebrow}</Text> : null}
        <Text style={styles.iosTitle}>{title}</Text>
      </View>
      {right}
      {!right && onAdd ? (
        <TouchableOpacity accessibilityLabel={addLabel} onPress={onAdd} style={styles.iosAdd}>
          <Ionicons color="#FFFFFF" name="add" size={22} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function IosSearchBar({
  value,
  onChangeText,
  placeholder = "Search…",
  style,
  onFilterPress,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: any;
  onFilterPress?: () => void;
}) {
  return (
    <View style={[styles.searchRow, style]}>
      <View style={styles.iosSearch}>
        <Ionicons color={ios.secondary} name="search" size={16} />
        <Field onChangeText={onChangeText} placeholder={placeholder} style={styles.iosSearchInput} value={value} />
        {value ? (
          <TouchableOpacity onPress={() => onChangeText("")}>
            <Ionicons color={ios.secondary} name="close-circle" size={18} />
          </TouchableOpacity>
        ) : null}
      </View>
      {onFilterPress ? (
        <TouchableOpacity accessibilityLabel="Filter" onPress={onFilterPress} style={styles.filterBtn}>
          <Ionicons color={ios.navy} name="options-outline" size={18} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export type StatItem = {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone?: "purple" | "orange" | "green" | "blue";
};

export function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <View style={styles.statStrip}>
      {items.map((item) => {
        const tone = item.tone || "purple";
        return (
          <View key={item.label} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: statTone[tone].bg }]}>
              <Ionicons color={statTone[tone].fg} name={item.icon} size={14} />
            </View>
            <Text numberOfLines={1} style={styles.statValue}>{item.value}</Text>
            <Text numberOfLines={1} style={styles.statLabel}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export type FilterChip = { key: string; label: string; count?: number };

export function FilterChipRow({
  chips,
  value,
  onChange,
  variant = "status",
}: {
  chips: FilterChip[];
  value: string;
  onChange: (key: string) => void;
  variant?: "status" | "category";
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {chips.map((chip) => {
        const on = value === chip.key;
        const label = chip.count != null ? `${chip.label} ${chip.count}` : chip.label;
        return (
          <TouchableOpacity
            key={chip.key}
            onPress={() => onChange(chip.key)}
            style={[
              styles.filterChip,
              variant === "category" ? styles.categoryChip : styles.statusChip,
              on && (variant === "category" ? styles.categoryChipOn : styles.statusChipOn),
            ]}
          >
            <Text style={[
              styles.filterChipText,
              variant === "category" ? styles.categoryChipText : styles.statusChipText,
              on && (variant === "category" ? styles.categoryChipTextOn : styles.statusChipTextOn),
            ]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

export function FabButton({
  onPress,
  accessibilityLabel = "Add",
  icon = "add",
}: {
  onPress: () => void;
  accessibilityLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={styles.fab}
    >
      <Ionicons color="#FFFFFF" name={icon} size={28} />
    </TouchableOpacity>
  );
}

export function IosHero({
  overline,
  amount,
  subtitle,
  pills,
  ctaLabel,
  onCta,
  children,
}: {
  overline?: string;
  amount: string;
  subtitle?: string;
  pills?: string[];
  ctaLabel?: string;
  onCta?: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={styles.iosHero}>
      {overline ? <Text style={styles.iosHeroOverline}>{overline}</Text> : null}
      <Text style={styles.iosHeroAmount}>{amount}</Text>
      {subtitle ? <Text style={styles.iosHeroSub}>{subtitle}</Text> : null}
      {pills?.length ? (
        <View style={styles.iosHeroPills}>
          {pills.map((pill) => (
            <Text key={pill} style={styles.iosHeroPill}>{pill}</Text>
          ))}
        </View>
      ) : null}
      {children}
      {ctaLabel && onCta ? (
        <TouchableOpacity onPress={onCta} style={styles.iosHeroCta}>
          <Text style={styles.iosHeroCtaText}>{ctaLabel}</Text>
          <Ionicons color={ios.dark} name="arrow-forward" size={16} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function IosSegment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  return (
    <View style={styles.iosSegment}>
      {options.map((opt) => {
        const on = value === opt.key;
        return (
          <TouchableOpacity
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.iosSegmentItem, on && styles.iosSegmentItemOn]}
          >
            <Text style={[styles.iosSegmentText, on && styles.iosSegmentTextOn]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Full-screen form modal with sticky bottom action for thumb reach */
export function IosFormSheet({
  visible,
  onClose,
  title,
  eyebrow,
  icon = "create-outline",
  children,
  footer,
  footerLabel,
  onFooterPress,
  footerLoading,
  footerDisabled,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
  footer?: ReactNode;
  footerLabel?: string;
  onFooterPress?: () => void;
  footerLoading?: boolean;
  footerDisabled?: boolean;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <SafeAreaView edges={["top", "left", "right", "bottom"]} style={styles.formSheet}>
        <View style={styles.formSheetGrabRow}>
          <View style={styles.sheetHandle} />
        </View>
        <View style={styles.formSheetHeader}>
          <View style={styles.formSheetIcon}>
            <Ionicons color={ios.blue} name={icon} size={22} />
          </View>
          <View style={styles.formSheetCopy}>
            {eyebrow ? <Text style={styles.iosGreeting}>{eyebrow}</Text> : null}
            <Text style={styles.formSheetTitle}>{title}</Text>
          </View>
          <Pressable accessibilityLabel="Close" onPress={onClose} style={({ pressed }) => [styles.sheetClose, pressed && styles.buttonPressed]}>
            <Ionicons color={ios.label} name="close" size={20} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.formSheetBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formSheetCard}>{children}</View>
        </ScrollView>
        {footer ? (
          <View style={styles.formSheetFooter}>{footer}</View>
        ) : footerLabel && onFooterPress ? (
          <View style={styles.formSheetFooter}>
            <TouchableOpacity
              disabled={footerDisabled || footerLoading}
              onPress={onFooterPress}
              style={[styles.formSheetSave, (footerDisabled || footerLoading) && styles.buttonDisabled]}
            >
              {footerLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.formSheetSaveText}>{footerLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  tone = "neutral",
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
  tone?: "neutral" | "primary" | "danger";
}) {
  const color = tone === "primary" ? ios.blue : tone === "danger" ? ios.red : ios.label;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}
    >
      <Ionicons color={color} name={icon} size={20} />
    </Pressable>
  );
}

export function SearchField({ style, ...props }: TextInputProps) {
  return (
    <View style={styles.searchFieldWrap}>
      <Ionicons color={ios.secondary} name="search-outline" size={18} style={styles.searchFieldIcon} />
      <Field {...props} style={[styles.searchFieldInput, style]} />
    </View>
  );
}

export function SelectOption({
  label,
  meta,
  selected,
  onPress,
  multi,
}: {
  label: string;
  meta?: string;
  selected?: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  return (
    <TouchableOpacity
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={{ selected: Boolean(selected) }}
      onPress={onPress}
      style={[styles.selectOption, selected && styles.selectOptionOn]}
    >
      <View style={styles.selectOptionCopy}>
        <Text numberOfLines={1} style={[styles.selectOptionLabel, selected && styles.selectOptionLabelOn]}>{label}</Text>
        {meta ? <Text numberOfLines={1} style={styles.selectOptionMeta}>{meta}</Text> : null}
      </View>
      <Ionicons
        color={selected ? ios.blue : ios.secondary}
        name={multi ? (selected ? "checkbox" : "square-outline") : selected ? "radio-button-on" : "radio-button-off"}
        size={22}
      />
    </TouchableOpacity>
  );
}

export function Sheet({
  visible,
  onClose,
  title,
  hint,
  icon = "options-outline",
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  hint?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.sheetBackdrop}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={["bottom"]} style={styles.sheetSafe}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View style={styles.sheetIconWrap}>
                <Ionicons color={ios.blue} name={icon} size={22} />
              </View>
              <View style={styles.sheetCopy}>
                <Text style={styles.sheetTitle}>{title}</Text>
                {hint ? <Text style={styles.sheetHint}>{hint}</Text> : null}
              </View>
              <Pressable accessibilityLabel="Close" onPress={onClose} style={({ pressed }) => [styles.sheetClose, pressed && styles.buttonPressed]}>
                <Ionicons color={ios.label} name="close" size={18} />
              </Pressable>
            </View>
            <View style={styles.sheetBody}>{children}</View>
            {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export function Field({ error, errorText, onBlur, onFocus, style, ...props }: TextInputProps & { error?: boolean; errorText?: string }) {
  const [focused, setFocused] = useState(false);
  const invalid = Boolean(error || errorText);
  return (
    <>
      <TextInput
        placeholderTextColor={ios.secondary}
        {...props}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        style={[
          styles.input,
          props.multiline && styles.inputMultiline,
          focused && styles.inputFocused,
          invalid && styles.inputError,
          style,
        ]}
      />
      {errorText ? <Text style={styles.fieldError}>{errorText}</Text> : null}
    </>
  );
}

export function Button({
  title,
  onPress,
  loading,
  variant = "primary",
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: keyof typeof Ionicons.glyphMap;
  style?: any;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: Boolean(loading), disabled: Boolean(loading) }}
      disabled={loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" && styles.buttonSecondary,
        variant === "ghost" && styles.buttonGhost,
        variant === "danger" && styles.buttonDanger,
        pressed && styles.buttonPressed,
        loading && styles.buttonDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" || variant === "danger" ? "#ffffff" : ios.blue} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon && (
            <Ionicons
              color={
                variant === "secondary"
                  ? ios.label
                  : variant === "ghost"
                  ? ios.blue
                  : "#ffffff"
              }
              name={icon}
              size={18}
              style={{ marginRight: 6 }}
            />
          )}
          <Text
            style={[
              styles.buttonText,
              variant === "secondary" && styles.buttonTextSecondary,
              variant === "ghost" && styles.buttonTextGhost,
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Empty({ text, icon = "cube-outline" }: { text: string; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconWrap}>
        <Ionicons color={ios.blue} name={icon} size={24} />
      </View>
      <Text style={styles.empty}>{text}</Text>
    </View>
  );
}

export function Badge({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: "success" | "danger" | "warning" | "info" | "neutral";
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const defaultIcon: Record<string, keyof typeof Ionicons.glyphMap> = {
    success: "checkmark-circle-outline",
    danger: "alert-circle-outline",
    warning: "time-outline",
    info: "information-circle-outline",
    neutral: "ellipse-outline",
  };
  const activeIcon = icon || defaultIcon[tone];

  return (
    <View style={[styles.badge, badgeTone[tone].bg]}>
      <Ionicons color={badgeTone[tone].iconColor} name={activeIcon} size={12} style={{ marginRight: 4 }} />
      <Text style={[styles.badgeText, badgeTone[tone].text]}>{label}</Text>
    </View>
  );
}

const badgeTone = {
  success: { bg: { backgroundColor: colors.greenSoft }, text: { color: colors.success }, iconColor: colors.success },
  danger: { bg: { backgroundColor: colors.redSoft }, text: { color: colors.danger }, iconColor: colors.danger },
  warning: { bg: { backgroundColor: colors.orangeSoft }, text: { color: colors.warning }, iconColor: colors.warning },
  info: { bg: { backgroundColor: colors.blueSoft }, text: { color: colors.info }, iconColor: colors.info },
  neutral: { bg: { backgroundColor: colors.surfaceTint }, text: { color: colors.muted }, iconColor: colors.muted },
} as const;

const statTone = {
  purple: { bg: ios.purpleSoft, fg: ios.purple },
  orange: { bg: colors.orangeSoft, fg: ios.orange },
  green: { bg: colors.greenSoft, fg: ios.green },
  blue: { bg: colors.blueSoft, fg: ios.blue },
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ios.bg, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  card: {
    backgroundColor: ios.card,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    ...shadows.card,
  },
  title: { color: ios.label, ...typography.h1, marginBottom: spacing.xs },
  eyebrowWrap: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  eyebrowIcon: { marginRight: 4 },
  eyebrow: { color: ios.secondary, ...typography.eyebrow },
  pageHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md },
  pageHeaderLeft: { marginRight: spacing.sm },
  pageHeaderCopy: { flex: 1, paddingRight: spacing.sm },
  pageEyebrow: { color: ios.purpleEyebrow, fontFamily: fonts.semibold, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  pageTitle: { color: ios.label, ...typography.h1, marginTop: 2 },

  iosHeader: { alignItems: "flex-start", flexDirection: "row", marginBottom: spacing.md },
  iosHeaderSide: { marginRight: spacing.sm, marginTop: 6 },
  iosHeaderCopy: { flex: 1, paddingRight: spacing.sm },
  iosGreeting: { color: ios.purpleEyebrow, fontFamily: fonts.semibold, fontSize: 11, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase" },
  iosTitle: { color: ios.label, fontFamily: fonts.bold, fontSize: 28, fontWeight: "700", letterSpacing: -0.6, marginTop: 2 },
  iosAdd: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 14,
    height: 40,
    justifyContent: "center",
    marginTop: 4,
    width: 40,
  },

  searchRow: { alignItems: "center", flexDirection: "row", gap: 10, marginBottom: spacing.sm },
  iosSearch: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderColor: ios.separator,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    ...shadows.card,
  },
  iosSearchInput: { backgroundColor: "transparent", borderWidth: 0, flex: 1, marginBottom: 0, minHeight: 44, paddingHorizontal: 0 },
  filterBtn: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderColor: ios.separator,
    borderRadius: 14,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
    ...shadows.card,
  },

  statStrip: { flexDirection: "row", gap: 10, marginBottom: spacing.md },
  statCard: {
    backgroundColor: ios.card,
    borderRadius: radius.md,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
    ...shadows.card,
  },
  statIcon: {
    alignItems: "center",
    borderRadius: 10,
    height: 28,
    justifyContent: "center",
    marginBottom: 8,
    width: 28,
  },
  statValue: { color: ios.label, fontFamily: fonts.bold, fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  statLabel: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 11, marginTop: 2 },

  chipRow: { gap: 8, paddingBottom: spacing.sm },
  filterChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statusChip: { backgroundColor: ios.card, borderColor: "#E2E4EE" },
  statusChipOn: { backgroundColor: ios.navy, borderColor: ios.navy },
  statusChipText: { color: ios.secondary, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },
  statusChipTextOn: { color: "#FFFFFF" },
  categoryChip: { backgroundColor: ios.card, borderColor: "#E2E4EE" },
  categoryChipOn: { backgroundColor: ios.purpleSoft, borderColor: ios.purple },
  categoryChipText: { color: ios.secondary, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },
  categoryChipTextOn: { color: ios.purple },
  filterChipText: { fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },

  fab: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 18,
    bottom: 24,
    height: 58,
    justifyContent: "center",
    position: "absolute",
    right: 20,
    width: 58,
    zIndex: 20,
    ...shadows.floating,
  },

  iosHero: {
    backgroundColor: ios.dark,
    borderRadius: radius.xl,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  iosHeroOverline: { color: "rgba(255,255,255,0.55)", fontFamily: fonts.semibold, fontSize: 12, fontWeight: "600", letterSpacing: 0.4, textTransform: "uppercase" },
  iosHeroAmount: { color: "#FFFFFF", fontFamily: fonts.bold, fontSize: 34, fontWeight: "700", letterSpacing: -1, marginTop: 6 },
  iosHeroSub: { color: "rgba(255,255,255,0.65)", fontFamily: fonts.medium, fontSize: 14, marginTop: 4 },
  iosHeroPills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  iosHeroPill: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.pill,
    color: "#FFFFFF",
    fontFamily: fonts.semibold,
    fontSize: 12,
    fontWeight: "600",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  iosHeroCta: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  iosHeroCtaText: { color: ios.dark, fontFamily: fonts.semibold, fontSize: 15, fontWeight: "600" },

  iosSegment: {
    backgroundColor: ios.fill,
    borderRadius: radius.md,
    flexDirection: "row",
    marginBottom: spacing.sm,
    padding: 3,
  },
  iosSegmentItem: { alignItems: "center", borderRadius: radius.sm, flex: 1, minHeight: 34, justifyContent: "center" },
  iosSegmentItemOn: { backgroundColor: ios.card, ...shadows.card },
  iosSegmentText: { color: ios.secondary, fontFamily: fonts.semibold, fontSize: 13, fontWeight: "600" },
  iosSegmentTextOn: { color: ios.label },

  formSheet: { backgroundColor: ios.bg, flex: 1 },
  formSheetGrabRow: { alignItems: "center", paddingTop: 8 },
  formSheetHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  formSheetIcon: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  formSheetCopy: { flex: 1, paddingRight: spacing.sm },
  formSheetTitle: { color: ios.label, fontFamily: fonts.bold, fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  formSheetBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  formSheetCard: {
    backgroundColor: ios.card,
    borderRadius: 20,
    padding: spacing.md,
    ...shadows.card,
  },
  formSheetFooter: {
    backgroundColor: ios.card,
    borderTopColor: ios.separator,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  formSheetSave: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 52,
  },
  formSheetSaveText: { color: "#FFFFFF", fontFamily: fonts.semibold, fontSize: 16, fontWeight: "600" },

  input: {
    backgroundColor: ios.fill,
    borderColor: "transparent",
    borderRadius: 12,
    borderWidth: 1,
    color: ios.label,
    fontFamily: fonts.medium,
    fontSize: 15,
    fontWeight: "500",
    marginBottom: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputMultiline: { minHeight: 90, paddingTop: spacing.sm, textAlignVertical: "top" },
  inputFocused: { borderColor: ios.blue, backgroundColor: "#FFFFFF" },
  inputError: { borderColor: ios.red, backgroundColor: "#FFEBEA" },
  fieldError: { color: ios.red, fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, marginBottom: spacing.sm, marginTop: -4 },

  button: {
    alignItems: "center",
    backgroundColor: ios.blue,
    borderRadius: 14,
    justifyContent: "center",
    minHeight: 50,
    paddingHorizontal: spacing.md,
  },
  buttonContent: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  buttonSecondary: { backgroundColor: ios.fill, borderWidth: 0, elevation: 0 },
  buttonGhost: { backgroundColor: "transparent", elevation: 0 },
  buttonDanger: { backgroundColor: ios.red },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontFamily: fonts.semibold, fontSize: 15, fontWeight: "600", textAlign: "center" },
  buttonTextSecondary: { color: ios.label },
  buttonTextGhost: { color: ios.blue },

  emptyWrap: {
    alignItems: "center",
    backgroundColor: ios.card,
    borderRadius: radius.lg,
    justifyContent: "center",
    marginVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  emptyIconWrap: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: "center",
    marginBottom: spacing.sm,
    width: 48,
  },
  empty: { color: ios.secondary, fontSize: 14, fontWeight: "500", textAlign: "center" },

  badge: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    flexDirection: "row",
    alignItems: "center",
  },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },

  iconButton: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  searchFieldWrap: { justifyContent: "center", position: "relative" },
  searchFieldIcon: { left: spacing.md, position: "absolute", zIndex: 2 },
  searchFieldInput: { marginBottom: 0, paddingLeft: 42 },
  sheetBackdrop: { backgroundColor: "rgba(0, 0, 0, 0.45)", flex: 1, justifyContent: "flex-end" },
  sheetSafe: { maxHeight: "92%" },
  sheet: {
    backgroundColor: ios.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    ...shadows.overlay,
  },
  sheetHandle: {
    alignSelf: "center",
    backgroundColor: "#C7C7CC",
    borderRadius: radius.pill,
    height: 5,
    marginBottom: spacing.md,
    width: 40,
  },
  sheetHeader: { alignItems: "center", flexDirection: "row", gap: 12, marginBottom: spacing.md },
  sheetIconWrap: {
    alignItems: "center",
    backgroundColor: colors.blueSoft,
    borderRadius: 14,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  sheetCopy: { flex: 1, paddingRight: spacing.xs },
  sheetTitle: { color: ios.label, fontFamily: fonts.bold, fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  sheetHint: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 13, marginTop: 2 },
  sheetClose: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  sheetBody: { paddingBottom: spacing.sm },
  sheetFooter: { borderTopColor: ios.separator, borderTopWidth: StyleSheet.hairlineWidth, marginTop: spacing.sm, paddingTop: spacing.md },

  selectOption: {
    alignItems: "center",
    backgroundColor: ios.fill,
    borderRadius: 12,
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    minHeight: 52,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectOptionOn: {
    backgroundColor: colors.blueSoft,
    borderColor: ios.blue,
    borderWidth: 1.5,
  },
  selectOptionCopy: { flex: 1 },
  selectOptionLabel: { color: ios.label, fontFamily: fonts.semibold, fontSize: 15, fontWeight: "600" },
  selectOptionLabelOn: { color: ios.blue },
  selectOptionMeta: { color: ios.secondary, fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
});
