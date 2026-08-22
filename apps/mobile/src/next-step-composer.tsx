import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { isValidDateOnly } from '@life-os/plan-domain';
import {
  PRIORITY_LEVELS,
  PRIORITY_LEVEL_META,
  PRIORITY_QUADRANT_META,
  quadrantFromLevels,
  quadrantRequiresScheduledDate,
  type PriorityLevel,
} from './priority-matrix';
import { AppButton } from './ui/button';
import { DatePickerField } from './ui/date-picker-field';
import { colors } from './ui/theme';

const ESTIMATE_PRESETS = [
  ['0.25', '15m'],
  ['0.5', '30m'],
  ['1', '1h'],
  ['2', '2h'],
] as const;

export type NextStepDraft = {
  title: string;
  hours: string;
  importance: PriorityLevel;
  urgency: PriorityLevel;
  scheduledDate: string;
  notes: string;
};

export const EMPTY_NEXT_STEP: NextStepDraft = {
  title: '',
  hours: '0.5',
  importance: 'HIGH',
  urgency: 'LOW',
  scheduledDate: '',
  notes: '',
};

type Props = {
  visible: boolean;
  busy?: boolean;
  projectTitle?: string;
  draft: NextStepDraft;
  onDraftChange: (draft: NextStepDraft) => void;
  onClose: () => void;
  onSave: () => void;
  notesOpen?: boolean;
  onNotesOpenChange?: (open: boolean) => void;
};

export function NextStepComposerModal({
  visible,
  busy = false,
  projectTitle,
  draft,
  onDraftChange,
  onClose,
  onSave,
  notesOpen = false,
  onNotesOpenChange,
}: Props) {
  const titleRef = useRef<TextInput>(null);
  const [scheduleError, setScheduleError] = useState('');

  const quadrant = quadrantFromLevels(draft.importance, draft.urgency);
  const scheduleRequired = quadrantRequiresScheduledDate(quadrant);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => titleRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [visible]);

  useEffect(() => {
    if (!scheduleRequired) setScheduleError('');
  }, [scheduleRequired]);

  function patch(partial: Partial<NextStepDraft>) {
    onDraftChange({ ...draft, ...partial });
  }

  function validateAndSave() {
    if (!draft.title.trim()) return;
    if (scheduleRequired && !isValidDateOnly(draft.scheduledDate)) {
      setScheduleError('Choose a date for Schedule');
      return;
    }
    setScheduleError('');
    onSave();
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Close" onPress={onClose} style={styles.dismiss} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <ScrollView
            contentContainerStyle={styles.sheet}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text style={styles.eyebrow}>Next step</Text>
            <Text style={styles.title}>Add next step</Text>
            {projectTitle ? (
              <Text style={styles.project}>{projectTitle}</Text>
            ) : null}
            <Text style={styles.hint}>
              One concrete physical action — the smallest move that starts momentum.
            </Text>

            <Text style={styles.label}>Action title</Text>
            <TextInput
              ref={titleRef}
              accessibilityLabel="Action title"
              editable={!busy}
              onChangeText={(title) => patch({ title })}
              placeholder="What will you do next?"
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={draft.title}
            />

            <Text style={styles.label}>Estimate</Text>
            <View style={styles.chipRow}>
              {ESTIMATE_PRESETS.map(([value, label]) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  onPress={() => patch({ hours: value })}
                  style={[
                    styles.chip,
                    draft.hours === value && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      draft.hours === value && styles.chipTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
              <TextInput
                accessibilityLabel="Custom estimate hours"
                editable={!busy}
                keyboardType="decimal-pad"
                onChangeText={(hours) => patch({ hours })}
                placeholder="Custom"
                placeholderTextColor={colors.muted}
                style={styles.customHours}
                value={draft.hours}
              />
            </View>

            <Text style={styles.label}>Importance</Text>
            <View style={styles.chipRow}>
              {PRIORITY_LEVELS.map((level) => (
                <Pressable
                  key={level}
                  accessibilityRole="button"
                  onPress={() => patch({ importance: level })}
                  style={[
                    styles.chip,
                    draft.importance === level && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      draft.importance === level && styles.chipTextActive,
                    ]}
                  >
                    {PRIORITY_LEVEL_META[level].title}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Urgency</Text>
            <View style={styles.chipRow}>
              {PRIORITY_LEVELS.map((level) => (
                <Pressable
                  key={level}
                  accessibilityRole="button"
                  onPress={() => patch({ urgency: level })}
                  style={[
                    styles.chip,
                    draft.urgency === level && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      draft.urgency === level && styles.chipTextActive,
                    ]}
                  >
                    {PRIORITY_LEVEL_META[level].title}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.meta}>
              Matrix: {PRIORITY_QUADRANT_META[quadrant].title}
            </Text>

            {scheduleRequired ? (
              <DatePickerField
                error={scheduleError}
                label="Schedule date (required)"
                onChange={(scheduledDate) => {
                  patch({ scheduledDate });
                  if (scheduleError && isValidDateOnly(scheduledDate)) {
                    setScheduleError('');
                  }
                }}
                required
                value={draft.scheduledDate}
              />
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={() => onNotesOpenChange?.(!notesOpen)}
              style={styles.notesToggle}
            >
              <Text style={styles.notesToggleText}>
                {notesOpen ? 'Hide notes' : 'Add notes (optional)'}
              </Text>
            </Pressable>
            {notesOpen ? (
              <TextInput
                accessibilityLabel="Notes"
                editable={!busy}
                multiline
                onChangeText={(notes) => patch({ notes })}
                placeholder="Context or links"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.notesInput]}
                value={draft.notes}
              />
            ) : null}

            <View style={styles.actions}>
              <AppButton onPress={onClose} style={{ flex: 1 }} variant="secondary">
                Cancel
              </AppButton>
              <AppButton
                disabled={busy || !draft.title.trim()}
                onPress={validateAndSave}
                style={{ flex: 1 }}
                variant="acid"
              >
                Add next step
              </AppButton>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(20,36,31,0.45)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  dismiss: { flex: 1 },
  sheetWrap: { maxHeight: '92%' },
  sheet: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    gap: 10,
    padding: 18,
    paddingBottom: 28,
  },
  eyebrow: {
    color: colors.sageDeep,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 26,
  },
  project: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 15,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: '700' },
  chipTextActive: { color: colors.acid },
  customHours: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    minHeight: 36,
    minWidth: 72,
    paddingHorizontal: 12,
    textAlign: 'center',
  },
  meta: { color: colors.muted, fontSize: 12 },
  notesToggle: { minHeight: 44, justifyContent: 'center' },
  notesToggleText: { color: colors.sageDeep, fontSize: 13, fontWeight: '700' },
  notesInput: { minHeight: 88, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
