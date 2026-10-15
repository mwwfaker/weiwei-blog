<script setup>
// 公开只读提示：只有在「看的不是自己那一份 / 没登录」时由 PerfPage 渲染出来。
defineProps({
  ownerName: { type: String, default: '' },
  loggedIn: { type: Boolean, default: false },
})
</script>

<template>
  <p class="perf-readonly-note">
    <strong>公开只读</strong>
    绩效数据对所有人开放，登录不登录都看得到；当前显示的是「{{ ownerName }}」的那一份。<template v-if="!loggedIn">登录后可以编辑自己账号的数据。</template><template v-else>这不是你自己的数据，所以只能查看。</template>
  </p>
</template>
