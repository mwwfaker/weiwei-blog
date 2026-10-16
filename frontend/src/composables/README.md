# `src/composables/` — 组合式函数

只放**能被任意组件复用**的 Vue 逻辑。只服务某一个页面的逻辑跟着那个页面走
（例如绩效页的录入逻辑就在 `src/pages/perf/`）。

| 文件 | 导出 | 说明 |
| --- | --- | --- |
| `motion.js` | `vReveal` | 滚动揭示指令。隐藏态由 JS 添加而不是写在 CSS 里，所以脚本没跑起来时内容照常可见，不会卡在 `opacity:0`。 |
| | `useCountUp` | 数字从 0 滚到目标值。起始值就是真实值，SSR 和渲染测试不会显示错数字。 |
| | `prefersReducedMotion` | 是否开启了「减少动态效果」。 |
| `useBulkImport.js` | `useBulkImport` | 批量导入的共用状态机：草稿列表、统一设置、逐条微调、确认写库（allSettled + 进度 + 失败项留存）。日记导入和文章导入**共用这一个**。 |
| `useDustClose.js` | `useDustClose` / `ENTER_MS` / `DUST_HOLD_MS` / `DUST_MS` | 关闭时的「先定住一拍，再化作尘埃」：量目标位置、铺粒子、等动画跑完再 `emit('close')`。阅读弹窗与全屏看图**共用这一个**。 |

## 「化作尘埃」为什么连时序也一起抽出来

粒子层（`modules/modal/DustBurst.vue`）本来就是复用件，但真正容易出错的是它外面那套时序：
量出目标位置 → 先定住一拍（180ms）→ 等粒子飞完（1320ms）再通知调用方关闭。
三个数字里只要有一个两边写得不一样，症状都是「粒子还在飞，组件已经被摘掉了」——
而且只在自己那处看得见。所以时长常量、`prefers-reduced-motion` 的判断、
量不到位置时的兜底全都收在 `useDustClose.js` 里，CSS 那边用 `--dust-ms` 接收，
不另写一遍数字。

### 踩过的坑：选项名把 import 的名字遮住了

`useDustClose` 的选项里有一个 `motion`（是否播放动效），而它同时要 import
`composables/motion.js` 那个聚合对象。**参数会遮蔽同名的模块级 import**，
于是 `motion.prefersReducedMotion()` 实际是在布尔值上取方法 →
`TypeError: motion.prefersReducedMotion is not a function`。

症状特别隐蔽：**点关闭毫无反应，页面上什么都不显示**，只有控制台一行 TypeError；
构建、12 项结构检查、SSR 渲染冒烟全是绿的，因为那一行只在用户点关闭时才执行。
所以 import 改名为 `motionHelpers`，并且 `ssr-smoke` 里加了一条真的去调
`requestClose()` 的探针（见 `ssr-smoke/README.md`）——**这类 bug 只能靠「真的点一下」抓**。

## 批量导入为什么抽出来

日记导入和文章导入的流程**一模一样**：解析成一批草稿 → 逐条核对、统一设置 → 确认后逐条写库，
写入期间禁用按钮、用 `allSettled` 保住已经写成功的那些、只留下失败的可以重试。
抄第二遍就是两份要同步维护的代码，改一处必漏另一处。

边界：它**不管解析文件**（docx/txt 的读法两边不同，而且只有浏览器里能做），
调用方解析完把草稿交给 `setReview()` 即可。写库动作由 `save` 回调注入，
所以它对「日记」还是「文章」一无所知。

## `v-reveal` 是局部注册的

用它的组件要自己 `import { vReveal } from '@/composables/motion'`。**没有全局注册**，这是刻意的：
渲染测试会单独挂载组件（例如只挂 `LyricsPanel`），那时没有全局指令可用。
`npm run verify` 的第 [2] 项会检查每个 `v-*` 自定义指令是否在自己组件里 import 了。
