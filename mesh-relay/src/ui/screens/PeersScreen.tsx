import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMesh } from '../../context/MeshContext';
import { PeerRow } from '../components/PeerRow';
import { colors, radii, spacing } from '../theme';

export function PeersScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { peers, stats, selectedPeerId, setSelectedPeerId } = useMesh();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>← BACK</Text>
        </Pressable>
        <Text style={styles.title}>Nearby peers</Text>
        <Text style={styles.count}>{stats.peersNearby}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.blurb}>
          Tap a peer to address the next packet directly. Epidemic flood still
          carries it hop-by-hop until TTL runs out.
        </Text>

        {peers.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Scanning mesh…</Text>
            <Text style={styles.emptyBody}>
              Add demo relays in Mesh settings, or pair a BLE development build.
            </Text>
          </View>
        ) : (
          peers.map((p) => (
            <PeerRow
              key={p.id}
              peer={p}
              selected={selectedPeerId === p.id}
              onPress={() => {
                setSelectedPeerId(selectedPeerId === p.id ? undefined : p.id);
                onBack();
              }}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: spacing.md,
  },
  back: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 12,
    color: colors.accent,
    letterSpacing: 0.6,
  },
  title: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 20,
    color: colors.text,
  },
  count: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 14,
    color: colors.textMuted,
  },
  body: {
    padding: spacing.md,
  },
  blurb: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: spacing.lg,
  },
  empty: {
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderStyle: 'dashed',
  },
  emptyTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 12,
    color: colors.textDim,
    lineHeight: 18,
  },
});
