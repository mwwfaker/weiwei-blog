# 首页

路由 `/`。首页有**两套完全不同的版面**，按主题切换：

| 主题 | 版面 | 组件 |
| --- | --- | --- |
| 深色（夜） | 「一个世界」：全屏夜空，内容直接排在世界里滚动 | `HomePage.vue` + `components/HeroScene.vue` |
| 浅色（昼） | 「玻璃光学」：整页浅色光场，内容是一层层会反光的玻璃，光斑跟着指针走 | `components/DayGlass.vue` |

## 夜：一个世界

`HeroScene` 固定铺满视口：液态虹彩背景 + 粒子字「唯唯园」+ 绕着它运行的日记星体。
拖拽旋转、鼠标搅散粒子字、悬停星体看标题、点击打开日记、点空白放冲击波。
内容分四段（开场 / 01 最近的故事 / 02 去别处 / 03 日子）直接排在世界里，滚动时镜头后退、粒子字淡出。

## 昼：玻璃光学

整页是一块被光穿过的工作台：浅色光场打底，内容是一层层真的会反光的玻璃。
指针在整页上移动时，**整页的光斑跟着走**，首屏那叠玻璃还会轻微转向（`--lx/--ly` 与 `--rx/--ry` 写进根节点）。
章节依次是：玻璃首屏（三层玻璃 + 飘着的碎玻璃 + 日记小卡）/ 最近的故事（玻璃面板）/ 去别处（三块玻璃门）/ 日子（玻璃列表）。

## 状态从哪来

`diaries.homeShowsOwnDiaries`（自己写过就用自己最近的，否则用公开日记）、`diaries.homeDiaries`、
`articles.articles.slice(0, 3)`、`diaries.diaries.length`、`media.allPhotoCount`、
`music.playableTracks.length`、`profile.profileName`。页面不持有业务状态。

## 样式

- 夜：`styles/home-stage.css`
- 昼：`styles/home-day.css`
两份都接在 `styles/index.css` 的 import 列表最后，类名前缀分别是 `.world` / `.glass-`，互不覆盖。

## 性能与降级

three.js 只在 `HeroScene` 挂载时动态 import；省电模式不下载 three。
白天版面是纯 DOM/CSS，没有 WebGL。画布离开视口或标签页隐藏时停止渲染。
