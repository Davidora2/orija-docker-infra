import {
  Adjustments,
  DEFAULT_ADJUSTMENTS,
  Preset,
} from '../types/adjustments';

/** Clamp helper */
function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseNum(value: string | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[+]/g, '').trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Extract crs:/crsx: attribute or element values from Lightroom / Camera Raw XMP.
 * Supports both attribute form and <crs:Exposure2012>+0.50</crs:Exposure2012>.
 */
function extractCrsValue(xmp: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const attr = new RegExp(
      `(?:crs|crsx):${key}\\s*=\\s*["']([^"']+)["']`,
      'i',
    ).exec(xmp);
    if (attr?.[1] != null) return attr[1];

    const el = new RegExp(
      `<(?:crs|crsx):${key}[^>]*>([^<]+)</(?:crs|crsx):${key}>`,
      'i',
    ).exec(xmp);
    if (el?.[1] != null) return el[1].trim();
  }
  return undefined;
}

function extractPresetName(xmp: string): string {
  const patterns = [
    /crs:Name\s*=\s*["']([^"']+)["']/i,
    /<crs:Name[^>]*>([^<]+)<\/crs:Name>/i,
    /xmp:Label\s*=\s*["']([^"']+)["']/i,
    /<xmp:Label[^>]*>([^<]+)<\/xmp:Label>/i,
  ];
  for (const re of patterns) {
    const m = re.exec(xmp);
    if (m?.[1]) return m[1].trim();
  }
  return 'Imported Preset';
}

function extractGroup(xmp: string): string | undefined {
  const m =
    /crs:Group\s*=\s*["']([^"']+)["']/i.exec(xmp) ||
    /<crs:Group[^>]*>([^<]+)<\/crs:Group>/i.exec(xmp);
  return m?.[1]?.trim();
}

/**
 * Map absolute Lightroom temperature (Kelvin) to our relative -100..100 scale.
 * Neutral daylight ≈ 5500K.
 */
function kelvinToRelative(kelvin: number): number {
  const delta = kelvin - 5500;
  return clamp(Math.round(delta / 40), -100, 100);
}

/**
 * Parse Adobe Lightroom / Camera Raw XMP (or .lrtemplate-ish XML) into adjustments.
 */
export function parseLightroomXmp(xmp: string): {
  name: string;
  group?: string;
  adjustments: Adjustments;
} {
  const a: Adjustments = { ...DEFAULT_ADJUSTMENTS };

  const exposure = parseNum(
    extractCrsValue(xmp, ['Exposure2012', 'Exposure']),
  );
  if (exposure != null) a.exposure = clamp(exposure, -5, 5);

  const contrast = parseNum(
    extractCrsValue(xmp, ['Contrast2012', 'Contrast']),
  );
  if (contrast != null) a.contrast = clamp(contrast, -100, 100);

  const highlights = parseNum(
    extractCrsValue(xmp, ['Highlights2012', 'Highlights']),
  );
  if (highlights != null) a.highlights = clamp(highlights, -100, 100);

  const shadows = parseNum(extractCrsValue(xmp, ['Shadows2012', 'Shadows']));
  if (shadows != null) a.shadows = clamp(shadows, -100, 100);

  const whites = parseNum(extractCrsValue(xmp, ['Whites2012', 'Whites']));
  if (whites != null) a.whites = clamp(whites, -100, 100);

  const blacks = parseNum(extractCrsValue(xmp, ['Blacks2012', 'Blacks']));
  if (blacks != null) a.blacks = clamp(blacks, -100, 100);

  const tempRaw = parseNum(
    extractCrsValue(xmp, ['Temperature', 'Temp', 'WhiteBalanceTemp']),
  );
  if (tempRaw != null) {
    // Absolute Kelvin values are typically 2000–50000; relative presets use smaller ranges
    a.temperature =
      tempRaw > 500 || tempRaw < -200
        ? kelvinToRelative(tempRaw)
        : clamp(tempRaw, -100, 100);
  }

  const tint = parseNum(extractCrsValue(xmp, ['Tint', 'Tint2012']));
  if (tint != null) {
    // Lightroom tint is roughly -150..150
    a.tint = clamp(Math.round(tint * (100 / 150)), -100, 100);
  }

  const vibrance = parseNum(extractCrsValue(xmp, ['Vibrance']));
  if (vibrance != null) a.vibrance = clamp(vibrance, -100, 100);

  const saturation = parseNum(extractCrsValue(xmp, ['Saturation']));
  if (saturation != null) a.saturation = clamp(saturation, -100, 100);

  const clarity = parseNum(extractCrsValue(xmp, ['Clarity2012', 'Clarity']));
  if (clarity != null) a.clarity = clamp(clarity, -100, 100);

  const dehaze = parseNum(
    extractCrsValue(xmp, ['Dehaze', 'Dehaze2012', 'LocalDehaze']),
  );
  if (dehaze != null) a.dehaze = clamp(dehaze, -100, 100);

  const texture = parseNum(extractCrsValue(xmp, ['Texture', 'Texture2012']));
  if (texture != null) a.texture = clamp(texture, -100, 100);

  const grain = parseNum(
    extractCrsValue(xmp, ['GrainAmount', 'Grain', 'PostCropVignetteAmount']),
  );
  // Prefer GrainAmount; ignore vignette mistaken match by checking key presence
  const grainAmount = parseNum(extractCrsValue(xmp, ['GrainAmount']));
  if (grainAmount != null) a.grain = clamp(grainAmount, 0, 100);
  else if (grain != null && extractCrsValue(xmp, ['Grain'])) {
    a.grain = clamp(grain, 0, 100);
  }

  return {
    name: extractPresetName(xmp),
    group: extractGroup(xmp),
    adjustments: a,
  };
}

export function xmpToPreset(xmp: string, id?: string): Preset {
  const parsed = parseLightroomXmp(xmp);
  return {
    id: id ?? `imported-${Date.now()}`,
    name: parsed.name,
    group: parsed.group,
    source: 'imported',
    adjustments: parsed.adjustments,
    rawXmp: xmp,
  };
}

/** Detect whether text looks like a Lightroom/Camera Raw preset */
export function looksLikeLightroomPreset(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/<x:xmpmeta/i.test(t) || /xmlns:crs=/i.test(t)) return true;
  if (/crs:(Exposure2012|Contrast2012|Highlights2012|Temperature)/i.test(t))
    return true;
  if (/s\s*=\s*\{/.test(t) && /Exposure2012/i.test(t)) return true; // .lrtemplate
  return false;
}

/**
 * Minimal .lrtemplate support: extract quoted key = value pairs from Lua-like tables.
 */
export function parseLrTemplate(text: string): {
  name: string;
  adjustments: Adjustments;
} | null {
  if (!/Exposure2012|Contrast2012|Highlights2012/i.test(text)) return null;

  const get = (key: string): number | null => {
    const m = new RegExp(`${key}\\s*=\\s*"?([+-]?\\d+(?:\\.\\d+)?)"?`, 'i').exec(
      text,
    );
    return m ? parseNum(m[1]) : null;
  };

  const nameMatch =
    /title\s*=\s*"([^"]+)"/i.exec(text) ||
    /Name\s*=\s*"([^"]+)"/i.exec(text);
  const a: Adjustments = { ...DEFAULT_ADJUSTMENTS };

  const map: [keyof Adjustments, string, number, number][] = [
    ['exposure', 'Exposure2012', -5, 5],
    ['contrast', 'Contrast2012', -100, 100],
    ['highlights', 'Highlights2012', -100, 100],
    ['shadows', 'Shadows2012', -100, 100],
    ['whites', 'Whites2012', -100, 100],
    ['blacks', 'Blacks2012', -100, 100],
    ['vibrance', 'Vibrance', -100, 100],
    ['saturation', 'Saturation', -100, 100],
    ['clarity', 'Clarity2012', -100, 100],
    ['dehaze', 'Dehaze', -100, 100],
    ['texture', 'Texture', -100, 100],
  ];

  for (const [adj, key, min, max] of map) {
    const v = get(key);
    if (v != null) (a as Record<string, number>)[adj] = clamp(v, min, max);
  }

  const temp = get('Temperature') ?? get('Temp');
  if (temp != null) {
    a.temperature =
      temp > 500 ? kelvinToRelative(temp) : clamp(temp, -100, 100);
  }
  const tint = get('Tint');
  if (tint != null) a.tint = clamp(Math.round(tint * (100 / 150)), -100, 100);

  const grain = get('GrainAmount');
  if (grain != null) a.grain = clamp(grain, 0, 100);

  return { name: nameMatch?.[1] ?? 'Imported Preset', adjustments: a };
}
