# `frontend/scripts/` — 前端自检脚本

这些脚本不需要浏览器、不需要数据库、不需要后端，纯粹读源码做静态检查或跑纯函数对拍。
**改完代码提交前跑一遍**：

```bash
cd frontend
npm run verify:all     # 下面五个依次跑一遍
npm run test:render    # SSR 渲染冒烟测试（在 ssr-smoke/ 里）
```

| 脚本 | `npm run` | 检查什么 | 为什么必须存在 |
| --- | --- | --- | --- |
| `verify-frontend.mjs` | `verify` | 12 项结构性检查，见下 | 构建能过但页面坏掉的问题，只有这里抓得住 |
| `verify-lyrics.mjs` | `verify:lyrics` | LRC 时间轴、当前句定位、曲名拆分、ID3 内嵌歌词 | 「歌词整体错位一句」或「UTF-8 读出乱码」靠截图看不出来 |
| `verify-perf.mjs` | `verify:perf` | 绩效公式与表格里的真实数字逐个对拍，外加「数据重置」的 30 条边界断言（共 112 项） | 公式改错一位算出来的工资就是错的；重置清多了会丢数据、清少了没效果，两者都不报错 |
| `verify-ocr.mjs` | `verify:ocr` | 飞书粘贴文本与真实截图 OCR 输出的解析（41 项） | 解析回归会让导入整段错位 |
| `verify-diary-import.mjs` | `verify:diary` | 「整合日记」按日期头拆篇的规则（63 项），含「正文里自带日期、没有独立日期行」的那一类；带 `DIARY_FILE=<路径>` 时还会对真实文件做篇数与行数守恒回归 | 拆分错了只是「多了几篇很长的、少了几篇」，可它直接写进数据库，发现时要去后台一篇篇删 |
| `verify-article-import.mjs` | `verify:article` | Word/文本导入的规则（84 项）：脏字符清理、Markdown 标题、按最浅一级标题拆篇、子标题留在正文、标题前那段的保留/丢弃、空段落丢弃、摘要截断、**目录剔除**（含"别把正文误判成目录"）、文件头认格式、WPS 私密文档识别、提示窗文案 | 同上——拆错就是往数据库里灌错文章；这里只测纯函数，docx → 块 那步要用 `DOMParser`，归 SSR 冒烟 |
| `check-study-ai.mjs` | `node scripts/check-study-ai.mjs` | **不是检查，是排查工具**：拿 `STUDY_AI_KEY` 发一次最小请求，判断网关/key 还能不能用（免费 key 会过期） | 免费 key 过期后，页面里只看到「导入失败」，分不清是 key、网关还是模型名的问题 |
| `new-page.mjs` | `new:page` | **不是检查，是生成器** | 加页面要同时改三处注册点，靠人记一定会漏 |

## `new-page.mjs` —— 加一个页面

```bash
cd frontend
npm run new:page -- notes "随手记"             # 进「更多」菜单
npm run new:page -- stats "数据看板" --primary  # 进主导航
```

它会建 `src/pages/<id>/<Xxx>Page.vue` 与 `README.md`，并改好
`app/routes.js`、`app/pageRegistry.js`、`app/navigation.js` 三处——
**写完还会自己重读一遍确认改动真的落下去了**（顺带校验花括号没被改坏）。

跑完立刻 `npm run verify`：第 [3] 项会确认三处一致、且组件确实住在 `pages/<id>/` 里；
`npm run test:render` 会**自动**把新路由纳入冒烟测试（路径是从真实路由表推导的，不是硬编码列表）。

> 这个生成器第一次跑的时候自己踩了个坑：`smoke-test: SmokeTestPage` 作为对象键是**语法错误**
> （连字符不是合法标识符），SSR 构建直接挂掉。是被第 [3] 项和 `test:render` 抓出来的——
> 这也是为什么这些检查值得存在。

## `verify-frontend.mjs` 的 12 项

| # | 检查 | 为什么 |
| --- | --- | --- |
| 1 | 模板标识符必须在 `<script setup>` 里定义 | 缺失会编译成 `_ctx.x`，运行时才炸（绩效页就因此有三个「点了没反应」的按钮） |
| 2 | `v-*` 自定义指令必须在脚本里 import | `v-reveal` 是局部注册的，漏 import 只会静默失效 |
| 3 | 页面 id ↔ 路由 ↔ 页面注册表三者一致，且组件住在 `pages/<id>/` | 加页面要改三处，漏一处页面就是死的 |
| 4 | 模板里写到的 class 必须有一条样式规则 | 手抄类名抄错是重构后最常见的回归 |
| 5 | `html/body/#app/.app-shell` 上不能有会变成 fixed 包含块的属性 | 播放器和弹窗会贴到文档底部而不是视口（这个回归上线过一次） |
| 6 | 粒子画布不能被混合模式或低透明度弄没 | 浅色主题下整片消失 |
| 7 | `.side-nav` 是滚动容器时，「更多」菜单必须 teleport 到 body | 否则菜单渲染了但一个像素都画不出来 |
| 8 | 每个目录都有 `README.md`、没有空目录，根目录的契约文件齐全 | 「每个文件夹写一份说明」这条约定靠自觉会烂掉；`AGENTS.md` 被删则所有约定只剩人记得 |
| 9 | 没有谁都不引用的孤儿文件 | 拆分之后最容易悄悄留下的东西 |
| 10 | **分层不越界**：页面/模块不许直接调后端（`request`/`uploadMedia`）或读本机存储；`services/` 不许 import Vue 或 store | 破一条，页面就开始各写各的、离屏对拍脚本也开始失效 |
| 11 | **不许新增 `<style scoped>`** | 它加的属性选择器会压过 `styles/` 里的覆盖层，让统一层静默失效（学习页的圆角就是这么对不上的） |
| 12 | 单文件体积提示（> 400 行） | 提示「本该拆出去的板块又堆回去了」，只提示不拦 |

第 4、9、11 项各带一份**已知清单**（`KNOWN_UNSTYLED` / `KNOWN_UNREFERENCED` /
`KNOWN_SCOPED_STYLES`）。清单过期（该修的修好了、该接的接回来了）脚本会反过来报错，
所以它不会悄悄烂掉。

**哪些规则没有自动检查**：铁律第 2 条里「领域组件 vs 页面版面部件」的取舍、以及
「跨组件状态还是页面局部状态」。这两条是判断题，第 [12] 项只能给体积提示。

## 约定

- **不引入依赖。** 这四个脚本只用 Node 内置模块，加一个 `vue/compiler-sfc`（从 `frontend/package.json` 解析）。
  装依赖才能跑的自检，最后一定没人跑。
- **放在 `frontend/scripts/` 而不是仓库根目录。** 它们检查的都是前端，工作目录统一是 `frontend`，
  相对路径直接从 `../src/` 开始写。
