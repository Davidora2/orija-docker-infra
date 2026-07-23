import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { isTV, titleSize } from "../utils/platform";
import Focusable from "./Focusable";

export function ScreenHeader({ title, subtitle, right }) {
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={styles.brand}>ORIJAFLIX</Text>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.sub}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function PrimaryButton({ label, onPress, hasTVPreferredFocus, danger, ghost, disabled }) {
  return (
    <Focusable
      onPress={onPress}
      hasTVPreferredFocus={hasTVPreferredFocus}
      disabled={disabled}
      style={[
        styles.btn,
        ghost && styles.btnGhost,
        danger && styles.btnDanger,
        isTV && styles.btnTV,
      ]}
    >
      <Text style={[styles.btnText, ghost && styles.btnGhostText]}>{label}</Text>
    </Focusable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    gap: 12,
  },
  brand: {
    color: colors.accent,
    letterSpacing: 4,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  title: {
    color: colors.text,
    fontSize: titleSize,
    fontWeight: "700",
  },
  sub: {
    color: colors.muted,
    marginTop: 4,
    fontSize: isTV ? 18 : 14,
  },
  btn: {
    backgroundColor: colors.accent,
    paddingVertical: isTV ? 16 : 12,
    paddingHorizontal: isTV ? 28 : 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 6,
  },
  btnTV: {
    minWidth: 220,
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnDanger: {
    backgroundColor: colors.danger,
  },
  btnText: {
    color: "#14110b",
    fontWeight: "700",
    fontSize: isTV ? 18 : 15,
  },
  btnGhostText: {
    color: colors.text,
  },
});
