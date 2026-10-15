<script setup>
// 日记卡片。「我的日记」多一行操作（编辑 / 公开 / 导出 / 删除）并在元信息里显示可见范围；
// 「公开日记」只有阅读。两处结构一致，所以用两个开关控制。
defineProps({
  entry: { type: Object, required: true },
  showActions: { type: Boolean, default: false },
  showVisibility: { type: Boolean, default: false },
})
defineEmits(['open', 'edit', 'toggle-visibility', 'export', 'remove'])
</script>

<template>
  <article class="diary-card">
    <button class="diary-card-main" @click="$emit('open', entry)">
      <span class="calendar-badge">
        <strong>{{ entry.date.slice(8) }}</strong>
        <small>{{ entry.date.slice(0, 7).replace('-', ' / ') }}</small>
      </span>
      <span class="diary-card-body">
        <span class="diary-card-top">
          <b>{{ entry.title }}</b>
          <span v-if="showVisibility">{{ entry.weather }} &nbsp; {{ entry.mood }} &nbsp;·&nbsp; {{ entry.visibility === 'PUBLIC' ? '◉ 公开' : '◌ 仅自己' }}</span>
          <span v-else>{{ entry.weather }} &nbsp; {{ entry.mood }}</span>
        </span>
        <span class="diary-excerpt">{{ entry.content }}</span>
        <span class="tag-list"><i v-for="tag in entry.tags" :key="tag"># {{ tag }}</i></span>
      </span>
      <span class="diary-chevron">↗</span>
    </button>
    <div v-if="showActions" class="diary-card-actions">
      <button @click="$emit('edit', entry)">编辑</button>
      <button @click="$emit('toggle-visibility', entry)">{{ entry.visibility === 'PUBLIC' ? '设为私密' : '公开' }}</button>
      <button @click="$emit('export', entry)">导出</button>
      <button @click="$emit('remove', entry.id)">删除</button>
    </div>
  </article>
</template>
