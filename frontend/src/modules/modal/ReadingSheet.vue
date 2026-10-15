<script setup>
// 阅读类弹窗的共用外壳：**表头与底部操作固定，只有正文滚动**。
//
// 原来日记和文章各自用 ModalShell 的 bare 模式，卡片是「整张一起滚」的
// （见 base.css 的 `.modal-card{max-height:...;overflow:auto}`）——
// 日记读到一半，日期和标题就滚出屏幕了，文章更是一直要滚回去才能关。
//
// 所以阅读的版面单独抽成这样一层：head 固定、scroll 滚动、foot 固定。
// 日记与文章共用一个外壳，以后要调阅读体验（字号、行距、滚动行为）只改这里
// 和 styles/polish-and-light-theme.css 最后那一节，不会再出现「改了一处漏一处」。
//
// 和 ModalShell 的分工：ModalShell 管普通表单弹窗（标题行 + 关闭 + 整卡滚动）；
// 这里管阅读（页眉自己排、正文独立滚动）。两边的关闭按钮都复用 `.modal-close`。
defineProps({
  cardClass: { type: [String, Array, Object], default: '' },
  backdropClass: { type: [String, Array, Object], default: '' },
  closeLabel: { type: String, default: '关闭阅读' },
})
defineEmits(['close'])
</script>

<template>
  <div class="modal-backdrop reading-backdrop" :class="backdropClass" @click.self="$emit('close')">
    <article class="modal-card reading-sheet" :class="cardClass">
      <header class="reading-head">
        <slot name="head" />
        <button class="modal-close reading-close" :aria-label="closeLabel" @click="$emit('close')">×</button>
      </header>
      <div class="reading-scroll">
        <slot />
      </div>
      <footer v-if="$slots.actions" class="reading-foot">
        <slot name="actions" />
      </footer>
    </article>
  </div>
</template>
