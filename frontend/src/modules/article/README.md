# `modules/article/` — 文章相关复用件

| 文件 | 用途 |
| --- | --- |
| `ArticleCard.vue` | 文章卡片。`variant="preview"` 用于首页（序号 `01`、显示阅读时长），`variant="full"` 用于文章列表页（两位序号、`阅读 ↗`、显示标签）。 |
| `ArticleGrid.vue` | 卡片网格。`page` 为真时多一个 `.article-grid-page`（列密度不同）。 |
| `ArticleReaderDialog.vue` | 阅读弹窗。删除 / 编辑按钮只在「已登录 + 是自己的文章」时出现。版面走 `modules/modal/ReadingSheet.vue`：分类·日期与关闭按钮固定，**正文独立滚动**；封面图、标题、摘要、标签都在正文流里跟着滚。 |
| `ArticleEditorDialog.vue` | 编辑弹窗，含封面上传。 |

## 归属判断靠 `mine`

服务端返回的公开文章里也有**别人**的文章。列表里每条都带 `mine` 标记，
`ArticleReaderDialog` 用 `auth.isLoggedIn && article.mine` 决定要不要显示编辑按钮。
少了这一条，别人的文章上会出现编辑和删除。

## 封面地址

`article.image` 存放的是「绝对地址」或 `media:<媒体 id>` 引用。后者要按当前媒体库解析成
签名链接，所以渲染时统一走 `useArticlesStore().articleImage(article)`，不要直接用 `article.image`。

用引用的原因是：媒体链接是短期签名地址，把链接本身存进数据库会过期。
