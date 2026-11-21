# DSH 星系背景

[English](docs/README_EN.md) | 中文

在 DSH 对话面板背后绘制动态螺旋星系的壁纸插件。星系参数与 shader 数学移植自
`Julian-Meng.github.io` 的 three.js 场景，改写为裸 WebGL 实现，因此**没有任何运行时
依赖**：不需要 three.js、不需要打包器、不加载 CDN。

> 状态：**v0.1.0，M1 渲染内核**。壁纸已能在对话面板中运行（WebGL 2、默认 12 万颗恒星、
> 差速旋转、背景星空）。设置页目前是占位（M2 接入控件），磨砂玻璃层尚未实现（M3）——
> 在 M3 之前正文会直接压在星系上，亮区可读性较差。

## 特性

- 五层恒星分布，密度与参考实现一致：核球、薄盘、厚盘、旋臂、晕与外盘。
- 差速旋转与独立的旋臂模式速度都在 vertex shader 中计算：内圈快、外圈慢，旋臂呈密度波
  行为，恒星会穿过旋臂。
- 暖色核心、冷色旋臂、软边点精灵、加法混合，以及轻微闪烁的背景星空。
- 按对话面板挂载（依赖 DSH 稳定的 `data-*` 契约），正文层位于 canvas 之上，canvas 不拦截
  鼠标事件。
- 面板滚出视口或窗口隐藏时暂停渲染；`prefers-reduced-motion` 下冻结动画。
- 图标位统一使用 `deepseek.svg`（插件图标、`./icon` 导出、设置页导航图标）。

## 环境要求

- DSH Desktop 或 DSH Web，Chromium/Electron 内核且支持 WebGL 2（已在
  `dsh-desktop-next 2.0.24-next`、`@deepseek-ai/dsh 0.2.2-rc.5` 上验证）。
- 从 GitHub 安装时，系统里需要有 `git`。

## 安装

**从 GitHub 安装**（仓库发布后）：

1. 打开 **设置 → 插件 → 添加插件**。
2. 填入 `https://github.com/Julian-Meng/DSH-Galaxy-Background`（或
   `github:Julian-Meng/DSH-Galaxy-Background`）。
3. 在插件页启用 `Galaxy background`，然后重载页面或重启应用，让新的浏览器模块代际生效。

仓库需要是公开的；DSH 安装前会用 `git ls-remote` 预检，必要时从 HTTPS 回退到 SSH。

**从本地目录安装**：在「添加插件」里选择本目录，或执行

```text
plugin_manager action=install_bundle target="D:\Codes\Web\DSH-Galaxy-Background"
```

浏览器模块按「代际」加载：修改 `client.js` 后，需要移除并重新安装插件（或重启桌面端），
页面才会用上新代码。

## 配置

| 分组 | 键 | 说明 |
| --- | --- | --- |
| 星系 | `enabled`、`particleCount`（20k–300k）、`branches`（2–8）、`spin`（0.1–2）、`radius`（4–14）、`backgroundStars` | 结构类参数会重建点云 |
| 外观 | `opacity`（0–1）、`starSize`（0.3–2.5）、`exposure`（0.2–3） | 即时生效 |
| 运动 | `speed`（0–2）、`parallax`（0–1）、`cameraTilt`（5–85°）、`cameraDistance`（6–30） | 即时生效 |
| 玻璃（M3） | `chatBlur`、`chatTint`、`composerGlass`、`composerBlur` | 预留，尚未生效 |
| 行为 | `showOnHome`、`pauseWhenHidden`、`respectReducedMotion` | 即时生效 |

v0.1.0 的设置页还是占位，所以默认值写在 `client.js` 的 `FIELDS` 里，修改需要改代码并重装。
配置持久化在 `localStorage` 的 `dsh-galaxy-background:v1` 下，跨标签同步；清除该键即可恢复默认。

## 目录结构

| 文件 | 作用 |
| --- | --- |
| `package.json` | 插件清单：`dsh.bundle.patch` + `dsh.client`（`platform: web`） |
| `cordis.patch.yml` | 插入 `galaxy-background` 插件行 |
| `index.js` | Host 半边 `apply() {}`，只负责让 DSH 发现浏览器模块 |
| `client.js` | 浏览器模块：恒星采样、WebGL 引擎、场景挂载、设置页座位、locale |
| `locale/*.json` | 插件管理器里的标题与描述 |
| `deepseek.svg` | 唯一的图标资源 |
| `tests/smoke.mjs` | 契约测试：模块 id、factory、slot 注册、资源接线 |
| `docs/README_EN.md` | 英文文档 |

## 开发

```powershell
$node = 'C:\Users\Yuan\.dsh\dsh-runtimes\dsh-next-primary-runtime\dependencies\node\bin\node.exe'
& $node --check client.js
& $node tests/smoke.mjs
```

## 验证

在 Chrome 154 无头浏览器中通过 DevTools 协议实测：画布 1302×853、12 万粒子、SwiftShader
软件渲染。

- 画布以 WebGL 2 上下文正常挂载，无运行时异常、无 `console.error`；
- 画布 `pointer-events: none`，点击会落到正文；
- 软件渲染下约 57 fps（真实 GPU 更高）；
- `enabled: false` 时壁纸隐藏（空白区亮像素降至 0.0000%）；
- `showOnHome: false` 时新会话页不显示画布；
- `prefers-reduced-motion: reduce` 会冻结动画（相隔 1.5 秒的两帧平均绝对差 0.0022，
  正常动画时为 4.13）。

## 已知限制

- **可读性**：磨砂层（M3）完成前，正文压在星系亮带上会难以阅读。建议在 M3 前保持关闭，
  或调低 `opacity`。
- 壁纸只覆盖对话面板，侧栏与标题栏保持主题底色。
- 画布绘制的是不透明的深空底色，浅色主题下该面板仍是深色。
- 与其它壁纸类插件同时启用时可能叠加。

## 许可

WTFPL，见 [LICENSE](LICENSE)。星系参数与 shader 数学改编自作者本人的
`Julian-Meng.github.io` 场景。
