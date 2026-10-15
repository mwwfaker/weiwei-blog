# `src/layouts/` — 应用外壳

外壳负责「除了页面内容以外的一切」：左侧导航、顶栏、页面切换动画、常驻的播放器和弹窗。

## 文件

| 文件 | 干什么 |
| --- | --- |
| `AppShell.vue` | 外壳本体。装主题、绑路由、拉首屏数据，然后把导航 + 当前页面 + 播放器 + 弹窗拼起来。 |
| `AppSidebar.vue` | 左侧导航、「更多」菜单（teleport 到 body）、底部迷你资料卡。 |
| `AppTopBar.vue` | 面包屑、日期、主题切换、搜索入口、头像入口。 |

## 为什么仍然是一个外壳渲染所有页面，而不是 `<router-view>`

`src/App.vue` 里仍然是 `<AppShell />`，页面由 `app/pageRegistry.js` 按 `currentPage` 选择，
不走 `<router-view>`。原因是这三件事依赖「同一棵组件树一直活着」：

1. 切页动画（`<Transition name="page" mode="out-in">` 包着 `:key="currentPage"` 的容器）；
2. 播放器与音乐盒在换页时不重建——`<audio>` 一旦卸载就会断声；
3. 九处弹窗挂在树上，各页共用一个草稿（例如从首页点「写日记」和从日记页点「写日记」是同一份）。

路由表仍然负责地址、历史与滚动行为，只是不负责渲染。

## 页面 id 从哪来

`watch(() => route.name)` → `resolvePageName()` → `currentPage`。老地址 `#/public-diary` 会被
认成「日记页 · 公开标签」。

## 加一个全站级能力（错误边界、i18n、埋点）时放哪

放 `App.vue`（它是外壳的入口，专门留着这一层），或者直接改 `AppShell.vue`。
不要往每个页面里塞。
