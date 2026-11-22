import { TAU, clamp, smoothstep, randomExp, randomNormal, sampleExponential } from './math.js';
import {
  COLOR_HOT,
  COLOR_WARM,
  COLOR_CORE,
  COLOR_CORE_WARM,
  mixRgb,
  pickPalette,
  rgbToHsl,
  hslToRgb,
  srgbToLinear,
  adjustHslForRegion,
} from './color.js';

export const REGION = { BULGE: 0, THIN_DISK: 1, THICK_DISK: 2, ARM: 3, HALO: 4, OUTER: 5 };

// Fixed shape constants from the reference scene; user knobs multiply these.
export const SHAPE = {
  bulgeRatio: 0.18,
  haloRatio: 0.06,
  outerRatio: 0.05,
  thickDiskRatio: 0.12,
  thinDiskRatio: 0.22,
  speedMax: 1.4,
  speedScale: 2.2,
  patternSpeed: 0.11,
  jitterAmp: 0.035,
};

function sampleLuminosity() {
  return clamp(Math.exp(-0.4 + 0.85 * randomNormal()), 0.12, 2.8);
}

/** Regional colour with the reference scene's warm/cool balance; returns linear RGB. */
function pickStarColor(region, armDensity) {
  let color;

  if (region === REGION.BULGE) {
    color = mixRgb(COLOR_CORE, COLOR_CORE_WARM, Math.random() * 0.35);
  } else if (region === REGION.ARM) {
    const hotProb = 0.45 + armDensity * 0.35;
    color = Math.random() < hotProb ? pickPalette(COLOR_HOT) : pickPalette(COLOR_WARM);
  } else if (region === REGION.HALO || region === REGION.OUTER) {
    color = Math.random() < 0.2 ? pickPalette(COLOR_HOT) : pickPalette(COLOR_WARM);
  } else {
    color = Math.random() < 0.15 ? pickPalette(COLOR_HOT) : pickPalette(COLOR_WARM);
  }

  const hsl = rgbToHsl(color[0], color[1], color[2]);
  const lightness = adjustHslForRegion(region, armDensity, hsl, REGION);
  const jittered = clamp(lightness + (Math.random() - 0.5) * 0.08, 0, 1);
  const rgb = hslToRgb(hsl[0], clamp(hsl[1], 0, 1), jittered);
  return [srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])];
}

export function buildGalaxy(config) {
  const count = Math.max(1000, Math.round(config.particleCount));
  const radius = config.radius;
  const bulgeRadius = radius * 0.2;
  const branches = Math.max(2, Math.round(config.branches));
  const spin = config.spin;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const regions = new Float32Array(count);
  const luminosities = new Float32Array(count);
  const phases = new Float32Array(count);

  const cutoff = {
    bulge: SHAPE.bulgeRatio,
    halo: SHAPE.bulgeRatio + SHAPE.haloRatio,
    outer: SHAPE.bulgeRatio + SHAPE.haloRatio + SHAPE.outerRatio,
    thick: SHAPE.bulgeRatio + SHAPE.haloRatio + SHAPE.outerRatio + SHAPE.thickDiskRatio,
    thin:
      SHAPE.bulgeRatio +
      SHAPE.haloRatio +
      SHAPE.outerRatio +
      SHAPE.thickDiskRatio +
      SHAPE.thinDiskRatio,
  };

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const randType = Math.random();

    let x = 0;
    let y = 0;
    let z = 0;
    let r = 0;
    let region = REGION.THIN_DISK;
    let armDensity = 0;
    let color;

    if (randType < cutoff.bulge) {
      region = REGION.BULGE;
      r = Math.pow(Math.random(), 3) * bulgeRadius * 1.8;
      const theta = Math.random() * TAU;
      const phi = Math.acos(2 * Math.random() - 1);
      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.sin(phi) * Math.sin(theta) * 0.5;
      z = r * Math.cos(phi);
      color = pickStarColor(region, 0);
    } else if (randType < cutoff.halo) {
      region = REGION.HALO;
      r = radius * 0.5 + randomExp(0.5) * radius;
      const theta = Math.random() * TAU;
      const phi = Math.acos(2 * Math.random() - 1);
      x = r * Math.sin(phi) * Math.cos(theta);
      y = r * Math.sin(phi) * Math.sin(theta) * 0.8;
      z = r * Math.cos(phi);
      color = pickStarColor(region, 0);
    } else if (randType < cutoff.outer) {
      region = REGION.OUTER;
      const rBase = radius * 0.95;
      const rMax = radius * 1.8;
      r = Math.min(rBase + randomExp(1.2) * radius * 0.6, rMax);
      const theta = Math.random() * TAU;
      x = r * Math.cos(theta);
      z = r * Math.sin(theta);
      y = randomNormal() * (0.25 + r * 0.06);
      color = pickStarColor(region, 0);
    } else if (randType < cutoff.thick) {
      region = REGION.THICK_DISK;
      r = sampleExponential(radius * 0.45, radius * 1.05);
      const theta = Math.random() * TAU;
      x = r * Math.cos(theta);
      z = r * Math.sin(theta);
      y = randomNormal() * (0.12 + r * 0.03);
      color = pickStarColor(region, 0);
    } else if (randType < cutoff.thin) {
      region = REGION.THIN_DISK;
      r = sampleExponential(radius * 0.38, radius * 1.02);
      const theta = Math.random() * TAU;
      x = r * Math.cos(theta);
      z = r * Math.sin(theta);
      y = randomNormal() * (0.035 + r * 0.012);
      color = pickStarColor(region, 0);
    } else {
      region = REGION.ARM;
      const rMin = bulgeRadius * 0.5;
      const rMax = radius * 1.05;
      r = rMin + Math.pow(Math.random(), 0.8) * (rMax - rMin);
      const branchAngle = ((i % branches) / branches) * TAU;
      const spiralAngle = -r * spin;
      const maxSpread = 0.5 + (r / radius) * 0.6;
      const randomOffset = randomNormal() * maxSpread * 0.4;
      const theta = branchAngle + spiralAngle + randomOffset;
      x = r * Math.cos(theta);
      z = r * Math.sin(theta);
      y = randomNormal() * (0.03 + r * 0.012);

      armDensity = 1 - Math.min(Math.abs(randomOffset) / maxSpread, 1);
      armDensity *= smoothstep(r, bulgeRadius * 0.8, bulgeRadius * 2);
      color = pickStarColor(region, armDensity);
    }

    const edgeFadeInner = 1 - smoothstep(r, radius * 0.85, radius * 1.08);
    const edgeFadeOuter = 1 - smoothstep(r, radius * 1.05, radius * 1.75);
    const edgeFade = region === REGION.HALO || region === REGION.OUTER ? edgeFadeOuter : edgeFadeInner;
    const coreBoost = 1 + 0.7 * (1 - smoothstep(r, 0.25, bulgeRadius * 1.4));

    const baseLum = sampleLuminosity();
    let lumScale = 1;
    if (region === REGION.BULGE) lumScale = 1.25;
    if (region === REGION.THICK_DISK) lumScale = 0.75;
    if (region === REGION.HALO) lumScale = 0.45;
    if (region === REGION.OUTER) lumScale = 0.35;
    if (region === REGION.ARM) lumScale = 0.7 + 0.45 * armDensity;

    if (region === REGION.BULGE || region === REGION.THIN_DISK || region === REGION.THICK_DISK) {
      lumScale *= coreBoost;
    }
    if (region !== REGION.BULGE) {
      lumScale *= clamp(edgeFade, 0, 1);
    }

    const lum = baseLum * lumScale;
    let scale = Math.sqrt(Math.max(lum, 0.001)) * (0.55 + Math.random() * 0.55);
    if (region !== REGION.BULGE) {
      scale *= 0.6 + 0.4 * clamp(edgeFade, 0, 1);
    }
    if (region === REGION.BULGE && r < 0.5) {
      scale *= 1.2;
    }

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    colors[i3] = color[0];
    colors[i3 + 1] = color[1];
    colors[i3 + 2] = color[2];
    scales[i] = scale;
    regions[i] = region;
    luminosities[i] = lum;
    phases[i] = Math.random() * TAU;
  }

  return { count, positions, colors, scales, regions, luminosities, phases };
}

export function buildBackgroundStars(galaxyCount) {
  const count = Math.round(clamp(Math.round(galaxyCount * 0.035), 2500, 7000));
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = 50 + Math.random() * 100;
    const theta = Math.random() * TAU;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    const colorType = Math.random();
    let color;
    if (colorType > 0.8) {
      color = hslToRgb(0.6 + Math.random() * 0.1, 0.4, Math.random() * 0.4 + 0.5);
    } else if (colorType > 0.6) {
      color = hslToRgb(Math.random() * 0.1, 0.5, Math.random() * 0.4 + 0.4);
    } else {
      color = hslToRgb(0.6, 0, Math.random() * 0.5 + 0.3);
    }

    colors[i3] = srgbToLinear(color[0]);
    colors[i3 + 1] = srgbToLinear(color[1]);
    colors[i3 + 2] = srgbToLinear(color[2]);

    sizes[i] = Math.random() * 2.5 + 0.5;
    phases[i] = Math.random() * TAU;
  }

  return { count, positions, colors, sizes, phases };
}
