import React, { useMemo, useState } from 'react';
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  Pressable,
  GestureResponderEvent,
} from 'react-native';
import { AdjustmentMeta } from '../types/adjustments';
import { colors } from '../theme/colors';

type Props = {
  meta: AdjustmentMeta;
  value: number;
  onChange: (value: number) => void;
};

export function AdjustmentSlider({ meta, value, onChange }: Props) {
  const { min, max, label, step } = meta;
  const range = max - min;
  const [width, setWidth] = useState(1);
  const pct = ((value - min) / range) * 100;
  const zeroPct = ((0 - min) / range) * 100;
  const display = useMemo(() => {
    if (meta.key === 'exposure') return value.toFixed(2);
    return String(Math.round(value));
  }, [value, meta.key]);

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(Math.max(1, e.nativeEvent.layout.width));
  };

  const setFromEvent = (e: GestureResponderEvent) => {
    const ratio = Math.min(1, Math.max(0, e.nativeEvent.locationX / width));
    let next = min + ratio * range;
    if (step > 0) next = Math.round(next / step) * step;
    next = Math.min(max, Math.max(min, Number(next.toFixed(4))));
    onChange(next);
  };

  return (
    <View style={styles.row}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Pressable onPress={() => onChange(0)} hitSlop={8}>
          <Text style={[styles.value, value !== 0 && styles.valueActive]}>
            {display}
          </Text>
        </Pressable>
      </View>
      <View
        style={styles.trackHit}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={setFromEvent}
        onResponderMove={setFromEvent}
      >
        <View style={styles.track}>
          {min < 0 && max > 0 ? (
            <View style={[styles.zero, { left: `${zeroPct}%` }]} />
          ) : null}
          <View
            style={[
              styles.fill,
              min < 0
                ? {
                    left: `${Math.min(pct, zeroPct)}%`,
                    width: `${Math.abs(pct - zeroPct)}%`,
                  }
                : { left: 0, width: `${pct}%` },
            ]}
          />
          <View style={[styles.thumb, { left: `${pct}%` }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontFamily: 'Outfit_500Medium',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  value: {
    color: colors.textDim,
    fontSize: 13,
    fontFamily: 'Outfit_500Medium',
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  },
  valueActive: {
    color: colors.accent,
  },
  trackHit: {
    height: 32,
    justifyContent: 'center',
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.sliderTrack,
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: colors.sliderFill,
    borderRadius: 2,
  },
  zero: {
    position: 'absolute',
    top: -3,
    width: 1,
    height: 9,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginLeft: -0.5,
  },
  thumb: {
    position: 'absolute',
    top: -6,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.text,
    marginLeft: -7.5,
    borderWidth: 2,
    borderColor: colors.accent,
  },
});
