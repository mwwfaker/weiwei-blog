# 留言板

路由 `/messages`。留言表单 + 留言列表。

## 状态

全部来自 `stores/guestbook.js`：`messages`、`messageDraft`、`loading`、`loaded`、`error`、
`load()`、`saveMessage()`。

## 数据在数据库里（2026-11 起）

留言存在 Supabase 的 `guestbook_messages` 表：**谁都能读，也不用登录就能写**。
接口是 `services/api.js` 里的：

```
GET  /api/messages   → 最近 200 条，倒序
POST /api/messages   → { name, content }，不要求登录
```

所以页面上原来那句「留言已添加到预览」改成了「留言已发布」——现在它是真的存进去了。

## 三件别做坏的事

1. **不要给 POST 加 `requireUser()`**。这是匿名留言板，加了就等于「必须先登录才能留言」。
2. **限长有两道**：前端 `maxlength`（30 / 500）只是让错误提示来得早，
   底线在 RLS 的 `with check` 和表上的 `check`——绕过前端直接打接口也写不进超长内容。
3. **没有 update / delete 策略**，所以留言不能被改、不能被删（站主要删得走 SQL）。
   要加「站长删除」时，请按 `auth.uid()` 判 owner，而不是简单放开 delete。

## 空状态

没有留言时不摆空卡片，显示「还没有人留言。你是第一个。」；接口失败时显示错误与「再试一次」。
