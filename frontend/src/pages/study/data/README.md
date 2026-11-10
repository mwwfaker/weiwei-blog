# `pages/study/data/` — 学习计划的数据

| 文件 | 内容 |
| --- | --- |
| `studyPlan.js` | 金融学那份计划的结构化数据（29 门课 / 5 个阶段 / 资源链接） |
| `scarfPlan.js` | 围巾编织那份计划的结构化数据（17 个单元 / 6 个阶段 / 视频与图解链接） |
| `studyPlans.js` | **计划库**：一份数组，页面从它读；加新学习计划就是往这里加一项 |

## 加一份新计划的方式

复制 `scarfPlan.js` 或 `studyPlan.js` 改成新计划，然后往 `studyPlans.js` 里加一项：

```js
{
  id: 'ielts',                 // 唯一，用来分开存进度
  name: '雅思 7.5 备考路线',
  short: '雅思',                // 计划库那张卡片上的短名
  note: '一句话说明这份计划是什么',
  unit: '个单元',               // 卡片上「17 个单元」的单位；不写默认「门课程」
  plan: ieltsPlan,
}
```

页面上的阶段标签**不是写死的**，是从课程的 `stageLabel` 里长出来的，所以新计划可以有
完全不同的阶段名和数量（`plan.stages` 的顺序要和 `stageLabel` 首次出现的顺序一致）。
进度按 `id` 分开存（`weiwei-blog-study-progress:<id>`），互不干扰。

## 数据结构的硬约束

- `courses[].code` 必须唯一：进度勾选就是按它记的。
- `courses[].stageLabel` 必须和 `stages` 的顺序配对（页面按下标取阶段的 goal / duration）。
- `totals.courses` / `hoursLow` / `hoursHigh` 是页头统计用的，加删课程后记得同步。
- `resources` 里没有链接也可以，页面会退化成一行「按关键词搜索」的提示。

## 内容从哪来

两份都是站主给的 Word 文档结构化而来，**不要在数据里改写原文结论**；
需要修错字或补链接时，改对应课程对象即可。

## 现有计划（2026-11）

| id | 计划 | 数据文件 | 规模 |
| --- | --- | --- | --- |
| `finance` | 金融学系统自学路线 | `studyPlan.js` | 29 门课 / 5 阶段 |
| `finance-priority` | 基金与股票优先的金融学习路线 | `financeOptimizedPlan.js` | 12 周主线 10 门 + 3 门基础 |
| `life` | 高性价比人生指南 | `lifePlan.js` + `lifeIndex.js` + `life/chNN.js` | 34 章 / 772 条 |
| `scarf` | 围巾编织学习大全 | `scarfPlan.js` | 17 单元 / 6 阶段 |

## 「高性价比人生指南」为什么拆成三层

- `lifeIndex.js`：34 章的标题、导语与**每条条目的标题**（约 100 KB），学习页只读这一份；
- `lifePlan.js`：把章映射成课程（阶段、重要度、过关标准），`courses[].chapter` 指向章 id；
- `life/chNN.js`：**逐条原文**（成本 / 说人话 / 收益 / 证据等级 / 来源 / 备注），每章一个懒加载块。

三层加起来 2.4 MB，但首屏只下载第一层；点「读这一章全文」才取对应那一章。
生成脚本在项目外（`.build-tools/gen-life.mjs`），上游更新时重跑即可——**不要手改**这三层。

## 加一份新计划的三个坑

1. **`switchPlan` 会先删光上一份的字段再整份写入**（`applyPlan`）。所以新计划缺哪个字段，
   页面对应那块就整块不显示——模板里对可选区块都加了 `v-if`，加新字段时记得一起加。
2. **`plan.totals` 可能不存在**：页头课时统计用的是 `plan.totals?.hoursLow ?? 0`，
   别改回直接取属性，换计划时会抛错把整页卡住。
3. **别用 `import.meta.glob` 加载大块数据**：`verify-frontend.mjs` 的注释剥离会把模式串里的
   `/*` 当成注释开头，把后面一整段代码删掉；孤儿文件检查也不认 glob。
   像 `lifeChunks.js` 那样把 `() => import('./life/ch01.js')` 显式列出来即可。

## 「高性价比人生指南」是**书**，不是课程

它按 `meta.layout: 'book'` 排版：左边 34 章目录（可滚动、跟随），右边一章正文，
一条条顺着读。**不要再给它加「过关标准 / 实战任务 / 前置课程」**——它没有这些东西，
加了反而挡着正文。课程的排版（阶段卡、课程卡、进度）只给另外三份计划用。

## 那 34 章正文是懒加载的

`lifeChunks.js` 里一张显式的 `{ ch01: () => import('./life/ch01.js') }` 表；
点目录里的一章才取那一章（约 70 KB）。别写成 `import.meta.glob`，原因见上一条第 3 点。
