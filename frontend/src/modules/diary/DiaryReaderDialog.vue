<script setup>
// 日记阅读弹窗。版面走 ReadingSheet：页眉（日期·天气 心情 + 标题 + 标签）固定，
// 只有正文滚动；底部动作也固定，读到哪儿都能直接编辑或导出。
//
// 字号与行距在 styles/polish-and-light-theme.css 的「阅读」一节里统一调，
// 不在这个组件里写死——文章阅读共用同一套。
import ReadingSheet from '@/modules/modal/ReadingSheet.vue'
import { isLocalId } from '@/app/ids'

const props = defineProps({ entry: { type: Object, required: true } })
defineEmits(['close', 'edit', 'export'])
</script>

<template>
  <ReadingSheet card-class="diary-reading" close-label="关闭阅读" @close="$emit('close')">
    <template #head>
      <div class="reading-headline">
        <div class="reading-meta">{{ props.entry.date }} &nbsp;·&nbsp; {{ props.entry.weather }} {{ props.entry.mood }}</div>
        <h2>{{ props.entry.title }}</h2>
        <div class="reading-tags"><span v-for="tag in props.entry.tags" :key="tag"># {{ tag }}</span></div>
      </div>
    </template>

    <p class="reading-text">{{ props.entry.content }}</p>

    <template #actions>
      <div class="reading-actions">
        <button class="button-secondary" @click="$emit('export', props.entry)">导出 TXT</button>
        <button v-if="props.entry.mine || isLocalId(props.entry.id)" class="button-primary" @click="$emit('edit', props.entry)">编辑日记 ↗</button>
      </div>
    </template>
  </ReadingSheet>
</template>
