<script setup>
// 日记阅读弹窗。版面走 ReadingSheet：页眉（日期·天气 心情 + 标题 + 标签）固定，
// 只有正文滚动；底部动作也固定，读到哪儿都能直接编辑或导出。
//
// 正文按行切成段落来排（不是把整篇塞进一个 <p> 靠 pre-wrap 换行）：
// 这样才能给每段加「首行缩进两字 + 段间距」，中文长文读起来才像书；
// 落款（`00:26莫唯唯` 那行）单独右对齐收尾——它是签名，不该混在正文里。
//   ⚠️ 有几篇没有落款行（2023-07-05 只有时间、2024-11-28 与 2025-02-07 干脆没有），
//      所以这里必须「看着像才拆」，不能认定最后一行一定是落款。
//
// 字号与行距在 styles/polish-and-light-theme.css 的「阅读」一节里统一调，文章共用同一套。
import { computed } from 'vue'
import ReadingSheet from '@/modules/modal/ReadingSheet.vue'
import { isLocalId } from '@/app/ids'

const props = defineProps({ entry: { type: Object, required: true } })
defineEmits(['close', 'edit', 'export'])

const SIGN_LINE = /^\d{1,2}\s*[:：]\s*\d{1,2}/

const body = computed(() => {
  const lines = String(props.entry.content || '').replace(/\r/g, '').split('\n')
  let sign = ''
  let end = lines.length
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const last = lines[i].trim()
    if (!last) continue
    if (SIGN_LINE.test(last) && last.length <= 16) { sign = last; end = i }
    break
  }
  const paragraphs = lines.slice(0, end).map((line) => line.trim()).filter(Boolean)
  return { paragraphs, sign }
})
</script>

<template>
  <ReadingSheet card-class="diary-reading" close-label="关闭阅读" :count-text="props.entry.content" @close="$emit('close')">
    <template #head>
      <div class="reading-headline">
        <div class="reading-meta">{{ props.entry.date }} &nbsp;·&nbsp; {{ props.entry.weather }} {{ props.entry.mood }}</div>
        <h2>{{ props.entry.title }}</h2>
        <div class="reading-tags"><span v-for="tag in props.entry.tags" :key="tag"># {{ tag }}</span></div>
      </div>
    </template>

    <div class="reading-body">
      <p v-for="(text, index) in body.paragraphs" :key="index" class="reading-paragraph">{{ text }}</p>
      <p v-if="body.sign" class="reading-sign">{{ body.sign }}</p>
    </div>

    <template #actions>
      <div class="reading-actions">
        <button class="button-secondary" @click="$emit('export', props.entry)">导出 TXT</button>
        <button v-if="props.entry.mine || isLocalId(props.entry.id)" class="button-primary" @click="$emit('edit', props.entry)">编辑日记 ↗</button>
      </div>
    </template>
  </ReadingSheet>
</template>
