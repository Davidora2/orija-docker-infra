import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import { posterHeight, posterWidth } from "../utils/platform";
import Focusable from "./Focusable";

export default function PosterCard({ title, subtitle, poster, onPress, width, height }) {
  const w = width || posterWidth;
  const h = height || posterHeight;

  return (
    <Focusable onPress={onPress} style={[styles.wrap, { width: w }]}>
      <View style={[styles.art, { width: w, height: h }]}>
        {poster ? (
          <Image source={{ uri: poster }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>ORIJA</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={2} style={styles.title}>
        {title}
      </Text>
      {!!subtitle && (
        <Text numberOfLines={1} style={styles.sub}>
          {subtitle}
        </Text>
      )}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginRight: 12,
    marginBottom: 8,
    padding: 4,
  },
  art: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgElevated,
  },
  placeholderText: {
    color: colors.accent,
    fontWeight: "700",
    letterSpacing: 2,
  },
  title: {
    color: colors.text,
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
  },
  sub: {
    color: colors.muted,
    fontSize: 11,
    marginTop: 2,
  },
});
