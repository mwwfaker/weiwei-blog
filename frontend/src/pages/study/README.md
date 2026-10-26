# 学习路线

路由 `/study`。把一份份学习文档结构化呈现，并记录本机学习进度。
现在有两份计划：金融学系统自学路线、围巾编织学习大全。

## 为什么这一页是异步加载的

两份计划的数据加起来约 350 kB，跟着首屏包一起下载没必要。`app/pageRegistry.js` 里用
`defineAsyncComponent` 按需加载它，`delay: 140` 让热缓存下不会闪一下「正在展开学习路线…」。

## 文件

| 文件 | 内容 |
| --- | --- |
| `StudyPage.vue` | 页面本体：学习库、阶段/课程呈现、筛选与搜索、展开收起、进度 |
| `data/studyPlans.js` | **计划库**：一个数组，页面只从这里取计划 |
| `data/studyPlan.js` | 金融学：29 门课 / 5 个阶段的结构化数据 |
| `data/scarfPlan.js` | 围巾编织：17 个学习单元 / 6 个阶段，含视频与图解链接 |

## 进度存在哪

`localStorage` 的 `weiwei-blog-study-progress:<计划 id>`，读写走 `services/storage.js`
（它保证数据损坏或超配额时不会白屏）。按计划分开存，切换计划不会串进度。

## 为什么不拆得更碎

这一页是纯展示 + 本机进度，逻辑集中在「按阶段分组、筛选、展开」三件事上，
再拆成子组件只会让 props 比逻辑还长。**它是本项目里唯一一处刻意不拆的页面**，
如果以后要加交互（笔记、打卡），再按板块拆。

## ⚠ 它是全仓库唯一还在用 `<style scoped>` 的地方

约定是「样式只进 `styles/`，或按需加载的页面放自己的文件夹、由组件加载」，
这一页是历史遗留，登记在 `scripts/verify-frontend.mjs` 的 `KNOWN_SCOPED_STYLES` 里。

**它造成了一个真实的后果，值得记住：**

scoped 会给每条选择器加一个属性选择器（`.study-hero` → `.study-hero[data-v-xxx]`），
优先级从 (0,1,0) 变成 (0,2,0)，于是它**压过了全局样式表里的同选择器规则**。
而 `styles/polish-and-light-theme.css` 里那一层是这么写的：

```css
.music-player-panel,.study-panel,.study-resource-card,.study-course,.study-stage-card,.study-hero{border-radius:22px}
```

意图是「统一圆角、减少同一页面里出现四五种圆角」。但它从来没在学习页生效过——
这一页的 scoped 规则把圆角定成了 `.study-hero: 30px`、`.study-course/.study-panel/
.study-resource-card: 19px`、`.study-stage-card: 17px`，全都赢了。同理 `.study-check`
的 `transition` 也压过了那一层。

**这是「不要写 `<style scoped>`」这条规矩的真正理由**——不只是风格问题，
它会让 `styles/` 里的覆盖层**静默失效**，而且不报错、看不出来。新组件不要照抄这里的写法。

## 当前的两份计划

| 计划 | 数据 | 版面 |
| --- | --- | --- |
| 金融学系统自学路线 | `data/studyPlan.js` | 通用「课程 + 阶段」版面 |
| 围巾编织学习大全 | `data/scarfPlan.js` | 同一套通用版面 |

深链接：`#/study?plan=finance`、`#/study?plan=scarf`（id 从 `studyPlans` 里找，加计划不用改路由）。

**加一份新计划**：把文档给站主 → 在 `data/` 按 `studyPlan.js` 的结构出数据 →
在 `studyPlans.js` 里加一项。学习库卡片和深链接会自动长出来，
不需要新写组件、也不用改 `StudyPage.vue` 的模板。

计划里可选的两块：`weeklyNote`（每周节奏那句说明）、`order.foundationTitle`（地基那一栏的标题）；
`pythonTimeline` 只有金融计划有，缺了就不渲染那栏，别的计划不必硬造。
