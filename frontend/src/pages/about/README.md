# 关于我

路由 `/about`。一张大卡片：左边一张图，右边昵称、简介和「编辑个人资料」。

## 为什么它也是「兜底页面」

`app/pageRegistry.js` 的 `pageComponent(id)` 在遇到不认识的页面 id 时返回 `AboutPage`，
和重构前那个 `v-else` 分支的行为一致。所以这一页不能依赖「必须先访问过某个页面」的状态。
实际上它只有一个依赖：`profile` store。

## 状态

| 显示 | 来自 |
| --- | --- |
| 大图 | `profile.profileAvatarSrc`，为空时退回一张固定的 Unsplash 图 |
| 标题 | `profile.profileName` |
| 简介第一段 | `profile.profileBio` |
| 「编辑个人资料」 | `profile.openEditor()`，未登录会先被带去账号页 |

头像可以是绝对地址也可以是 `media:<媒体 id>` 引用，由 `profileAvatarSrc` 统一解析。
