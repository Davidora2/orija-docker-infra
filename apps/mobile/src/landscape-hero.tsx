import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, serif } from './ui/theme';

export function LandscapeHero({
  title,
  subtitle,
  detail,
  eyebrow = 'Life OS · Plan',
}: {
  title: string;
  subtitle: string;
  detail: string;
  eyebrow?: string;
}) {
  return (
    <View style={styles.hero}>
      <View pointerEvents="none" style={styles.decorRing} />
      <View pointerEvents="none" style={styles.decorRingInner} />

      <Svg
        pointerEvents="none"
        style={styles.landscape}
        viewBox="0 0 600 140"
        preserveAspectRatio="none"
      >
        <Circle cx="505" cy="27" r="13" fill="#D6F57A" opacity={0.22} />
        <Path
          d="M0 82 C100 34 178 100 285 67 C405 29 488 87 600 49 L600 140 L0 140 Z"
          fill="#1E4A38"
          opacity={0.72}
        />
        <Path
          d="M0 105 C126 63 210 122 345 83 C455 52 525 104 600 77 L600 140 L0 140 Z"
          fill="#163A2C"
          opacity={0.82}
        />
        <Path
          d="M0 124 C142 94 232 135 371 105 C468 83 535 121 600 99 L600 140 L0 140 Z"
          fill="#0F2920"
          opacity={0.92}
        />
        <Path
          d="M42 45 C73 25 108 28 137 48"
          fill="none"
          stroke="#8FB38A"
          strokeLinecap="round"
          strokeWidth={3}
          opacity={0.28}
        />
      </Svg>

      <View style={styles.content}>
        <View style={styles.eyebrowRow}>
          <View style={styles.accentDot} />
          <Text
            allowFontScaling
            maxFontSizeMultiplier={1.2}
            numberOfLines={1}
            style={styles.eyebrow}
          >
            {eyebrow}
          </Text>
        </View>

        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.35}
          numberOfLines={3}
          style={styles.title}
        >
          {title}
        </Text>

        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.25}
          numberOfLines={2}
          style={styles.subtitle}
        >
          {subtitle}
        </Text>

        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.25}
          numberOfLines={3}
          style={styles.detail}
        >
          {detail}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.ink,
    borderColor: colors.inkBorder,
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 176,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 18,
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
  landscape: {
    bottom: 0,
    height: 112,
    left: 0,
    position: 'absolute',
    right: 0,
    width: '100%',
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
  eyebrowRow: {
    alignItems: 'center',
    flexDirection: 'row',
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
  title: {
    color: colors.creamText,
    fontFamily: serif,
    fontSize: 26,
    letterSpacing: -0.3,
    lineHeight: 32,
    marginTop: 14,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  detail: {
    color: colors.mutedOnDark,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
  },
});
