# `pages/study/components/` — 学习计划的渲染组件

| 文件 | 内容 |
| --- | --- |
| `PlanJsonView.vue` | 渲染导入的 JSON 计划（统计 / 阶段 / 课程卡 / 勾选进度 / 资源） |

## 边界

- 只负责「把已经归一化好的 plan 画出来」：不解析 JSON、不读写本地计划列表。
  解析与存储分别在 `services/studyJson.js`。
- 进度按 `planId` 分开存在本机（`weiwei-blog-study-done:<id>`），互不干扰。
- 样式在 `styles/shell-2026.css` 的 `.plan-*` 段。
