import { Platform } from 'react-native';
import { Adjustments } from '../types/adjustments';
import { processPhoto } from './processPhoto';

export type ExportResult = {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
};

/**
 * Process and export an edited photo as JPEG (web data URL or native file URI).
 */
export async function exportEditedImage(
  sourceUri: string,
  adjustments: Adjustments,
  quality = 0.92,
  maxEdge = 2560,
): Promise<ExportResult> {
  return processPhoto(sourceUri, adjustments, {
    maxEdge,
    preview: false,
    quality,
  });
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  if (Platform.OS !== 'web') return;
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function shareOrSave(
  uri: string,
  filename: string,
): Promise<'downloaded' | 'shared' | 'saved'> {
  if (Platform.OS === 'web') {
    if (uri.startsWith('data:')) {
      downloadDataUrl(uri, filename);
      return 'downloaded';
    }
    // http(s) / blob — fetch then download
    const res = await fetch(uri);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    downloadDataUrl(objectUrl, filename);
    URL.revokeObjectURL(objectUrl);
    return 'downloaded';
  }

  const Sharing = await import('expo-sharing');
  const available = await Sharing.isAvailableAsync();
  if (available) {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/jpeg',
      dialogTitle: 'Export photo',
      UTI: 'public.jpeg',
    });
    return 'shared';
  }

  const MediaLibrary = await import('expo-media-library');
  const perm = await MediaLibrary.requestPermissionsAsync();
  if (!perm.granted) throw new Error('Media library permission denied');
  await MediaLibrary.saveToLibraryAsync(uri);
  return 'saved';
}
