# `pages/study/data/` — 学习计划的数据

| 文件 | 内容 |
| --- | --- |
| `studyPlan.js` | 金融学那份计划的结构化数据（29 门课 / 5 个阶段 / 资源链接） |
| `studyPlans.js` | **计划库**：一份数组，页面从它读；加新学习计划就是往这里加一项 |

## 加一份新计划的方式

### A. 直接加数据文件（现在就能用）

复制一份 `studyPlan.js` 改成新计划，然后在 `studyPlans.js` 里加一项：

```js
{
  id: 'ielts',                 // 唯一，用来分开存进度
  name: '雅思 7.5 备考路线',
  short: '雅思',                // 计划库那一行按钮上的字
  note: '一句话说明这份计划是什么',
  plan: ieltsPlan,
}
```

页面上的阶段标签**不是写死的**，是从课程的 `stage` 字段里长出来的，所以新计划可以有
完全不同的阶段名和数量。进度按 `id` 分开存（`weiwei-blog-study-progress:<id>`），互不干扰。


## 导入 JSON（站内「学习库 → 导入 JSON」）

把下面这段直接发给任意 AI，让它按结构输出；拿到 JSON 后粘进站内，或存成 `.json` 选文件。
不需要任何 key，也不需要后端。

```text
请把我的学习文档整理成下面的 JSON，只输出 JSON，不要解释：
{
  "title": "计划标题",
  "subtitle": "一句话说明",
  "summary": "两三句话：适合谁、学完能做什么",
  "tags": ["标签"],
  "totalHours": { "low": 200, "high": 300 },
  "stages": [
    {
      "title": "阶段名",
      "goal": "这一阶段的目标",
      "duration": "例如 3–5 个月",
      "courses": [
        {
          "name": "课程 / 模块名",
          "importance": 5,
          "hours": "30 小时",
          "prerequisite": "前置基础",
          "concepts": ["核心概念"],
          "criteria": ["完成标准"],
          "resources": [{ "title": "资源名", "url": "https://..." }]
        }
      ]
    }
  ]
}
硬性规则：
- resources 只保留原文里真实出现过的链接，没有就留空数组，不要编造 URL。
- importance 只在原文明确说重要性时给非 3 的值。
- 没提到的字段留空，不要虚构课时和前置课程。
```

导入的计划只存在这台设备的浏览器里；每份计划有自己的进度记录。
