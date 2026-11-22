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
