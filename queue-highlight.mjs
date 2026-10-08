import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
// 新增之后高亮一下新行，让人知道加在哪了
s = s.replace("  queues.value.push({ name, kpi })\n  cancelQueueForm()",
              "  queues.value.push({ name, kpi })\n  highlightedQueue.value = name\n  clearTimeout(highlightTimer)\n  highlightTimer = setTimeout(() => { highlightedQueue.value = '' }, 2200)\n  cancelQueueForm()")
s = s.replace("const queueForm = ref({ open: false, name: '', kpi: '', error: '' })",
              "const queueForm = ref({ open: false, name: '', kpi: '', error: '' })\nconst highlightedQueue = ref('')\nlet highlightTimer")
s = s.replace('<tr v-for="(queue, index) in queues" :key="queue.name + index">',
              '<tr v-for="(queue, index) in queues" :key="queue.name + index" :class="{ fresh: queue.name === highlightedQueue }">')
const at = s.lastIndexOf('</style>')
s = s.slice(0, at) + `/* 刚新增的队列高亮两秒 */
.perf-grid.queues tbody tr.fresh{background:color-mix(in srgb,var(--accent) 16%,transparent);animation:queueAddIn .3s cubic-bezier(.22,.9,.24,1) both}
` + s.slice(at)
fs.writeFileSync(f, s, 'utf8')
console.log('新增行高亮已加入')
