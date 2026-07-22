import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

/** Subtle animated mesh lattice behind the onboarding / home hero. */
export function MeshBackdrop() {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration: 12000,
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [drift]);

  const translateY = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -28],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.lattice, { transform: [{ translateY }] }]}>
        {Array.from({ length: 6 }).map((_, row) => (
          <View key={`r${row}`} style={styles.row}>
            {Array.from({ length: 5 }).map((__, col) => (
              <View key={`n${row}-${col}`} style={styles.node}>
                <View style={styles.core} />
                {col < 4 && <View style={styles.linkH} />}
                {row < 5 && <View style={styles.linkV} />}
              </View>
            ))}
          </View>
        ))}
      </Animated.View>
      <View style={styles.vignette} />
    </View>
  );
}

const styles = StyleSheet.create({
  lattice: {
    position: 'absolute',
    top: 80,
    left: -20,
    right: -20,
    opacity: 0.35,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 44,
  },
  node: {
    width: 64,
    height: 12,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  core: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    opacity: 0.7,
  },
  linkH: {
    position: 'absolute',
    left: 10,
    top: 3,
    width: 54,
    height: 1,
    backgroundColor: colors.accentDim,
    opacity: 0.45,
  },
  linkV: {
    position: 'absolute',
    left: 3,
    top: 10,
    width: 1,
    height: 48,
    backgroundColor: colors.accentDim,
    opacity: 0.35,
  },
  vignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
});
