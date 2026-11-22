export const GALAXY_VERTEX = `
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

export const BACKGROUND_VERTEX = `
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

export const STAR_FRAGMENT = `
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
