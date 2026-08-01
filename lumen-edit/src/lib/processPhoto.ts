import { Platform } from 'react-native';
import { Buffer } from 'buffer';
import jpeg from 'jpeg-js';
import { Adjustments, isNeutral } from '../types/adjustments';
import {
  applyAdjustmentsToImageData,
  resizeRgba,
} from './imageProcessor';

const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (!g.Buffer) g.Buffer = Buffer;

export type ProcessResult = {
  uri: string;
  width: number;
  height: number;
  mimeType: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode.apply(
      null,
      Array.from(slice) as unknown as number[],
    );
  }
  if (typeof globalThis.btoa === 'function') {
    return globalThis.btoa(binary);
  }
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const n = (a << 16) | (b << 8) | c;
    out += chars[(n >> 18) & 63];
    out += chars[(n >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? chars[n & 63] : '=';
  }
  return out;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

async function readBytes(uri: string): Promise<Uint8Array> {
  if (uri.startsWith('data:')) {
    const comma = uri.indexOf(',');
    const meta = uri.slice(0, comma);
    const payload = uri.slice(comma + 1);
    if (/;base64/i.test(meta)) {
      const bin = globalThis.atob(payload);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new TextEncoder().encode(decodeURIComponent(payload));
  }

  const res = await fetch(uri);
  if (!res.ok) throw new Error(`Failed to read image (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Decode any browser-supported image to small RGBA via canvas draw (no full-res getImageData). */
async function decodeToRgbaWeb(
  sourceUri: string,
  maxEdge: number,
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to load image'));
    el.src = sourceUri;
  });

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  // Detach from canvas ASAP
  canvas.width = 0;
  canvas.height = 0;
  return {
    data: new Uint8ClampedArray(imageData.data),
    width,
    height,
  };
}

async function rgbaToObjectUrl(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  quality: number,
): Promise<string> {
  const encoded = jpeg.encode(
    { data, width, height },
    Math.round(quality * 100),
  );
  const jpegBytes =
    encoded.data instanceof Uint8Array
      ? encoded.data
      : new Uint8Array(encoded.data);

  if (Platform.OS === 'web' && typeof Blob !== 'undefined') {
    const copy = new Uint8Array(jpegBytes.byteLength);
    copy.set(jpegBytes);
    const blob = new Blob([copy.buffer], { type: 'image/jpeg' });
    return URL.createObjectURL(blob);
  }

  if (Platform.OS === 'web') {
    return `data:image/jpeg;base64,${bytesToBase64(jpegBytes)}`;
  }

  const FileSystem = await import('expo-file-system/legacy');
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('No cache directory');
  const outUri = `${dir}lumen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  await FileSystem.writeAsStringAsync(outUri, bytesToBase64(jpegBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return outUri;
}

async function processViaJpegJs(
  sourceUri: string,
  adjustments: Adjustments,
  maxEdge: number,
  preview: boolean,
  quality: number,
): Promise<ProcessResult> {
  const bytes = await readBytes(sourceUri);
  if (!isJpeg(bytes)) {
    throw new Error(
      'This image format needs conversion. Try a JPEG photo, or open the demo photo.',
    );
  }

  const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
  let width = decoded.width;
  let height = decoded.height;
  let data: Uint8ClampedArray = new Uint8ClampedArray(decoded.data.length);
  data.set(decoded.data);

  const resized = resizeRgba(data, width, height, maxEdge);
  data = resized.data;
  width = resized.width;
  height = resized.height;

  if (!isNeutral(adjustments)) {
    applyAdjustmentsToImageData({ data, width, height }, adjustments, {
      preview,
    });
  }

  const uri = await rgbaToObjectUrl(data, width, height, quality);
  return { uri, width, height, mimeType: 'image/jpeg' };
}

async function processViaWebDecode(
  sourceUri: string,
  adjustments: Adjustments,
  maxEdge: number,
  preview: boolean,
  quality: number,
): Promise<ProcessResult> {
  const { data, width, height } = await decodeToRgbaWeb(sourceUri, maxEdge);
  if (!isNeutral(adjustments)) {
    applyAdjustmentsToImageData({ data, width, height }, adjustments, {
      preview,
    });
  }
  const uri = await rgbaToObjectUrl(data, width, height, quality);
  return { uri, width, height, mimeType: 'image/jpeg' };
}

/**
 * Bake Lightroom adjustments into a JPEG URI (blob: on web, file: on native).
 */
export async function processPhoto(
  sourceUri: string,
  adjustments: Adjustments,
  options?: {
    maxEdge?: number;
    preview?: boolean;
    quality?: number;
  },
): Promise<ProcessResult> {
  const preview = options?.preview ?? false;
  // Keep preview tiny to avoid tab OOM; export can be larger
  const maxEdge =
    options?.maxEdge ?? (preview ? 720 : Platform.OS === 'web' ? 2048 : 1600);
  const quality = options?.quality ?? (preview ? 0.78 : 0.9);

  if (isNeutral(adjustments) && !preview) {
    return {
      uri: sourceUri,
      width: 0,
      height: 0,
      mimeType: 'image/jpeg',
    };
  }

  // Prefer jpeg-js everywhere for JPEG sources — predictable memory, no GPU filters.
  // Fall back to canvas decode on web for non-JPEG (e.g. PNG/WebP).
  try {
    return await processViaJpegJs(
      sourceUri,
      adjustments,
      maxEdge,
      preview,
      quality,
    );
  } catch (jpegErr) {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      return processViaWebDecode(
        sourceUri,
        adjustments,
        maxEdge,
        preview,
        quality,
      );
    }
    throw jpegErr;
  }
}

/** Revoke blob: URLs created for previews */
export function revokeProcessUri(uri: string | null | undefined): void {
  if (uri && uri.startsWith('blob:') && typeof URL !== 'undefined') {
    try {
      URL.revokeObjectURL(uri);
    } catch {
      // ignore
    }
  }
}
