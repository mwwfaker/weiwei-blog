<script setup>
// 导入的学习计划：把 Word 解析出来的结构渲染成一页。
// 不假设任何学科：h2 = 阶段、h3 = 阶段里的条目（课程/章节/模块都行）。
import { computed } from 'vue'
import DocBlocks from './DocBlocks.vue'

const props = defineProps({ doc: { type: Object, required: true } })
defineEmits(['back', 'remove'])

/** 目录：每段一个锚点。文档很长时，这一行比滚动条有用。 */
const toc = computed(() => (props.doc.sections || [])
  .map((section, index) => ({ id: `doc-sec-${index}`, title: section.title }))
  .filter((entry) => entry.title))

/** 字数与阅读时长：让人在打开前知道这是「十分钟」还是「两小时」。 */
const stats = computed(() => {
  let chars = 0
  const walk = (blocks) => {
    for (const block of blocks || []) {
      if (block.type === 'p' || block.type === 'quote') chars += (block.text || '').length
      else if (block.type === 'list' || block.type === 'links') chars += (block.items || []).map((i) => i.text || '').join('').length
      else if (block.type === 'table') chars += (block.rows || []).flat().join('').length
    }
  }
  walk(props.doc.lead)
  for (const section of props.doc.sections || []) {
    walk(section.blocks)
    for (const item of section.items || []) walk(item.blocks)
  }
  return { chars, minutes: Math.max(1, Math.round(chars / 420)) }
})

function jumpTo(id) {
  if (typeof document === 'undefined') return
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section class="doc-view">
    <header class="doc-hero">
      <div class="doc-kicker">IMPORTED STUDY PLAN</div>
      <h1 class="doc-title">{{ doc.title }}</h1>
      <p v-if="doc.subtitle" class="doc-subtitle">{{ doc.subtitle }}</p>
      <div class="doc-meta">
        <span>{{ doc.sections.length }} 个阶段</span>
        <span>·</span>
        <span>{{ doc.count }} 个条目</span>
        <span>·</span>
        <span>约 {{ stats.minutes }} 分钟读完</span>
        <span v-if="doc.importedAt">· 导入于 {{ doc.importedAt.slice(0, 10) }}</span>
      </div>
      <div class="doc-actions">
        <button class="doc-btn" @click="$emit('back')">← 学习库</button>
        <button class="doc-btn doc-btn-quiet" @click="$emit('remove')">移除这份文档</button>
      </div>
    </header>

    <nav v-if="toc.length" class="doc-toc" aria-label="文档目录">
      <button v-for="entry in toc" :key="entry.id" class="doc-toc-item" @click="jumpTo(entry.id)">
        {{ entry.title }}
      </button>
    </nav>

    <DocBlocks v-if="doc.lead?.length" :blocks="doc.lead" />

    <section v-for="(section, index) in doc.sections" :id="`doc-sec-${index}`" :key="index" class="doc-section">
      <h2 class="doc-section-title">
        <span class="doc-section-index">{{ String(index + 1).padStart(2, '0') }}</span>
        {{ section.title || `第 ${index + 1} 部分` }}
      </h2>
      <DocBlocks :blocks="section.blocks" />
      <article v-for="(item, i) in section.items" :key="i" class="doc-item">
        <h3 class="doc-item-title">{{ item.title }}</h3>
        <DocBlocks :blocks="item.blocks" />
      </article>
    </section>
  </section>
</template>
