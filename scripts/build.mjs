// Zero-dependency bundler: joins src/*.js ES modules into the single browser
// artifact DSH loads (client.js). Supports the subset the plugin uses:
//   import { a, b } from './relative.js'   (named, one line)
//   export function / export const|let|var / export class / export { ... }
// External 'react' is delegated to the module loader's require.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const ENTRY = 'src/main.js';
const OUT = 'client.js';

const IMPORT_RE = /^import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"];?[ \t]*$/gm;

const modules = new Map();

function resolveId(from, spec) {
  const parts = from.split('/');
  parts.pop();
  for (const segment of spec.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') parts.pop();
    else parts.push(segment);
  }
  return parts.join('/');
}

function load(id) {
  if (modules.has(id)) return;
  const source = readFileSync(join(root, id), 'utf8');
  modules.set(id, source);
  for (const match of source.matchAll(IMPORT_RE)) {
    const spec = match[2];
    if (spec.startsWith('.')) load(resolveId(id, spec));
  }
}

function transform(id, source) {
  const exported = [];

  let body = source.replace(IMPORT_RE, (_all, names, spec) => {
    const list = names
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean)
      .map((name) => {
        const parts = name.split(/\s+as\s+/);
        return parts.length === 2 ? `${parts[0].trim()}: ${parts[1].trim()}` : name;
      });
    return `const { ${list.join(', ')} } = require(${JSON.stringify(spec)});`;
  });

  body = body.replace(/^export\s+(async\s+)?function\s+([A-Za-z_$][\w$]*)/gm, (_all, asyncKw, name) => {
    exported.push(name);
    return `${asyncKw || ''}function ${name}`;
  });

  body = body.replace(/^export\s+class\s+([A-Za-z_$][\w$]*)/gm, (_all, name) => {
    exported.push(name);
    return `class ${name}`;
  });

  body = body.replace(/^export\s+(const|let|var)\s+([A-Za-z_$][\w$]*)/gm, (_all, keyword, name) => {
    exported.push(name);
    return `${keyword} ${name}`;
  });

  body = body.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (_all, names) => {
    for (const raw of names.split(',')) {
      const name = raw.trim();
      if (!name) continue;
      const parts = name.split(/\s+as\s+/);
      exported.push(parts[parts.length - 1].trim());
    }
    return '';
  });

  const tail = exported.map((name) => `exports.${name} = ${name};`).join('\n');
  const banner = `// ---- ${id} ----`;

  return `${banner}\n__modules[${JSON.stringify(id)}] = function (module, exports, require) {\n${body}\n${tail}\n};\n`;
}

if (!existsSync(join(root, ENTRY))) {
  console.error(`entry not found: ${ENTRY}`);
  process.exit(1);
}
load(ENTRY);

const bundle = [...modules.keys()]
  .sort()
  .map((id) => transform(id, modules.get(id)))
  .join('\n');

const header = `/*!
 * dsh-galaxy-background — generated bundle, do not edit by hand.
 * Sources live in src/; rebuild with: node scripts/build.mjs
 * Modules: ${modules.size}
 */
`;

const output = `${header}window.__ModuleLoader__.load({
  id: 'dsh-galaxy-background',
  factory(require) {
    'use strict';

    const __modules = Object.create(null);
    const __cache = Object.create(null);

    function __resolve(from, spec) {
      const parts = from.split('/');
      parts.pop();
      for (const segment of spec.split('/')) {
        if (segment === '' || segment === '.') continue;
        if (segment === '..') parts.pop();
        else parts.push(segment);
      }
      return parts.join('/');
    }

    function __require(spec, from) {
      if (spec === 'react') return require('react');
      const id = __resolve(from, spec);
      const factory = __modules[id];
      if (!factory) throw new Error('[dsh-galaxy-background] module not bundled: ' + id);
      if (__cache[id]) return __cache[id].exports;
      const module = { exports: {} };
      __cache[id] = module;
      factory(module, module.exports, (next) => __require(next, id));
      return module.exports;
    }

${bundle}
    return __require(${JSON.stringify(ENTRY)}, '');
  },
});
`;

writeFileSync(join(root, OUT), output, 'utf8');
console.log(`built ${OUT}: ${modules.size} modules, ${output.length} bytes`);
