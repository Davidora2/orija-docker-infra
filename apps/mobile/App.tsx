import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccountSheet } from './src/account-sheet';
import { BudgetScreen } from './src/budget-screen';
import { CalendarScreen } from './src/calendar-screen';
import { CapacityRing } from './src/capacity-ring';
import { IntegrationsScreen } from './src/integrations-screen';
import { LifeIcon } from './src/life-icon';
import { OnboardingSheet } from './src/onboarding-sheet';
import {
  ApiError,
  createLifeItem,
  deleteLifeItem,
  getAccount,
  loadSession,
  moveProjectToIdea,
  pingApi,
  syncPendingChanges,
  updateLifeItem,
  type Account,
  type LifeItem,
} from './src/api';
import {
  loadCachedAccount,
  loadCachedItems,
  setSyncPhase,
  subscribeSyncStatus,
} from './src/offline';
import { PlanScreen } from './src/plan-screen';
import { SwipeableRow } from './src/swipeable-row';
import { WeeklyReviewScreen } from './src/weekly-review-screen';
import {
  WEEK_DAYS,
  bodyNumber,
  bodyString,
  isOpen,
  ofKind,
  primaryAction,
  projectRisks,
  refreshAllItems,
  supportingActions,
  weeklyCapacityHours,
} from './src/life-data';
import {
  PRIORITY_LEVELS,
  PRIORITY_LEVEL_META,
  PRIORITY_QUADRANT_META,
  actionBodyWithLevels,
  actionBodyWithScheduledDate,
  actionMeetsScheduleDateRequirement,
  actionPriorityQuadrant,
  actionScheduledDate,
  levelsFromQuadrant,
  projectBodyWithPriority,
  projectBodyWithTargetDate,
  projectPriorityFromImportance,
  projectPriorityLevel,
  quadrantFromLevels,
  quadrantRequiresScheduledDate,
  toggledActionStatus,
  type PriorityLevel,
  type PriorityQuadrant,
  type ProjectPriority,
} from './src/priority-matrix';

const colors = {
  ink: '#14241F',
  inkSoft: '#24362F',
  canvas: '#F4F5F0',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  acid: '#D6F57A',
  acidInk: '#2F431E',
  amber: '#F2C66D',
  amberSoft: '#FFF3E8',
  danger: '#C9634F',
};

const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
});

type Tab = 'today' | 'plan' | 'calendar' | 'money' | 'you';
type PlanSegment = 'priority' | 'areas' | 'projects' | 'ideas';
type YouDest = 'menu' | 'capacity' | 'review' | 'household' | 'integrations' | 'settings';
type FabKind = 'idea' | 'action' | 'project' | 'spend';

function tap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== 'web') void Haptics.impactAsync(style);
}

function successTap() {
  if (Platform.OS !== 'web') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

function Button({
  children,
  onPress,
  variant = 'primary',
  style,
  disabled,
}: {
  children: ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'acid' | 'ghost';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'acid' && styles.buttonAcid,
        variant === 'ghost' && styles.buttonGhost,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled,
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          style={[
            styles.buttonText,
            variant === 'secondary' && styles.buttonTextSecondary,
            variant === 'acid' && styles.buttonTextAcid,
            variant === 'ghost' && styles.buttonTextGhost,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

function Pill({
  children,
  tone = 'sage',
}: {
  children: ReactNode;
  tone?: 'sage' | 'amber' | 'ink' | 'danger';
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'amber' && styles.pillAmber,
        tone === 'ink' && styles.pillInk,
        tone === 'danger' && styles.pillDanger,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          tone === 'amber' && styles.pillTextAmber,
          tone === 'ink' && styles.pillTextInk,
          tone === 'danger' && styles.pillTextDanger,
        ]}
      >
        {children}
      </Text>
    </View>
  );
}

function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function ProgressBar({ value, warning = false }: { value: number; warning?: boolean }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.min(Math.max(value, 0), 100)}%` },
          warning && styles.progressFillWarning,
        ]}
      />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        keyboardType={keyboardType}
        style={[styles.input, multiline && styles.inputMultiline]}
      />
    </View>
  );
}

function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <Card style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </Card>
  );
}

function firstName(account: Account | null): string {
  return account?.user.displayName?.trim().split(/\s+/)[0] || 'there';
}

function todayLabel(): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date());
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const incomingUrl = Linking.useURL();
  const [tab, setTab] = useState<Tab>('today');
  const [planSegment, setPlanSegment] = useState<PlanSegment>('priority');
  const [preferPriorityMatrix, setPreferPriorityMatrix] = useState(false);
  const [priorityTipDismissed, setPriorityTipDismissed] = useState(false);
  const [youDest, setYouDest] = useState<YouDest>('menu');
  const [fabKind, setFabKind] = useState<FabKind>('action');
  const [account, setAccount] = useState<Account | null>(null);
  const [items, setItems] = useState<LifeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [online, setOnline] = useState(true);
  const [accountOpen, setAccountOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [captureOpen, setCaptureOpen] = useState(false);
  const [schedulePrompt, setSchedulePrompt] = useState<{
    action: LifeItem;
    quadrant: PriorityQuadrant;
  } | null>(null);
  const [scheduleDateDraft, setScheduleDateDraft] = useState('');
  const [actionMoreOpen, setActionMoreOpen] = useState(false);
  const [ideaTitle, setIdeaTitle] = useState('');
  const [ideaNote, setIdeaNote] = useState('');
  const [ideaPillarId, setIdeaPillarId] = useState<string | null>(null);
  const [quickActionProjectId, setQuickActionProjectId] = useState<string | null>(
    null,
  );
  const [quickActionImportance, setQuickActionImportance] = useState<PriorityLevel>('HIGH');
  const [quickActionUrgency, setQuickActionUrgency] = useState<PriorityLevel>('LOW');

  const [projectOpen, setProjectOpen] = useState(false);
  const [projectTitle, setProjectTitle] = useState('');
  const [projectOutcome, setProjectOutcome] = useState('');
  const [projectPillarId, setProjectPillarId] = useState<string | null>(null);
  const [projectTargetDate, setProjectTargetDate] = useState('');
  const [actionTitle, setActionTitle] = useState('');
  const [actionHours, setActionHours] = useState('2');
  const [actionDay, setActionDay] = useState<string>('Fri');
  const [captureScheduleDate, setCaptureScheduleDate] = useState('');
  const [actionImportance, setActionImportance] =
    useState<PriorityLevel>('HIGH');
  const [actionUrgency, setActionUrgency] = useState<PriorityLevel>('LOW');
  const [actionScheduleDate, setActionScheduleDate] = useState('');
  const [sourceIdeaId, setSourceIdeaId] = useState<string | null>(null);
  const [stickyPrimaryId, setStickyPrimaryId] = useState<string | null>(null);

  const [evaluateId, setEvaluateId] = useState<string | null>(null);
  const [impact, setImpact] = useState(7);
  const [effort, setEffort] = useState(4);
  const [alignment, setAlignment] = useState(8);
  const [timing, setTiming] = useState(6);

  const [availableHoursInput, setAvailableHoursInput] = useState('11');
  const [areaTitle, setAreaTitle] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const needsOnboarding = Boolean(
    account && !account.user.onboardingCompletedAt,
  );

  const notify = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2800);
  }, []);

  const applyVisionHours = useCallback((nextItems: LifeItem[]) => {
    const vision = ofKind(nextItems, 'VISION').find((item) =>
      Object.prototype.hasOwnProperty.call(item.body, 'availableHours'),
    );
    if (vision) {
      setAvailableHoursInput(String(bodyNumber(vision, 'availableHours', 11)));
    }
  }, []);

  const flushSync = useCallback(async () => {
    const reachable = await pingApi();
    if (!reachable) {
      setOnline(false);
      await setSyncPhase('offline');
      return;
    }
    setOnline(true);
    await syncPendingChanges((nextItems) => {
      setItems(nextItems);
      applyVisionHours(nextItems);
    });
  }, [applyVisionHours]);

  const load = useCallback(
    async (mode: 'boot' | 'refresh' = 'boot') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      try {
        const reachable = await pingApi();
        setOnline(reachable);
        if (!reachable) await setSyncPhase('offline');

        const nextAccount = await getAccount();
        setAccount(nextAccount);
        if (!nextAccount) {
          const session = await loadSession();
          const cachedAccount = await loadCachedAccount();
          if (session && cachedAccount) {
            setAccount(cachedAccount);
            const cachedItems = (await loadCachedItems()) ?? [];
            setItems(cachedItems);
            applyVisionHours(cachedItems);
            setOnline(false);
            await setSyncPhase('offline');
            return;
          }
          setItems([]);
          setAccountOpen(true);
          return;
        }
        try {
          const nextItems = await refreshAllItems();
          setItems(nextItems);
          applyVisionHours(nextItems);
        } catch (error) {
          if (error instanceof ApiError && error.status === 401) throw error;
          const cachedItems = (await loadCachedItems()) ?? [];
          setItems(cachedItems);
          applyVisionHours(cachedItems);
          setOnline(false);
          await setSyncPhase('offline');
        }
        if (reachable) {
          void flushSync();
        }
      } catch (error) {
        setOnline(false);
        await setSyncPhase('offline');
        if (error instanceof ApiError && error.status === 401) {
          setAccount(null);
          setItems([]);
          setAccountOpen(true);
        } else {
          const session = await loadSession();
          const cachedAccount = await loadCachedAccount();
          const cachedItems = (await loadCachedItems()) ?? [];
          if (session && cachedAccount) {
            setAccount(cachedAccount);
            setItems(cachedItems);
            applyVisionHours(cachedItems);
          } else {
            notify(
              error instanceof Error
                ? error.message
                : 'Could not load Life OS data.',
            );
          }
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [applyVisionHours, flushSync, notify],
  );

  useEffect(() => {
    void load('boot');
  }, [load]);

  useEffect(() => {
    void AsyncStorage.getItem('life-os-priority-tip-dismissed').then((value) => {
      if (value === '1') setPriorityTipDismissed(true);
    });
  }, []);

  useEffect(() => {
    return subscribeSyncStatus((phase) => {
      setOnline(phase !== 'offline');
    });
  }, []);

  useEffect(() => {
    if (!online) return;
    const timer = setInterval(() => {
      void flushSync().catch(() => undefined);
    }, 20_000);
    return () => clearInterval(timer);
  }, [online, flushSync]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!incomingUrl) return;
    try {
      const parsed = Linking.parse(incomingUrl);
      const token =
        typeof parsed.queryParams?.token === 'string'
          ? parsed.queryParams.token
          : null;
      if (token) {
        setInviteToken(token);
        setAccountOpen(true);
      }
    } catch {
      // ignore malformed deep links
    }
  }, [incomingUrl]);

  const pillars = useMemo(() => ofKind(items, 'PILLAR').filter(isOpen), [items]);
  const projects = useMemo(
    () =>
      ofKind(items, 'PROJECT').filter(
        (item) => item.status !== 'ARCHIVED' && item.status !== 'CONVERTED',
      ),
    [items],
  );
  const actions = useMemo(() => ofKind(items, 'ACTION'), [items]);
  const doneActions = useMemo(
    () => actions.filter((item) => item.status === 'DONE'),
    [actions],
  );
  const capacity = useMemo(() => weeklyCapacityHours(items), [items]);
  const rankedPrimary = useMemo(() => primaryAction(items), [items]);
  const primary = useMemo(() => {
    if (stickyPrimaryId) {
      const sticky = items.find((item) => item.id === stickyPrimaryId);
      if (sticky && sticky.kind === 'ACTION' && sticky.status === 'DONE') {
        return sticky;
      }
    }
    return rankedPrimary;
  }, [stickyPrimaryId, items, rankedPrimary]);
  const supporting = useMemo(
    () => supportingActions(items, primary?.id),
    [items, primary?.id],
  );

  useEffect(() => {
    if (!stickyPrimaryId) return;
    const sticky = items.find((item) => item.id === stickyPrimaryId);
    if (!sticky || sticky.status !== 'DONE') {
      setStickyPrimaryId(null);
    }
  }, [items, stickyPrimaryId]);
  const risks = useMemo(() => projectRisks(items), [items]);

  async function run(label: string, work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
      successTap();
    } catch (error) {
      notify(
        error instanceof Error ? error.message : `${label} failed. Try again.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function reloadItems() {
    const nextItems = await refreshAllItems();
    setItems(nextItems);
  }

  async function saveIdea() {
    if (!ideaTitle.trim()) {
      notify('Give the idea a title.');
      return;
    }
    await run('Save idea', async () => {
      await createLifeItem({
        kind: 'IDEA',
        title: ideaTitle.trim(),
        parentId: ideaPillarId,
        body: {
          note: ideaNote.trim(),
          impact: 0,
          effort: 0,
          alignment: 0,
          timing: 0,
        },
      });
      setIdeaTitle('');
      setIdeaNote('');
      setIdeaPillarId(null);
      setCaptureOpen(false);
      await reloadItems();
      setTab('plan');
      setPlanSegment('ideas');
      notify('Idea saved to your account.');
    });
  }

  async function saveEvaluation() {
    if (!evaluateId) return;
    await run('Evaluate idea', async () => {
      const existing = items.find((item) => item.id === evaluateId);
      if (!existing) throw new Error('Idea not found.');
      await updateLifeItem(evaluateId, {
        status: 'EVALUATED',
        body: {
          ...existing.body,
          impact,
          effort,
          alignment,
          timing,
          score: impact + alignment + timing - effort,
        },
      });
      setEvaluateId(null);
      await reloadItems();
      notify('Evaluation saved.');
    });
  }

  function openConvert(idea: LifeItem) {
    setSourceIdeaId(idea.id);
    setProjectTitle(idea.title);
    setProjectOutcome(bodyString(idea, 'note'));
    setProjectPillarId(idea.parentId);
    setProjectTargetDate('');
    setActionTitle(`Next: ${idea.title}`);
    setActionHours('2');
    setActionDay('Fri');
    setActionImportance('HIGH');
    setActionUrgency('LOW');
    setProjectOpen(true);
  }

  async function saveProject() {
    if (!projectTitle.trim()) {
      notify('Project needs a title.');
      return;
    }
    if (!actionTitle.trim()) {
      notify('Add a first next action.');
      return;
    }
    const hours = Number(actionHours);
    if (!Number.isFinite(hours) || hours <= 0) {
      notify('Action hours must be a positive number.');
      return;
    }
    await run('Create project', async () => {
      const project = await createLifeItem({
        kind: 'PROJECT',
        title: projectTitle.trim(),
        parentId: projectPillarId,
        body: projectBodyWithPriority(
          projectBodyWithTargetDate(
            {
              outcome: projectOutcome.trim(),
              fromIdeaId: sourceIdeaId,
            },
            projectTargetDate.trim() || null,
          ),
          projectPriorityFromImportance(actionImportance),
        ),
      });
      const createQuadrant = quadrantFromLevels(
        actionImportance,
        actionUrgency,
      );
      let actionBody: Record<string, unknown> = {
        hours,
        day: actionDay,
      };
      if (quadrantRequiresScheduledDate(createQuadrant)) {
        const date = actionScheduleDate.trim() || projectTargetDate.trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          throw new Error(
            'Schedule actions need a date — set the schedule date (YYYY-MM-DD).',
          );
        }
        actionBody = actionBodyWithScheduledDate(actionBody, date);
      }
      await createLifeItem({
        kind: 'ACTION',
        title: actionTitle.trim(),
        parentId: project.id,
        body: actionBodyWithLevels(
          actionBody,
          actionImportance,
          actionUrgency,
        ),
      });
      if (sourceIdeaId) {
        await updateLifeItem(sourceIdeaId, { status: 'CONVERTED' });
      }
      setProjectOpen(false);
      setSourceIdeaId(null);
      setProjectTitle('');
      setProjectOutcome('');
      setProjectTargetDate('');
      setActionTitle('');
      setActionScheduleDate('');
      setActionImportance('HIGH');
      setActionUrgency('LOW');
      await reloadItems();
      setTab('plan');
      setPlanSegment('projects');
      notify('Project and next action saved.');
    });
  }

  async function moveProjectPriority(project: LifeItem, priority: ProjectPriority) {
    await run('Update priority', async () => {
      await updateLifeItem(project.id, {
        body: projectBodyWithPriority(project.body, priority),
      });
      await reloadItems();
    });
  }

  async function moveActionQuadrant(action: LifeItem, quadrant: PriorityQuadrant) {
    if (
      quadrantRequiresScheduledDate(quadrant) &&
      !actionMeetsScheduleDateRequirement(action.body, quadrant)
    ) {
      setScheduleDateDraft(actionScheduledDate(action.body) ?? '');
      setSchedulePrompt({ action, quadrant });
      return;
    }
    await run('Update action priority', async () => {
      const { importance, urgency } = levelsFromQuadrant(quadrant);
      await updateLifeItem(action.id, {
        body: actionBodyWithLevels(action.body, importance, urgency),
      });
      await reloadItems();
    });
  }

  async function confirmSchedulePrompt() {
    if (!schedulePrompt) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduleDateDraft)) {
      notify('Schedule requires a date (YYYY-MM-DD).');
      return;
    }
    const { action, quadrant } = schedulePrompt;
    const { importance, urgency } = levelsFromQuadrant(quadrant);
    await run('Schedule action', async () => {
      await updateLifeItem(action.id, {
        body: actionBodyWithLevels(
          actionBodyWithScheduledDate(action.body, scheduleDateDraft),
          importance,
          urgency,
        ),
      });
      await reloadItems();
      setSchedulePrompt(null);
      setScheduleDateDraft('');
      notify('Action scheduled.');
    });
  }

  function openQuickCapture(
    kind: FabKind = 'action',
    projectId?: string | null,
  ) {
    setFabKind(kind);
    setActionMoreOpen(false);
    setIdeaTitle('');
    setIdeaNote('');
    setIdeaPillarId(null);
    setQuickActionProjectId(
      projectId !== undefined
        ? projectId
        : (projects.find((item) => isOpen(item))?.id ?? null),
    );
    setQuickActionImportance('HIGH');
    setQuickActionUrgency('LOW');
    setActionHours('1');
    setActionDay('Fri');
    setCaptureOpen(true);
  }

  async function completeAction(action: LifeItem) {
    const nextStatus = toggledActionStatus(action.status);
    await run(
      nextStatus === 'DONE' ? 'Complete action' : 'Reopen action',
      async () => {
        await updateLifeItem(action.id, { status: nextStatus });
        await reloadItems();
        if (nextStatus === 'DONE' && primary?.id === action.id) {
          setStickyPrimaryId(action.id);
        } else if (nextStatus !== 'DONE' && stickyPrimaryId === action.id) {
          setStickyPrimaryId(null);
        }
        notify(
          nextStatus === 'DONE' ? 'Action completed.' : 'Action reopened.',
        );
      },
    );
  }

  async function updateActionHours(action: LifeItem, nextHours: number) {
    await run('Update action hours', async () => {
      const hours = Math.max(0.5, nextHours);
      await updateLifeItem(action.id, {
        body: {
          ...action.body,
          hours,
        },
      });
      await reloadItems();
      notify(`Action set to ${hours.toFixed(1)}h.`);
    });
  }

  async function saveCapacityPreference() {
    const hours = Number(availableHoursInput);
    if (!Number.isFinite(hours) || hours <= 0) {
      notify('Available hours must be a positive number.');
      return;
    }
    await run('Save capacity', async () => {
      const vision = ofKind(items, 'VISION').find((item) =>
        Object.prototype.hasOwnProperty.call(item.body, 'availableHours'),
      );
      if (vision) {
        await updateLifeItem(vision.id, {
          body: { ...vision.body, availableHours: hours },
        });
      } else {
        await createLifeItem({
          kind: 'VISION',
          title: 'Weekly capacity',
          body: { availableHours: hours },
        });
      }
      await reloadItems();
      notify('Weekly capacity updated.');
    });
  }

  async function archiveItem(item: LifeItem) {
    await run('Archive', async () => {
      await updateLifeItem(item.id, { status: 'ARCHIVED' });
      await reloadItems();
      notify(
        item.kind === 'ACTION'
          ? 'Action archived (hidden from Today/Plan).'
          : 'Archived.',
      );
    });
  }

  function confirmDeleteItem(item: LifeItem) {
    Alert.alert(
      'Delete permanently?',
      `"${item.title}" will be removed. Prefer Archive to soft-remove and keep it recoverable.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void run('Delete', async () => {
              await deleteLifeItem(item.id);
              await reloadItems();
              notify('Deleted.');
            });
          },
        },
      ],
    );
  }

  async function addLifeArea() {
    const title = areaTitle.trim();
    if (!title) {
      notify('Name the life area.');
      return;
    }
    await run('Add area', async () => {
      await createLifeItem({
        kind: 'PILLAR',
        title,
        body: { icon: 'compass-outline' },
        sortOrder: pillars.length,
      });
      setAreaTitle('');
      await reloadItems();
      notify('Life area added.');
    });
  }

  async function removeLifeArea(area: LifeItem) {
    await run('Remove area', async () => {
      await updateLifeItem(area.id, { status: 'ARCHIVED' });
      await reloadItems();
      notify(`${area.title} removed.`);
    });
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.boot}>
        <ActivityIndicator color={colors.ink} size="large" />
        <Text style={styles.bootText}>Loading your Life OS…</Text>
      </SafeAreaView>
    );
  }

  if (!account) {
    return (
      <SafeAreaView style={styles.boot}>
        <Text style={styles.brandMark}>Life OS</Text>
        <Text style={styles.bootTitle}>Sign in to use your account</Text>
        <Text style={styles.bootText}>
          Ideas, projects, capacity and reviews sync to {`lifeos.orija.store`} so
          phone and desktop share one source of truth.
        </Text>
        {!online ? (
          <Pill tone="danger">Server unreachable — check your tunnel</Pill>
        ) : null}
        <Button onPress={() => setAccountOpen(true)} style={{ marginTop: 18 }}>
          Sign in or create account
        </Button>
  
      <Modal
        visible={schedulePrompt != null}
        transparent
        animationType="fade"
        onRequestClose={() => setSchedulePrompt(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardEyebrow}>Schedule</Text>
            <Text style={styles.cardTitle}>Pick a date</Text>
            <Text style={styles.cardBody}>
              {schedulePrompt
                ? `"${schedulePrompt.action.title}" needs a date for Schedule.`
                : ''}
            </Text>
            <TextInput
              value={scheduleDateDraft}
              onChangeText={setScheduleDateDraft}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              style={styles.input}
            />
            <View style={styles.row}>
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  setSchedulePrompt(null);
                  setScheduleDateDraft('');
                }}
              >
                Cancel
              </Button>
              <Button
                style={{ flex: 1 }}
                disabled={busy}
                onPress={() => void confirmSchedulePrompt()}
              >
                Save Schedule
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <AccountSheet
          visible={accountOpen}
          account={null}
          initialInviteToken={inviteToken ?? undefined}
          notify={notify}
          onClose={() => setAccountOpen(false)}
          onAccountChange={(next) => {
            setAccount(next);
            if (next) void load('refresh');
          }}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="dark" />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brandMark}>Life OS</Text>
          <Text style={styles.topMeta}>{todayLabel()}</Text>
        </View>
        <Pressable
          onPress={() => {
            tap();
            setAccountOpen(true);
          }}
          style={styles.avatarButton}
        >
          <Text style={styles.avatarText}>
            {account.user.displayName.slice(0, 1).toUpperCase()}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 108 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load('refresh')} />
        }
      >
        {tab === 'today' ? (
          <View style={styles.stack}>
            <Text style={styles.cardEyebrow}>COMMAND</Text>
            <Text style={styles.greeting}>Good focus, {firstName(account)}.</Text>
            <Text style={styles.lede}>
              Available · planned · remaining — pick your primary move for today.
            </Text>

            <Card>
              <Text style={styles.cardEyebrow}>Primary Move</Text>
              {primary ? (
                <>
                  <Text
                    style={[
                      styles.cardTitle,
                      primary.status === 'DONE' && styles.doneTitle,
                    ]}
                  >
                    {primary.title}
                  </Text>
                  <Text style={styles.cardBody}>
                    {bodyNumber(primary, 'hours', 1)}h
                    {bodyString(primary, 'day')
                      ? ` · ${bodyString(primary, 'day')}`
                      : ''}
                    {primary.status === 'DONE' ? ' · Done' : ''}
                  </Text>
                  <SwipeableRow
                    disabled={busy}
                    onArchive={() => void archiveItem(primary)}
                    onDelete={() => confirmDeleteItem(primary)}
                  >
                    <View style={styles.row}>
                      <Button
                        onPress={() => void completeAction(primary)}
                        disabled={busy}
                        style={{ flex: 1 }}
                      >
                        {primary.status === 'DONE' ? 'Undo complete' : 'Mark done'}
                      </Button>
                      <Button
                        variant="secondary"
                        onPress={() => {
                          setTab('you');
                          setYouDest('capacity');
                        }}
                        style={{ flex: 1 }}
                      >
                        Capacity
                      </Button>
                    </View>
                  </SwipeableRow>
                  <Text style={styles.listMeta}>Swipe left to archive</Text>
                </>
              ) : (
                <EmptyState
                  title="No primary move yet"
                  body="Capture an idea and convert it into a project with a next action."
                  action={
                    <Button onPress={() => setCaptureOpen(true)} style={{ marginTop: 12 }}>
                      Capture idea
                    </Button>
                  }
                />
              )}
            </Card>

            <Card>
              <Text style={styles.cardEyebrow}>Supporting actions</Text>
              <Text style={styles.listMeta}>Swipe left to archive · Delete is optional</Text>
              {supporting.length === 0 ? (
                <Text style={styles.cardBody}>No other open actions this week.</Text>
              ) : (
                supporting.map((action) => (
                  <SwipeableRow
                    key={action.id}
                    disabled={busy}
                    onArchive={() => void archiveItem(action)}
                    onDelete={() => confirmDeleteItem(action)}
                  >
                    <Pressable
                      onPress={() => void completeAction(action)}
                      style={styles.listRow}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listTitle}>{action.title}</Text>
                        <Text style={styles.listMeta}>
                          {bodyNumber(action, 'hours', 1)}h
                          {bodyString(action, 'day')
                            ? ` · ${bodyString(action, 'day')}`
                            : ''}
                        </Text>
                      </View>
                      <LifeIcon name="done" color={colors.sageDeep} />
                    </Pressable>
                  </SwipeableRow>
                ))
              )}
            </Card>

            <Card>
              <View style={styles.ringSummary}>
                <CapacityRing
                  planned={capacity.planned}
                  available={capacity.available}
                  size={88}
                  label="Today weekly capacity"
                />
                <View style={styles.ringSummaryCopy}>
                  <Text style={styles.cardEyebrow}>Capacity pulse</Text>
                  <Text style={styles.cardTitle}>
                    {capacity.planned.toFixed(1)}h / {capacity.available}h
                  </Text>
                  <Text style={styles.cardBody}>
                    {capacity.planned > capacity.available
                      ? 'Over capacity — reduce scope in Capacity.'
                      : 'Within capacity for this week.'}
                  </Text>
                </View>
              </View>
            </Card>

            <Card>
              <Text style={styles.cardEyebrow}>Risks</Text>
              {risks.length === 0 ? (
                <Text style={styles.cardBody}>No active risks detected.</Text>
              ) : (
                risks.map((risk) => (
                  <View key={risk} style={styles.riskRow}>
                    <LifeIcon name="warning" color={colors.danger} />
                    <Text style={[styles.cardBody, { flex: 1 }]}>{risk}</Text>
                  </View>
                ))
              )}
            </Card>
          </View>
        ) : null}


        {tab === 'plan' ? (
          <View style={styles.segmentRow}>
            {(
              [
                ['priority', 'Priority', 'priority'],
                ['areas', 'Areas', 'areas'],
                ['projects', 'Projects', 'projects'],
                ['ideas', 'Ideas', 'ideas'],
              ] as const
            ).map(([id, label, icon]) => (
              <Pressable
                key={id}
                onPress={() => {
                  tap();
                  setPlanSegment(id);
                  if (id !== 'priority') setPreferPriorityMatrix(false);
                }}
                style={[styles.segmentChip, planSegment === id && styles.segmentChipActive]}
              >
                <LifeIcon
                  name={icon}
                  size={15}
                  color={planSegment === id ? colors.acid : colors.sageDeep}
                />
                <Text
                  style={[
                    styles.segmentChipText,
                    planSegment === id && styles.segmentChipTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {tab === 'plan' ? (
          <PlanScreen
            planSegment={planSegment}
            pillars={pillars}
            projects={projects}
            allIdeas={ofKind(items, 'IDEA')}
            items={items}
            openActions={capacity.openActions}
            availableHours={capacity.available}
            busy={busy}
            areaTitle={areaTitle}
            onAreaTitleChange={setAreaTitle}
            onNewProject={() => {
              setSourceIdeaId(null);
              setProjectTitle('');
              setProjectOutcome('');
              setProjectPillarId(pillars[0]?.id ?? null);
                        setProjectTargetDate('');
              setActionTitle('');
              setActionHours('2');
              setActionImportance('HIGH');
              setActionUrgency('LOW');
              setProjectOpen(true);
            }}
            onCaptureIdea={() => openQuickCapture('idea')}
            onQuickAction={(projectId) => {
              openQuickCapture('action', projectId);
            }}
            onEvaluate={(idea) => {
              setEvaluateId(idea.id);
              setImpact(bodyNumber(idea, 'impact', 3) || 3);
              setEffort(bodyNumber(idea, 'effort', 2) || 2);
              setAlignment(bodyNumber(idea, 'alignment', 3) || 3);
              setTiming(bodyNumber(idea, 'timing', 3) || 3);
            }}
            onConvert={(idea) => openConvert(idea)}
            onArchiveIdea={(idea) => void archiveItem(idea)}
            onMoveProjectPriority={(project, priority) =>
              void moveProjectPriority(project, priority)
            }
            onMoveActionQuadrant={(action, quadrant) =>
              void moveActionQuadrant(action, quadrant)
            }
            onCompleteAction={(action) => void completeAction(action)}
            onArchiveAction={(action) => void archiveItem(action)}
            onDeleteAction={(action) => confirmDeleteItem(action)}
            onArchiveProject={(project) => void archiveItem(project)}
            onSetProjectStatus={(project, status) =>
              void run('Update project status', async () => {
                await updateLifeItem(project.id, { status });
                await reloadItems();
                notify(
                  status === 'DONE'
                    ? 'Project marked done.'
                    : 'Project reopened.',
                );
              })
            }
            onSetProjectDeadline={(project, targetDate) =>
              void run('Update project deadline', async () => {
                await updateLifeItem(project.id, {
                  body: projectBodyWithPriority(
                    projectBodyWithTargetDate(project.body, targetDate),
                    projectPriorityLevel(project.body),
                  ),
                });
                await reloadItems();
                notify(
                  targetDate
                    ? `Deadline set to ${targetDate}.`
                    : 'Deadline cleared.',
                );
              })
            }
            onAddArea={() => void addLifeArea()}
            onRemoveArea={(pillar) => void removeLifeArea(pillar)}
            onOpenProjectsMatrix={() => {
              setPreferPriorityMatrix(true);
              setPlanSegment('priority');
            }}
            preferMatrix={preferPriorityMatrix}
            onMoveProjectToIdea={(project) =>
              void run('Move to Ideas', async () => {
                await moveProjectToIdea(project.id);
                await reloadItems();
                notify('Project parked in Ideas.');
                setPlanSegment('ideas');
              })
            }
            onParkAction={(action) =>
              void run('Park action', async () => {
                await updateLifeItem(action.id, {
                  body: { ...action.body, day: 'Later' },
                });
                await reloadItems();
                notify('Moved to Later.');
              })
            }
            onSetScheduledDate={(action, date) =>
              void run('Set schedule date', async () => {
                await updateLifeItem(action.id, {
                  body: actionBodyWithScheduledDate(action.body, date),
                });
                await reloadItems();
                notify('Schedule date saved.');
              })
            }
            onRequestPlanSegment={(segment) => {
              setPlanSegment(segment);
              if (segment !== 'priority') setPreferPriorityMatrix(false);
            }}
            tipDismissed={priorityTipDismissed}
            onDismissTip={() => {
              setPriorityTipDismissed(true);
              void AsyncStorage.setItem('life-os-priority-tip-dismissed', '1');
            }}
            showArchived={showArchived}
            onShowArchivedChange={setShowArchived}
          />
        ) : null}

        {tab === 'money' ? (
          <BudgetScreen account={account!} notify={notify} />
        ) : null}

        {tab === 'calendar' ? <CalendarScreen notify={notify} /> : null}


        {tab === 'you' && youDest === 'menu' ? (
          <View style={styles.stack}>
            <Text style={styles.sectionTitle}>You</Text>
            <Text style={styles.lede}>
              Capacity, review, household, integrations, and settings.
            </Text>
            {(
              [
                ['capacity', 'Capacity', 'Weekly hours and load', 'capacity'],
                ['review', 'Weekly Review', 'CEO-style check-in', 'review'],
                ['household', 'Household', 'Partner link and shared space', 'household'],
                ['integrations', 'Integrations', 'Calendar sync connectors', 'integrations'],
                ['settings', 'Settings', 'Account, export, email reminders', 'settings'],
              ] as const
            ).map(([id, title, body, icon]) => (
              <Pressable
                key={id}
                style={styles.youRow}
                onPress={() => {
                  tap();
                  if (id === 'settings' || id === 'household') {
                    setAccountOpen(true);
                    setYouDest('menu');
                  } else {
                    setYouDest(id);
                  }
                }}
              >
                <LifeIcon name={icon} color={colors.sageDeep} size={22} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.listTitle}>{title}</Text>
                  <Text style={styles.listMeta}>{body}</Text>
                </View>
                <LifeIcon name="chevron-right" color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {tab === 'you' && youDest === 'capacity' ? (
          <View style={styles.stack}>
            <Pressable onPress={() => setYouDest('menu')} style={styles.backRow}>
              <LifeIcon name="chevron-left" color={colors.sageDeep} />
              <Text style={styles.backText}>You</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>Capacity</Text>
            <Card>
              <View style={styles.ringSummary}>
                <CapacityRing
                  planned={capacity.planned}
                  available={capacity.available}
                  label="Weekly planned capacity"
                />
                <View style={styles.ringSummaryCopy}>
                  <Text style={styles.cardEyebrow}>This week</Text>
                  <Text style={styles.cardTitle}>
                    {capacity.planned.toFixed(1)}h planned / {capacity.available}h available
                  </Text>
                </View>
              </View>
              {capacity.planned > capacity.available ? (
                <Pill tone="danger">Overcommitted — reduce action hours below</Pill>
              ) : (
                <Pill>Healthy load</Pill>
              )}
            </Card>

            <Card>
              <Field
                label="Available hours / week"
                value={availableHoursInput}
                onChangeText={setAvailableHoursInput}
                keyboardType="decimal-pad"
              />
              <Button onPress={() => void saveCapacityPreference()} disabled={busy}>
                Save capacity preference
              </Button>
            </Card>

            {capacity.openActions.length === 0 ? (
              <EmptyState
                title="No scheduled actions"
                body="Create a project with a next action to plan the week."
              />
            ) : (
              capacity.openActions.map((action) => (
                <SwipeableRow
                  key={action.id}
                  disabled={busy}
                  onArchive={() => void archiveItem(action)}
                  onDelete={() => confirmDeleteItem(action)}
                >
                  <Card>
                    <Text style={styles.listTitle}>{action.title}</Text>
                    <Text style={styles.listMeta}>
                      {bodyNumber(action, 'hours', 1)}h
                      {bodyString(action, 'day')
                        ? ` · ${bodyString(action, 'day')}`
                        : ' · unscheduled'}
                    </Text>
                    <View style={styles.row}>
                      <Button
                        variant="secondary"
                        style={{ flex: 1 }}
                        onPress={() =>
                          void updateActionHours(
                            action,
                            bodyNumber(action, 'hours', 1) - 1,
                          )
                        }
                      >
                        −1h
                      </Button>
                      <Button
                        variant="secondary"
                        style={{ flex: 1 }}
                        onPress={() =>
                          void updateActionHours(
                            action,
                            bodyNumber(action, 'hours', 1) + 1,
                          )
                        }
                      >
                        +1h
                      </Button>
                      <Button
                        style={{ flex: 1 }}
                        onPress={() => void completeAction(action)}
                      >
                        Done
                      </Button>
                    </View>
                  </Card>
                </SwipeableRow>
              ))
            )}
          </View>
        ) : null}

        {tab === 'you' && youDest === 'review' ? (
          <View style={styles.stack}>
            <Pressable onPress={() => setYouDest('menu')} style={styles.backRow}>
              <LifeIcon name="chevron-left" color={colors.sageDeep} />
              <Text style={styles.backText}>You</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>Weekly Review</Text>
            <WeeklyReviewScreen
              householdId={account!.activeHouseholdId!}
              completedActions={doneActions.length}
              totalActions={actions.length}
              plannedHours={capacity.planned}
              availableHours={capacity.available}
              notify={notify}
            />
          </View>
        ) : null}

        {tab === 'you' && youDest === 'integrations' ? (
          <View style={styles.stack}>
            <Pressable onPress={() => setYouDest('menu')} style={styles.backRow}>
              <LifeIcon name="chevron-left" color={colors.sageDeep} />
              <Text style={styles.backText}>You</Text>
            </Pressable>
            <Text style={styles.sectionTitle}>Integrations</Text>
            <IntegrationsScreen notify={notify} />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        {(
          [
            ['today', 'Today', 'today'],
            ['plan', 'Plan', 'plan'],
            ['calendar', 'Calendar', 'calendar'],
            ['money', 'Money', 'money'],
            ['you', 'You', 'you'],
          ] as const
        ).map(([id, label, icon]) => (
          <Pressable
            key={id}
            onPress={() => {
              tap();
              setTab(id);
              if (id === 'you') setYouDest('menu');
              if (id === 'plan' && planSegment == null) setPlanSegment('priority');
            }}
            style={styles.tabItem}
          >
            <LifeIcon
              name={icon}
              color={tab === id ? colors.ink : colors.muted}
              size={20}
            />
            <Text style={[styles.tabLabel, tab === id && styles.tabLabelActive]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.fab, { bottom: 78 + insets.bottom }]}
        onPress={() => {
          tap();
          const defaultKind: FabKind =
            tab === 'plan' && planSegment === 'ideas'
              ? 'idea'
              : tab === 'money'
                ? 'spend'
                : 'action';
          openQuickCapture(defaultKind);
        }}
      >
        <LifeIcon name="add" color={colors.acidInk} size={28} />
      </Pressable>

      {toast ? (
        <View style={[styles.toast, { bottom: 120 + insets.bottom }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <Modal
        visible={captureOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCaptureOpen(false)}
      >
        <View style={styles.modalWrap}>
          <Pressable style={styles.modalDismiss} onPress={() => setCaptureOpen(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[
              styles.modalSheetWrap,
              Platform.OS === 'android' ? { marginBottom: keyboardHeight } : null,
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={[
                styles.modalCard,
                {
                  paddingBottom: Math.max(insets.bottom, 16) + 12,
                },
              ]}
            >
              <Text style={styles.sectionTitle}>
                {fabKind === 'action' ? 'Quick add action' : 'Capture'}
              </Text>
              <View style={styles.chipRow}>
                {(
                  [
                    ['action', 'Action'],
                    ['idea', 'Idea'],
                    ['project', 'Project'],
                    ['spend', 'Spend'],
                  ] as const
                ).map(([id, label]) => (
                  <Pressable
                    key={id}
                    onPress={() => {
                      if (id === 'project') {
                        setCaptureOpen(false);
                        setSourceIdeaId(null);
                        setProjectTitle('');
                        setProjectOutcome('');
                        setProjectPillarId(pillars[0]?.id ?? null);
                                            setActionTitle('');
                        setActionHours('2');
                        setActionImportance('HIGH');
                        setActionUrgency('LOW');
                        setProjectOpen(true);
                        return;
                      }
                      if (id === 'spend') {
                        setCaptureOpen(false);
                        setTab('money');
                        notify('Add spending under Money → Spending.');
                        return;
                      }
                      setFabKind(id);
                      setActionMoreOpen(false);
                    }}
                    style={[styles.chip, fabKind === id && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        fabKind === id && styles.chipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {fabKind === 'action' ? (
                <Text style={styles.cardBody}>
                  Title and estimate are enough. Use More options for project,
                  Important/Urgent, and day.
                </Text>
              ) : null}
              <Field
                label="Title"
                value={ideaTitle}
                onChangeText={setIdeaTitle}
                placeholder={fabKind === 'action' ? 'What will you do?' : 'What showed up?'}
              />
              {fabKind === 'idea' ? (
              <Field
                label="Note (optional)"
                value={ideaNote}
                onChangeText={setIdeaNote}
                placeholder="Context — classification can wait"
                multiline
              />
              ) : (
              <Field
                label="Hours"
                value={actionHours}
                onChangeText={setActionHours}
                keyboardType="decimal-pad"
              />
              )}
              {fabKind === 'action' ? (
                <>
                  <Button
                    variant="ghost"
                    onPress={() => setActionMoreOpen((open) => !open)}
                  >
                    {actionMoreOpen ? 'Hide options' : 'More options'}
                  </Button>
                  {actionMoreOpen ? (
                    <>
                      <Text style={styles.fieldLabel}>Project (optional)</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={styles.chipRow}>
                          <Pressable
                            onPress={() => setQuickActionProjectId(null)}
                            style={[
                              styles.chip,
                              quickActionProjectId == null && styles.chipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                quickActionProjectId == null && styles.chipTextActive,
                              ]}
                            >
                              Inbox
                            </Text>
                          </Pressable>
                          {projects.map((project) => (
                            <Pressable
                              key={project.id}
                              onPress={() => setQuickActionProjectId(project.id)}
                              style={[
                                styles.chip,
                                quickActionProjectId === project.id && styles.chipActive,
                              ]}
                            >
                              <Text
                                style={[
                                  styles.chipText,
                                  quickActionProjectId === project.id &&
                                    styles.chipTextActive,
                                ]}
                              >
                                {project.title}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </ScrollView>
                      <Text style={styles.fieldLabel}>Importance</Text>
                      <Text style={styles.listMeta}>
                        With Urgency → Eisenhower (Do now / Schedule / Delegate /
                        Eliminate).
                      </Text>
                      <View style={styles.chipRow}>
                        {PRIORITY_LEVELS.map((level) => (
                          <Pressable
                            key={level}
                            onPress={() => setQuickActionImportance(level)}
                            style={[
                              styles.chip,
                              quickActionImportance === level && styles.chipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                quickActionImportance === level && styles.chipTextActive,
                              ]}
                            >
                              {PRIORITY_LEVEL_META[level].title}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={styles.fieldLabel}>Urgency</Text>
                      <View style={styles.chipRow}>
                        {PRIORITY_LEVELS.map((level) => (
                          <Pressable
                            key={level}
                            onPress={() => setQuickActionUrgency(level)}
                            style={[
                              styles.chip,
                              quickActionUrgency === level && styles.chipActive,
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                quickActionUrgency === level && styles.chipTextActive,
                              ]}
                            >
                              {PRIORITY_LEVEL_META[level].title}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                      <Text style={styles.listMeta}>
                        Matrix:{' '}
                        {
                          PRIORITY_QUADRANT_META[
                            quadrantFromLevels(quickActionImportance, quickActionUrgency)
                          ].title
                        }
                      </Text>
                      {quadrantRequiresScheduledDate(
                        quadrantFromLevels(
                          quickActionImportance,
                          quickActionUrgency,
                        ),
                      ) ? (
                        <>
                          <Text style={styles.fieldLabel}>Schedule date</Text>
                          <TextInput
                            value={captureScheduleDate}
                            onChangeText={setCaptureScheduleDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={colors.muted}
                            autoCapitalize="none"
                            style={styles.input}
                          />
                        </>
                      ) : null}
                      <Text style={styles.fieldLabel}>Day</Text>
                      <View style={styles.chipRow}>
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
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.fieldLabel}>Area (optional)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.chipRow}>
                      {pillars.map((pillar) => (
                        <Pressable
                          key={pillar.id}
                          onPress={() => setIdeaPillarId(pillar.id)}
                          style={[
                            styles.chip,
                            ideaPillarId === pillar.id && styles.chipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              ideaPillarId === pillar.id && styles.chipTextActive,
                            ]}
                          >
                            {pillar.title}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
              <View style={styles.row}>
                <Button
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => setCaptureOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  style={{ flex: 1 }}
                  disabled={busy}
                  onPress={() => {
                    if (fabKind === 'action') {
                      void run('Save action', async () => {
                        if (!ideaTitle.trim()) {
                          notify('Give the action a title.');
                          return;
                        }
                        const hours = Number(actionHours);
                        const q = quadrantFromLevels(
                          quickActionImportance,
                          quickActionUrgency,
                        );
                        let body: Record<string, unknown> = {
                          hours:
                            Number.isFinite(hours) && hours > 0 ? hours : 1,
                          day: actionMoreOpen ? actionDay : undefined,
                          note: ideaNote.trim() || undefined,
                        };
                        if (quadrantRequiresScheduledDate(q)) {
                          if (!/^\d{4}-\d{2}-\d{2}$/.test(captureScheduleDate)) {
                            notify(
                              'Schedule actions need a date (YYYY-MM-DD).',
                            );
                            return;
                          }
                          body = actionBodyWithScheduledDate(
                            body,
                            captureScheduleDate,
                          );
                        }
                        await createLifeItem({
                          kind: 'ACTION',
                          title: ideaTitle.trim(),
                          parentId: quickActionProjectId,
                          body: actionBodyWithLevels(
                            body,
                            quickActionImportance,
                            quickActionUrgency,
                          ),
                        });
                        setIdeaTitle('');
                        setIdeaNote('');
                        setQuickActionProjectId(null);
                        setCaptureScheduleDate('');
                        setActionMoreOpen(false);
                        setCaptureOpen(false);
                        await reloadItems();
                        setTab('today');
                        notify('Action saved.');
                      });
                      return;
                    }
                    void saveIdea();
                  }}
                >
                  {fabKind === 'action' ? 'Save action' : 'Save idea'}
                </Button>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        visible={!!evaluateId}
        animationType="slide"
        transparent
        onRequestClose={() => setEvaluateId(null)}
      >
        <View style={styles.modalWrap}>
          <Pressable style={styles.modalDismiss} onPress={() => setEvaluateId(null)} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.modalCard,
              {
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              },
            ]}
            style={
              Platform.OS === 'android' ? { marginBottom: keyboardHeight } : undefined
            }
          >
            <Text style={styles.sectionTitle}>Evaluate idea</Text>
            <Text style={styles.cardBody}>
              Score each dimension 1–10. Overall blends impact, alignment, and
              timing against effort.
            </Text>
            {(
              [
                ['Impact', impact, setImpact],
                ['Effort', effort, setEffort],
                ['Alignment', alignment, setAlignment],
                ['Timing', timing, setTiming],
              ] as const
            ).map(([label, value, setter]) => (
              <View key={label} style={styles.scoreRow}>
                <View style={styles.scoreLabelRow}>
                  <Text style={styles.fieldLabel}>{label}</Text>
                  <Text style={styles.scoreValue}>{value}/10</Text>
                </View>
                <Slider
                  accessibilityLabel={`${label} score`}
                  accessibilityValue={{
                    min: 1,
                    max: 10,
                    now: value,
                    text: `${value} out of 10`,
                  }}
                  minimumValue={1}
                  maximumValue={10}
                  step={1}
                  value={value}
                  onValueChange={setter}
                  minimumTrackTintColor={colors.sageDeep}
                  maximumTrackTintColor={colors.line}
                  thumbTintColor={colors.ink}
                  style={styles.scoreSlider}
                />
              </View>
            ))}
            <Pill tone="ink">
              Overall{' '}
              {(
                (impact + alignment + timing + (10 - effort)) /
                4
              ).toFixed(1)}
              /10
            </Pill>
            <View style={styles.row}>
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => setEvaluateId(null)}
              >
                Cancel
              </Button>
              <Button
                style={{ flex: 1 }}
                disabled={busy}
                onPress={() => void saveEvaluation()}
              >
                Save scores
              </Button>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal
        visible={projectOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setProjectOpen(false)}
      >
        <View style={styles.modalWrap}>
          <Pressable style={styles.modalDismiss} onPress={() => setProjectOpen(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[
              styles.modalSheetWrap,
              Platform.OS === 'android' ? { marginBottom: keyboardHeight } : null,
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerStyle={[
                styles.modalCard,
                {
                  paddingBottom: Math.max(insets.bottom, 16) + 12,
                },
              ]}
            >
              <Text style={styles.sectionTitle}>Create project</Text>
            <Field
              label="Project title"
              value={projectTitle}
              onChangeText={setProjectTitle}
            />
            <Field
              label="Outcome"
              value={projectOutcome}
              onChangeText={setProjectOutcome}
              multiline
            />
            <Field
              label="Deadline (optional, YYYY-MM-DD)"
              value={projectTargetDate}
              onChangeText={setProjectTargetDate}
            />
            <Text style={styles.fieldLabel}>Area</Text>
            <View style={styles.chipRow}>
              {pillars.map((pillar) => (
                <Pressable
                  key={pillar.id}
                  onPress={() => setProjectPillarId(pillar.id)}
                  style={[
                    styles.chip,
                    projectPillarId === pillar.id && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      projectPillarId === pillar.id && styles.chipTextActive,
                    ]}
                  >
                    {pillar.title}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field
              label="First next action"
              value={actionTitle}
              onChangeText={setActionTitle}
            />
            <Field
              label="Hours"
              value={actionHours}
              onChangeText={setActionHours}
              keyboardType="decimal-pad"
            />
            <Text style={styles.fieldLabel}>Importance</Text>
            <Text style={styles.listMeta}>
              Low / Medium / High with Urgency → Eisenhower quadrant for this
              first next action.
            </Text>
            <View style={styles.chipRow}>
              {PRIORITY_LEVELS.map((level) => (
                <Pressable
                  key={level}
                  onPress={() => setActionImportance(level)}
                  style={[
                    styles.chip,
                    actionImportance === level && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      actionImportance === level && styles.chipTextActive,
                    ]}
                  >
                    {PRIORITY_LEVEL_META[level].title}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Urgency</Text>
            <View style={styles.chipRow}>
              {PRIORITY_LEVELS.map((level) => (
                <Pressable
                  key={level}
                  onPress={() => setActionUrgency(level)}
                  style={[
                    styles.chip,
                    actionUrgency === level && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      actionUrgency === level && styles.chipTextActive,
                    ]}
                  >
                    {PRIORITY_LEVEL_META[level].title}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.listMeta}>
              Matrix:{' '}
              {
                PRIORITY_QUADRANT_META[
                  quadrantFromLevels(actionImportance, actionUrgency)
                ].label
              }
            </Text>
            {quadrantRequiresScheduledDate(
              quadrantFromLevels(actionImportance, actionUrgency),
            ) ? (
              <Field
                label="Schedule date (required, YYYY-MM-DD)"
                value={actionScheduleDate}
                onChangeText={setActionScheduleDate}
                placeholder="YYYY-MM-DD"
              />
            ) : null}
            <Text style={styles.fieldLabel}>Day</Text>
            <View style={styles.chipRow}>
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
            <View style={styles.row}>
              <Button
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => setProjectOpen(false)}
              >
                Cancel
              </Button>
              <Button
                style={{ flex: 1 }}
                disabled={busy}
                onPress={() => void saveProject()}
              >
                Save project
              </Button>
            </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <AccountSheet
        visible={accountOpen}
        account={account}
        initialInviteToken={inviteToken ?? undefined}
        notify={notify}
        onClose={() => setAccountOpen(false)}
        onAccountChange={(next) => {
          setAccount(next);
          if (next) void load('refresh');
          else {
            setItems([]);
            setAccountOpen(true);
          }
        }}
      />

      <OnboardingSheet
        visible={needsOnboarding}
        notify={notify}
        onComplete={(next) => {
          setAccount(next);
          void load('refresh');
          notify('Your life areas are set.');
        }}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  boot: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  bootTitle: {
    fontFamily: serif,
    fontSize: 28,
    color: colors.ink,
    textAlign: 'center',
  },
  bootText: {
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    fontSize: 14,
  },
  brandMark: {
    fontFamily: serif,
    fontSize: 22,
    color: colors.ink,
    fontWeight: '700',
  },
  topBar: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.acid, fontWeight: '700' },
  content: { paddingHorizontal: 16, paddingTop: 4 },
  stack: { gap: 12 },
  greeting: {
    fontFamily: serif,
    fontSize: 30,
    color: colors.ink,
    marginBottom: 4,
  },
  lede: { color: colors.muted, marginBottom: 8, lineHeight: 20 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
    gap: 10,
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.sageDeep,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardTitle: {
    fontFamily: serif,
    fontSize: 22,
    color: colors.ink,
  },
  doneTitle: {
    color: colors.muted,
    textDecorationLine: 'line-through',
  },
  cardBody: { color: colors.muted, lineHeight: 20, fontSize: 14 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontFamily: serif,
    fontSize: 26,
    color: colors.ink,
    flex: 1,
  },
  row: { flexDirection: 'row', gap: 10 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  listTitle: { color: colors.ink, fontWeight: '600', fontSize: 15 },
  listMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  projectBlock: {
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  matrixQuadrant: {
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  riskRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  ringSummary: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  ringSummaryCopy: { flex: 1, gap: 5, minWidth: 0 },
  emptyCard: { alignItems: 'flex-start' },
  emptyTitle: { fontFamily: serif, fontSize: 20, color: colors.ink },
  emptyBody: { color: colors.muted, lineHeight: 20 },
  button: {
    backgroundColor: colors.ink,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonSecondary: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonAcid: { backgroundColor: colors.acid },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonPressed: { opacity: 0.88 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: colors.paper, fontWeight: '700', fontSize: 13 },
  buttonTextSecondary: { color: colors.ink },
  buttonTextAcid: { color: colors.acidInk },
  buttonTextGhost: { color: colors.muted },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.sage,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillAmber: { backgroundColor: colors.amberSoft },
  pillInk: { backgroundColor: colors.ink },
  pillDanger: { backgroundColor: '#F8E4DF' },
  pillText: { color: colors.sageDeep, fontSize: 11, fontWeight: '700' },
  pillTextAmber: { color: '#8A5A16' },
  pillTextInk: { color: colors.acid },
  pillTextDanger: { color: colors.danger },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.line,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.sageDeep,
  },
  progressFillWarning: { backgroundColor: colors.danger },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    flexDirection: 'row',
    paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: 'center', gap: 4 },
  tabLabel: { fontSize: 10, color: colors.muted, fontWeight: '600' },
  tabLabelActive: { color: colors.ink },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  segmentChip: {
    flexGrow: 1,
    flexBasis: '22%',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    paddingVertical: 9,
    paddingHorizontal: 4,
  },
  segmentChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  segmentChipText: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 11,
  },
  segmentChipTextActive: {
    color: colors.acid,
  },
  youRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.paper,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  backText: {
    color: colors.sageDeep,
    fontWeight: '700',
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    right: 18,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.acid,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  toast: {
    position: 'absolute',
    left: 18,
    right: 18,
    backgroundColor: colors.ink,
    borderRadius: 12,
    padding: 12,
  },
  toastText: { color: colors.paper, textAlign: 'center', fontWeight: '600' },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(20,36,31,0.45)',
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
  },
  modalSheetWrap: {
    maxHeight: '92%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,36,31,0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: colors.canvas,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    gap: 12,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.paper,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { color: colors.ink, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: colors.acid },
  scoreRow: { gap: 2 },
  scoreLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreValue: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 18,
  },
  scoreSlider: { height: 42, marginHorizontal: -8 },
});
