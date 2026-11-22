import { clamp, perspectiveMatrix, lookAtMatrix } from './math.js';
import { GALAXY_VERTEX, BACKGROUND_VERTEX, STAR_FRAGMENT } from './shaders.js';
import { buildGalaxy, buildBackgroundStars, SHAPE } from './sampler.js';

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

export class GalaxyEngine {
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
