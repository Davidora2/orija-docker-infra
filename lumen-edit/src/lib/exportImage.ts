import { Platform } from 'react-native';
import { Adjustments } from '../types/adjustments';
import { applyAdjustmentsToImageData } from './imageProcessor';

export type ExportResult = {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
};

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for export'));
    img.src = uri;
  });
}

/**
 * Process and export an edited photo as a JPEG data URL / blob URI.
 * Full-fidelity path for web; native callers should prefer this when
 * Platform.OS === 'web', otherwise fall back to sharing the preview.
 */
export async function exportEditedImage(
  sourceUri: string,
  adjustments: Adjustments,
  quality = 0.92,
  maxEdge = 4096,
): Promise<ExportResult> {
  if (Platform.OS !== 'web') {
    throw new Error(
      'Full pixel export runs on web. On device, use Expo Go web or a dev build with canvas.',
    );
  }

  const img = await loadImage(sourceUri);
  let { width, height } = img;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unsupported');

  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  applyAdjustmentsToImageData(imageData, adjustments);
  ctx.putImageData(imageData, 0, 0);

  const mimeType = 'image/jpeg';
  const dataUrl = canvas.toDataURL(mimeType, quality);
  return { uri: dataUrl, width, height, mimeType };
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
    downloadDataUrl(uri, filename);
    return 'downloaded';
  }

  // Native: share the file URI (preview/original path)
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
