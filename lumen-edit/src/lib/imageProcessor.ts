import { Adjustments } from '../types/adjustments';

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function clamp255(x: number): number {
  return x < 0 ? 0 : x > 255 ? 255 : x | 0;
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export type ProcessOptions = {
  /** Skip unsharp (faster live preview) */
  preview?: boolean;
};

/**
 * Apply Lightroom-style adjustments to ImageData in place.
 * Curves are intentionally punchy so presets read clearly on phone screens.
 */
export function applyAdjustmentsToImageData(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  adj: Adjustments,
  options: ProcessOptions = {},
): typeof imageData {
  const { data, width, height } = imageData;
  const exposureMul = Math.pow(2, adj.exposure);
  const contrast = adj.contrast / 100;
  const highlights = adj.highlights / 100;
  const shadows = adj.shadows / 100;
  const whites = adj.whites / 100;
  const blacks = adj.blacks / 100;
  const temp = adj.temperature / 100;
  const tint = adj.tint / 100;
  const vibrance = adj.vibrance / 100;
  const saturation = adj.saturation / 100;
  const clarity = adj.clarity / 100;
  const dehaze = adj.dehaze / 100;
  const texture = adj.texture / 100;
  const grainAmt = adj.grain / 100;

  // Stronger WB than before — Lightroom temp/tint shifts are very visible
  const tempR = 1 + temp * 0.42;
  const tempG = 1 + temp * 0.06;
  const tempB = 1 - temp * 0.48;
  const tintG = 1 - tint * 0.28;
  const tintR = 1 + tint * 0.16;
  const tintB = 1 + tint * 0.14;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]! / 255;
    let g = data[i + 1]! / 255;
    let b = data[i + 2]! / 255;

    // Exposure (stops)
    r *= exposureMul;
    g *= exposureMul;
    b *= exposureMul;

    // Dehaze
    if (dehaze !== 0) {
      const y = luma(r, g, b);
      const amount = dehaze * 0.7;
      r = clamp01(r + (r - y) * amount * 0.9 + amount * 0.08);
      g = clamp01(g + (g - y) * amount * 0.9 + amount * 0.08);
      b = clamp01(b + (b - y) * amount * 0.9 + amount * 0.08);
      const y2 = luma(r, g, b);
      const contrastBoost = 1 + Math.abs(dehaze) * 0.45;
      r = clamp01(y2 + (r - y2) * contrastBoost);
      g = clamp01(y2 + (g - y2) * contrastBoost);
      b = clamp01(y2 + (b - y2) * contrastBoost);
    }

    // Contrast around mid-gray — more aggressive response
    if (contrast !== 0) {
      const c = contrast * 0.85;
      const factor = Math.tan(((c + 1) * Math.PI) / 4);
      r = clamp01((r - 0.5) * factor + 0.5);
      g = clamp01((g - 0.5) * factor + 0.5);
      b = clamp01((b - 0.5) * factor + 0.5);
    }

    let y = luma(r, g, b);

    // Highlights / Shadows
    if (highlights !== 0 || shadows !== 0) {
      const hiMask = smoothstep(0.3, 0.92, y);
      const shMask = 1 - smoothstep(0.04, 0.6, y);
      const hiGain = 1 - highlights * hiMask * 0.75;
      const shLift = shadows * shMask * 0.65;
      r = clamp01(r * hiGain + shLift);
      g = clamp01(g * hiGain + shLift);
      b = clamp01(b * hiGain + shLift);
      y = luma(r, g, b);
    }

    // Whites / Blacks
    if (whites !== 0 || blacks !== 0) {
      const wMask = smoothstep(0.5, 1.0, y);
      const kMask = 1 - smoothstep(0.0, 0.42, y);
      r = clamp01(r + whites * wMask * 0.5 - blacks * kMask * 0.5);
      g = clamp01(g + whites * wMask * 0.5 - blacks * kMask * 0.5);
      b = clamp01(b + whites * wMask * 0.5 - blacks * kMask * 0.5);
      y = luma(r, g, b);
    }

    // Clarity / Texture midtone punch
    if (clarity !== 0 || texture !== 0) {
      const mid = smoothstep(0.12, 0.48, y) * (1 - smoothstep(0.52, 0.88, y));
      const boost = 1 + clarity * mid * 0.85 + texture * mid * 0.55;
      r = clamp01(y + (r - y) * boost + (r - y) * texture * 0.25);
      g = clamp01(y + (g - y) * boost + (g - y) * texture * 0.25);
      b = clamp01(y + (b - y) * boost + (b - y) * texture * 0.25);
      y = luma(r, g, b);
    }

    // White balance
    r = clamp01(r * tempR * tintR);
    g = clamp01(g * tempG * tintG);
    b = clamp01(b * tempB * tintB);
    y = luma(r, g, b);

    // Vibrance + Saturation
    if (vibrance !== 0 || saturation !== 0) {
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
      const vibFactor = 1 + vibrance * (1 - sat) * 1.15;
      const satFactor = 1 + saturation * 1.05;
      const factor = vibFactor * satFactor;
      r = clamp01(y + (r - y) * factor);
      g = clamp01(y + (g - y) * factor);
      b = clamp01(y + (b - y) * factor);
    }

    // Film grain
    if (grainAmt > 0) {
      const n =
        (((Math.sin((i * 12.9898 + width * 78.233) * 43758.5453) % 1) + 1) %
          1) *
          2 -
        1;
      const noise = n * grainAmt * 0.18;
      r = clamp01(r + noise);
      g = clamp01(g + noise);
      b = clamp01(b + noise);
    }

    data[i] = clamp255(r * 255);
    data[i + 1] = clamp255(g * 255);
    data[i + 2] = clamp255(b * 255);
  }

  if (
    !options.preview &&
    (Math.abs(clarity) > 0.05 || Math.abs(texture) > 0.05) &&
    width * height <= 2_500_000
  ) {
    unsharpLuma(data, width, height, clarity * 0.45 + texture * 0.28);
  }

  return imageData;
}

function unsharpLuma(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): void {
  if (Math.abs(amount) < 0.01) return;
  const copy = new Uint8ClampedArray(data);
  const radius = 1;

  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      let sum = 0;
      let count = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          sum += luma(copy[idx]!, copy[idx + 1]!, copy[idx + 2]!);
          count++;
        }
      }
      const i = (y * width + x) * 4;
      const blurY = sum / count;
      const origY = luma(copy[i]!, copy[i + 1]!, copy[i + 2]!);
      const detail = (origY - blurY) * amount;
      data[i] = clamp255(copy[i]! + detail);
      data[i + 1] = clamp255(copy[i + 1]! + detail);
      data[i + 2] = clamp255(copy[i + 2]! + detail);
    }
  }
}

/** Instant web CSS preview while pixel bake catches up */
export function adjustmentsToCssFilter(adj: Adjustments): string {
  const brightness =
    1 +
    adj.exposure * 0.32 +
    adj.whites / 220 -
    adj.blacks / 280 +
    adj.shadows / 320 -
    adj.highlights / 380;
  const contrast =
    1 +
    adj.contrast / 110 +
    adj.clarity / 200 +
    adj.dehaze / 180 +
    adj.texture / 280;
  const saturate =
    1 + adj.saturation / 70 + adj.vibrance / 85 + adj.dehaze / 200;
  const hue = adj.temperature * 0.28 + adj.tint * 0.18;
  const sepia = Math.max(0, adj.temperature) / 220;
  const hueCool = Math.max(0, -adj.temperature) / 180;

  return [
    `brightness(${clampFilter(brightness, 0.25, 2.4).toFixed(3)})`,
    `contrast(${clampFilter(contrast, 0.35, 2.3).toFixed(3)})`,
    `saturate(${clampFilter(saturate, 0, 3.0).toFixed(3)})`,
    `hue-rotate(${hue.toFixed(2)}deg)`,
    sepia > 0.01 ? `sepia(${Math.min(0.55, sepia).toFixed(3)})` : null,
    hueCool > 0.02
      ? `hue-rotate(${(-hueCool * 40).toFixed(1)}deg)`
      : null,
  ]
    .filter(Boolean)
    .join(' ');
}

function clampFilter(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** Downscale RGBA buffer (nearest-neighbor) for fast previews */
export function resizeRgba(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  maxEdge: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(sw, sh));
  if (scale >= 0.999) {
    return { data: src, width: sw, height: sh };
  }
  const dw = Math.max(1, Math.round(sw * scale));
  const dh = Math.max(1, Math.round(sh * scale));
  const out = new Uint8ClampedArray(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y / dh) * sh));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x / dw) * sw));
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      out[di] = src[si]!;
      out[di + 1] = src[si + 1]!;
      out[di + 2] = src[si + 2]!;
      out[di + 3] = src[si + 3]!;
    }
  }
  return { data: out, width: dw, height: dh };
}
