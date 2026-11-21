# DSH 星系背景

[English](docs/README_EN.md) | 中文

在 DSH 对话面板背后绘制动态螺旋星系的壁纸插件。星系参数与 shader 数学来自
`Julian-Meng.github.io` 的 three.js 场景，改写为裸 WebGL 实现，因此**没有运行时依赖**：
不需要 three.js、不需要打包器、不加载 CDN。

## 特性

- 五层恒星分布：核球、薄盘、厚盘、旋臂、晕与外盘。
- 差速旋转与独立的旋臂模式速度，都在 vertex shader 中计算。
- 暖色核心、冷色旋臂、软边点精灵、加法混合，以及轻微闪烁的背景星空。
- 按对话面板挂载（依赖 DSH 稳定的 `data-*` 契约），正文层在 canvas 之上，canvas 不拦截
  鼠标事件。
- 面板离开视口或窗口隐藏时暂停渲染；`prefers-reduced-motion` 下冻结动画。
- 图标位统一使用 `deepseek.svg`（插件图标与设置页导航图标）。

## 环境要求

- DSH Desktop 或 DSH Web，Chromium 内核且支持 WebGL 2。
- 从 GitHub 安装时，系统里需要有 `git`。

## 安装

**从 GitHub 安装**

1. 打开 **设置 → 插件 → 添加插件**。
2. 填入仓库地址，例如 `https://github.com/Julian-Meng/DSH-Galaxy-Background`。
3. 启用 `Galaxy background`，然后重载页面或重启应用。

**从本地目录安装**

在「添加插件」里选择该目录，或执行：

```text
plugin_manager action=install_bundle target="<本目录的绝对路径>"
```

浏览器模块按「代际」加载：修改 `client.js` 后，需要重装插件或重启桌面端才会加载新代码。

## 配置

| 分组 | 键 |
| --- | --- |
| 星系 | `enabled`、`particleCount`、`branches`、`spin`、`radius`、`backgroundStars` |
| 外观 | `opacity`、`starSize`、`exposure` |
| 运动 | `speed`、`parallax`、`cameraTilt`、`cameraDistance` |
| 行为 | `showOnHome`、`pauseWhenHidden`、`respectReducedMotion` |

配置持久化在 `localStorage` 的 `dsh-galaxy-background:v1` 下。

## 目录结构

| 路径 | 作用 |
| --- | --- |
| `package.json` | 插件清单：`dsh.bundle.patch` + `dsh.client` |
| `cordis.patch.yml` | 插入插件行 |
| `index.js` | Host 半边（`apply() {}`） |
| `client.js` | 浏览器模块：恒星采样、WebGL 引擎、场景挂载、设置页座位 |
| `locale/*.json` | 插件标题与描述 |
| `deepseek.svg` | 图标资源 |
| `tests/smoke.mjs` | 模块契约测试 |

## 开发

```text
node --check client.js
node tests/smoke.mjs
```

## 许可

WTFPL，见 [LICENSE](LICENSE)。星系参数与 shader 数学改编自作者本人的
`Julian-Meng.github.io` 场景。
