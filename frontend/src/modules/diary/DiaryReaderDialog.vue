<script setup>
// 日记阅读弹窗。页眉是「日期 · 天气 心情 + 关闭」，走 ModalShell 的 bare 模式。
import ModalShell from '@/modules/modal/ModalShell.vue'
import { isLocalId } from '@/app/ids'

const props = defineProps({ entry: { type: Object, required: true } })
defineEmits(['close', 'edit', 'export'])
</script>

<template>
  <ModalShell bare as="article" card-class="diary-reading" close-label="关闭阅读" @close="$emit('close')">
    <div class="reading-meta">{{ props.entry.date }} &nbsp;·&nbsp; {{ props.entry.weather }} {{ props.entry.mood }}</div>
    <button class="modal-close reading-close" aria-label="关闭阅读" @click="$emit('close')">×</button>
    <h2>{{ props.entry.title }}</h2>
    <div class="reading-tags"><span v-for="tag in props.entry.tags" :key="tag"># {{ tag }}</span></div>
    <p>{{ props.entry.content }}</p>
    <div class="reading-actions">
      <button class="button-secondary" @click="$emit('export', props.entry)">导出 TXT</button>
      <button v-if="props.entry.mine || isLocalId(props.entry.id)" class="button-primary" @click="$emit('edit', props.entry)">编辑日记 ↗</button>
    </div>
  </ModalShell>
</template>
