/** Lightroom / Camera Raw–compatible adjustment model */

export type Adjustments = {
  exposure: number; // -5..5 stops (crs:Exposure2012)
  contrast: number; // -100..100 (crs:Contrast2012)
  highlights: number; // -100..100
  shadows: number; // -100..100
  whites: number; // -100..100
  blacks: number; // -100..100
  temperature: number; // -100..100 relative (maps from crs:Temperature)
  tint: number; // -100..100
  vibrance: number; // -100..100
  saturation: number; // -100..100
  clarity: number; // -100..100
  dehaze: number; // -100..100
  texture: number; // -100..100
  grain: number; // 0..100
};

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  exposure: 0,
  contrast: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  temperature: 0,
  tint: 0,
  vibrance: 0,
  saturation: 0,
  clarity: 0,
  dehaze: 0,
  texture: 0,
  grain: 0,
};

export type AdjustmentKey = keyof Adjustments;

export type AdjustmentMeta = {
  key: AdjustmentKey;
  label: string;
  min: number;
  max: number;
  step: number;
  group: 'light' | 'color' | 'effects';
};

export const ADJUSTMENT_META: AdjustmentMeta[] = [
  { key: 'exposure', label: 'Exposure', min: -5, max: 5, step: 0.05, group: 'light' },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100, step: 1, group: 'light' },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100, step: 1, group: 'light' },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100, step: 1, group: 'light' },
  { key: 'whites', label: 'Whites', min: -100, max: 100, step: 1, group: 'light' },
  { key: 'blacks', label: 'Blacks', min: -100, max: 100, step: 1, group: 'light' },
  { key: 'temperature', label: 'Temp', min: -100, max: 100, step: 1, group: 'color' },
  { key: 'tint', label: 'Tint', min: -100, max: 100, step: 1, group: 'color' },
  { key: 'vibrance', label: 'Vibrance', min: -100, max: 100, step: 1, group: 'color' },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100, step: 1, group: 'color' },
  { key: 'clarity', label: 'Clarity', min: -100, max: 100, step: 1, group: 'effects' },
  { key: 'dehaze', label: 'Dehaze', min: -100, max: 100, step: 1, group: 'effects' },
  { key: 'texture', label: 'Texture', min: -100, max: 100, step: 1, group: 'effects' },
  { key: 'grain', label: 'Grain', min: 0, max: 100, step: 1, group: 'effects' },
];

export type Preset = {
  id: string;
  name: string;
  group?: string;
  source: 'builtin' | 'imported';
  adjustments: Adjustments;
  rawXmp?: string;
};

export function isNeutral(a: Adjustments): boolean {
  return (Object.keys(DEFAULT_ADJUSTMENTS) as AdjustmentKey[]).every(
    (k) => a[k] === DEFAULT_ADJUSTMENTS[k],
  );
}

export function mergeAdjustments(
  base: Adjustments,
  patch: Partial<Adjustments>,
): Adjustments {
  return { ...base, ...patch };
}
