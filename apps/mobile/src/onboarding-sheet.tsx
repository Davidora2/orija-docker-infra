import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  completeOnboarding,
  getWealthMeta,
  listAreaSuggestions,
  type Account,
  type AreaSuggestion,
} from './api';
import { SUGGESTED_LIFE_AREAS } from './life-data';

const colors = {
  ink: '#14241F',
  canvas: '#F4F5F0',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  acid: '#D6F57A',
  danger: '#C9634F',
};

type Props = {
  visible: boolean;
  onComplete: (account: Account) => void;
  notify: (message: string) => void;
};

export function OnboardingSheet({ visible, onComplete, notify }: Props) {
  const insets = useSafeAreaInsets();
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>(
    SUGGESTED_LIFE_AREAS.map((area) => ({ title: area.title, icon: area.icon })),
  );
  const [selected, setSelected] = useState<Record<string, AreaSuggestion>>({});
  const [customTitle, setCustomTitle] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(['GBP', 'USD', 'CAD', 'EUR']);
  const [currency, setCurrency] = useState('GBP');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    void listAreaSuggestions()
      .then(setSuggestions)
      .catch(() => {
        // keep local defaults
      });
    void getWealthMeta()
      .then((meta) => {
        if (meta.currencies?.length) setCurrencies(meta.currencies);
      })
      .catch(() => {
        // keep defaults
      });
  }, [visible]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);

  function toggle(area: AreaSuggestion) {
    setSelected((current) => {
      const next = { ...current };
      if (next[area.title]) delete next[area.title];
      else next[area.title] = area;
      return next;
    });
  }

  function addCustom() {
    const title = customTitle.trim();
    if (!title) return;
    setSelected((current) => ({
      ...current,
      [title]: { title, icon: 'compass-outline' },
    }));
    setCustomTitle('');
  }

  async function finish() {
    if (selectedList.length === 0) {
      notify('Pick at least one life area to track.');
      return;
    }
    setBusy(true);
    try {
      const account = await completeOnboarding(selectedList, currency);
      onComplete(account);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save areas.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.eyebrow}>GET STARTED</Text>
        <Text style={styles.title}>What do you want to track?</Text>
        <Text style={styles.body}>
          Choose the life areas that matter now. You can add or remove them later.
        </Text>

        <ScrollView contentContainerStyle={styles.grid}>
          {suggestions.map((area) => {
            const active = Boolean(selected[area.title]);
            return (
              <Pressable
                key={area.title}
                onPress={() => toggle(area)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Ionicons
                  name={(area.icon as ComponentProps<typeof Ionicons>['name']) || 'compass-outline'}
                  size={16}
                  color={active ? colors.acid : colors.ink}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {area.title}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.customRow}>
          <TextInput
            style={styles.input}
            placeholder="Add your own area"
            placeholderTextColor="#9BA49E"
            value={customTitle}
            onChangeText={setCustomTitle}
          />
          <Pressable style={styles.addBtn} onPress={addCustom}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>

        {selectedList.length > 0 ? (
          <View style={styles.selectedBox}>
            <Text style={styles.selectedLabel}>Selected ({selectedList.length})</Text>
            {selectedList.map((area) => (
              <Pressable
                key={area.title}
                style={styles.selectedRow}
                onPress={() => toggle(area)}
              >
                <Text style={styles.selectedText}>{area.title}</Text>
                <Text style={styles.remove}>Remove</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.selectedBox}>
          <Text style={styles.selectedLabel}>Currency</Text>
          <Text style={styles.body}>
            Used for budgets, savings, and net worth.
          </Text>
          <View style={styles.grid}>
            {currencies.map((code) => (
              <Pressable
                key={code}
                onPress={() => setCurrency(code)}
                style={[styles.chip, currency === code && styles.chipActive]}
              >
                <Text
                  style={[
                    styles.chipText,
                    currency === code && styles.chipTextActive,
                  ]}
                >
                  {code}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Pressable
          style={[styles.cta, busy && styles.disabled, { marginBottom: insets.bottom + 16 }]}
          disabled={busy}
          onPress={() => void finish()}
        >
          <Text style={styles.ctaText}>
            {busy ? 'Saving…' : 'Continue to Life OS'}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 18 },
  eyebrow: {
    color: colors.sageDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 30,
    color: colors.ink,
    marginTop: 8,
  },
  body: { color: colors.muted, marginTop: 8, marginBottom: 16, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.acid },
  customRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
  },
  addBtn: {
    backgroundColor: colors.sage,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addBtnText: { color: colors.sageDeep, fontWeight: '700' },
  selectedBox: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    gap: 8,
    marginBottom: 12,
  },
  selectedLabel: { fontWeight: '700', color: colors.muted, fontSize: 12 },
  selectedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedText: { color: colors.ink, fontWeight: '600' },
  remove: { color: colors.danger, fontWeight: '700', fontSize: 12 },
  cta: {
    backgroundColor: colors.ink,
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: colors.paper, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
