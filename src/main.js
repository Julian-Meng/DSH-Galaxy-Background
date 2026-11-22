import { createStore, STORAGE_KEY } from './config.js';
import { createTranslator } from './i18n.js';
import { mountScenes } from './scene.js';
import { createSettingsPage } from './ui/settings-page.js';
import { ensureSettingsStyles } from './ui/styles.js';

const SETTINGS_ID = 'galaxy-background';

export function apply(ctx) {
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

export const inject = ['slots'];
