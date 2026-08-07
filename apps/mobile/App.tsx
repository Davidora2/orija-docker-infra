import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
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
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useEffect, useRef, useState, type ReactNode } from 'react';

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

type Tab = 'command' | 'portfolio' | 'ideas' | 'capacity' | 'review';
type ModalName = 'capture' | 'project' | null;

type PrototypeState = {
  step: number;
  ideaTitle: string;
  ideaNote: string;
  evaluating: boolean;
  pillar: string;
  projectTitle: string;
  projectOutcome: string;
  projectHours: number;
  actionTitle: string;
  actionHours: number;
  scheduleDay: string;
  scheduled: boolean;
  complete: boolean;
  scorecard: boolean;
};

const initialState: PrototypeState = {
  step: 0,
  ideaTitle: '',
  ideaNote: '',
  evaluating: false,
  pillar: 'Product',
  projectTitle: '',
  projectOutcome: '',
  projectHours: 7.5,
  actionTitle: '',
  actionHours: 2,
  scheduleDay: 'Fri',
  scheduled: false,
  complete: false,
  scorecard: false,
};

const existingHours = 6.5;
const availableHours = 11;
const journey = ['Capture', 'Evaluate', 'Project', 'Capacity', 'Schedule', 'Brief', 'Review'];

const pillarData = [
  { name: 'Product', icon: 'layers-outline' as const, progress: 72, health: 'On track' },
  { name: 'Business', icon: 'briefcase-outline' as const, progress: 58, health: 'On track' },
  { name: 'Wealth', icon: 'wallet-outline' as const, progress: 36, health: 'Needs attention' },
  { name: 'Career', icon: 'trending-up-outline' as const, progress: 64, health: 'On track' },
  { name: 'Personal', icon: 'heart-outline' as const, progress: 48, health: 'Needs attention' },
  { name: 'Creative', icon: 'sparkles-outline' as const, progress: 81, health: 'On track' },
];

function tap(style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) {
  if (Platform.OS !== 'web') void Haptics.impactAsync(style);
}

function successTap() {
  if (Platform.OS !== 'web') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
}

function Icon({
  name,
  size = 18,
  color = colors.ink,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
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
  tone?: 'sage' | 'amber' | 'ink';
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'amber' && styles.pillAmber,
        tone === 'ink' && styles.pillInk,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          style={[
            styles.pillText,
            tone === 'amber' && styles.pillTextAmber,
            tone === 'ink' && styles.pillTextInk,
          ]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
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

function ProgressBar({
  value,
  warning = false,
}: {
  value: number;
  warning?: boolean;
}) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[
          styles.progressFill,
          { width: `${Math.min(value, 100)}%` },
          warning && styles.progressFillWarning,
        ]}
      />
    </View>
  );
}

function ScreenHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.screenHeader}>
      <View style={styles.eyebrowRow}>
        <Icon name="compass-outline" size={12} color={colors.sageDeep} />
        <Text style={styles.eyebrow}>{eyebrow}</Text>
      </View>
      <View style={styles.headingRow}>
        <Text style={styles.screenTitle}>{title}</Text>
        {action}
      </View>
      <Text style={styles.screenSubtitle}>{subtitle}</Text>
    </View>
  );
}

function Journey({ step }: { step: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.journeyContent}
      style={styles.journey}
    >
      {journey.map((label, index) => (
        <View key={label} style={styles.journeyPair}>
          <View
            style={[
              styles.journeyItem,
              index === step && styles.journeyItemCurrent,
              index < step && styles.journeyItemDone,
            ]}
          >
            <View
              style={[
                styles.journeyNumber,
                index === step && styles.journeyNumberCurrent,
                index < step && styles.journeyNumberDone,
              ]}
            >
              {index < step ? (
                <Icon name="checkmark" size={10} color={colors.sageDeep} />
              ) : (
                <Text
                  style={[
                    styles.journeyNumberText,
                    index === step && styles.journeyNumberTextCurrent,
                  ]}
                >
                  {index + 1}
                </Text>
              )}
            </View>
            <Text
              style={[
                styles.journeyLabel,
                index === step && styles.journeyLabelCurrent,
                index < step && styles.journeyLabelDone,
              ]}
            >
              {label}
            </Text>
          </View>
          {index < journey.length - 1 && (
            <Icon name="chevron-forward" size={10} color="#B9C0BA" />
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function CommandScreen({
  state,
  onComplete,
  onOpenReview,
  onOpenIdeas,
  onOpenCapacity,
  notify,
}: {
  state: PrototypeState;
  onComplete: () => void;
  onOpenReview: () => void;
  onOpenIdeas: () => void;
  onOpenCapacity: () => void;
  notify: (message: string) => void;
}) {
  const primary = state.scheduled
    ? state.actionTitle
    : 'Approve the Life OS prototype direction';

  return (
    <View>
      <ScreenHeader
        eyebrow="Thursday · 06 August"
        title="Good evening, David."
        subtitle={
          state.scheduled
            ? 'Your plan fits. One focused move will unlock the most progress.'
            : 'Three priorities are competing for attention. Choose the move with the highest leverage.'
        }
        action={
          state.complete ? (
            <Pressable onPress={onOpenReview} style={styles.headerArrow}>
              <Icon name="arrow-forward" size={18} color={colors.ink} />
            </Pressable>
          ) : undefined
        }
      />

      <LinearGradient
        colors={['#1B3B30', '#10251F']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.primaryCard}
      >
        <View style={styles.primaryTop}>
          <View style={styles.primaryLabel}>
            <View style={styles.primaryDot} />
            <Text style={styles.primaryLabelText}>PRIMARY MOVE</Text>
          </View>
          <Text style={styles.primaryTime}>
            {state.scheduled ? `${state.scheduleDay} · 09:00–11:00` : 'Today · 10:00–11:30'}
          </Text>
        </View>
        <Text style={styles.primaryTitle}>{primary}</Text>
        <Text style={styles.primaryDescription}>
          {state.scheduled
            ? `The next action for “${state.projectTitle}”, directly supporting your ${state.pillar} pillar.`
            : 'Finalize the core workflow before expanding the product surface.'}
        </Text>
        <View style={styles.primaryFooter}>
          {state.complete ? (
            <Button variant="acid" onPress={onOpenReview}>
              <View style={styles.buttonContent}>
                <Icon name="checkmark-circle" size={16} color={colors.acidInk} />
                <Text style={styles.buttonTextAcid}>Review the week</Text>
              </View>
            </Button>
          ) : (
            <Button
              variant="acid"
              onPress={state.scheduled ? onComplete : () => notify('Focus timer started.')}
            >
              <View style={styles.buttonContent}>
                <Icon
                  name={state.scheduled ? 'checkmark' : 'scan-outline'}
                  size={16}
                  color={colors.acidInk}
                />
                <Text style={styles.buttonTextAcid}>
                  {state.scheduled ? 'Mark complete' : 'Start focus'}
                </Text>
              </View>
            </Button>
          )}
          <Text style={styles.primaryProject}>
            {state.projectTitle || 'Life OS · Product'}
          </Text>
        </View>
      </LinearGradient>

      <View style={styles.twoColumnRow}>
        <Card style={styles.capacitySummary}>
          <View style={styles.sectionTitleRow}>
            <View>
              <Text style={styles.sectionTitle}>Weekly capacity</Text>
              <Text style={styles.sectionCaption}>Mon 03 – Sun 09 Aug</Text>
            </View>
            <Pressable onPress={onOpenCapacity}>
              <Icon name="chevron-forward" size={16} color={colors.sageDeep} />
            </Pressable>
          </View>
          <View style={styles.capacityNumberRow}>
            <Text style={styles.capacityBig}>{state.scheduled ? '100%' : '59%'}</Text>
            <Pill tone={state.scheduled ? 'amber' : 'sage'}>
              {state.scheduled ? 'At capacity' : 'Healthy'}
            </Pill>
          </View>
          <ProgressBar value={state.scheduled ? 100 : 59} warning={state.scheduled} />
          <View style={styles.capacityMeta}>
            <Text style={styles.capacityMetaText}>
              {state.scheduled ? '11h committed' : '6.5h committed'}
            </Text>
            <Text style={styles.capacityMetaText}>11h available</Text>
          </View>
        </Card>

        <Card style={styles.riskSummary}>
          <View style={styles.riskIcon}>
            <Icon name="alert-circle-outline" size={18} color={colors.danger} />
          </View>
          <Text style={styles.riskNumber}>2</Text>
          <Text style={styles.riskLabel}>strategic alerts</Text>
          <Text style={styles.riskDetail}>Wealth needs attention</Text>
        </Card>
      </View>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}>
          <View>
            <Text style={styles.sectionTitle}>Supporting actions</Text>
            <Text style={styles.sectionCaption}>Keep today intentionally small.</Text>
          </View>
          <Text style={styles.textLink}>View all</Text>
        </View>
        {[
          ['Review capacity assumptions for the founder pilot', 'Life OS · 45 min', 'Deep focus'],
          ['Send project handover notes', 'Career · 25 min', 'Medium'],
          ['Complete strength session', 'Personal · 50 min', 'High'],
        ].map(([title, meta, energy], index) => (
          <Pressable
            key={title}
            onPress={() => notify(`${title} updated.`)}
            style={[styles.actionRow, index === 0 && styles.actionRowFirst]}
          >
            <View style={[styles.actionCheck, index === 2 && styles.actionCheckDone]}>
              {index === 2 && <Icon name="checkmark" size={12} color="white" />}
            </View>
            <View style={styles.actionCopy}>
              <Text style={[styles.actionTitle, index === 2 && styles.actionTitleDone]}>
                {title}
              </Text>
              <Text style={styles.actionMeta}>{meta}</Text>
            </View>
            <Pill>{energy}</Pill>
          </Pressable>
        ))}
      </Card>

      <View style={styles.sectionTitleRowStandalone}>
        <View>
          <Text style={styles.sectionTitle}>Pillar pulse</Text>
          <Text style={styles.sectionCaption}>Where your attention is landing.</Text>
        </View>
        <Text style={styles.textLink}>Last 7 days</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pillarScroll}
      >
        {pillarData.slice(0, 4).map((pillar) => (
          <Card key={pillar.name} style={styles.pillarMini}>
            <View style={styles.pillarMiniTop}>
              <View style={styles.pillarIcon}>
                <Icon name={pillar.icon} size={16} color={colors.sageDeep} />
              </View>
              <View
                style={[
                  styles.healthDot,
                  pillar.health !== 'On track' && styles.healthDotAmber,
                ]}
              />
            </View>
            <Text style={styles.pillarName}>{pillar.name}</Text>
            <Text style={styles.pillarHealth}>{pillar.health}</Text>
            <ProgressBar value={pillar.progress} />
          </Card>
        ))}
      </ScrollView>

      {!state.ideaTitle && (
        <Pressable onPress={onOpenIdeas} style={styles.ideaPrompt}>
          <View style={styles.ideaPromptIcon}>
            <Icon name="bulb-outline" size={18} color={colors.sageDeep} />
          </View>
          <View style={styles.ideaPromptCopy}>
            <Text style={styles.ideaPromptTitle}>3 ideas waiting for review</Text>
            <Text style={styles.ideaPromptText}>
              Capture first. Decide what becomes work later.
            </Text>
          </View>
          <Icon name="chevron-forward" size={17} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

function IdeaScreen({
  state,
  onCapture,
  onEvaluate,
  onPillar,
  onProject,
}: {
  state: PrototypeState;
  onCapture: () => void;
  onEvaluate: () => void;
  onPillar: (pillar: string) => void;
  onProject: () => void;
}) {
  return (
    <View>
      <ScreenHeader
        eyebrow="Capture without commitment"
        title="Idea Studio"
        subtitle="Give ideas room to breathe. Nothing becomes work until you make a deliberate decision."
        action={
          <Pressable style={styles.roundAction} onPress={onCapture}>
            <Icon name="add" size={22} color="white" />
          </Pressable>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {['Inbox  3', 'Incubate', 'Develop now', 'Reference'].map((filter, index) => (
          <View key={filter} style={[styles.filterPill, index === 0 && styles.filterPillActive]}>
            <Text style={[styles.filterText, index === 0 && styles.filterTextActive]}>
              {filter}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Card style={styles.ideaList}>
        {Boolean(state.ideaTitle) && (
          <View style={styles.ideaRow}>
            <View style={styles.ideaIcon}>
              <Icon name="bulb-outline" size={18} color={colors.sageDeep} />
            </View>
            <View style={styles.ideaRowCopy}>
              <Text style={styles.ideaTitle}>{state.ideaTitle}</Text>
              <Text style={styles.ideaMeta}>Just now · {state.pillar}</Text>
            </View>
            {state.step < 2 ? (
              <Button variant="secondary" onPress={onEvaluate}>
                Evaluate
              </Button>
            ) : (
              <Pill>{state.step >= 3 ? 'Converted' : 'Develop now'}</Pill>
            )}
          </View>
        )}
        {[
          ['Quarterly founder field notes', 'Yesterday · Business', 'Incubate'],
          ['Invite-only design leadership dinner', '3 days ago · Creative', 'Reference'],
          ['Automate weekly investment summary', '5 days ago · Wealth', 'Incubate'],
        ].map(([title, meta, status]) => (
          <View style={styles.ideaRow} key={title}>
            <View style={styles.ideaIcon}>
              <Icon name="bulb-outline" size={18} color={colors.sageDeep} />
            </View>
            <View style={styles.ideaRowCopy}>
              <Text style={styles.ideaTitle}>{title}</Text>
              <Text style={styles.ideaMeta}>{meta}</Text>
            </View>
            <Pill>{status}</Pill>
          </View>
        ))}
      </Card>

      {(state.evaluating || state.step >= 2) && state.ideaTitle ? (
        <Card style={styles.evaluationCard}>
          <LinearGradient
            colors={['#1B3B30', '#10251F']}
            style={styles.evaluationHeader}
          >
            <View style={styles.eyebrowRow}>
              <Icon name="sparkles-outline" size={12} color={colors.acid} />
              <Text style={styles.eyebrowLight}>STRATEGIC EVALUATION</Text>
            </View>
            <Text style={styles.evaluationTitle}>Is this worth doing now?</Text>
            <Text style={styles.evaluationDescription}>
              Use the score as guidance. The decision remains yours.
            </Text>
          </LinearGradient>
          <View style={styles.evaluationBody}>
            <Text style={styles.inputLabel}>CONNECTED PILLAR</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillarChoiceRow}
            >
              {['Product', 'Business', 'Wealth', 'Creative'].map((pillar) => (
                <Pressable
                  key={pillar}
                  onPress={() => onPillar(pillar)}
                  style={[
                    styles.choicePill,
                    state.pillar === pillar && styles.choicePillSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      state.pillar === pillar && styles.choiceTextSelected,
                    ]}
                  >
                    {pillar}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.scoreList}>
              {[
                ['Strategic alignment', 5],
                ['Long-term leverage', 5],
                ['Expected benefit', 4],
                ['Urgency', 3],
                ['Confidence', 4],
                ['Effort required', 3],
                ['Risk', 2],
              ].map(([label, score]) => (
                <View style={styles.scoreRow} key={String(label)}>
                  <Text style={styles.scoreLabel}>{label}</Text>
                  <View style={styles.scoreDots}>
                    {[1, 2, 3, 4, 5].map((point) => (
                      <View
                        key={point}
                        style={[
                          styles.scoreDot,
                          point <= Number(score) && styles.scoreDotFilled,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <View style={styles.scoreSummary}>
              <View>
                <Text style={styles.scoreSummaryLabel}>STRATEGIC SCORE</Text>
                <Text style={styles.scoreSummaryHint}>Strong fit · manageable risk</Text>
              </View>
              <Text style={styles.scoreSummaryNumber}>16</Text>
            </View>
            <Button style={styles.fullButton} onPress={onProject}>
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Develop now · create project</Text>
                <Icon name="arrow-forward" size={15} color="white" />
              </View>
            </Button>
          </View>
        </Card>
      ) : (
        <Card style={styles.emptyEvaluation}>
          <Icon name="sparkles-outline" size={25} color={colors.sageDeep} />
          <Text style={styles.emptyTitle}>Make the trade-off visible</Text>
          <Text style={styles.emptyText}>
            Evaluate a new idea to score alignment, leverage, effort and risk.
          </Text>
        </Card>
      )}
    </View>
  );
}

function PortfolioScreen({ state }: { state: PrototypeState }) {
  const projects = [
    ['Design the Life OS command loop', 'Product', 'Active', '14 Aug'],
    ...(state.projectTitle
      ? [[state.projectTitle, state.pillar, state.scheduled ? 'Active' : 'Proposed', '21 Aug']]
      : []),
    ['Package design advisory offer', 'Business', 'Active', '18 Aug'],
    ['Quarterly portfolio review', 'Wealth', 'At risk', '09 Aug'],
  ];

  return (
    <View>
      <ScreenHeader
        eyebrow="Strategic portfolio"
        title="Pillars & projects"
        subtitle="Every active commitment should earn its place and connect to an outcome."
      />
      <View style={styles.pillarGrid}>
        {pillarData.map((pillar) => (
          <Card key={pillar.name} style={styles.pillarCard}>
            <View style={styles.pillarMiniTop}>
              <View style={styles.pillarIcon}>
                <Icon name={pillar.icon} size={17} color={colors.sageDeep} />
              </View>
              <View
                style={[
                  styles.healthDot,
                  pillar.health !== 'On track' && styles.healthDotAmber,
                ]}
              />
            </View>
            <Text style={styles.pillarCardName}>{pillar.name}</Text>
            <Text style={styles.pillarHealth}>{pillar.health}</Text>
            <Text style={styles.pillarPercent}>{pillar.progress}%</Text>
            <ProgressBar value={pillar.progress} />
          </Card>
        ))}
      </View>

      <View style={styles.sectionTitleRowStandalone}>
        <View>
          <Text style={styles.sectionTitle}>Project portfolio</Text>
          <Text style={styles.sectionCaption}>The commitments currently in motion.</Text>
        </View>
      </View>
      <Card style={styles.projectList}>
        {projects.map(([title, pillar, status, due]) => (
          <View key={title} style={styles.projectRow}>
            <View style={styles.projectIcon}>
              <Icon name="flag-outline" size={16} color={colors.sageDeep} />
            </View>
            <View style={styles.projectCopy}>
              <Text style={styles.projectTitle}>{title}</Text>
              <Text style={styles.projectMeta}>
                {pillar} · {due}
              </Text>
            </View>
            <Pill tone={status === 'At risk' ? 'amber' : 'sage'}>{status}</Pill>
          </View>
        ))}
      </Card>
    </View>
  );
}

function CapacityScreen({
  state,
  onReduce,
  onDay,
  onSchedule,
  notify,
}: {
  state: PrototypeState;
  onReduce: () => void;
  onDay: (day: string) => void;
  onSchedule: () => void;
  notify: (message: string) => void;
}) {
  const hasProject = state.step >= 3 && Boolean(state.projectTitle);
  const total = existingHours + (hasProject ? state.projectHours : 0);
  const over = Math.max(0, total - availableHours);
  const percent = Math.round((total / availableHours) * 100);
  const fits = over === 0;

  return (
    <View>
      <ScreenHeader
        eyebrow="Reality before ambition"
        title="Capacity"
        subtitle="Protect the plan by comparing new commitments with the time you actually control."
        action={<Pill tone={fits ? 'sage' : 'amber'}>{fits ? 'At capacity' : 'Over capacity'}</Pill>}
      />

      <Card style={styles.capacityHero}>
        <View style={styles.capacityHeroTop}>
          <View style={styles.capacityPercentBox}>
            <Text style={[styles.capacityHeroPercent, !fits && styles.capacityHeroPercentWarning]}>
              {percent}%
            </Text>
            <Text style={styles.capacityHeroLabel}>ALLOCATED</Text>
          </View>
          <View style={styles.capacityHeroCopy}>
            <Text style={styles.capacityHeroTitle}>
              {fits ? 'This plan is realistic.' : 'Something has to move.'}
            </Text>
            <Text style={styles.capacityHeroDescription}>
              {fits
                ? 'You have allocated the time available for focused work.'
                : 'The proposed project exceeds the time you control this week.'}
            </Text>
          </View>
        </View>
        <ProgressBar value={percent} warning={!fits} />
        <View style={styles.capacityTotals}>
          <View>
            <Text style={styles.capacityTotalValue}>{total}h</Text>
            <Text style={styles.capacityTotalLabel}>COMMITTED</Text>
          </View>
          <View style={styles.capacityDivider} />
          <View>
            <Text style={styles.capacityTotalValue}>11h</Text>
            <Text style={styles.capacityTotalLabel}>AVAILABLE</Text>
          </View>
          <View style={styles.capacityDivider} />
          <View>
            <Text style={[styles.capacityTotalValue, !fits && styles.capacityOverValue]}>
              {over ? `${over}h` : '0h'}
            </Text>
            <Text style={styles.capacityTotalLabel}>{over ? 'OVER' : 'REMAINING'}</Text>
          </View>
        </View>
        <View style={[styles.capacityMessage, fits && styles.capacityMessageSuccess]}>
          <Icon
            name={fits ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            size={20}
            color={fits ? colors.sageDeep : colors.danger}
          />
          <Text
            style={[styles.capacityMessageText, fits && styles.capacityMessageTextSuccess]}
          >
            {fits
              ? `Your ${total}-hour plan fits within 11 available hours.`
              : `You have committed ${total} hours but only have 11 available.`}
          </Text>
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}>
          <View>
            <Text style={styles.sectionTitle}>This week’s commitments</Text>
            <Text style={styles.sectionCaption}>Focused project hours.</Text>
          </View>
        </View>
        {[
          ['Life OS core workflow', 'Product · scheduled', '3.5h'],
          ['Client project handover', 'Career · fixed', '3h'],
          ...(hasProject
            ? [[state.projectTitle, `${state.pillar} · proposed`, `${state.projectHours}h`]]
            : []),
        ].map(([title, meta, hours]) => (
          <View style={styles.commitmentRow} key={title}>
            <View style={styles.commitmentIcon}>
              <Icon name="time-outline" size={16} color={colors.sageDeep} />
            </View>
            <View style={styles.commitmentCopy}>
              <Text style={styles.commitmentTitle}>{title}</Text>
              <Text style={styles.commitmentMeta}>{meta}</Text>
            </View>
            <Text style={styles.commitmentHours}>{hours}</Text>
          </View>
        ))}
      </Card>

      {!fits && hasProject && (
        <View>
          <View style={styles.sectionTitleRowStandalone}>
            <View>
              <Text style={styles.sectionTitle}>Make the trade-off</Text>
              <Text style={styles.sectionCaption}>Recover {over} hours before accepting.</Text>
            </View>
          </View>
          <View style={styles.remedyGrid}>
            <Pressable style={styles.remedyCard} onPress={onReduce}>
              <View style={styles.remedyIcon}>
                <Icon name="cut-outline" size={19} color={colors.sageDeep} />
              </View>
              <Text style={styles.remedyTitle}>Reduce scope</Text>
              <Text style={styles.remedyText}>Trim this project to 4.5h</Text>
            </Pressable>
            <Pressable
              style={styles.remedyCard}
              onPress={() => notify('Choose lower-priority work to delay.')}
            >
              <View style={styles.remedyIcon}>
                <Icon name="pause-outline" size={19} color={colors.sageDeep} />
              </View>
              <Text style={styles.remedyTitle}>Delay work</Text>
              <Text style={styles.remedyText}>Move a lower priority</Text>
            </Pressable>
            <Pressable
              style={styles.remedyCard}
              onPress={() => notify('Delegation note added.')}
            >
              <View style={styles.remedyIcon}>
                <Icon name="people-outline" size={19} color={colors.sageDeep} />
              </View>
              <Text style={styles.remedyTitle}>Delegate</Text>
              <Text style={styles.remedyText}>Assign a supporting action</Text>
            </Pressable>
            <Pressable
              style={styles.remedyCard}
              onPress={() => notify('Next week has 5.5h available.')}
            >
              <View style={styles.remedyIcon}>
                <Icon name="calendar-outline" size={19} color={colors.sageDeep} />
              </View>
              <Text style={styles.remedyTitle}>Reschedule</Text>
              <Text style={styles.remedyText}>Review next week</Text>
            </Pressable>
          </View>
        </View>
      )}

      {fits && hasProject && !state.scheduled && (
        <Card style={styles.scheduleCard}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.scheduleCopy}>
              <Text style={styles.sectionTitle}>Schedule the next action</Text>
              <Text style={styles.sectionCaption} numberOfLines={2}>
                {state.actionTitle}
              </Text>
            </View>
            <Pill>{state.actionHours}h · Focus</Pill>
          </View>
          <View style={styles.dayRow}>
            {[
              ['Mon', '10'],
              ['Tue', '11'],
              ['Wed', '12'],
              ['Thu', '13'],
              ['Fri', '14'],
            ].map(([day, date]) => (
              <Pressable
                key={day}
                onPress={() => onDay(day)}
                style={[styles.dayButton, state.scheduleDay === day && styles.dayButtonSelected]}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    state.scheduleDay === day && styles.dayTextSelected,
                  ]}
                >
                  {day}
                </Text>
                <Text
                  style={[
                    styles.dayDate,
                    state.scheduleDay === day && styles.dayDateSelected,
                  ]}
                >
                  {date}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.scheduleTimeRow}>
            <View>
              <Text style={styles.inputLabel}>START TIME</Text>
              <Text style={styles.scheduleTime}>09:00</Text>
            </View>
            <Icon name="arrow-forward" size={15} color={colors.muted} />
            <View>
              <Text style={styles.inputLabel}>END TIME</Text>
              <Text style={styles.scheduleTime}>11:00</Text>
            </View>
            <View style={styles.scheduleEnergy}>
              <Icon name="flash-outline" size={14} color={colors.sageDeep} />
              <Text style={styles.scheduleEnergyText}>Deep focus</Text>
            </View>
          </View>
          <Button style={styles.fullButton} onPress={onSchedule}>
            <View style={styles.buttonContent}>
              <Text style={styles.buttonText}>Schedule and open Daily Brief</Text>
              <Icon name="arrow-forward" size={15} color="white" />
            </View>
          </Button>
        </Card>
      )}
    </View>
  );
}

function ReviewScreen({
  state,
  onGenerate,
}: {
  state: PrototypeState;
  onGenerate: () => void;
}) {
  if (state.scorecard) return <ScorecardScreen state={state} />;

  return (
    <View>
      <ScreenHeader
        eyebrow="Week 32 · Founder review"
        title="Weekly CEO Review"
        subtitle="Step out of the work. Keep what creates leverage, remove what does not, and protect next week."
      />

      <Card style={styles.reviewHero}>
        <View style={styles.reviewHeroIcon}>
          <Icon name="bar-chart-outline" size={20} color={colors.sageDeep} />
        </View>
        <View style={styles.reviewHeroCopy}>
          <Text style={styles.reviewHeroTitle}>Six sections ready</Text>
          <Text style={styles.reviewHeroText}>
            Your plan uses 11 of 11 hours. New work must replace an existing commitment.
          </Text>
        </View>
        <Pill>6/6</Pill>
      </Card>

      <ReviewSection
        icon="trophy-outline"
        title="Results"
        caption="What moved forward this week?"
      >
        <View style={styles.reviewMetrics}>
          {[
            [state.complete ? '8' : '7', 'Actions'],
            ['2', 'Milestones'],
            ['78%', 'Priorities'],
          ].map(([value, label]) => (
            <View style={styles.reviewMetric} key={label}>
              <Text style={styles.reviewMetricValue}>{value}</Text>
              <Text style={styles.reviewMetricLabel}>{label}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.reviewAnswer}>
          {state.complete
            ? `${state.actionTitle} completed, moving ${state.projectTitle} into active validation.`
            : 'The Life OS core workflow is ready for founder validation.'}
        </Text>
      </ReviewSection>

      <ReviewSection
        icon="time-outline"
        title="Time & attention"
        caption="Planned 11h · used 10.5h"
      >
        {[
          ['Product', '5.5h', 76],
          ['Business', '2.5h', 45],
          ['Career', '2h', 36],
          ['Wealth', '0.5h', 12],
        ].map(([label, hours, value]) => (
          <View style={styles.reviewBarRow} key={String(label)}>
            <Text style={styles.reviewBarLabel}>{label}</Text>
            <View style={styles.reviewBar}>
              <View style={[styles.reviewBarFill, { width: `${Number(value)}%` }]} />
            </View>
            <Text style={styles.reviewBarHours}>{hours}</Text>
          </View>
        ))}
      </ReviewSection>

      <ReviewSection
        icon="alert-circle-outline"
        title="Bottlenecks & decisions"
        caption="Name the friction. Decide what changes."
      >
        <View style={styles.reviewDecision}>
          <Text style={styles.inputLabel}>MAIN BOTTLENECK</Text>
          <Text style={styles.reviewAnswer}>
            Too many active workstreams diluted deep-focus time on Tuesday.
          </Text>
        </View>
        <View style={styles.reviewDecision}>
          <Text style={styles.inputLabel}>DECISION</Text>
          <Text style={styles.reviewAnswer}>
            Pause portfolio automation until the Life OS pilot is validated.
          </Text>
        </View>
      </ReviewSection>

      <ReviewSection
        icon="flag-outline"
        title="Next week’s outcomes"
        caption="Fewer priorities. Clear finish lines."
      >
        {[
          state.projectTitle
            ? `Validate “${state.projectTitle}” with one founder workflow`
            : 'Validate the Life OS prototype',
          'Finalize the client handover',
          'Complete a 60-minute wealth review',
        ].map((outcome, index) => (
          <View style={styles.outcomeRow} key={outcome}>
            <View style={styles.outcomeNumber}>
              <Text style={styles.outcomeNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.outcomeText}>{outcome}</Text>
          </View>
        ))}
      </ReviewSection>

      <Button style={styles.fullButton} onPress={onGenerate}>
        <View style={styles.buttonContent}>
          <Icon name="sparkles-outline" size={16} color="white" />
          <Text style={styles.buttonText}>Generate CEO Scorecard</Text>
          <Icon name="arrow-forward" size={15} color="white" />
        </View>
      </Button>
    </View>
  );
}

function ReviewSection({
  icon,
  title,
  caption,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  caption: string;
  children: ReactNode;
}) {
  return (
    <Card style={styles.reviewSection}>
      <View style={styles.reviewSectionHeader}>
        <View style={styles.reviewSectionIcon}>
          <Icon name={icon} size={17} color={colors.sageDeep} />
        </View>
        <View style={styles.reviewSectionCopy}>
          <Text style={styles.reviewSectionTitle}>{title}</Text>
          <Text style={styles.reviewSectionCaption}>{caption}</Text>
        </View>
        <Icon name="checkmark-circle" size={19} color={colors.sageDeep} />
      </View>
      <View style={styles.reviewSectionBody}>{children}</View>
    </Card>
  );
}

function ScorecardScreen({ state }: { state: PrototypeState }) {
  return (
    <View>
      <ScreenHeader
        eyebrow="Week 32 · Complete"
        title="CEO Scorecard"
        subtitle="One page. The signal from the week and the commitments that matter next."
      />
      <Card style={styles.scorecard}>
        <LinearGradient
          colors={['#1B3B30', '#10251F']}
          style={styles.scorecardHero}
        >
          <View style={styles.eyebrowRow}>
            <Icon name="checkmark-circle-outline" size={12} color={colors.acid} />
            <Text style={styles.eyebrowLight}>WEEKLY REVIEW COMPLETE</Text>
          </View>
          <Text style={styles.scorecardHeadline}>Focus is translating into progress.</Text>
          <Text style={styles.scorecardIntro}>
            You completed 78% of planned priorities and protected your available capacity.
          </Text>
        </LinearGradient>

        <View style={styles.scorecardSection}>
          <Text style={styles.scorecardLabel}>NEXT WEEK’S TOP OUTCOMES</Text>
          {[
            state.projectTitle
              ? `Validate “${state.projectTitle}” with one founder workflow`
              : 'Validate the Life OS prototype',
            'Finalize client handover',
            'Complete wealth pillar review',
          ].map((outcome, index) => (
            <View style={styles.outcomeRow} key={outcome}>
              <View style={styles.outcomeNumber}>
                <Text style={styles.outcomeNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.outcomeText}>{outcome}</Text>
            </View>
          ))}
        </View>

        <View style={styles.scorecardSection}>
          <Text style={styles.scorecardLabel}>PERFORMANCE</Text>
          <View style={styles.reviewMetrics}>
            {[
              ['78%', 'Priorities'],
              ['10.5h', 'Focused'],
              ['2', 'Milestones'],
            ].map(([value, label]) => (
              <View style={styles.reviewMetric} key={label}>
                <Text style={styles.reviewMetricValue}>{value}</Text>
                <Text style={styles.reviewMetricLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.scorecardSection}>
          <Text style={styles.scorecardLabel}>PILLAR HEALTH</Text>
          {pillarData.slice(0, 4).map((pillar) => (
            <View style={styles.reviewBarRow} key={pillar.name}>
              <Text style={styles.reviewBarLabel}>{pillar.name}</Text>
              <View style={styles.reviewBar}>
                <View
                  style={[styles.reviewBarFill, { width: `${pillar.progress}%` }]}
                />
              </View>
              <Text style={styles.reviewBarHours}>{pillar.progress}%</Text>
            </View>
          ))}
        </View>

        <View style={styles.scorecardSection}>
          <Text style={styles.scorecardLabel}>CAPACITY & RISK</Text>
          <View style={styles.reviewMetrics}>
            {[
              ['11h', 'Available'],
              ['11h', 'Planned'],
              ['1', 'At risk'],
            ].map(([value, label]) => (
              <View style={styles.reviewMetric} key={label}>
                <Text style={styles.reviewMetricValue}>{value}</Text>
                <Text style={styles.reviewMetricLabel}>{label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.scorecardAlert}>
            <Icon name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={styles.scorecardAlertText}>
              Protect next week from new commitments. Wealth needs one focused action.
            </Text>
          </View>
        </View>
      </Card>
    </View>
  );
}

function CaptureModal({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (title: string, note: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');

  function save() {
    if (!title.trim()) return;
    onSave(title.trim(), note.trim());
    setTitle('');
    setNote('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <Pressable style={styles.modalDismissArea} onPress={onClose} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View>
              <View style={styles.eyebrowRow}>
                <Icon name="bulb-outline" size={12} color={colors.sageDeep} />
                <Text style={styles.eyebrow}>IDEA INBOX</Text>
              </View>
              <Text style={styles.modalTitle}>Capture it. Don’t commit yet.</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Icon name="close" size={20} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalBody}
          >
            <Text style={styles.inputLabel}>WHAT ARE YOU THINKING ABOUT?</Text>
            <TextInput
              autoFocus
              placeholder="e.g. Run a five-founder pilot"
              placeholderTextColor="#9BA49E"
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
            />
            <Text style={styles.inputLabel}>A LITTLE CONTEXT (OPTIONAL)</Text>
            <TextInput
              multiline
              placeholder="What sparked this, and why might it matter?"
              placeholderTextColor="#9BA49E"
              style={[styles.textInput, styles.textArea]}
              value={note}
              onChangeText={setNote}
            />
            <View style={styles.infoNote}>
              <Icon name="archive-outline" size={17} color={colors.sageDeep} />
              <Text style={styles.infoNoteText}>
                This enters Idea Studio. It will not affect your projects or capacity
                until you choose to develop it.
              </Text>
            </View>
            <Button disabled={!title.trim()} style={styles.fullButton} onPress={save}>
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Save to Idea Studio</Text>
                <Icon name="arrow-forward" size={15} color="white" />
              </View>
            </Button>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ProjectModal({
  visible,
  state,
  onClose,
  onSave,
}: {
  visible: boolean;
  state: PrototypeState;
  onClose: () => void;
  onSave: (project: {
    title: string;
    outcome: string;
    hours: number;
    action: string;
    actionHours: number;
  }) => void;
}) {
  const [title, setTitle] = useState('');
  const [outcome, setOutcome] = useState('');
  const [action, setAction] = useState('');

  useEffect(() => {
    if (visible) {
      setTitle(state.ideaTitle || 'Run the Life OS founder pilot');
      setOutcome(
        state.ideaNote || 'Validate the core planning loop with five founder workflows.',
      );
      setAction(`Create the first working draft of ${state.ideaTitle || 'the founder pilot'}`);
    }
  }, [state.ideaNote, state.ideaTitle, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalBackdrop}
      >
        <Pressable style={styles.modalDismissAreaSmall} onPress={onClose} />
        <View style={[styles.modalSheet, styles.modalSheetTall]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <View style={styles.eyebrowRow}>
                <Icon name="flag-outline" size={12} color={colors.sageDeep} />
                <Text style={styles.eyebrow}>CONVERT IDEA · {state.pillar.toUpperCase()}</Text>
              </View>
              <Text style={styles.modalTitle}>Define the commitment.</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={onClose}>
              <Icon name="close" size={20} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.modalBody}
          >
            <Text style={styles.inputLabel}>PROJECT TITLE</Text>
            <TextInput style={styles.textInput} value={title} onChangeText={setTitle} />
            <Text style={styles.inputLabel}>DESIRED OUTCOME</Text>
            <TextInput
              multiline
              style={[styles.textInput, styles.textArea]}
              value={outcome}
              onChangeText={setOutcome}
            />
            <View style={styles.formTwoColumn}>
              <View style={styles.formColumn}>
                <Text style={styles.inputLabel}>ESTIMATED EFFORT</Text>
                <View style={styles.staticInput}>
                  <Text style={styles.staticInputText}>7.5 hours</Text>
                </View>
              </View>
              <View style={styles.formColumn}>
                <Text style={styles.inputLabel}>PRIORITY</Text>
                <View style={styles.staticInput}>
                  <Text style={styles.staticInputText}>High</Text>
                </View>
              </View>
            </View>
            <Text style={styles.inputLabel}>CLEAR NEXT ACTION</Text>
            <TextInput
              style={styles.textInput}
              value={action}
              onChangeText={setAction}
            />
            <View style={styles.formTwoColumn}>
              <View style={styles.formColumn}>
                <Text style={styles.inputLabel}>DURATION</Text>
                <View style={styles.staticInput}>
                  <Text style={styles.staticInputText}>2 hours</Text>
                </View>
              </View>
              <View style={styles.formColumn}>
                <Text style={styles.inputLabel}>ENERGY</Text>
                <View style={styles.staticInput}>
                  <Text style={styles.staticInputText}>Deep focus</Text>
                </View>
              </View>
            </View>
            <Button
              disabled={!title.trim() || !outcome.trim() || !action.trim()}
              style={styles.fullButton}
              onPress={() =>
                onSave({
                  title: title.trim(),
                  outcome: outcome.trim(),
                  hours: 7.5,
                  action: action.trim(),
                  actionHours: 2,
                })
              }
            >
              <View style={styles.buttonContent}>
                <Text style={styles.buttonText}>Create project & check capacity</Text>
                <Icon name="arrow-forward" size={15} color="white" />
              </View>
            </Button>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AppContent() {
  const [tab, setTab] = useState<Tab>('command');
  const [modal, setModal] = useState<ModalName>(null);
  const [state, setState] = useState<PrototypeState>(initialState);
  const [notice, setNotice] = useState('');
  const loaded = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    AsyncStorage.getItem('life-os-native-prototype')
      .then((value) => {
        if (value) setState(JSON.parse(value) as PrototypeState);
      })
      .finally(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (loaded.current) {
      void AsyncStorage.setItem('life-os-native-prototype', JSON.stringify(state));
    }
  }, [state]);

  function patch(patchValue: Partial<PrototypeState>) {
    setState((current) => ({ ...current, ...patchValue }));
  }

  function notify(message: string) {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2600);
  }

  function selectTab(next: Tab) {
    tap();
    setTab(next);
  }

  function reset() {
    tap(Haptics.ImpactFeedbackStyle.Medium);
    setState(initialState);
    setTab('command');
    setModal(null);
    void AsyncStorage.removeItem('life-os-native-prototype');
    notify('Prototype journey reset.');
  }

  const tabs = [
    ['command', 'grid-outline', 'Command'],
    ['portfolio', 'layers-outline', 'Pillars'],
    ['ideas', 'bulb-outline', 'Ideas'],
    ['capacity', 'speedometer-outline', 'Capacity'],
    ['review', 'bar-chart-outline', 'Review'],
  ] as const;

  return (
    <SafeAreaView
      style={[styles.safeArea, Platform.OS === 'web' && styles.webFrame]}
      edges={['top']}
    >
      <StatusBar style="dark" />
      <View style={styles.appHeader}>
        <View style={styles.brandRow}>
          <View style={styles.brandMark}>
            <View style={styles.brandMarkInner} />
          </View>
          <View>
            <Text style={styles.brandName}>Life OS</Text>
            <Text style={styles.brandCaption}>Founder workspace</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton} onPress={reset}>
            <Icon name="refresh-outline" size={18} />
          </Pressable>
          <Pressable style={styles.iconButton} onPress={() => notify('2 strategic alerts.')}>
            <Icon name="notifications-outline" size={18} />
            <View style={styles.notificationDot} />
          </Pressable>
          <Pressable
            style={styles.captureButton}
            onPress={() => {
              tap();
              setModal('capture');
            }}
          >
            <Icon name="add" size={22} color="white" />
          </Pressable>
        </View>
      </View>

      <Journey step={Math.min(state.step, 6)} />

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 16) + 94 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'command' && (
          <CommandScreen
            state={state}
            onComplete={() => {
              patch({ complete: true, step: 6 });
              tap(Haptics.ImpactFeedbackStyle.Heavy);
              notify('Primary Move complete — strong progress.');
            }}
            onOpenReview={() => setTab('review')}
            onOpenIdeas={() => setTab('ideas')}
            onOpenCapacity={() => setTab('capacity')}
            notify={notify}
          />
        )}
        {tab === 'ideas' && (
          <IdeaScreen
            state={state}
            onCapture={() => setModal('capture')}
            onEvaluate={() => {
              patch({ evaluating: true, step: Math.max(1, state.step) });
              tap(Haptics.ImpactFeedbackStyle.Medium);
            }}
            onPillar={(pillar) => patch({ pillar })}
            onProject={() => {
              patch({ step: 2 });
              setModal('project');
            }}
          />
        )}
        {tab === 'portfolio' && <PortfolioScreen state={state} />}
        {tab === 'capacity' && (
          <CapacityScreen
            state={state}
            onReduce={() => {
              patch({ projectHours: 4.5, step: 4 });
              tap(Haptics.ImpactFeedbackStyle.Heavy);
              notify('Scope reduced by 3 hours. The plan now fits.');
            }}
            onDay={(scheduleDay) => patch({ scheduleDay })}
            onSchedule={() => {
              patch({ scheduled: true, step: 5 });
              setTab('command');
              successTap();
              notify(`Next action scheduled for ${state.scheduleDay}.`);
            }}
            notify={notify}
          />
        )}
        {tab === 'review' && (
          <ReviewScreen
            state={state}
            onGenerate={() => {
              patch({ scorecard: true, step: 7 });
              tap(Haptics.ImpactFeedbackStyle.Heavy);
              notify('Weekly CEO Scorecard generated.');
            }}
          />
        )}
      </ScrollView>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {tabs.map(([key, icon, label]) => {
          const active = tab === key;
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={key}
              onPress={() => selectTab(key)}
              style={styles.tabItem}
            >
              <View style={[styles.tabIcon, active && styles.tabIconActive]}>
                <Icon
                  name={icon}
                  size={20}
                  color={active ? colors.ink : '#89938D'}
                />
                {key === 'ideas' && Boolean(state.ideaTitle) && (
                  <View style={styles.tabBadge} />
                )}
              </View>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <CaptureModal
        visible={modal === 'capture'}
        onClose={() => setModal(null)}
        onSave={(title, note) => {
          patch({
            ideaTitle: title,
            ideaNote: note,
            evaluating: false,
            step: Math.max(1, state.step),
          });
          setModal(null);
          setTab('ideas');
          successTap();
          notify('Idea captured — no commitment created.');
        }}
      />
      <ProjectModal
        visible={modal === 'project'}
        state={state}
        onClose={() => setModal(null)}
        onSave={(project) => {
          patch({
            step: 3,
            projectTitle: project.title,
            projectOutcome: project.outcome,
            projectHours: project.hours,
            actionTitle: project.action,
            actionHours: project.actionHours,
          });
          setModal(null);
          setTab('capacity');
          notify('Project created. Now check whether it fits.');
        }}
      />

      {notice ? (
        <View style={[styles.toast, { bottom: 80 + Math.max(insets.bottom, 8) }]}>
          <Icon name="checkmark-circle" size={17} color={colors.acid} />
          <Text style={styles.toastText}>{notice}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider style={styles.host}>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
    backgroundColor: '#E5EAE4',
  },
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  webFrame: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#D4DAD4',
    shadowColor: '#10251F',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
  },
  appHeader: {
    height: 66,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: 'rgba(244,245,240,0.98)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.sageDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.acid,
  },
  brandName: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  brandCaption: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
  },
  captureButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  notificationDot: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: 'white',
  },
  journey: {
    maxHeight: 49,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  journeyContent: {
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 3,
  },
  journeyPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  journeyItem: {
    height: 33,
    paddingHorizontal: 7,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  journeyItemCurrent: {
    backgroundColor: colors.ink,
  },
  journeyItemDone: {
    backgroundColor: '#EEF3EA',
  },
  journeyNumber: {
    width: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#A5AFA8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  journeyNumberCurrent: {
    borderColor: 'rgba(255,255,255,0.6)',
  },
  journeyNumberDone: {
    backgroundColor: colors.sage,
    borderColor: '#AEC5A7',
  },
  journeyNumberText: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '700',
  },
  journeyNumberTextCurrent: {
    color: 'white',
  },
  journeyLabel: {
    color: '#87918B',
    fontSize: 9,
    fontWeight: '600',
  },
  journeyLabelCurrent: {
    color: 'white',
  },
  journeyLabelDone: {
    color: colors.sageDeep,
  },
  contentScroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  screenHeader: {
    marginBottom: 22,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    color: colors.sageDeep,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  eyebrowLight: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  screenTitle: {
    flex: 1,
    color: colors.ink,
    fontFamily: serif,
    fontSize: 32,
    lineHeight: 37,
    letterSpacing: -1.1,
  },
  screenSubtitle: {
    maxWidth: 570,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  headerArrow: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.ink,
  },
  buttonSecondary: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonAcid: {
    backgroundColor: colors.acid,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonPressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  buttonTextSecondary: {
    color: colors.ink,
  },
  buttonTextAcid: {
    color: colors.acidInk,
    fontSize: 11,
    fontWeight: '700',
  },
  buttonTextGhost: {
    color: colors.muted,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fullButton: {
    width: '100%',
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: '#EEF3EA',
  },
  pillAmber: {
    backgroundColor: colors.amberSoft,
  },
  pillInk: {
    backgroundColor: colors.ink,
  },
  pillText: {
    color: colors.sageDeep,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '700',
  },
  pillTextAmber: {
    color: '#9B573C',
  },
  pillTextInk: {
    color: 'white',
  },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 17,
    backgroundColor: colors.paper,
    shadowColor: '#1C2D26',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  primaryCard: {
    minHeight: 264,
    borderRadius: 19,
    padding: 22,
    overflow: 'hidden',
    marginBottom: 14,
  },
  primaryTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  primaryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.acid,
  },
  primaryLabelText: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
  },
  primaryTime: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
  },
  primaryTitle: {
    color: 'white',
    fontFamily: serif,
    fontSize: 29,
    lineHeight: 34,
    letterSpacing: -0.9,
    marginTop: 27,
  },
  primaryDescription: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 8,
  },
  primaryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 23,
  },
  primaryProject: {
    flex: 1,
    color: 'rgba(255,255,255,0.46)',
    fontSize: 9,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  capacitySummary: {
    flex: 1.55,
    padding: 16,
  },
  riskSummary: {
    flex: 0.85,
    padding: 14,
    justifyContent: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCaption: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 13,
    marginTop: 3,
  },
  textLink: {
    color: colors.sageDeep,
    fontSize: 9,
    fontWeight: '700',
  },
  capacityNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 17,
    marginBottom: 9,
  },
  capacityBig: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 28,
  },
  progressTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E9EDE8',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#78996B',
  },
  progressFillWarning: {
    backgroundColor: colors.danger,
  },
  capacityMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  capacityMetaText: {
    color: colors.muted,
    fontSize: 8,
  },
  riskIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: '#FBEBE6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  riskNumber: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 25,
  },
  riskLabel: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: '700',
  },
  riskDetail: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 4,
  },
  sectionCard: {
    padding: 18,
    marginBottom: 14,
  },
  actionRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8ECE8',
  },
  actionRowFirst: {
    marginTop: 12,
  },
  actionCheck: {
    width: 21,
    height: 21,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#C7CFC8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCheckDone: {
    borderColor: colors.sageDeep,
    backgroundColor: colors.sageDeep,
  },
  actionCopy: {
    flex: 1,
  },
  actionTitle: {
    color: colors.ink,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  actionTitleDone: {
    color: '#98A19B',
    textDecorationLine: 'line-through',
  },
  actionMeta: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 4,
  },
  sectionTitleRowStandalone: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 7,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  pillarScroll: {
    gap: 10,
    paddingBottom: 2,
    paddingRight: 18,
  },
  pillarMini: {
    width: 135,
    padding: 13,
  },
  pillarMiniTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pillarIcon: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: '#EEF3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#79A16A',
  },
  healthDotAmber: {
    backgroundColor: '#DDA84B',
  },
  pillarName: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
  },
  pillarHealth: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 3,
    marginBottom: 10,
  },
  ideaPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    backgroundColor: colors.paper,
    padding: 14,
    marginTop: 14,
  },
  ideaPromptIcon: {
    width: 37,
    height: 37,
    borderRadius: 11,
    backgroundColor: '#EEF3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ideaPromptCopy: {
    flex: 1,
  },
  ideaPromptTitle: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  ideaPromptText: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 3,
  },
  roundAction: {
    width: 39,
    height: 39,
    borderRadius: 13,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    gap: 7,
    paddingRight: 16,
    marginBottom: 14,
  },
  filterPill: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  filterPillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  filterText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
  },
  filterTextActive: {
    color: 'white',
  },
  ideaList: {
    overflow: 'hidden',
    marginBottom: 14,
  },
  ideaRow: {
    minHeight: 72,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  ideaIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF3EA',
  },
  ideaRowCopy: {
    flex: 1,
  },
  ideaTitle: {
    color: colors.ink,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
  },
  ideaMeta: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 4,
  },
  evaluationCard: {
    overflow: 'hidden',
  },
  evaluationHeader: {
    padding: 20,
  },
  evaluationTitle: {
    color: 'white',
    fontFamily: serif,
    fontSize: 25,
    lineHeight: 29,
    marginTop: 10,
  },
  evaluationDescription: {
    color: 'rgba(255,255,255,0.54)',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 6,
  },
  evaluationBody: {
    padding: 18,
  },
  inputLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 7,
  },
  pillarChoiceRow: {
    gap: 7,
    marginBottom: 17,
  },
  choicePill: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  choicePillSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  choiceText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: '600',
  },
  choiceTextSelected: {
    color: 'white',
  },
  scoreList: {
    gap: 11,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreLabel: {
    color: colors.inkSoft,
    fontSize: 10,
  },
  scoreDots: {
    flexDirection: 'row',
    gap: 4,
  },
  scoreDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
    backgroundColor: '#E5EAE4',
  },
  scoreDotFilled: {
    backgroundColor: '#709263',
  },
  scoreSummary: {
    minHeight: 62,
    borderRadius: 12,
    backgroundColor: '#F0F5ED',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 18,
  },
  scoreSummaryLabel: {
    color: colors.sageDeep,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  scoreSummaryHint: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 3,
  },
  scoreSummaryNumber: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 27,
  },
  emptyEvaluation: {
    alignItems: 'center',
    padding: 26,
  },
  emptyTitle: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 21,
    marginTop: 10,
  },
  emptyText: {
    color: colors.muted,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 15,
    marginTop: 5,
  },
  pillarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pillarCard: {
    width: '48.5%',
    minHeight: 150,
    padding: 14,
  },
  pillarCardName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 12,
  },
  pillarPercent: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 19,
    marginBottom: 7,
  },
  projectList: {
    overflow: 'hidden',
  },
  projectRow: {
    minHeight: 70,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  projectIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: '#EEF3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectCopy: {
    flex: 1,
  },
  projectTitle: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
  },
  projectMeta: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 4,
  },
  capacityHero: {
    padding: 19,
    marginBottom: 14,
  },
  capacityHeroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 18,
  },
  capacityPercentBox: {
    width: 91,
    height: 91,
    borderRadius: 46,
    backgroundColor: '#F0F3EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  capacityHeroPercent: {
    color: colors.sageDeep,
    fontFamily: serif,
    fontSize: 26,
  },
  capacityHeroPercentWarning: {
    color: colors.danger,
  },
  capacityHeroLabel: {
    color: colors.muted,
    fontSize: 7,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  capacityHeroCopy: {
    flex: 1,
  },
  capacityHeroTitle: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 23,
    lineHeight: 27,
  },
  capacityHeroDescription: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 14,
    marginTop: 5,
  },
  capacityTotals: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 18,
  },
  capacityTotalValue: {
    color: colors.ink,
    fontFamily: serif,
    textAlign: 'center',
    fontSize: 20,
  },
  capacityOverValue: {
    color: colors.danger,
  },
  capacityTotalLabel: {
    color: colors.muted,
    fontSize: 7,
    letterSpacing: 0.7,
    textAlign: 'center',
    marginTop: 3,
  },
  capacityDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.line,
  },
  capacityMessage: {
    minHeight: 55,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.amberSoft,
  },
  capacityMessageSuccess: {
    backgroundColor: '#F0F5ED',
  },
  capacityMessageText: {
    flex: 1,
    color: '#95513A',
    fontSize: 9,
    lineHeight: 14,
    fontWeight: '600',
  },
  capacityMessageTextSuccess: {
    color: colors.sageDeep,
  },
  commitmentRow: {
    minHeight: 59,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  commitmentIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EEF3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commitmentCopy: {
    flex: 1,
  },
  commitmentTitle: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  commitmentMeta: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 3,
  },
  commitmentHours: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  remedyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
    marginBottom: 14,
  },
  remedyCard: {
    width: '48.7%',
    minHeight: 112,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 15,
    padding: 13,
    backgroundColor: colors.paper,
  },
  remedyIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#EEF3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remedyTitle: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 9,
  },
  remedyText: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 3,
  },
  scheduleCard: {
    padding: 18,
  },
  scheduleCopy: {
    flex: 1,
  },
  dayRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 17,
  },
  dayButton: {
    flex: 1,
    height: 59,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  dayLabel: {
    color: colors.ink,
    fontSize: 9,
    fontWeight: '700',
  },
  dayTextSelected: {
    color: 'white',
  },
  dayDate: {
    color: colors.muted,
    fontSize: 9,
    marginTop: 4,
  },
  dayDateSelected: {
    color: 'rgba(255,255,255,0.58)',
  },
  scheduleTimeRow: {
    minHeight: 67,
    borderRadius: 12,
    backgroundColor: '#F4F6F2',
    paddingHorizontal: 13,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  scheduleTime: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  scheduleEnergy: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scheduleEnergyText: {
    color: colors.sageDeep,
    fontSize: 9,
    fontWeight: '600',
  },
  reviewHero: {
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    marginBottom: 12,
  },
  reviewHeroIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewHeroCopy: {
    flex: 1,
  },
  reviewHeroTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  reviewHeroText: {
    color: colors.muted,
    fontSize: 8,
    lineHeight: 12,
    marginTop: 3,
  },
  reviewSection: {
    overflow: 'hidden',
    marginBottom: 12,
  },
  reviewSectionHeader: {
    minHeight: 63,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewSectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: '#EEF3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewSectionCopy: {
    flex: 1,
  },
  reviewSectionTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  reviewSectionCaption: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 3,
  },
  reviewSectionBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    padding: 15,
    backgroundColor: '#FBFCFA',
  },
  reviewMetrics: {
    flexDirection: 'row',
    gap: 8,
  },
  reviewMetric: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    padding: 11,
    backgroundColor: colors.paper,
  },
  reviewMetricValue: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 20,
  },
  reviewMetricLabel: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 3,
  },
  reviewAnswer: {
    color: colors.inkSoft,
    fontSize: 10,
    lineHeight: 16,
    marginTop: 12,
  },
  reviewBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginTop: 10,
  },
  reviewBarLabel: {
    width: 61,
    color: colors.inkSoft,
    fontSize: 9,
  },
  reviewBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E9EDE8',
    overflow: 'hidden',
  },
  reviewBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#78996B',
  },
  reviewBarHours: {
    width: 35,
    color: colors.ink,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'right',
  },
  reviewDecision: {
    borderRadius: 11,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 8,
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  outcomeNumber: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: '#EEF3EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeNumberText: {
    color: colors.sageDeep,
    fontSize: 8,
    fontWeight: '800',
  },
  outcomeText: {
    flex: 1,
    color: colors.ink,
    fontSize: 10,
    lineHeight: 15,
  },
  scorecard: {
    overflow: 'hidden',
  },
  scorecardHero: {
    padding: 22,
  },
  scorecardHeadline: {
    color: 'white',
    fontFamily: serif,
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.8,
    marginTop: 13,
  },
  scorecardIntro: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    lineHeight: 16,
    marginTop: 7,
  },
  scorecardSection: {
    padding: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  scorecardLabel: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  scorecardAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 11,
    padding: 11,
    backgroundColor: colors.amberSoft,
    marginTop: 12,
  },
  scorecardAlertText: {
    flex: 1,
    color: '#95513A',
    fontSize: 8,
    lineHeight: 13,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10,24,19,0.58)',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalDismissAreaSmall: {
    flex: 0.18,
  },
  modalSheet: {
    maxHeight: '86%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.paper,
    overflow: 'hidden',
  },
  modalSheetTall: {
    maxHeight: '94%',
    flex: 1,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4DAD5',
    marginTop: 9,
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 17,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  modalHeaderCopy: {
    flex: 1,
  },
  modalTitle: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 25,
    lineHeight: 29,
    marginTop: 6,
  },
  closeButton: {
    width: 35,
    height: 35,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: 20,
    paddingBottom: 35,
  },
  textInput: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 13,
    color: colors.ink,
    fontSize: 11,
    backgroundColor: colors.paper,
    marginBottom: 15,
  },
  textArea: {
    minHeight: 92,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F0F5ED',
    marginBottom: 16,
  },
  infoNoteText: {
    flex: 1,
    color: colors.sageDeep,
    fontSize: 9,
    lineHeight: 14,
  },
  formTwoColumn: {
    flexDirection: 'row',
    gap: 10,
  },
  formColumn: {
    flex: 1,
  },
  staticInput: {
    height: 46,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    justifyContent: 'center',
    paddingHorizontal: 13,
    marginBottom: 15,
    backgroundColor: '#F7F8F6',
  },
  staticInputText: {
    color: colors.ink,
    fontSize: 11,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 70,
    paddingTop: 7,
    paddingHorizontal: 6,
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: 'rgba(255,255,255,0.98)',
    shadowColor: '#1C2D26',
    shadowOpacity: 0.08,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: -5 },
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  tabIcon: {
    position: 'relative',
    width: 36,
    height: 31,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconActive: {
    backgroundColor: '#EEF3EA',
  },
  tabLabel: {
    color: '#89938D',
    fontSize: 8,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  tabBadge: {
    position: 'absolute',
    top: 4,
    right: 5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
    borderWidth: 1,
    borderColor: 'white',
  },
  toast: {
    position: 'absolute',
    left: 18,
    right: 18,
    minHeight: 48,
    borderRadius: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: colors.ink,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 7 },
    elevation: 10,
  },
  toastText: {
    flex: 1,
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
});
