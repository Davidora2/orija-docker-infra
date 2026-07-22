import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NearbyPeer } from '../../mesh/types';
import { colors, radii, spacing } from '../theme';

export function PeerRow({
  peer,
  selected,
  onPress,
}: {
  peer: NearbyPeer;
  selected?: boolean;
  onPress?: () => void;
}) {
  const bars = Math.max(1, Math.min(4, Math.round(peer.rssi * 4)));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.signal}>
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.bar,
              { height: 4 + i * 3 },
              i <= bars ? styles.barOn : styles.barOff,
            ]}
          />
        ))}
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{peer.displayName}</Text>
        <Text style={styles.sub}>
          {peer.transport.toUpperCase()} · {peer.hops} hop ·{' '}
          {peer.id.slice(0, 12)}
        </Text>
      </View>
      <View style={[styles.dot, { backgroundColor: transportColor(peer.transport) }]} />
    </Pressable>
  );
}

function transportColor(t: NearbyPeer['transport']): string {
  if (t === 'ble') return colors.warn;
  if (t === 'lan') return colors.relay;
  return colors.accent;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bgElevated,
    marginBottom: spacing.sm,
  },
  rowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.meshGlow,
  },
  signal: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    width: 22,
    height: 18,
  },
  bar: {
    width: 3,
    borderRadius: 1,
  },
  barOn: {
    backgroundColor: colors.accent,
  },
  barOff: {
    backgroundColor: colors.line,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 16,
  },
  sub: {
    color: colors.textDim,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    marginTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
