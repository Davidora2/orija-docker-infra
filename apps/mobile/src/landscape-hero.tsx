import { Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
});

export function LandscapeHero({
  title,
  subtitle,
  detail,
}: {
  title: string;
  subtitle: string;
  detail: string;
}) {
  return (
    <View style={styles.hero} accessibilityRole="header">
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>LIFE OS · PLAN</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <Svg
        height="116"
        width="100%"
        viewBox="0 0 360 116"
        preserveAspectRatio="none"
        style={styles.art}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Circle cx="304" cy="20" r="11" fill="#F2C66D" opacity={0.72} />
        <Path
          d="M0 57 C65 20 112 79 181 49 C247 20 294 68 360 40 L360 116 L0 116 Z"
          fill="#DBE8D7"
        />
        <Path
          d="M0 79 C78 48 129 101 211 69 C275 45 317 87 360 65 L360 116 L0 116 Z"
          fill="#B8CDB1"
        />
        <Path
          d="M0 99 C93 75 149 113 231 91 C294 74 331 103 360 88 L360 116 L0 116 Z"
          fill="#819B78"
        />
        <Path
          d="M24 30 C43 17 64 20 82 32"
          fill="none"
          stroke="#617A57"
          strokeLinecap="round"
          strokeWidth={2.5}
          opacity={0.42}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: '#EEF3EA',
    borderColor: '#D8DFD6',
    borderRadius: 24,
    borderWidth: 1,
    minHeight: 220,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingTop: 20,
  },
  copy: { gap: 4, zIndex: 1 },
  eyebrow: {
    color: '#617A57',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: { color: '#14241F', fontFamily: serif, fontSize: 34 },
  subtitle: { color: '#24362F', fontSize: 16, fontWeight: '600' },
  detail: { color: '#5F6D66', fontSize: 13, lineHeight: 18, maxWidth: 300 },
  art: { bottom: 0, left: 0, position: 'absolute' },
});
