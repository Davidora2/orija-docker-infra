import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Image } from 'expo-image';
import { Adjustments, isNeutral } from '../types/adjustments';
import {
  adjustmentsToCssFilter,
  applyAdjustmentsToImageData,
} from '../lib/imageProcessor';
import { colors } from '../theme/colors';

type Props = {
  uri: string | null;
  adjustments: Adjustments;
  showOriginal?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PhotoCanvas({ uri, adjustments, showOriginal, style }: Props) {
  const [processedUri, setProcessedUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const gen = useRef(0);

  const cssFilter = useMemo(
    () => (showOriginal ? 'none' : adjustmentsToCssFilter(adjustments)),
    [adjustments, showOriginal],
  );

  const renderCanvas = useCallback(async () => {
    if (Platform.OS !== 'web' || !uri || showOriginal || isNeutral(adjustments)) {
      setProcessedUri(null);
      return;
    }
    const myGen = ++gen.current;
    setProcessing(true);
    try {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('preview load failed'));
        img.src = uri;
      });
      if (myGen !== gen.current) return;

      const maxEdge = 1400;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      let canvas = canvasRef.current;
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvasRef.current = canvas;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      applyAdjustmentsToImageData(data, adjustments);
      ctx.putImageData(data, 0, 0);
      if (myGen !== gen.current) return;
      setProcessedUri(canvas.toDataURL('image/jpeg', 0.88));
    } catch {
      if (myGen === gen.current) setProcessedUri(null);
    } finally {
      if (myGen === gen.current) setProcessing(false);
    }
  }, [uri, adjustments, showOriginal]);

  useEffect(() => {
    const t = setTimeout(renderCanvas, 280);
    return () => clearTimeout(t);
  }, [renderCanvas]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: uri ? 1 : 0,
      duration: 420,
      useNativeDriver: true,
    }).start();
  }, [uri, fade]);

  if (!uri) {
    return <View style={[styles.empty, style]} />;
  }

  const useProcessed =
    Boolean(processedUri) && !showOriginal && Platform.OS === 'web';

  const imageStyle: StyleProp<ViewStyle> = [
    styles.image,
    Platform.OS === 'web' && !useProcessed && !showOriginal
      ? ({ filter: cssFilter } as ViewStyle)
      : null,
  ];

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View style={[styles.imageWrap, { opacity: fade }]}>
        <Image
          source={{ uri: useProcessed ? processedUri! : uri }}
          style={imageStyle as object}
          contentFit="contain"
          transition={200}
        />
      </Animated.View>
      {processing && !useProcessed ? <View style={styles.processingDot} /> : null}
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
  processingDot: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    opacity: 0.8,
  },
});
