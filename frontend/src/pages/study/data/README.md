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
