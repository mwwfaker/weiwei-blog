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
| `entry.js` | 给测试用的渲染入口：用**真实的**路由表 + 内存 history 渲染任意地址；另外导出两个单独渲染组件的函数。 |
| `run.mjs` | 断言脚本。先跑 16 条路由，再单独喂 props 渲染歌词栏和音乐盒的状态分支。 |
| `snapshot.mjs` | 把每条路由的渲染结果写成一堆 HTML 文件，用于**重构前后逐字节比对**。 |
| `fixtures/` | 导入解析器测试用的真实样本（飞书粘贴文本、真实截图的 OCR 输出），由 `scripts/verify-ocr.mjs` 读取。 |

## 为什么要「单独渲染组件」

整页渲染走的是「什么都没选」的默认状态，而歌词栏真正要检查的是
**有歌词时的当前句高亮、解析中、没有歌词、纯文本不假高亮**这几个分支——
只有把 props 直接喂进去才走得到。音乐盒同理（收起 / 展开、播放 / 暂停）。

`run.mjs` 里的断言一律按「整个 class 列表里有没有这个词」判断，不比对固定字符串顺序：
Vue SSR 会把动态 class 排在静态 class 前面，写死顺序的断言会在无关改动里碎掉。

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
