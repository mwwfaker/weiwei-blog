# `modules/page/` — 页面通用件

内页排版里反复出现、和业务无关的四块。抽出来之前，15 个内页各自抄了一遍同样的四层嵌套。

| 文件 | 用途 | 关键 prop |
| --- | --- | --- |
| `InnerPageHeader.vue` | 内页标题区：kicker + 主标题 + 说明，右侧插槽放本页操作 | `kicker` `title` `mark` `subtitle` `rule` |
| `SectionHeading.vue` | 二级标题，右侧可选一个链接按钮 | `kicker` `title` `actionLabel`，事件 `action` |
| `PageFooter.vue` | 页面页脚 | `name` `note` |
| `EmptyState.vue` | 空列表提示，动作按钮可有可无 | `icon` `title` `text` `actionLabel` `variant` |

## 两个容易忽略的 prop

- `mark`：主标题后面的装饰符号（`✧` `◈` `♫` …）。留空就不渲染那个 `<em>`。
- `rule`：kicker 后面那条小横线。创作管理页是唯一不需要它的页面，所以默认 `true`。

## 用法

```vue
<InnerPageHeader kicker="STORIES & THOUGHTS" title="文章宇宙" mark="✧" subtitle="一句话说明。">
  <button class="button-primary" @click="articles.create()">＋ &nbsp;写文章</button>
</InnerPageHeader>
```
