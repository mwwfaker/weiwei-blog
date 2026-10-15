# 留言板

路由 `/messages`。留言表单 + 留言列表。

## 状态

全部来自 `stores/guestbook.js`：`messages`、`messageDraft`、`saveMessage()`。

## 目前只存在本机

留言和友链**还没有后端接口**，只写在 `localStorage` 里。所以提交后的提示是
「留言已添加到预览」而不是「已保存」——不要把它改成听起来像入库了的文案。

等接口有了，把 `guestbook.js` 里的 `writeStoredJson` 换成 `request()` 即可，页面不用动。
