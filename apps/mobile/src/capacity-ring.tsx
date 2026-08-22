import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

type CapacityRingColors = {
  track?: string;
  used?: string;
  over?: string;
  text?: string;
};

type CapacityRingProps = {
  used?: number | null;
  planned?: number | null;
  capacity?: number | null;
  available?: number | null;
  size?: number;
  label?: string;
  colors?: CapacityRingColors;
};

function safeAmount(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

export function CapacityRing({
  used,
  planned,
  capacity,
  available,
  size = 112,
  label = 'Capacity used',
  colors = {},
}: CapacityRingProps) {
  const usedValue = safeAmount(used ?? planned);
  const capacityValue = safeAmount(capacity ?? available);
  const ratio =
    capacityValue > 0 ? usedValue / capacityValue : usedValue > 0 ? 1 : 0;
  const overCapacity = usedValue > capacityValue && usedValue > 0;
  const percentage = Math.round(ratio * 100);
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(ratio, 1);
  const strokeDashoffset = circumference * (1 - progress);
  const displayValue =
    capacityValue <= 0 && usedValue > 0 ? 'Over' : `${percentage}%`;
  const description = `${label}: ${usedValue.toFixed(1)} of ${capacityValue.toFixed(
    1,
  )}${overCapacity ? ', over capacity' : ''}`;

  return (
    <View
      accessibilityLabel={description}
      accessibilityRole="image"
      style={{ height: size, width: size }}
    >
      <Svg
        height={size}
        width={size}
        viewBox="0 0 100 100"
        style={styles.svg}
      >
        <Circle
          cx={50}
          cy={50}
          fill="none"
          r={radius}
          stroke={colors.track ?? '#E5E9E3'}
          strokeWidth={9}
        />
        <Circle
          cx={50}
          cy={50}
          fill="none"
          r={radius}
          rotation={-90}
          origin="50, 50"
          stroke={
            overCapacity
              ? colors.over ?? '#C9634F'
              : colors.used ?? '#617A57'
          }
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          strokeWidth={9}
        />
      </Svg>
      <View pointerEvents="none" style={styles.valueWrap}>
        <Text style={[styles.value, { color: colors.text ?? '#14241F' }]}>
          {displayValue}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute' },
  valueWrap: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  value: {
    fontFamily: 'serif',
    fontSize: 18,
    lineHeight: 22,
  },
});
