# `src/pages/` — 页面

一个页面一个文件夹。文件夹里至少有：

```
<页面>/
  <Xxx>Page.vue        # 页面本体：编排，不写业务逻辑
  components/          # 只有这个页面用的板块（有需要才建）
  README.md            # 这个页面是干什么的、状态从哪来、有什么坑
```

## 页面清单

| 页面 | 路由 | 文件夹 |
| --- | --- | --- |
| 首页 | `/` | `home/` |
| 关于我 | `/about` | `about/` |
| 学习路线 | `/study` | `study/`（金融计划 + 围巾编织两份计划，共用一个页面） |
| 文章宇宙 | `/articles` | `articles/` |
| 日记 | `/diary` | `diary/` |
| 相册 | `/gallery` | `gallery/` |
| 音乐收藏 | `/music` | `music/` |
| 留言板 | `/messages` | `messages/` |
| 工具箱 | `/tools` | `tools/`（工具类页面都从这里进） |
| 快捷复制 | `/clipboard` | `clipboard/`（整屏工具页，数据只在本机） |
| 创作管理 | `/admin` | `admin/` |
| 绩效计算器 | `/perf` | `perf/`（独立小项目，见它自己的 README） |
| 账号 | `/account` | `account/` |

> 「公开日记」没有独立文件夹：它是日记页里的第二个标签，由 `diaries.diaryTab` 控制。
> 老的 `#/public-diary` 链接仍然能打开（见 `src/app/README.md`）。
>
> 「文章分类」「标签星图」「朋友们」「时光归档」四个页面已经删掉——分类和标签并进了文章页的筛选，
> 归档并进了日记与文章的时间轴，友链没有入口就一起下线了。**改这类东西时记得连样式一起删**：
> 那四个页面留下的 179 个死类名是第 [13] 项被加进来的直接原因。

## 写一个页面时的规矩

1. **页面组件只做编排。** 数据从 store 拿，动作调 store 的方法，可复用块从 `src/modules/` 引。
   页面里出现 `request(...)`、`uploadMedia(...)` 或 `localStorage` 就是放错位置了（第 [10] 项会拦）。
2. **`components/` 放只属于这一页版面的部件**（工具条、统计块、面板）。
   属于某个**领域**、或者外壳也要挂载的组件放 `src/modules/<主题>/`——
   两边的判断标准见 `src/modules/README.md`，它**不是**「被几个页面用了」。
3. **样式只有两种放法**：全局的进 `src/styles/`（追加到对应文件末尾），
   按需加载的页面把样式放自己的文件夹、由组件加载。
   **不要写 `<style scoped>`**（第 [11] 项会拦）——它会压过 `styles/` 里的覆盖层。
4. **`v-reveal` 要自己 import**，它没有全局注册。
5. **加页面别手改，跑生成器**：`npm run new:page -- <id> "标题"`。
   它会同时改好 `src/app/routes.js`、`src/app/pageRegistry.js`、`src/app/navigation.js` 三处——
   手动改漏一处页面就是死的，第 [3] 项会挡下来。
6. **超过 400 行的页面会被提示**（第 [12] 项）：多半是该拆的板块又堆回去了。
