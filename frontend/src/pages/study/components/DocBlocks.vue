<script setup>
// 渲染一个内容块。只处理解析器认识的类型，其余已经退化成段落。
defineProps({ blocks: { type: Array, default: () => [] } })
</script>

<template>
  <template v-for="(block, index) in blocks" :key="index">
    <p v-if="block.type === 'p'" class="doc-p">{{ block.text }}</p>
    <blockquote v-else-if="block.type === 'quote'" class="doc-quote">{{ block.text }}</blockquote>
    <ul v-else-if="block.type === 'list' && !block.ordered" class="doc-list">
      <li v-for="(item, i) in block.items" :key="i">
        {{ item.text }}
        <a v-for="link in item.links || []" :key="link.href" :href="link.href" target="_blank" rel="noopener noreferrer">↗ {{ link.text }}</a>
      </li>
    </ul>
    <ol v-else-if="block.type === 'list'" class="doc-list doc-list-ordered">
      <li v-for="(item, i) in block.items" :key="i">{{ item.text }}</li>
    </ol>
    <div v-else-if="block.type === 'links'" class="doc-links">
      <a v-for="link in block.items" :key="link.href" :href="link.href" target="_blank" rel="noopener noreferrer">{{ link.text }} ↗</a>
    </div>
    <div v-else-if="block.type === 'table'" class="doc-table-wrap">
      <table class="doc-table">
        <tbody>
          <tr v-for="(row, r) in block.rows" :key="r">
            <td v-for="(cell, c) in row" :key="c">{{ cell }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </template>
</template>
