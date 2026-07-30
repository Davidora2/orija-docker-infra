import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Adjustments, isNeutral } from '../types/adjustments';
import { adjustmentsToCssFilter } from '../lib/imageProcessor';
import { processPhoto } from '../lib/processPhoto';
import { colors } from '../theme/colors';

type Props = {
  uri: string | null;
  adjustments: Adjustments;
  showOriginal?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Shows a real pixel-baked preview so presets and sliders are clearly visible.
 * Web also applies CSS filters instantly while the bake catches up.
 */
export function PhotoCanvas({ uri, adjustments, showOriginal, style }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const [bakedUri, setBakedUri] = useState<string | null>(null);
  const [baking, setBaking] = useState(false);
  const gen = useRef(0);
  const lastSource = useRef<string | null>(null);

  const cssFilter = useMemo(
    () => (showOriginal ? 'none' : adjustmentsToCssFilter(adjustments)),
    [adjustments, showOriginal],
  );

  const neutral = isNeutral(adjustments);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: uri ? 1 : 0,
      duration: 320,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [uri, fade]);

  useEffect(() => {
    if (!uri) {
      setBakedUri(null);
      return;
    }
    if (showOriginal || neutral) {
      setBakedUri(null);
      setBaking(false);
      return;
    }

    if (lastSource.current !== uri) {
      lastSource.current = uri;
      setBakedUri(null);
    }

    const myGen = ++gen.current;
    const delay = Platform.OS === 'web' ? 140 : 80;
    setBaking(true);

    const timer = setTimeout(async () => {
      try {
        const result = await processPhoto(uri, adjustments, {
          preview: true,
          maxEdge: Platform.OS === 'web' ? 1100 : 900,
          quality: 0.8,
        });
        if (myGen !== gen.current) return;
        setBakedUri(result.uri);
      } catch (err) {
        console.warn('Preview bake failed', err);
        if (myGen === gen.current) setBakedUri(null);
      } finally {
        if (myGen === gen.current) setBaking(false);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [uri, adjustments, showOriginal, neutral]);

  if (!uri) {
    return <View style={[styles.empty, style]} />;
  }

  const displayUri = !showOriginal && bakedUri ? bakedUri : uri;
  const useCssBridge =
    Platform.OS === 'web' && !showOriginal && !bakedUri && !neutral;

  const imageStyle: StyleProp<ViewStyle> = [
    styles.image,
    useCssBridge ? ({ filter: cssFilter } as ViewStyle) : null,
  ];

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View style={[styles.imageWrap, { opacity: fade }]}>
        <Image
          source={{ uri: displayUri }}
          style={imageStyle as object}
          contentFit="contain"
          transition={120}
        />
      </Animated.View>
      {baking ? (
        <View style={styles.bakeBadge}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
      ) : null}
    </View>
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
  bakeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
});
