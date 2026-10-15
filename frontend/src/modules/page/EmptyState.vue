<script setup>
// 空列表的统一提示。有些地方的动作按钮是次要样式（例如「管理我的日记」），用 variant 区分。
defineProps({
  icon: { type: String, default: '✳' },
  title: { type: String, default: '' },
  text: { type: String, default: '' },
  actionLabel: { type: String, default: '' },
  variant: { type: String, default: 'primary' },
})
defineEmits(['action'])
</script>

<template>
  <div class="empty-state">
    <span>{{ icon }}</span>
    <h3>{{ title }}</h3>
    <p>{{ text }}</p>
    <button
      v-if="actionLabel"
      :class="variant === 'secondary' ? 'button-secondary' : 'button-primary'"
      @click="$emit('action')"
    >{{ actionLabel }}</button>
  </div>
</template>
