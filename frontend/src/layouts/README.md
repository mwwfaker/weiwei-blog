# `src/layouts/` — 应用外壳

外壳负责「除了页面内容以外的一切」：悬浮顶栏、底部 dock 导航、页面转场、常驻的播放器和弹窗。

## 文件

| 文件 | 干什么 |
| --- | --- |
| `AppShell.vue` | 外壳本体。装主题、绑路由、拉首屏数据，然后把顶栏 + 当前页面 + dock + 播放器 + 弹窗拼起来。 |
| `AppTopBar.vue` | 悬浮玻璃横条：品牌、当前页、日期、主题切换、搜索、头像。 |
| `AppDock.vue` | 底部居中的胶囊导航；「更多」面板 teleport 到 body。 |

## 2026 换壳后的几条约定

- **顶栏与 dock 常驻在外壳里，不跟着页面重挂。** 换壳前顶栏被包在 key 了的 `.page-stage` 里，
  每切一次页面就重建一次，看起来像「一堆页面拼起来」。现在只有中间的页面内容在换。
- **页面是通栏的。** 左侧固定栏没有了，`.page-frame` 负责 1220px 的最大宽度与左右留白；
  底部留白要够（`.main-area` 的 padding-bottom），否则 dock 会压住最后一屏内容。
- **页面转场是一条液态帘子**（`.route-curtain`），它是外壳的直接子元素、fixed 定位。
  塞进 `.page-stage` 会跟着页面一起被换掉，动画就没了。
- **工具页（绩效）走「工具模式」**：dock 与顶栏收起，`.page-frame` 不再限宽；出口按钮由工具页
  自己的工具条提供（`PerfToolbar` 的「返回博客」），外壳不再重复放一个。
- **「更多」菜单必须 teleport。** dock 在窄屏是横向滚动容器，滚动容器会裁掉绝对定位的子元素。
  `scripts/verify-frontend.mjs` 的第 [7] 项会盯着这件事（它按 `.side-nav / .dock-track`
  两个选择器找，换名字时要一起改）。

## 为什么仍然是一个外壳渲染所有页面，而不是 `<router-view>`

`src/App.vue` 里仍然是 `<AppShell />`，页面由 `app/pageRegistry.js` 按 `currentPage` 选择，
不走 `<router-view>`。原因是这三件事依赖「同一棵组件树一直活着」：

1. 切页动画（`<Transition name="page-swap" mode="out-in">` 包着 `:key="currentPage"` 的容器）；
2. 播放器与音乐盒在换页时不重建——`<audio>` 一旦卸载就会断声；
3. 九处弹窗挂在树上，各页共用一个草稿（例如从首页点「写日记」和从日记页点「写日记」是同一份）。

路由表仍然负责地址、历史与滚动行为，只是不负责渲染。

## 页面 id 从哪来

`watch(() => route.name)` → `resolvePageName()` → `currentPage`。老地址 `#/public-diary` 会被
认成「日记页 · 公开标签」。

## 加一个全站级能力（错误边界、i18n、埋点）时放哪

放 `App.vue`（它是外壳的入口，专门留着这一层），或者直接改 `AppShell.vue`。
不要往每个页面里塞。
