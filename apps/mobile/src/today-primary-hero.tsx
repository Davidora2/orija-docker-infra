import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LifeIcon } from './life-icon';
import {
  PRIORITY_QUADRANT_META,
  actionPriorityQuadrant,
} from './priority-matrix';
import type { LifeItem } from './api';
import { bodyNumber, bodyString } from './life-data';

const colors = {
  ink: '#14241F',
  acid: '#D6F57A',
  acidInk: '#2F431E',
  mutedOnDark: 'rgba(255,255,255,0.55)',
  labelOnDark: 'rgba(255,255,255,0.60)',
  outlineOnDark: 'rgba(255,255,255,0.15)',
  cream: '#FFFFFF',
};

const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
});

function hours(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
}

function actionContext(
  action: LifeItem,
  projects: LifeItem[],
  pillars: LifeItem[],
) {
  const project = projects.find((row) => row.id === action.parentId);
  const area = project
    ? pillars.find((row) => row.id === project.parentId)
    : undefined;
  const label = [area?.title, project?.title].filter(Boolean).join(' · ');
  return { project, area, label };
}

function tap() {
  if (Platform.OS !== 'web') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

function metadataLine(
  action: LifeItem,
  projects: LifeItem[],
  pillars: LifeItem[],
) {
  const { project, label } = actionContext(action, projects, pillars);
  const quadrant =
    PRIORITY_QUADRANT_META[
      actionPriorityQuadrant(action.body, project?.body)
    ].title;
  const day = bodyString(action, 'day');
  return [day, label, quadrant, action.status === 'DONE' ? 'Done' : '']
    .filter(Boolean)
    .join(' · ');
}

type TodayPrimaryHeroProps = {
  primary: LifeItem;
  projects: LifeItem[];
  pillars: LifeItem[];
  busy?: boolean;
  onToggle: () => void;
  onViewCapacity: () => void;
  style?: StyleProp<ViewStyle>;
};

export function TodayPrimaryHero({
  primary,
  projects,
  pillars,
  busy,
  onToggle,
  onViewCapacity,
  style,
}: TodayPrimaryHeroProps) {
  const done = primary.status === 'DONE';
  const meta = metadataLine(primary, projects, pillars);

  return (
    <View style={[styles.hero, style]}>
      <View pointerEvents="none" style={styles.decorRing} />
      <View pointerEvents="none" style={styles.decorRingInner} />

      <View style={styles.heroContent}>
        <View style={styles.heroHeader}>
          <View style={styles.eyebrowRow}>
            <View style={styles.accentDot} />
            <Text style={styles.eyebrow}>Primary move</Text>
          </View>
          <Text style={styles.hours}>
            {hours(bodyNumber(primary, 'hours', 1))}
          </Text>
        </View>

        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.35}
          numberOfLines={4}
          style={[styles.title, done && styles.titleDone]}
        >
          {primary.title}
        </Text>

        {meta ? (
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.25}
            numberOfLines={3}
            style={styles.meta}
          >
            {meta}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={done ? 'Undo complete' : 'Mark done'}
            disabled={busy}
            onPress={() => {
              tap();
              onToggle();
            }}
            style={({ pressed }) => [
              styles.ctaPrimary,
              pressed && styles.ctaPressed,
              busy && styles.ctaDisabled,
            ]}
          >
            <LifeIcon color={colors.acidInk} name="done" size={16} />
            <Text
              allowFontScaling
              maxFontSizeMultiplier={1.2}
              style={styles.ctaPrimaryText}
            >
              {done ? 'Undo complete' : 'Mark done'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View capacity"
            onPress={() => {
              tap();
              onViewCapacity();
            }}
            style={({ pressed }) => [
              styles.ctaSecondary,
              pressed && styles.ctaPressed,
            ]}
          >
            <Text
              allowFontScaling
              maxFontSizeMultiplier={1.2}
              style={styles.ctaSecondaryText}
            >
              View capacity
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.ink,
    borderRadius: 24,
    overflow: 'hidden',
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 6,
  },
  decorRing: {
    position: 'absolute',
    top: -96,
    right: -80,
    width: 256,
    height: 256,
    borderRadius: 128,
    borderWidth: 1,
    borderColor: 'rgba(214,245,122,0.15)',
  },
  decorRingInner: {
    position: 'absolute',
    top: -72,
    right: -56,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(214,245,122,0.08)',
  },
  heroContent: {
    position: 'relative',
    gap: 0,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.acid,
  },
  eyebrow: {
    color: colors.labelOnDark,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  hours: {
    color: 'rgba(255,255,255,0.50)',
    fontSize: 12,
    flexShrink: 0,
  },
  title: {
    color: colors.cream,
    fontFamily: serif,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.3,
    marginTop: 24,
  },
  titleDone: {
    color: 'rgba(255,255,255,0.55)',
    textDecorationLine: 'line-through',
  },
  meta: {
    color: colors.mutedOnDark,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginTop: 24,
  },
  ctaPrimary: {
    alignItems: 'center',
    backgroundColor: colors.acid,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  ctaPrimaryText: {
    color: colors.acidInk,
    fontSize: 12,
    fontWeight: '700',
  },
  ctaSecondary: {
    alignItems: 'center',
    borderColor: colors.outlineOnDark,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  ctaSecondaryText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
  },
  ctaPressed: { opacity: 0.88 },
  ctaDisabled: { opacity: 0.5 },
});
