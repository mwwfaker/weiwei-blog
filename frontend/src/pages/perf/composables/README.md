# pages/perf/composables —— 绩效页的成组逻辑

从原来 2424 行的 `PerfPage.vue` 脚本里按「一组一起用」拆出来的，逻辑一行没改，
只是把外面的 `ref` 改成参数传进去（这样 PerfPage 只负责接线）。

| 文件 | 负责什么 |
| --- | --- |
| `usePerfCloud.js` | 云端同步：读公开工作区列表、800ms 防抖写回、`readOnly` / 同步状态文案。读写的是传进来的 `members`/`entries`/`queues`/`checkHours` |
| `usePerfViz.js` | 「数据可视化」的全部统计：排名、关键指标、薪资构成、队列分布、矩阵、散点、相对均值。纯派生，无状态 |
| `usePerfImport.js` | 「导入截图」的识别与写入：文本/图片解析、匹配名单、写入 entries；`Ctrl+V` 监听也挂在这里（整页只注册一次，回调里判断当前是不是导入页） |
| `usePerfExport.js` | 导出 Excel：全组总表 + 每人一张明细表，`xlsx` 按需 import |
| `usePerfReset.js` | 四组「重置数据」：只清当月数据、保留名单结构。**唯一被 `verify-perf.mjs` 离线对拍的一个**——「该清的清了、该保留的还留着」不会报错，只能靠断言 |
| `usePerfDaily.js` | 「单日计算」的当天数据、当天口径的行与合计；由 `PerfDailyPanel` 自己实例化（状态只被那一块用） |
| `usePerfAura.js` | 氛围层：跟着指针走的那团柔光。只算 transform，按帧合并一次；模板里的两个元素仍在 PerfPage |
| `format.js` | 全页共用的格式化：`money` / `price` / `percent` / `hoursText` / `compact` / `pctText` |
| `rows.js` | 员工 × 队列的取数辅助：`queueListOf`（可视化明细与导出共用）、`rowAvgAht` |

约定：composable 只接收 `ref` / `computed` 或 `toRef(props, …)`，不接收裸值——
否则父级的 computed 重新求值（例如删队列时 `queues.value` 被换掉）后就会读到旧引用。

## 什么该抽成 composable

不是「行数多就抽」。上面这些的共同点是**它们各自是一整块可以独立说明的逻辑**：
有自己的一组输入、一组输出、以及一条能写清楚的边界。

`usePerfReset.js` 是后加的，它多满足一条：**抽出来之后可以被离线测试**。
重置这类「清数据」的动作出错时不会抛异常（清多了丢数据、清少了没效果都不报错），
所以它们比公式更需要断言。现在 `npm run verify:perf` 的 `[10]` 一节会对着它跑 30 条断言。

判据放在这里，是为了下次加东西时能照着判断：**如果一个动作组只能用肉眼看，先想想能不能
把它挪到一个能传参数进去的地方。**
