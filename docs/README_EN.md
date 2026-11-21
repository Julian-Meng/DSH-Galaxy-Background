# DSH Galaxy Background

English | [中文](../README.md)

An animated spiral-galaxy wallpaper for the DSH conversation panel. The galaxy
parameters and shader math come from the three.js scene on
`Julian-Meng.github.io` and are reimplemented on raw WebGL, so the plugin has **no
runtime dependencies**: no three.js, no bundler, no CDN.

## Features

- Five star regions: bulge, thin disk, thick disk, spiral arms, halo and outer rim.
- Differential rotation and a separate spiral-arm pattern speed, evaluated in the
  vertex shader.
- Warm core, cool arms, soft point sprites, additive blending and a twinkling
  background starfield.
- Mounted per conversation panel through stable `data-*` attributes; the transcript
  stays above the canvas, which never captures pointer events.
- Rendering pauses when a panel leaves the viewport or the window is hidden, and
  freezes under `prefers-reduced-motion`.
- A single icon asset, `deepseek.svg`, used for the plugin icon and the Settings
  navigation glyph.

## Requirements

- DSH Desktop or DSH Web on a Chromium-based runtime with WebGL 2.
- `git` on the machine when installing from GitHub.

## Install

**From GitHub**

1. Open **Settings → Plugins → Add plugin**.
2. Enter the repository URL, for example
   `https://github.com/Julian-Meng/DSH-Galaxy-Background`.
3. Enable the `Galaxy background` row, then reload the page or restart the app.

**From a local checkout**

Point **Add plugin** at the checkout directory, or run:

```text
plugin_manager action=install_bundle target="<absolute path to this checkout>"
```

The browser module is loaded per generation: after editing `client.js`, reinstall the
bundle or restart the desktop app to load the new build.

## Configuration

| Group | Keys |
| --- | --- |
| Galaxy | `enabled`, `particleCount`, `branches`, `spin`, `radius`, `backgroundStars` |
| Appearance | `opacity`, `starSize`, `exposure` |
| Motion | `speed`, `parallax`, `cameraTilt`, `cameraDistance` |
| Behavior | `showOnHome`, `pauseWhenHidden`, `respectReducedMotion` |

Values persist in `localStorage` under `dsh-galaxy-background:v1`.

## Structure

| Path | Purpose |
| --- | --- |
| `package.json` | Bundle manifest: `dsh.bundle.patch` + `dsh.client` |
| `cordis.patch.yml` | Inserts the plugin row |
| `index.js` | Host half (`apply() {}`) |
| `client.js` | Browser module: galaxy sampler, WebGL engine, scene mounting, Settings seat |
| `locale/*.json` | Plugin title and description |
| `deepseek.svg` | Icon asset |
| `tests/smoke.mjs` | Module contract test |

## Development

```text
node --check client.js
node tests/smoke.mjs
```

## License

WTFPL — see [LICENSE](../LICENSE). Galaxy parameters and shader math are adapted from
the author's own `Julian-Meng.github.io` scene.
