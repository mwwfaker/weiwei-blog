<script setup>
// 音频可视化画布，四种模式共用一块 canvas：
//   bars   —— 以中线对称的圆角频谱柱，带渐变与光晕
//   wave   —— 连续平滑声波曲线，带渐变描边与柔和填充
//   ripple —— 黑胶唱片式的圆形涟漪，随节拍一圈圈扩散
//   matrix —— 长条矩阵：把频谱铺成 rows × cols 的格子，每格一根长条 + 缓慢下落的峰值帽
// 没有 analyser 时（外链音频，浏览器不允许 Web Audio 读取跨域流）四种模式都退化为缓慢的
// 待机起伏，明确是装饰而不是伪造的频谱。
//
// 性能（曾经页面「卡顿」的主要来源，这里是四条对应的处理）：
//   1. 以前不管在不在播放都以 60fps 跑 rAF。全站常驻的播放器上挂着、音乐页上还挂着两个，
//      等于三块画布永不休息地重绘。现在按状态分档：真实频谱取 maxFps、外链播放 30fps、
//      纯待机 15fps；标签页在后台或元素滚出视口时一帧都不画。
//   2. 频谱柱以前每根柱子每帧都要 createLinearGradient。渐变只和柱子的高度有关，所以按
//      高度量化后缓存起来，一帧最多复用几十个已有的渐变对象。
//   3. 尺寸不再每帧读取，交给 ResizeObserver；只有真的变了才重建缓存。
//   4. devicePixelRatio 封顶 1.5：铺满面板的画布按 2 倍渲染等于多涂一倍像素，
//      而这里最细的内容只有一两个像素宽，看不出差别。
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  analyser: { type: Object, default: null },
  playing: { type: Boolean, default: false },
  isDark: { type: Boolean, default: true },
  mode: { type: String, default: 'bars' }, // bars | wave | ripple | matrix
  bars: { type: Number, default: 36 },
  /** 播放时的目标帧率上限。装饰性强的实例（唱片涟漪）可以调低。 */
  maxFps: { type: Number, default: 45 },
  /** matrix 模式的行数。 */
  matrixRows: { type: Number, default: 4 },
})

const FPS_STREAMING = 30
const FPS_IDLE = 15
/** 渐变按高度量化成这么多档；再多就超出了肉眼可辨范围。 */
const GRADIENT_STEPS = 24
/** 峰值帽每帧下落的比例。越小越「稳」，越大越跳。 */
const PEAK_FALL = 0.012

const canvas = ref(null)
let context
let frame = 0
let visible = true
let width = 0
let height = 0
let spectrum = null
let waveform = null
let levels = []
/** 声波模式：已经过块平均与时间平滑的波形点（按画布宽度决定点数）。 */
let wavePoints = []
let rings = []
let peaks = null
let matrixCols = 0
let tick = 0
let energy = 0
let destroyed = false
let resizeObserver
let intersectionObserver
let lastDrawAt = 0
let gradientCache = []

const ink = () => (props.isDark ? { r: 186, g: 168, b: 255 } : { r: 132, g: 92, b: 216 })
const rgba = ({ r, g, b }, a) => `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`

function resize() {
  if (!canvas.value || !context) return
  const rect = canvas.value.getBoundingClientRect()
  const scale = Math.min(window.devicePixelRatio || 1, 1.5)
  width = Math.max(40, rect.width)
  height = Math.max(20, rect.height)
  canvas.value.width = Math.round(width * scale)
  canvas.value.height = Math.round(height * scale)
  context.setTransform(scale, 0, 0, scale, 0, 0)
  // Rings are re-seeded on resize so they always span the new canvas.
  rings = Array.from({ length: 4 }, (_, index) => ({ progress: index / 4 }))
  matrixCols = Math.max(8, Math.min(56, Math.round(props.bars * 0.8)))
  const rows = Math.max(2, Math.min(6, props.matrixRows))
  // 柱子模式用前 bars 格，矩阵模式用前 cols×rows 格，取大的一方分配，免得矩阵读到越界下标。
  const needed = Math.max(props.bars, matrixCols * rows)
  if (levels.length !== needed) levels = new Array(needed).fill(0)
  peaks = new Float32Array(matrixCols * rows)
  // 点数由画布宽度决定，尺寸变了要重新来一份。
  wavePoints = []
  gradientCache = []
}

function readBins() {
  const size = props.analyser?.frequencyBinCount || 0
  if (!size) return null
  if (!spectrum || spectrum.length !== size) spectrum = new Uint8Array(size)
  props.analyser.getByteFrequencyData(spectrum)
  return spectrum
}

function readWave() {
  const size = props.analyser?.fftSize || 0
  if (!size) return null
  if (!waveform || waveform.length !== size) waveform = new Uint8Array(size)
  props.analyser.getByteTimeDomainData(waveform)
  return waveform
}

/**
 * 一个频段的强度。
 *
 * 以前这里取的是频段内的**最大值**，而 analyser 只有 64 个频点、柱子上限却有 44 根，
 * 平均每根柱子摊到一个频点，于是每根柱子都在跟着单个频点的抖动乱跳——这就是「波动太大、
 * 起不到效果」的原因。现在改成取平均，并在 App 侧把 fftSize 提到 1024（512 个频点），
 * 每根柱子摊到十几个频点，柱子才是稳的。
 */
function bandLevel(data, index, count, usable) {
  const from = Math.floor((index / count) * usable)
  const to = Math.max(from + 1, Math.floor(((index + 1) / count) * usable))
  let sum = 0
  let n = 0
  for (let j = from; j < to && j < data.length; j += 1) { sum += data[j]; n += 1 }
  return n ? sum / (n * 255) : 0
}

/**
 * 一根柱子的竖向渐变。颜色与 alpha 只取决于柱子高度，所以把高度量化成 24 档后直接复用，
 * 不再每帧每根重新构造。
 */
function barGradient(level) {
  const step = Math.min(GRADIENT_STEPS - 1, Math.round(level * (GRADIENT_STEPS - 1)))
  const cached = gradientCache[step]
  if (cached) return cached
  const { r, g, b } = ink()
  const mid = height / 2
  // 取该档位区间的上沿，柱子的渐变不会因为量化而变短。
  const sample = (step + 1) / GRADIENT_STEPS
  const half = Math.max(1, sample * mid * 0.94)
  const gradient = context.createLinearGradient(0, mid - half, 0, mid + half)
  gradient.addColorStop(0, rgba({ r, g, b }, 0.28 + sample * 0.5))
  gradient.addColorStop(0.5, rgba({ r, g, b }, 0.72 + sample * 0.26))
  gradient.addColorStop(1, rgba({ r, g, b }, 0.28 + sample * 0.5))
  gradientCache[step] = gradient
  return gradient
}

// ---------- bars ----------
function drawBars(active) {
  const { r, g, b } = ink()
  const count = props.bars
  const gap = Math.max(2, width / count * 0.28)
  const barWidth = Math.max(2, (width - gap * (count - 1)) / count)
  const mid = height / 2
  const radius = Math.min(barWidth / 2, 3)
  const usable = active ? Math.max(count, Math.floor(spectrum.length * 0.7)) : 0

  for (let i = 0; i < count; i += 1) {
    if (active) {
      const value = bandLevel(spectrum, i, count, usable)
      // 快起慢落，但两边都比原来缓：起 0.45、落 0.93。柱子是"推上去"的而不是"弹上去"的。
      levels[i] = value > levels[i] ? levels[i] * 0.55 + value * 0.45 : levels[i] * 0.93 + value * 0.07
    } else {
      // Idle must still look like a spectrum. Equal-length stubs read as a dashed border, so the
      // resting profile is a slow two-frequency swell with real height variation, and the resting
      // amplitude is high enough that it never collapses into a line.
      const t = tick * (props.playing ? 0.035 : 0.016)
      const swell = 0.5 + 0.5 * Math.sin(i * 0.52 + t)
      const ripple = 0.42 + 0.58 * (0.5 + 0.5 * Math.sin(i * 0.19 - t * 0.7))
      const base = props.playing ? 0.22 : 0.14
      const span = props.playing ? 0.52 : 0.34
      levels[i] = Math.max(0.09, Math.min(1, base + swell * ripple * span))
    }
    const level = Math.max(0.02, Math.min(1, levels[i]))
    const half = level * mid * 0.94
    const x = i * (barWidth + gap)
    context.fillStyle = barGradient(level)
    // Soft glow behind lively bars only, to keep the idle state calm.
    if (active && level > 0.55) {
      context.shadowColor = rgba({ r, g, b }, 0.5)
      context.shadowBlur = 10 * level
    }
    context.beginPath()
    if (context.roundRect) context.roundRect(x, mid - half, barWidth, half * 2, radius)
    else context.rect(x, mid - half, barWidth, half * 2)
    context.fill()
    if (context.shadowBlur) context.shadowBlur = 0
  }
}

// ---------- matrix ----------
/**
 * 长条矩阵：rows 条横向长条带，每条带里 cols 根从带底往上长的长条，条顶压一个峰值帽。
 *
 * 相邻两行在频率轴上错开半格，四行叠起来才像一片「矩阵」，而不是同一张图复制四遍。
 * 越靠上的行越暗、振幅越收敛、峰值帽落得越快，于是整块画面有纵深，也不会四条一起闪。
 */
function drawMatrix(active) {
  const { r, g, b } = ink()
  const rows = Math.max(2, Math.min(6, props.matrixRows))
  const cols = matrixCols
  const cellW = width / cols
  const barW = Math.max(2, cellW * 0.58)
  const bandH = height / rows
  const usable = active ? Math.max(cols, Math.floor(spectrum.length * 0.72)) : 0
  const radius = Math.min(barW / 2, 2.5)

  for (let row = 0; row < rows; row += 1) {
    const bottom = bandH * (row + 1) - 1
    // 越靠下的行越亮、越高；越靠上的行越收敛，视觉上像一层层往远处退。
    const depth = 1 - row / rows * 0.5
    const alpha = 0.34 + (1 - row / rows) * 0.6
    const bodyAlpha = alpha * (active ? 0.92 : 0.42)

    for (let col = 0; col < cols; col += 1) {
      const slot = row * cols + col
      let value
      if (active) {
        // 每行在频率轴上向后挪半格，避免四行完全对齐。
        value = bandLevel(spectrum, Math.min(cols - 1, col + row * 0.5), cols, usable) * depth
        const current = levels[slot] ?? 0
        levels[slot] = value > current ? current * 0.4 + value * 0.6 : current * 0.88 + value * 0.12
      } else {
        const t = tick * (props.playing ? 0.05 : 0.022)
        value = (0.1 + 0.16 * (0.5 + 0.5 * Math.sin(col * 0.42 + row * 1.7 + t))) * depth
        levels[slot] = value
      }
      const level = Math.max(0.02, Math.min(1, levels[slot] || 0))
      const barH = Math.max(2, level * bandH * 0.88)
      const x = col * cellW + (cellW - barW) / 2

      context.fillStyle = bodyAlpha
      context.beginPath()
      if (context.roundRect) context.roundRect(x, bottom - barH, barW, barH, radius)
      else context.rect(x, bottom - barH, barW, barH)
      context.fill()

      // 峰值帽：条顶那一小截亮线，落得比柱子慢，看起来像真的电平表。
      if (peaks) {
        const previous = peaks[slot] || 0
        peaks[slot] = Math.max(level, previous - PEAK_FALL * (1 + row * 0.6))
        const peakY = bottom - Math.max(2, Math.min(1, peaks[slot]) * bandH * 0.88)
        context.fillStyle = rgba({ r, g, b }, alpha + 0.32)
        context.fillRect(x, peakY, barW, 1.6)
      }
    }
  }
}

// ---------- wave ----------
/**
 * 声波。这里的"浮动太大"不是平滑不够，而是**欠采样**：
 * 原来每隔 N 个采样取一个点，把 48kHz 的波形直接塞进百来个像素里，两次重绘之间相位完全
 * 不同，画面必然是疯抖的。
 *
 * 现在做两件事：
 *   1. 按块取平均（相当于一个低通），留下的是波形的包络而不是混叠出来的噪声；
 *   2. 每个点再向目标值做时间插值，曲线是"漂"过去而不是"跳"过去。
 * 点数按画布宽度给，宽屏也不会退化成一根直线。
 */
function drawWave(active) {
  const { r, g, b } = ink()
  const mid = height / 2
  const amplitude = active ? height * 0.42 : height * 0.14
  const count = Math.max(48, Math.min(150, Math.round(width / 7)))
  if (wavePoints.length !== count) wavePoints = new Array(count).fill(mid)

  if (active) {
    const data = waveform
    const block = data.length / count
    // 8 个采样一段：足够压掉混叠，又不会把波形抹平成一条横线。
    const window = Math.max(4, Math.min(16, Math.round(block)))
    for (let i = 0; i < count; i += 1) {
      const center = Math.floor((i + 0.5) * block)
      const from = Math.max(0, center - window)
      const to = Math.min(data.length, center + window)
      let sum = 0
      for (let j = from; j < to; j += 1) sum += data[j]
      const average = to > from ? sum / (to - from) : 128
      const target = mid + ((average - 128) / 128) * amplitude
      // 时间平滑：目标值再怎么抖，画出来的曲线也是慢慢漂过去的。
      wavePoints[i] += (target - wavePoints[i]) * 0.16
    }
  } else {
    const swing = props.playing ? 1 : 0.42
    for (let i = 0; i < count; i += 1) {
      const x = (i / (count - 1)) * width
      wavePoints[i] = mid + Math.sin(x * 0.018 + tick * 0.035) * amplitude * swing
        + Math.sin(x * 0.041 + tick * 0.021) * amplitude * 0.35 * swing
    }
  }

  const points = wavePoints
  if (points.length < 2) return

  // Filled area under the curve, then a bright stroke on top.
  context.beginPath()
  context.moveTo(0, mid)
  for (let i = 0; i < points.length; i += 1) context.lineTo((i / (points.length - 1)) * width, points[i])
  context.lineTo(width, mid)
  context.closePath()
  const fill = context.createLinearGradient(0, 0, 0, height)
  fill.addColorStop(0, rgba({ r, g, b }, 0.26))
  fill.addColorStop(1, rgba({ r, g, b }, 0.02))
  context.fillStyle = fill
  context.fill()

  // Smooth the polyline with midpoint quadratics so it reads as a continuous wave.
  context.beginPath()
  context.moveTo(0, points[0])
  for (let i = 1; i < points.length - 1; i += 1) {
    const x1 = (i / (points.length - 1)) * width
    const x2 = ((i + 1) / (points.length - 1)) * width
    context.quadraticCurveTo(x1, points[i], (x1 + x2) / 2, (points[i] + points[i + 1]) / 2)
  }
  context.lineTo(width, points[points.length - 1])
  const stroke = context.createLinearGradient(0, 0, width, 0)
  stroke.addColorStop(0, rgba({ r, g, b }, 0.35))
  stroke.addColorStop(0.5, rgba({ r, g, b }, 0.95))
  stroke.addColorStop(1, rgba({ r, g, b }, 0.35))
  context.strokeStyle = stroke
  context.lineWidth = 2
  context.lineCap = 'round'
  context.shadowColor = rgba({ r, g, b }, active ? 0.55 : 0.2)
  context.shadowBlur = active ? 8 + energy * 16 : 4
  context.stroke()
  context.shadowBlur = 0
}

// ---------- ripple ----------
function drawRipple(active) {
  const { r, g, b } = ink()
  const cx = width / 2
  const cy = height / 2
  const maxRadius = Math.min(width, height) * 0.62
  // Beat-driven speed: rings race out on peaks, drift when idle.
  const speed = active ? 0.006 + energy * 0.055 : (props.playing ? 0.0045 : 0.0016)

  for (const ring of rings) {
    ring.progress += speed
    if (ring.progress >= 1) ring.progress -= 1
    const radius = 6 + ring.progress * maxRadius
    const fade = (1 - ring.progress) ** 1.7
    context.beginPath()
    context.arc(cx, cy, radius, 0, Math.PI * 2)
    context.strokeStyle = rgba({ r, g, b }, fade * (active ? 0.34 + energy * 0.5 : 0.2))
    context.lineWidth = 1 + fade * 2.2 + energy * 1.6
    context.stroke()
  }

  // A soft core that swells with the beat.
  const core = 5 + energy * 16
  const glow = context.createRadialGradient(cx, cy, 0, cx, cy, core * 2.6)
  glow.addColorStop(0, rgba({ r, g, b }, 0.5 + energy * 0.4))
  glow.addColorStop(0.45, rgba({ r, g, b }, 0.16 + energy * 0.2))
  glow.addColorStop(1, rgba({ r, g, b }, 0))
  context.fillStyle = glow
  context.beginPath()
  context.arc(cx, cy, core * 2.6, 0, Math.PI * 2)
  context.fill()
}

/** 当前状态下两次重绘之间至少要隔多久（毫秒）。 */
function frameInterval(active) {
  if (active) return 1000 / Math.max(15, Math.min(60, props.maxFps))
  return 1000 / (props.playing ? FPS_STREAMING : FPS_IDLE)
}

function draw(now) {
  frame = requestAnimationFrame(draw)
  if (destroyed || !context) return
  // 后台标签页或滚出视口时一帧都不画——省下来的正是别人卡顿的那部分。
  if (document.hidden || !visible) return
  // 尺寸为 0 说明还没布局完，等等再说。
  if (!width || !height) return

  const active = props.playing && props.analyser
  const interval = frameInterval(active)
  if (now - lastDrawAt < interval) return
  lastDrawAt = now

  context.clearRect(0, 0, width, height)
  tick += 1

  if (active) {
    readBins()
    if (props.mode === 'wave') readWave()
    // 驱动光晕、涟漪速度与核心亮度的那个能量值，同样走平均而不是最大值。
    if (spectrum) {
      const window = Math.min(40, spectrum.length)
      let sum = 0
      for (let i = 0; i < window; i += 1) sum += spectrum[i]
      const target = sum / (window * 255)
      energy += (target - energy) * (target > energy ? 0.28 : 0.06)
    }
  } else {
    energy *= 0.94
  }

  if (props.mode === 'wave') drawWave(active)
  else if (props.mode === 'ripple') drawRipple(active)
  else if (props.mode === 'matrix') drawMatrix(active)
  else drawBars(active)
}

onMounted(() => {
  context = canvas.value?.getContext('2d', { alpha: true })
  resize()
  if (typeof ResizeObserver !== 'undefined' && canvas.value) {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas.value)
  }
  // 滚出视口就不画。音乐页往下翻到曲库时，唱片和频谱整块都不在屏幕上。
  if (typeof IntersectionObserver !== 'undefined' && canvas.value) {
    intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting)
    })
    intersectionObserver.observe(canvas.value)
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('resize', resize)
  frame = requestAnimationFrame(draw)
})

function onVisibilityChange() {
  // 回到前台时不要用一帧「补」上离开期间的所有帧。
  lastDrawAt = 0
}

onUnmounted(() => {
  destroyed = true
  cancelAnimationFrame(frame)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  window.removeEventListener('resize', resize)
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
})

watch(() => props.bars, resize)
watch(() => props.matrixRows, resize)
// 主题换了渐变颜色也要重建。
watch(() => props.isDark, () => { gradientCache = [] })
watch(() => props.mode, () => {
  levels = new Array(Math.max(props.bars, matrixCols * props.matrixRows)).fill(0)
  rings = Array.from({ length: 4 }, (_, i) => ({ progress: i / 4 }))
  peaks?.fill(0)
})
</script>

<template><canvas ref="canvas" class="music-visualizer" aria-hidden="true"></canvas></template>
