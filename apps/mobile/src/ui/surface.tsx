import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import { LifeIcon, type LifeIconName } from '../life-icon';
import { colors, radii, serif } from './theme';

export function SurfaceCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionHeader({
  eyebrow,
  title,
  actionLabel,
  onAction,
}: {
  eyebrow?: string;
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        {eyebrow ? (
          <Text allowFontScaling maxFontSizeMultiplier={1.2} style={styles.eyebrow}>
            {eyebrow}
          </Text>
        ) : null}
        <Text allowFontScaling maxFontSizeMultiplier={1.3} style={styles.title}>
          {title}
        </Text>
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ id: T; label: string; icon?: LifeIconName }>;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((option) => {
        const active = value === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(option.id)}
            style={[styles.segmentChip, active && styles.segmentChipActive]}
          >
            {option.icon ? (
              <LifeIcon
                color={active ? colors.acid : colors.sageDeep}
                name={option.icon}
                size={15}
              />
            ) : null}
            <Text
              allowFontScaling
              maxFontSizeMultiplier={1.15}
              numberOfLines={1}
              style={[styles.segmentText, active && styles.segmentTextActive]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function YouMenuHero() {
  return (
    <View style={styles.youHero}>
      <View pointerEvents="none" style={styles.youHeroRing} />
      <Text style={styles.youHeroEyebrow}>You</Text>
      <Text style={styles.youHeroTitle}>Capacity, review, and settings</Text>
      <Text style={styles.youHeroMeta}>
        Keep weekly load honest, run your review, and manage household tools.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radii.card,
    borderWidth: 1,
    gap: 10,
    padding: radii.card,
  },
  sectionHeader: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionCopy: { flex: 1, gap: 4, minWidth: 0 },
  eyebrow: {
    color: colors.sageDeep,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 22,
    lineHeight: 26,
  },
  action: {
    color: colors.sageDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segmentChip: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: radii.chip,
    borderWidth: 1,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  segmentChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  segmentText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  segmentTextActive: { color: colors.acid },
  youHero: {
    backgroundColor: colors.ink,
    borderColor: colors.inkBorder,
    borderRadius: radii.hero,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  youHeroRing: {
    borderColor: colors.acidGlow,
    borderRadius: 90,
    borderWidth: 1,
    height: 180,
    position: 'absolute',
    right: -40,
    top: -60,
    width: 180,
  },
  youHeroEyebrow: {
    color: colors.acid,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  youHeroTitle: {
    color: colors.creamText,
    fontFamily: serif,
    fontSize: 26,
    lineHeight: 30,
    marginTop: 10,
  },
  youHeroMeta: {
    color: colors.mutedOnDark,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
});
