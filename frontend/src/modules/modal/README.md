# `modules/modal/` — 弹窗外壳

`ModalShell.vue` 是所有弹窗的共同外壳：半透明背板（点空白关闭）+ 卡片 + 标题行 + 关闭按钮。

九处弹窗原来各自抄了一遍这套结构，其中四处漏了 `aria-label`、一处写错了关闭动作。

## Props

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
