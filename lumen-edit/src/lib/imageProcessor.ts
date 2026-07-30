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

/**
 * Apply Lightroom-style adjustments to ImageData in place.
 * Values are processed in 0–1 linear-ish space for predictable results.
 */
export function applyAdjustmentsToImageData(
  imageData: ImageData,
  adj: Adjustments,
): ImageData {
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

  // Temperature: warm = more R / less B; Tint: magenta = more R+B / less G
  const tempR = 1 + temp * 0.18;
  const tempB = 1 - temp * 0.22;
  const tintG = 1 - tint * 0.16;
  const tintRB = 1 + tint * 0.08;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;

    // Exposure
    r *= exposureMul;
    g *= exposureMul;
    b *= exposureMul;

    // Dehaze: lift local contrast + slight saturation of midtones
    if (dehaze !== 0) {
      const y = luma(r, g, b);
      const amount = dehaze * 0.45;
      r = clamp01(r + (r - y) * amount + amount * 0.05);
      g = clamp01(g + (g - y) * amount + amount * 0.05);
      b = clamp01(b + (b - y) * amount + amount * 0.05);
      const y2 = luma(r, g, b);
      const contrastBoost = 1 + Math.abs(dehaze) * 0.25;
      r = clamp01(y2 + (r - y2) * contrastBoost);
      g = clamp01(y2 + (g - y2) * contrastBoost);
      b = clamp01(y2 + (b - y2) * contrastBoost);
    }

    // Contrast around mid-gray
    if (contrast !== 0) {
      const factor = Math.tan(((contrast + 1) * Math.PI) / 4);
      r = clamp01((r - 0.5) * factor + 0.5);
      g = clamp01((g - 0.5) * factor + 0.5);
      b = clamp01((b - 0.5) * factor + 0.5);
    }

    let y = luma(r, g, b);

    // Highlights / Shadows (luminance masks)
    if (highlights !== 0 || shadows !== 0) {
      const hiMask = smoothstep(0.35, 0.95, y);
      const shMask = 1 - smoothstep(0.05, 0.65, y);
      const hiGain = 1 - highlights * hiMask * 0.55;
      const shLift = shadows * shMask * 0.45;
      r = clamp01(r * hiGain + shLift);
      g = clamp01(g * hiGain + shLift);
      b = clamp01(b * hiGain + shLift);
      y = luma(r, g, b);
    }

    // Whites / Blacks
    if (whites !== 0 || blacks !== 0) {
      const wMask = smoothstep(0.55, 1.0, y);
      const kMask = 1 - smoothstep(0.0, 0.45, y);
      r = clamp01(r + whites * wMask * 0.35 - blacks * kMask * 0.35);
      g = clamp01(g + whites * wMask * 0.35 - blacks * kMask * 0.35);
      b = clamp01(b + whites * wMask * 0.35 - blacks * kMask * 0.35);
      y = luma(r, g, b);
    }

    // Clarity / Texture: midtone local contrast (approximated per-pixel)
    if (clarity !== 0 || texture !== 0) {
      const mid = smoothstep(0.15, 0.5, y) * (1 - smoothstep(0.5, 0.85, y));
      const boost = 1 + clarity * mid * 0.55 + texture * mid * 0.35;
      r = clamp01(y + (r - y) * boost + (r - y) * texture * 0.15);
      g = clamp01(y + (g - y) * boost + (g - y) * texture * 0.15);
      b = clamp01(y + (b - y) * boost + (b - y) * texture * 0.15);
      y = luma(r, g, b);
    }

    // White balance
    r = clamp01(r * tempR * tintRB);
    g = clamp01(g * tintG);
    b = clamp01(b * tempB * tintRB);
    y = luma(r, g, b);

    // Vibrance (protect already-saturated pixels) + Saturation
    if (vibrance !== 0 || saturation !== 0) {
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const sat = maxc === 0 ? 0 : (maxc - minc) / maxc;
      const vibFactor = 1 + vibrance * (1 - sat);
      const satFactor = 1 + saturation;
      const factor = vibFactor * satFactor;
      r = clamp01(y + (r - y) * factor);
      g = clamp01(y + (g - y) * factor);
      b = clamp01(y + (b - y) * factor);
    }

    // Film grain
    if (grainAmt > 0) {
      const n =
        (Math.sin((i * 12.9898 + width * 78.233) * 43758.5453) % 1) * 2 - 1;
      const noise = n * grainAmt * 0.12;
      r = clamp01(r + noise);
      g = clamp01(g + noise);
      b = clamp01(b + noise);
    }

    data[i] = clamp255(r * 255);
    data[i + 1] = clamp255(g * 255);
    data[i + 2] = clamp255(b * 255);
  }

  // Soft clarity pass — skip on very large buffers to avoid OOM
  if (
    (Math.abs(clarity) > 0.05 || Math.abs(texture) > 0.05) &&
    width * height <= 2_500_000
  ) {
    unsharpLuma(data, width, height, clarity * 0.35 + texture * 0.2);
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
          sum += luma(copy[idx], copy[idx + 1], copy[idx + 2]);
          count++;
        }
      }
      const i = (y * width + x) * 4;
      const blurY = sum / count;
      const origY = luma(copy[i], copy[i + 1], copy[i + 2]);
      const detail = (origY - blurY) * amount;
      data[i] = clamp255(copy[i] + detail);
      data[i + 1] = clamp255(copy[i + 1] + detail);
      data[i + 2] = clamp255(copy[i + 2] + detail);
    }
  }
}

/**
 * Fast CSS filter string for live preview approximations (web).
 * Not 1:1 with the pixel processor but responsive while dragging sliders.
 * Full fidelity is applied in exportEditedImage via applyAdjustmentsToImageData.
 */
export function adjustmentsToCssFilter(adj: Adjustments): string {
  const brightness =
    1 +
    adj.exposure * 0.2 +
    adj.whites / 350 -
    adj.blacks / 450 +
    adj.shadows / 500 -
    adj.highlights / 600;
  const contrast =
    1 +
    adj.contrast / 180 +
    adj.clarity / 320 +
    adj.dehaze / 280 +
    adj.texture / 500;
  const saturate =
    1 +
    adj.saturation / 100 +
    adj.vibrance / 130 +
    adj.dehaze / 280;
  const hue = adj.temperature * 0.15 + adj.tint * 0.1;
  const sepia = Math.max(0, adj.temperature) / 350;
  const blur = adj.clarity < -20 ? Math.min(1.2, Math.abs(adj.clarity) / 120) : 0;

  return [
    `brightness(${clampFilter(brightness, 0.35, 2.2).toFixed(3)})`,
    `contrast(${clampFilter(contrast, 0.4, 2.0).toFixed(3)})`,
    `saturate(${clampFilter(saturate, 0, 2.5).toFixed(3)})`,
    `hue-rotate(${hue.toFixed(2)}deg)`,
    sepia > 0.01 ? `sepia(${Math.min(0.45, sepia).toFixed(3)})` : null,
    blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

function clampFilter(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
