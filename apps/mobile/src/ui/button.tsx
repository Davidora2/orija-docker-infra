import * as Haptics from 'expo-haptics';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { ReactNode } from 'react';
import { colors } from './theme';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'acid'
  | 'outlineDark'
  | 'ghost';

function tap() {
  if (Platform.OS !== 'web') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

export function AppButton({
  children,
  onPress,
  variant = 'primary',
  style,
  disabled,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress: () => void;
  variant?: ButtonVariant;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        variant === 'secondary' && styles.secondary,
        variant === 'acid' && styles.acid,
        variant === 'outlineDark' && styles.outlineDark,
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text
          allowFontScaling
          maxFontSizeMultiplier={1.2}
          style={[
            styles.text,
            variant === 'secondary' && styles.textSecondary,
            variant === 'acid' && styles.textAcid,
            variant === 'outlineDark' && styles.textOutlineDark,
            variant === 'ghost' && styles.textGhost,
          ]}
        >
          {children}
        </Text>
      ) : (
        <View style={styles.row}>{children}</View>
      )}
    </Pressable>
  );
}

export function AcidButtonLabel({
  children,
  icon,
}: {
  children: string;
  icon?: ReactNode;
}) {
  return (
    <>
      {icon}
      <Text allowFontScaling maxFontSizeMultiplier={1.2} style={styles.textAcid}>
        {children}
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    backgroundColor: colors.ink,
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 16,
  },
  secondary: {
    backgroundColor: colors.paper,
    borderColor: colors.line,
    borderWidth: 1,
  },
  acid: {
    backgroundColor: colors.acid,
    flexDirection: 'row',
    gap: 8,
  },
  outlineDark: {
    backgroundColor: 'transparent',
    borderColor: colors.outlineOnDark,
    borderWidth: 1,
  },
  ghost: { backgroundColor: 'transparent' },
  pressed: { opacity: 0.88 },
  disabled: { opacity: 0.5 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  text: { color: colors.paper, fontSize: 12, fontWeight: '700' },
  textSecondary: { color: colors.ink },
  textAcid: { color: colors.acidInk, fontSize: 12, fontWeight: '700' },
  textOutlineDark: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '700' },
  textGhost: { color: colors.muted, fontSize: 12, fontWeight: '700' },
});
