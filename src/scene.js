import { GalaxyEngine } from './engine.js';

export const SCENE_STYLE = `
  .dsh-galaxy-scene { position: relative; }
  .dsh-galaxy-scene > [data-conversation-scroll],
  .dsh-galaxy-scene [data-conversation-scroll] { position: relative; z-index: 1; }
  .dsh-galaxy-canvas {
    position: absolute; inset: 0; width: 100%; height: 100%; display: block;
    z-index: 0; pointer-events: none; border-radius: inherit;
  }
  .dsh-galaxy-canvas[hidden] { display: none; }

  /* Optional frost between the wallpaper and the transcript. Hidden unless the
     user raises the blur or mask sliders. */
  .dsh-galaxy-frost {
    position: absolute; inset: 0; z-index: 0; pointer-events: none; border-radius: inherit;
    background: rgba(4, 6, 14, var(--dsh-galaxy-tint, 0));
    -webkit-backdrop-filter: blur(var(--dsh-galaxy-blur, 0px)) saturate(1.05);
    backdrop-filter: blur(var(--dsh-galaxy-blur, 0px)) saturate(1.05);
  }
  .dsh-galaxy-frost[hidden] { display: none; }

  /* Composer glass: frosted surface on the message composer card. */
  .dsh-galaxy-scene[data-galaxy-composer] [data-composer-card] {
    position: relative; isolation: isolate;
    background: transparent; --dsw-specific-input-major: transparent;
  }
  .dsh-galaxy-scene[data-galaxy-composer] [data-composer-card]::before {
    content: ''; position: absolute; inset: 0; z-index: -1; pointer-events: none;
    border-radius: inherit;
    background: rgba(4, 6, 14, var(--dsh-galaxy-composer-tint, 0.18));
    -webkit-backdrop-filter: blur(var(--dsh-galaxy-composer-blur, 16px));
    backdrop-filter: blur(var(--dsh-galaxy-composer-blur, 16px));
  }

  /* Theme-aware tint where color-mix is supported. */
  @supports (background: color-mix(in srgb, red 50%, transparent)) {
    .dsh-galaxy-frost {
      background: color-mix(in srgb, var(--dsw-alias-bg-base) calc(var(--dsh-galaxy-tint, 0) * 100%), transparent);
    }
    .dsh-galaxy-scene[data-galaxy-composer] [data-composer-card]::before {
      background: color-mix(in srgb, var(--dsw-alias-bg-base) calc(var(--dsh-galaxy-composer-tint, 0.18) * 100%), transparent);
    }
  }

  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .dsh-galaxy-frost { background: rgba(6, 8, 16, 0.92); }
    .dsh-galaxy-scene[data-galaxy-composer] [data-composer-card]::before { background: rgba(6, 8, 16, 0.92); }
  }
`;

const STYLE_ID = 'dsh-galaxy-background-styles';

export function ensureSceneStyles() {
  let element = document.getElementById(STYLE_ID);
  if (!element) {
    element = document.createElement('style');
    element.id = STYLE_ID;
    element.textContent = SCENE_STYLE;
    document.head.appendChild(element);
  }
  return element;
}

export function mountScenes(store) {
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

    const frost = document.createElement('div');
    frost.className = 'dsh-galaxy-frost';
    frost.setAttribute('aria-hidden', 'true');

    const previousPosition = scene.style.position;
    if (getComputedStyle(scene).position === 'static') scene.style.position = 'relative';
    scene.prepend(canvas);
    canvas.after(frost);
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
        frost.hidden = true;
        if (engine) {
          engine.destroy();
          engine = null;
        }
        return;
      }

      canvas.hidden = false;
      canvas.style.opacity = String(config.opacity);

      scene.style.setProperty('--dsh-galaxy-tint', String(config.chatTint));
      scene.style.setProperty('--dsh-galaxy-blur', `${config.chatBlur}px`);
      scene.style.setProperty('--dsh-galaxy-composer-tint', String(config.composerTint));
      scene.style.setProperty('--dsh-galaxy-composer-blur', `${config.composerBlur}px`);
      scene.toggleAttribute('data-galaxy-composer', config.composerGlass);
      frost.hidden = config.chatBlur <= 0 && config.chatTint <= 0;

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
        frost.remove();
        scene.style.position = previousPosition;
        scene.style.removeProperty('--dsh-galaxy-tint');
        scene.style.removeProperty('--dsh-galaxy-blur');
        scene.style.removeProperty('--dsh-galaxy-composer-tint');
        scene.style.removeProperty('--dsh-galaxy-composer-blur');
        scene.classList.remove('dsh-galaxy-scene');
        scene.removeAttribute('data-galaxy-composer');
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
