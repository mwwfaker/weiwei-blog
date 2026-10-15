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
<ReadingSheet card-class="diary-reading" @close="...">
  <template #head>日期 · 标题 · 标签</template>
  正文……
  <template #actions>导出 / 编辑</template>
</ReadingSheet>
```

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
