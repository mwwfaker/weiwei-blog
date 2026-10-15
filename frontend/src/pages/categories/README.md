# 文章分类

路由 `/categories`。把 `articles.categoryNames` 铺成一组卡片，每张卡片显示分类名和文章数。

## 交互

点一张卡片 = `articles.categoryFilter = 分类` + `go('articles')`。
分类页本身不渲染文章列表，筛选和展示都在文章页。

## 装饰符号

卡片左上角的符号按序号循环取 `['✳','✧','◈','⌁']`，不是按分类内容。纯装饰。
