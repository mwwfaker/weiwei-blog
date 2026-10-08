import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')

// 1) 把 handleScreenshot 拆成「拿文件」和「处理文件」，并加上粘贴 / 拖拽
const start = s.indexOf('async function handleScreenshot(event) {')
const end = s.indexOf('function applyImport() {')
if (start < 0 || end < 0) { console.log('SHOT ANCHOR MISSING'); process.exit(1) }
const block = `/** 拿到一张截图就开始识别（本地选择、Ctrl+V 粘贴、拖拽都走这里）。 */
async function processImageFile(file) {
  if (!file || !String(file.type).startsWith('image/')) return
  importBusy.value = true
  importMessage.value = '正在识别图片…首次会下载中英文识别模型（约 20 MB）。'
  importRows.value = []
  try {
    const { text, confidence } = await recognizeImage(file, (p) => {
      if (p.progress) importMessage.value = \`正在识别图片… \${Math.round(p.progress * 100)}%\`
    })
    importText.value = text
    setParsed(text, confidence)
  } catch (error) {
    importMessage.value = \`识别失败：\${error.message}。可以直接从页面复制文本粘贴。\`
  } finally {
    importBusy.value = false
  }
}

async function handleScreenshot(event) {
  const file = event.target.files?.[0]
  if (screenshotInput.value) screenshotInput.value.value = ''
  await processImageFile(file)
}

/** Ctrl+V：剪贴板里是图片就识别，是文本就直接当粘贴内容解析。 */
function handlePaste(event) {
  const data = event.clipboardData
  if (!data) return
  const items = data.items ? [...data.items] : []
  for (const item of items) {
    if (item.kind === 'file' && String(item.type).startsWith('image/')) {
      const file = item.getAsFile()
      if (file) {
        event.preventDefault()
        processImageFile(file)
        return
      }
    }
  }
  const text = data.getData ? data.getData('text') : ''
  if (text && text.includes('@')) {
    event.preventDefault()
    importText.value = text
    setParsed(text)
  }
}

/** 拖一张图片进来。 */
function handleDrop(event) {
  event.preventDefault()
  dropActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file) processImageFile(file)
}
const dropActive = ref(false)

`
s = s.slice(0, start) + block + s.slice(end)

// 2) 只在「导入截图」这个标签页上监听粘贴，切走就摘掉
s = s.replace("onMounted(pullWorkspace)", `// 粘贴只在导入页生效，切走就摘掉监听，免得在别处 Ctrl+V 被吃掉
watch(tab, (now) => {
  if (typeof document === 'undefined') return
  if (now === 'import') document.addEventListener('paste', handlePaste)
  else document.removeEventListener('paste', handlePaste)
}, { immediate: true })

onMounted(pullWorkspace)`)
s = s.replace("onUnmounted(() => clearTimeout(syncTimer))", "onUnmounted(() => {\n  clearTimeout(syncTimer)\n  if (typeof document !== 'undefined') document.removeEventListener('paste', handlePaste)\n})")

// 3) 换成方形上传区
const oldZone = `          <div class="perf-upload">
            <button class="perf-btn primary" :disabled="importBusy" @click="screenshotInput?.click()">{{ importBusy ? '识别中…' : '选择截图' }}</button>
            <input ref="screenshotInput" type="file" accept="image/*" hidden @change="handleScreenshot" />
            <span class="perf-hint">截图里要有「审核员 / 已审数 / 平均审核时长」三列。</span>
          </div>`
const newZone = `          <div
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
          </div>`
if (!s.includes(oldZone)) { console.log('ZONE ANCHOR MISSING'); process.exit(1) }
s = s.replace(oldZone, newZone)

// 4) 样式
const at = s.lastIndexOf('</style>')
const css = `/* 方形上传区：点击 / Ctrl+V / 拖拽 */
.shot-zone{
  display:grid;place-items:center;gap:4px;align-content:center;
  width:100%;max-width:260px;aspect-ratio:1/1;padding:16px;text-align:center;
  border-radius:16px;border:2px dashed color-mix(in srgb,var(--accent) 38%,transparent);
  background:color-mix(in srgb,var(--accent) 6%,transparent);
  cursor:pointer;transition:border-color .3s ease,background-color .3s ease,transform .3s ease;
}
.shot-zone:hover,.shot-zone:focus-visible{outline:none;border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent);transform:translateY(-2px)}
.shot-zone.drag{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 20%,transparent)}
.shot-zone.busy{cursor:progress;opacity:.75}
.shot-icon{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;font-size:20px;color:#fff;background:linear-gradient(140deg,#a97cf0,#7a52d8)}
.shot-zone strong{font-family:var(--serif);font-size:14px}
.shot-tip{font-size:10.5px;line-height:1.6;color:var(--muted)}
.shot-tip b{color:var(--accent)}

`
fs.writeFileSync(f, s.slice(0, at) + css + s.slice(at), 'utf8')
console.log('方形上传区 + 粘贴 + 拖拽已加入')
