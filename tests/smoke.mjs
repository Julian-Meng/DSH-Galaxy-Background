// M1 contract test: load the browser module with stubbed browser globals and a
// stubbed Cordis context, then check that the bundle wires the Settings seat and
// the scene mount path without throwing.
//
// This is a wiring test, not visual verification.
// Run: node tests/smoke.mjs
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function element(tag) {
  return {
    tagName: String(tag).toUpperCase(),
    className: '',
    textContent: '',
    hidden: false,
    isConnected: true,
    style: {
      position: '',
      opacity: '',
      setProperty() {},
      removeProperty() {},
    },
    classList: { add() {}, remove() {} },
    setAttribute() {},
    removeAttribute() {},
    hasAttribute() {
      return false;
    },
    prepend() {},
    after() {},
    remove() {},
    appendChild() {},
    getBoundingClientRect: () => ({ width: 800, height: 600 }),
    querySelectorAll: () => [],
    matches: () => false,
  };
}

const storage = new Map();
const windowStub = {
  __ModuleLoader__: { load: (definition) => (windowStub.__definition = definition) },
  localStorage: {
    getItem: (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, String(value)),
  },
  addEventListener() {},
  removeEventListener() {},
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  setTimeout,
  clearTimeout,
  devicePixelRatio: 2,
  innerWidth: 1600,
  innerHeight: 900,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};

const documentStub = {
  head: element('head'),
  body: element('body'),
  documentElement: element('html'),
  hidden: false,
  getElementById: () => null,
  createElement: (tag) => element(tag),
  querySelectorAll: () => [],
  addEventListener() {},
  removeEventListener() {},
};

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useReducer: (reducer, initial) => [initial, () => {}],
  useEffect: () => {},
  useRef: (initial) => ({ current: initial }),
};

const registrations = [];
const effects = [];

const ctx = {
  get: () => undefined,
  effect(callback) {
    const disposer = callback();
    effects.push(disposer);
    return () => {};
  },
  slots: {
    inject(slot, callback) {
      ctx.__slot = slot;
      callback();
      return () => {};
    },
    register(options, component) {
      registrations.push({ slot: ctx.__slot, options, component });
      return () => {};
    },
  },
};

const sandbox = {
  window: windowStub,
  document: documentStub,
  localStorage: windowStub.localStorage,
  getComputedStyle: () => ({ position: 'static' }),
  MutationObserver: class {
    observe() {}
    disconnect() {}
  },
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  },
  IntersectionObserver: class {
    observe() {}
    disconnect() {}
  },
  requestAnimationFrame: windowStub.requestAnimationFrame,
  cancelAnimationFrame: windowStub.cancelAnimationFrame,
  console,
  setTimeout,
  clearTimeout,
  queueMicrotask,
  Math,
  JSON,
  Object,
  String,
  Number,
  Array,
  Set,
  Map,
  Error,
  Float32Array,
  parseInt,
};
vm.createContext(sandbox);
vm.runInContext(readFileSync(join(root, 'client.js'), 'utf8'), sandbox, { filename: 'client.js' });

const definition = windowStub.__definition;
assert.ok(definition, 'client.js must call window.__ModuleLoader__.load');
assert.equal(definition.id, 'dsh-galaxy-background', 'module id must equal the package name');
assert.equal(typeof definition.factory, 'function', 'factory must be a function');

const plugin = definition.factory((name) => {
  if (name === 'react') return React;
  throw new Error(`unexpected require: ${name}`);
});

assert.ok(Array.isArray(plugin.inject) && plugin.inject.includes('slots'), 'client plugin must inject slots');
assert.equal(typeof plugin.apply, 'function', 'client plugin must export apply');

plugin.apply(ctx);

const section = registrations.find((entry) => entry.slot === 'settings.section');
assert.ok(section, 'a settings.section entry must be registered');
assert.equal(section.options.id, 'galaxy-background');
assert.equal(section.options.order, 60);
assert.equal(typeof section.options.label, 'function', 'label must be a locale thunk');

const tree = section.component({ close() {} });
assert.ok(tree && tree.type === 'div', 'settings page must render a container');
assert.ok(Array.isArray(tree.children) && tree.children.length >= 2, 'settings page must render title and body');

// Package resource wiring: icon is the single requested asset, locale files exist.
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
assert.equal(manifest.icon, './deepseek.svg', 'package icon must be deepseek.svg');
assert.equal(manifest.exports['./icon'], './deepseek.svg', './icon must export deepseek.svg');
assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
assert.ok(existsSync(join(root, 'deepseek.svg')), 'deepseek.svg must exist');
for (const locale of ['en', 'zh']) {
  const dict = JSON.parse(readFileSync(join(root, 'locale', `${locale}.json`), 'utf8'));
  assert.ok(dict.meta && dict.meta.title && dict.meta.description, `locale/${locale}.json needs meta.title/description`);
}
assert.ok(existsSync(join(root, 'cordis.patch.yml')), 'cordis.patch.yml must exist');

for (const dispose of effects) {
  if (typeof dispose === 'function') dispose();
}

console.log(`ok — ${registrations.length} slot registration(s), settings page renders ${tree.children.length} blocks`);
