import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../../mesh/types';
import { colors, radii, spacing } from '../theme';

export function MessageBubble({
  message,
  isSelf,
}: {
  message: ChatMessage;
  isSelf: boolean;
}) {
  const isRelay = message.direction === 'relayed';

  return (
    <View
      style={[
        styles.wrap,
        isSelf && styles.wrapSelf,
        isRelay && styles.wrapRelay,
      ]}
    >
      {!isSelf && (
        <Text style={styles.meta}>
          {message.fromName}
          {message.hops > 0 ? ` · ${message.hops} hop${message.hops === 1 ? '' : 's'}` : ''}
          {isRelay ? ' · relayed' : ''}
        </Text>
      )}
      <View
        style={[
          styles.bubble,
          isSelf && styles.bubbleSelf,
          isRelay && styles.bubbleRelay,
        ]}
      >
        <Text style={[styles.body, isSelf && styles.bodySelf, isRelay && styles.bodyRelay]}>
          {message.body}
        </Text>
      </View>
      <Text style={[styles.time, isSelf && styles.timeSelf]}>
        {formatTime(message.createdAt)}
        {isSelf && message.hops === 0 ? ' · out' : ''}
      </Text>
    </View>
  );
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.md,
    maxWidth: '88%',
    alignSelf: 'flex-start',
  },
  wrapSelf: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  wrapRelay: {
    opacity: 0.72,
    alignSelf: 'center',
    maxWidth: '92%',
  },
  meta: {
    color: colors.textDim,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 11,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  bubble: {
    backgroundColor: colors.bgSoft,
    borderRadius: radii.md,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  bubbleSelf: {
    backgroundColor: colors.accent,
    borderColor: colors.accentDim,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: 4,
  },
  bubbleRelay: {
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderColor: colors.relay,
  },
  body: {
    color: colors.text,
    fontFamily: 'SpaceGrotesk_500Medium',
    fontSize: 16,
    lineHeight: 22,
  },
  bodySelf: {
    color: '#0B1210',
  },
  bodyRelay: {
    color: colors.relay,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 13,
  },
  time: {
    marginTop: 4,
    color: colors.textDim,
    fontFamily: 'IBMPlexMono_400Regular',
    fontSize: 10,
  },
  timeSelf: {
    textAlign: 'right',
  },
});
