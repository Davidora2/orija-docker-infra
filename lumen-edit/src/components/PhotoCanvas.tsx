import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Adjustments } from '../types/adjustments';
import { adjustmentsToCssFilter } from '../lib/imageProcessor';
import { colors } from '../theme/colors';

type Props = {
  uri: string | null;
  adjustments: Adjustments;
  showOriginal?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Live preview uses CSS filters for 60fps slider feedback.
 * Full Lightroom-faithful pixel bake happens on Export only.
 */
export function PhotoCanvas({ uri, adjustments, showOriginal, style }: Props) {
  const fade = useRef(new Animated.Value(0)).current;

  const cssFilter = useMemo(
    () => (showOriginal ? 'none' : adjustmentsToCssFilter(adjustments)),
    [adjustments, showOriginal],
  );

  useEffect(() => {
    Animated.timing(fade, {
      toValue: uri ? 1 : 0,
      duration: 420,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [uri, fade]);

  if (!uri) {
    return <View style={[styles.empty, style]} />;
  }

  const imageStyle: StyleProp<ViewStyle> = [
    styles.image,
    Platform.OS === 'web' ? ({ filter: cssFilter } as ViewStyle) : null,
  ];

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View style={[styles.imageWrap, { opacity: fade }]}>
        <Image
          source={{ uri }}
          style={imageStyle as object}
          contentFit="contain"
          transition={180}
        />
        {/* Native approximation overlays when CSS filter is unavailable */}
        {Platform.OS !== 'web' && !showOriginal ? (
          <NativeApproxOverlay adjustments={adjustments} />
        ) : null}
      </Animated.View>
    </View>
  );
}

function NativeApproxOverlay({ adjustments }: { adjustments: Adjustments }) {
  const brightness = Math.max(0, Math.min(0.45, Math.abs(adjustments.exposure) * 0.08));
  const warm = Math.max(0, adjustments.temperature) / 100;
  const cool = Math.max(0, -adjustments.temperature) / 100;
  return (
    <>
      {adjustments.exposure > 0.05 ? (
        <View
          pointerEvents="none"
          style={[styles.overlay, { backgroundColor: '#fff', opacity: brightness }]}
        />
      ) : null}
      {adjustments.exposure < -0.05 ? (
        <View
          pointerEvents="none"
          style={[styles.overlay, { backgroundColor: '#000', opacity: brightness }]}
        />
      ) : null}
      {warm > 0.05 ? (
        <View
          pointerEvents="none"
          style={[styles.overlay, { backgroundColor: '#E8A14A', opacity: warm * 0.18 }]}
        />
      ) : null}
      {cool > 0.05 ? (
        <View
          pointerEvents="none"
          style={[styles.overlay, { backgroundColor: '#4A7A9C', opacity: cool * 0.18 }]}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  empty: { flex: 1, backgroundColor: colors.canvas },
  imageWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
  },
});
