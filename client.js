/*!
 * dsh-galaxy-background — M1 renderer.
 *
 * Ports the galaxy of `Julian-Meng.github.io/galaxy/galaxy.js` (three.js) to raw
 * WebGL so the plugin has no runtime dependencies:
 *   - five star regions (bulge / thin disk / thick disk / arms / halo+outer),
 *   - differential rotation plus a separate arm pattern speed in the vertex shader,
 *   - additive point sprites with ACES tone mapping and sRGB output,
 *   - a twinkling background starfield.
 *
 * Sources of truth:
 *   FIELDS          every tunable value (Settings page and engine read it)
 *   TODO/galaxy-background-workflow.md   milestone plan
 *
 * DOM contract (stable attributes, no hashed CSS-module classes):
 *   [data-conversation-content]  conversation scene
 *   [data-conversation-scroll]   scrolling transcript, lifted above the canvas
 *   [data-content-phase]         'hero' | 'active' (new-session page vs chat)
 */
window.__ModuleLoader__.load({
  id: 'dsh-galaxy-background',
  factory(require) {
    'use strict';

    const React = require('react');
    const h = React.createElement;

    const SETTINGS_ID = 'galaxy-background';
    const STORAGE_KEY = 'dsh-galaxy-background:v1';
    const LOCALE_NS = 'galaxy-background';

    // -----------------------------------------------------------------------
    // Configuration model
    // -----------------------------------------------------------------------

    const FIELDS = {
      enabled: { kind: 'bool', def: true },

      // Motion
      speed: { kind: 'range', def: 1, min: 0, max: 2, step: 0.05 },
      parallax: { kind: 'range', def: 0.35, min: 0, max: 1, step: 0.05 },

      // Galaxy structure (rebuild the point cloud on change)
      particleCount: { kind: 'range', def: 120000, min: 20000, max: 300000, step: 10000, rebuild: true },
      branches: { kind: 'range', def: 4, min: 2, max: 8, step: 1, rebuild: true },
      spin: { kind: 'range', def: 0.8, min: 0.1, max: 2, step: 0.05, rebuild: true },
      radius: { kind: 'range', def: 8, min: 4, max: 14, step: 0.5, rebuild: true },
      backgroundStars: { kind: 'bool', def: true, rebuild: true },

      // Appearance
      opacity: { kind: 'range', def: 1, min: 0, max: 1, step: 0.05 },
      starSize: { kind: 'range', def: 1, min: 0.3, max: 2.5, step: 0.1 },
      exposure: { kind: 'range', def: 1, min: 0.2, max: 3, step: 0.05 },

      // Glass (M3)
      chatBlur: { kind: 'range', def: 12, min: 0, max: 40, step: 1 },
      chatTint: { kind: 'range', def: 0.18, min: 0, max: 1, step: 0.02 },
      composerGlass: { kind: 'bool', def: true },
      composerBlur: { kind: 'range', def: 16, min: 0, max: 40, step: 1 },

      // Camera
      cameraTilt: { kind: 'range', def: 29, min: 5, max: 85, step: 1 },
      cameraDistance: { kind: 'range', def: 13.2, min: 6, max: 30, step: 0.5 },

      // Behavior
      showOnHome: { kind: 'bool', def: true },
      pauseWhenHidden: { kind: 'bool', def: true },
      respectReducedMotion: { kind: 'bool', def: true },
    };

    const MESSAGES = {
      en: {
        title: 'Galaxy background',
        subtitle: 'An animated spiral galaxy behind the conversation panel.',
        body: 'The wallpaper is live. Detailed controls arrive in the next milestone.',
      },
      zh: {
        title: '星系背景',
        subtitle: '对话面板背后的动态螺旋星系。',
        body: '壁纸已生效，详细设置项将在下个里程碑接入。',
      },
    };

    function normalize(raw) {
      const out = {};
      for (const key of Object.keys(FIELDS)) {
        const field = FIELDS[key];
        const value = raw && typeof raw === 'object' ? raw[key] : undefined;
        if (field.kind === 'bool') {
          out[key] = typeof value === 'boolean' ? value : field.def;
          continue;
        }
        if (typeof value === 'number' && Number.isFinite(value)) {
          out[key] = Math.min(field.max, Math.max(field.min, value));
        } else {
          out[key] = field.def;
        }
      }
      return out;
    }

    function createStore() {
      let state = read();
      const listeners = new Set();

      function read() {
        let raw = null;
        try {
          raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null');
        } catch (err) {
          raw = null;
        }
        return normalize(raw);
      }

      function persist() {
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (err) {
          /* private mode / quota: keep the in-memory value */
        }
      }

      function emit() {
        for (const fn of Array.from(listeners)) {
          try {
            fn(state);
          } catch (err) {
            /* a listener must never break the others */
          }
        }
      }

      return {
        get: () => state,
        set(patch) {
          state = normalize(Object.assign({}, state, patch));
          persist();
          emit();
        },
        reset() {
          state = normalize(null);
          persist();
          emit();
        },
        reload() {
          state = read();
          emit();
        },
        subscribe(fn) {
          listeners.add(fn);
          return () => listeners.delete(fn);
        },
      };
    }

    // -----------------------------------------------------------------------
    // Galaxy sampling (ported from galaxy.js)
    // -----------------------------------------------------------------------

    const TAU = Math.PI * 2;
    const REGION = { BULGE: 0, THIN_DISK: 1, THICK_DISK: 2, ARM: 3, HALO: 4, OUTER: 5 };

    // Fixed shape constants from the reference scene; user knobs multiply these.
    const SHAPE = {
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

    const COLOR_HOT = ['#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff'].map(toRgb);
    const COLOR_WARM = ['#ffdec0', '#ffcfa0', '#ffb075', '#ff9560'].map(toRgb);
    const COLOR_CORE = toRgb('#fffdfa');
    const COLOR_CORE_WARM = toRgb('#ffd7b0');

    function toRgb(hex) {
      const value = parseInt(hex.slice(1), 16);
      return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
    }

    // sRGB -> linear lookup: the hot loop touches this three times per star.
    const SRGB_LUT_SIZE = 2048;
    let srgbLut = null;

    function srgbToLinear(c) {
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

    function rgbToHsl(r, g, b) {
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

    function hslToRgb(hue, s, l) {
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

    function mixRgb(a, b, t) {
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    }

    function pickPalette(colors) {
      return colors[Math.floor(Math.random() * colors.length)];
    }

    function clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    }

    function smoothstep(x, min, max) {
      if (x <= min) return 0;
      if (x >= max) return 1;
      const t = (x - min) / (max - min);
      return t * t * (3 - 2 * t);
    }

    function randomExp(lambda) {
      return -Math.log(1 - Math.random()) / lambda;
    }

    function randomNormal() {
      let u = 0;
      let v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
    }

    function sampleExponential(scale, maxR) {
      return Math.min(-Math.log(1 - Math.random()) * scale, maxR);
    }

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

      if (region === REGION.HALO || region === REGION.OUTER) {
        hsl[1] *= 0.4;
        hsl[2] *= 0.7;
      } else if (region === REGION.THICK_DISK) {
        hsl[1] *= 0.8;
        hsl[2] *= 0.85;
      } else if (region === REGION.BULGE) {
        hsl[1] *= 0.9;
        hsl[2] += 0.08;
      } else if (region === REGION.ARM) {
        hsl[2] += 0.05 * armDensity;
      }

      hsl[2] += (Math.random() - 0.5) * 0.08;

      const rgb = hslToRgb(hsl[0], clamp(hsl[1], 0, 1), clamp(hsl[2], 0, 1));
      return [srgbToLinear(rgb[0]), srgbToLinear(rgb[1]), srgbToLinear(rgb[2])];
    }

    function buildGalaxy(config) {
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

    function buildBackgroundStars(galaxyCount) {
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

    // -----------------------------------------------------------------------
    // Shaders
    // -----------------------------------------------------------------------

    const GALAXY_VERTEX = `
      precision highp float;
      attribute vec3 aPosition;
      attribute vec3 aColor;
      attribute float aScale;
      attribute float aRegion;
      attribute float aLum;
      attribute float aJitterPhase;

      uniform mat4 uProjection;
      uniform mat4 uView;
      uniform float uTime;
      uniform float uSize;
      uniform float uVmax;
      uniform float uSpeedScale;
      uniform float uPatternSpeed;
      uniform float uJitterAmp;

      varying vec3 vColor;

      float omegaAt(float r) {
        float v = uVmax * (1.0 - exp(-r / uSpeedScale));
        return v / max(r, 0.35);
      }

      void main() {
        vec3 model = aPosition;
        float r = length(model.xz);
        float angle = atan(model.x, model.z);

        float armFactor = 1.0 - min(abs(aRegion - 3.0), 1.0);
        float haloFactor = 1.0 - min(min(abs(aRegion - 4.0), abs(aRegion - 5.0)), 1.0);

        float speed = mix(omegaAt(r), uPatternSpeed, armFactor);
        speed *= mix(1.0, 0.18, haloFactor);
        angle += -uTime * speed;

        model.x = cos(angle) * r;
        model.z = sin(angle) * r;

        float jitter = sin(uTime * 0.6 + aJitterPhase) * uJitterAmp;
        model.y += jitter * (1.0 - haloFactor) * (1.0 - armFactor * 0.4);

        vec4 viewPosition = uView * vec4(model, 1.0);
        gl_Position = uProjection * viewPosition;

        float bloom = smoothstep(1.2, 2.2, aLum);
        float size = uSize * aScale * (1.0 + bloom * 0.6) / max(-viewPosition.z, 0.001);
        gl_PointSize = max(size, 1.2);
        vColor = aColor * aLum;
      }
    `;

    const BACKGROUND_VERTEX = `
      precision highp float;
      attribute vec3 aPosition;
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aPhase;

      uniform mat4 uProjection;
      uniform mat4 uView;
      uniform float uTime;
      uniform float uPixelRatio;

      varying vec3 vColor;

      void main() {
        vec4 viewPosition = uView * vec4(aPosition, 1.0);
        gl_Position = uProjection * viewPosition;
        float twinkle = 0.85 + 0.15 * sin(uTime * 0.6 + aPhase);
        gl_PointSize = max(aSize * uPixelRatio * twinkle, 1.0);
        vColor = aColor;
      }
    `;

    const STAR_FRAGMENT = `
      precision highp float;
      varying vec3 vColor;
      uniform float uExposure;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float d = length(uv);
        if (d > 0.5) discard;
        float core = 1.0 - smoothstep(0.0, 0.25, d);
        float halo = 1.0 - smoothstep(0.25, 0.5, d);
        float strength = core + halo * 0.35;
        strength = pow(strength, 1.4);
        // Reference scene: linear colours, additive blending, no per-point tone
        // mapping. Tone mapping per fragment made dense regions saturate to white.
        gl_FragColor = vec4(vColor * strength * uExposure, strength);
      }
    `;

    // -----------------------------------------------------------------------
    // WebGL plumbing
    // -----------------------------------------------------------------------

    function compileShader(gl, type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`galaxy shader compile failed: ${info}`);
      }
      return shader;
    }

    function createProgram(gl, vertexSource, fragmentSource) {
      const program = gl.createProgram();
      const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
      const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const info = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`galaxy program link failed: ${info}`);
      }
      return program;
    }

    function perspectiveMatrix(fovDeg, aspect, near, far) {
      const f = 1 / Math.tan((fovDeg * Math.PI) / 360);
      const nf = 1 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0,
      ]);
    }

    function lookAtMatrix(eye, center, up) {
      let zx = eye[0] - center[0];
      let zy = eye[1] - center[1];
      let zz = eye[2] - center[2];
      let len = Math.hypot(zx, zy, zz) || 1;
      zx /= len;
      zy /= len;
      zz /= len;

      let xx = up[1] * zz - up[2] * zy;
      let xy = up[2] * zx - up[0] * zz;
      let xz = up[0] * zy - up[1] * zx;
      len = Math.hypot(xx, xy, xz) || 1;
      xx /= len;
      xy /= len;
      xz /= len;

      const yx = zy * xz - zz * xy;
      const yy = zz * xx - zx * xz;
      const yz = zx * xy - zy * xx;

      return new Float32Array([
        xx, yx, zx, 0,
        xy, yy, zy, 0,
        xz, yz, zz, 0,
        -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
        -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
        -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
        1,
      ]);
    }

    function createBuffer(gl, data) {
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      return buffer;
    }

    // Reference scene: 0.02 * baseSpeed(0.5) * timeScale(0.5) per frame at 60 fps.
    const TIME_PER_SECOND = 0.3;

    class GalaxyEngine {
      constructor(canvas, config) {
        this.canvas = canvas;
        this.config = config;
        this.time = Math.random() * 40;
        this.bgTime = 0;
        this.last = 0;
        this.raf = 0;
        this.visible = false;
        this.destroyed = false;
        this.pointer = [0, 0];
        this.offset = [0, 0];
        this.width = 0;
        this.height = 0;
        this.dpr = 1;
        this.reducedMotion = false;

        const options = {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          powerPreference: 'high-performance',
        };
        const gl = canvas.getContext('webgl2', options) || canvas.getContext('webgl', options);
        if (!gl) throw new Error('WebGL is not available');
        this.gl = gl;

        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        // three's AdditiveBlending: src * srcAlpha + dst * 1. Using ONE,ONE here
        // ignored the soft-edge alpha and washed the whole disk to white.
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.clearColor(0.008, 0.012, 0.025, 1);

        this.galaxyProgram = createProgram(gl, GALAXY_VERTEX, STAR_FRAGMENT);
        this.backgroundProgram = createProgram(gl, BACKGROUND_VERTEX, STAR_FRAGMENT);

        this.uniforms = {
          projection: gl.getUniformLocation(this.galaxyProgram, 'uProjection'),
          view: gl.getUniformLocation(this.galaxyProgram, 'uView'),
          time: gl.getUniformLocation(this.galaxyProgram, 'uTime'),
          size: gl.getUniformLocation(this.galaxyProgram, 'uSize'),
          vmax: gl.getUniformLocation(this.galaxyProgram, 'uVmax'),
          speedScale: gl.getUniformLocation(this.galaxyProgram, 'uSpeedScale'),
          patternSpeed: gl.getUniformLocation(this.galaxyProgram, 'uPatternSpeed'),
          jitter: gl.getUniformLocation(this.galaxyProgram, 'uJitterAmp'),
          exposure: gl.getUniformLocation(this.galaxyProgram, 'uExposure'),
        };
        this.bgUniforms = {
          projection: gl.getUniformLocation(this.backgroundProgram, 'uProjection'),
          view: gl.getUniformLocation(this.backgroundProgram, 'uView'),
          time: gl.getUniformLocation(this.backgroundProgram, 'uTime'),
          pixelRatio: gl.getUniformLocation(this.backgroundProgram, 'uPixelRatio'),
          exposure: gl.getUniformLocation(this.backgroundProgram, 'uExposure'),
        };

        this.galaxy = null;
        this.background = null;

        this.mediaQuery =
          typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
        if (this.mediaQuery) {
          this.reducedMotion = this.mediaQuery.matches;
          this.onMotionPreference = (event) => {
            this.reducedMotion = event.matches;
          };
          if (typeof this.mediaQuery.addEventListener === 'function') {
            this.mediaQuery.addEventListener('change', this.onMotionPreference);
          }
        }

        this.build();
        this.resize();
        this.bindPointer();
        this.tick = this.tick.bind(this);
        this.raf = window.requestAnimationFrame(this.tick);
      }

      build() {
        const gl = this.gl;
        this.disposeGeometry();

        const data = buildGalaxy(this.config);
        this.galaxy = {
          count: data.count,
          position: createBuffer(gl, data.positions),
          color: createBuffer(gl, data.colors),
          scale: createBuffer(gl, data.scales),
          region: createBuffer(gl, data.regions),
          lum: createBuffer(gl, data.luminosities),
          phase: createBuffer(gl, data.phases),
        };

        if (this.config.backgroundStars) {
          const stars = buildBackgroundStars(data.count);
          this.background = {
            count: stars.count,
            position: createBuffer(gl, stars.positions),
            color: createBuffer(gl, stars.colors),
            size: createBuffer(gl, stars.sizes),
            phase: createBuffer(gl, stars.phases),
          };
        }
      }

      disposeGeometry() {
        const gl = this.gl;
        const dispose = (target) => {
          if (!target) return;
          for (const key of ['position', 'color', 'scale', 'region', 'lum', 'phase', 'size']) {
            if (target[key]) gl.deleteBuffer(target[key]);
          }
        };
        dispose(this.galaxy);
        dispose(this.background);
        this.galaxy = null;
        this.background = null;
      }

      setConfig(next) {
        const previous = this.config;
        this.config = next;
        const structural =
          previous.particleCount !== next.particleCount ||
          previous.branches !== next.branches ||
          previous.spin !== next.spin ||
          previous.radius !== next.radius ||
          previous.backgroundStars !== next.backgroundStars;
        if (structural) this.build();
      }

      setActive(active) {
        this.visible = active;
        if (active && !this.raf && !this.destroyed) {
          this.last = 0;
          this.raf = window.requestAnimationFrame(this.tick);
        }
      }

      resize() {
        const gl = this.gl;
        const rect = this.canvas.getBoundingClientRect();
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        if (width === this.width && height === this.height && dpr === this.dpr) return;
        this.width = width;
        this.height = height;
        this.dpr = dpr;
        this.canvas.width = Math.round(width * dpr);
        this.canvas.height = Math.round(height * dpr);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.draw();
      }

      bindPointer() {
        this.onPointerMove = (event) => {
          this.pointer[0] = (event.clientX / window.innerWidth) * 2 - 1;
          this.pointer[1] = (event.clientY / window.innerHeight) * 2 - 1;
        };
        window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      }

      tick(now) {
        this.raf = 0;
        if (this.destroyed || !this.visible) return;

        if (this.config.pauseWhenHidden && document.hidden) {
          this.raf = window.requestAnimationFrame(this.tick);
          return;
        }

        const seconds = this.last ? Math.min((now - this.last) / 1000, 0.1) : 0;
        this.last = now;

        const frozen = this.config.respectReducedMotion && this.reducedMotion;
        const speed = frozen ? 0 : this.config.speed;
        this.time += seconds * TIME_PER_SECOND * speed;
        this.bgTime += seconds * TIME_PER_SECOND * speed * 0.2;

        const targetX = (frozen ? 0 : this.pointer[0]) * this.config.parallax;
        const targetY = (frozen ? 0 : this.pointer[1]) * this.config.parallax;
        this.offset[0] += (targetX - this.offset[0]) * 0.06;
        this.offset[1] += (targetY - this.offset[1]) * 0.06;

        this.draw();
        this.raf = window.requestAnimationFrame(this.tick);
      }

      draw() {
        const gl = this.gl;
        const width = this.canvas.width;
        const height = this.canvas.height;
        if (!width || !height) return;

        gl.clear(gl.COLOR_BUFFER_BIT);

        const aspect = width / height;
        const tilt = (clamp(this.config.cameraTilt + this.offset[1] * -8, 2, 88) * Math.PI) / 180;
        const azimuth = this.offset[0] * 0.35;
        // Narrow columns would crop the disk; pull the camera back a little there.
        const fit = aspect < 1.25 ? Math.pow(1.25 / Math.max(aspect, 0.4), 0.65) : 1;
        const distance = clamp(this.config.cameraDistance * fit, 4, 40);
        const eye = [
          Math.sin(azimuth) * Math.cos(tilt) * distance,
          Math.sin(tilt) * distance,
          Math.cos(azimuth) * Math.cos(tilt) * distance,
        ];
        const projection = perspectiveMatrix(60, aspect, 0.01, 500);
        const view = lookAtMatrix(eye, [0, 0, 0], [0, 1, 0]);

        // Reference scene: uSize = 20 * pixelRatio, no height normalisation.
        const pointSize = 20 * this.dpr * this.config.starSize;

        if (this.background) {
          gl.useProgram(this.backgroundProgram);
          this.bindAttribute(this.backgroundProgram, this.background.position, 'aPosition', 3);
          this.bindAttribute(this.backgroundProgram, this.background.color, 'aColor', 3);
          this.bindAttribute(this.backgroundProgram, this.background.size, 'aSize', 1);
          this.bindAttribute(this.backgroundProgram, this.background.phase, 'aPhase', 1);
          gl.uniformMatrix4fv(this.bgUniforms.projection, false, projection);
          gl.uniformMatrix4fv(this.bgUniforms.view, false, view);
          gl.uniform1f(this.bgUniforms.time, this.bgTime);
          gl.uniform1f(this.bgUniforms.pixelRatio, this.dpr);
          gl.uniform1f(this.bgUniforms.exposure, this.config.exposure * 0.55);
          gl.drawArrays(gl.POINTS, 0, this.background.count);
        }

        if (this.galaxy) {
          gl.useProgram(this.galaxyProgram);
          this.bindAttribute(this.galaxyProgram, this.galaxy.position, 'aPosition', 3);
          this.bindAttribute(this.galaxyProgram, this.galaxy.color, 'aColor', 3);
          this.bindAttribute(this.galaxyProgram, this.galaxy.scale, 'aScale', 1);
          this.bindAttribute(this.galaxyProgram, this.galaxy.region, 'aRegion', 1);
          this.bindAttribute(this.galaxyProgram, this.galaxy.lum, 'aLum', 1);
          this.bindAttribute(this.galaxyProgram, this.galaxy.phase, 'aJitterPhase', 1);
          gl.uniformMatrix4fv(this.uniforms.projection, false, projection);
          gl.uniformMatrix4fv(this.uniforms.view, false, view);
          gl.uniform1f(this.uniforms.time, this.time);
          gl.uniform1f(this.uniforms.size, pointSize);
          gl.uniform1f(this.uniforms.vmax, SHAPE.speedMax);
          gl.uniform1f(this.uniforms.speedScale, SHAPE.speedScale);
          gl.uniform1f(this.uniforms.patternSpeed, SHAPE.patternSpeed);
          gl.uniform1f(this.uniforms.jitter, SHAPE.jitterAmp);
          gl.uniform1f(this.uniforms.exposure, this.config.exposure);
          gl.drawArrays(gl.POINTS, 0, this.galaxy.count);
        }

        this.resetAttributes();
      }

      bindAttribute(program, buffer, name, size) {
        const gl = this.gl;
        const location = gl.getAttribLocation(program, name);
        if (location < 0) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
      }

      resetAttributes() {
        const gl = this.gl;
        const max = gl.getParameter(gl.MAX_VERTEX_ATTRIBS) || 8;
        for (let index = 0; index < max; index++) gl.disableVertexAttribArray(index);
      }

      destroy() {
        if (this.destroyed) return;
        this.destroyed = true;
        if (this.raf) window.cancelAnimationFrame(this.raf);
        this.raf = 0;
        window.removeEventListener('pointermove', this.onPointerMove);
        if (this.mediaQuery && this.onMotionPreference && typeof this.mediaQuery.removeEventListener === 'function') {
          this.mediaQuery.removeEventListener('change', this.onMotionPreference);
        }
        this.disposeGeometry();
        const gl = this.gl;
        if (this.galaxyProgram) gl.deleteProgram(this.galaxyProgram);
        if (this.backgroundProgram) gl.deleteProgram(this.backgroundProgram);
        const lose = gl.getExtension('WEBGL_lose_context');
        if (lose) lose.loseContext();
      }
    }

    // -----------------------------------------------------------------------
    // Scene mounting
    // -----------------------------------------------------------------------

    const STYLE_ID = 'dsh-galaxy-background-styles';
    const STYLE_TEXT = `
      .dsh-galaxy-scene { position: relative; }
      .dsh-galaxy-scene > [data-conversation-scroll],
      .dsh-galaxy-scene [data-conversation-scroll] { position: relative; z-index: 1; }
      .dsh-galaxy-canvas {
        position: absolute; inset: 0; width: 100%; height: 100%; display: block;
        z-index: 0; pointer-events: none; border-radius: inherit;
      }
      .dsh-galaxy-canvas[hidden] { display: none; }
    `;

    function ensureStyles() {
      let element = document.getElementById(STYLE_ID);
      if (!element) {
        element = document.createElement('style');
        element.id = STYLE_ID;
        element.textContent = STYLE_TEXT;
        document.head.appendChild(element);
      }
      return element;
    }

    function mountScenes(store) {
      const scenes = new Map();
      let disposed = false;
      let queued = false;
      const style = ensureStyles();

      function scan() {
        queued = false;
        if (disposed) return;
        for (const [scene, entry] of scenes) {
          if (!scene.isConnected) {
            entry.dispose();
            scenes.delete(scene);
          }
        }
        for (const scene of document.querySelectorAll('[data-conversation-content]')) {
          if (!scenes.has(scene)) attach(scene);
        }
      }

      function scheduleScan() {
        if (queued) return;
        queued = true;
        queueMicrotask(scan);
      }

      function attach(scene) {
        const canvas = document.createElement('canvas');
        canvas.className = 'dsh-galaxy-canvas';
        canvas.setAttribute('aria-hidden', 'true');

        const previousPosition = scene.style.position;
        if (getComputedStyle(scene).position === 'static') scene.style.position = 'relative';
        scene.prepend(canvas);
        scene.classList.add('dsh-galaxy-scene');

        let engine = null;
        let pending = 0;
        let engineHandle = 0;
        let visibleNow = false;
        let engineFailed = false;

        const resizeObserver = new ResizeObserver(() => {
          if (engine) engine.resize();
        });
        resizeObserver.observe(scene);

        const intersection = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            visibleNow = !!entry && entry.isIntersecting;
            if (engine) engine.setActive(visibleNow);
            else if (visibleNow) scheduleEngine();
          },
          { threshold: 0 },
        );
        intersection.observe(canvas);

        // Building the point cloud costs ~100 ms; keep it off the boot stack and
        // skip scenes that never became visible.
        function scheduleEngine() {
          if (engine || engineHandle || engineFailed) return;
          engineHandle = window.setTimeout(() => {
            engineHandle = 0;
            const config = store.get();
            const phase = scene.dataset.contentPhase || '';
            if (engine || !visibleNow || !config.enabled) return;
            if (phase === 'hero' && !config.showOnHome) return;
            try {
              engine = new GalaxyEngine(canvas, config);
              engine.setActive(true);
            } catch (err) {
              engineFailed = true;
              canvas.hidden = true;
              if (window.console && window.console.error) {
                window.console.error('[dsh-galaxy-background] wallpaper failed to start', err);
              }
            }
          }, 48);
        }

        function update() {
          const config = store.get();
          const phase = scene.dataset.contentPhase || '';
          const active = config.enabled && (phase !== 'hero' || config.showOnHome);

          if (!active) {
            canvas.hidden = true;
            if (engine) {
              engine.destroy();
              engine = null;
            }
            return;
          }

          canvas.hidden = false;
          canvas.style.opacity = String(config.opacity);

          if (!engine) {
            if (!engineFailed) scheduleEngine();
          } else {
            engine.setConfig(config);
          }
        }

        const phaseObserver = new MutationObserver(update);
        phaseObserver.observe(scene, { attributes: true, attributeFilter: ['data-content-phase'] });

        const unsubscribe = store.subscribe(() => {
          if (pending) return;
          pending = window.setTimeout(() => {
            pending = 0;
            update();
          }, 160);
        });

        update();

        scenes.set(scene, {
          update,
          dispose() {
            if (pending) window.clearTimeout(pending);
            if (engineHandle) window.clearTimeout(engineHandle);
            engineHandle = 0;
            unsubscribe();
            phaseObserver.disconnect();
            resizeObserver.disconnect();
            intersection.disconnect();
            if (engine) engine.destroy();
            engine = null;
            canvas.remove();
            scene.style.position = previousPosition;
            scene.classList.remove('dsh-galaxy-scene');
          },
        });
      }

      const containsScene = (node) =>
        node.nodeType === 1 &&
        ((node.matches && node.matches('[data-conversation-content]')) ||
          (node.querySelector && node.querySelector('[data-conversation-content]')));

      // Streaming text mutates the DOM constantly; only rescan when a conversation
      // scene itself appeared or disappeared.
      const bodyObserver = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (containsScene(node)) return scheduleScan();
          }
          for (const node of record.removedNodes) {
            if (containsScene(node)) return scheduleScan();
          }
        }
      });
      bodyObserver.observe(document.body, { childList: true, subtree: true });

      const themeObserver = new MutationObserver(() => {
        for (const entry of scenes.values()) entry.update();
      });
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });

      scan();

      return {
        dispose() {
          disposed = true;
          bodyObserver.disconnect();
          themeObserver.disconnect();
          for (const entry of scenes.values()) entry.dispose();
          scenes.clear();
          if (style && style.parentNode) style.remove();
        },
      };
    }

    // -----------------------------------------------------------------------
    // Locale
    // -----------------------------------------------------------------------

    function createTranslator(ctx) {
      const locale = ctx && ctx.get ? ctx.get('locale') : undefined;
      const cleanups = [];

      if (locale && typeof locale.register === 'function') {
        for (const id of Object.keys(MESSAGES)) {
          try {
            cleanups.push(locale.register(LOCALE_NS, id, MESSAGES[id]));
          } catch (err) {
            /* an already-registered namespace keeps its first owner */
          }
        }
      }

      const bound = locale && typeof locale.bind === 'function' ? locale.bind(LOCALE_NS) : undefined;

      function activeDict() {
        let id = 'en';
        try {
          if (locale && typeof locale.getLocale === 'function') {
            id = String(locale.getLocale().active || 'en');
          }
        } catch (err) {
          /* keep English */
        }
        return MESSAGES[id] || MESSAGES[id.split('-')[0]] || MESSAGES.en;
      }

      return {
        t(key) {
          if (bound) {
            try {
              const value = bound(key);
              if (typeof value === 'string' && value !== key) return value;
            } catch (err) {
              /* fall back to the built-in dictionary */
            }
          }
          const dict = activeDict();
          return dict[key] !== undefined ? dict[key] : MESSAGES.en[key] !== undefined ? MESSAGES.en[key] : key;
        },
        dispose() {
          for (const fn of cleanups) {
            try {
              fn();
            } catch (err) {
              /* idempotent disposers */
            }
          }
        },
      };
    }

    // -----------------------------------------------------------------------
    // Settings page (placeholder until M2)
    // -----------------------------------------------------------------------

    function createSettingsPage(t) {
      return function GalaxySettings() {
        return h(
          'div',
          { className: 'dsh-galaxy-settings' },
          h('h2', null, t('title')),
          h('p', null, t('subtitle')),
          h('p', null, t('body')),
        );
      };
    }

    function apply(ctx) {
      const store = createStore();
      const translator = createTranslator(ctx);
      const t = translator.t;

      ctx.effect(() => {
        const mounted = mountScenes(store);
        return () => mounted.dispose();
      }, 'galaxy background scenes');

      ctx.effect(() => () => translator.dispose(), 'galaxy background locale');

      ctx.effect(() => {
        const onStorage = (event) => {
          if (event.key === STORAGE_KEY) store.reload();
        };
        window.addEventListener('storage', onStorage);
        return () => window.removeEventListener('storage', onStorage);
      }, 'galaxy background cross-tab sync');

      const SettingsPage = createSettingsPage(t);
      void store;

      ctx.slots.inject('settings.section', () =>
        ctx.slots.register(
          {
            name: 'settings.section',
            id: SETTINGS_ID,
            order: 60,
            label: () => t('title'),
          },
          SettingsPage,
        ),
      );
    }

    return {
      inject: ['slots'],
      apply,
    };
  },
});
