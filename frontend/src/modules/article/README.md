# `modules/article/` — 文章相关复用件

| 文件 | 用途 |
| --- | --- |
| `ArticleCard.vue` | 文章卡片。`variant="preview"` 用于首页（序号 `01`、显示阅读时长），`variant="full"` 用于文章列表页（两位序号、`阅读 ↗`、显示标签）。 |
| `ArticleGrid.vue` | 卡片网格。`page` 为真时多一个 `.article-grid-page`（列密度不同）。 |
| `ArticleReaderDialog.vue` | 阅读弹窗。删除 / 编辑按钮只在「已登录 + 是自己的文章」时出现。版面走 `modules/modal/ReadingSheet.vue`：分类·日期与关闭按钮固定，**正文独立滚动**；封面图、标题、摘要、标签都在正文流里跟着滚。 |
| `ArticleEditorDialog.vue` | 编辑弹窗，含封面上传。 |
| `ArticleImportDialog.vue` | **Word / 文本导入的核对弹窗**：把 `.docx` / `.txt` / `.md` 拆成一篇篇草稿让人先核对，确认后才写库。顶端有「统一设置」（可见范围 / 分类 / 标签），每篇还能单独改。样式与日记导入共用 `.import-*` 那套类名，不另写一份。 |

## Word 导入的拆分规则

在 `services/articleImport.js`（纯函数，`npm run verify:article` 对拍），要点：

- **文档里出现的最浅那一级标题就是文章分界**。Word 里一份文档装几篇很常见，一级标题切一篇最自然；
  整份文档只有二级标题时也按二级切；完全没有标题就是一篇，标题取文件名。
- 一级标题下的**子标题留在正文里**当普通行（正文是纯文本，标题层级在这里没有意义）。
- 标题之前那段正文：够长（≥120 字）才单独成篇（用文件名兜底当标题），短的是文档头/署名，丢掉。
  **没有标题的文档不适用这条**——整份就是一篇，哪怕只有一句话，否则短文章会被吞掉。
- 正文为空的段落丢掉（那种多半是目录里的一行标题）。
- `normalizeText()` 会清掉 Word 带进来的垂直制表符（Shift+Enter）、不换行空格、零宽字符、
  软连字符，并把 CRLF、连续空行、行尾空白统一掉——这些字符肉眼看不见，但会让搜索和字数统计出错。

docx → HTML → 块 那一步在 `stores/articles.js` 的 `blocksFromHtml()`：`DOMParser` 只有浏览器有，
放进去就会毁掉「服务层能在 Node 里直接跑」这条底线。它**只扫 body 的直接子元素**，
不递归 `querySelectorAll`——`<blockquote><p>…</p></blockquote>` 这类嵌套会让同一段文字被数两次。

## 归属判断靠 `mine`

服务端返回的公开文章里也有**别人**的文章。列表里每条都带 `mine` 标记，
`ArticleReaderDialog` 用 `auth.isLoggedIn && article.mine` 决定要不要显示编辑按钮。
少了这一条，别人的文章上会出现编辑和删除。

## 封面地址

`article.image` 存放的是「绝对地址」或 `media:<媒体 id>` 引用。后者要按当前媒体库解析成
签名链接，所以渲染时统一走 `useArticlesStore().articleImage(article)`，不要直接用 `article.image`。

用引用的原因是：媒体链接是短期签名地址，把链接本身存进数据库会过期。
