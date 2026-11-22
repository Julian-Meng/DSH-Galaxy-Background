import { FIRE_VERT, FIRE_SIM, FIRE_BLUR, FIRE_COMPOSITE } from './fire-shaders.js';

/**
 * WebGL2 fire simulation rendered inside one slider track. Adapted from
 * Julian-Meng.github.io/slider-module/webgl-fire.js: ping-pong heat buffers at
 * the track's resolution, two separable blur passes, one composite.
 */
export class FireSliderRenderer {
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
