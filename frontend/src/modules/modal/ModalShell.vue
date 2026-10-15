<script setup>
// 所有弹窗的外壳：半透明背板（点空白关闭）+ 卡片。
//
// 九处弹窗原本各自抄了一遍背板、卡片、标题行和关闭按钮，其中四处漏了 aria-label 或写错了
// 关闭动作。放在这里之后只有一处需要维护。
//
// 阅读类弹窗（文章 / 日记）有自己的页眉排版（日期在左上、关闭按钮在右上），
// 用 `bare` 跳过默认标题行，由调用方自己排。
defineProps({
  kicker: { type: String, default: '' },
  title: { type: String, default: '' },
  /** kicker 后面那条小横线。 */
  rule: { type: Boolean, default: true },
  /** 跳过默认标题行，body 全权由调用方负责。 */
  bare: { type: Boolean, default: false },
  /** 卡片与背板的附加类名。 */
  cardClass: { type: [String, Array, Object], default: '' },
  backdropClass: { type: [String, Array, Object], default: '' },
  /** 卡片标签：普通表单用 section，阅读正文用 article。 */
  as: { type: String, default: 'section' },
  closeLabel: { type: String, default: '关闭' },
})
defineEmits(['close'])
</script>

<template>
  <div class="modal-backdrop" :class="backdropClass" @click.self="$emit('close')">
    <component :is="as" class="modal-card" :class="cardClass">
      <div v-if="!bare" class="modal-top">
        <div>
          <div v-if="kicker" class="section-kicker">{{ kicker }} <span v-if="rule"></span></div>
          <h2 v-if="title">{{ title }}</h2>
        </div>
        <button class="modal-close" :aria-label="closeLabel" @click="$emit('close')">×</button>
      </div>
      <slot />
    </component>
  </div>
</template>
