import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMesh } from '../../context/MeshContext';
import { colors, radii, spacing } from '../theme';

export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const {
    identity,
    stats,
    demoRelays,
    setDemoRelays,
    resetIdentity,
  } = useMesh();

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>← BACK</Text>
        </Pressable>
        <Text style={styles.title}>Mesh</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.section}>IDENTITY</Text>
        <View style={styles.card}>
          <Text style={styles.rowLabel}>Callsign</Text>
          <Text style={styles.rowValue}>{identity?.displayName}</Text>
          <Text style={[styles.rowLabel, { marginTop: 12 }]}>Peer ID</Text>
          <Text style={styles.mono}>{identity?.id}</Text>
          <Text style={[styles.rowLabel, { marginTop: 12 }]}>Public key</Text>
          <Text style={styles.mono} numberOfLines={2}>
            {identity?.publicKey}
          </Text>
        </View>

        <Text style={styles.section}>TRANSPORTS</Text>
        <View style={styles.card}>
          <Text style={styles.bullet}>
            <Text style={styles.accent}>Simulation</Text> — on-device demo bus with
            virtual relay phones (active).
          </Text>
          <Text style={styles.bullet}>
            <Text style={styles.warn}>Bluetooth LE</Text> — GATT mesh adapter ready;
            link <Text style={styles.monoInline}>react-native-ble-plx</Text> in a
            development build.
          </Text>
          <Text style={styles.bullet}>
            <Text style={styles.relay}>LAN / Wi‑Fi</Text> — Multipeer (iOS) / Wi‑Fi
            Direct (Android) stub for same-room hops.
          </Text>
          <Text style={styles.meta}>
            Active primary: {stats.transport.toUpperCase()} · relayed{' '}
            {stats.messagesRelayed} · stored {stats.messagesStored}
          </Text>
        </View>

        <Text style={styles.section}>DEMO RELAYS</Text>
        <View style={styles.card}>
          <Text style={styles.blurb}>
            Virtual phones that join the mesh and forward packets so you can see
            multi-hop store-and-forward without extra hardware.
          </Text>
          <View style={styles.stepper}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => void setDemoRelays(demoRelays - 1)}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{demoRelays}</Text>
            <Pressable
              style={styles.stepBtn}
              onPress={() => void setDemoRelays(demoRelays + 1)}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.section}>DANGER</Text>
        <Pressable
          style={styles.dangerBtn}
          onPress={() => void resetIdentity()}
        >
          <Text style={styles.dangerText}>RESET IDENTITY & MESSAGES</Text>
        </Pressable>
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
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 20,
    color: colors.text,
  },
  body: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  section: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textDim,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  rowLabel: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    color: colors.textDim,
  },
  rowValue: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 18,
    color: colors.text,
    marginTop: 2,
  },
  mono: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  monoInline: {
    fontFamily: 'IBMPlexMono_400Regular',
    color: colors.text,
  },
  bullet: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  accent: { color: colors.accent, fontFamily: 'SpaceGrotesk_600SemiBold' },
  warn: { color: colors.warn, fontFamily: 'SpaceGrotesk_600SemiBold' },
  relay: { color: colors.relay, fontFamily: 'SpaceGrotesk_600SemiBold' },
  meta: {
    marginTop: spacing.sm,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    color: colors.textDim,
  },
  blurb: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  stepBtnText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    color: colors.accent,
  },
  stepValue: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 22,
    color: colors.text,
    minWidth: 28,
    textAlign: 'center',
  },
  dangerBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.danger,
  },
});
