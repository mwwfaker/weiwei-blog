<script setup>
// 3D 照片墙：整屏照片场（照站主给的「生命的年轮」视频做的）。
//
// 底色跟全站主题走（夜间是一整片深空、白天是纸白），照片从窗口四边穿过去、一圈一圈摊开，
// 各在各的景深上。可操作的东西都在顶栏：巡航、远近、聚散、换摆法、打乱、回中心。
//
// 为什么是 CSS 3D 而不是 three.js：相册的图来自 Supabase 签名链接，不是每条都带 CORS 头，
// WebGL 纹理拿不到就会整片变黑；而这里的每一张都必须显示出来。
// `preserve-3d + perspective` 让浏览器自己做透视，图片仍是普通 <img>，还保住原生比例。
//
// 它是 fixed 全屏层，所以必须挂在 layouts/AppShell.vue 上——相册页所在的 .page-content
// 有入场动画留下的 transform，会把 fixed 层框成内容区大小（实测 x=190,y=64,w=1132）。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  /** 要铺开的照片；调用方传 `media.galleryItems`（全部照片）。 */
  photos: { type: Array, default: () => [] },
})
const emit = defineEmits(['close', 'preview'])

/** 位置哈希当伪随机数：同一个下标永远得到同一个值，布局不会跳。 */
const rand = (i, salt) => {
  const v = Math.sin((i + 1) * 12.9898 + salt * 78.233) * 43758.5453
  return v - Math.floor(v)
}

const view = ref({ w: 1440, h: 900 })
const panX = ref(0)
const panY = ref(0)
/** 穿行远近：目标是按钮设的值，实际值每帧向它靠拢，点一下是滑过去的而不是瞬移。 */
const dolly = ref(0)
const dollyTarget = ref(0)
const tiltX = ref(0)
const tiltY = ref(0)
const dragging = ref(false)
const reduced = ref(false)

/** 巡航：整片空间绕着小圈慢慢漂，静止时也在动。 */
const auto = ref(true)
const cruise = ref(0)

/** 摆法：年轮（一圈一圈）/ 星云（随机撒）。 */
const layouts = [
  { id: 'rings', label: '年轮' },
  { id: 'cloud', label: '星云' },
]
const layout = ref('rings')
/** 聚散：1 = 正常，>1 散开，<1 收拢。 */
const spread = ref(1)
/** 打乱用的种子：换一个种子 = 完全另一套位置。 */
const seed = ref(0)
/** null = 全部；否则是四位年份。 */
const activeYear = ref(null)

const years = computed(() => {
  const map = new Map()
  for (const photo of props.photos) {
    const year = String(photo.takenAt || '').slice(0, 4)
    if (!/^\d{4}$/.test(year)) continue
    map.set(year, (map.get(year) || 0) + 1)
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
})

const shown = computed(() => {
  if (!activeYear.value) return props.photos
  return props.photos.filter((photo) => String(photo.takenAt || '').slice(0, 4) === activeYear.value)
})

const count = computed(() => shown.value.length)
const spreadOut = computed(() => spread.value > 1)

/**
 * 布局（像素，按窗口尺寸算）。
 * 环是椭圆：横竖分别按窗口宽高铺到边，最外圈会贴着边缘被裁掉一点——视频里就是这样。
 */
const poses = computed(() => {
  const list = shown.value
  const n = list.length
  if (!n) return []
  const rx = view.value.w * 0.46
  const ry = view.value.h * 0.44
  const rings = Math.max(2, Math.min(7, Math.round(Math.sqrt(n / 2.6))))
  const perRing = Math.ceil(n / rings)
  const cardBase = Math.max(40, Math.min(120, Math.min(view.value.w, view.value.h) * 0.42 / Math.sqrt(n / 10)))
  const s = spread.value
  // 打乱：种子掺进哈希里，整批位置全换一套
  const saltShift = seed.value * 17.13

  return list.map((photo, i) => {
    const r1 = rand(i + saltShift, 1)
    const r2 = rand(i + saltShift, 2)
    const r3 = rand(i + saltShift, 3)
    const r4 = rand(i + saltShift, 4)
    let x
    let y
    let z
    let width
    if (layout.value === 'cloud') {
      // 星云：一片随机体积里撒开，前后错得更狠
      const angle = r1 * Math.PI * 2
      const reach = Math.sqrt(r2) * 0.96
      x = Math.cos(angle) * rx * reach * s
      y = Math.sin(angle) * ry * reach * s
      z = 160 - r3 * 700
      width = cardBase * (0.5 + r4 * 1.1)
    } else {
      const k = Math.floor(i / perRing) + 1
      const inRing = i % perRing
      const angle = ((inRing / perRing) * 360 + k * 41 + r1 * 24) * (Math.PI / 180)
      const reach = (0.16 + (k / rings) * 0.84) * (0.9 + r2 * 0.22) * s
      x = Math.cos(angle) * rx * reach
      y = Math.sin(angle) * ry * reach
      z = 140 - (k / rings) * 520 - r3 * 150
      width = cardBase * (0.55 + r4 * 1.05)
    }
    return {
      photo,
      style: {
        width: Math.max(32, Math.round(width)) + 'px',
        zIndex: String(Math.round(1000 + z)),
        transform: `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(0)}px)`,
      },
    }
  })
})

const stageStyle = computed(() => {
  // 巡航叠加在手动位移之上：绕小圈 + 轻微摇头
  const cx = auto.value ? Math.cos(cruise.value) * 58 : 0
  const cy = auto.value ? Math.sin(cruise.value * 0.8) * 38 : 0
  const ry = auto.value ? Math.sin(cruise.value * 0.62) * 9 : 0
  const rx = auto.value ? Math.cos(cruise.value * 0.5) * 3.2 : 0
  return {
    transform: `translate3d(${(panX.value + cx).toFixed(1)}px, ${(panY.value + cy).toFixed(1)}px, ${dolly.value.toFixed(0)}px) `
      + `rotateX(${(tiltX.value + rx).toFixed(2)}deg) rotateY(${(tiltY.value + ry).toFixed(2)}deg)`,
  }
})

// ---- 交互 ------------------------------------------------------------------
const pointer = { id: null, x: 0, y: 0, panX: 0, panY: 0, moved: 0, captured: false }

function onPointerDown(event) {
  if (event.button != null && event.button !== 0) return
  pointer.id = event.pointerId
  pointer.x = event.clientX
  pointer.y = event.clientY
  pointer.panX = panX.value
  pointer.panY = panY.value
  pointer.moved = 0
  pointer.captured = false
  dragging.value = true
}

function onPointerMove(event) {
  if (!dragging.value) {
    tiltY.value = (event.clientX / Math.max(1, view.value.w) - 0.5) * -4
    tiltX.value = (event.clientY / Math.max(1, view.value.h) - 0.5) * 2.4
    return
  }
  if (event.pointerId !== pointer.id) return
  const dx = event.clientX - pointer.x
  const dy = event.clientY - pointer.y
  pointer.moved = Math.max(pointer.moved, Math.abs(dx) + Math.abs(dy))
  // 真的开始拖之后才捕获指针：一按下就捕获，随后的 click 会被转到舞台上，照片就点不开了
  if (!pointer.captured && pointer.moved > 3) {
    pointer.captured = true
    event.currentTarget?.setPointerCapture?.(event.pointerId)
  }
  panX.value = pointer.panX + dx
  panY.value = pointer.panY + dy * 0.7
}

function onPointerUp(event) {
  if (event.pointerId !== pointer.id) return
  dragging.value = false
  pointer.id = null
}

function onPointerLeave() {
  if (dragging.value) return
  tiltX.value = 0
  tiltY.value = 0
}

/** 拖动超过 8px 就算「在走视角」，不当作点击。 */
function pick(photo) {
  if (pointer.moved > 8) return
  emit('preview', photo)
}

/** 滚轮 = 穿行：往里推就是走进照片之间。 */
function onWheel(event) {
  event.preventDefault()
  dollyTarget.value = Math.max(-1400, Math.min(520, dollyTarget.value - event.deltaY * 0.8))
}

function resetView() {
  panX.value = 0
  panY.value = 0
  dollyTarget.value = 0
  tiltX.value = 0
  tiltY.value = 0
  spread.value = 1
}

const zoomBy = (delta) => { dollyTarget.value = Math.max(-1400, Math.min(520, dollyTarget.value + delta)) }
const toggleSpread = () => { spread.value = spreadOut.value ? 1 : 1.5 }
const toggleAuto = () => { auto.value = !auto.value }
const shuffle = () => { seed.value += 1 }
const cycleLayout = () => {
  const at = layouts.findIndex((item) => item.id === layout.value)
  layout.value = layouts[(at + 1) % layouts.length].id
}

function pickYear(year) {
  activeYear.value = activeYear.value === year ? null : year
  resetView()
}

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
  else if (event.key === '0') resetView()
  else if (event.key === 'r' || event.key === 'R') shuffle()
  else if (event.key === '=' || event.key === '+') zoomBy(160)
  else if (event.key === '-' || event.key === '_') zoomBy(-160)
  else if (event.key === ' ') { event.preventDefault(); toggleAuto() }
}

function onResize() {
  if (typeof window === 'undefined') return
  view.value = { w: window.innerWidth, h: window.innerHeight }
}

// 一帧只做一件事：推进巡航、把远近滑到目标值。
let frame = 0
let last = 0
function tick(now) {
  if (typeof requestAnimationFrame === 'undefined') return
  frame = requestAnimationFrame(tick)
  if (!last) last = now
  const delta = Math.min(64, now - last)
  last = now
  // 穿行是滑过去的：每帧靠近目标 12%，停下时自然收住
  dolly.value += (dollyTarget.value - dolly.value) * 0.12
  if (reduced.value || !auto.value || dragging.value) return
  cruise.value = (cruise.value + delta * 0.00042) % (Math.PI * 2)
}

onMounted(() => {
  if (typeof window === 'undefined') return
  reduced.value = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)
  onResize()
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeydown)
  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  if (typeof window === 'undefined') return
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeydown)
  if (frame && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(frame)
})

// 换了年份就回到中心，否则会停在上一次的位置、看起来像空了
watch(activeYear, resetView)
</script>

<template>
  <section class="photo-field">
    <header class="photo-field-bar">
      <div class="photo-field-title">
        <strong>照片墙</strong>
        <small>{{ count }} 张 · 日子，一圈一圈</small>
      </div>

      <div class="photo-field-tools">
        <button class="photo-field-btn" :class="{ 'is-on': auto }" :aria-pressed="auto" @click="toggleAuto">
          {{ auto ? '⏸ 巡航中' : '▶ 巡航' }}
        </button>
        <button class="photo-field-btn" :class="{ 'is-on': spreadOut }" :aria-pressed="spreadOut" @click="toggleSpread">
          {{ spreadOut ? '◎ 收拢' : '✦ 散开' }}
        </button>
        <button class="photo-field-btn" @click="cycleLayout">◈ {{ layout === 'rings' ? '年轮' : '星云' }}</button>
        <button class="photo-field-btn" @click="shuffle">⟳ 打乱</button>
        <button class="photo-field-btn" aria-label="拉近" @click="zoomBy(200)">＋</button>
        <button class="photo-field-btn" aria-label="推远" @click="zoomBy(-200)">－</button>
        <button class="photo-field-btn" @click="resetView">回到中心</button>
        <button class="photo-field-btn" @click="$emit('close')">← 回到相册</button>
      </div>
    </header>

    <div
      v-if="count"
      class="photo-field-space"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
      @wheel="onWheel"
    >
      <div class="photo-field-stage" :style="stageStyle">
        <figure
          v-for="item in poses"
          :key="item.photo.id"
          class="photo-field-item"
          :style="item.style"
          @click="pick(item.photo)"
        >
          <img
            class="photo-field-frame"
            :src="item.photo.thumb || item.photo.image"
            :alt="item.photo.caption"
            loading="lazy"
            decoding="async"
            draggable="false"
          />
        </figure>
      </div>
    </div>

    <p v-else class="photo-field-empty">还没有照片可以摆——先往相册里放几张。</p>

    <footer class="photo-field-foot">
      <p class="photo-field-quote"><b>ALL THE DAYS</b>日子，一圈一圈。</p>
      <div class="photo-field-mid">
        <div v-if="years.length > 2" class="photo-field-years">
          <button class="photo-field-year" :class="{ 'is-active': !activeYear }" @click="pickYear(null)">全部 <em>{{ photos.length }}</em></button>
          <button
            v-for="[year, total] in years"
            :key="year"
            class="photo-field-year"
            :class="{ 'is-active': activeYear === year }"
            @click="pickYear(year)"
          >{{ year }} <em>{{ total }}</em></button>
        </div>
        <p class="photo-field-hint">拖动探索 · 滚轮穿行 · 空格巡航 · R 打乱 · 点一张看大图</p>
      </div>
    </footer>
  </section>
</template>
