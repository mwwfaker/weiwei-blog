<script setup>
// 音频可视化画布，三种模式共用一块 canvas：
//   bars   —— 以中线对称的圆角频谱柱，带渐变与光晕
//   wave   —— 连续平滑声波曲线，带渐变描边与柔和填充
//   ripple —— 黑胶唱片式的圆形涟漪，随节拍一圈圈扩散
// 没有 analyser 时（外链音频，浏览器不允许 Web Audio 读取跨域流）三种模式都退化为缓慢的
// 待机起伏，明确是装饰而不是伪造的频谱。
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  analyser: { type: Object, default: null },
  playing: { type: Boolean, default: false },
  isDark: { type: Boolean, default: true },
  mode: { type: String, default: 'bars' }, // bars | wave | ripple
  bars: { type: Number, default: 36 },
})

const canvas = ref(null)
let context
let frame = 0
let width = 0
let height = 0
let spectrum = null
let waveform = null
let levels = []
let rings = []
let tick = 0
let energy = 0
let destroyed = false
let resizeObserver

const ink = () => (props.isDark ? { r: 186, g: 168, b: 255 } : { r: 132, g: 92, b: 216 })
const rgba = ({ r, g, b }, a) => `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a))})`

function resize() {
  if (!canvas.value || !context) return
  const rect = canvas.value.getBoundingClientRect()
  const scale = Math.min(window.devicePixelRatio || 1, 2)
  width = Math.max(40, rect.width)
  height = Math.max(20, rect.height)
  canvas.value.width = Math.round(width * scale)
  canvas.value.height = Math.round(height * scale)
  context.setTransform(scale, 0, 0, scale, 0, 0)
  if (levels.length !== props.bars) levels = new Array(props.bars).fill(0)
  // Rings are re-seeded on resize so they always span the new canvas.
  rings = Array.from({ length: 4 }, (_, index) => ({ progress: index / 4 }))
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

// ---------- bars ----------
function drawBars(active) {
  const { r, g, b } = ink()
  const count = props.bars
  const gap = Math.max(2, width / count * 0.28)
  const barWidth = Math.max(2, (width - gap * (count - 1)) / count)
  const mid = height / 2

  for (let i = 0; i < count; i += 1) {
    if (active) {
      const data = spectrum
      const usable = Math.max(count, Math.floor(data.length * 0.7))
      const from = Math.floor((i / count) * usable)
      const to = Math.max(from + 1, Math.floor(((i + 1) / count) * usable))
      let peak = 0
      for (let j = from; j < to && j < data.length; j += 1) peak = Math.max(peak, data[j])
      const value = peak / 255
      levels[i] = value > levels[i] ? value : levels[i] * 0.84 + value * 0.16
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
    const gradient = context.createLinearGradient(0, mid - half, 0, mid + half)
    gradient.addColorStop(0, rgba({ r, g, b }, 0.28 + level * 0.5))
    gradient.addColorStop(0.5, rgba({ r, g, b }, 0.72 + level * 0.26))
    gradient.addColorStop(1, rgba({ r, g, b }, 0.28 + level * 0.5))
    context.fillStyle = gradient
    // Soft glow behind lively bars only, to keep the idle state calm.
    if (active && level > 0.55) {
      context.shadowColor = rgba({ r, g, b }, 0.5)
      context.shadowBlur = 10 * level
    }
    const radius = Math.min(barWidth / 2, 3)
    context.beginPath()
    if (context.roundRect) context.roundRect(x, mid - half, barWidth, half * 2, radius)
    else context.rect(x, mid - half, barWidth, half * 2)
    context.fill()
    context.shadowBlur = 0
  }
}

// ---------- wave ----------
function drawWave(active) {
  const { r, g, b } = ink()
  const mid = height / 2
  const amplitude = active ? height * 0.42 : height * 0.14
  const points = []

  if (active) {
    const data = waveform
    const step = Math.max(1, Math.floor(data.length / 180))
    for (let i = 0; i < data.length; i += step) {
      const x = (i / (data.length - 1)) * width
      points.push([x, mid + ((data[i] - 128) / 128) * amplitude])
    }
  } else {
    const swing = props.playing ? 1 : 0.42
    for (let x = 0; x <= width; x += 6) {
      const y = mid + Math.sin(x * 0.018 + tick * 0.035) * amplitude * swing
        + Math.sin(x * 0.041 + tick * 0.021) * amplitude * 0.35 * swing
      points.push([x, y])
    }
  }
  if (points.length < 2) return

  // Filled area under the curve, then a bright stroke on top.
  context.beginPath()
  context.moveTo(points[0][0], mid)
  for (const [x, y] of points) context.lineTo(x, y)
  context.lineTo(points[points.length - 1][0], mid)
  context.closePath()
  const fill = context.createLinearGradient(0, 0, 0, height)
  fill.addColorStop(0, rgba({ r, g, b }, 0.26))
  fill.addColorStop(1, rgba({ r, g, b }, 0.02))
  context.fillStyle = fill
  context.fill()

  // Smooth the polyline with midpoint quadratics so it reads as a continuous wave.
  context.beginPath()
  context.moveTo(points[0][0], points[0][1])
  for (let i = 1; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    context.quadraticCurveTo(x1, y1, (x1 + x2) / 2, (y1 + y2) / 2)
  }
  const last = points[points.length - 1]
  context.lineTo(last[0], last[1])
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

function draw() {
  if (!context || destroyed) return
  // Skip all work while hidden (display:none yields a zero-size box).
  if (!width || !height || canvas.value?.offsetParent === null) {
    frame = requestAnimationFrame(draw)
    return
  }
  context.clearRect(0, 0, width, height)
  tick += 1

  const active = props.playing && props.analyser
  if (active) {
    readBins()
    if (props.mode === 'wave') readWave()
    // One smoothed energy value drives glow, ring speed and the core.
    const data = spectrum
    if (data) {
      const window = Math.min(30, data.length)
      let sum = 0
      for (let i = 0; i < window; i += 1) sum += data[i]
      const target = sum / (window * 255)
      energy += (target - energy) * (target > energy ? 0.45 : 0.08)
    }
  } else {
    energy *= 0.94
  }

  if (props.mode === 'wave') drawWave(active)
  else if (props.mode === 'ripple') drawRipple(active)
  else drawBars(active)

  frame = requestAnimationFrame(draw)
}

onMounted(() => {
  context = canvas.value?.getContext('2d', { alpha: true })
  resize()
  if (typeof ResizeObserver !== 'undefined' && canvas.value) {
    resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas.value)
  }
  window.addEventListener('resize', resize)
  frame = requestAnimationFrame(draw)
})

onUnmounted(() => {
  destroyed = true
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', resize)
  resizeObserver?.disconnect()
})

watch(() => props.bars, resize)
watch(() => props.mode, () => { levels = new Array(props.bars).fill(0); rings = Array.from({ length: 4 }, (_, i) => ({ progress: i / 4 })) })
</script>

<template><canvas ref="canvas" class="music-visualizer" aria-hidden="true"></canvas></template>
