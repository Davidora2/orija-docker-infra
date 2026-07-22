import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import type { MeshStats } from '../../mesh/types';
import { colors, spacing } from '../theme';

export function MeshStatusStrip({ stats }: { stats: MeshStats }) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.strip}>
      <Animated.View style={[styles.live, { opacity: pulse }]} />
      <Text style={styles.text}>
        {stats.online ? 'MESH LIVE' : 'OFFLINE'} · {stats.peersNearby} nearby ·{' '}
        {stats.messagesRelayed} relayed
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  live: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  text: {
    color: colors.textMuted,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    letterSpacing: 0.6,
  },
});
