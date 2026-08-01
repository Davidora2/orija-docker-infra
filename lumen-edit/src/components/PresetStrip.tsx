import React from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Preset } from '../types/adjustments';
import { colors } from '../theme/colors';

type Props = {
  presets: Preset[];
  activeId: string | null;
  onSelect: (preset: Preset) => void;
  onImport: () => void;
};

const SWATCH: Record<string, [string, string]> = {
  Original: ['#3A3A40', '#1C1C20'],
  Natural: ['#8B7355', '#2A241C'],
  Vivid: ['#C45C26', '#1A1010'],
  Matte: ['#6B6B70', '#222226'],
  Fade: ['#9A8B7A', '#2A2420'],
  'Warm Glow': ['#D4924A', '#2A1A0C'],
  'Cool Steel': ['#5B7A8C', '#0E161C'],
  'Golden Hour': ['#E0A040', '#2A1808'],
  Moody: ['#2A3040', '#0A0C12'],
  Punch: ['#B04030', '#180808'],
  'Soft Portrait': ['#C8A090', '#2A1E1A'],
  'B&W Classic': ['#888890', '#141416'],
  'B&W High Key': ['#D0D0D8', '#3A3A42'],
  Cinematic: ['#4A6070', '#0C1016'],
};

export function PresetStrip({ presets, activeId, onSelect, onImport }: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Pressable onPress={onImport} style={styles.item}>
          <View style={[styles.swatch, styles.importSwatch]}>
            <Text style={styles.importPlus}>+</Text>
          </View>
          <Text style={styles.name} numberOfLines={1}>
            .xmp/.dng
          </Text>
        </Pressable>

        {presets.map((p) => {
          const active = p.id === activeId;
          const grad = SWATCH[p.name] ?? ['#4A4038', '#1A1612'];
          return (
            <Pressable
              key={p.id}
              onPress={() => onSelect(p)}
              style={styles.item}
            >
              <LinearGradient
                colors={grad}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={[styles.swatch, active && styles.swatchActive]}
              />
              <Text
                style={[styles.name, active && styles.nameActive]}
                numberOfLines={1}
              >
                {p.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingTop: 10,
  },
  row: {
    paddingHorizontal: 14,
    gap: 12,
    alignItems: 'center',
  },
  item: {
    width: 64,
    alignItems: 'center',
    gap: 6,
  },
  swatch: {
    width: 56,
    height: 56,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  swatchActive: {
    borderColor: colors.accent,
  },
  importSwatch: {
    backgroundColor: colors.panel,
    borderColor: colors.panelBorder,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  importPlus: {
    color: colors.accent,
    fontSize: 28,
    fontFamily: 'Outfit_400Regular',
    marginTop: -2,
  },
  name: {
    color: colors.textDim,
    fontSize: 11,
    fontFamily: 'Outfit_500Medium',
    textAlign: 'center',
    width: '100%',
  },
  nameActive: {
    color: colors.text,
  },
});
