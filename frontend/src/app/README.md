# `src/app/` — 应用骨架（不含外观）

这个文件夹装的是「应用怎么跑起来」的那部分：路由、页面调度、导航表、全局提示、登录守卫、
公共小工具。**这里不放任何页面外观**，页面在 `src/pages/`，外观在 `src/layouts/`。

## 文件

| 文件 | 干什么 |
| --- | --- |
| `routes.js` | 路由表（页面 id ↔ 路径）。单独成文件，静态检查和测试可以直接 import 它而不需要构造浏览器 history。 |
| `router.js` | 用 `routes.js` 创建 hash 路由实例。 |
| `navigation.js` | 侧边栏两组导航项（主导航 / 「更多」），以及 `pageLabel()`。页面 id 同时是路由名。 |
| `pageRegistry.js` | 页面 id → 页面组件。`study` 与 `perf` 在这里按需加载（它们各自带几百 kB）。 |
| `usePageNav.js` | 当前页面 id、「更多」菜单开关、`go()` 跳转、`resolvePageName()`。 |
| `useToast.js` | 全局轻提示 `notify()`。 |
| `useGuard.js` | `requireLogin(action)`：未登录时提示并把人带到登录页。 |
| `useScrollChrome.js` | 下滑收起导航的状态机（rAF 节流 + 迟滞 + 冷却）。 |
| `theme.js` | 主题的 provide/inject key。`@vueuse` 的 `useDark` 实例只在外壳里建一次。 |
| `ids.js` | `localId()` / `isLocalId()`：区分「本机草稿」和「服务器记录」。 |
| `download.js` | `downloadText()`：文本导出。 |

## 约定

- **导航表是页面清单的唯一来源。** 加一个页面要同时改三处：`routes.js` 加路由、
  `pageRegistry.js` 加组件、`navigation.js` 加导航项（或确认它不需要入口）。
  `npm run verify` 的第 [3] 项会检查这三者是否一致。
- **`go()` 只接受路由名**，不接受路径。传一个不存在的名字会让 vue-router 抛错。
- **不要在这里 import 页面组件**：页面注册表已经负责那件事，`app/` 里的其他模块保持叶子状态，
  否则会出现 `usePageNav → page → store → usePageNav` 这类循环。
- 模块级单例（`usePageNav` / `useToast`）刻意不用 Pinia：它们要在任何组件挂载之前就能用，
  而且被 store 和组件同时调用。

## 老的 `#/public-diary` 链接

「公开日记」已经并进「日记」页当第二个标签。`resolvePageName()` 在遇到 `publicDiary` 时会把页面
切到 `diary`、把标签切到 `public`，然后把地址替换成 `#/diary`。所以旧链接仍然能打开。
