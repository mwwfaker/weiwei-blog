# `pages/home/components/` — 首页的两套主视觉

| 文件 | 内容 |
| --- | --- |
| `HeroScene.vue` | 夜：three.js 舞台（液态背景、粒子字、日记星体、拖拽/悬停/点击、滚动镜头） |
| `heroStage.js` | GLSL 与纯几何工具（字形采样、星尘、贴图）。**不 import three** |
| `heroParticles.js` | 粒子字与星尘的创建、每帧模拟与点击冲量 |
| `heroStars.js` | 日记星体与屏幕空间拾取 |
| `DayGlass.vue` | 昼：玻璃光学的整页版面、指针光斑与玻璃倾斜（纯 DOM/CSS，无 WebGL） |

## 边界

- three 只在 `HeroScene.vue` 挂载时动态 import；其余文件只使用传进来的命名空间。
- `HeroScene` 与 `DayGlass` 都只读 store 的数据、调 store 的方法，不直接请求接口。
- 样式不在这里：夜在 `styles/home-stage.css`，昼在 `styles/home-day.css`。
