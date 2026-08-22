import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, serif } from './ui/theme';

export function EditorialState({
  kind,
  title,
  description,
  action,
  compact = false,
}: {
  kind: 'empty' | 'loading' | 'error';
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.wrap,
        compact && styles.compact,
        kind === 'error' && styles.errorWrap,
      ]}
      accessible
      accessibilityRole={kind === 'error' ? 'alert' : 'summary'}
      accessibilityLiveRegion={kind === 'error' ? 'assertive' : 'polite'}
      accessibilityState={{ busy: kind === 'loading' }}
    >
      <View style={[styles.mark, kind === 'error' && styles.errorMark]}>
        {kind === 'loading' ? (
          <ActivityIndicator color={colors.sageDeep} size="small" />
        ) : (
          <Text style={[styles.markText, kind === 'error' && styles.errorMarkText]}>
            {kind === 'error' ? '!' : '·'}
          </Text>
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

export function DelayedEditorialLoading({
  title,
  description,
  delayMs = 180,
}: {
  title: string;
  description: string;
  delayMs?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!visible) return <View style={styles.placeholder} />;
  return <EditorialState kind="loading" title={title} description={description} />;
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  compact: { paddingVertical: 20 },
  errorWrap: { backgroundColor: colors.dangerSoft, borderColor: '#E7B7AD' },
  mark: {
    alignItems: 'center',
    backgroundColor: colors.sageSurface,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    marginBottom: 10,
    width: 40,
  },
  errorMark: { backgroundColor: '#F8E4DF' },
  markText: { color: colors.sageDeep, fontSize: 24, fontWeight: '700' },
  errorMarkText: { color: colors.danger },
  title: {
    color: colors.ink,
    fontFamily: serif,
    fontSize: 21,
    textAlign: 'center',
  },
  description: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    maxWidth: 340,
    textAlign: 'center',
  },
  action: { marginTop: 14, width: '100%' },
  placeholder: { minHeight: 96 },
});
