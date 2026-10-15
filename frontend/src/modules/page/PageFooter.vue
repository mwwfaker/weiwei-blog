<script setup>
// 页面页脚。首页和日记页各有一条文案不同的版本。
defineProps({
  name: { type: String, default: '' },
  note: { type: String, default: '' },
})
</script>

<template>
  <footer class="page-footer">
    <span>Made with <b>♡</b> by {{ name }}</span>
    <span>{{ note }}</span>
  </footer>
</template>
