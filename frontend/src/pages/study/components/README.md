# `pages/study/components/` — 学习计划的定制版面

| 文件 | 内容 |
| --- | --- |
| `WeavingPlanView.vue` | 手工编织与纤维手作：技法地图 / 40 周路线（可勾选）/ 项目库 / 材料工具 |

## 为什么是「一个计划一个组件」

学习计划的内容形状差别很大：金融那份是「课程 + 阶段 + 资源」，编织这份是「技法单元 + 周次路线 + 项目库」。
套一套通用模板会把两边都做丑，所以每份计划有自己的版面，数据放在 `pages/study/data/`。

## 边界

- 只做渲染与勾选；周进度存本机（`weiwei-blog-weaving-progress-v1`），按周号记日期。
- 加一份新计划：`data/<名字>.js` 出数据 + 这里一个 `<Xxx>View.vue` + `StudyPage` 里一个 `v-else-if`。
- 样式在 `styles/shell-2026.css` 的 `.weave-*` 段。
