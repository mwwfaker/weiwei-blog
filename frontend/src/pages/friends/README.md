# 朋友们

路由 `/friends`。友链卡片 + 添加友链表单。

## 状态

`stores/guestbook.js` 的 `friendLinks` / `friendDraft` / `addFriend()`。
和留言板共用同一个 store，因为两者都是「还没有后端接口的本机数据」。

## 表单校验

`name` 和 `url` 是必填（HTML 的 `required` + store 里再判一次），`url` 用 `type="url"`。
store 里的判断是给「回车提交时浏览器校验被绕过」这种情况兜底的。
