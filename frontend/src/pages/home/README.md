# 首页

路由 `/`。整站的门面：主视觉 + 最近三篇文章 + 日记碎片 + 引言。

## 文件

| 文件 | 内容 |
| --- | --- |
| `HomePage.vue` | 编排：拉最近三篇文章、拼四块内容、放页脚 |
| `components/HeroCard.vue` | 主视觉（标题、两个入口按钮、右侧装饰画） |
| `components/DiaryPreview.vue` | 「日记碎片」：两条日记 |
| `components/QuoteCard.vue` | 引用卡，内容固定、无状态 |

## 状态从哪来

`articles.articles.slice(0, 3)`、`diaries.homeDiaries`、`profile.profileName`。
页面本身不持有状态。

## 「日记碎片」显示谁的日记

`diaries.homeShowsOwnDiaries` 决定：

- 自己写过日记 → 显示自己最近两条；
- 还没写过（访客、新注册的账号）→ 显示**大家的公开日记**。

这个判断以前是写死的（直接读自己的日记），导致访客和新账号打开首页是一片空白，
即使站上已经有公开日记。

## 主视觉上的「记下第 N 个日子」

数字是 `128 + 自己日记数`，不是真实统计，属于设计上的装饰。改文案时注意别把它当真数据用。
