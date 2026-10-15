<script setup>
// 歌词栏。右侧那一整块：有时间轴时逐行滚动、当前句高亮、点一句就跳到那一句；
// 没有时间轴（纯文本歌词）时退化成正常的可滚动文本，不做假的高亮。
//
// 一个刻意的细节：自动滚动会在你手动滚动后暂停 4 秒。否则你想往回看一眼上一句，
// 手指一松它就把你拽回当前句，非常烦人。
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { LYRICS_SOURCE_LABELS, activeLineIndex, formatClock } from '../services/lyrics'

const props = defineProps({
  parsed: { type: Object, default: null },
  source: { type: String, default: '' },
  currentTime: { type: Number, default: 0 },
  loading: { type: Boolean, default: false },
  /** 登录后才能把歌词存回数据库；访客只能看。 */
  canSave: { type: Boolean, default: false },
  trackName: { type: String, default: '' },
})

const emit = defineEmits(['seek', 'save', 'rematch', 'clear'])

const scroller = ref(null)
const editing = ref(false)
const draft = ref('')
const lrcPicker = ref(null)
/** 手动滚动后暂停自动跟随的时间戳。 */
let holdUntil = 0
const MANUAL_HOLD = 4000

const lines = computed(() => props.parsed?.lines || [])
const synced = computed(() => Boolean(props.parsed?.synced))
const activeIndex = computed(() => (synced.value ? activeLineIndex(props.parsed, props.currentTime) : -1))
const hasContent = computed(() => lines.value.some((line) => line.text))
const sourceLabel = computed(() => LYRICS_SOURCE_LABELS[props.source] || '')

function centerActive(behavior = 'smooth') {
  const container = scroller.value
  if (!container || activeIndex.value < 0) return
  const target = container.querySelector('.lyric-line.is-active')
  if (!target) return
  container.scrollTo({
    top: target.offsetTop - container.clientHeight / 2 + target.clientHeight / 2,
    behavior,
  })
}

watch(activeIndex, () => {
  if (Date.now() < holdUntil) return
  nextTick(() => centerActive())
})
// 换歌时直接跳到位，不要从上一首的歌词位置滑过去。
watch(() => props.trackName, () => {
  holdUntil = 0
  nextTick(() => centerActive('auto'))
})

function onUserScroll() {
  holdUntil = Date.now() + MANUAL_HOLD
}

function jumpTo(index) {
  const line = lines.value[index]
  if (!line || line.time == null) return
  holdUntil = 0
  emit('seek', line.time)
}

function startEdit() {
  draft.value = props.parsed?.raw || ''
  editing.value = true
}

function cancelEdit() {
  editing.value = false
  draft.value = ''
}

function submitEdit() {
  const value = draft.value.trim()
  if (!value) return
  emit('save', value)
  editing.value = false
}

async function readLrcFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const text = await file.text()
  draft.value = text
  editing.value = true
}

onUnmounted(() => { holdUntil = 0 })
</script>

<template>
  <section class="lyrics-panel" aria-label="歌词">
    <header class="lyrics-head">
      <div>
        <div class="section-kicker">LYRICS <span></span></div>
        <h2>{{ trackName || '未选择曲目' }}</h2>
      </div>
      <div class="lyrics-tools">
        <span v-if="sourceLabel" class="lyrics-source">{{ sourceLabel }}</span>
        <button v-if="!editing" class="lyrics-tool" @click="emit('rematch')" title="重新在线匹配歌词">↻ 匹配</button>
        <button v-if="!editing" class="lyrics-tool" @click="startEdit" title="粘贴或上传 LRC 歌词">{{ hasContent ? '编辑' : '＋ 添加歌词' }}</button>
        <button v-if="editing" class="lyrics-tool" @click="cancelEdit">取消</button>
        <button v-if="editing" class="lyrics-tool is-primary" @click="submitEdit">保存</button>
      </div>
    </header>

    <div v-if="loading" class="lyrics-scroll lyrics-status">
      <span class="lyrics-spinner" aria-hidden="true"></span>
      <p>正在为你找这首歌的歌词…</p>
      <!-- 骨架行：解析期间先让右栏有内容感，不至于只有一句提示悬在中间 -->
      <div class="lyrics-skeleton" aria-hidden="true">
        <i v-for="n in 4" :key="n" :style="{ '--n': n }"></i>
      </div>
    </div>

    <div v-else-if="editing" class="lyrics-editor">
      <p class="lyrics-hint">把 LRC 歌词粘贴进来（形如 <code>[00:12.34]第一句</code>），也可以直接从电脑选一个 .lrc 文件。没有时间标签也能显示，只是不会跟着唱。</p>
      <textarea v-model="draft" class="lyrics-textarea" rows="12" spellcheck="false" placeholder="[00:00.00]第一句歌词&#10;[00:05.20]第二句歌词"></textarea>
      <div class="lyrics-editor-actions">
        <button class="button-secondary" @click="lrcPicker?.click()">⇧ 选择 .lrc 文件</button>
        <input ref="lrcPicker" type="file" accept=".lrc,.txt,text/plain" hidden @change="readLrcFile" />
        <span v-if="!canSave" class="lyrics-warn">登录后歌词才会保存到账号里</span>
      </div>
    </div>

    <div
      v-else-if="hasContent"
      ref="scroller"
      class="lyrics-scroll"
      :class="{ 'is-static': !synced }"
      @wheel="onUserScroll"
      @touchstart.passive="onUserScroll"
      @pointerdown="onUserScroll"
    >
      <p v-if="!synced" class="lyrics-plain">{{ lines.map((line) => line.text).join('\n') }}</p>
      <template v-else>
        <!-- 上下各留一段空白，第一句和最后一句也能滚到正中间 -->
        <div class="lyrics-pad" aria-hidden="true"></div>
        <!-- 歌词居中，唱到的那一句放大、变高、加背景；整行可点，点了就跳到那一句。
             时间不上屏（主流播放器也不显示），只留在无障碍标签里。 -->
        <p
          v-for="(line, index) in lines"
          :key="`${index}-${line.time}`"
          class="lyric-line"
          :class="{ 'is-active': index === activeIndex, 'is-past': index < activeIndex }"
          role="button"
          tabindex="0"
          :title="`跳到 ${formatClock(line.time)}`"
          :aria-label="`跳到 ${formatClock(line.time)}：${line.text || '间奏'}`"
          @click="jumpTo(index)"
          @keydown.enter="jumpTo(index)"
        >
          <span class="lyric-text">{{ line.text || '· · ·' }}</span>
        </p>
        <div class="lyrics-pad" aria-hidden="true"></div>
      </template>
    </div>

    <div v-else class="lyrics-scroll lyrics-status">
      <span class="lyrics-empty-mark" aria-hidden="true">♪</span>
      <h3>这首歌还没有歌词</h3>
      <p>可以从音频文件内嵌的标签里读，也可以在线自动匹配；都没有的话，把 LRC 贴进来就好。</p>
      <div class="lyrics-empty-actions">
        <button class="button-secondary" @click="emit('rematch')">↻ 再匹配一次</button>
        <button class="button-primary" @click="startEdit">粘贴 / 上传 LRC</button>
      </div>
    </div>
  </section>
</template>
