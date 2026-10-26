<script setup>
// 快捷复制：整屏工具页，和绩效计算器共用一套「顶栏 + 标签条 + 面板」的骨架。
//
// 数据结构没动（sheet = 分类工作表，card = 一组数据，values = 那一组里的几条）：
// 一条数据就是一张卡片，多条自动成组；点任意一条直接写进剪贴板。
// 所有数据只在 localStorage，不登录、不上传。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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
const notice = ref('')
const copiedKey = ref('')
const query = ref('')
let noticeTimer = 0
let copiedTimer = 0

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

watch(workspace, (value) => {
  try {
    value.activeSheetId = activeSheetId.value
    writeClipboardWorkspace(value)
  } catch {
    showNotice('浏览器存储空间不足，数据暂未保存')
  }
}, { deep: true })
watch(activeSheetId, (id) => { workspace.value.activeSheetId = id })

onBeforeUnmount(() => {
  window.clearTimeout(noticeTimer)
  window.clearTimeout(copiedTimer)
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
  showNotice(values.length > 1 ? `已保存为一组数据，共 ${values.length} 条` : '已保存为单条数据')
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
  card.position = Math.max(-1, ...workspace.value.cards.filter((item) => item.sheetId === sheet.id).map((item) => item.position)) + 1
  activeSheetId.value = sheet.id
  showNotice(`已移动到「${sheet.name}」`)
}

function dropCard(event, targetCard) {
  event.preventDefault()
  const payload = dragPayload(event)
  const card = payload?.type === 'card' && workspace.value.cards.find((item) => item.id === payload.id)
  if (card) moveCard(card, targetCard)
  draggingCardId.value = ''
  dropSheetId.value = ''
}

function endCardDrag() {
  draggingCardId.value = ''
  dropSheetId.value = ''
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
  copyValue(card.values.join('\n'), `group-${card.id}`, '整组已复制，可以直接粘贴')
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

    <section class="clipboard-content">
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

      <div v-if="visibleCards.length" class="clipboard-grid">
        <article
          v-for="card in visibleCards"
          :key="card.id"
          class="clipboard-card"
          :class="{ 'is-group': card.values.length > 1, 'is-dragging': draggingCardId === card.id }"
          :style="{ '--tile-hue': clipboardColorPalette[cardPaletteIndex(card)], '--card-delay': `${Math.min(Number(card.position || 0), 8) * 25}ms` }"
          @dragover.prevent
          @drop.stop="dropCard($event, card)"
          @dragend="endCardDrag"
        >
          <div class="clipboard-card-art" aria-hidden="true">
            <span class="clipboard-card-glow"></span>
            <span class="clipboard-card-icon">{{ badgeOf(card) }}</span>
            <span class="clipboard-card-state">{{ copiedKey === `group-${card.id}` ? '整组已复制 ✓' : (card.values.length > 1 ? `数据组 · ${card.values.length} 条` : '单条数据') }}</span>
            <div class="clipboard-card-tools">
              <button
                v-if="card.values.length > 1"
                type="button"
                class="clipboard-group-copy"
                :class="{ 'is-copied': copiedKey === `group-${card.id}` }"
                :aria-label="`复制整组 ${card.values.length} 条数据`"
                title="复制整组"
                @click="copyGroup(card)"
              >{{ copiedKey === `group-${card.id}` ? '✓' : '⧉' }}</button>
              <button type="button" class="clipboard-drag-handle" draggable="true" aria-label="拖动调整位置" title="拖动排序" @dragstart="startCardDrag($event, card)">⠿</button>
              <button type="button" aria-label="编辑数据" title="编辑" @click="openEdit(card)">✎</button>
              <button type="button" aria-label="删除数据" title="删除" @click="removeCard(card)">×</button>
            </div>
          </div>

          <div class="clipboard-values">
            <template v-for="(value, valueIndex) in card.values" :key="`${card.id}-${valueIndex}`">
              <span v-if="valueIndex" class="clipboard-link" aria-hidden="true"></span>
              <button
                type="button"
                class="clipboard-value"
                :class="{ 'is-title': valueIndex === 0, 'is-copied': copiedKey === `${card.id}-${valueIndex}` }"
                :style="{ '--value-hue': clipboardValueHue(card, valueIndex) }"
                :title="`点击复制：${value}`"
                :aria-label="`复制${valueIndex === 0 ? '标题：' : ''}${value}`"
                @click="copyValue(value, `${card.id}-${valueIndex}`)"
              >
                <span class="clipboard-value-text">{{ value }}</span>
                <span class="clipboard-value-copy" aria-hidden="true">{{ copiedKey === `${card.id}-${valueIndex}` ? '✓' : '⧉' }}</span>
              </button>
            </template>
          </div>
        </article>
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
            <span>{{ parsedValues().length > 1 ? `将保存为一组，共 ${parsedValues().length} 条` : '将保存为单条数据' }}</span>
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
