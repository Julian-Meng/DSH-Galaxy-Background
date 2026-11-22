// Dictionary registry plus a small fallback so labels work even before the
// locale service answers.
export const LOCALE_NS = 'galaxy-background';

export const MESSAGES = {
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

export function createTranslator(ctx) {
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
