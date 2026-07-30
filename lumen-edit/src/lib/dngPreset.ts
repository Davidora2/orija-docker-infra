import { Preset } from '../types/adjustments';
import {
  looksLikeLightroomPreset,
  parseLightroomXmp,
  parseLrTemplate,
  xmpToPreset,
} from './xmpParser';

const XMP_TAG = 700; // TIFF / DNG XMLPacket

function decodeUtf8(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return s;
}

function decodeLatin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return s;
}

/**
 * Scan binary for an Adobe XMP packet or bare xmpmeta block.
 * Works for DNG/TIFF/JPEG where XMP is embedded as text.
 */
export function extractXmpPacketFromBytes(bytes: Uint8Array): string | null {
  // Prefer scanning as latin1 so binary stays 1:1 with byte offsets
  const asText = decodeLatin1(bytes);

  const packetBegin = asText.indexOf('<?xpacket begin');
  if (packetBegin >= 0) {
    const endMarker = '<?xpacket end=';
    const endIdx = asText.indexOf(endMarker, packetBegin);
    if (endIdx > packetBegin) {
      const close = asText.indexOf('?>', endIdx);
      if (close > endIdx) {
        return asText.slice(packetBegin, close + 2);
      }
    }
    // Truncated packet — still try to pull xmpmeta inside
    const meta = sliceXmpMeta(asText, packetBegin);
    if (meta) return meta;
  }

  const meta = sliceXmpMeta(asText, 0);
  if (meta) return meta;

  // Some DNGs only embed crs: attributes without full packet wrappers in odd places
  if (/crs:(Exposure2012|Contrast2012|Highlights2012|Temperature)/i.test(asText)) {
    const loose = sliceLooseCrsBlock(asText);
    if (loose) return loose;
  }

  return null;
}

function sliceXmpMeta(text: string, from: number): string | null {
  const metaStart = text.search(/<x:xmpmeta\b/i);
  if (metaStart < 0) return null;
  if (from > 0 && metaStart < from) {
    const next = text.indexOf('<x:xmpmeta', from);
    if (next < 0) return null;
    return sliceXmpMetaAt(text, next);
  }
  return sliceXmpMetaAt(text, metaStart);
}

function sliceXmpMetaAt(text: string, metaStart: number): string | null {
  const endTag = '</x:xmpmeta>';
  const end = text.toLowerCase().indexOf(endTag, metaStart);
  if (end < 0) return null;
  return text.slice(metaStart, end + endTag.length);
}

function sliceLooseCrsBlock(text: string): string | null {
  // Wrap a rdf:Description that carries crs: settings
  const desc = /<rdf:Description\b[^>]*xmlns:crs=/i.exec(text);
  if (!desc || desc.index == null) return null;
  const start = desc.index;
  const selfClose = text.indexOf('/>', start);
  const openEnd = text.indexOf('>', start);
  if (selfClose > 0 && (openEnd < 0 || selfClose <= openEnd + 1)) {
    return text.slice(start, selfClose + 2);
  }
  const close = text.indexOf('</rdf:Description>', start);
  if (close > start) return text.slice(start, close + '</rdf:Description>'.length);
  return null;
}

function readU16(view: DataView, offset: number, le: boolean): number {
  return le ? view.getUint16(offset, true) : view.getUint16(offset, false);
}

function readU32(view: DataView, offset: number, le: boolean): number {
  return le ? view.getUint32(offset, true) : view.getUint32(offset, false);
}

/**
 * Walk classic TIFF/DNG IFDs looking for tag 700 (XMP).
 * Handles little-endian (II) and big-endian (MM) headers.
 */
export function extractXmpFromTiffIfd(bytes: Uint8Array): string | null {
  if (bytes.length < 8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const b0 = bytes[0];
  const b1 = bytes[1];
  const le = b0 === 0x49 && b1 === 0x49; // II
  const be = b0 === 0x4d && b1 === 0x4d; // MM
  if (!le && !be) return null;

  const magic = readU16(view, 2, le);
  if (magic !== 42 && magic !== 43) {
    // 42 = classic TIFF, 43 = BigTIFF — BigTIFF not handled here
    if (magic !== 42) return null;
  }

  let ifdOffset = readU32(view, 4, le);
  const visited = new Set<number>();

  while (ifdOffset && ifdOffset + 2 < bytes.length && !visited.has(ifdOffset)) {
    visited.add(ifdOffset);
    if (visited.size > 32) break;

    const entryCount = readU16(view, ifdOffset, le);
    let p = ifdOffset + 2;
    for (let i = 0; i < entryCount; i++) {
      if (p + 12 > bytes.length) break;
      const tag = readU16(view, p, le);
      const type = readU16(view, p + 2, le);
      const count = readU32(view, p + 4, le);
      const valueOrOffset = readU32(view, p + 8, le);
      p += 12;

      if (tag !== XMP_TAG) continue;

      // Type 1 = BYTE, 2 = ASCII, 7 = UNDEFINED — XMP is usually 1 or 7
      const typeSize = type === 1 || type === 2 || type === 6 || type === 7 ? 1 : type === 3 ? 2 : 4;
      const byteCount = count * typeSize;
      if (byteCount <= 0 || byteCount > bytes.length) continue;

      let dataOffset = valueOrOffset;
      if (byteCount <= 4) {
        // value inline in the offset field
        const inline = new Uint8Array(4);
        inline[0] = valueOrOffset & 0xff;
        inline[1] = (valueOrOffset >> 8) & 0xff;
        inline[2] = (valueOrOffset >> 16) & 0xff;
        inline[3] = (valueOrOffset >> 24) & 0xff;
        if (!le) inline.reverse();
        const text = decodeUtf8(inline.subarray(0, byteCount));
        if (/xmpmeta|crs:/i.test(text)) return text;
        continue;
      }

      if (dataOffset + byteCount > bytes.length) continue;
      const slice = bytes.subarray(dataOffset, dataOffset + byteCount);
      const text = decodeUtf8(slice);
      if (/xmpmeta|crs:|xpacket/i.test(text)) return text;
    }

    if (p + 4 > bytes.length) break;
    ifdOffset = readU32(view, p, le);
  }

  return null;
}

/** Extract embedded Camera Raw / XMP develop settings from a DNG (or TIFF/JPEG) buffer. */
export function extractXmpFromDng(bytes: Uint8Array): string | null {
  return extractXmpFromTiffIfd(bytes) ?? extractXmpPacketFromBytes(bytes);
}

export function isDngFileName(name: string): boolean {
  return /\.(dng|tif|tiff)$/i.test(name);
}

export function hasDngMagic(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false;
  const ii = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a;
  const mm = bytes[0] === 0x4d && bytes[1] === 0x4d && bytes[3] === 0x2a;
  // Also accept our scan-friendly blobs that start with II*
  const iiStar = bytes[0] === 0x49 && bytes[1] === 0x49 && bytes[2] === 0x2a;
  return ii || mm || iiStar;
}

export type ImportResult =
  | { ok: true; preset: Preset; source: 'xmp' | 'lrtemplate' | 'dng' }
  | { ok: false; error: string };

/**
 * Import a Lightroom preset from .xmp, .lrtemplate, or .dng (embedded XMP).
 */
export function importPresetFromBytes(
  bytes: Uint8Array,
  fileName: string,
): ImportResult {
  const lower = fileName.toLowerCase();

  // DNG / TIFF: pull embedded XMP first
  if (isDngFileName(fileName) || hasDngMagic(bytes)) {
    const xmp = extractXmpFromDng(bytes);
    if (!xmp || !/crs:/i.test(xmp)) {
      return {
        ok: false,
        error:
          'No Lightroom / Camera Raw develop settings found in this DNG. Edit in Lightroom, then export the DNG or save metadata into the file.',
      };
    }
    const preset = xmpToPreset(xmp);
    if (preset.name === 'Imported Preset') {
      preset.name = fileName.replace(/\.(dng|tif|tiff)$/i, '') || 'DNG Preset';
    }
    preset.group = preset.group ?? 'DNG';
    return { ok: true, preset, source: 'dng' };
  }

  const text = decodeUtf8(bytes);

  if (/\.lrtemplate$/i.test(lower) || (/s\s*=\s*\{/.test(text) && /Exposure2012/i.test(text))) {
    const lr = parseLrTemplate(text);
    if (!lr) {
      return { ok: false, error: 'Could not parse .lrtemplate preset.' };
    }
    return {
      ok: true,
      preset: {
        id: `imported-${Date.now()}`,
        name: lr.name,
        source: 'imported',
        adjustments: lr.adjustments,
        rawXmp: text,
      },
      source: 'lrtemplate',
    };
  }

  if (looksLikeLightroomPreset(text) || /\.xmp$/i.test(lower)) {
    const preset = xmpToPreset(text);
    if (/\.xmp$/i.test(lower) && preset.name === 'Imported Preset') {
      preset.name = fileName.replace(/\.xmp$/i, '');
    }
    return { ok: true, preset, source: 'xmp' };
  }

  // Last resort: maybe a binary file with XMP we can still scan
  const embedded = extractXmpFromDng(bytes);
  if (embedded && /crs:/i.test(embedded)) {
    const preset = xmpToPreset(embedded);
    if (preset.name === 'Imported Preset') {
      preset.name = fileName.replace(/\.[^.]+$/, '') || 'Imported Preset';
    }
    return { ok: true, preset, source: 'dng' };
  }

  return {
    ok: false,
    error:
      'Unsupported file. Import a Lightroom .xmp, .lrtemplate, or .dng with embedded develop settings.',
  };
}

/** Convenience: parse XMP already known to come from a DNG. */
export function dngXmpToPreset(xmp: string, fileName?: string): Preset {
  const parsed = parseLightroomXmp(xmp);
  const name =
    parsed.name !== 'Imported Preset'
      ? parsed.name
      : fileName?.replace(/\.(dng|tif|tiff)$/i, '') || 'DNG Preset';
  return {
    id: `imported-dng-${Date.now()}`,
    name,
    group: parsed.group ?? 'DNG',
    source: 'imported',
    adjustments: parsed.adjustments,
    rawXmp: xmp,
  };
}
