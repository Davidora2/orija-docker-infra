import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMesh } from '../../context/MeshContext';
import { MeshBackdrop } from '../components/MeshBackdrop';
import { colors, radii, spacing } from '../theme';

export function OnboardingScreen() {
  const { bootstrap } = useMesh();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const onStart = async () => {
    setBusy(true);
    setError(null);
    try {
      await bootstrap(name || 'Wanderer');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start mesh');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <MeshBackdrop />
      <Animated.View style={[styles.content, { opacity: fade, transform: [{ translateY: rise }] }]}>
        <Text style={styles.brand}>MESHRELAY</Text>
        <Text style={styles.tag}>
          Messages hop phone to phone over a local mesh — no internet required.
        </Text>

        <Text style={styles.label}>YOUR CALLSIGN</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g. Ridge Runner"
          placeholderTextColor={colors.textDim}
          style={styles.input}
          autoCapitalize="words"
          maxLength={24}
          returnKeyType="go"
          onSubmitEditing={() => void onStart()}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={() => void onStart()}
          disabled={busy}
          style={({ pressed }) => [
            styles.cta,
            pressed && { transform: [{ scale: 0.98 }] },
            busy && { opacity: 0.6 },
          ]}
        >
          <Text style={styles.ctaText}>{busy ? 'JOINING MESH…' : 'JOIN THE MESH'}</Text>
        </Pressable>

        <Text style={styles.footnote}>
          Demo relays simulate nearby phones. BLE / Wi‑Fi Direct plug in via a
          development build for real radio hops.
        </Text>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'flex-end',
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  brand: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 42,
    letterSpacing: 1.5,
    color: colors.accent,
    marginBottom: spacing.sm,
  },
  tag: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 17,
    lineHeight: 24,
    color: colors.textMuted,
    marginBottom: spacing.xl,
    maxWidth: 340,
  },
  label: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.textDim,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 18,
    marginBottom: spacing.md,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  ctaText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    letterSpacing: 1,
    color: colors.bg,
  },
  error: {
    color: colors.danger,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  footnote: {
    marginTop: spacing.lg,
    color: colors.textDim,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
});
