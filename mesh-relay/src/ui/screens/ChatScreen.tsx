import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMesh } from '../../context/MeshContext';
import { MessageBubble } from '../components/MessageBubble';
import { MeshStatusStrip } from '../components/MeshStatusStrip';
import { colors, radii, spacing } from '../theme';

export function ChatScreen({
  onOpenPeers,
  onOpenSettings,
}: {
  onOpenPeers: () => void;
  onOpenSettings: () => void;
}) {
  const insets = useSafeAreaInsets();
  const {
    identity,
    messages,
    stats,
    sendMessage,
    peers,
    selectedPeerId,
    setSelectedPeerId,
  } = useMesh();
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);
  const targetId = selectedPeerId;

  const visible = useMemo(
    () =>
      messages.filter((m) => {
        if (m.direction === 'relayed') return true;
        if (!targetId) return true;
        return (
          m.from === targetId ||
          m.to === targetId ||
          (m.from === identity?.id && !m.to)
        );
      }),
    [messages, targetId, identity?.id],
  );

  useEffect(() => {
    if (visible.length === 0) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [visible.length]);

  const onSend = async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(draft, targetId);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const targetName = peers.find((p) => p.id === targetId)?.displayName;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>MESHRELAY</Text>
          <Text style={styles.you}>{identity?.displayName ?? '—'}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={onOpenPeers} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>PEERS</Text>
          </Pressable>
          <Pressable onPress={onOpenSettings} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>MESH</Text>
          </Pressable>
        </View>
      </View>

      <MeshStatusStrip stats={stats} />

      {targetId ? (
        <Pressable
          style={styles.filter}
          onPress={() => setSelectedPeerId(undefined)}
        >
          <Text style={styles.filterText}>
            Direct → {targetName ?? targetId.slice(0, 10)} · tap to broadcast
          </Text>
        </Pressable>
      ) : (
        <View style={styles.filterMuted}>
          <Text style={styles.filterMutedText}>
            Broadcast to mesh · pick a peer to DM
          </Text>
        </View>
      )}

      <FlatList
        ref={listRef}
        data={visible}
        keyExtractor={(item) => `${item.id}-${item.direction}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <MessageBubble message={item} isSelf={item.from === identity?.id && item.direction === 'sent'} />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No packets yet</Text>
            <Text style={styles.emptyBody}>
              Send a message — demo relays will store and forward it across the mesh.
            </Text>
          </View>
        }
      />

      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Write a mesh packet…"
          placeholderTextColor={colors.textDim}
          multiline
          maxLength={500}
        />
        <Pressable
          onPress={() => void onSend()}
          disabled={sending || !draft.trim()}
          style={({ pressed }) => [
            styles.send,
            (!draft.trim() || sending) && styles.sendDisabled,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.sendText}>SEND</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    letterSpacing: 1,
    color: colors.accent,
  },
  you: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerBtnText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  filter: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.meshGlow,
    borderWidth: 1,
    borderColor: colors.accentDim,
  },
  filterText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    color: colors.accent,
  },
  filterMuted: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: 6,
  },
  filterMutedText: {
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    color: colors.textDim,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },
  empty: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontFamily: 'SpaceGrotesk_600SemiBold',
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bgElevated,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 16,
    backgroundColor: colors.bg,
  },
  send: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendDisabled: {
    opacity: 0.4,
  },
  sendText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
    letterSpacing: 0.8,
    color: colors.bg,
  },
});
