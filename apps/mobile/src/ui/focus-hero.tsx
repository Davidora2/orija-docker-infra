import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import { colors, serif } from './theme';

type FocusHeroProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  meta?: string;
  trailing?: ReactNode;
  accentDot?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function FocusHero({
  eyebrow,
  title,
  subtitle,
  meta,
  trailing,
  accentDot = true,
  actions,
  children,
  style,
}: FocusHeroProps) {
  return (
    <View style={[styles.hero, style]}>
      <View pointerEvents="none" style={styles.decorRing} />
      <View pointerEvents="none" style={styles.decorRingInner} />

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.eyebrowRow}>
            {accentDot ? <View style={styles.accentDot} /> : null}
            <Text
              allowFontScaling
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              style={styles.eyebrow}
            >
              {eyebrow}
            </Text>
          </View>
          {trailing}
        </View>

        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.35}
          numberOfLines={4}
          style={styles.title}
        >
          {title}
        </Text>

        {subtitle ? (
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.25}
            numberOfLines={3}
            style={styles.subtitle}
          >
            {subtitle}
          </Text>
        ) : null}

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

        {children}
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </View>
  );
}

export function FocusHeroHours({ children }: { children: ReactNode }) {
  return (
    <Text allowFontScaling maxFontSizeMultiplier={1.2} style={styles.hours}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.ink,
    borderColor: colors.inkBorder,
    borderRadius: 24,
    borderWidth: 1,
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
    borderColor: colors.acidGlow,
    borderRadius: 128,
    borderWidth: 1,
    height: 256,
    position: 'absolute',
    right: -80,
    top: -96,
    width: 256,
  },
  decorRingInner: {
    borderColor: colors.acidGlowSoft,
    borderRadius: 100,
    borderWidth: 1,
    height: 200,
    position: 'absolute',
    right: -56,
    top: -72,
    width: 200,
  },
  content: { position: 'relative' },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  eyebrowRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 8,
  },
  accentDot: {
    backgroundColor: colors.acid,
    borderRadius: 3,
    height: 6,
    width: 6,
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
    flexShrink: 0,
    fontSize: 12,
  },
  title: {
    color: colors.creamText,
    fontFamily: serif,
    fontSize: 28,
    letterSpacing: -0.3,
    lineHeight: 34,
    marginTop: 20,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  meta: {
    color: colors.mutedOnDark,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 20,
  },
});
