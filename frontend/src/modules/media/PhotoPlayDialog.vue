<script setup>
// 照片工坊：在看的这张照片上做点好玩的 —— 马赛克拼图、字符画。
//
// 为什么收在一个对话框里而不是往看图右上角再塞按钮：看图上已经有「立体浏览」「照片信息」
// 和关闭三个按钮了，再加就成一排工具栏。这里的玩具以后还会变多，一个入口更经得起加。
//
// 两个玩具都在本机算（canvas），照片不出浏览器。
import { computed, onMounted, ref } from 'vue'
import ModalShell from '@/modules/modal/ModalShell.vue'
import { canvasToBlob, composeMosaic, loadImage, prepareTiles, toAscii } from '@/services/photoToys'
import { useMediaStore } from '@/stores/media'

const props = defineProps({ photo: { type: Object, required: true } })
defineEmits(['close'])

const media = useMediaStore()
const mode = ref('mosaic') // mosaic | ascii
const busy = ref(false)
const note = ref('')
const ascii = ref('')
const copied = ref(false)
const previewEl = ref(null)
let mosaicCanvas = null

/** 马赛克的素材：相册里**别的**照片。用自己拍的照片拼出自己拍的照片，才好玩。 */
const pool = computed(() => media.galleryItems.filter((item) => item.id !== props.photo.id && item.kind !== 'MUSIC'))

async function buildMosaic() {
  busy.value = true
  note.value = '正在给每张照片算平均色…'
  try {
    const urls = pool.value.slice(0, 240).map((item) => item.thumb || item.image)
    const tiles = await prepareTiles(urls)
    if (!tiles.length) { note.value = '素材都没加载出来，换一张照片试试。'; return }
    if (tiles.length < 4) note.value = `素材只有 ${tiles.length} 张，拼出来会比较单调 —— 多传几张照片效果最好。`
    const image = await loadImage(props.photo.image)
    const canvas = composeMosaic(image, tiles, 48)
    if (!canvas) { note.value = '这张照片读不了像素（来源没有开放跨域），做不了马赛克。'; return }
    mosaicCanvas = canvas
    const host = previewEl.value
    host.replaceChildren(canvas)
    canvas.className = 'play-canvas'
    // 这一句必须**覆盖**掉上面那句提示，不能只在"还没提示过"时才写
    // （早先写成 if (!note.value) 就永远卡在"正在算…"）
    note.value = tiles.length < 4
      ? `只用 ${tiles.length} 张素材拼的 —— 多传几张照片会好看得多`
      : `用 ${tiles.length} 张照片拼成`
  } catch (error) {
    note.value = `没做出来：${error.message}`
  } finally {
    busy.value = false
  }
}

async function buildAscii() {
  busy.value = true
  note.value = ''
  try {
    const image = await loadImage(props.photo.image)
    const text = toAscii(image, 110)
    if (!text) { note.value = '这张照片读不了像素（来源没有开放跨域），做不了字符画。'; return }
    ascii.value = text
    note.value = `${text.split('\n').length} 行 × 110 列`
  } catch (error) {
    note.value = `没做出来：${error.message}`
  } finally {
    busy.value = false
  }
}

async function build() {
  if (mode.value === 'mosaic') await buildMosaic()
  else await buildAscii()
}

function download(blob, name) {
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

async function downloadImage() {
  if (!mosaicCanvas) return
  download(await canvasToBlob(mosaicCanvas), `马赛克-${props.photo.caption || '照片'}.png`)
}

function downloadAscii() {
  download(new Blob([ascii.value], { type: 'text/plain;charset=utf-8' }), `字符画-${props.photo.caption || '照片'}.txt`)
}

async function copyAscii() {
  try {
    await navigator.clipboard.writeText(ascii.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1600)
  } catch {
    note.value = '浏览器没给剪贴板权限，用「下载」吧。'
  }
}

async function switchMode(next) {
  mode.value = next
  previewEl.value?.replaceChildren()
  mosaicCanvas = null
  await build()
}

onMounted(build)
</script>

<template>
  <ModalShell
    card-class="play-card"
    kicker="PHOTO PLAYGROUND"
    title="玩一下这张照片"
    close-label="关闭照片工坊"
    @close="$emit('close')"
  >
    <div class="play-tabs">
      <button class="play-tab" :class="{ 'is-on': mode === 'mosaic' }" @click="switchMode('mosaic')">马赛克拼图</button>
      <button class="play-tab" :class="{ 'is-on': mode === 'ascii' }" @click="switchMode('ascii')">字符画</button>
    </div>

    <p class="play-note">
      <span v-if="busy">正在算…</span>
      <span v-else>{{ note }}</span>
    </p>

    <div v-if="mode === 'mosaic'" ref="previewEl" class="play-preview"></div>

    <pre v-else-if="ascii" class="play-ascii">{{ ascii }}</pre>

    <div class="modal-actions">
      <span>{{ mode === 'mosaic' ? '由相册里的其它照片拼成' : '等宽字体，行尾空格已去掉' }}</span>
      <template v-if="mode === 'mosaic'">
        <button class="play-action" :disabled="busy" @click="buildMosaic">重做</button>
        <button class="button-primary" :disabled="!mosaicCanvas" @click="downloadImage">下载 PNG</button>
      </template>
      <template v-else>
        <button class="play-action" :disabled="busy || !ascii" @click="copyAscii">{{ copied ? '已复制' : '复制' }}</button>
        <button class="button-primary" :disabled="!ascii" @click="downloadAscii">下载 TXT</button>
      </template>
    </div>
  </ModalShell>
</template>
