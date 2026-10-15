# 文章宇宙

路由 `/articles`。文章列表：分类筛选 + 搜索 + 卡片网格。

## 状态

全部来自 `stores/articles.js`：

| 界面元素 | store 字段 |
| --- | --- |
| 分类胶囊、当前选中 | `categoryNames` / `categoryFilter` |
| 搜索框 | `search`（**文章页自己的**，见下） |
| 网格 | `visibleArticles` 再按搜索词过滤一遍 |
| 「写文章」 | `create()` |
| 「导入 Word」 | `parseImportFiles(files)`，核对弹窗由应用外壳挂载（`modules/article/ArticleImportDialog.vue`） |
| 点卡片阅读 | `open(article)` |

## 导入 Word 当文章

接受 `.docx` / `.txt` / `.md`（docx 用 mammoth 读，`.txt` 也认 Markdown 的 `#` 标题）。
流程和日记导入一样：**先解析成草稿让人核对，确认后才写库**，草稿留在 store 里，关掉弹窗不丢。
拆分规则见 `modules/article/README.md`。一次可以选多个文件。

## 搜索词为什么和日记页分开

重构前文章页和日记页共用同一个 `search` ref（当时都在 App.vue 里）。
表现是：在文章页搜「海边」，切到日记页会发现筛选条件还留着。

现在文章页用 `articles.search`，日记页用 `diaries.search`，互不影响。
顶栏那个搜索按钮仍然指向日记页的搜索框。

## 分类跳转

分类页和标签页点一下会设置 `categoryFilter` / `tagFilter` 然后 `go('articles')`，
所以那两页不需要自己渲染列表。
