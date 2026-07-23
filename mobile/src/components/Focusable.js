import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors } from "../theme";
import { isTV } from "../utils/platform";

/**
 * TV/remote-friendly pressable with visible focus ring.
 */
export default function Focusable({
  children,
  onPress,
  style,
  focusStyle,
  disabled,
  hasTVPreferredFocus,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      focusable={isTV || true}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.base,
        style,
        focused && [styles.focused, focusStyle],
        pressed && !isTV && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <View pointerEvents="box-none">{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  focused: {
    borderColor: colors.focus,
    transform: [{ scale: 1.04 }],
    backgroundColor: "rgba(212, 175, 106, 0.08)",
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
});
