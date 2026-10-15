# `pages/home/components/` — 首页自己的板块

只被首页使用的三块。首页本身（`HomePage.vue`）只负责把它们摆好。

| 文件 | 内容 | 状态来源 |
| --- | --- | --- |
| `HeroCard.vue` | 主视觉：标题、两个入口按钮、右侧装饰画 | `profile`、`diaries` |
| `DiaryPreview.vue` | 「日记碎片」两条 | `diaries.homeDiaries` |
| `QuoteCard.vue` | 引用卡，内容固定 | 无状态 |

**升级到 `modules/` 的条件**：某个板块被第二个页面用到。目前三块都只在首页出现，
所以留在这里而不是 `modules/`。
