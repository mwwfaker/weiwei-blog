import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')

// 1) 用行内表单替换掉两个 window.prompt
const start = s.indexOf('function addQueue() {')
const end = s.indexOf('function removeQueue(name) {')
if (start < 0 || end < 0) { console.log('ADD ANCHOR MISSING'); process.exit(1) }
const form = `// 新增队列用行内表单，不再用 window.prompt（两个弹框太糙，而且没法校验）
const queueForm = ref({ open: false, name: '', kpi: '', error: '' })
function openQueueForm() {
  queueForm.value = { open: true, name: '', kpi: '', error: '' }
}
function cancelQueueForm() {
  queueForm.value = { open: false, name: '', kpi: '', error: '' }
}
function submitQueue() {
  const name = String(queueForm.value.name || '').trim()
  if (!name) { queueForm.value.error = '请填队列名称'; return }
  if (queues.value.some((q) => q.name === name)) { queueForm.value.error = '已经有同名队列了'; return }
  const kpi = Math.max(0, Math.round(Number(queueForm.value.kpi) || 0))
  queues.value.push({ name, kpi })
  cancelQueueForm()
}

`
s = s.slice(0, start) + form + s.slice(end)

// 2) 按钮改为打开表单，并在下面插入表单本身
s = s.replace('<button class="perf-btn primary" @click="addQueue">＋ 添加队列</button>',
              '<button class="perf-btn primary" @click="openQueueForm">＋ 添加队列</button>')

const barAnchor = `          <span class="perf-hint">
            这里就是队列管理：给每个队列一个名字和一个 KPI。标准 AHT 和单价都由 KPI 算出来，
            改了 KPI 所有用到它的地方立刻跟着变。
          </span>
        </div>`
const barNew = `          <span class="perf-hint">
            这里就是队列管理：给每个队列一个名字和一个 KPI。标准 AHT 和单价都由 KPI 算出来，
            改了 KPI 所有用到它的地方立刻跟着变。
          </span>
        </div>

        <!-- 新增队列：行内表单，带校验，不用弹窗 -->
        <div v-if="queueForm.open" class="queue-add">
          <span class="queue-add-title">新队列</span>
          <label>名称
            <input v-model="queueForm.name" class="perf-cell" placeholder="比如 图片" @keyup.enter="submitQueue" />
          </label>
          <label>KPI
            <input v-model="queueForm.kpi" type="number" class="perf-cell" placeholder="比如 884" @keyup.enter="submitQueue" />
          </label>
          <button class="perf-btn primary" @click="submitQueue">添加</button>
          <button class="perf-btn" @click="cancelQueueForm">取消</button>
          <span v-if="queueForm.error" class="queue-add-error">{{ queueForm.error }}</span>
          <span v-else class="perf-hint">填好 KPI 后，标准 AHT 和单价会自动算出来</span>
        </div>`
if (!s.includes(barAnchor)) { console.log('BAR ANCHOR MISSING'); process.exit(1) }
s = s.replace(barAnchor, barNew)

// 3) 样式
const cssAt = s.lastIndexOf('</style>')
const css = `/* 新增队列的行内表单 */
.queue-add{
  display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;
  padding:12px 14px;border-radius:13px;
  border:1px solid color-mix(in srgb,var(--accent) 40%,transparent);
  background:linear-gradient(120deg,color-mix(in srgb,var(--accent) 12%,var(--panel)),var(--panel));
  animation:queueAddIn .28s cubic-bezier(.22,.9,.24,1) both;
}
@keyframes queueAddIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
.queue-add-title{font-family:var(--serif);font-size:13.5px;font-weight:600;align-self:center}
.queue-add label{display:grid;gap:4px;font-size:10px;color:var(--muted)}
.queue-add input{width:150px}
.queue-add-error{font-size:11.5px;color:#e0716f}

`
fs.writeFileSync(f, s.slice(0, cssAt) + css + s.slice(cssAt), 'utf8')
console.log('行内表单已加入')
