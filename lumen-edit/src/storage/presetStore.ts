import AsyncStorage from '@react-native-async-storage/async-storage';
import { Preset } from '../types/adjustments';

const KEY = 'lumen.importedPresets.v1';

export async function loadImportedPresets(): Promise<Preset[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Preset[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveImportedPresets(presets: Preset[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(presets));
}

export async function addImportedPreset(preset: Preset): Promise<Preset[]> {
  const existing = await loadImportedPresets();
  const next = [preset, ...existing.filter((p) => p.id !== preset.id)];
  await saveImportedPresets(next);
  return next;
}

export async function removeImportedPreset(id: string): Promise<Preset[]> {
  const existing = await loadImportedPresets();
  const next = existing.filter((p) => p.id !== id);
  await saveImportedPresets(next);
  return next;
}
