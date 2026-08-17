import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  acceptPartnerInvite,
  apiBaseUrl,
  createPartnerInvite,
  forgotPassword,
  getAuthProviders,
  login,
  loginWithGoogle,
  logout,
  register,
  resetPassword,
  setActiveHousehold,
  updateProfile,
  verifyResetCode,
  getWealthMeta,
  type Account,
  type AuthProviders,
  ApiError,
} from './api';

WebBrowser.maybeCompleteAuthSession();

const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';

const colors = {
  ink: '#14241F',
  canvas: '#F4F5F0',
  paper: '#FFFFFF',
  line: '#DDE2DD',
  muted: '#6C7771',
  sage: '#DBE8D7',
  sageDeep: '#617A57',
  acid: '#D6F57A',
  danger: '#C9634F',
  amberSoft: '#FFF3E8',
};

type Props = {
  visible: boolean;
  account: Account | null;
  initialInviteToken?: string;
  onClose: () => void;
  onAccountChange: (account: Account | null) => void;
  notify: (message: string) => void;
};

function Icon({
  name,
  size = 18,
  color = colors.ink,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  keyboardType?: 'default' | 'email-address';
}) {
  const nativeId = `account-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <View style={styles.field}>
      <Text nativeID={`${nativeId}-label`} style={styles.label}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityLabelledBy={`${nativeId}-label`}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        keyboardType={keyboardType}
        nativeID={nativeId}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9BA49E"
        secureTextEntry={secureTextEntry}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function ActionButton({
  label,
  onPress,
  secondary,
  disabled,
  icon,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        secondary && styles.actionButtonSecondary,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {icon && <Icon name={icon} size={16} color={secondary ? colors.ink : 'white'} />}
      <Text style={[styles.actionText, secondary && styles.actionTextSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function AccountSheet({
  visible,
  account,
  initialInviteToken,
  onClose,
  onAccountChange,
  notify,
}: Props) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [mode, setMode] = useState<'register' | 'login' | 'forgot' | 'reset'>('register');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [profileCurrency, setProfileCurrency] = useState('GBP');
  const [currencies, setCurrencies] = useState<string[]>(['GBP', 'USD', 'CAD', 'EUR']);
  const [partnerEmail, setPartnerEmail] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [generatedInvite, setGeneratedInvite] = useState<{
    token: string;
    deepLink: string;
    webUrl: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [googleRequest, , googlePromptAsync] = Google.useIdTokenAuthRequest({
    clientId: googleClientId || undefined,
    iosClientId: googleClientId || undefined,
    androidClientId: googleClientId || undefined,
    webClientId: googleClientId || undefined,
  });

  useEffect(() => {
    if (account) {
      setDisplayName(account.user.displayName);
      setProfileCurrency(account.user.preferredCurrency || 'GBP');
    }
  }, [account]);

  useEffect(() => {
    if (!visible) return;
    void getWealthMeta()
      .then((meta) => {
        if (meta.currencies?.length) setCurrencies(meta.currencies);
      })
      .catch(() => {
        // keep defaults
      });
  }, [visible]);

  useEffect(() => {
    if (!visible || account) return;
    void getAuthProviders()
      .then(setProviders)
      .catch(() => setProviders(null));
  }, [visible, account]);

  useEffect(() => {
    if (initialInviteToken) setInviteToken(initialInviteToken);
  }, [initialInviteToken]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  async function perform(work: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Could not reach your Life OS server. Check the API address.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function authenticate() {
    await perform(async () => {
      const nextAccount =
        mode === 'register'
          ? await register({
              displayName,
              email,
              password,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
            })
          : await login({ email, password });
      onAccountChange(nextAccount);
      setPassword('');
      notify(mode === 'register' ? 'Your secure profile is ready.' : 'Welcome back.');
    });
  }

  async function saveProfile() {
    await perform(async () => {
      const next = await updateProfile({
        displayName,
        preferredCurrency: profileCurrency,
      });
      onAccountChange(next);
      notify('Profile updated.');
    });
  }

  async function makeInvite() {
    await perform(async () => {
      const invite = await createPartnerInvite(partnerEmail || undefined);
      setGeneratedInvite(invite);
      notify('Partner invitation created.');
    });
  }

  async function shareInvite() {
    if (!generatedInvite) return;
    await Share.share({
      title: 'Join my Life OS household',
      message: `Join my Life OS household: ${generatedInvite.deepLink}\n\nInvite code: ${generatedInvite.token}`,
    });
  }

  async function acceptInvite() {
    await perform(async () => {
      const next = await acceptPartnerInvite(inviteToken.trim());
      onAccountChange(next);
      setInviteToken('');
      notify('Accounts linked. Your shared household is active.');
    });
  }

  async function signOut() {
    await perform(async () => {
      await logout();
      onAccountChange(null);
      setGeneratedInvite(null);
      notify('Signed out securely.');
    });
  }

  const activeHousehold = account?.households.find((household) => household.active);
  const canInvite =
    activeHousehold?.role === 'OWNER' && (account?.members.length ?? 0) < 2;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 12),
              marginBottom: Platform.OS === 'android' ? keyboardHeight : 0,
              maxHeight: '92%',
            },
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View>
              <View style={styles.eyebrowRow}>
                <Icon name="shield-checkmark-outline" size={12} color={colors.sageDeep} />
                <Text style={styles.eyebrow}>PROFILE & HOUSEHOLD</Text>
              </View>
              <Text style={styles.title}>
                {account ? 'Your Life OS account' : 'Make Life OS yours.'}
              </Text>
            </View>
            <Pressable style={styles.close} onPress={onClose}>
              <Icon name="close" size={20} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.body,
              {
                paddingBottom: 24 + Math.max(insets.bottom, 12),
              },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {!account ? (
              <>
                {mode === 'login' || mode === 'register' ? (
                  <View style={styles.modeRow}>
                    {(['register', 'login'] as const).map((item) => (
                      <Pressable
                        key={item}
                        onPress={() => {
                          setMode(item);
                          setError('');
                          setNotice('');
                        }}
                        style={[styles.modeButton, mode === item && styles.modeButtonActive]}
                      >
                        <Text
                          style={[styles.modeText, mode === item && styles.modeTextActive]}
                        >
                          {item === 'register' ? 'Create profile' : 'Sign in'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      setMode('login');
                      setError('');
                      setNotice('');
                    }}
                    style={{ marginBottom: 14 }}
                  >
                    <Text style={[styles.modeText, { color: colors.sageDeep, fontWeight: '700' }]}>
                      ← Back to sign in
                    </Text>
                  </Pressable>
                )}
                {mode === 'register' && (
                  <Field
                    autoCapitalize="words"
                    label="DISPLAY NAME"
                    onChangeText={setDisplayName}
                    placeholder="Your name"
                    value={displayName}
                  />
                )}
                {(mode === 'register' ||
                  mode === 'login' ||
                  mode === 'forgot' ||
                  mode === 'reset') && (
                  <Field
                    keyboardType="email-address"
                    label="EMAIL"
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    value={email}
                  />
                )}
                {(mode === 'register' || mode === 'login') && (
                  <Field
                    label="PASSWORD"
                    onChangeText={setPassword}
                    placeholder="At least 10 characters"
                    secureTextEntry
                    value={password}
                  />
                )}
                {mode === 'reset' && (
                  <>
                    <Field
                      label="VERIFICATION CODE"
                      onChangeText={setResetCode}
                      placeholder="6-digit code"
                      value={resetCode}
                    />
                    <Field
                      label="NEW PASSWORD"
                      onChangeText={setNewPassword}
                      placeholder="At least 10 characters"
                      secureTextEntry
                      value={newPassword}
                    />
                  </>
                )}
                {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
                {mode === 'login' || mode === 'register' ? (
                  <View style={styles.privacyNote}>
                    <Icon name="lock-closed-outline" size={17} color={colors.sageDeep} />
                    <Text style={styles.privacyText}>
                      Your personal account stays separate. Linking a partner creates a
                      shared household; private items remain private.
                    </Text>
                  </View>
                ) : null}
                {(mode === 'login' || mode === 'register') && (
                  <ActionButton
                    disabled={
                      busy ||
                      !email.trim() ||
                      password.length < 10 ||
                      (mode === 'register' && !displayName.trim())
                    }
                    icon={mode === 'register' ? 'person-add-outline' : 'log-in-outline'}
                    label={
                      busy
                        ? 'Connecting…'
                        : mode === 'register'
                          ? 'Create profile'
                          : 'Sign in'
                    }
                    onPress={authenticate}
                  />
                )}
                {mode === 'forgot' && (
                  <ActionButton
                    disabled={busy || !email.trim()}
                    icon="mail-outline"
                    label={busy ? 'Sending…' : 'Send verification code'}
                    onPress={() =>
                      void perform(async () => {
                        const result = await forgotPassword(email.trim());
                        setNotice(result.message);
                        setMode('reset');
                      })
                    }
                  />
                )}
                {mode === 'reset' && (
                  <ActionButton
                    disabled={
                      busy ||
                      !email.trim() ||
                      resetCode.trim().length < 4 ||
                      newPassword.length < 10
                    }
                    icon="key-outline"
                    label={busy ? 'Updating…' : 'Set new password'}
                    onPress={() =>
                      void perform(async () => {
                        await verifyResetCode(email.trim(), resetCode.trim());
                        const next = await resetPassword({
                          email: email.trim(),
                          code: resetCode.trim(),
                          newPassword,
                        });
                        onAccountChange(next);
                        setPassword('');
                        setNewPassword('');
                        setResetCode('');
                        notify('Password updated. You are signed in.');
                      })
                    }
                  />
                )}
                {mode === 'login' ? (
                  <Pressable
                    onPress={() => {
                      setMode('forgot');
                      setError('');
                      setNotice('');
                    }}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={[styles.modeText, { color: colors.sageDeep, fontWeight: '700' }]}>
                      Forgot password?
                    </Text>
                  </Pressable>
                ) : null}
                {providers?.google &&
                googleClientId &&
                (mode === 'login' || mode === 'register') ? (
                  <ActionButton
                    disabled={busy || !googleRequest}
                    icon="logo-google"
                    label={busy ? 'Connecting…' : 'Continue with Google'}
                    onPress={() =>
                      void perform(async () => {
                        const result = await googlePromptAsync();
                        if (result.type !== 'success') {
                          throw new Error('Google sign-in was cancelled.');
                        }
                        const idToken = result.params.id_token;
                        if (!idToken) {
                          throw new Error('Google did not return an ID token.');
                        }
                        const next = await loginWithGoogle(idToken);
                        onAccountChange(next);
                        notify('Signed in with Google.');
                      })
                    }
                    secondary
                  />
                ) : null}
                <Text style={styles.serverText}>Server: {apiBaseUrl}</Text>
              </>
            ) : (
              <>
                <View style={styles.profileCard}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {account.user.displayName
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.profileCopy}>
                    <Text style={styles.profileName}>{account.user.displayName}</Text>
                    <Text style={styles.profileEmail}>{account.user.email}</Text>
                  </View>
                  <View style={styles.onlinePill}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>Signed in</Text>
                  </View>
                </View>

                <Field
                  autoCapitalize="words"
                  label="DISPLAY NAME"
                  onChangeText={setDisplayName}
                  placeholder="Your name"
                  value={displayName}
                />
                <Text style={styles.label}>CURRENCY</Text>
                <View style={styles.modeRow}>
                  {currencies.slice(0, 4).map((code) => (
                    <Pressable
                      key={code}
                      onPress={() => setProfileCurrency(code)}
                      style={[
                        styles.modeButton,
                        profileCurrency === code && styles.modeButtonActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.modeText,
                          profileCurrency === code && styles.modeTextActive,
                        ]}
                      >
                        {code}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <ActionButton
                  disabled={busy || !displayName.trim()}
                  label="Save profile"
                  onPress={saveProfile}
                  secondary
                />

                <View style={styles.sectionHeading}>
                  <View>
                    <Text style={styles.sectionTitle}>Household</Text>
                    <Text style={styles.sectionCaption}>
                      One shared space, two independent accounts.
                    </Text>
                  </View>
                  <View style={styles.rolePill}>
                    <Text style={styles.roleText}>{activeHousehold?.role ?? 'MEMBER'}</Text>
                  </View>
                </View>

                {account.households.map((household) => (
                  <Pressable
                    key={household.id}
                    disabled={household.active || busy}
                    onPress={() =>
                      void perform(async () => {
                        onAccountChange(await setActiveHousehold(household.id));
                      })
                    }
                    style={[
                      styles.householdRow,
                      household.active && styles.householdRowActive,
                    ]}
                  >
                    <View style={styles.householdIcon}>
                      <Icon name="home-outline" size={17} color={colors.sageDeep} />
                    </View>
                    <View style={styles.householdCopy}>
                      <Text style={styles.householdName}>{household.name}</Text>
                      <Text style={styles.householdMeta}>
                        {household.role === 'OWNER' ? 'Created by you' : 'Shared with you'}
                      </Text>
                    </View>
                    {household.active ? (
                      <Icon name="checkmark-circle" size={20} color={colors.sageDeep} />
                    ) : (
                      <Text style={styles.switchText}>Switch</Text>
                    )}
                  </Pressable>
                ))}

                <Text style={styles.label}>MEMBERS</Text>
                {account.members.map((member) => (
                  <View key={member.id} style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {member.displayName.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberCopy}>
                      <Text style={styles.memberName}>{member.displayName}</Text>
                      <Text style={styles.memberEmail}>{member.email}</Text>
                    </View>
                    <Text style={styles.memberRole}>{member.role}</Text>
                  </View>
                ))}

                {canInvite && (
                  <View style={styles.inviteCard}>
                    <View style={styles.inviteHeading}>
                      <View style={styles.inviteIcon}>
                        <Icon name="link-outline" size={18} color={colors.sageDeep} />
                      </View>
                      <View style={styles.inviteCopy}>
                        <Text style={styles.inviteTitle}>Link your partner</Text>
                        <Text style={styles.inviteText}>
                          They keep their own login and choose what to share.
                        </Text>
                      </View>
                    </View>
                    {!generatedInvite ? (
                      <>
                        <Field
                          keyboardType="email-address"
                          label="PARTNER EMAIL (OPTIONAL)"
                          onChangeText={setPartnerEmail}
                          placeholder="partner@example.com"
                          value={partnerEmail}
                        />
                        <ActionButton
                          disabled={busy}
                          icon="paper-plane-outline"
                          label={busy ? 'Creating…' : 'Create secure invitation'}
                          onPress={makeInvite}
                        />
                      </>
                    ) : (
                      <>
                        <View style={styles.inviteReady}>
                          <Icon name="checkmark-circle" size={20} color={colors.sageDeep} />
                          <View style={styles.inviteReadyCopy}>
                            <Text style={styles.inviteReadyTitle}>Invitation ready</Text>
                            <Text style={styles.inviteReadyText}>Expires in seven days</Text>
                          </View>
                        </View>
                        <ActionButton
                          icon="share-outline"
                          label="Share invitation"
                          onPress={shareInvite}
                        />
                      </>
                    )}
                  </View>
                )}

                {(activeHousehold?.role === 'PARTNER' || account.members.length < 2) && (
                  <View style={styles.acceptCard}>
                    <Text style={styles.sectionTitle}>Have an invite code?</Text>
                    <Text style={styles.sectionCaption}>
                      Paste the code from your partner to join their household.
                    </Text>
                    <Field
                      label="INVITE CODE"
                      onChangeText={setInviteToken}
                      placeholder="Paste secure invite code"
                      value={inviteToken}
                    />
                    <ActionButton
                      disabled={busy || inviteToken.trim().length < 32}
                      label="Join household"
                      onPress={acceptInvite}
                      secondary
                    />
                  </View>
                )}

                <ActionButton
                  disabled={busy}
                  icon="log-out-outline"
                  label="Sign out"
                  onPress={signOut}
                  secondary
                />
              </>
            )}

            {error ? (
              <View style={styles.errorBox}>
                <Icon name="alert-circle-outline" size={17} color={colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(10,24,19,0.58)',
  },
  dismissArea: {
    flex: 0.08,
  },
  sheet: {
    flex: 1,
    maxHeight: '94%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colors.paper,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D4DAD5',
    marginTop: 9,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 17,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eyebrow: {
    color: colors.sageDeep,
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: colors.ink,
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    fontSize: 25,
    lineHeight: 29,
    marginTop: 6,
  },
  close: {
    width: 35,
    height: 35,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    padding: 20,
    paddingBottom: 42,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 5,
    borderRadius: 12,
    padding: 4,
    backgroundColor: colors.canvas,
    marginBottom: 18,
  },
  modeButton: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.paper,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  modeText: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '600',
  },
  modeTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  field: {
    marginBottom: 14,
  },
  label: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 7,
  },
  input: {
    height: 47,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    paddingHorizontal: 13,
    color: colors.ink,
    fontSize: 11,
    backgroundColor: colors.paper,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#F0F5ED',
    marginBottom: 16,
  },
  privacyText: {
    flex: 1,
    color: colors.sageDeep,
    fontSize: 9,
    lineHeight: 14,
  },
  noticeText: {
    color: colors.sageDeep,
    backgroundColor: colors.sage,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    marginBottom: 10,
  },
  actionButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.ink,
    marginBottom: 10,
  },
  actionButtonSecondary: {
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  actionTextSecondary: {
    color: colors.ink,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  serverText: {
    color: colors.muted,
    fontSize: 8,
    textAlign: 'center',
    marginTop: 5,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 15,
    padding: 14,
    backgroundColor: colors.ink,
    marginBottom: 18,
  },
  avatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.acid,
  },
  avatarText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  profileCopy: {
    flex: 1,
  },
  profileName: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  profileEmail: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    marginTop: 3,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'rgba(214,245,122,0.12)',
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.acid,
  },
  onlineText: {
    color: colors.acid,
    fontSize: 8,
    fontWeight: '700',
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionCaption: {
    color: colors.muted,
    fontSize: 9,
    lineHeight: 13,
    marginTop: 3,
  },
  rolePill: {
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 6,
    backgroundColor: colors.sage,
  },
  roleText: {
    color: colors.sageDeep,
    fontSize: 8,
    fontWeight: '800',
  },
  householdRow: {
    minHeight: 63,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 13,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  householdRowActive: {
    borderColor: '#AFC2A8',
    backgroundColor: '#F5F8F3',
  },
  householdIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sage,
  },
  householdCopy: {
    flex: 1,
  },
  householdName: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  householdMeta: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 3,
  },
  switchText: {
    color: colors.sageDeep,
    fontSize: 9,
    fontWeight: '700',
  },
  memberRow: {
    minHeight: 55,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EDE4D3',
  },
  memberAvatarText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '800',
  },
  memberCopy: {
    flex: 1,
  },
  memberName: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  memberEmail: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 2,
  },
  memberRole: {
    color: colors.muted,
    fontSize: 8,
    fontWeight: '700',
  },
  inviteCard: {
    borderWidth: 1,
    borderColor: '#C9D8C4',
    borderRadius: 16,
    padding: 15,
    backgroundColor: '#F5F8F3',
    marginVertical: 17,
  },
  inviteHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  inviteIcon: {
    width: 37,
    height: 37,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sage,
  },
  inviteCopy: {
    flex: 1,
  },
  inviteTitle: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  inviteText: {
    color: colors.muted,
    fontSize: 8,
    lineHeight: 12,
    marginTop: 3,
  },
  inviteReady: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    padding: 11,
    backgroundColor: colors.paper,
    marginBottom: 10,
  },
  inviteReadyCopy: {
    flex: 1,
  },
  inviteReadyTitle: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: '700',
  },
  inviteReadyText: {
    color: colors.muted,
    fontSize: 8,
    marginTop: 2,
  },
  acceptCard: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 17,
    marginTop: 5,
    marginBottom: 10,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.amberSoft,
    marginTop: 8,
  },
  errorText: {
    flex: 1,
    color: '#95513A',
    fontSize: 9,
    lineHeight: 14,
  },
});
