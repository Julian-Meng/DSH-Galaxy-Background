// Configuration model: one table drives validation, defaults and the Settings page.
export const STORAGE_KEY = 'dsh-galaxy-background:v1';

export const FIELDS = {
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

export function normalize(raw) {
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

export function createStore() {
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
