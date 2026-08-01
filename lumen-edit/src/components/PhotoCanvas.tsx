import React, { useEffect, useRef, useState } from 'react';
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
import { processPhoto, revokeProcessUri } from '../lib/processPhoto';
import { colors } from '../theme/colors';

type Props = {
  uri: string | null;
  adjustments: Adjustments;
  showOriginal?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Pixel-baked preview only (no CSS filters on full-res — those OOM/crash tabs).
 * Shows source until bake finishes, then swaps to the processed JPEG.
 */
export function PhotoCanvas({ uri, adjustments, showOriginal, style }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const [bakedUri, setBakedUri] = useState<string | null>(null);
  const [baking, setBaking] = useState(false);
  const gen = useRef(0);
  const bakedRef = useRef<string | null>(null);
  const inFlight = useRef(false);
  const pending = useRef<{
    uri: string;
    adjustments: Adjustments;
  } | null>(null);
  const revokeQueue = useRef<string[]>([]);

  const neutral = isNeutral(adjustments);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: uri ? 1 : 0,
      duration: 280,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [uri, fade]);

  useEffect(() => {
    return () => {
      revokeProcessUri(bakedRef.current);
      for (const u of revokeQueue.current) revokeProcessUri(u);
      bakedRef.current = null;
      revokeQueue.current = [];
    };
  }, []);

  useEffect(() => {
    if (!uri || showOriginal || neutral) {
      if (bakedRef.current) {
        revokeQueue.current.push(bakedRef.current);
        bakedRef.current = null;
      }
      setBakedUri(null);
      setBaking(false);
      pending.current = null;
      // Delayed revoke so Image can release the texture
      const t = setTimeout(() => {
        for (const u of revokeQueue.current) revokeProcessUri(u);
        revokeQueue.current = [];
      }, 600);
      return () => clearTimeout(t);
    }

    const myGen = ++gen.current;
    pending.current = { uri, adjustments };

    const run = async () => {
      if (inFlight.current) return;
      const job = pending.current;
      if (!job) return;
      pending.current = null;
      inFlight.current = true;
      setBaking(true);
      try {
        const result = await processPhoto(job.uri, job.adjustments, {
          preview: true,
          maxEdge: 640,
          quality: 0.72,
        });
        if (gen.current !== myGen && pending.current) {
          revokeProcessUri(result.uri);
          return;
        }
        if (bakedRef.current) {
          revokeQueue.current.push(bakedRef.current);
        }
        bakedRef.current = result.uri;
        setBakedUri(result.uri);
        // Revoke previous after Image has swapped
        setTimeout(() => {
          for (const u of revokeQueue.current) revokeProcessUri(u);
          revokeQueue.current = [];
        }, 800);
      } catch (err) {
        console.warn('Preview bake failed', err);
      } finally {
        inFlight.current = false;
        if (gen.current === myGen) setBaking(false);
        if (pending.current) void run();
      }
    };

    const timer = setTimeout(() => {
      void run();
    }, 100);

    return () => clearTimeout(timer);
  }, [uri, adjustments, showOriginal, neutral]);

  if (!uri) {
    return <View style={[styles.empty, style]} />;
  }

  const displayUri = !showOriginal && bakedUri ? bakedUri : uri;

  return (
    <View style={[styles.wrap, style]}>
      <Animated.View style={[styles.imageWrap, { opacity: fade }]}>
        <Image
          source={{ uri: displayUri }}
          style={styles.image}
          contentFit="contain"
          transition={80}
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
