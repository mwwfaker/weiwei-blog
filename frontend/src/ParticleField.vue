<script setup>
// 背景粒子场。两处曾经让它在页面上「消失」的问题在这里都处理掉了：
//   1. 颜色不再依赖 CSS 的 mix-blend-mode:screen —— 浅色主题下 screen 会把粒子合成到接近全白，
//      所以改成由 JS 按主题挑颜色，明暗两种主题都看得见。
//   2. 层次由 style.css 保证：粒子画布 z-index:0，页面内容在 z-index:1 且背景透明。
// 播放音乐时用真实频谱驱动：半径、亮度、连线距离与连线透明度都随低频能量变化。
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  playing: { type: Boolean, default: false },
  analyser: { type: Object, default: null },
  isDark: { type: Boolean, default: true },
})

const canvas = ref(null)
let context
let frame = 0
let width = 0
let height = 0
let particles = []
let reducedMotion = false
let motionQuery
let motionHandler
let destroyed = false
let bins = null
// Smoothed so the reaction looks like music rather than a flickering readout.
let energy = 0
let pulse = 0
let clock = 0

const PALETTE = {
  dark: { r: 182, g: 184, b: 240, alpha: 0.46, line: 0.20 },
  light: { r: 92, g: 96, b: 152, alpha: 0.36, line: 0.17 },
}
const palette = () => (props.isDark ? PALETTE.dark : PALETTE.light)

function resize() {
  if (!canvas.value || !context) return
  const scale = Math.min(window.devicePixelRatio || 1, 1.5)
  width = window.innerWidth
  height = window.innerHeight
  canvas.value.width = Math.round(width * scale)
  canvas.value.height = Math.round(height * scale)
  canvas.value.style.width = `${width}px`
  canvas.value.style.height = `${height}px`
  context.setTransform(scale, 0, 0, scale, 0, 0)
  const count = Math.min(132, Math.round((width * height) / 11000))
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.34,
    vy: (Math.random() - 0.5) * 0.34,
    r: Math.random() * 1.5 + 0.5,
    phase: Math.random() * Math.PI * 2,
  }))
}

// Reuses one buffer instead of allocating per frame.
function readEnergy() {
  if (!props.playing || !props.analyser) return 0
  const size = props.analyser.frequencyBinCount || 0
  if (!size) return 0
  if (!bins || bins.length !== size) bins = new Uint8Array(size)
  props.analyser.getByteFrequencyData(bins)
  // Low bins carry the beat, which is what "跟着律动" should track.
  const window = Math.min(28, size)
  let sum = 0
  for (let i = 0; i < window; i += 1) sum += bins[i]
  return sum / (window * 255)
}

function draw() {
  if (!context) return
  context.clearRect(0, 0, width, height)

  const target = readEnergy()
  // Fast attack, slow release: peaks register instantly, then decay smoothly.
  energy += (target - energy) * (target > energy ? 0.5 : 0.07)
  if (target > 0.32) pulse = Math.min(1, pulse + (target - 0.32) * 1.4)
  pulse *= 0.9
  clock += 1

  // No analyser (an external HTTPS stream the browser will not expose to Web Audio): breathe
  // gently while playing so the field still looks alive, without pretending to be real spectrum.
  const ambient = props.playing && !props.analyser ? 0.16 + Math.sin(clock * 0.022) * 0.07 : 0
  const glow = Math.max(energy, ambient)
  const { r, g, b, alpha, line } = palette()
  const motion = reducedMotion ? 0 : 1

  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i]
    p.phase += 0.008 * motion
    const boost = glow * 1.5 + pulse * 1.1
    p.x += (p.vx + Math.sin(p.phase) * 0.13 + (Math.random() - 0.5) * boost * 0.6) * motion
    p.y += (p.vy + Math.cos(p.phase * 0.8) * 0.13 + (Math.random() - 0.5) * boost * 0.6) * motion
    if (p.x < -6) p.x = width + 6
    if (p.x > width + 6) p.x = -6
    if (p.y < -6) p.y = height + 6
    if (p.y > height + 6) p.y = -6

    const radius = p.r * (1 + glow * 1.25) + pulse * 1.4
    const shade = alpha + glow * 0.42 + pulse * 0.18 + Math.sin(p.phase) * 0.06
    context.beginPath()
    context.arc(p.x, p.y, Math.max(0.3, radius), 0, Math.PI * 2)
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.95, Math.max(0.04, shade))})`
    context.fill()

    // Louder passages reach further and draw brighter links.
    const reach = 92 + glow * 78
    for (let j = i + 1; j < particles.length; j += 1) {
      const q = particles[j]
      const dx = q.x - p.x
      const dy = q.y - p.y
      const distance = Math.hypot(dx, dy)
      if (distance < reach) {
        context.beginPath()
        context.moveTo(p.x, p.y)
        context.lineTo(q.x, q.y)
        context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(1 - distance / reach) * (line + glow * 0.26)})`
        context.lineWidth = 0.6 + glow * 0.5
        context.stroke()
      }
    }
  }

  if (!reducedMotion && !destroyed) frame = requestAnimationFrame(draw)
}

function start() {
  if (destroyed) return
  cancelAnimationFrame(frame)
  draw()
}

onMounted(() => {
  context = canvas.value?.getContext('2d', { alpha: true })
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion = motionQuery.matches
  motionHandler = (event) => { reducedMotion = event.matches; start() }
  motionQuery.addEventListener('change', motionHandler)
  resize()
  start()
  window.addEventListener('resize', resize)
})

onUnmounted(() => {
  destroyed = true
  cancelAnimationFrame(frame)
  window.removeEventListener('resize', resize)
  if (motionQuery && motionHandler) motionQuery.removeEventListener('change', motionHandler)
})

watch(() => props.playing, start)
// 主题切换后颜色要立刻跟着变，否则会残留上一个主题的粒子颜色。
watch(() => props.isDark, () => { if (reducedMotion) start() })
</script>

<template><canvas ref="canvas" class="particle-field" aria-hidden="true"></canvas></template>
