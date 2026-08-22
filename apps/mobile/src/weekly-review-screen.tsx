import { useCallback, useEffect, useState } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  listWeeklyReviews,
  saveWeeklyReview,
  webAppUrl,
  type WeeklyReview,
} from './api';
import { FocusHero } from './ui';

const colors = {
  ink: '#14241F',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  danger: '#C9634F',
};

function mondayOfCurrentWeek(): string {
  const now = new Date();
  const day = now.getUTCDay();
  now.setUTCDate(now.getUTCDate() - (day === 0 ? 6 : day - 1));
  return now.toISOString().slice(0, 10);
}

function Field({
  label,
  value,
  placeholder,
  onChangeText,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.eyebrow}>{label}</Text>
      <TextInput
        multiline
        value={value}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        onChangeText={onChangeText}
        style={styles.input}
      />
    </View>
  );
}

export function WeeklyReviewScreen({
  householdId,
  completedActions,
  totalActions,
  plannedHours,
  availableHours,
  notify,
}: {
  householdId: string;
  completedActions: number;
  totalActions: number;
  plannedHours: number;
  availableHours: number;
  notify: (message: string) => void;
}) {
  const [history, setHistory] = useState<WeeklyReview[]>([]);
  const [highlights, setHighlights] = useState('');
  const [bottlenecks, setBottlenecks] = useState('');
  const [startDoing, setStartDoing] = useState('');
  const [stopDoing, setStopDoing] = useState('');
  const [continueDoing, setContinueDoing] = useState('');
  const [priorities, setPriorities] = useState(['', '', '']);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setHistory(await listWeeklyReviews());
  }, []);

  useEffect(() => {
    void load().catch((error) =>
      notify(error instanceof Error ? error.message : 'Could not load review history.'),
    );
  }, [load, notify]);

  async function shareReview(review: WeeklyReview) {
    const url = `${webAppUrl}/reviews/${review.id}`;
    await Share.share({
      title: `Life OS weekly review · ${review.weekStart}`,
      message: `Open the private printable review after signing in on the web: ${url}`,
      url,
    });
  }

  async function save() {
    setBusy(true);
    try {
      const review = await saveWeeklyReview({
        schemaVersion: 1,
        householdId,
        weekStart: mondayOfCurrentWeek(),
        results: {
          completedActions,
          totalActions,
          completionRate:
            totalActions === 0 ? 0 : Math.round((completedActions / totalActions) * 100),
          highlights,
        },
        capacity: { plannedHours, availableHours },
        bottlenecks,
        startDoing,
        stopDoing,
        continueDoing,
        nextWeekPriorities: priorities.map((value) => value.trim()).filter(Boolean),
      });
      await load();
      notify('Weekly review saved.');
      await shareReview(review);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not save weekly review.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <FocusHero
        accentDot
        eyebrow={`Results · week of ${mondayOfCurrentWeek()}`}
        meta={`${totalActions === 0 ? 0 : Math.round((completedActions / totalActions) * 100)}% complete · ${plannedHours.toFixed(1)}h planned / ${availableHours}h available`}
        title={`${completedActions} completed · ${Math.max(0, totalActions - completedActions)} open`}
        subtitle="Guided CEO-style check-in"
      />
      <View style={styles.card}>
        <Text style={styles.title}>Guided review</Text>
        <Field
          label="Results & wins"
          value={highlights}
          placeholder="What moved forward?"
          onChangeText={setHighlights}
        />
        <Field
          label="Bottlenecks"
          value={bottlenecks}
          placeholder="What slowed or blocked you?"
          onChangeText={setBottlenecks}
        />
        <Field
          label="Start"
          value={startDoing}
          placeholder="What will you start doing?"
          onChangeText={setStartDoing}
        />
        <Field
          label="Stop"
          value={stopDoing}
          placeholder="What will you stop doing?"
          onChangeText={setStopDoing}
        />
        <Field
          label="Continue"
          value={continueDoing}
          placeholder="What is working?"
          onChangeText={setContinueDoing}
        />
        <Text style={styles.eyebrow}>Next-week priorities</Text>
        {priorities.map((priority, index) => (
          <TextInput
            key={index}
            value={priority}
            placeholder={`Priority ${index + 1}`}
            placeholderTextColor={colors.muted}
            onChangeText={(value) =>
              setPriorities((current) =>
                current.map((item, itemIndex) => (itemIndex === index ? value : item)),
              )
            }
            style={styles.priorityInput}
          />
        ))}
        {priorities.length < 5 ? (
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setPriorities((current) => [...current, ''])}
          >
            <Text style={styles.secondaryText}>Add priority</Text>
          </Pressable>
        ) : null}
        <Pressable
          disabled={busy}
          style={[styles.button, busy && styles.disabled]}
          onPress={() => void save()}
        >
          <Text style={styles.buttonText}>{busy ? 'Saving…' : 'Save & share print link'}</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionTitle}>Review history</Text>
      {history.length ? (
        history.map((review) => (
          <View key={review.id} style={styles.card}>
            <Text style={styles.eyebrow}>Week of {review.weekStart}</Text>
            <Text style={styles.title}>
              {review.results.completedActions}/{review.results.totalActions} completed
            </Text>
            <Text style={styles.body}>{review.results.highlights || 'No highlights added.'}</Text>
            <Pressable
              style={styles.secondaryButton}
              onPress={() => void shareReview(review)}
            >
              <Text style={styles.secondaryText}>Share printable web link</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={styles.body}>Your completed reviews will appear here.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.paper,
    padding: 16,
  },
  sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '700' },
  title: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  eyebrow: {
    color: colors.sageDeep,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  field: { gap: 5 },
  input: {
    minHeight: 76,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    color: colors.ink,
    textAlignVertical: 'top',
  },
  priorityInput: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 12,
    color: colors.ink,
  },
  button: {
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.ink,
    padding: 13,
  },
  buttonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  secondaryButton: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.sage,
    padding: 11,
  },
  secondaryText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.5 },
});
