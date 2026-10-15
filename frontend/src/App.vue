<script setup>
// App.vue 现在只是一个入口：真正的结构在 layouts/AppShell.vue。
//
// 保留这一层是为了两件事：
//   1. 渲染测试与 main.js 的入口路径不变（都挂 App）；
//   2. 将来要加全站级的 provider（错误边界、i18n）时，有地方放而不必动外壳。
import AppShell from '@/layouts/AppShell.vue'
</script>

<template>
  <AppShell />
</template>
