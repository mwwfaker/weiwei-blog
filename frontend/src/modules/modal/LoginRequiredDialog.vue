<script setup>
// 「这个工具要登录」的对话框。
//
// 为什么单独一层弹窗而不是一句 toast：绩效计算器是用户特意点进来的工具，
// 只弹一条 2.6 秒就消失的提示、再把人甩到账号页，看起来像「点错了」。
// 弹窗能停下来说清「为什么」并给出两个明确选择。
//
// 版式刻意做成三段：一句结论（为什么拦你）→ 三条要点（登录到底管什么）→ 两个出口。
// 原来只有一段灰字加两个挤在一起的按钮，读起来像报错。
//
// 内容由 app/useGuard.js 的 loginPrompt 决定，这里不持有状态。
import ModalShell from './ModalShell.vue'

defineProps({
  /** 用户在做什么，例如「绩效计算器」。 */
  action: { type: String, default: '这个工具' },
  /** 需要额外解释时的一句话；空的话就用 action 拼一句。 */
  reason: { type: String, default: '' },
})
defineEmits(['close', 'login'])
</script>

<template>
  <ModalShell kicker="MEMBERS ONLY" title="需要先登录" card-class="login-gate" @close="$emit('close')">
    <p class="login-gate-lead">{{ reason || `${action}要登录后才能使用。` }}</p>

    <ul class="login-gate-list">
      <li><b>看不用登录</b>文章、日记、相册、音乐都是公开的，登录与否看到的一样。</li>
      <li><b>改才要登录</b>这个工具写入的是账号里的数据，所以要先确认身份。</li>
      <li><b>注册暂时关闭</b>需要账号请联系唯唯。</li>
    </ul>

    <div class="login-gate-actions">
      <button class="login-gate-cancel" type="button" @click="$emit('close')">先逛逛</button>
      <button class="button-primary" type="button" @click="$emit('login')">去登录 ↗</button>
    </div>
  </ModalShell>
</template>
