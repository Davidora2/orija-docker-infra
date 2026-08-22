import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  disconnectCalendarConnection,
  listCalendarConnections,
  startCalendarConnect,
  syncCalendarConnection,
  type CalendarConnection,
} from './api';

const colors = {
  ink: '#14241F',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  danger: '#8A3D30',
};

export function IntegrationsScreen({
  notify,
}: {
  notify: (message: string) => void;
}) {
  const [providers, setProviders] = useState({ google: false, microsoft: false });
  const [connections, setConnections] = useState<CalendarConnection[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await listCalendarConnections();
    setProviders(result.providers);
    setConnections(result.connections);
  }, []);

  useEffect(() => {
    void load().catch((error) =>
      notify(error instanceof Error ? error.message : 'Could not load integrations.'),
    );
  }, [load, notify]);

  async function perform(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
      await load();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Integration request failed.');
    } finally {
      setBusy(false);
    }
  }

  async function connect(provider: 'google' | 'microsoft') {
    await perform(async () => {
      const { url } = await startCalendarConnect(provider);
      await WebBrowser.openBrowserAsync(url);
      notify('Return here after approving calendar access, then refresh.');
    });
  }

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <Text style={styles.title}>Calendar integrations</Text>
        <Text style={styles.body}>
          Each person connects their own Google or Microsoft calendar. Life OS creates
          calendar reminders; it does not provide push notifications.
        </Text>
        <View style={styles.row}>
          {providers.google ? (
            <Pressable
              disabled={busy}
              style={styles.button}
              onPress={() => void connect('google')}
            >
              <Text style={styles.buttonText}>Connect Google</Text>
            </Pressable>
          ) : null}
          {providers.microsoft ? (
            <Pressable
              disabled={busy}
              style={styles.secondaryButton}
              onPress={() => void connect('microsoft')}
            >
              <Text style={styles.secondaryText}>Connect Microsoft</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable disabled={busy} style={styles.secondaryButton} onPress={() => void load()}>
          <Text style={styles.secondaryText}>Refresh connections</Text>
        </Pressable>
      </View>
      {connections.length ? (
        connections.map((connection) => (
          <View key={connection.id} style={styles.card}>
            <Text style={styles.title}>
              {connection.provider === 'google' ? 'Google Calendar' : 'Microsoft Calendar'}
            </Text>
            <Text style={styles.body}>
              {connection.accountEmail || 'Connected'} · reminder{' '}
              {connection.reminderMinutes} min before
            </Text>
            <View style={styles.row}>
              <Pressable
                disabled={busy}
                style={styles.button}
                onPress={() =>
                  void perform(async () => {
                    const result = await syncCalendarConnection(connection.id);
                    notify(`Synced ${result.pushed} calendar events.`);
                  })
                }
              >
                <Text style={styles.buttonText}>Sync now</Text>
              </Pressable>
              <Pressable
                disabled={busy}
                style={styles.secondaryButton}
                onPress={() =>
                  void perform(async () => {
                    await disconnectCalendarConnection(connection.id);
                    notify('Calendar disconnected.');
                  })
                }
              >
                <Text style={[styles.secondaryText, { color: colors.danger }]}>
                  Disconnect
                </Text>
              </Pressable>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.body}>No external calendar is connected yet.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  card: {
    gap: 12,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 18,
    backgroundColor: colors.paper,
    padding: 16,
  },
  title: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: {
    borderRadius: 11,
    backgroundColor: colors.ink,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  buttonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 11,
    backgroundColor: colors.sage,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  secondaryText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
});
