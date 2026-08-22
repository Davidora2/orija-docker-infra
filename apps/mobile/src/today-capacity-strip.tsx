import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LifeIcon } from './life-icon';

const colors = {
  ink: '#14241F',
  line: '#DDE2DD',
  muted: '#6C7771',
  paper: '#FFFFFF',
  sageDeep: '#617A57',
  danger: '#C9634F',
  overBorder: '#E8C7BD',
  overBg: '#FDF4F1',
  overText: '#B75542',
};

const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
});

function hours(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}h`;
}

type TodayCapacityStripProps = {
  available: number;
  planned: number;
  onOpenCapacity: () => void;
};

export function TodayCapacityStrip({
  available,
  planned,
  onOpenCapacity,
}: TodayCapacityStripProps) {
  const remaining = available - planned;
  const overCapacity = remaining < -0.05;

  return (
    <View
      style={[
        styles.strip,
        overCapacity && styles.stripOver,
      ]}
    >
      <View style={styles.grid}>
        {[
          ['Available', hours(available), colors.ink],
          ['Planned', hours(planned), colors.ink],
          [
            'Remaining',
            hours(remaining),
            overCapacity ? colors.danger : colors.sageDeep,
          ],
        ].map(([label, value, tone], index) => (
          <View
            key={label}
            style={[
              styles.cell,
              index > 0 && styles.cellDivider,
            ]}
          >
            <Text
              allowFontScaling
              maxFontSizeMultiplier={1.25}
              numberOfLines={1}
              style={[styles.value, { color: tone }]}
            >
              {value}
            </Text>
            <Text
              allowFontScaling
              maxFontSizeMultiplier={1.2}
              numberOfLines={1}
              style={styles.label}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
      {overCapacity ? (
        <Pressable
          accessibilityRole="button"
          onPress={onOpenCapacity}
          style={({ pressed }) => [
            styles.overBanner,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.overText}>
            Over capacity—rebalance before adding more.
          </Text>
          <LifeIcon color={colors.overText} name="chevron-right" size={14} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  stripOver: {
    borderColor: colors.overBorder,
  },
  grid: {
    flexDirection: 'row',
  },
  cell: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 14,
  },
  cellDivider: {
    borderLeftColor: '#E8EBE7',
    borderLeftWidth: 1,
  },
  value: {
    fontFamily: serif,
    fontSize: 24,
    lineHeight: 28,
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  overBanner: {
    alignItems: 'center',
    backgroundColor: colors.overBg,
    borderTopColor: '#EFD9D2',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  overText: {
    color: colors.overText,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
});
