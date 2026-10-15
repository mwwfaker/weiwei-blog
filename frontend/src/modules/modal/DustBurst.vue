<script setup>
// 「化作尘埃」的粒子层。关闭阅读框时铺在卡片原来的位置上，往上飘散。
//
// 为什么是 DOM 粒子而不是 canvas：
//   · 粒子要按卡片在屏幕上的实际位置铺开，`getBoundingClientRect()` 拿到的是视口坐标，
//     配 `position:fixed` 直接用，不必每帧同步 canvas 尺寸与 DPR；
//   · 代价说清楚：粒子不采样卡片像素（那要引 html2canvas 这类依赖），用的是主题色。
//     所以它是「同一片尘埃」，不是「这张卡片的碎屑」。
//
// 让它「看得出来」靠这四件事（第一版太含蓄，用户反馈看不见）：
//   1. 够大：2~8px，不是 1.4~5px 那种像素点；
//   2. 够亮：三种色调轮着来（强调色 / 中性灰 / 近白），并且自带发光，
//      因为背板是深色的，浅色粒子才跳得出来；
//   3. 停留够久：每颗飞 620~950ms，亮度在前 40% 基本不衰减；
//   4. 够多：宽屏 420 颗（外壳按屏宽决定），并且越靠下的越晚飞走。
//
// 只在 `closing` 为真时挂载，所以 SSR 不会渲染它，也就不存在水合不一致。
const props = defineProps({
  /** 卡片关闭那一刻的 getBoundingClientRect()。 */
  rect: { type: Object, required: true },
  /** 粒子数。数量越多越像「沙砾」，但每个粒子都带发光阴影，手机上别给太多。 */
  count: { type: Number, default: 420 },
  /**
   * 起始延后（毫秒），要和外壳的「退场前静止」一致——
   * 卡片先定住不动一拍，粒子再从卡片上「剥落」下来，两边同时对得上。
   */
  hold: { type: Number, default: 0 },
})

/** 三种色调轮着用。都偏亮：背板本身是深色的，深色粒子会看不见。 */
const TONES = ['var(--accent)', 'color-mix(in srgb, var(--muted) 80%, #fff)', 'rgba(255,255,255,.92)']

// 按「卡片宽高比」算行列，让粒子均匀铺满而不是挤在一条线上。
const { left, top, width, height } = props.rect
const cols = Math.max(6, Math.round(Math.sqrt(props.count * (Math.max(width, 1) / Math.max(height, 1)))))
const rows = Math.max(4, Math.ceil(props.count / Math.max(cols, 1)))

const bits = []
let seed = 0
for (let row = 0; row < rows; row += 1) {
  for (let col = 0; col < cols; col += 1) {
    const cellW = width / cols
    const cellH = height / rows
    bits.push({
      x: left + (col + 0.5) * cellW + (Math.random() - 0.5) * cellW * 1.7,
      y: top + (row + 0.5) * cellH + (Math.random() - 0.5) * cellH * 1.7,
      size: 2 + Math.random() * 6,
      tone: TONES[seed++ % TONES.length],
      dx: (Math.random() - 0.38) * (cellW + 110),
      dy: -18 - Math.random() * 170,
      rot: (Math.random() - 0.5) * 240,
      delay: props.hold + Math.random() * 120,
      dur: 620 + Math.random() * 330,
      // 越靠下的粒子越晚一点飞走，看起来像从下往上被「吹散」
      skew: (row / Math.max(rows - 1, 1)) * 50,
    })
  }
}
</script>

<template>
  <div class="dust-burst" aria-hidden="true">
    <span
      v-for="(bit, index) in bits"
      :key="index"
      class="dust-bit"
      :style="{
        left: bit.x + 'px',
        top: bit.y + 'px',
        width: bit.size + 'px',
        height: bit.size + 'px',
        color: bit.tone,
        '--dx': bit.dx.toFixed(1) + 'px',
        '--dy': bit.dy.toFixed(1) + 'px',
        '--rot': bit.rot.toFixed(0) + 'deg',
        animationDelay: (bit.delay + bit.skew).toFixed(0) + 'ms',
        animationDuration: bit.dur.toFixed(0) + 'ms',
      }"
    />
  </div>
</template>
