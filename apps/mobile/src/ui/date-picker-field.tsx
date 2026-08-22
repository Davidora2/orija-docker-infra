import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  canonicalDateOnly,
  formatFriendlyDate,
  parseLocalDayKey,
  quickDateNextWeek,
  quickDateToday,
  quickDateTomorrow,
} from '@life-os/plan-domain';
import { LifeIcon } from '../life-icon';
import { colors } from './theme';

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  accessibilityLabel?: string;
};

function dateFromValue(value: string): Date {
  return parseLocalDayKey(value) ?? parseLocalDayKey(quickDateToday())!;
}

export function DatePickerField({
  label,
  value,
  onChange,
  required = false,
  disabled = false,
  error,
  accessibilityLabel,
}: Props) {
  const [iosOpen, setIosOpen] = useState(false);
  const [androidOpen, setAndroidOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(() => dateFromValue(value));

  const canonical = canonicalDateOnly(value);
  const summary = canonical ? formatFriendlyDate(canonical) : 'Pick a date';
  const showClear = !required && Boolean(canonical);

  const quickOptions = useMemo(
    () =>
      [
        { id: 'today', label: 'Today', date: quickDateToday() },
        { id: 'tomorrow', label: 'Tomorrow', date: quickDateTomorrow() },
        { id: 'next-week', label: 'Next week', date: quickDateNextWeek() },
      ] as const,
    [],
  );

  function applyDate(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    onChange(`${year}-${month}-${day}`);
  }

  function openPicker() {
    if (disabled) return;
    setIosDraft(dateFromValue(value));
    if (Platform.OS === 'android') {
      setAndroidOpen(true);
    } else {
      setIosOpen(true);
    }
  }

  function onAndroidChange(event: DateTimePickerEvent, date?: Date) {
    setAndroidOpen(false);
    if (event.type === 'set' && date) {
      applyDate(date);
    }
  }

  function confirmIos() {
    applyDate(iosDraft);
    setIosOpen(false);
  }

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityLabel={accessibilityLabel ?? label ?? 'Pick a date'}
        accessibilityRole="button"
        disabled={disabled}
        onPress={openPicker}
        style={({ pressed }) => [
          styles.trigger,
          disabled && styles.triggerDisabled,
          pressed && !disabled && styles.triggerPressed,
          error ? styles.triggerError : null,
        ]}
      >
        <LifeIcon name="calendar" size={18} color={colors.sageDeep} />
        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.2}
          style={[styles.summary, !canonical && styles.summaryPlaceholder]}
        >
          {summary}
        </Text>
      </Pressable>

      <View style={styles.quickRow}>
        {quickOptions.map((option) => (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityLabel={`Set date to ${option.label}`}
            disabled={disabled}
            onPress={() => onChange(option.date)}
            style={({ pressed }) => [
              styles.quickChip,
              canonical === option.date && styles.quickChipActive,
              pressed && styles.quickChipPressed,
            ]}
          >
            <Text
              allowFontScaling
              maxFontSizeMultiplier={1.2}
              style={[
                styles.quickChipText,
                canonical === option.date && styles.quickChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        ))}
        {showClear ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear date"
            disabled={disabled}
            onPress={() => onChange('')}
            style={({ pressed }) => [
              styles.quickChip,
              pressed && styles.quickChipPressed,
            ]}
          >
            <Text allowFontScaling maxFontSizeMultiplier={1.2} style={styles.quickChipText}>
              Clear
            </Text>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}

      {androidOpen ? (
        <DateTimePicker
          display="default"
          mode="date"
          onChange={onAndroidChange}
          value={dateFromValue(value)}
        />
      ) : null}

      <Modal
        animationType="slide"
        onRequestClose={() => setIosOpen(false)}
        transparent
        visible={iosOpen}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable
            accessibilityLabel="Close date picker"
            onPress={() => setIosOpen(false)}
            style={styles.sheetDismiss}
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIosOpen(false)}
                style={styles.sheetHeaderBtn}
              >
                <Text style={styles.sheetHeaderBtnText}>Cancel</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>Pick date</Text>
              <Pressable
                accessibilityRole="button"
                onPress={confirmIos}
                style={styles.sheetHeaderBtn}
              >
                <Text style={[styles.sheetHeaderBtnText, styles.sheetHeaderDone]}>
                  Done
                </Text>
              </Pressable>
            </View>
            <DateTimePicker
              display="spinner"
              mode="date"
              onChange={(_event, date) => {
                if (date) setIosDraft(date);
              }}
              style={styles.iosPicker}
              value={iosDraft}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  trigger: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  triggerDisabled: { opacity: 0.5 },
  triggerPressed: { opacity: 0.9 },
  triggerError: { borderColor: colors.danger },
  summary: {
    color: colors.ink,
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  summaryPlaceholder: { color: colors.muted, fontWeight: '500' },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  quickChipPressed: { opacity: 0.88 },
  quickChipText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  quickChipTextActive: { color: colors.acid },
  error: { color: colors.danger, fontSize: 12, fontWeight: '600' },
  sheetBackdrop: {
    backgroundColor: 'rgba(20,36,31,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetDismiss: { flex: 1 },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 24,
  },
  sheetHeader: {
    alignItems: 'center',
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sheetHeaderBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  sheetHeaderBtnText: { color: colors.muted, fontSize: 15, fontWeight: '600' },
  sheetHeaderDone: { color: colors.sageDeep, fontWeight: '700' },
  sheetTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  iosPicker: { height: 220 },
});
