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
| 打开 | 桌面**从右滑到中央**，手机**从下滑到中央**。缓动的第二段带一点点过冲（y 收在 1.02），滑到位时会「压一下再回弹」 |
| 关闭（叉 / 点空白 / 调用方主动关） | 卡片模糊、发白、上浮并**消散成尘埃**，同时铺一层 150 个粒子的飘散层 |

三条关闭路径都进同一个 `requestClose()`，行为一致。

**退场动画必须由组件自己播完再 `emit('close')`。** 外层一般是 `v-if`，一上来就 emit 的话
父组件立刻把它从 DOM 摘掉，动画根本没机会开始——这也正是原来文章阅读弹窗外层要包
`<Transition name="reader">` 的原因（那个 Transition 已经移除，现在组件自己管）。
正因为如此，**外层不要再给它包 `<Transition>`**，两套会打架。

时长写在 JS 里（`ENTER_MS` / `DUST_MS`），通过 `--enter-ms` / `--dust-ms` 下发给样式，
两边不会各写一个数字对不上；JS 用 `DUST_MS` 决定何时 emit。

- `motion=false` 或系统开着 `prefers-reduced-motion` 时不做动效，直接关。
- 粒子数：`DustBurst` 的 `count`（默认 150），手机上可以少给一些。
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
