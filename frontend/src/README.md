# `frontend/src/` — 源码索引

九个目录，按「它属于哪一层」划分。判断一段新代码放哪，先回到这里的表：

| 目录 | 是哪一层 | 判断标准 |
| --- | --- | --- |
| （根）`App.vue` `main.js` | 入口 | 只挂外壳、装插件；全站级 provider 放这里 |
| `app/` | 应用骨架 | 路由、页面注册表、页面调度、导航表、全局提示、登录守卫 |
| `layouts/` | 应用外壳 | 除页面内容以外的一切：侧边栏、顶栏、常驻播放器与弹窗的挂载点 |
| `pages/` | **页面** | 一个页面一个文件夹（15 个），各自带 `components/` |
| `modules/` | **领域组件** | 按领域成套装；与「页面版面部件」的区别见该目录 README |
| `stores/` | 状态 | 所有跨组件的状态（Pinia） |
| `composables/` | 复用逻辑 | 能被任意组件复用的 Vue 逻辑 |
| `services/` | 外部世界 | HTTP、对象存储、歌词接口、OCR、纯计算；**不读响应式状态** |
| `data/` | 示例内容 | 接口还没答上来时用于预览的内置示例 |
| `styles/` | 样式 | 全站共用样式；**import 顺序即层叠顺序** |

更详细的边界说明与「加东西时的对照表」见仓库根目录的
[`项目结构说明.md`](../../项目结构说明.md)；改动约定见 [`CONTRIBUTING.md`](../../CONTRIBUTING.md)。

## 三条最容易搞混的边界

1. **只在一个页面里用 → `pages/<页面>/components/`；被第二个页面用上 → `modules/`。**
2. **跨组件状态 → `stores/`；只服务一个页面 → 跟着那个页面走。**
   页面组件里出现 `request(...)` 或 `localStorage` 就是放错位置了。
3. **样式一律进 `styles/`**，不要写 `<style scoped>`。唯一例外是按需加载的页面
   （`pages/perf/perf.css`、`pages/clipboard/clipboard.css` 由组件自己 import，
   跟着异步 chunk 走、不进首屏包）。

## 这些约束是自动检查的

```bash
cd frontend && npm run verify
```

第 [3] 项查页面 id ↔ 路由 ↔ 页面注册表一致、页面组件是否住在 `pages/<id>/`；
第 [8] 项查本目录下每个子目录是否都有 `README.md`；
第 [1][2][4][9] 项查模板引用了不存在的东西、指令没 import、class 没样式、孤儿文件。
