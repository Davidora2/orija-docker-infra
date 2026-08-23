import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { updateMoneyVisibilityGrant, type Account } from './api';
import { LifeIcon } from './life-icon';

const colors = {
  ink: '#14241F',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sageDeep: '#617A57',
  sageSoft: '#F8FAF7',
};

type Grant = 'SHARED_BILLS_ONLY' | 'FULL_VISIBILITY';

type Props = {
  account: Account;
  busy?: boolean;
  onAccountChange: (account: Account) => void;
  onNotify?: (message: string) => void;
  onError?: (message: string) => void;
  onLayoutOffset?: (offsetY: number) => void;
};

export function MoneyVisibilitySection({
  account,
  busy: externalBusy = false,
  onAccountChange,
  onNotify,
  onError,
  onLayoutOffset,
}: Props) {
  const [busy, setBusy] = useState(false);
  const partner = account.members.find((member) => member.id !== account.user.id);
  const yourGrant = account.moneyVisibilityGrant ?? 'SHARED_BILLS_ONLY';
  const isBusy = busy || externalBusy;

  if (!partner) return null;

  const partnerName = partner.displayName;

  async function saveMoneyGrant(grant: Grant) {
    setBusy(true);
    try {
      onAccountChange(await updateMoneyVisibilityGrant(grant));
      onNotify?.('Money visibility updated.');
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : 'Could not update money visibility.',
      );
    } finally {
      setBusy(false);
    }
  }

  function confirmFullVisibility() {
    Alert.alert(
      'Share full visibility?',
      `${partnerName} will see your personal recurring bills, daily spending entries, and pay schedule in Household view. They won't be able to edit your personal budget.`,
      [
        { text: 'Keep shared bills only', style: 'cancel' },
        {
          text: 'Turn on full visibility',
          onPress: () => void saveMoneyGrant('FULL_VISIBILITY'),
        },
      ],
    );
  }

  return (
    <View
      onLayout={(event) => onLayoutOffset?.(event.nativeEvent.layout.y)}
      style={styles.card}
    >
      <View style={styles.headingRow}>
        <LifeIcon name="family" size={18} color={colors.sageDeep} />
        <Text style={styles.sectionTitle}>Household sharing</Text>
      </View>
      <Text style={styles.sectionCaption}>
        Choose what your partner can see of your money. They control what you see of
        theirs.
      </Text>

      <Text style={styles.label}>BILLS VISIBILITY</Text>
      <Text style={styles.subLabel}>What {partnerName} can see</Text>
      <Pressable
        disabled={isBusy}
        style={[
          styles.modeButton,
          yourGrant === 'SHARED_BILLS_ONLY' && styles.modeButtonActive,
        ]}
        onPress={() => void saveMoneyGrant('SHARED_BILLS_ONLY')}
      >
        <Text
          style={[
            styles.modeText,
            yourGrant === 'SHARED_BILLS_ONLY' && styles.modeTextActive,
          ]}
        >
          Shared bills only
        </Text>
        <Text style={styles.modeHint}>
          Only bills you move to the household budget. Everything else stays private.
        </Text>
      </Pressable>
      <Pressable
        disabled={isBusy}
        style={[
          styles.modeButton,
          yourGrant === 'FULL_VISIBILITY' && styles.modeButtonActive,
        ]}
        onPress={confirmFullVisibility}
      >
        <Text
          style={[styles.modeText, yourGrant === 'FULL_VISIBILITY' && styles.modeTextActive]}
        >
          Full visibility
        </Text>
        <Text style={styles.modeHint}>
          They can see all your personal outgoings and pay schedule in Household view.
        </Text>
      </Pressable>

      <Text style={[styles.label, { marginTop: 4 }]}>WEALTH & SAVINGS</Text>
      <View style={styles.wealthCard}>
        <Text style={styles.wealthTitle}>Shared wealth items only</Text>
        <Text style={styles.wealthCopy}>
          Your partner sees savings, debt, and investments you mark Share with
          household — not your full personal detail.
        </Text>
      </View>
      <View style={styles.wealthPlannedCard}>
        <Text style={styles.wealthPlannedTitle}>Full wealth visibility</Text>
        <Text style={styles.wealthPlannedCopy}>
          Read-only access to all personal wealth in Household view — planned for a
          future release.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  headingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  sectionTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 20,
  },
  sectionCaption: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  label: {
    color: colors.sageDeep,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  subLabel: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  modeButton: {
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modeButtonActive: {
    backgroundColor: '#EEF3EA',
    borderColor: colors.sageDeep,
  },
  modeText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  modeTextActive: {
    color: colors.sageDeep,
  },
  modeHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  wealthCard: {
    backgroundColor: colors.sageSoft,
    borderColor: '#EEF0EC',
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  wealthTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  wealthCopy: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  wealthPlannedCard: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  wealthPlannedTitle: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  wealthPlannedCopy: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
  },
});
