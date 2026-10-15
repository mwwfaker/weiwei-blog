# `modules/modal/` — 弹窗外壳

两个外壳，按「滚什么」分工：

| 文件 | 管什么 | 滚动的是 |
| --- | --- | --- |
| `ModalShell.vue` | 普通表单弹窗：背板 + 卡片 + 标题行 + 关闭按钮 | **整张卡片**（`base.css` 的 `.modal-card{max-height;overflow:auto}`） |
| `ReadingSheet.vue` | 阅读弹窗：页眉固定 / 正文独立滚动 / 底部操作固定 | **只有正文**（`.reading-scroll`） |

九处表单弹窗原来各自抄了一遍 ModalShell 那套结构，其中四处漏了 `aria-label`、一处写错了关闭动作。

## `ReadingSheet` 为什么单独存在

日记和文章原来都用 `ModalShell bare`，于是「整张卡片一起滚」——日记读到一半日期标题就滚出屏幕，
文章更是一直要滚回顶部才能关。阅读需要的是一件 ModalShell 做不到的事：**把页眉和底部钉住**。

**共用的只是这套滚动机制，不是外观。** 两个插槽（`head`、默认 = 正文）加一个可选的 `actions`，
版式、字号、图片怎么排全部由调用方决定：

```vue
<ReadingSheet card-class="diary-reading" :count-text="entry.content" @close="...">
  <template #head>日期 · 标题 · 标签</template>
  正文……
  <template #actions>导出 / 编辑</template>
</ReadingSheet>
```

## 入场 / 退场动效（这就是那份「对话框模板」）

阅读框本身自带动效，别的弹窗要同样的手感直接套 `ReadingSheet` 就行：

| 时机 | 效果 |
| --- | --- |
| 打开 | 桌面**从侧面滑到中央**（哪一侧由 `from` 决定），手机**从下滑到中央**。缓动的第二段带一点点过冲（y 收在 1.02），滑到位时会「压一下再回弹」 |
| 关闭（叉 / **点空白** / 调用方主动关） | **先定住一拍（180ms）**，再让卡片模糊、发白、上浮并**消散成尘埃**，同时铺一层粒子飘散层 |

三条关闭路径都进同一个 `requestClose()`，行为一致——**其中没有哪一条是「直接关掉、不动画」的**。
（`@click.self` 保证只有点在卡片外的空白处才算，点卡片里面不会误关。）

### `from`：从哪一边滑进来

`from` 只有 `'right'`（默认）和 `'left'` 两档，调用方按**用户点的那张卡片在哪一侧**传。
日记的时间树用的是**交叉**：卡片在左边，弹窗就从**右边**进来（从右往左扫过去），
卡片在右则从左边进来——和挂件入场的方向规则一致，两边对着走。
写了别的值一律按右边处理，免得一个笔误让弹窗从屏幕外永远飞进来。

**手机端不看这个值**：窄屏弹窗本来就满宽，左右滑没有意义，一律从下往上（`sheetRise`）。
所以 `is-from-*` 的两条规则写在 `@media(min-width:761px)` 里面。

**退场开头那 180ms 的静止是必要的**：一上来就化灰「看不见」——眼睛需要一拍才反应过来要发生什么。
但别调大，超过 ~250ms 就会被当成卡住了。它对应 CSS 关键帧里的 `0%,15%`
（`DUST_HOLD_MS / DUST_MS ≈ 15%`），CSS 关键帧的选择器不能写 `var()`，所以这两个数字
**必须手动对齐**，改一个记得改另一个。粒子的起始延迟由 `hold` 传下去，和它是同一个数。

**退场动画必须由组件自己播完再 `emit('close')`。** 外层一般是 `v-if`，一上来就 emit 的话
父组件立刻把它从 DOM 摘掉，动画根本没机会开始——这也正是原来文章阅读弹窗外层要包
`<Transition name="reader">` 的原因（那个 Transition 已经移除，现在组件自己管）。
正因为如此，**外层不要再给它包 `<Transition>`**，两套会打架。

时长写在 JS 里（`ENTER_MS` / `DUST_MS`），通过 `--enter-ms` / `--dust-ms` 下发给样式，
两边不会各写一个数字对不上；JS 用 `DUST_MS` 决定何时 emit。

- `motion=false` 或系统开着 `prefers-reduced-motion` 时不做动效，直接关。
- 粒子数：宽屏 420 / 窄屏 240（在 `ReadingSheet` 里按 `matchMedia('(min-width: 761px)')` 选）。
  每个粒子都带发光阴影，手机上给多了不划算。
- **粒子要「看得出来」靠四件事**（第一版太含蓄，用户反馈看不见）：
  够大（2~8px）、够亮（三种浅色调 + `box-shadow` 辉光，因为背板是深色的）、
  停留够久（每颗 620~950ms，亮度在前 40% 基本不衰减）、够多。调这四个，不要只加数量。
- **粒子层的落点有兜底**：正常用卡片的 `getBoundingClientRect()`；万一量不到（ref 没就绪之类），
  退回一块屏幕中央的区域。宁可铺得不准，也不能一声不响地什么都不显示——这种「静默失效」
  最难查，因为它看起来就像没做这个效果。
- **说清楚的取舍**：粒子不采样卡片像素（那要引 html2canvas 之类依赖），用的是主题色。
  所以它是「同一片尘埃」，不是「这张卡片的碎屑」——观感主要来自数量、随机延迟和上飘。

## 右下角的字数由外壳算

传 `countText`（正文）进来，外壳在右下角渲染「共 N 字」。**口径放在一处**是有意的：
日记和文章要的是同一个数字（去掉空白后的字符数），各写一遍迟早会出现一处算了空白、一处没算。
没有 `actions` 时页脚照样显示字数——访客读公开日记时看不到按钮，但应该看得到字数。

所以日记（`.diary-reading`，窄卡片）和文章（`.article-reading`，整页、带封面图）**各自有一节样式**，
互不影响——见 `styles/polish-and-light-theme.css` 末尾的「阅读」一节。

## `ModalShell` Props

| prop | 说明 |
| --- | --- |
| `kicker` / `title` | 默认标题行的两行文字 |
| `rule` | kicker 后面那条小横线，默认 `true` |
| `bare` | 跳过默认标题行，正文由调用方全权负责（阅读类弹窗用它） |
| `cardClass` / `backdropClass` | 附加类名 |
| `as` | 卡片标签，`section`（表单）或 `article`（阅读正文） |
| `closeLabel` | 关闭按钮的无障碍标签 |

事件：`close`。

## 两种用法

普通表单弹窗：

```vue
<ModalShell title="曲目设置" kicker="MUSIC LIBRARY" @close="music.musicEditor = null">
  ...表单...
</ModalShell>
```

阅读类弹窗（自己的页眉排版）：

```vue
<Transition name="reader">
  <ModalShell bare as="article" card-class="diary-reading" @close="...">
    <div class="reading-toolbar">...</div>
    ...
  </ModalShell>
</Transition>
```

**过渡动画由调用方包**：`<Transition>` 要求只有一个子节点，把外壳包在里面最省事。
