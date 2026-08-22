import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  deleteAccount,
  getDataExport,
  getNotificationPreferences,
  requestDeletionCode,
  updateNotificationPreferences,
  type Account,
} from './api';

const colors = {
  ink: '#14241F',
  line: '#DDE2DD',
  muted: '#6C7771',
  sage: '#DBE8D7',
  danger: '#8A3D30',
  dangerSoft: '#FFF8F6',
};

export function AccountPrivacySection({
  account,
  busy,
  setBusy,
  onDeleted,
  notify,
  onError,
}: {
  account: Account;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onDeleted: () => void;
  notify: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [emailReminders, setEmailReminders] = useState(true);
  const [confirmation, setConfirmation] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  useEffect(() => {
    void getNotificationPreferences()
      .then((preferences) => setEmailReminders(preferences.emailRemindersEnabled))
      .catch((error) =>
        onError(error instanceof Error ? error.message : 'Could not load preferences.'),
      );
  }, [onError]);

  async function perform(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'The request failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.stack}>
      <View style={styles.section}>
        <Text style={styles.title}>Email reminders</Text>
        <Text style={styles.body}>
          Email delivery exists for outstanding payment reminders. Push notifications are
          not available.
        </Text>
        <Pressable
          disabled={busy}
          style={styles.button}
          onPress={() => {
            const enabled = !emailReminders;
            setEmailReminders(enabled);
            void perform(async () => {
              await updateNotificationPreferences(enabled);
              notify(enabled ? 'Email reminders enabled.' : 'Email reminders disabled.');
            });
          }}
        >
          <Text style={styles.buttonText}>
            Payment reminder emails: {emailReminders ? 'On' : 'Off'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Export your data</Text>
        <Text style={styles.body}>
          Share a scoped JSON export. OAuth, calendar, and session tokens are excluded.
        </Text>
        <Pressable
          disabled={busy}
          style={styles.button}
          onPress={() =>
            void perform(async () => {
              const data = await getDataExport();
              await Share.share({
                title: 'Life OS JSON export',
                message: JSON.stringify(data, null, 2),
              });
            })
          }
        >
          <Text style={styles.buttonText}>Share JSON export</Text>
        </Pressable>
      </View>

      <View style={[styles.section, styles.dangerSection]}>
        <Text style={[styles.title, { color: colors.danger }]}>Delete account</Text>
        <Text style={styles.body}>
          Account-owned data is permanently deleted. A partnered household transfers to
          the remaining partner, and a privacy-safe audit record is retained.
        </Text>
        <TextInput
          value={confirmation}
          onChangeText={setConfirmation}
          placeholder={`Type DELETE ${account.user.email}`}
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Current password (password accounts)"
          placeholderTextColor={colors.muted}
          secureTextEntry
          style={styles.input}
        />
        <View style={styles.row}>
          <TextInput
            value={verificationCode}
            onChangeText={setVerificationCode}
            placeholder="Email code (OAuth-only)"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable
            disabled={busy}
            style={styles.secondaryButton}
            onPress={() =>
              void perform(async () => {
                const response = await requestDeletionCode();
                notify(response.message);
              })
            }
          >
            <Text style={styles.secondaryText}>Send code</Text>
          </Pressable>
        </View>
        <Pressable
          disabled={busy || confirmation !== `DELETE ${account.user.email}`}
          style={[
            styles.deleteButton,
            (busy || confirmation !== `DELETE ${account.user.email}`) && styles.disabled,
          ]}
          onPress={() =>
            void perform(async () => {
              await deleteAccount({
                confirmation,
                currentPassword: password || undefined,
                verificationCode: verificationCode || undefined,
              });
              onDeleted();
            })
          }
        >
          <Text style={styles.deleteText}>Permanently delete account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  section: {
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 14,
  },
  dangerSection: { borderColor: '#E4B6AD', backgroundColor: colors.dangerSoft },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  body: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    color: colors.ink,
    padding: 11,
  },
  row: { flexDirection: 'row', gap: 8 },
  button: {
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.sage,
    padding: 11,
  },
  buttonText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  secondaryButton: {
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  secondaryText: { color: colors.ink, fontSize: 11, fontWeight: '800' },
  deleteButton: {
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: colors.danger,
    padding: 12,
  },
  deleteText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  disabled: { opacity: 0.45 },
});
