# AGENTS.md —— 在这个仓库里动代码之前，先读完这一个文件

唯唯园：一个**无服务器**的个人博客。Vue 3.5 + Vite 前端（`frontend/`，唯一会被构建和部署的东西），
账号 / 数据库 / 对象存储全在 Supabase。`legacy/` 是已停用的 Java 后端，**不要动它**。

这个文件是仓库的结构契约：**新会话里唯一会被自动读到的文件**（DSH 把「项目根 → 当前目录」
链上的 `AGENTS.md` 注入第一条消息）。所以规则必须写在这里，写在别处等于没写。

---

## 一、结构约定

1. **一个页面一个文件夹**：`frontend/src/pages/<页面 id>/`，里面是 `<Xxx>Page.vue`、
   只属于它的 `components/`、以及一份 `README.md`。
2. **`modules/<主题>/` 按领域成套装组件**（music / diary / media / article / page / modal / profile / particle）。
   判断标准是「它属于哪个领域、外壳是否要挂载它」，**不是「现在有几个页面在用」**——
   例如 `modules/music/` 里既有一处挂载、全站可用的音乐盒，也有只服务音乐页的曲库面板。
   放到 `pages/<页面>/components/` 的是**只属于那一页版面的部件**（工具条、统计块、面板）。
   拿不准就问自己：如果这个页面被删掉，这个组件还有别的地方能去吗？有 → `modules/`，没有 → `components/`。
3. **每个新建目录都要配 `README.md`**（中文，20~40 行：这个目录装什么、边界在哪、加东西时注意什么）。
   **不能留空目录。**
4. **跨组件状态进 `frontend/src/stores/<域名>.js`**；只服务一个页面的状态跟着那个页面走，不进 store。
5. **样式只有两种合法放法**：
   - **全局样式表** `styles/` —— 追加到对应文件**末尾**；`styles/index.css` 的 import 顺序
     就是层叠顺序，**绝对不要重排、不要插队**。
   - **按需加载的页面** —— 样式放页面自己的文件夹，由组件加载（`pages/perf/perf.css` 是 `import './perf.css'`）。

   **不要写新的 `<style scoped>`。** 它给选择器加一个属性选择器（类 + 属性），于是能压过
   `styles/` 里同选择器的规则——`styles/polish-and-light-theme.css` 的「统一圆角」那一层
   就是这么对学习页失效的（学习页到现在还有 30/19/17 三种圆角）。第 [11] 项会拦住新的写法。
6. **`v-reveal` 是局部注册的指令。** 用它的组件必须自己 `import { vReveal } from '@/composables/motion'`，
   没有全局注册——渲染测试会单独挂载组件，那时没有全局指令可用。
7. **页面 / 模块组件只做编排。** 数据从 store 拿、动作调 store 的方法。
   组件里出现 `request(...)`、`uploadMedia(...)` 或 `localStorage` 就是放错位置了。
8. **`services/` 不读响应式状态。** 只接受参数、返回结果，**不 import Vue，也不 import store**。
   这条保证 `verify-lyrics / verify-ocr / verify-perf / verify-diary-import` 能直接 import 它们做离线对拍。

第 1、2、3、5、7、8 条都有自动检查（见第五节）；**第 2 条的「领域 vs 版面」和第 4 条是判断题**，
没有检查，靠你自己拿捏。

---

## 二、加一个新页面

**别手改**，跑生成器——它会按顺序改好、写完还会自己验证一遍：

```bash
cd frontend
npm run new:page -- <页面id> "中文导航标题"          # 默认进「更多」菜单
npm run new:page -- <页面id> "中文导航标题" --primary  # 进主导航
```

它会创建 `src/pages/<id>/<Xxx>Page.vue` 与 `README.md`，并改好三处注册点
（`app/routes.js`、`app/pageRegistry.js`、`app/navigation.js`）——
这三处漏一处页面就是死的，第 [3] 项会挡下来。
`npm run test:render` 会自动把新路由纳入冒烟测试（路径从真实路由表推导，不是硬编码列表）。

---

## 三、改已有的模块

这是最常发生的事，也是结构最容易重新烂掉的地方。

**动手前：**

1. **先读那个目录的 `README.md`。** 它写着这个目录装什么、以及踩过的坑。
   不知道改的东西属于哪一层，看 `src/README.md` 的九层表。
2. **改哪个文件由「改的是哪一层」决定**，不是由「哪个文件好改」决定：

   | 你要改的 | 落点 |
   | --- | --- |
   | 界面长什么样、点一下干什么 | 组件 / 页面 |
   | 数据从哪来、怎么存、跨页共享 | `stores/`（组件不许自己调接口） |
   | 接口怎么拼、格式怎么转 | `services/` |
   | 颜色、间距、动效 | `styles/` 里对应的文件（**追加到末尾**） |

**动手时：**

3. **板块长大了就拆出来。** 单文件超过 400 行会提示（第 [12] 项）——
   「本该拆出去的板块又堆回去了」通常就是这么开始的。拆出来的东西按第一节第 2 条决定去哪。
4. **改了就更新那段 README。** 尤其是「需要注意的地方」那节：现象 + 原因，
   例如「滚动容器会裁掉绝对定位的子元素，所以菜单要 teleport 到 body」。
5. **不要顺手改行为。** 发现 bug 先报告，别在结构调整里夹带修复——
   那会让「只搬代码」的逐字节比对失去意义（上一轮三个 bug 就是这么单独拎出来修的）。

**收工时：** 跑第五节那三条命令。改了行为就顺手更新 README 里的说明与 `CHANGELOG.md`。

---

## 四、别的东西该放哪

| 要加的东西 | 放哪 |
| --- | --- |
| 页面里的一块界面 | `pages/<页面>/components/` |
| 一个领域成套的组件 | `modules/<主题>/`，并在 `modules/README.md` 的表里登记「谁在用我」 |
| 跨组件状态 | `stores/<域名>.js`（保持依赖单向：`library → 各业务 store → auth/media`） |
| 调后端 / 对象存储 | `services/`（不要写在组件或页面里） |
| 接口没答上来时的示例数据 | `data/seed.js` |
| 自检脚本 | `frontend/scripts/`（**只能用 Node 内置模块**，不要加依赖） |
| 静态资源（图标等） | `frontend/public/`（会被原样拷进产物，**别往里放 README**） |

---

## 五、收工前必须跑，且必须全绿

```bash
cd frontend
npm run verify:all      # 13 项结构检查 + 歌词 / 绩效 / OCR / 日记导入四个离线自检
npm run test:render     # 路由表里每条路由的 SSR 渲染 + 7 个组件状态分支
npm run build           # 生产构建
```

`verify` 的 13 项覆盖：模板标识符、自定义指令、页面注册一致性、模板 class 有没有样式、
fixed 包含块、粒子可见性、下拉菜单裁剪、目录 README 与根目录契约文件、孤儿文件、
**分层越界**、**`<style scoped>`**、单文件体积（提示）、
**样式里的类名必须有人用**（第 [13] 项：删组件/删页面之后忘了删样式，靠它挡住）。

### 只搬代码、不改行为时，额外做一件事

```bash
cd frontend
npx vite build --ssr ssr-smoke/entry.js --outDir ssr-smoke/dist-ssr --logLevel warn
node ssr-smoke/snapshot.mjs ../before     # 改动前
# …搬代码…
node ssr-smoke/snapshot.mjs ../after      # 改动后，逐字节比对
```

差异必须能逐项解释。上一轮把 1540 行的 `App.vue` 拆成 15 个页面文件夹，
就是靠这个确认「13 条路由逐字节相同，另外两条的差异是去 scoped 的 `data-v` 属性和补回的外层包裹」。
**注意它只能证明渲染没变，证明不了 CSS 没变**——纯样式改动要靠构建产物大小/hash 对比。

---

## 六、绝对不要做的事

- **不要动 `legacy/`。** 那是归档，不参与构建。
- **不要删 `frontend/scripts/*.mjs` 里的 `KNOWN_UNSTYLED` / `KNOWN_UNREFERENCED` /
  `KNOWN_SCOPED_STYLES` / `KNOWN_UNUSED_CSS` 清单。** 它们是「已知问题」的登记簿。
  修好了对应的东西，脚本会反过来提醒你删掉那一行；手动清空清单只会让检查失效。
- **不要重排 `styles/index.css` 的 import。** 那不是一个「列表」，是层叠顺序。
- **不要给自检脚本加依赖。** 装依赖才能跑的自检，最后一定没人跑。
- **不要新建 `.md` 文档却不更新索引。** 新增/删除文档时同步改
  `README.md`、`项目结构说明.md`、`CONTRIBUTING.md`、以及**本文件**里指向它的地方。
- **不要绕过检查。** 检查红了就改代码，不要改检查；确实要放行就加一条带原因的登记，
  并保证那条登记在过期时会报错。

---

## 七、不确定时去哪看

| 问题 | 看哪 |
| --- | --- |
| 整个结构长什么样、某层负责什么 | `项目结构说明.md` |
| 加东西的具体步骤与理由 | `CONTRIBUTING.md` |
| 前端怎么跑 / 怎么测 | `frontend/README.md` |
| 某个目录的边界 | 那个目录自己的 `README.md` |
| 每个自检脚本挡什么 | `frontend/scripts/README.md` |
| 上线 / 环境变量 / 免费额度 | `deploy/HOSTING.md`、`frontend/.env.example` |
| 数据库结构与 RLS | `supabase/README.md` |
| 历史上踩过什么坑 | `CHANGELOG.md` |

注释默认写**为什么**，不写「这行在做什么」。踩过的坑要写清楚现象与原因，能省掉下一个人半小时。
