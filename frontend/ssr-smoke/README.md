# `frontend/ssr-smoke/` — 渲染冒烟测试

不需要浏览器，用 Vue 的服务端渲染把每个页面真渲染一遍。
**构建能过但页面一渲染就炸的问题，只有这里抓得住。**

```bash
cd frontend
npm run test:render
```

## 文件

| 文件 | 作用 |
| --- | --- |
| `entry.js` | 给测试用的渲染入口：用**真实的**路由表 + 内存 history 渲染任意地址；另外导出两个单独渲染组件的函数，以及一个直接调「关闭动效」的探针。 |
| `run.mjs` | 断言脚本。先跑 16 条路由，再单独喂 props 渲染歌词栏和音乐盒的状态分支，最后调一次关闭动效的探针。 |
| `snapshot.mjs` | 把每条路由的渲染结果写成一堆 HTML 文件，用于**重构前后逐字节比对**。 |
| `fixtures/` | 导入解析器测试用的真实样本（飞书粘贴文本、真实截图的 OCR 输出），由 `scripts/verify-ocr.mjs` 读取。 |

## 为什么要「单独渲染组件」

整页渲染走的是「什么都没选」的默认状态，而歌词栏真正要检查的是
**有歌词时的当前句高亮、解析中、没有歌词、纯文本不假高亮**这几个分支——
只有把 props 直接喂进去才走得到。音乐盒同理（收起 / 展开、播放 / 暂停）。

`run.mjs` 里的断言一律按「整个 class 列表里有没有这个词」判断，不比对固定字符串顺序：
Vue SSR 会把动态 class 排在静态 class 前面，写死顺序的断言会在无关改动里碎掉。

## 为什么还要「真的调一次关闭」

「关掉时化作尘埃」（`composables/useDustClose.js`）**只在用户点关闭时才执行**：
整页渲染走不到那一行，组件渲染也只是把模板画出来。所以它出问题时的表现是
**「点了关闭没反应」**——页面上什么都不显示，只有控制台里一行 TypeError，
构建、`verify`、快照比对全都是绿的。

这不是假设：`useDustClose` 里 import 进来的 `motion` 被同名的参数遮住过一次，
日记和全屏看图两条关闭路径一起废掉，而当时所有检查都是绿的。

所以 `entry.js` 导出了 `probeDustClose()`：真的调一次 `requestClose()`，然后断言
「没抛错 / 进入了消散状态 / 粒子按目标元素的真实位置铺开 / 没有立刻通知关闭（动效被跳过）」。
把 import 的名字改回去，这条会立刻变红（`1 of 24 checks failed`）。

## 用快照做重构验证

```bash
cd frontend
npx vite build --ssr ssr-smoke/entry.js --outDir ssr-smoke/dist-ssr --logLevel warn
node ssr-smoke/snapshot.mjs ../before
# …只搬代码、不改行为地重构…
node ssr-smoke/snapshot.mjs ../after
```

然后逐字节比对两个目录。这个仓库上一轮把 1540 行的 `App.vue` 拆成 15 个页面文件夹时，
就是靠它确认「13 条路由逐字节相同，另外两条的差异能逐项解释」的。

**注意**：它只能证明**渲染结果**没变，证明不了 CSS 没变。纯样式改动要靠构建产物的哈希对比。

## 环境说明

`run.mjs` 在 import 打包结果**之前**先把 `localStorage`、`window`、`document`、`fetch`
这些浏览器全局装好——源码在模块加载阶段就会读它们。`fetch` 被故意做成直接抛错，
这样测试全程离线，不会偷偷依赖网络。

`globalThis.window = globalThis` 是有意的：让 `window.x` 和裸 `x` 指向同一个对象。
