# 日记

路由 `/diary`。**一个页面装两个视图**：「我的日记」和「公开日记」。

## 文件

| 文件 | 内容 |
| --- | --- |
| `DiaryPage.vue` | 编排：标题区随视图切换、**时间树**、导入入口、页脚 |
| `components/DiaryToolbar.vue` | 视图标签、范围筛选（全部 / 仅自己 / 已公开）、搜索框、篇数 |

两个视图都交给 `src/modules/diary/DiaryTree.vue` 渲染成「挂件挂在时间轴上」的形态
（为什么是树、左右怎么定、增删怎么长高变矮，见那个文件的注释与 `modules/diary/README.md`）。

编辑弹窗、阅读弹窗、导入确认弹窗都在 `src/modules/diary/`，由外壳挂载。

## 两个视图怎么切

靠 `diaries.diaryTab`（`'mine'` / `'public'`），**不走路由**，地址栏始终是 `#/diary`。

- `diaries.showMyDiary` = 已登录 **且** 当前是 `mine` 标签。访客没有「我的日记」这一份。
- 老地址 `#/public-diary` 会被 `resolvePageName()` 认成「日记页 + 公开标签」，然后替换成 `#/diary`。

## 两份列表不是同一份数据

| 视图 | 数据源 | 可见性 |
| --- | --- | --- |
| 我的日记 | `/api/diaries`（要 token） | 自己的全部，含私密 |
| 公开日记 | `/api/public/diaries` | 所有人的公开日记，登录与否完全一致 |

`publicDiaries` 会把「自己那份里的公开日记」和「服务器返回的公开列表」去重合并：
自己刚改完可见范围时，本机那份才是最新的。

## 导入

`.txt` 和 `.docx`（用 mammoth 读）。流程是**先解析成草稿让人核对，确认后才写库**
（`diaries.parseImportFiles()` → `DiaryImportDialog` → `diaries.confirmImport()`）。

一个文件里装很多篇（「整合日记」，按日期头隔开）会被拆成一篇篇，逐篇可改可删；
弹窗顶端还有「统一发布权限」，一次把全部草稿设成公开或仅自己
（`diaries.applyImportVisibility()`），也可以用每篇自己的按钮单独改。

入库用 `Promise.allSettled` 而不是 `Promise.all`：一篇失败不能让服务器已经接受的那几篇
跟着一起"消失"，否则重试弹窗会插进重复内容。被拒的那几篇会留在列表里等重试。

## 首页的「日记碎片」也用这里的 store

`diaries.homeDiaries` 决定显示谁的日记，详见 `pages/home/README.md`。
