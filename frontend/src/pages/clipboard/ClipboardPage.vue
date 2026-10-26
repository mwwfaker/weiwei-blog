<script setup>
// 快捷复制：整屏工具页，和绩效计算器共用一套「顶栏 + 标签条 + 面板」的骨架。
//
// 数据结构没动（sheet = 分类工作表，card = 一组数据，values = 那一组里的几条）：
// 一条数据就是一张卡片，多条自动成组；点任意一条直接写进剪贴板。
// 所有数据只在 localStorage，不登录、不上传。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { go } from '@/app/usePageNav'
import {
  createClipboardId,
  readClipboardWorkspace,
  writeClipboardWorkspace,
} from '@/services/clipboardStorage'
import './clipboard.css'

const workspace = ref(readClipboardWorkspace())
const activeSheetId = ref(workspace.value.activeSheetId)
const editorOpen = ref(false)
const sheetEditorOpen = ref(false)
const editingCardId = ref('')
const draftValues = ref('')
const draftSheetName = ref('')
const draggingCardId = ref('')
const draggingSheetId = ref('')
const dropSheetId = ref('')
const dropColumnIndex = ref(-1)
const notice = ref('')
const copiedKey = ref('')
const query = ref('')
const clipboardContentElement = ref(null)
const gridWidth = ref(0)
let noticeTimer = 0
let copiedTimer = 0
let gridResizeObserver

const clipboardColorPalette = [270, 194, 332, 154, 31, 216, 175, 300]

const activeSheet = computed(() => workspace.value.sheets.find((sheet) => sheet.id === activeSheetId.value) ?? workspace.value.sheets[0])
const sheetCards = computed(() => workspace.value.cards
  .filter((card) => card.sheetId === activeSheetId.value)
  .sort((a, b) => a.position - b.position || String(a.createdAt || '').localeCompare(String(b.createdAt || ''))))
const visibleCards = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return sheetCards.value
  return sheetCards.value.filter((card) => card.values.some((value) => value.toLowerCase().includes(keyword)))
})
const totalValues = computed(() => workspace.value.cards.reduce((sum, card) => sum + card.values.length, 0))

// 列宽固定 170px，列数跟着容器宽度长；卡片按「当前最矮的一列」往下填，
// 所以一列长短不齐也不会在中间留下大洞。拖到某一列会把列位（0–1 的比例）记进卡片，
// 换窗口宽度时比例不变，卡片不会突然跳到别的列。
const CLIPBOARD_COLUMN_WIDTH = 170
const CLIPBOARD_COLUMN_GAP = 12
const gridColumnCount = computed(() => Math.max(1, Math.floor((gridWidth.value + CLIPBOARD_COLUMN_GAP) / (CLIPBOARD_COLUMN_WIDTH + CLIPBOARD_COLUMN_GAP))))
const cardColumns = computed(() => {
  const columns = Array.from({ length: gridColumnCount.value }, () => [])
  const heights = columns.map(() => 0)
  for (const card of visibleCards.value) {
    const savedPlacement = card.columnPlacement
    const columnIndex = typeof savedPlacement === 'number' && Number.isFinite(savedPlacement)
      ? Math.max(0, Math.min(columns.length - 1, Math.round(savedPlacement * Math.max(0, columns.length - 1))))
      : heights.indexOf(Math.min(...heights))
    columns[columnIndex].push(card)
    // 估高只用于「填哪一列」：新卡头 + 每条数据两行，按条数线性估就够准。
    heights[columnIndex] += 104 + card.values.length * 46 + CLIPBOARD_COLUMN_GAP
  }
  return columns
})

watch(workspace, (value) => {
  try {
    value.activeSheetId = activeSheetId.value
    writeClipboardWorkspace(value)
  } catch {
    showNotice('浏览器存储空间不足，数据暂未保存')
  }
}, { deep: true })
watch(activeSheetId, (id) => { workspace.value.activeSheetId = id })

onMounted(() => {
  const container = clipboardContentElement.value
  if (!container) return
  gridWidth.value = container.clientWidth
  if (typeof ResizeObserver === 'undefined') return
  gridResizeObserver = new ResizeObserver(([entry]) => { gridWidth.value = entry.contentRect.width })
  gridResizeObserver.observe(container)
})

onBeforeUnmount(() => {
  window.clearTimeout(noticeTimer)
  window.clearTimeout(copiedTimer)
  gridResizeObserver?.disconnect()
})

function showNotice(message) {
  notice.value = message
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 2200)
}

function openCreate() {
  editingCardId.value = ''
  draftValues.value = ''
  editorOpen.value = true
}

function openEdit(card) {
  editingCardId.value = card.id
  draftValues.value = card.values.join('\n')
  editorOpen.value = true
}

function parsedValues() {
  return draftValues.value.split(/[\r\n\t]+/).map((value) => value.trim()).filter(Boolean)
}

function cardPaletteIndex(card) {
  let hash = 0
  for (const character of String(card.id || '')) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return hash % clipboardColorPalette.length
}

function clipboardValueHue(card, valueIndex) {
  return clipboardColorPalette[(cardPaletteIndex(card) + valueIndex * 3) % clipboardColorPalette.length]
}

/** 卡片「插图」里那个字：链接给 🔗、邮箱给 ✉️、电话给 📞，其余取首字符。 */
function badgeOf(card) {
  const first = String(card.values[0] || '').trim()
  if (!first) return '✧'
  if (/^https?:\/\//i.test(first)) return '🔗'
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(first)) return '✉️'
  if (/^[\d\s+\-()]{7,}$/.test(first)) return '📞'
  return String.fromCodePoint(first.codePointAt(0)).toUpperCase()
}

/** 悬停光斑跟着指针走：把指针位置写成卡片的 CSS 变量，::after 用它画圆。 */
function trackCardGlow(event) {
  const element = event.currentTarget
  const rect = element.getBoundingClientRect()
  element.style.setProperty('--pointer-x', `${event.clientX - rect.left}px`)
  element.style.setProperty('--pointer-y', `${event.clientY - rect.top}px`)
}

function saveCard() {
  const values = parsedValues()
  if (!values.length) {
    showNotice('先输入至少一条数据')
    return
  }
  const existing = workspace.value.cards.find((card) => card.id === editingCardId.value)
  if (existing) {
    existing.values = values
    existing.updatedAt = new Date().toISOString()
  } else {
    workspace.value.cards.push({
      id: createClipboardId(),
      sheetId: activeSheetId.value,
      position: Math.max(-1, ...workspace.value.cards
        .filter((card) => card.sheetId === activeSheetId.value)
        .map((card) => card.position)) + 1,
      values,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
  editorOpen.value = false
  showNotice('已保存')
}

function removeCard(card) {
  if (!window.confirm(`删除「${card.values[0]}」${card.values.length > 1 ? `等 ${card.values.length} 条数据` : ''}？`)) return
  workspace.value.cards = workspace.value.cards.filter((item) => item.id !== card.id)
  showNotice('已删除')
}

/** 拖到另一张卡片上 → 插到它前面。 */
function moveCard(card, targetCard) {
  if (card.id === targetCard.id) return
  const sourceSheetId = card.sheetId
  const targetSheetId = targetCard.sheetId
  card.sheetId = targetSheetId
  const ordered = workspace.value.cards
    .filter((item) => item.sheetId === targetSheetId)
    .sort((a, b) => a.position - b.position || String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
  const from = ordered.findIndex((item) => item.id === card.id)
  const to = ordered.findIndex((item) => item.id === targetCard.id)
  if (from < 0 || to < 0) return
  ordered.splice(to, 0, ordered.splice(from, 1)[0])
  ordered.forEach((item, index) => { item.position = index })
  if (sourceSheetId !== targetSheetId) {
    workspace.value.cards
      .filter((item) => item.sheetId === sourceSheetId)
      .sort((a, b) => a.position - b.position)
      .forEach((item, index) => { item.position = index })
  }
  showNotice('数据顺序已调整')
}

function setManualColumn(card, columnIndex) {
  const lastColumn = Math.max(0, gridColumnCount.value - 1)
  card.columnPlacement = lastColumn === 0 ? 0 : columnIndex / lastColumn
}

function moveSheet(sheetId, targetSheetId) {
  if (!sheetId || sheetId === targetSheetId) return
  const from = workspace.value.sheets.findIndex((sheet) => sheet.id === sheetId)
  const to = workspace.value.sheets.findIndex((sheet) => sheet.id === targetSheetId)
  if (from < 0 || to < 0) return
  workspace.value.sheets.splice(to, 0, workspace.value.sheets.splice(from, 1)[0])
  showNotice('分类顺序已调整')
}

function dragPayload(event) {
  const raw = event.dataTransfer.getData('text/plain')
  if (!raw) return null
  const separator = raw.indexOf(':')
  return separator < 0
    ? { type: 'card', id: raw }
    : { type: raw.slice(0, separator), id: raw.slice(separator + 1) }
}

function startCardDrag(event, card) {
  draggingCardId.value = card.id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', `card:${card.id}`)
}

function startSheetDrag(event, sheet) {
  draggingSheetId.value = sheet.id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', `sheet:${sheet.id}`)
}

function dragOverSheet(event, sheet) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dropSheetId.value = sheet.id
}

function dropOnSheet(event, sheet) {
  event.preventDefault()
  const payload = dragPayload(event)
  dropSheetId.value = ''
  if (payload?.type === 'sheet') {
    moveSheet(payload.id, sheet.id)
    return
  }
  if (payload?.type !== 'card') return
  const card = workspace.value.cards.find((item) => item.id === payload.id)
  if (!card || card.sheetId === sheet.id) return
  card.sheetId = sheet.id
  // 换分类后列位作废，否则它会按旧列号落进新分类的某一列。
  delete card.columnPlacement
  card.position = Math.max(-1, ...workspace.value.cards.filter((item) => item.sheetId === sheet.id).map((item) => item.position)) + 1
  activeSheetId.value = sheet.id
  showNotice(`已移动到「${sheet.name}」`)
}

function dragOverColumn(event, columnIndex) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dropColumnIndex.value = columnIndex
}

function dragLeaveColumn(event, columnIndex) {
  if (!event.currentTarget.contains(event.relatedTarget) && dropColumnIndex.value === columnIndex) {
    dropColumnIndex.value = -1
  }
}

/** 拖到某一列的空白处：按落点 Y 坐标插到对应卡片前面，并记住列位。 */
function dropOnColumn(event, columnIndex) {
  event.preventDefault()
  const payload = dragPayload(event)
  const card = payload?.type === 'card' && workspace.value.cards.find((item) => item.id === payload.id)
  dropColumnIndex.value = -1
  draggingCardId.value = ''
  if (!card) return

  const targetSheetId = activeSheetId.value
  const sourceSheetId = card.sheetId
  card.sheetId = targetSheetId
  const siblings = [...event.currentTarget.querySelectorAll('.clipboard-card')]
  const beforeElement = siblings.find((element) => element.dataset.cardId !== card.id
    && event.clientY < element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2)
  const beforeId = beforeElement?.dataset.cardId
  const ordered = workspace.value.cards
    .filter((item) => item.sheetId === targetSheetId && item.id !== card.id)
    .sort((a, b) => a.position - b.position || String(a.createdAt || '').localeCompare(String(b.createdAt || '')))
  const insertAt = beforeId ? ordered.findIndex((item) => item.id === beforeId) : ordered.length
  ordered.splice(insertAt < 0 ? ordered.length : insertAt, 0, card)
  ordered.forEach((item, index) => { item.position = index })
  setManualColumn(card, columnIndex)

  if (sourceSheetId !== targetSheetId) {
    workspace.value.cards
      .filter((item) => item.sheetId === sourceSheetId)
      .sort((a, b) => a.position - b.position)
      .forEach((item, index) => { item.position = index })
  }
  showNotice('卡片已放到此列')
}

function dropCard(event, targetCard, columnIndex) {
  event.preventDefault()
  const payload = dragPayload(event)
  const card = payload?.type === 'card' && workspace.value.cards.find((item) => item.id === payload.id)
  if (card) {
    moveCard(card, targetCard)
    setManualColumn(card, columnIndex)
  }
  draggingCardId.value = ''
  dropSheetId.value = ''
  dropColumnIndex.value = -1
}

function endCardDrag() {
  draggingCardId.value = ''
  dropSheetId.value = ''
  dropColumnIndex.value = -1
}

function endSheetDrag() {
  draggingSheetId.value = ''
  dropSheetId.value = ''
}

function openSheetEditor() {
  draftSheetName.value = ''
  sheetEditorOpen.value = true
}

function addSheet() {
  const name = draftSheetName.value.trim()
  if (!name) return showNotice('请填写分类名称')
  if (workspace.value.sheets.some((sheet) => sheet.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    return showNotice('这个分类已经存在')
  }
  const id = createClipboardId()
  workspace.value.sheets.push({ id, name, createdAt: new Date().toISOString() })
  activeSheetId.value = id
  sheetEditorOpen.value = false
}

function removeSheet() {
  if (workspace.value.sheets.length < 2) return showNotice('至少保留一个分类')
  const sheet = activeSheet.value
  if (!window.confirm(`删除「${sheet.name}」及其中 ${workspace.value.cards.filter((card) => card.sheetId === sheet.id).length} 张卡片？`)) return
  workspace.value.cards = workspace.value.cards.filter((card) => card.sheetId !== sheet.id)
  workspace.value.sheets = workspace.value.sheets.filter((item) => item.id !== sheet.id)
  workspace.value.activeSheetId = workspace.value.sheets[0].id
  activeSheetId.value = workspace.value.sheets[0].id
}

async function copyValue(value, key = value, message = '已复制，可以直接粘贴') {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const field = document.createElement('textarea')
    field.value = value
    field.setAttribute('readonly', '')
    field.style.position = 'fixed'
    field.style.opacity = '0'
    document.body.append(field)
    field.select()
    const copied = document.execCommand('copy')
    field.remove()
    if (!copied) return showNotice('复制失败，请检查浏览器剪贴板权限')
  }
  copiedKey.value = key
  window.clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => { copiedKey.value = '' }, 1300)
  showNotice(message)
}

function copyGroup(card) {
  copyValue(card.values.join('\n'), `group-${card.id}`, '已复制全部，可以直接粘贴')
}
</script>

<template>
  <main class="clipboard-workbench">
    <header class="clipboard-bar">
      <div class="clipboard-bar-left">
        <span class="clipboard-mark" aria-hidden="true">⧉</span>
        <div class="clipboard-bar-copy">
          <strong>快捷复制</strong>
          <small>点一下复制 · 数据只保存在本机</small>
        </div>
        <label class="clipboard-search">
          <span aria-hidden="true">⌕</span>
          <input v-model="query" type="search" placeholder="搜索标题或内容…" aria-label="搜索数据" />
        </label>
      </div>
      <div class="clipboard-bar-right">
        <span class="clipboard-stat">{{ totalValues }} 条数据 · {{ sheetCards.length }} 组</span>
        <span class="clipboard-local"><i aria-hidden="true"></i>仅保存在此浏览器</span>
        <button class="clipboard-btn" type="button" @click="go('tools')">← 工具箱</button>
      </div>
    </header>

    <section ref="clipboardContentElement" class="clipboard-content">
      <div class="clipboard-tabsbar">
        <div class="clipboard-tabs" role="tablist" aria-label="数据分类">
          <button
            v-for="sheet in workspace.sheets"
            :key="sheet.id"
            type="button"
            role="tab"
            class="clipboard-tab"
            :class="{ active: activeSheetId === sheet.id, 'is-drop-target': dropSheetId === sheet.id, 'is-dragging': draggingSheetId === sheet.id }"
            :aria-selected="activeSheetId === sheet.id"
            draggable="true"
            :title="`${sheet.name} · 拖动可调整顺序；也可把数据卡片拖到这里`"
            @dragstart="startSheetDrag($event, sheet)"
            @dragover="dragOverSheet($event, sheet)"
            @drop.stop="dropOnSheet($event, sheet)"
            @dragend="endSheetDrag"
            @click="activeSheetId = sheet.id"
          >{{ sheet.name }}<small>{{ workspace.cards.filter((card) => card.sheetId === sheet.id).reduce((sum, card) => sum + card.values.length, 0) }}</small></button>
          <button class="clipboard-add-sheet" type="button" aria-label="新建分类" title="新建分类" @click="openSheetEditor">＋</button>
        </div>
        <div class="clipboard-tab-actions">
          <span class="clipboard-hint">拖动排序 · 卡片可拖到分类上换组</span>
          <button class="clipboard-icon-action" type="button" title="删除当前分类" aria-label="删除当前分类" @click="removeSheet">⌫</button>
          <button class="clipboard-primary" type="button" @click="openCreate"><span>＋</span> 新数据</button>
        </div>
      </div>

      <div v-if="visibleCards.length" class="clipboard-grid" :style="{ '--column-count': cardColumns.length }">
        <div
          v-for="(column, columnIndex) in cardColumns"
          :key="columnIndex"
          class="clipboard-column"
          :class="{ 'is-drop-target': dropColumnIndex === columnIndex }"
          @dragover="dragOverColumn($event, columnIndex)"
          @dragleave="dragLeaveColumn($event, columnIndex)"
          @drop.stop="dropOnColumn($event, columnIndex)"
        >
        <article
          v-for="card in column"
          :key="card.id"
          :data-card-id="card.id"
          class="clipboard-card"
          :class="{ 'is-group': card.values.length > 1, 'is-dragging': draggingCardId === card.id }"
          :style="{ '--tile-hue': clipboardColorPalette[cardPaletteIndex(card)], '--card-delay': `${Math.min(Number(card.position || 0), 8) * 25}ms`, '--breath-delay': `${(Number(card.position || 0) % 5) * -1.15}s` }"
          draggable="true"
          @dragstart="startCardDrag($event, card)"
          @pointermove="trackCardGlow"
          @dragover.prevent
          @drop.stop="dropCard($event, card, columnIndex)"
          @dragend="endCardDrag"
        >
          <!-- 第一组数据就是这张卡的标题：点它就复制第一条。 -->
          <button
            type="button"
            class="clipboard-card-hero"
            :class="{ 'is-copied': copiedKey === `${card.id}-0` }"
            :title="`点击复制：${card.values[0]}`"
            :aria-label="`复制标题：${card.values[0]}`"
            @click="copyValue(card.values[0], `${card.id}-0`)"
          >
            <span class="clipboard-card-glow" aria-hidden="true"></span>
            <span class="clipboard-card-icon" aria-hidden="true">{{ badgeOf(card) }}</span>
            <span class="clipboard-card-title">{{ card.values[0] }}</span>
          </button>

          <div v-if="card.values.length" class="clipboard-values">
            <template v-for="(value, valueIndex) in card.values" :key="`${card.id}-${valueIndex}`">
              <span v-if="valueIndex" class="clipboard-link" aria-hidden="true"></span>
              <button
                type="button"
                class="clipboard-value"
                :class="{ 'is-copied': copiedKey === `${card.id}-${valueIndex}` }"
                :style="{ '--value-hue': clipboardValueHue(card, valueIndex) }"
                :title="`点击复制：${value}`"
                :aria-label="`复制：${value}`"
                @click="copyValue(value, `${card.id}-${valueIndex}`)"
              >
                <span class="clipboard-value-text">{{ value }}</span>
                <span class="clipboard-value-copy" aria-hidden="true">{{ copiedKey === `${card.id}-${valueIndex}` ? '✓' : '⧉' }}</span>
              </button>
            </template>
          </div>

          <footer class="clipboard-card-foot">
            <div class="clipboard-card-tools">
              <button
                v-if="card.values.length > 1"
                type="button"
                class="clipboard-group-copy"
                :class="{ 'is-copied': copiedKey === `group-${card.id}` }"
                :aria-label="`复制全部 ${card.values.length} 条`"
                title="复制全部"
                @click="copyGroup(card)"
              >{{ copiedKey === `group-${card.id}` ? '✓' : '⧉' }}</button>
              <button type="button" aria-label="编辑数据" title="编辑" @click="openEdit(card)">✎</button>
              <button type="button" aria-label="删除数据" title="删除" @click="removeCard(card)">×</button>
            </div>
          </footer>
        </article>
        </div>
      </div>

      <div v-else class="clipboard-empty">
        <span class="clipboard-empty-mark" aria-hidden="true">⧉</span>
        <p>{{ query ? `没有找到「${query}」` : '这个分类还没有数据' }}</p>
        <button v-if="query" type="button" class="clipboard-secondary" @click="query = ''">清空搜索</button>
        <button v-else type="button" class="clipboard-primary" @click="openCreate"><span>＋</span> 添加第一条</button>
      </div>

      <footer class="clipboard-footnote">
        <span>本机保存 · 不同步云端 · 换设备前记得备份</span>
        <span>{{ activeSheet?.name }} · {{ visibleCards.length }} 组</span>
      </footer>
    </section>

    <Transition name="clipboard-toast"><div v-if="notice" class="clipboard-toast" role="status">{{ notice }}</div></Transition>

    <Transition name="clipboard-modal">
      <div v-if="editorOpen" class="clipboard-overlay" @click.self="editorOpen = false">
        <section class="clipboard-dialog" role="dialog" aria-modal="true" :aria-label="editingCardId ? '编辑数据' : '添加数据'">
          <button class="clipboard-dialog-close" type="button" aria-label="关闭" @click="editorOpen = false">×</button>
          <p class="clipboard-kicker">{{ editingCardId ? 'EDIT DATA' : 'NEW DATA' }}</p>
          <h2>{{ editingCardId ? '编辑数据' : '新增数据' }}</h2>
          <p class="clipboard-dialog-copy">可直接粘贴 Excel 单元格或多行文本；每个单元格/每行是一条数据，多条自动成组。</p>
          <label class="clipboard-field">
            <span>数据内容 <small>{{ parsedValues().length }} 条</small></span>
            <textarea v-model="draftValues" aria-label="数据内容" rows="7" autofocus placeholder="粘贴或输入数据&#10;一行一条；也支持粘贴 Excel 多个单元格"></textarea>
          </label>
          <div v-if="parsedValues().length" class="clipboard-preview">
            <span class="clipboard-preview-icon">{{ parsedValues().length > 1 ? '▤' : '↗' }}</span>
            <span>共 {{ parsedValues().length }} 条</span>
            <span class="clipboard-preview-sheet">{{ activeSheet?.name }}</span>
          </div>
          <div class="clipboard-dialog-actions">
            <button class="clipboard-secondary" type="button" @click="editorOpen = false">取消</button>
            <button class="clipboard-primary" type="button" @click="saveCard">{{ editingCardId ? '保存修改' : '确认保存' }}</button>
          </div>
        </section>
      </div>
    </Transition>

    <Transition name="clipboard-modal">
      <div v-if="sheetEditorOpen" class="clipboard-overlay" @click.self="sheetEditorOpen = false">
        <section class="clipboard-dialog" role="dialog" aria-modal="true" aria-label="新建分类">
          <button class="clipboard-dialog-close" type="button" aria-label="关闭" @click="sheetEditorOpen = false">×</button>
          <p class="clipboard-kicker">NEW CATEGORY</p>
          <h2>新建分类</h2>
          <p class="clipboard-dialog-copy">按使用场景分堆，内容仍只保存在本机浏览器。</p>
          <label class="clipboard-field">
            <span>分类名称</span>
            <input v-model="draftSheetName" maxlength="20" autofocus placeholder="例如：工作、常用地址" @keydown.enter="addSheet" />
          </label>
          <div class="clipboard-dialog-actions">
            <button class="clipboard-secondary" type="button" @click="sheetEditorOpen = false">取消</button>
            <button class="clipboard-primary" type="button" @click="addSheet">创建分类</button>
          </div>
        </section>
      </div>
    </Transition>
  </main>
</template>
