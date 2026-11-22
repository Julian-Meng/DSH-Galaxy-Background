import { createElement, useEffect, useRef } from 'react';
import { FIELDS } from '../config.js';
import { FireSliderRenderer } from './fire-slider.js';

export function formatValue(name, value, t) {
  if (name === 'particleCount') return `${Math.round(value / 1000)}k`;
  if (name === 'cameraTilt') return `${Math.round(value)}${t('degree')}`;
  if (name === 'chatBlur' || name === 'composerBlur') return `${Math.round(value)}${t('px')}`;
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

export function Switch(props) {
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

export function Row(props) {
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

export function Group(props) {
  return createElement(
    'section',
    { className: 'dsh-galaxy-group' },
    createElement('h3', { className: 'dsh-galaxy-group-title' }, props.title),
    createElement('div', { className: 'dsh-galaxy-card' }, props.children),
  );
}

export function RangeSlider(props) {
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
export function FireSlider(props) {
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
