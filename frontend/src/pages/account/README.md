# 账号（登录 / 注册）

路由 `/account`。左边一张视觉卡，右边登录或注册表单。

## 状态

表单状态（`authMode`、`authForm`）**只属于这一页**，所以留在组件里。
账号动作走 `stores/auth.js`，登录成功后的「按新身份重读全站」走 `stores/library.js`。

## 登录成功的完整流程

```
auth.login(email, password) 或 auth.register(...)
  → library.completeLogin(user.displayName)
      → auth.restoreSession()        接回会话
      → profile.applyUser(user)      写昵称 / 简介 / 头像
      → library.refreshAll()         重读日记、文章、媒体、曲库
  → go('admin') + 「账号验证成功」
```

**关键点**：只有 `completeLogin` 返回真才跳转。`restoreSession` 在
`/api/account/me` 失败时会清掉 token，这时候如果照样跳进创作管理，
用户会看到一个"已登录但什么都没有"的页面。

## 错误文案

`auth.error` 里包含 `localhost` 或 `fetch` 时会被替换成「账号服务暂时连接不上，请检查网络后重试。」——
这两种字符串是网络层报出来的，直接给用户看没有意义。

## 密码

注册要求至少 10 个字符（表单 `minlength` + 后端校验）。登录时 `minlength` 是 1，
这样历史短密码仍能登录。
