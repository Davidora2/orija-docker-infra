import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Asset } from 'expo-asset';
import {
  useFonts,
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import {
  Fraunces_500Medium,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import demoPhoto from './assets/demo-photo.jpg';

import {
  ADJUSTMENT_META,
  Adjustments,
  DEFAULT_ADJUSTMENTS,
  Preset,
  isNeutral,
} from './src/types/adjustments';
import { BUILTIN_PRESETS } from './src/lib/presets';
import {
  looksLikeLightroomPreset,
  parseLrTemplate,
  xmpToPreset,
} from './src/lib/xmpParser';
import { exportEditedImage, shareOrSave } from './src/lib/exportImage';
import {
  addImportedPreset,
  loadImportedPresets,
  removeImportedPreset,
} from './src/storage/presetStore';
import { PhotoCanvas } from './src/components/PhotoCanvas';
import { AdjustmentSlider } from './src/components/AdjustmentSlider';
import { PresetStrip } from './src/components/PresetStrip';
import { colors } from './src/theme/colors';

type Tab = 'light' | 'color' | 'effects' | 'presets';
type Screen = 'home' | 'editor';

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Fraunces_500Medium,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
  });

  const [screen, setScreen] = useState<Screen>('home');
  const [uri, setUri] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustments>(DEFAULT_ADJUSTMENTS);
  const [tab, setTab] = useState<Tab>('light');
  const [showOriginal, setShowOriginal] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>('original');
  const [imported, setImported] = useState<Preset[]>([]);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadImportedPresets().then(setImported);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const allPresets = useMemo(
    () => [...BUILTIN_PRESETS, ...imported],
    [imported],
  );

  const flash = (msg: string) => setToast(msg);

  const pickPhoto = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to edit images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUri(result.assets[0].uri);
    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
    setActivePresetId('original');
    setTab('light');
    setScreen('editor');
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 1,
      exif: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    setUri(result.assets[0].uri);
    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
    setActivePresetId('original');
    setTab('light');
    setScreen('editor');
  }, []);

  const openDemo = useCallback(async () => {
    try {
      const asset = Asset.fromModule(demoPhoto);
      await asset.downloadAsync();
      const demoUri = asset.localUri ?? asset.uri;
      setUri(demoUri);
      setAdjustments({ ...DEFAULT_ADJUSTMENTS });
      setActivePresetId('original');
      setTab('presets');
      setScreen('editor');
    } catch (err) {
      Alert.alert(
        'Demo unavailable',
        err instanceof Error ? err.message : 'Could not load demo photo.',
      );
    }
  }, []);

  const importPreset = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/octet-stream',
          'text/xml',
          'application/xml',
          'text/plain',
          '*/*',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const name = asset.name ?? 'preset.xmp';

      let text = '';
      if (Platform.OS === 'web' && asset.file) {
        text = await asset.file.text();
      } else {
        const res = await fetch(asset.uri);
        text = await res.text();
      }

      if (!looksLikeLightroomPreset(text) && !/\.xmp$/i.test(name)) {
        // Try lrtemplate lua table
        const lr = parseLrTemplate(text);
        if (!lr) {
          Alert.alert(
            'Unsupported file',
            'Drop a Lightroom .xmp or .lrtemplate preset file.',
          );
          return;
        }
        const preset: Preset = {
          id: `imported-${Date.now()}`,
          name: lr.name,
          source: 'imported',
          adjustments: lr.adjustments,
          rawXmp: text,
        };
        const next = await addImportedPreset(preset);
        setImported(next);
        setAdjustments({ ...lr.adjustments });
        setActivePresetId(preset.id);
        setTab('presets');
        flash(`Imported “${preset.name}”`);
        return;
      }

      const preset = xmpToPreset(text);
      if (/\.xmp$/i.test(name) && preset.name === 'Imported Preset') {
        preset.name = name.replace(/\.xmp$/i, '');
      }
      const next = await addImportedPreset(preset);
      setImported(next);
      setAdjustments({ ...preset.adjustments });
      setActivePresetId(preset.id);
      setTab('presets');
      flash(`Imported “${preset.name}”`);
    } catch (err) {
      Alert.alert(
        'Import failed',
        err instanceof Error ? err.message : 'Could not read preset.',
      );
    }
  }, []);

  const applyPreset = (preset: Preset) => {
    setAdjustments({ ...preset.adjustments });
    setActivePresetId(preset.id);
  };

  const resetEdits = () => {
    setAdjustments({ ...DEFAULT_ADJUSTMENTS });
    setActivePresetId('original');
  };

  const setAdj = (key: keyof Adjustments, value: number) => {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
    setActivePresetId(null);
  };

  const exportPhoto = async () => {
    if (!uri) return;
    setExporting(true);
    try {
      if (Platform.OS === 'web') {
        const result = await exportEditedImage(uri, adjustments);
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        await shareOrSave(result.uri, `lumen-${stamp}.jpg`);
        flash('Exported JPEG');
      } else if (isNeutral(adjustments)) {
        await shareOrSave(uri, 'lumen-export.jpg');
        flash('Shared original');
      } else {
        // Native without full canvas: share source + note
        await shareOrSave(uri, 'lumen-export.jpg');
        flash('Shared (open in web for full bake)');
      }
    } catch (err) {
      Alert.alert(
        'Export failed',
        err instanceof Error ? err.message : 'Could not export.',
      );
    } finally {
      setExporting(false);
    }
  };

  const deleteImported = async (id: string) => {
    const next = await removeImportedPreset(id);
    setImported(next);
    if (activePresetId === id) setActivePresetId(null);
    flash('Preset removed');
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        {screen === 'home' ? (
          <Home
            onPick={pickPhoto}
            onCamera={takePhoto}
            onDemo={openDemo}
            onImportPreset={importPreset}
            importedCount={imported.length}
          />
        ) : (
          <Editor
            uri={uri}
            adjustments={adjustments}
            tab={tab}
            setTab={setTab}
            showOriginal={showOriginal}
            setShowOriginal={setShowOriginal}
            activePresetId={activePresetId}
            allPresets={allPresets}
            imported={imported}
            exporting={exporting}
            onBack={() => {
              setScreen('home');
              setUri(null);
            }}
            onReset={resetEdits}
            onExport={exportPhoto}
            onAdj={setAdj}
            onPreset={applyPreset}
            onImportPreset={importPreset}
            onDeleteImported={deleteImported}
            onPick={pickPhoto}
          />
        )}

        {toast ? (
          <View style={styles.toast}>
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Home({
  onPick,
  onCamera,
  onDemo,
  onImportPreset,
  importedCount,
}: {
  onPick: () => void;
  onCamera: () => void;
  onDemo: () => void;
  onImportPreset: () => void;
  importedCount: number;
}) {
  return (
    <View style={styles.home}>
      <LinearGradient
        colors={['#1A1410', '#0B0B0D', '#0B0B0D']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.homeGrain} />

      <View style={styles.homeBrand}>
        <Text style={styles.brandMark}>Lumen</Text>
        <Text style={styles.brandTag}>
          Edit photos. Import Lightroom presets. Export clean.
        </Text>
      </View>

      <View style={styles.homeActions}>
        <Pressable style={styles.primaryBtn} onPress={onPick}>
          <Text style={styles.primaryBtnText}>Open photo</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onCamera}>
          <Text style={styles.secondaryBtnText}>Take photo</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={onDemo}>
          <Text style={styles.secondaryBtnText}>Try demo photo</Text>
        </Pressable>
        <Pressable style={styles.ghostBtn} onPress={onImportPreset}>
          <Text style={styles.ghostBtnText}>
            Import .xmp preset
            {importedCount > 0 ? ` · ${importedCount} saved` : ''}
          </Text>
        </Pressable>
      </View>

      <Text style={styles.homeFoot}>
        Compatible with Adobe Lightroom / Camera Raw XMP presets
      </Text>
    </View>
  );
}

function Editor({
  uri,
  adjustments,
  tab,
  setTab,
  showOriginal,
  setShowOriginal,
  activePresetId,
  allPresets,
  imported,
  exporting,
  onBack,
  onReset,
  onExport,
  onAdj,
  onPreset,
  onImportPreset,
  onDeleteImported,
  onPick,
}: {
  uri: string | null;
  adjustments: Adjustments;
  tab: Tab;
  setTab: (t: Tab) => void;
  showOriginal: boolean;
  setShowOriginal: (v: boolean) => void;
  activePresetId: string | null;
  allPresets: Preset[];
  imported: Preset[];
  exporting: boolean;
  onBack: () => void;
  onReset: () => void;
  onExport: () => void;
  onAdj: (key: keyof Adjustments, value: number) => void;
  onPreset: (p: Preset) => void;
  onImportPreset: () => void;
  onDeleteImported: (id: string) => void;
  onPick: () => void;
}) {
  const sliders = ADJUSTMENT_META.filter((m) => m.group === tab);

  return (
    <View style={styles.editor}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.topBtn}>
          <Text style={styles.topBtnText}>Close</Text>
        </Pressable>
        <Text style={styles.topTitle}>Lumen</Text>
        <Pressable
          onPress={onExport}
          hitSlop={12}
          style={styles.exportBtn}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color={colors.accentText} size="small" />
          ) : (
            <Text style={styles.exportBtnText}>Export</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.canvasArea}>
        <PhotoCanvas
          uri={uri}
          adjustments={adjustments}
          showOriginal={showOriginal}
        />
        <View style={styles.canvasTools}>
          <Pressable
            onPressIn={() => setShowOriginal(true)}
            onPressOut={() => setShowOriginal(false)}
            style={styles.compareBtn}
          >
            <Text style={styles.compareText}>
              {showOriginal ? 'Original' : 'Before'}
            </Text>
          </Pressable>
          <Pressable onPress={onReset} style={styles.compareBtn}>
            <Text style={styles.compareText}>Reset</Text>
          </Pressable>
          <Pressable onPress={onPick} style={styles.compareBtn}>
            <Text style={styles.compareText}>Replace</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.bottomPanel}>
        <View style={styles.tabs}>
          {(
            [
              ['light', 'Light'],
              ['color', 'Color'],
              ['effects', 'Effects'],
              ['presets', 'Presets'],
            ] as const
          ).map(([id, label]) => (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[styles.tab, tab === id && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === id && styles.tabTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'presets' ? (
          <View style={styles.presetPanel}>
            <PresetStrip
              presets={allPresets}
              activeId={activePresetId}
              onSelect={onPreset}
              onImport={onImportPreset}
            />
            {imported.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.importedRow}
              >
                {imported.map((p) => (
                  <Pressable
                    key={p.id}
                    onLongPress={() => onDeleteImported(p.id)}
                    style={styles.importedChip}
                  >
                    <Text style={styles.importedChipText} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.importedHint}>hold to delete</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.presetHint}>
                Import Adobe Lightroom .xmp presets — adjustments map to Exposure,
                Contrast, Highlights, Shadows, Temp, Tint, Vibrance, and more.
              </Text>
            )}
          </View>
        ) : (
          <ScrollView
            style={styles.sliderScroll}
            contentContainerStyle={styles.sliderContent}
            showsVerticalScrollIndicator={false}
          >
            {sliders.map((meta) => (
              <AdjustmentSlider
                key={meta.key}
                meta={meta}
                value={adjustments[meta.key]}
                onChange={(v) => onAdj(meta.key, v)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  home: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
    paddingBottom: 36,
    paddingTop: 48,
  },
  homeGrain: {
    ...StyleSheet.absoluteFill,
    opacity: 0.035,
    backgroundColor: '#C4A882',
  },
  homeBrand: {
    marginTop: 48,
    gap: 16,
  },
  brandMark: {
    fontFamily: 'Fraunces_700Bold',
    fontSize: 64,
    color: colors.text,
    letterSpacing: -1.5,
    lineHeight: 68,
  },
  brandTag: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 17,
    color: colors.textMuted,
    lineHeight: 26,
    maxWidth: 300,
  },
  homeActions: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 4,
  },
  primaryBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: colors.accentText,
    letterSpacing: 0.3,
  },
  secondaryBtn: {
    backgroundColor: colors.panel,
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.panelBorder,
  },
  secondaryBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: colors.text,
  },
  ghostBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostBtnText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    color: colors.textMuted,
  },
  homeFoot: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: colors.textDim,
    textAlign: 'center',
  },
  editor: {
    flex: 1,
  },
  topBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  topBtn: {
    minWidth: 64,
  },
  topBtnText: {
    fontFamily: 'Outfit_500Medium',
    color: colors.textMuted,
    fontSize: 15,
  },
  topTitle: {
    fontFamily: 'Fraunces_600SemiBold',
    color: colors.text,
    fontSize: 18,
  },
  exportBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    minWidth: 72,
    alignItems: 'center',
  },
  exportBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    color: colors.accentText,
    fontSize: 14,
  },
  canvasArea: {
    flex: 1,
    position: 'relative',
  },
  canvasTools: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  compareBtn: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  compareText: {
    color: colors.text,
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
  },
  bottomPanel: {
    height: 300,
    backgroundColor: colors.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingTop: 8,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 4,
  },
  tabActive: {
    backgroundColor: colors.accentSoft,
  },
  tabText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: colors.textDim,
    letterSpacing: 0.2,
  },
  tabTextActive: {
    color: colors.accent,
  },
  sliderScroll: {
    flex: 1,
  },
  sliderContent: {
    paddingVertical: 8,
    paddingBottom: 24,
  },
  presetPanel: {
    flex: 1,
    paddingBottom: 16,
  },
  presetHint: {
    marginTop: 14,
    marginHorizontal: 20,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: colors.textDim,
    lineHeight: 20,
  },
  importedRow: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  importedChip: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    maxWidth: 160,
  },
  importedChipText: {
    color: colors.text,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
  },
  importedHint: {
    color: colors.textDim,
    fontFamily: 'Outfit_400Regular',
    fontSize: 10,
    marginTop: 2,
  },
  toast: {
    position: 'absolute',
    bottom: 320,
    alignSelf: 'center',
    backgroundColor: 'rgba(20,20,24,0.92)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    pointerEvents: 'none',
  },
  toastText: {
    color: colors.text,
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
  },
});
