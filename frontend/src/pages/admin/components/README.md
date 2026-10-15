# `pages/admin/components/` — 创作管理页自己的板块

| 文件 | 内容 | 数据来源 |
| --- | --- | --- |
| `AdminStats.vue` | 四个数字：文章 / 日记 / 相册 / 音乐 | 四个 store |
| `AdminSettingsPanel.vue` | 新日记默认可见范围、博客首页开关 | `profile` |
| `AdminQuickActions.vue` | 五个快捷入口 + 上传错误提示 | `articles`、`diaries`、`music` |

`AdminPage.vue` 只负责把它们摆成 `.admin-panels` 两栏。加新面板时：先判断它是不是
「只在创作管理页出现」，是就放这里，并且在 `AdminPage.vue` 的模板里挂上。
