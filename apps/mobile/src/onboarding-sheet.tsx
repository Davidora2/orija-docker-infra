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
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  completeOnboarding,
  createLifeItem,
  getWealthMeta,
  listAreaSuggestions,
  type Account,
  type AreaSuggestion,
} from './api';
import { SUGGESTED_LIFE_AREAS, WEEK_DAYS } from './life-data';
import { LifeIcon, lifeIconFromLegacy } from './life-icon';
import { FocusHero } from './ui';

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

type Step =
  | 'welcome'
  | 'areas'
  | 'capacity'
  | 'ideas'
  | 'project'
  | 'action'
  | 'payoff';

type Props = {
  visible: boolean;
  onComplete: (account: Account) => void;
  notify: (message: string) => void;
};

export function OnboardingSheet({ visible, onComplete, notify }: Props) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('welcome');
  const [suggestions, setSuggestions] = useState<AreaSuggestion[]>(
    SUGGESTED_LIFE_AREAS.map((area) => ({ title: area.title, icon: area.icon })),
  );
  const [selected, setSelected] = useState<Record<string, AreaSuggestion>>({});
  const [customTitle, setCustomTitle] = useState('');
  const [currencies, setCurrencies] = useState<string[]>(['GBP', 'USD', 'CAD', 'EUR']);
  const [currency, setCurrency] = useState('GBP');
  const [capacityHours, setCapacityHours] = useState('11');
  const [ideaDump, setIdeaDump] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionHours, setActionHours] = useState('2');
  const [actionDay, setActionDay] = useState<string>('Fri');
  const [busy, setBusy] = useState(false);
  const [accountSnapshot, setAccountSnapshot] = useState<Account | null>(null);

  useEffect(() => {
    if (!visible) return;
    setStep('welcome');
    void listAreaSuggestions()
      .then(setSuggestions)
      .catch(() => undefined);
    void getWealthMeta()
      .then((meta) => {
        if (meta.currencies?.length) setCurrencies(meta.currencies);
      })
      .catch(() => undefined);
  }, [visible]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const progress =
    (
      {
        welcome: 1,
        areas: 2,
        capacity: 3,
        ideas: 4,
        project: 5,
        action: 6,
        payoff: 7,
      } as const
    )[step] / 7;

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

  async function finishMinimum(): Promise<Account | null> {
    if (selectedList.length === 0) {
      notify('Pick at least one life area to track.');
      setStep('areas');
      return null;
    }
    setBusy(true);
    try {
      const account = await completeOnboarding(selectedList, currency);
      const hours = Number(capacityHours);
      await createLifeItem({
        kind: 'VISION',
        title: 'Weekly capacity',
        body: {
          availableHours: Number.isFinite(hours) && hours > 0 ? hours : 11,
        },
        sortOrder: 100,
      });
      setAccountSnapshot(account);
      return account;
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save onboarding.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function saveAreasAndContinue() {
    if (selectedList.length === 0) {
      notify('Pick at least one life area.');
      return;
    }
    if (selectedList.length >= 8) {
      notify('Eight or more areas can feel noisy — 3–5 is a calm start.');
    }
    setBusy(true);
    try {
      const account = await completeOnboarding(selectedList, currency);
      setAccountSnapshot(account);
      setStep('capacity');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save areas.');
    } finally {
      setBusy(false);
    }
  }

  async function saveCapacityAndContinue() {
    setBusy(true);
    try {
      const hours = Number(capacityHours);
      await createLifeItem({
        kind: 'VISION',
        title: 'Weekly capacity',
        body: {
          availableHours: Number.isFinite(hours) && hours > 0 ? hours : 11,
        },
        sortOrder: 100,
      });
      setStep('ideas');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save capacity.');
    } finally {
      setBusy(false);
    }
  }

  async function saveIdeasAndContinue() {
    const lines = ideaDump
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    setBusy(true);
    try {
      for (const title of lines.slice(0, 8)) {
        await createLifeItem({
          kind: 'IDEA',
          title,
          body: { impact: 0, effort: 0, alignment: 0, timing: 0 },
        });
      }
      if (lines[0]) setProjectTitle(lines[0]);
      setStep('project');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save ideas.');
    } finally {
      setBusy(false);
    }
  }

  async function saveProjectPath(skip: boolean) {
    if (skip) {
      setStep('payoff');
      return;
    }
    if (!projectTitle.trim()) {
      notify('Name the project, or skip for now.');
      return;
    }
    setActionTitle((current) => current || `Advance: ${projectTitle.trim()}`);
    setStep('action');
  }

  async function saveActionAndPayoff(skip: boolean) {
    if (skip) {
      setStep('payoff');
      return;
    }
    if (!actionTitle.trim()) {
      notify('Add a first action, or skip.');
      return;
    }
    setBusy(true);
    try {
      const project = await createLifeItem({
        kind: 'PROJECT',
        title: projectTitle.trim() || actionTitle.trim(),
        body: { outcome: 'Started in onboarding' },
      });
      const hours = Number(actionHours);
      await createLifeItem({
        kind: 'ACTION',
        title: actionTitle.trim(),
        parentId: project.id,
        body: {
          hours: Number.isFinite(hours) && hours > 0 ? hours : 2,
          day: actionDay,
        },
      });
      setStep('payoff');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save first action.');
    } finally {
      setBusy(false);
    }
  }

  async function landOnToday() {
    if (accountSnapshot) {
      onComplete(accountSnapshot);
      return;
    }
    await finishMinimum();
    if (accountSnapshot) onComplete(accountSnapshot);
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>

        {step === 'welcome' ? (
          <View style={styles.step}>
            <FocusHero
              accentDot
              eyebrow="Life OS"
              meta="Choose life areas, set weekly capacity, capture ideas, and land on your primary move."
              title="About two minutes to a usable Today."
            />
            <Pressable style={styles.ctaAcid} onPress={() => setStep('areas')}>
              <Text style={styles.ctaAcidText}>Get started</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryCta}
              onPress={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const account = await completeOnboarding(
                      [{ title: 'Life', icon: 'compass-outline' }],
                      currency,
                    );
                    await createLifeItem({
                      kind: 'VISION',
                      title: 'Weekly capacity',
                      body: { availableHours: 11 },
                      sortOrder: 100,
                    });
                    notify('Setup saved lightly — refine areas anytime under Plan.');
                    onComplete(account);
                  } catch (error) {
                    notify(
                      error instanceof Error
                        ? error.message
                        : 'Could not skip setup.',
                    );
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              <Text style={styles.secondaryCtaText}>I&apos;ll set this up later</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'areas' ? (
          <View style={styles.step}>
            <Text style={styles.eyebrow}>AREAS</Text>
            <Text style={styles.title}>What do you want to track?</Text>
            <Text style={styles.body}>
              Recommend 3–5. You need at least one to continue.
              {selectedList.length >= 8
                ? ' Eight or more can feel noisy.'
                : ''}
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
                    <LifeIcon
                      name={lifeIconFromLegacy(area.icon)}
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
            <Text style={styles.label}>Currency</Text>
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
            <Pressable
              style={[styles.cta, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void saveAreasAndContinue()}
            >
              <Text style={styles.ctaText}>{busy ? 'Saving…' : 'Continue'}</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'capacity' ? (
          <View style={styles.step}>
            <Text style={styles.eyebrow}>CAPACITY</Text>
            <Text style={styles.title}>How many hours can you give this week?</Text>
            <Text style={styles.body}>
              A sensible default is fine — you can edit this later under You → Capacity.
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              value={capacityHours}
              onChangeText={setCapacityHours}
              placeholder="11"
              placeholderTextColor="#9BA49E"
            />
            <Pressable
              style={[styles.cta, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void saveCapacityAndContinue()}
            >
              <Text style={styles.ctaText}>{busy ? 'Saving…' : 'Continue'}</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryCta}
              onPress={() => {
                setCapacityHours('11');
                void saveCapacityAndContinue();
              }}
            >
              <Text style={styles.secondaryCtaText}>Use default 11h</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'ideas' ? (
          <View style={styles.step}>
            <Text style={styles.eyebrow}>CAPTURE</Text>
            <Text style={styles.title}>Dump a few ideas</Text>
            <Text style={styles.body}>
              One per line. No classification needed — you can evaluate later.
            </Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              multiline
              value={ideaDump}
              onChangeText={setIdeaDump}
              placeholder={'Learn Spanish\nFix evening routine\nShip side project'}
              placeholderTextColor="#9BA49E"
            />
            <Pressable
              style={[styles.cta, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void saveIdeasAndContinue()}
            >
              <Text style={styles.ctaText}>{busy ? 'Saving…' : 'Continue'}</Text>
            </Pressable>
            <Pressable style={styles.secondaryCta} onPress={() => setStep('project')}>
              <Text style={styles.secondaryCtaText}>Skip for now</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'project' ? (
          <View style={styles.step}>
            <Text style={styles.eyebrow}>PROJECT</Text>
            <Text style={styles.title}>Turn one idea into a project</Text>
            <Text style={styles.body}>
              Projects need several steps. A single next move can stay as an action.
            </Text>
            <TextInput
              style={styles.input}
              value={projectTitle}
              onChangeText={setProjectTitle}
              placeholder="Project title"
              placeholderTextColor="#9BA49E"
            />
            <Pressable
              style={styles.cta}
              onPress={() => void saveProjectPath(false)}
            >
              <Text style={styles.ctaText}>Continue</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryCta}
              onPress={() => void saveProjectPath(true)}
            >
              <Text style={styles.secondaryCtaText}>Skip</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'action' ? (
          <View style={styles.step}>
            <Text style={styles.eyebrow}>FIRST ACTION</Text>
            <Text style={styles.title}>What is the next concrete move?</Text>
            <Text style={styles.body}>
              Estimate hours and pick a day this week — keep it light.
            </Text>
            <TextInput
              style={styles.input}
              value={actionTitle}
              onChangeText={setActionTitle}
              placeholder="First next action"
              placeholderTextColor="#9BA49E"
            />
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              keyboardType="decimal-pad"
              value={actionHours}
              onChangeText={setActionHours}
              placeholder="Hours"
              placeholderTextColor="#9BA49E"
            />
            <View style={[styles.grid, { marginTop: 10 }]}>
              {WEEK_DAYS.map((day) => (
                <Pressable
                  key={day}
                  onPress={() => setActionDay(day)}
                  style={[styles.chip, actionDay === day && styles.chipActive]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      actionDay === day && styles.chipTextActive,
                    ]}
                  >
                    {day}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              style={[styles.cta, busy && styles.disabled]}
              disabled={busy}
              onPress={() => void saveActionAndPayoff(false)}
            >
              <Text style={styles.ctaText}>{busy ? 'Saving…' : 'Continue'}</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryCta}
              onPress={() => void saveActionAndPayoff(true)}
            >
              <Text style={styles.secondaryCtaText}>Skip</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'payoff' ? (
          <View style={[styles.step, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.eyebrow}>READY</Text>
            <Text style={styles.title}>You are set for Today.</Text>
            <Text style={styles.body}>
              Available, planned, and remaining hours will show on Today with your
              primary move when actions exist.
            </Text>
            <Pressable
              style={[styles.cta, busy && styles.disabled]}
              disabled={busy}
              onPress={() => {
                void (async () => {
                  if (accountSnapshot) {
                    onComplete(accountSnapshot);
                    return;
                  }
                  const account = await finishMinimum();
                  if (account) onComplete(account);
                })();
              }}
            >
              <Text style={styles.ctaText}>Open Today</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas, paddingHorizontal: 18 },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.line,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: { height: '100%', backgroundColor: colors.acid },
  step: { flex: 1, gap: 12 },
  eyebrow: {
    color: colors.sageDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 28,
    color: colors.ink,
    marginTop: 8,
  },
  body: { color: colors.muted, marginTop: 8, marginBottom: 16, lineHeight: 20 },
  label: {
    color: colors.muted,
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
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
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  addBtn: {
    backgroundColor: colors.sage,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addBtnText: { color: colors.sageDeep, fontWeight: '700' },
  cta: {
    backgroundColor: colors.ink,
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaAcid: {
    backgroundColor: colors.acid,
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: { color: colors.paper, fontWeight: '700' },
  ctaAcidText: { color: colors.ink, fontWeight: '700' },
  secondaryCta: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  secondaryCtaText: { color: colors.sageDeep, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
