<script setup>
// 背景粒子场。两处曾经让它在页面上「消失」的问题在这里都处理掉了：
//   1. 颜色不再依赖 CSS 的 mix-blend-mode:screen —— 浅色主题下 screen 会把粒子合成到接近全白，
//      所以改成由 JS 按主题挑颜色，明暗两种主题都看得见。
//   2. 层次由 style.css 保证：粒子画布 z-index:0，页面内容在 z-index:1 且背景透明。
// 播放音乐时用真实频谱驱动：半径、亮度、连线距离与连线透明度都随低频能量变化。
//
// 性能：这块画布是铺满整个窗口的，一直跑在最底层，所以它的每一帧都会影响全站的手感。
//   · 连线以前是 O(n²)：132 个粒子两两算距离，每帧 8600 多次 Math.hypot，而且每条命中
//     的连线都单独 beginPath + stroke 一次。现在改用格子分桶，只和相邻格子里的粒子比，
//     再把同一档透明度的连线合并成一条路径，一次描边画完。
//   · 标签页切到后台时停笔；devicePixelRatio 封顶到 1.25（铺满全屏的画布在高分屏上按
//     1.5 倍渲染等于多涂一倍多的像素，而粒子只有一个像素大，看不出差别）。
import { onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  playing: { type: Boolean, default: false },
  analyser: { type: Object, default: null },
  isDark: { type: Boolean, default: true },
})

/** 连线透明度的分档数：同一档的连线合并成一条路径，一次描边。 */
const LINK_TIERS = 4
/** 粒子亮度的分档数，同理减少 fillStyle 的切换与路径次数。 */
const DOT_TIERS = 4
/** 每个粒子最多连出几条线。播放时半径会变大，命中数按平方涨，这个上限保证开销有界。 */
const MAX_LINKS_PER_PARTICLE = 5
/** 目标帧率。粒子是缓慢漂移的，30 帧和 60 帧肉眼分辨不出，但省掉一半的重绘。 */
const TARGET_FPS = 40

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
let lastDrawAt = 0
// 分桶用的格子，每帧重建一次。键是 "col,row"，值是粒子下标数组。
const grid = new Map()
let gridCell = 0

const PALETTE = {
  dark: { r: 182, g: 184, b: 240, alpha: 0.46, line: 0.20 },
  light: { r: 92, g: 96, b: 152, alpha: 0.36, line: 0.17 },
}
const palette = () => (props.isDark ? PALETTE.dark : PALETTE.light)

function resize() {
  if (!canvas.value || !context) return
  const scale = Math.min(window.devicePixelRatio || 1, 1.25)
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

// 格子键用数字而不是 "col,row" 字符串：每帧要建一百多个键，字符串会白白制造垃圾回收压力。
const GRID_OFFSET = 4096
const GRID_STRIDE = 8192
const gridKey = (col, row) => (col + GRID_OFFSET) * GRID_STRIDE + (row + GRID_OFFSET)

/** 把所有粒子按格子归位；格子边长取连线的最远距离，命中范围就锁定在相邻 3×3 格内。 */
function rebuildGrid(cell) {
  grid.clear()
  gridCell = cell
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i]
    const key = gridKey(Math.floor(p.x / cell), Math.floor(p.y / cell))
    const bucket = grid.get(key)
    if (bucket) bucket.push(i)
    else grid.set(key, [i])
  }
}

function draw(now) {
  if (!context) return
  if (document.hidden) {
    lastDrawAt = 0
    frame = requestAnimationFrame(draw)
    return
  }
  // 帧率上限：粒子是缓慢漂移的，40 帧和 60 帧看不出差别，但少画三分之一的满屏画布。
  if (now - lastDrawAt < 1000 / TARGET_FPS) {
    frame = requestAnimationFrame(draw)
    return
  }
  lastDrawAt = now

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

  // ---- 位置推进 ----
  // 这里以前是 `(Math.random() - 0.5) * boost`：每帧 264 次随机数，画面上就是一片细碎的
  // 抖动（也就是"浮动太大"的一部分）。换成相位驱动的正弦，位移一样但连续、可预期。
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i]
    p.phase += 0.008 * motion
    const boost = glow * 1.5 + pulse * 1.1
    p.x += (p.vx + Math.sin(p.phase) * 0.13 + Math.sin(p.phase * 1.7) * boost * 0.5) * motion
    p.y += (p.vy + Math.cos(p.phase * 0.8) * 0.13 + Math.cos(p.phase * 2.1) * boost * 0.5) * motion
    if (p.x < -6) p.x = width + 6
    if (p.x > width + 6) p.x = -6
    if (p.y < -6) p.y = height + 6
    if (p.y > height + 6) p.y = -6
  }

  // ---- 连线：按格子找邻居，按透明度分档批量描边 ----
  // Louder passages reach further and draw brighter links.
  // 注意这个上限：reach 是"命中就画"，邻居数随半径**平方**增长。原来播放时能涨到 170，
  // 比待机的 92 多出 3.4 倍的连线，于是"一播放就卡"。现在收敛到 138，并给每个粒子
  // 单独设连线数上限，保证播放时的开销有界。
  const reach = 92 + glow * 46
  const lineAlpha = line + glow * 0.26
  // 每个档位一条路径，画完再统一 stroke 一次。
  const linkPaths = new Array(LINK_TIERS)
  for (let tier = 0; tier < LINK_TIERS; tier += 1) {
    linkPaths[tier] = new Path2D()
  }
  const reachSq = reach * reach
  rebuildGrid(reach)
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i]
    const col = Math.floor(p.x / gridCell)
    const row = Math.floor(p.y / gridCell)
    let drawn = 0
    for (let dc = -1; dc <= 1 && drawn < MAX_LINKS_PER_PARTICLE; dc += 1) {
      for (let dr = -1; dr <= 1 && drawn < MAX_LINKS_PER_PARTICLE; dr += 1) {
        // 必须用和 rebuildGrid 同一个数字键；写成 `${col},${row}` 字符串的话永远查不到，
        // 连线会一条都画不出来（而且格子还照建，白花钱）。
        const bucket = grid.get(gridKey(col + dc, row + dr))
        if (!bucket) continue
        for (let k = 0; k < bucket.length; k += 1) {
          const j = bucket[k]
          if (j <= i) continue
          const q = particles[j]
          const dx = q.x - p.x
          const dy = q.y - p.y
          const distanceSq = dx * dx + dy * dy
          if (distanceSq >= reachSq) continue
          drawn += 1
          if (drawn > MAX_LINKS_PER_PARTICLE) break
          const distance = Math.sqrt(distanceSq)
          // 距离越近越亮，量化成 LINK_TIERS 档。
          const strength = (1 - distance / reach) * lineAlpha
          const tier = Math.min(LINK_TIERS - 1, Math.max(0, Math.floor((strength / Math.max(1e-4, lineAlpha)) * LINK_TIERS)))
          const path = linkPaths[tier]
          path.moveTo(p.x, p.y)
          path.lineTo(q.x, q.y)
        }
      }
    }
  }
  context.lineWidth = 0.6 + glow * 0.5
  for (let tier = 0; tier < LINK_TIERS; tier += 1) {
    const path = linkPaths[tier]
    // 空路径也要跳过，别白白换一次状态。
    if (!path) continue
    // strength 取该档位的代表值，避免每条线各算一次 rgba 字符串。
    const representative = ((tier + 0.5) / LINK_TIERS) * lineAlpha
    context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.95, Math.max(0, representative))})`
    context.stroke(path)
  }

  // ---- 粒子本体：同样按亮度分档合并成几条路径 ----
  context.shadowBlur = 0
  const dotPaths = new Array(DOT_TIERS)
  for (let tier = 0; tier < DOT_TIERS; tier += 1) dotPaths[tier] = new Path2D()
  const shades = new Array(DOT_TIERS).fill(0)
  const shadeCount = new Array(DOT_TIERS).fill(0)
  for (let i = 0; i < particles.length; i += 1) {
    const p = particles[i]
    const radius = p.r * (1 + glow * 1.25) + pulse * 1.4
    const shade = alpha + glow * 0.42 + pulse * 0.18 + Math.sin(p.phase) * 0.06
    const clamped = Math.min(0.95, Math.max(0.04, shade))
    const tier = Math.min(DOT_TIERS - 1, Math.max(0, Math.floor((clamped / 0.95) * DOT_TIERS)))
    const path = dotPaths[tier]
    path.moveTo(p.x + Math.max(0.3, radius), p.y)
    path.arc(p.x, p.y, Math.max(0.3, radius), 0, Math.PI * 2)
    shades[tier] += clamped
    shadeCount[tier] += 1
  }
  for (let tier = 0; tier < DOT_TIERS; tier += 1) {
    if (!shadeCount[tier]) continue
    context.fillStyle = `rgba(${r}, ${g}, ${b}, ${shades[tier] / shadeCount[tier]})`
    context.fill(dotPaths[tier])
  }

  if (!reducedMotion && !destroyed) frame = requestAnimationFrame(draw)
}

function start() {
  if (destroyed) return
  cancelAnimationFrame(frame)
  // 直接调 draw() 的话 now 是 undefined，帧率判断会被跳过；统一走 rAF 拿到时间戳。
  lastDrawAt = 0
  frame = requestAnimationFrame(draw)
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
