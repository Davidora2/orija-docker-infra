import { Platform } from 'react-native';
import jpeg from 'jpeg-js';
import { Adjustments, isNeutral } from '../types/adjustments';
import {
  applyAdjustmentsToImageData,
  resizeRgba,
} from './imageProcessor';

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
  // Minimal base64 fallback
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

async function processViaCanvas(
  sourceUri: string,
  adjustments: Adjustments,
  maxEdge: number,
  preview: boolean,
  quality: number,
): Promise<ProcessResult> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = 'anonymous';
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to load image'));
    el.src = sourceUri;
  });

  let { width, height } = img;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas unsupported');
  ctx.drawImage(img, 0, 0, width, height);

  if (!isNeutral(adjustments)) {
    const imageData = ctx.getImageData(0, 0, width, height);
    applyAdjustmentsToImageData(imageData, adjustments, { preview });
    ctx.putImageData(imageData, 0, 0);
  }

  const mimeType = 'image/jpeg';
  return {
    uri: canvas.toDataURL(mimeType, quality),
    width,
    height,
    mimeType,
  };
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
  let data = new Uint8ClampedArray(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
  // Ensure we own a plain ArrayBuffer-backed copy
  data = new Uint8ClampedArray(data);
  let { width, height } = decoded;

  const resized = resizeRgba(data, width, height, maxEdge);
  data = resized.data;
  width = resized.width;
  height = resized.height;

  if (!isNeutral(adjustments)) {
    applyAdjustmentsToImageData({ data, width, height }, adjustments, {
      preview,
    });
  }

  const encoded = jpeg.encode(
    { data, width, height },
    Math.round(quality * 100),
  );
  const jpegBytes =
    encoded.data instanceof Uint8Array
      ? encoded.data
      : new Uint8Array(encoded.data);

  if (Platform.OS === 'web') {
    const b64 = bytesToBase64(jpegBytes);
    return {
      uri: `data:image/jpeg;base64,${b64}`,
      width,
      height,
      mimeType: 'image/jpeg',
    };
  }

  // Write to cache for native Image / share
  const FileSystem = await import('expo-file-system/legacy');
  const dir = FileSystem.cacheDirectory;
  if (!dir) throw new Error('No cache directory');
  const outUri = `${dir}lumen-${preview ? 'preview' : 'export'}-${Date.now()}.jpg`;
  await FileSystem.writeAsStringAsync(outUri, bytesToBase64(jpegBytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { uri: outUri, width, height, mimeType: 'image/jpeg' };
}

/**
 * Bake Lightroom adjustments into a JPEG.
 * Web uses canvas (any decodeable format). Native uses jpeg-js (JPEG sources).
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
  const maxEdge = options?.maxEdge ?? (options?.preview ? 960 : 2048);
  const preview = options?.preview ?? false;
  const quality = options?.quality ?? (preview ? 0.82 : 0.92);

  if (isNeutral(adjustments) && !preview) {
    // Export of untouched image can pass through
    return {
      uri: sourceUri,
      width: 0,
      height: 0,
      mimeType: 'image/jpeg',
    };
  }

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      return await processViaCanvas(
        sourceUri,
        adjustments,
        maxEdge,
        preview,
        quality,
      );
    } catch {
      // fall through to jpeg-js for data URLs / odd cases
    }
  }

  return processViaJpegJs(sourceUri, adjustments, maxEdge, preview, quality);
}
