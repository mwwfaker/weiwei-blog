# 参与这个项目

这个仓库是个人项目，这份文档主要是写给**未来的自己**：隔半年回来加一个页面时，
照这里做就不会把结构重新搞乱。

> **如果你是用 AI 改这个仓库**：根目录的 [`AGENTS.md`](AGENTS.md) 是它在新会话里唯一会
> **自动读到**的文件（DSH 会把「项目根目录 → 当前目录」链上的 `AGENTS.md` 注入第一条消息）。
> 换句话说，光把约定写在这里没用，得写进 `AGENTS.md`。两份文件说的是同一件事，
> `AGENTS.md` 更短、只写「必须照做且会被检查」的部分。

完整结构见 [`项目结构说明.md`](项目结构说明.md)；每个目录还有一份自己的 `README.md`。

## 四条铁律

（准确说现在是五条，其中第 2、4 条是这次对齐文档时补正的——
原来写的「被两个以上页面用到才升级到 modules」和代码实际做法不符。）

1. **一个页面一个文件夹，一个板块一个组件。**
   页面放 `frontend/src/pages/<页面>/`，只属于它的板块放它自己的 `components/`。
2. **`frontend/src/modules/<主题>/` 按领域成套装组件**（music / diary / media / article / page /
   modal / profile / particle）。判断标准是「它属于哪个领域、外壳是否要挂载它」，
   **不是「现在有几个页面在用」**——`modules/music/` 里既有一处挂载、全站可用的音乐盒，
   也有只服务音乐页的曲库面板。
   放到 `pages/<页面>/components/` 的是**只属于那一页版面的部件**（工具条、统计块、面板）。
   拿不准就问自己：如果这个页面被删掉，这个组件还有别的地方能去吗？有 → `modules/`，没有 → `components/`。
3. **每个新目录都要配一份 `README.md`。** 写短一点没关系：这个目录装什么、边界在哪、
   往里加东西时注意什么。`npm run verify` 会对 `frontend/src` 下的每个目录检查这一条。
4. **样式只有两种合法放法**：全局的进 `frontend/src/styles/`（追加到文件末尾），
   按需加载的页面把样式放自己的文件夹、由组件加载（`pages/perf/perf.css` 是 `import './perf.css'`）。
   **不要写新的 `<style scoped>`**——它给选择器加一个属性选择器（类 + 属性），会压过 `styles/`
   里同选择器的规则。「统一圆角」那一层就是这么对学习页失效的，学习页到现在还有三种圆角。
   第 [11] 项会拦住新的写法。
5. **页面 / 模块组件只做编排**，`services/` 不读响应式状态。组件里出现 `request(...)`、
   `uploadMedia(...)` 或 `localStorage` 就是放错位置了；`services/` 里出现 `import ... from 'vue'`
   或 store 同理。第 [10] 项会拦下来。

## 加一个页面

**跑生成器，不要手改**：

```bash
cd frontend
npm run new:page -- notes "随手记"             # 进「更多」菜单
npm run new:page -- stats "数据看板" --primary  # 进主导航
```

它会建好目录并把**三处注册点同时改掉**（漏一处页面就是死的，第 [3] 项检查会挡下来）：

1. `frontend/src/app/routes.js` —— 加一条路由记录（`name` 就是页面 id）
2. `frontend/src/app/pageRegistry.js` —— 页面 id → 组件（带几百 kB 的页面改用 `defineAsyncComponent`）
3. `frontend/src/app/navigation.js` —— 加到主导航或「更多」里

生成出来的目录长这样：

```
frontend/src/pages/<页面 id>/
  <Xxx>Page.vue        # 只做编排：数据从 store 拿，动作调 store 的方法
  components/          # 只有这个页面用的板块（有需要才建，建了就要配 README）
  README.md            # 这个页面是干什么的、状态从哪来、有什么坑
```

页面组件里出现 `request(...)` 或 `localStorage` 就是放错位置了——那些属于 `services/` 与 `stores/`。

## 改已有的模块

这是最常发生的事，也最容易让结构重新烂掉。顺序是：

1. **先读那个目录的 `README.md`** —— 它写着这个目录装什么、以及踩过的坑。
   不知道要改的东西属于哪一层，看 `frontend/src/README.md` 的九层表。
2. **落点由「改的是哪一层」决定**，不是由「哪个文件好改」决定：

   | 你要改的 | 落点 |
   | --- | --- |
   | 界面长什么样、点一下干什么 | 组件 / 页面 |
   | 数据从哪来、怎么存、跨页共享 | `stores/` |
   | 接口怎么拼、格式怎么转 | `services/` |
   | 颜色、间距、动效 | `styles/` 里对应的文件（**追加到末尾**） |

3. **板块长大了就拆出来。** 单文件超过 400 行 `npm run verify` 会提示（第 [12] 项）。
   拆出来的东西按铁律第 2 条决定去 `pages/<页面>/components/` 还是 `modules/<主题>/`。
4. **改了就更新那段 README**，尤其是「需要注意的地方」那节：写现象 + 原因。
5. **不要顺手改行为。** 发现 bug 先报告，别在结构调整里夹带修复——
   那会让「只搬代码」的逐字节比对失去意义。
6. 收工跑「提交前」那三条命令。

## 加一块可复用的东西

放进 `frontend/src/modules/<主题>/`，并且在 `modules/README.md` 的表里登记一行「谁在用我」。
写不出这个答案、而且它只属于某一个页面的版面，那就应该放 `pages/<页面>/components/`。

## 加状态

- 跨组件、跨页面 → `frontend/src/stores/<域名>.js`
- 只服务一个页面 → 跟着那个页面走，不进 store

保持依赖单向。现在的方向是：
`library → {articles, diaries, media, music, profile}`、`music → media`、
`articles/diaries → media/profile`、`profile → media`。**没有回边**，加新 store 时别破坏它。

## 加样式

放进 `frontend/src/styles/` 里对应的文件，**追加到文件末尾**。
`styles/index.css` 的 import 顺序**就是层叠顺序**，不要重排、不要插队——
这份样式表是按「开发与修复轮次」一层层追加出来的，后面的轮次一直在覆盖前面的同选择器声明。

## 加接口调用

统一走 `frontend/src/services/api.js` 的 `request(pattern, options)`。
后端（或者说 Supabase 那边）的权限规则写在数据库的 RLS 策略里，不在前端。

## 提交前

```bash
cd frontend
npm run verify:all      # 12 项结构检查 + 歌词 / 绩效 / OCR / 日记导入四个离线自检
npm run test:render     # 用真实路由把 16 个页面各渲染一遍，再渲染歌词栏与音乐盒的状态分支
npm run build           # 生产构建
```

三样都要绿。CI 跑的也是这三样（`.github/workflows/deploy-pages.yml`）。

如果这次改动**只搬代码、不改行为**，额外做一件事：用
`node frontend/ssr-smoke/snapshot.mjs <目录>` 在改动前后各存一份各路由的渲染结果，
逐字节比对。它能把「重构时不小心少抄了一个 class」这类问题当场抓住。

## 注释怎么写

这个仓库的注释默认写**为什么**，不写「这行在做什么」。

反例：`// 遍历数组并过滤`。
正例：`// 滚动容器会裁掉绝对定位的子元素，所以菜单要 teleport 到 body（见 verify 第 7 项）`。

历史上踩过的坑值得写清楚：某个写法为什么被换掉、换掉之后会出现什么现象。
这类注释能省掉下一个人半小时。
