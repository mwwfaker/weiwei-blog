# `src/composables/` — 组合式函数

只放**能被任意组件复用**的 Vue 逻辑。只服务某一个页面的逻辑跟着那个页面走
（例如绩效页的录入逻辑就在 `src/pages/perf/`）。

| 文件 | 导出 | 说明 |
| --- | --- | --- |
| `motion.js` | `vReveal` | 滚动揭示指令。隐藏态由 JS 添加而不是写在 CSS 里，所以脚本没跑起来时内容照常可见，不会卡在 `opacity:0`。 |
| | `useCountUp` | 数字从 0 滚到目标值。起始值就是真实值，SSR 和渲染测试不会显示错数字。 |
| | `prefersReducedMotion` | 是否开启了「减少动态效果」。 |

## `v-reveal` 是局部注册的

用它的组件要自己 `import { vReveal } from '@/composables/motion'`。**没有全局注册**，这是刻意的：
渲染测试会单独挂载组件（例如只挂 `LyricsPanel`），那时没有全局指令可用。
`npm run verify` 的第 [2] 项会检查每个 `v-*` 自定义指令是否在自己组件里 import 了。
