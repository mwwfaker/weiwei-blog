# 唯唯园 · 前端

Vue 3.5 + Vite 的浏览器端。结构、边界与约定见下面几条，**每个目录里还有一份自己的 `README.md`**。

## 跑起来

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

不配环境变量也能跑：前端会进入**本机预览模式**，数据只留在这个浏览器里，不连任何后端。
要连真实的 Supabase，复制 `.env.example` 成 `.env.local` 并填三个变量。

## 命令

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 开发服务器（`--host 0.0.0.0`，局域网可访问） |
| `npm run build` | 生产构建到 `dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm run new:page -- <id> "标题"` | **加一个页面**：建目录并把三处注册点一起改掉 |
| `npm run verify` | 12 项静态结构检查（见 `scripts/README.md`） |
| `npm run verify:all` | 上面这个 + 歌词 / 绩效 / OCR / 日记导入四个离线自检 |
| `npm run test:render` | 把路由表里的每条路由各 SSR 渲染一遍，再单渲染歌词栏与音乐盒的 7 个状态分支 |
| `npm test` | `verify:all` + `test:render` |
| `npm run verify:supabase` | 对真实 Supabase 跑 19 项数据层与权限隔离测试（需要环境变量） |

**提交前至少跑 `npm run verify:all && npm run test:render`。** CI（`.github/workflows/deploy-pages.yml`）也是这么跑的。

## 目录

```
src/
  App.vue              入口，只挂 AppShell
  main.js              createApp + Pinia + router + 样式入口
  app/                 骨架：路由表、页面注册表、导航表、页面调度、提示、登录守卫
  layouts/             应用外壳：AppShell / AppTopBar / AppDock
  pages/               15 个页面，一个页面一个文件夹
  modules/             跨页面复用的块（页面通用件、弹窗、文章、日记、相册、音乐、粒子）
  stores/              全部跨组件状态（Pinia）
  services/            与外部打交道：HTTP、对象存储、歌词接口、OCR、纯计算
  composables/         可复用的组合式函数（目前只有动效层）
  data/                接口没答上来时用的内置示例
  styles/              按层叠顺序拆开的样式表
scripts/               自检脚本（不引依赖）
ssr-smoke/             渲染冒烟测试
public/                原样拷进产物的静态资源（目前只有 favicon.svg）
```

> `public/` 里的文件会**原样复制**到 `dist/` 根目录，不做压缩也不加 hash，所以这里只放
> 「文件名固定、不需要打包」的东西（图标、`robots.txt` 之类）。需要 import 的图片放 `src/` 下。
> 也正因为如此，这个目录故意没有 `README.md`——它会被一起发布到线上。

## 判断一段新代码该放哪

| 要加的东西 | 放哪 |
| --- | --- |
| 新页面 | 建 `src/pages/<名字>/`，然后同时改 `app/routes.js`、`app/pageRegistry.js`、`app/navigation.js` |
| 只在一个页面用的板块 | `src/pages/<页面>/components/` |
| 属于某个领域的组件（含外壳要挂载的） | `src/modules/<主题>/`，并在那里登记「谁在用我」 |
| 跨组件的状态 | `src/stores/<域名>.js` |
| 只服务一个页面的状态 | 跟着那个页面走，不进 store |
| 调用后端 / 对象存储 | `src/services/`（不要直接写在组件里） |
| 新样式 | `src/styles/` 里对应的文件；**import 顺序就是层叠顺序**，别重排 |

## 三条容易踩的约定

1. **页面组件只做编排**：数据从 store 拿，动作调 store 的方法。页面里出现 `request(...)` 或
   `localStorage` 就是放错位置了。
2. **不要写 `<style scoped>`**：样式集中在 `src/styles/`，按层叠顺序组织。唯一例外是按需加载的
   页面（`pages/perf/perf.css` 由组件自己 import，跟着异步 chunk 走）。
3. **`v-reveal` 要在组件里 import**：它是局部注册的指令，没有全局注册——渲染测试会单独挂载组件，
   那时没有全局指令可用。`npm run verify` 会检查这一条。

## 更详细的东西

- 整个仓库的结构与各层职责：见仓库根目录的 [`项目结构说明.md`](../项目结构说明.md)
- 每个目录的边界与「加东西时放哪」：见该目录下的 `README.md`
- 上线步骤与边界：见 [`deploy/HOSTING.md`](../deploy/HOSTING.md)
