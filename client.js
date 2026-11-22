/*!
 * dsh-galaxy-background — generated bundle, do not edit by hand.
 * Sources live in src/; rebuild with: node scripts/build.mjs
 * Modules: 14
 */
window.__ModuleLoader__.load({
  id: 'dsh-galaxy-background',
  factory(require) {
    'use strict';

    const __modules = Object.create(null);
    const __cache = Object.create(null);

    function __resolve(from, spec) {
      const parts = from.split('/');
      parts.pop();
      for (const segment of spec.split('/')) {
        if (segment === '' || segment === '.') continue;
        if (segment === '..') parts.pop();
        else parts.push(segment);
      }
      return parts.join('/');
    }

    function __require(spec, from) {
      if (spec === 'react') return require('react');
      const id = __resolve(from, spec);
      const factory = __modules[id];
      if (!factory) throw new Error('[dsh-galaxy-background] module not bundled: ' + id);
      if (__cache[id]) return __cache[id].exports;
      const module = { exports: {} };
      __cache[id] = module;
      factory(module, module.exports, (next) => __require(next, id));
      return module.exports;
    }

// ---- src/color.js ----
__modules["src/color.js"] = function (module, exports, require) {
const { clamp } = require("./math.js");

function toRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

// sRGB -> linear lookup: the sampler touches this three times per star.
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

const COLOR_HOT = ['#9bb0ff', '#aabfff', '#cad7ff', '#f8f7ff'].map(toRgb);
const COLOR_WARM = ['#ffdec0', '#ffcfa0', '#ffb075', '#ff9560'].map(toRgb);
const COLOR_CORE = toRgb('#fffdfa');
const COLOR_CORE_WARM = toRgb('#ffd7b0');

function adjustHslForRegion(region, armDensity, hsl, regionTable) {
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

exports.toRgb = toRgb;
exports.srgbToLinear = srgbToLinear;
exports.rgbToHsl = rgbToHsl;
exports.hslToRgb = hslToRgb;
exports.mixRgb = mixRgb;
exports.pickPalette = pickPalette;
exports.adjustHslForRegion = adjustHslForRegion;
exports.COLOR_HOT = COLOR_HOT;
exports.COLOR_WARM = COLOR_WARM;
exports.COLOR_CORE = COLOR_CORE;
exports.COLOR_CORE_WARM = COLOR_CORE_WARM;
};

// ---- src/config.js ----
__modules["src/config.js"] = function (module, exports, require) {
// Configuration model: one table drives validation, defaults and the Settings page.
const STORAGE_KEY = 'dsh-galaxy-background:v1';

const FIELDS = {
  enabled: { kind: 'bool', def: true },

  // Motion
  speed: { kind: 'range', def: 1, min: 0, max: 2, step: 0.05 },
  parallax: { kind: 'range', def: 0.35, min: 0, max: 1, step: 0.05 },

  // Galaxy structure (rebuilds the point cloud)
  particleCount: { kind: 'range', def: 120000, min: 20000, max: 300000, step: 10000, rebuild: true },
  branches: { kind: 'range', def: 4, min: 2, max: 8, step: 1, rebuild: true },
  spin: { kind: 'range', def: 0.8, min: 0.1, max: 2, step: 0.05, rebuild: true },
  radius: { kind: 'range', def: 8, min: 4, max: 14, step: 0.5, rebuild: true },
  backgroundStars: { kind: 'bool', def: true, rebuild: true },

  // Appearance
  opacity: { kind: 'range', def: 1, min: 0, max: 1, step: 0.05 },
  starSize: { kind: 'range', def: 1, min: 0.3, max: 2.5, step: 0.1 },
  exposure: { kind: 'range', def: 1, min: 0.2, max: 3, step: 0.05 },

  // Glass (reserved for the blur layer)
  chatBlur: { kind: 'range', def: 12, min: 0, max: 40, step: 1 },
  chatTint: { kind: 'range', def: 0.18, min: 0, max: 1, step: 0.02 },
  composerGlass: { kind: 'bool', def: true },
  composerBlur: { kind: 'range', def: 16, min: 0, max: 40, step: 1 },

  // Camera
  cameraTilt: { kind: 'range', def: 29, min: 5, max: 85, step: 1 },
  cameraDistance: { kind: 'range', def: 13.2, min: 6, max: 30, step: 0.1 },

  // Behavior
  showOnHome: { kind: 'bool', def: true },
  pauseWhenHidden: { kind: 'bool', def: true },
  respectReducedMotion: { kind: 'bool', def: true },
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
        /* one listener must not break the others */
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

exports.normalize = normalize;
exports.createStore = createStore;
exports.STORAGE_KEY = STORAGE_KEY;
exports.FIELDS = FIELDS;
};

// ---- src/engine.js ----
__modules["src/engine.js"] = function (module, exports, require) {
const { clamp, perspectiveMatrix, lookAtMatrix } = require("./math.js");
const { GALAXY_VERTEX, BACKGROUND_VERTEX, STAR_FRAGMENT } = require("./shaders.js");
const { buildGalaxy, buildBackgroundStars, SHAPE } = require("./sampler.js");

// Reference scene: 0.02 * baseSpeed(0.5) * timeScale(0.5) per frame at 60 fps.
const TIME_PER_SECOND = 0.3;

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

function createBuffer(gl, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

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
    // three's AdditiveBlending: src * srcAlpha + dst * 1.
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
    const fit = aspect < 1.25 ? Math.pow(1.25 / Math.max(aspect, 0.4), 0.65) : 1;
    const distance = clamp(this.config.cameraDistance * fit, 4, 40);
    const eye = [
      Math.sin(azimuth) * Math.cos(tilt) * distance,
      Math.sin(tilt) * distance,
      Math.cos(azimuth) * Math.cos(tilt) * distance,
    ];
    const projection = perspectiveMatrix(60, aspect, 0.01, 500);
    const view = lookAtMatrix(eye, [0, 0, 0], [0, 1, 0]);

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

exports.GalaxyEngine = GalaxyEngine;
};

// ---- src/i18n.js ----
__modules["src/i18n.js"] = function (module, exports, require) {
// Dictionary registry plus a small fallback so labels work even before the
// locale service answers.
const LOCALE_NS = 'galaxy-background';

const MESSAGES = {
  en: {
    title: 'Galaxy background',
    subtitle: 'An animated spiral galaxy behind the conversation panel.',
    galaxy: 'Galaxy',
    appearance: 'Appearance',
    motion: 'Motion',
    behavior: 'Behavior',
    enabled: 'Enable wallpaper',
    enabledHint: 'Draw the galaxy behind the chat panel.',
    particleCount: 'Particle count',
    particleCountHint: 'Stars in the galaxy; higher is denser and heavier.',
    branches: 'Spiral arms',
    spin: 'Arm tightness',
    radius: 'Galaxy radius',
    backgroundStars: 'Background starfield',
    opacity: 'Wallpaper opacity',
    starSize: 'Star size',
    exposure: 'Brightness',
    speed: 'Rotation speed',
    parallax: 'Pointer parallax',
    cameraTilt: 'Camera tilt',
    cameraDistance: 'Camera distance',
    showOnHome: 'Show on new-session page',
    pauseWhenHidden: 'Pause when hidden',
    pauseWhenHiddenHint: 'Stops rendering while the window is in the background.',
    respectReducedMotion: 'Respect reduced motion',
    respectReducedMotionHint: 'Freezes the animation when the system asks for less motion.',
    reset: 'Restore defaults',
    degree: '°',
    px: 'px',
  },
  zh: {
    title: '星系背景',
    subtitle: '对话面板背后的动态螺旋星系。',
    galaxy: '星系',
    appearance: '外观',
    motion: '运动',
    behavior: '行为',
    enabled: '启用背景',
    enabledHint: '在对话面板背后绘制星系。',
    particleCount: '粒子数量',
    particleCountHint: '星系恒星总数，越高越密、越吃性能。',
    branches: '旋臂数量',
    spin: '旋臂缠绕度',
    radius: '星系半径',
    backgroundStars: '背景星空',
    opacity: '背景透明度',
    starSize: '恒星大小',
    exposure: '整体亮度',
    speed: '旋转速度',
    parallax: '鼠标视差',
    cameraTilt: '视角俯仰',
    cameraDistance: '相机距离',
    showOnHome: '新会话页显示',
    pauseWhenHidden: '后台暂停',
    pauseWhenHiddenHint: '窗口失去焦点时停止渲染。',
    respectReducedMotion: '尊重减少动态效果',
    respectReducedMotionHint: '系统要求减少动态效果时冻结动画。',
    reset: '恢复默认',
    degree: '°',
    px: 'px',
  },
};

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

exports.createTranslator = createTranslator;
exports.LOCALE_NS = LOCALE_NS;
exports.MESSAGES = MESSAGES;
};

// ---- src/main.js ----
__modules["src/main.js"] = function (module, exports, require) {
const { createStore, STORAGE_KEY } = require("./config.js");
const { createTranslator } = require("./i18n.js");
const { mountScenes } = require("./scene.js");
const { createSettingsPage } = require("./ui/settings-page.js");
const { ensureSettingsStyles } = require("./ui/styles.js");

const SETTINGS_ID = 'galaxy-background';

function apply(ctx) {
  const store = createStore();
  const translator = createTranslator(ctx);
  const t = translator.t;

  ctx.effect(() => {
    const scenes = mountScenes(store);
    const settingsStyle = ensureSettingsStyles();
    return () => {
      scenes.dispose();
      if (settingsStyle && settingsStyle.parentNode) settingsStyle.remove();
    };
  }, 'galaxy background scenes and styles');

  ctx.effect(() => () => translator.dispose(), 'galaxy background locale');

  ctx.effect(() => {
    const onStorage = (event) => {
      if (event.key === STORAGE_KEY) store.reload();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, 'galaxy background cross-tab sync');

  const SettingsPage = createSettingsPage(store, t, ctx);

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

const inject = ['slots'];

exports.apply = apply;
exports.inject = inject;
};

// ---- src/math.js ----
__modules["src/math.js"] = function (module, exports, require) {
const TAU = Math.PI * 2;

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

exports.clamp = clamp;
exports.smoothstep = smoothstep;
exports.randomExp = randomExp;
exports.randomNormal = randomNormal;
exports.sampleExponential = sampleExponential;
exports.perspectiveMatrix = perspectiveMatrix;
exports.lookAtMatrix = lookAtMatrix;
exports.TAU = TAU;
};

// ---- src/sampler.js ----
__modules["src/sampler.js"] = function (module, exports, require) {
const { TAU, clamp, smoothstep, randomExp, randomNormal, sampleExponential } = require("./math.js");
const { COLOR_HOT, COLOR_WARM, COLOR_CORE, COLOR_CORE_WARM, mixRgb, pickPalette, rgbToHsl, hslToRgb, srgbToLinear, adjustHslForRegion } = require("./color.js");

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

exports.buildGalaxy = buildGalaxy;
exports.buildBackgroundStars = buildBackgroundStars;
exports.REGION = REGION;
exports.SHAPE = SHAPE;
};

// ---- src/scene.js ----
__modules["src/scene.js"] = function (module, exports, require) {
const { GalaxyEngine } = require("./engine.js");

const SCENE_STYLE = `
  .dsh-galaxy-scene { position: relative; }
  .dsh-galaxy-scene > [data-conversation-scroll],
  .dsh-galaxy-scene [data-conversation-scroll] { position: relative; z-index: 1; }
  .dsh-galaxy-canvas {
    position: absolute; inset: 0; width: 100%; height: 100%; display: block;
    z-index: 0; pointer-events: none; border-radius: inherit;
  }
  .dsh-galaxy-canvas[hidden] { display: none; }
`;

const STYLE_ID = 'dsh-galaxy-background-styles';

function ensureSceneStyles() {
  let element = document.getElementById(STYLE_ID);
  if (!element) {
    element = document.createElement('style');
    element.id = STYLE_ID;
    element.textContent = SCENE_STYLE;
    document.head.appendChild(element);
  }
  return element;
}

function mountScenes(store) {
  const scenes = new Map();
  let disposed = false;
  let queued = false;
  const style = ensureSceneStyles();

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

    // Building the point cloud costs ~100 ms; keep it off the boot stack and skip
    // scenes that never became visible.
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

exports.ensureSceneStyles = ensureSceneStyles;
exports.mountScenes = mountScenes;
exports.SCENE_STYLE = SCENE_STYLE;
};

// ---- src/shaders.js ----
__modules["src/shaders.js"] = function (module, exports, require) {
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
    gl_FragColor = vec4(vColor * strength * uExposure, strength);
  }
`;

exports.GALAXY_VERTEX = GALAXY_VERTEX;
exports.BACKGROUND_VERTEX = BACKGROUND_VERTEX;
exports.STAR_FRAGMENT = STAR_FRAGMENT;
};

// ---- src/ui/controls.js ----
__modules["src/ui/controls.js"] = function (module, exports, require) {
const { createElement, useEffect, useRef } = require("react");
const { FIELDS } = require("../config.js");
const { FireSliderRenderer } = require("./fire-slider.js");

function formatValue(name, value, t) {
  if (name === 'particleCount') return `${Math.round(value / 1000)}k`;
  if (name === 'cameraTilt') return `${Math.round(value)}${t('degree')}`;
  if (name === 'chatBlur' || name === 'composerBlur') return `${Math.round(value)}${t('px')}`;
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

function Switch(props) {
  return createElement(
    'button',
    {
      type: 'button',
      role: 'switch',
      'aria-checked': props.checked ? 'true' : 'false',
      'aria-label': props.label,
      className: 'dsh-galaxy-switch',
      onClick: () => props.onChange(!props.checked),
    },
    createElement('span', { className: 'dsh-galaxy-knob' }),
  );
}

function Row(props) {
  return createElement(
    'div',
    { className: 'dsh-galaxy-row' },
    createElement(
      'div',
      { className: 'dsh-galaxy-row-text' },
      createElement('span', { className: 'dsh-galaxy-row-label' }, props.label),
      props.hint ? createElement('span', { className: 'dsh-galaxy-row-hint' }, props.hint) : null,
    ),
    createElement('div', { className: 'dsh-galaxy-control' }, props.children),
  );
}

function Group(props) {
  return createElement(
    'section',
    { className: 'dsh-galaxy-group' },
    createElement('h3', { className: 'dsh-galaxy-group-title' }, props.title),
    createElement('div', { className: 'dsh-galaxy-card' }, props.children),
  );
}

function RangeSlider(props) {
  const field = FIELDS[props.name];
  return createElement(
    'div',
    { className: 'dsh-galaxy-slider' },
    createElement('input', {
      type: 'range',
      min: field.min,
      max: field.max,
      step: field.step,
      value: props.value,
      'aria-label': props.label,
      onChange: (event) => props.onChange(Number(event.target.value)),
    }),
    createElement('span', { className: 'dsh-galaxy-value' }, formatValue(props.name, props.value, props.t)),
  );
}

/** Fire-shader slider: a WebGL2 track behind a native range input. */
function FireSlider(props) {
  const field = FIELDS[props.name];
  const canvasRef = useRef(null);
  const rendererRef = useRef(null);

  const normalized = () => {
    const span = field.max - field.min || 1;
    return (props.value - field.min) / span;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let renderer = null;
    try {
      renderer = new FireSliderRenderer(canvas);
      renderer.setSliderValue(normalized());
      renderer.setActive(true);
      rendererRef.current = renderer;
    } catch (err) {
      rendererRef.current = null;
    }
    return () => {
      if (renderer) renderer.destroy();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current) rendererRef.current.setSliderValue(normalized());
  }, [props.value]);

  return createElement(
    'div',
    { className: 'dsh-galaxy-fire' },
    createElement(
      'div',
      { className: 'dsh-galaxy-fire-track' },
      createElement('canvas', { ref: canvasRef, 'aria-hidden': 'true' }),
      createElement('input', {
        type: 'range',
        min: field.min,
        max: field.max,
        step: field.step,
        value: props.value,
        'aria-label': props.label,
        onChange: (event) => props.onChange(Number(event.target.value)),
      }),
    ),
    createElement('span', { className: 'dsh-galaxy-value' }, formatValue(props.name, props.value, props.t)),
  );
}

exports.formatValue = formatValue;
exports.Switch = Switch;
exports.Row = Row;
exports.Group = Group;
exports.RangeSlider = RangeSlider;
exports.FireSlider = FireSlider;
};

// ---- src/ui/fire-shaders.js ----
__modules["src/ui/fire-shaders.js"] = function (module, exports, require) {
// WebGL fire shaders for the shader slider, adapted from
// Julian-Meng.github.io/slider-module/shaders.js. The simulation runs at the
// track's resolution: ping-pong heat buffers, two blur passes, one composite.
const FIRE_VERT = `#version 300 es
  layout(location=0) in vec2 a_pos;
  out vec2 v_uv;
  void main(){ v_uv=a_pos*0.5+0.5; gl_Position=vec4(a_pos,0.0,1.0); }
`;

const FIRE_SIM = `#version 300 es
  precision highp float;
  in vec2 v_uv; out vec4 fc;
  uniform float u_time, u_slider, u_elapsed;
  uniform vec2 u_res;
  uniform sampler2D u_back;
  float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  void main(){
    vec2 uv=v_uv;
    // Keep the ember cells a stable size in CSS pixels instead of a fixed grid.
    vec2 g=uv*vec2(max(18.0, floor(u_res.x/6.0)), max(3.0, floor(u_res.y/8.0)));
    vec2 id=floor(g);
    vec2 cf=fract(g);
    float h=hash(id);
    vec2 ap=abs(cf-0.5);
    float cell=smoothstep(0.45,0.15,max(ap.x,ap.y));
    vec3 prev=texture(u_back,uv).rgb;
    float fade_mask = smoothstep(0.0, 0.45, uv.x);
    vec3 decay = prev * 0.90 * fade_mask;
    // The reference ignites only at the far end; the settings slider wants the
    // flame visible across the whole usable range.
    float act=smoothstep(0.02,0.18,u_slider);
    if(act<0.01||u_elapsed<0.0){ fc=vec4(decay,1.0); return; }
    float t=u_time;
    float cellDelay = h * 1.2;
    float cellAge   = max(u_elapsed - cellDelay, 0.0);
    float ignited   = step(0.001, cellAge);
    float cellSpd   = 0.85 + h * 0.30;
    float eased = 1.0 - pow(1.0 - clamp(cellAge / 2.5, 0.0, 1.0), 3.0);
    float dist  = eased * u_slider * cellSpd * ignited;
    float cellOff = (h - 0.5) * 0.05;
    float front   = max(u_slider - dist - cellOff, 0.02);
    float tail    = max(u_slider - front, 0.001);
    float inZ   = step(front - 0.003, uv.x) * step(uv.x, u_slider + 0.003);
    float dn    = clamp(max(u_slider - uv.x, 0.0) / tail, 0.0, 1.0);
    float bright = pow(1.0 - dn, 0.65);
    bright = max(bright, 0.04 * ignited) * inZ;
    bright *= 1.0 - smoothstep(0.94, 1.05, dn);
    float es = mix(0.15, 0.5, min(u_elapsed / 1.0, 1.0));
    float vy = abs(uv.y - 0.5) * 2.0;
    float vf = pow(max(1.0 - vy * vy * 0.45, 0.0), 0.75);
    float ts = mix(0.85, 1.0, min(u_elapsed / 1.5, 1.0));
    float f1 = sin(uv.x * 30.0 + t * 15.0 * ts + h * 6.28);
    float f2 = sin(uv.x * 17.0 + t * 8.0 * ts + h * 3.14);
    float f3 = sin(uv.x * 52.0 + t * 25.0 * ts + h * 10.0);
    float flame = smoothstep(0.08, 0.92, (f1 + f2 * 0.5 + f3 * 0.25) * 0.35 + 0.5);
    float r1 = sin(dn * 16.0 - t * 5.0 * ts + h * 3.0);
    float r2 = sin(dn * 8.0 - t * 2.5 * ts + h * 5.0);
    float rhythm = smoothstep(-0.15, 0.55, r1) * (r2 * 0.5 + 0.5);
    rhythm = pow(max(rhythm, 0.0), 1.2);
    float avgSpd = dist / max(cellAge, 0.001);
    float age    = max(cellAge - max(u_slider - uv.x, 0.0) / max(avgSpd, 0.001), 0.0);
    float flash  = step(0.0, age) * exp(-age * 3.2);
    float sp  = fract(t * (0.38 + h * 0.15) + h * 7.0);
    float sX  = u_slider - sp * tail;
    float sY  = 0.5 + sin(sp * 11.0 + h * 6.28) * 0.28;
    float spark = smoothstep(0.014, 0.0, abs(uv.x - sX))
                * smoothstep(0.18, 0.0, abs(uv.y - sY))
                * (1.0 - sp) * (1.0 - sp) * es;
    float energy = bright * vf * (flame * 0.42 + rhythm * 0.38)
                 + flash * bright * vf * 0.55
                 + spark * 0.7 * inZ;
    energy *= es;
    float edgeBase = exp(-pow((uv.x - front) * 18.0, 2.0));
    float ef1 = sin(uv.x * 45.0 + t * 20.0 * ts + h * 6.28) * 0.5 + 0.5;
    float ef2 = sin(uv.x * 28.0 + t * 11.0 * ts + h * 3.14) * 0.5 + 0.5;
    float edge = edgeBase * (0.25 + ef1 * ef2 * 1.5) * 1.6 * act * es;
    float leadD    = front - uv.x;
    float leadZone = smoothstep(0.07, 0.0, leadD) * step(0.0, leadD) * vf;
    float h2       = hash(id + vec2(99.0, 33.0));
    float leadF    = sin(leadD * 100.0 + t * 20.0 * ts + h2 * 6.28) * 0.5 + 0.5;
    float leadSpark = leadZone * step(0.6, h2) * leadF * act * es * 0.5;
    float total = energy + edge + leadSpark;
    vec3 ember = vec3(0.28, 0.10, 0.58);
    vec3 wpur  = vec3(0.62, 0.32, 1.0);
    vec3 wht   = vec3(1.0, 0.94, 0.98);
    float temp = 1.0 - dn;
    vec3 col   = mix(ember, wpur, temp);
    col        = mix(col, wht, pow(temp, 4.5));
    col       *= total;
    float pulse = sin(t * 2.8) * 0.15 + 1.0;
    float core  = exp(-pow((uv.x - u_slider) * 16.0, 2.0));
    col += wht * core * 2.2 * pulse * act * es;
    col += wpur * exp(-pow((uv.x - u_slider) * 3.5, 2.0)) * 0.12 * act * es;
    col *= mix(0.9, 1.0, cell);
    col *= fade_mask;
    fc = vec4(min(decay + col, vec3(1.5)), 1.0);
  }
`;

const FIRE_BLUR = `#version 300 es
  precision highp float;
  in vec2 v_uv; out vec4 fc;
  uniform sampler2D u_tex;
  uniform vec2 u_dir, u_res;
  uniform float u_ext;
  vec3 s(vec2 uv){
    vec3 c=texture(u_tex,uv).rgb;
    return u_ext>0.5 && dot(c,vec3(0.2126,0.7152,0.0722))<0.3 ? vec3(0.0) : c;
  }
  void main(){
    vec2 o=u_dir*3.0/u_res;
    vec3 r=s(v_uv)*0.227027;
    r+=s(v_uv+o)*0.194595;    r+=s(v_uv-o)*0.194595;
    r+=s(v_uv+o*2.0)*0.121622;r+=s(v_uv-o*2.0)*0.121622;
    r+=s(v_uv+o*3.0)*0.054054;r+=s(v_uv-o*3.0)*0.054054;
    fc=vec4(r,1.0);
  }
`;

const FIRE_COMPOSITE = `#version 300 es
  precision highp float;
  in vec2 v_uv; out vec4 fc;
  uniform sampler2D u_scene, u_glow;
  void main(){
    vec3 s=texture(u_scene,v_uv).rgb;
    vec3 g=texture(u_glow,v_uv).rgb;
    fc=vec4(1.0-exp(-(s+g*1.2+s*g*0.35)*1.15),1.0);
  }
`;

exports.FIRE_VERT = FIRE_VERT;
exports.FIRE_SIM = FIRE_SIM;
exports.FIRE_BLUR = FIRE_BLUR;
exports.FIRE_COMPOSITE = FIRE_COMPOSITE;
};

// ---- src/ui/fire-slider.js ----
__modules["src/ui/fire-slider.js"] = function (module, exports, require) {
const { FIRE_VERT, FIRE_SIM, FIRE_BLUR, FIRE_COMPOSITE } = require("./fire-shaders.js");

/**
 * WebGL2 fire simulation rendered inside one slider track. Adapted from
 * Julian-Meng.github.io/slider-module/webgl-fire.js: ping-pong heat buffers at
 * the track's resolution, two separable blur passes, one composite.
 */
class FireSliderRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { antialias: false, depth: false, stencil: false });
    if (!this.gl) throw new Error('WebGL2 is not available for the fire slider');
    this.slider = 0.5;
    this.active = true;
    this.raf = 0;
    this.started = 0;
    this.simA = null;
    this.simB = null;
    this.blurH = null;
    this.blurV = null;
    this.resizeObserver = null;

    this.compile();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = window.requestAnimationFrame(this.loop);
  }

  setSliderValue(normalized) {
    this.slider = Math.min(1, Math.max(0, normalized));
  }

  setActive(active) {
    this.active = active;
    if (active && !this.raf) this.raf = window.requestAnimationFrame(this.loop);
  }

  compileShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`fire shader compile failed: ${info}`);
    }
    return shader;
  }

  link(vertexSource, fragmentSource) {
    const gl = this.gl;
    const program = gl.createProgram();
    const vertex = this.compileShader(gl.VERTEX_SHADER, vertexSource);
    const fragment = this.compileShader(gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.bindAttribLocation(program, 0, 'a_pos');
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`fire program link failed: ${gl.getProgramInfoLog(program)}`);
    }
    return program;
  }

  compile() {
    const gl = this.gl;
    this.simProgram = this.link(FIRE_VERT, FIRE_SIM);
    this.blurProgram = this.link(FIRE_VERT, FIRE_BLUR);
    this.compositeProgram = this.link(FIRE_VERT, FIRE_COMPOSITE);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {
      time: gl.getUniformLocation(this.simProgram, 'u_time'),
      slider: gl.getUniformLocation(this.simProgram, 'u_slider'),
      elapsed: gl.getUniformLocation(this.simProgram, 'u_elapsed'),
      res: gl.getUniformLocation(this.simProgram, 'u_res'),
      back: gl.getUniformLocation(this.simProgram, 'u_back'),
      blurDir: gl.getUniformLocation(this.blurProgram, 'u_dir'),
      blurExt: gl.getUniformLocation(this.blurProgram, 'u_ext'),
      blurTex: gl.getUniformLocation(this.blurProgram, 'u_tex'),
      blurRes: gl.getUniformLocation(this.blurProgram, 'u_res'),
      scene: gl.getUniformLocation(this.compositeProgram, 'u_scene'),
      glow: gl.getUniformLocation(this.compositeProgram, 'u_glow'),
    };
  }

  makeTarget() {
    const gl = this.gl;
    const framebuffer = gl.createFramebuffer();
    const texture = gl.createTexture();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { framebuffer, texture };
  }

  destroyTarget(target) {
    if (!target || !this.gl) return;
    this.gl.deleteFramebuffer(target.framebuffer);
    this.gl.deleteTexture(target.texture);
  }

  destroyTargets() {
    this.destroyTarget(this.simA);
    this.destroyTarget(this.simB);
    this.destroyTarget(this.blurH);
    this.destroyTarget(this.blurV);
    this.simA = null;
    this.simB = null;
    this.blurH = null;
    this.blurV = null;
  }

  resize() {
    if (!this.gl || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(2, Math.round(rect.width * dpr));
    const height = Math.max(2, Math.round(rect.height * dpr));
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.destroyTargets();
    this.simA = this.makeTarget();
    this.simB = this.makeTarget();
    this.blurH = this.makeTarget();
    this.blurV = this.makeTarget();
  }

  loop(now) {
    this.raf = 0;
    if (!this.gl) return;
    if (!this.simA) this.resize();
    if (!this.simA) {
      this.raf = window.requestAnimationFrame(this.loop);
      return;
    }
    if (!this.active) return;

    const gl = this.gl;
    if (!this.started) this.started = now;
    const elapsed = (now - this.started) / 1000;
    const time = now * 0.001;
    const uniforms = this.uniforms;

    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.simB.framebuffer);
    gl.useProgram(this.simProgram);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.slider, this.slider);
    gl.uniform1f(uniforms.elapsed, elapsed);
    gl.uniform2f(uniforms.res, this.canvas.width, this.canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.simA.texture);
    gl.uniform1i(uniforms.back, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.useProgram(this.blurProgram);
    gl.uniform2f(uniforms.blurRes, this.canvas.width, this.canvas.height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurH.framebuffer);
    gl.uniform2f(uniforms.blurDir, 1, 0);
    gl.uniform1f(uniforms.blurExt, 1);
    gl.bindTexture(gl.TEXTURE_2D, this.simB.texture);
    gl.uniform1i(uniforms.blurTex, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurV.framebuffer);
    gl.uniform2f(uniforms.blurDir, 0, 1);
    gl.uniform1f(uniforms.blurExt, 0);
    gl.bindTexture(gl.TEXTURE_2D, this.blurH.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.compositeProgram);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.simB.texture);
    gl.uniform1i(uniforms.scene, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.blurV.texture);
    gl.uniform1i(uniforms.glow, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const swap = this.simA;
    this.simA = this.simB;
    this.simB = swap;

    this.raf = window.requestAnimationFrame(this.loop);
  }

  destroy() {
    if (this.raf) window.cancelAnimationFrame(this.raf);
    this.raf = 0;
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.resizeObserver = null;
    this.destroyTargets();
    const gl = this.gl;
    if (gl) {
      if (this.simProgram) gl.deleteProgram(this.simProgram);
      if (this.blurProgram) gl.deleteProgram(this.blurProgram);
      if (this.compositeProgram) gl.deleteProgram(this.compositeProgram);
      if (this.vao) gl.deleteVertexArray(this.vao);
      if (this.vbo) gl.deleteBuffer(this.vbo);
    }
    this.gl = null;
    this.canvas = null;
  }
}

exports.FireSliderRenderer = FireSliderRenderer;
};

// ---- src/ui/settings-page.js ----
__modules["src/ui/settings-page.js"] = function (module, exports, require) {
const { createElement: h, useEffect, useReducer, useState } = require("react");
const { Group, Row, RangeSlider, Switch, FireSlider } = require("./controls.js");

function RangeRow(props) {
  const t = props.t;
  return h(
    Row,
    { label: t(props.labelKey), hint: props.hintKey ? t(props.hintKey) : undefined },
    h(RangeSlider, {
      name: props.name,
      value: props.value,
      label: t(props.labelKey),
      t,
      onChange: props.onChange,
    }),
  );
}

function BoolRow(props) {
  const t = props.t;
  return h(
    Row,
    { label: t(props.labelKey), hint: props.hintKey ? t(props.hintKey) : undefined },
    h(Switch, {
      checked: props.value,
      label: t(props.labelKey),
      onChange: props.onChange,
    }),
  );
}

function MotionSpeedRow(props) {
  const t = props.t;
  return h(
    Row,
    { label: t('speed') },
    h(FireSlider, {
      name: 'speed',
      value: props.value,
      label: t('speed'),
      t,
      onChange: props.onChange,
    }),
  );
}

function createSettingsPage(store, t, ctx) {
  return function GalaxySettings() {
    const [config, setConfig] = useState(store.get());
    const [, forceRender] = useReducer((tick) => tick + 1, 0);

    useEffect(() => store.subscribe(setConfig), []);

    // Labels follow the active locale; `t` reads it live.
    useEffect(() => {
      const locale = ctx && ctx.get ? ctx.get('locale') : undefined;
      if (!locale || typeof locale.subscribe !== 'function') return undefined;
      return locale.subscribe(() => forceRender());
    }, []);

    const patch = (key) => (value) => store.set({ [key]: value });

    return h(
      'div',
      { className: 'dsh-galaxy-settings' },
      h(
        'header',
        { className: 'dsh-galaxy-header' },
        h('h2', null, t('title')),
        h('p', null, t('subtitle')),
      ),
      h(
        Group,
        { title: t('galaxy') },
        h(BoolRow, {
          t,
          labelKey: 'enabled',
          hintKey: 'enabledHint',
          value: config.enabled,
          onChange: patch('enabled'),
        }),
        h(RangeRow, {
          t,
          name: 'particleCount',
          labelKey: 'particleCount',
          hintKey: 'particleCountHint',
          value: config.particleCount,
          onChange: patch('particleCount'),
        }),
        h(RangeRow, { t, name: 'branches', labelKey: 'branches', value: config.branches, onChange: patch('branches') }),
        h(RangeRow, { t, name: 'spin', labelKey: 'spin', value: config.spin, onChange: patch('spin') }),
        h(RangeRow, { t, name: 'radius', labelKey: 'radius', value: config.radius, onChange: patch('radius') }),
        h(BoolRow, {
          t,
          labelKey: 'backgroundStars',
          value: config.backgroundStars,
          onChange: patch('backgroundStars'),
        }),
      ),
      h(
        Group,
        { title: t('appearance') },
        h(RangeRow, { t, name: 'opacity', labelKey: 'opacity', value: config.opacity, onChange: patch('opacity') }),
        h(RangeRow, { t, name: 'starSize', labelKey: 'starSize', value: config.starSize, onChange: patch('starSize') }),
        h(RangeRow, { t, name: 'exposure', labelKey: 'exposure', value: config.exposure, onChange: patch('exposure') }),
      ),
      h(
        Group,
        { title: t('motion') },
        h(MotionSpeedRow, { t, value: config.speed, onChange: patch('speed') }),
        h(RangeRow, {
          t,
          name: 'parallax',
          labelKey: 'parallax',
          value: config.parallax,
          onChange: patch('parallax'),
        }),
        h(RangeRow, {
          t,
          name: 'cameraTilt',
          labelKey: 'cameraTilt',
          value: config.cameraTilt,
          onChange: patch('cameraTilt'),
        }),
        h(RangeRow, {
          t,
          name: 'cameraDistance',
          labelKey: 'cameraDistance',
          value: config.cameraDistance,
          onChange: patch('cameraDistance'),
        }),
      ),
      h(
        Group,
        { title: t('behavior') },
        h(BoolRow, {
          t,
          labelKey: 'showOnHome',
          value: config.showOnHome,
          onChange: patch('showOnHome'),
        }),
        h(BoolRow, {
          t,
          labelKey: 'pauseWhenHidden',
          hintKey: 'pauseWhenHiddenHint',
          value: config.pauseWhenHidden,
          onChange: patch('pauseWhenHidden'),
        }),
        h(BoolRow, {
          t,
          labelKey: 'respectReducedMotion',
          hintKey: 'respectReducedMotionHint',
          value: config.respectReducedMotion,
          onChange: patch('respectReducedMotion'),
        }),
      ),
      h(
        'div',
        { className: 'dsh-galaxy-footer' },
        h(
          'button',
          { type: 'button', className: 'dsh-galaxy-reset', onClick: () => store.reset() },
          t('reset'),
        ),
      ),
    );
  };
}

exports.createSettingsPage = createSettingsPage;
};

// ---- src/ui/styles.js ----
__modules["src/ui/styles.js"] = function (module, exports, require) {
const SETTINGS_STYLE = `
  .dsh-galaxy-settings { display: flex; flex-direction: column; gap: 20px; padding: 4px 0 32px; }
  .dsh-galaxy-header { display: flex; flex-direction: column; gap: 4px; }
  .dsh-galaxy-header h2 { margin: 0; font-size: 16px; line-height: 24px; font-weight: 600;
    color: var(--dsw-alias-label-primary); }
  .dsh-galaxy-header p { margin: 0; font-size: 13px; line-height: 20px;
    color: var(--dsw-alias-label-secondary); }
  .dsh-galaxy-group { display: flex; flex-direction: column; gap: 2px; }
  .dsh-galaxy-group-title { margin: 0 0 6px; font-size: 12px; line-height: 18px; font-weight: 600;
    letter-spacing: 0.04em; text-transform: uppercase; color: var(--dsw-alias-label-secondary); }
  .dsh-galaxy-card { border: 0.5px solid var(--dsw-alias-border-l1); border-radius: 10px;
    background: var(--dsw-alias-bg-layer-1); overflow: hidden; }
  .dsh-galaxy-row { display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 12px 14px; }
  .dsh-galaxy-row + .dsh-galaxy-row { border-top: 0.5px solid var(--dsw-alias-border-l1); }
  .dsh-galaxy-row-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .dsh-galaxy-row-label { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary); }
  .dsh-galaxy-row-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
  .dsh-galaxy-control { display: flex; align-items: center; gap: 10px; flex: 0 0 auto; }
  .dsh-galaxy-slider { width: 220px; max-width: 38vw; display: flex; align-items: center; gap: 10px; }
  .dsh-galaxy-slider input[type='range'] { flex: 1; min-width: 110px; height: 18px; margin: 0;
    accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
  .dsh-galaxy-value { min-width: 56px; text-align: right; font-size: 12px; line-height: 18px;
    font-variant-numeric: tabular-nums; color: var(--dsw-alias-label-secondary); }
  .dsh-galaxy-switch { position: relative; width: 38px; height: 22px; padding: 0; flex: none;
    border-radius: 999px; border: 0.5px solid var(--dsw-alias-border-l2);
    background: var(--dsw-alias-bg-layer-2); cursor: pointer; transition: background 120ms ease; }
  .dsh-galaxy-switch[aria-checked='true'] { background: var(--dsw-alias-brand-primary);
    border-color: transparent; }
  .dsh-galaxy-switch:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
  .dsh-galaxy-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
    border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.28);
    transition: transform 140ms ease; }
  .dsh-galaxy-switch[aria-checked='true'] .dsh-galaxy-knob { transform: translateX(16px); }
  .dsh-galaxy-footer { display: flex; justify-content: flex-end; }
  .dsh-galaxy-reset { height: 30px; padding: 0 14px; border-radius: 8px;
    border: 0.5px solid var(--dsw-alias-border-l2); background: transparent; cursor: pointer;
    font-size: 13px; color: var(--dsw-alias-label-primary); }
  .dsh-galaxy-reset:hover { background: var(--dsw-alias-bg-layer-2); }

  /* Shader slider (fire) */
  .dsh-galaxy-fire { width: 240px; max-width: 40vw; display: flex; align-items: center; gap: 10px; }
  .dsh-galaxy-fire-track { position: relative; flex: 1; height: 26px; border-radius: 8px;
    overflow: hidden; isolation: isolate; background: #0b0b10;
    border: 0.5px solid var(--dsw-alias-border-l2); }
  .dsh-galaxy-fire-track canvas { position: absolute; inset: 0; width: 100%; height: 100%;
    pointer-events: none; mix-blend-mode: screen; z-index: 2; }
  .dsh-galaxy-fire-track input[type='range'] { position: absolute; inset: 0; width: 100%;
    height: 100%; margin: 0; padding: 0; background: transparent; appearance: none;
    -webkit-appearance: none; cursor: pointer; z-index: 3; outline: none; }
  .dsh-galaxy-fire-track input[type='range']::-webkit-slider-thumb { -webkit-appearance: none;
    width: 20px; height: 20px; border-radius: 7px;
    background: linear-gradient(170deg, #ffffff 0%, #f0f0f2 40%, #e4e4e6 100%);
    border: 0.5px solid rgba(0, 0, 0, 0.12);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25), 0 3px 8px rgba(0, 0, 0, 0.2),
      inset 0 0.5px 0 rgba(255, 255, 255, 0.85); cursor: grab; }
  .dsh-galaxy-fire-track input[type='range']::-moz-range-thumb { width: 18px; height: 18px;
    border-radius: 6px; background: #f4f4f6; border: 0.5px solid rgba(0, 0, 0, 0.12); cursor: grab; }
  .dsh-galaxy-fire-track:focus-within { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
`;

const STYLE_ID = 'dsh-galaxy-settings-styles';

function ensureSettingsStyles() {
  let element = document.getElementById(STYLE_ID);
  if (!element) {
    element = document.createElement('style');
    element.id = STYLE_ID;
    element.textContent = SETTINGS_STYLE;
    document.head.appendChild(element);
  }
  return element;
}

exports.ensureSettingsStyles = ensureSettingsStyles;
exports.SETTINGS_STYLE = SETTINGS_STYLE;
};

    return __require("src/main.js", '');
  },
});
