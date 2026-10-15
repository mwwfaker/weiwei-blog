<script setup>
// 「导入截图」：选队列 → 上传截图（或粘贴文本）→ 核对 → 写入。
// 识别与写数据都在 composables/usePerfImport.js（状态要跨标签页活着），
// 这里只负责界面与拖拽/选文件这些纯交互。
import { ref } from 'vue'

defineProps({
  queues: { type: Array, default: () => [] },
  members: { type: Array, default: () => [] },
  importRows: { type: Array, default: () => [] },
  importBusy: { type: Boolean, default: false },
  importMessage: { type: String, default: '' },
  importPlan: { type: Object, default: () => ({ update: 0, create: 0, total: 0 }) },
})
const emit = defineEmits(['parse', 'apply', 'cancel', 'pick-file'])

const activeQueue = defineModel('activeQueue', { type: String, default: '' })
const importText = defineModel('importText', { type: String, default: '' })

const screenshotInput = ref(null)
// 拖拽悬停只是个视觉状态，只被这一块用，所以留在面板里。
const dropActive = ref(false)

async function handleScreenshot(event) {
  const file = event.target.files?.[0]
  if (screenshotInput.value) screenshotInput.value.value = ''
  emit('pick-file', file)
}

/** 拖一张图片进来。 */
function handleDrop(event) {
  event.preventDefault()
  dropActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) emit('pick-file', file)
}
</script>

<template>
  <section class="perf-import">
    <div class="perf-card">
      <h3>1. 这批数据属于哪个队列</h3>
      <select v-model="activeQueue" class="perf-wide">
        <option v-for="q in queues" :key="q.name" :value="q.name">{{ q.name }}</option>
      </select>
      <p class="perf-hint">导入会把每个人的数字写进「{{ activeQueue }}」这一列，也就是「录数据」页面选中的那个队列。</p>

      <h3>2. 上传这个队列的截图</h3>
      <div
        class="shot-zone"
        :class="{ busy: importBusy, drag: dropActive }"
        role="button"
        tabindex="0"
        @click="screenshotInput?.click()"
        @keydown.enter="screenshotInput?.click()"
        @dragover.prevent="dropActive = true"
        @dragleave="dropActive = false"
        @drop="handleDrop"
      >
        <span class="shot-icon" aria-hidden="true">⇪</span>
        <strong>{{ importBusy ? '识别中…' : '点击选择截图' }}</strong>
        <span class="shot-tip">也可以直接 <b>Ctrl + V</b> 粘贴，或把图片拖进来</span>
        <input ref="screenshotInput" type="file" accept="image/*" hidden @change="handleScreenshot" />
      </div>

      <h3>3. 或者从飞书复制文本粘贴</h3>
      <textarea v-model="importText" rows="4" placeholder="把三列连表头一起复制，粘贴到这里"></textarea>
      <button class="perf-btn" :disabled="!importText.trim()" @click="emit('parse')">解析文本</button>
      <p class="perf-hint">
        名字认错不影响：匹配靠的是邮箱里的<b>工号</b>。实测你那张截图里 12 个人的工号和审核量都能正确识别，
        只有邮箱文字会被认错（域名里的 tech 会变成 fech）。
      </p>
    </div>

    <div class="perf-card">
      <h3>4. 核对并写入「{{ activeQueue }}」</h3>
      <p v-if="importMessage" class="perf-hint">{{ importMessage }}</p>
      <div v-if="importRows.length" class="perf-review">
        <table class="perf-grid">
          <thead><tr><th>工号</th><th>识别到的名字</th><th>匹配到</th><th class="num">已审数</th><th class="num">平均审核时长</th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in importRows" :key="index" :class="{ unmatched: !row.matchedId }">
              <td>{{ row.employeeNo || '—' }}</td>
              <td><input v-model="row.nameGuess" class="perf-cell" /></td>
              <td>
                <select v-model="row.matchedId" class="perf-cell">
                  <option value="">（按工号新建）</option>
                  <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
                </select>
                <small class="perf-sub">{{ row.matchedId ? row.matchReason : '会新建一个人' }}</small>
              </td>
              <td class="num"><input type="number" class="perf-cell" v-model.number="row.auditCount" /></td>
              <td class="num">
                <input type="number" step="0.01" class="perf-cell" v-model.number="row.actualAht" />
                <small v-if="row.inferredDecimal" class="perf-sub warn">小数点是推断的</small>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="perf-hint">识别结果会显示在这里，确认无误再写入。</p>

      <!-- 二次确认：写进去之前先让人过一遍 -->
      <div v-if="importRows.length" class="perf-confirm">
        <div class="perf-confirm-text">
          将写入队列 <strong>{{ activeQueue }}</strong>：
          <strong>{{ importPlan.update }}</strong> 人更新数据<template v-if="importPlan.create">，<strong>{{ importPlan.create }}</strong> 人是新面孔（会同时加进员工名单）</template>。
        </div>
        <div class="perf-confirm-actions">
          <button class="perf-btn primary" @click="emit('apply')">✓ 确认写入 {{ importPlan.total }} 行</button>
          <button class="perf-btn" @click="emit('cancel')">取消</button>
        </div>
      </div>
    </div>
  </section>
</template>
