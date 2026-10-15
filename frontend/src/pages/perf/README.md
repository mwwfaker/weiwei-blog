# pages/perf —— 绩效计算器

`/perf` 是独立的全屏工具页（走 AppShell 的 `tool-mode`，没有博客侧栏与顶栏），给审核小组算月度绩效：
录入每个人的「实际 AHT / 审核量」，按队列 KPI 推单价，算出工资。

| 文件 | 作用 |
| --- | --- |
| `PerfPage.vue` | 只做接线与共享状态（原 2424 行的单个 SFC，现在脚本 + 模板 + 零样式）：持有 members / entries / queues / constants / month / tab 等，管本机存储与云端同步 |
| `components/` | 一个视觉板块一个组件：工具条、只读提示、数据总览、员工名单、队列 KPI、可视化、单日计算、导入、计算说明（详见该目录 README） |
| `composables/` | 成组逻辑：云端同步、可视化统计、导入识别、导出、单日计算、氛围层、格式化（详见该目录 README） |
| `perf.css` | 这一页的全部样式（原 `<style scoped>` 的内容原样搬出，已成全局） |

## 状态放在哪

- **PerfPage.vue**：`members` / `entries` / `queues` / `constants` / `month` / `tab`，录入视图
  （`entryView`、`pickerQuery`、`activeQueue`、`activeMemberId`、`showTriple`），名单批量框、
  `queueForm`、`highlightedQueue`。子组件**不重新赋值这些数组**，一律 emit 回 PerfPage——
  改动要连着 localStorage 与 800ms 防抖的云端保存一起走。
- **composables**：`usePerfCloud`（公开列表 + 写回 + 只读判定）、`usePerfViz`（纯派生统计）、
  `usePerfImport`（识别结果要跨标签页活着，所以挂在页面这一层）、`usePerfExport`、`usePerfAura`。
- **面板内部**：只有单个板块用的局部状态才跟着组件走——`PerfDailyPanel` 的当天数据
  （`usePerfDaily`）、`PerfImportPanel` 的拖拽悬停标记。

## 样式为什么是全局的

模板拆进子组件后 `[data-v-xxx]` 不会跟着元素走，scoped 样式会整片失效，所以把样式块**一字未改**地
搬到 `perf.css`，再由 `PerfPage.vue` 自己 `import './perf.css'` —— **只此一处**，
`styles/index.css` 里不再挂它，不要两处都写。

**为什么挂组件而不是挂全局入口**：绩效页是按需加载的（`app/pageRegistry.js` 里的
`defineAsyncComponent`），样式跟着这一页进同一个异步 chunk，首屏就不会白白多下载 36 kB CSS。
挂到 `styles/index.css` 上的话它会进首屏包——这一点在重构时踩过一次，已经改回来。

安全性：绩效页模板用到的类名与全局样式表零重叠；去 scoped 之后所有 perf 规则统一少了那个
`[data-v-x]` 属性选择器，规则之间的相对优先级不变，也没有全局类选择器会来抢这些元素。

残留影响：`perf.css` 里有 67 个「选择器入口」类名没有 `perf-` 前缀（`.viz-*`、`.matrix-*`、`.pk-*`、
`.queue-*`、`.shot-*`、`.bar-col`、`.cell-label`、`.rank-badge`、`.rank-col` 等），它们现在进了全局
命名空间。已逐个核对：只有 `.accent`、`.wide` 也出现在 `study/StudyPage.vue`，而 perf.css 里它们只以
`.perf-stat.accent`、`.perf-cell.wide`、`.viz-card.wide` 出现，必须同时带上 perf 自己的类名才生效，
不会串色。**以后别在其他页面复用上面这些名字。**

## 重构时补上的三个既有 bug

拆分之后跑新的 `verify-frontend.mjs` 时发现，这三个标识符**在原 `PerfPanel.vue` 里就从来没有定义过**
（旧的 verify 只检查 `App.vue`，所以一直没被发现）。它们都是「模板引用了不存在的变量」，
Vue 只会渲染成空白、点击时静默失败，不会报错。已经补上：

| 标识符 | 原来的表现 | 现在的实现 |
| --- | --- | --- |
| `filledCount` | 「按队列」里的「已填 N」永远是空的 | `PerfEntryPanel` 里按 `queueRows` 数出「填了审核量的人数」 |
| `resetQueues` | 队列 KPI 的「恢复默认」点了没反应 | emit 给 `PerfPage.resetQueues()`，恢复内置队列（**带确认框**，自己加的队列会被移除） |
| `resetConstants` | 计算说明的「恢复默认」点了没反应 | emit 给 `PerfPage.resetConstants()`，恢复内置计算常数（带确认框） |

`npm run verify` 的第 [1] 项现在会挡住这一类问题：任何模板标识符只要在 `<script setup>` 里找不到定义就会报错。
