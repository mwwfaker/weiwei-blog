# pages/perf/components —— 绩效页的板块组件

一个视觉板块一个 `.vue`，**只在绩效页内部用**，不是通用模块。组件里不写 `<style scoped>`：
这一页的样式统一在 `../perf.css`（全局，由 `styles/index.css` @import 接入）。

| 文件 | 负责的板块 | 交互方式 |
| --- | --- | --- |
| `PerfToolbar.vue` | 顶部工具条 `.perf-bar`：月份、数据来源、同步状态、导出、返回 | props + `update:month` / `select` / `export` / `back` |
| `PerfReadonlyNote.vue` | 公开只读提示 `.perf-readonly-note` | props，由 PerfPage 用 `v-if="readOnly"` 控制出现 |
| `PerfEntryPanel.vue` | 「数据总览」：左侧清单 + 右侧单人详情 / 队列总览两张表 | 5 个 `v-model`（视图与选中对象）+ 行数据 props，`set-cell` / `go-tab` 上抛 |
| `PerfRosterPanel.vue` | 「员工名单」：姓名邮箱、月要求工时、抽调/加班/三薪、批量粘贴 | 3 个 `v-model` + `members`/`rowByMember`，增删改 emit |
| `PerfQueuesPanel.vue` | 「队列 KPI」：队列名与 KPI、标准 AHT / 单价 / 当月小计 | `queues`/`summary` 等 props，新增/删除 emit（`queueForm` 直接改，因为是面板自己的表单） |
| `PerfVizPanel.vue` | 「数据可视化」：关键指标、薪资构成、队列分布、矩阵、散点、相对均值、排序明细 | 全是 usePerfViz 算好的 props + `rankBy` 一个 `v-model` |
| `PerfDailyPanel.vue` | 「单日计算」：对应文档表一，独立于月度数据 | 只收 `queues`/`constants`，内部用 `usePerfDaily` 自己持有当天状态 |
| `PerfImportPanel.vue` | 「导入截图」：选队列、上传/粘贴/拖拽、核对、写入 | 2 个 `v-model` + 识别结果 props，`pick-file` / `parse` / `apply` / `cancel` 上抛 |
| `PerfAboutPanel.vue` | 「计算说明」+ 可调常数 + 数据存放（页面最末） | `constants` 就地编辑（改的是对象的属性，不是 prop 本身） |

约定：面板**不重新赋值** `members` / `entries` / `queues` 这些数组（那是 PerfPage 的事，要配本地存储与云端保存），
只 emit 意图；`v-model` 用在视图/搜索词/选中对象这类纯 UI 状态上。
