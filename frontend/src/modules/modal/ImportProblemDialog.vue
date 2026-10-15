<script setup>
// 「这个文件打不开」的提示窗。
//
// 为什么值得一个独立的弹窗（而不是 toast）：这些失败**用户多半看不懂**，
// 而且**照直觉做会更糟**——WPS 的「私密文档」如果去点「另存为」，
// 那页保护提示写明会导致数据丢失且无法恢复。toast 一闪而过，读不完也记不住，
// 所以这里要停下来把「为什么 + 该怎么办」说清楚。
//
// 内容由 services/articleImport.js 的 `importProblem()` 生成（纯函数，能在 Node 里对拍），
// 这个组件只负责排版。日记导入和文章导入共用同一个提示窗。
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useImportAlert } from '@/composables/useImportAlert'

const { alert, dismiss } = useImportAlert()
</script>

<template>
  <ModalShell
    v-if="alert"
    close-label="关闭提示"
    card-class="import-problem-card"
    kicker="IMPORT BLOCKED · 没能导入"
    :title="alert.title"
    @close="dismiss()"
  >
    <p class="import-problem-message">{{ alert.message }}</p>

    <ol v-if="alert.steps?.length" class="import-problem-steps">
      <li v-for="(step, index) in alert.steps" :key="index">{{ step }}</li>
    </ol>

    <div class="modal-actions">
      <span>这个文件不会被记录，也不会留下半份内容。</span>
      <button class="button-primary" @click="dismiss()">我知道了</button>
    </div>
  </ModalShell>
</template>
