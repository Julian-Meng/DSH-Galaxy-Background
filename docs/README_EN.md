# DSH Galaxy Background

English | [中文](../README.md)

An animated spiral-galaxy wallpaper for the DSH conversation panel. The galaxy
parameters and shader math are ported from the three.js scene on
`Julian-Meng.github.io` and rewritten on raw WebGL, so the plugin has **no runtime
dependencies**: no three.js, no bundler, no CDN.

> Status: **v0.1.0, M1 renderer**. The wallpaper runs behind each conversation panel
> (WebGL 2, 120k stars by default, differential rotation, background starfield). The
> Settings page is still a placeholder (M2) and the frosted-glass layer is not
> implemented yet (M3) — until then the transcript sits directly on the wallpaper, so
> bright regions can hurt readability.

## Features

- Five star regions with the reference density profile: bulge, thin disk, thick disk,
  spiral arms, halo and outer rim.
- Differential rotation and a separate arm pattern speed, both evaluated in the vertex
  shader, so inner stars orbit faster and the arms behave as a density wave.
- Warm core and cool arms, soft point sprites, additive blending, and a twinkling
  background starfield.
- Mounted per conversation panel through stable `data-*` attributes; the transcript is
  lifted above the canvas, which stays click-through.
- Rendering pauses when a panel scrolls out of view or the window is hidden, and freezes
  under `prefers-reduced-motion`.
- The only icon asset is `deepseek.svg`, used for the bundle icon, the `./icon` export
  and the Settings navigation glyph.

## Requirements

- DSH Desktop or DSH Web on a Chromium/Electron runtime with WebGL 2 (verified on
  `dsh-desktop-next 2.0.24-next`, `@deepseek-ai/dsh 0.2.2-rc.5`).
- A local `git` installation when installing from GitHub.

## Install

**From GitHub** (once the repository is published):

1. **Settings → Plugins → Add plugin**.
2. Enter `https://github.com/Julian-Meng/DSH-Galaxy-Background` (or
   `github:Julian-Meng/DSH-Galaxy-Background`).
3. Enable the `Galaxy background` row, then reload the page or restart the app so the
   new browser module generation is loaded.

The repository must be public; DSH checks it with `git ls-remote` before installing and
falls back from HTTPS to SSH when needed.

**From a local checkout**: point **Add plugin** at this directory, or use

```text
plugin_manager action=install_bundle target="D:\Codes\Web\DSH-Galaxy-Background"
```

The plugin reloads its browser module per generation: after editing `client.js`, remove
and reinstall the bundle (or restart the desktop app) before expecting the page to show
the new build.

## Configuration

| Group | Keys | Notes |
| --- | --- | --- |
| Galaxy | `enabled`, `particleCount` (20k–300k), `branches` (2–8), `spin` (0.1–2), `radius` (4–14), `backgroundStars` | structural changes rebuild the point cloud |
| Appearance | `opacity` (0–1), `starSize` (0.3–2.5), `exposure` (0.2–3) | live |
| Motion | `speed` (0–2), `parallax` (0–1), `cameraTilt` (5–85°), `cameraDistance` (6–30) | live |
| Glass (M3) | `chatBlur`, `chatTint`, `composerGlass`, `composerBlur` | reserved; not applied yet |
| Behavior | `showOnHome`, `pauseWhenHidden`, `respectReducedMotion` | live |

In v0.1.0 the Settings page is a placeholder, so the defaults are defined in `FIELDS`
inside `client.js` and changes require editing and reinstalling. Values persist in
`localStorage` under `dsh-galaxy-background:v1` and sync across tabs; clear that key to
restore the defaults.

## Structure

| File | Purpose |
| --- | --- |
| `package.json` | Bundle manifest: `dsh.bundle.patch` + `dsh.client` (`platform: web`) |
| `cordis.patch.yml` | Inserts the `galaxy-background` plugin row |
| `index.js` | Host half, `apply() {}` — only makes DSH discover the browser module |
| `client.js` | Browser module: sampler, WebGL engine, scene mounting, Settings seat, locale |
| `locale/*.json` | Plugin Manager title and description |
| `deepseek.svg` | The only icon asset |
| `tests/smoke.mjs` | Contract test: module id, factory, slot registration, resource wiring |
| `docs/README_EN.md` | This document |

## Development

```powershell
$node = 'C:\Users\Yuan\.dsh\dsh-runtimes\dsh-next-primary-runtime\dependencies\node\bin\node.exe'
& $node --check client.js
& $node tests/smoke.mjs
```

## Verification

Measured in Chrome 154 headless driven over the DevTools protocol, 1302×853 canvas,
120k particles, SwiftShader software rendering:

- canvas mounted with a WebGL 2 context; no runtime exceptions or `console.error`;
- `pointer-events: none` on the canvas — clicks reach the transcript;
- about 57 fps under software rendering (a real GPU is faster);
- `enabled: false` hides the wallpaper (empty-area bright pixels drop to 0.0000%);
- `showOnHome: false` hides the canvas on the new-session page;
- `prefers-reduced-motion: reduce` freezes the animation (two frames 1.5 s apart differ
  by a mean absolute difference of 0.0022, versus 4.13 with normal motion).

## Limitations

- **Readability**: without the M3 glass layer, text over the bright core band is hard to
  read. Prefer keeping the wallpaper off until M3, or lower `opacity`.
- The wallpaper covers the conversation panel only; the sidebar and title bar keep their
  theme surfaces.
- The canvas paints an opaque deep-space background, so the panel stays dark even in a
  light theme.
- Running another wallpaper plugin on the same panel can stack with this one.

## License

WTFPL — see [LICENSE](../LICENSE). Galaxy parameters and shader math are adapted from the
author's own `Julian-Meng.github.io` scene.
