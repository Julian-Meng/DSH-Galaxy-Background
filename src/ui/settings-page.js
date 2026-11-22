import { createElement as h, useEffect, useReducer, useState } from 'react';
import { Group, Row, RangeSlider, Switch, FireSlider } from './controls.js';

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

export function createSettingsPage(store, t, ctx) {
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
