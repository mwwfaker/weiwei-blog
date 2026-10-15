# `modules/profile/` — 个人资料

`ProfileEditorDialog.vue`：头像上传 + 昵称 + 一句自我介绍。

入口有两个——顶栏的头像按钮（未登录时去登录页）和侧边栏资料卡上的 `↗`，
两个都走 `useProfileStore().openEditor()`，所以未登录时的处理只有一处。

头像存的是绝对地址或 `media:<媒体 id>` 引用，渲染时统一走 `profileAvatarSrc`
（它按当前媒体库即时解析）。签名的媒体链接会过期，`data:` 地址又远超字段长度，
所以这两种都不直接落库。
