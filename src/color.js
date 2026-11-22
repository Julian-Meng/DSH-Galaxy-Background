import { clamp } from './math.js';

export function toRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

// sRGB -> linear lookup: the sampler touches this three times per star.
const SRGB_LUT_SIZE = 2048;
let srgbLut = null;

export function srgbToLinear(c) {
  if (!srgbLut) {
    srgbLut = new Float32Array(SRGB_LUT_SIZE + 1);
    for (let i = 0; i <= SRGB_LUT_SIZE; i++) {
      const v = i / SRGB_LUT_SIZE;
      srgbLut[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }
  }
  const clamped = c <= 0 ? 0 : c >= 1 ? 1 : c;
  return srgbLut[(clamped * SRGB_LUT_SIZE) | 0];
}

export function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue;
  if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return [hue / 6, s, l];
}

export function hslToRgb(hue, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(hue + 1 / 3), channel(hue), channel(hue - 1 / 3)];
}

export function mixRgb(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function pickPalette(colors) {
  return colors[Math.floor(Math.random() * colors.length)];
}

export const COLOR_HOT = ['#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff'].map(toRgb);
export const COLOR_WARM = ['#ffdec0', '#ffcfa0', '#ffb075', '#ff9560'].map(toRgb);
export const COLOR_CORE = toRgb('#fffdfa');
export const COLOR_CORE_WARM = toRgb('#ffd7b0');

export function adjustHslForRegion(region, armDensity, hsl, regionTable) {
  if (region === regionTable.HALO || region === regionTable.OUTER) {
    hsl[1] *= 0.4;
    hsl[2] *= 0.7;
  } else if (region === regionTable.THICK_DISK) {
    hsl[1] *= 0.8;
    hsl[2] *= 0.85;
  } else if (region === regionTable.BULGE) {
    hsl[1] *= 0.9;
    hsl[2] += 0.08;
  } else if (region === regionTable.ARM) {
    hsl[2] += 0.05 * armDensity;
  }
  return clamp(hsl[2], 0, 1);
}
