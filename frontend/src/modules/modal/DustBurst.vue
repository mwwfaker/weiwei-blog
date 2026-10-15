<script setup>
// 「化作尘埃」的粒子层。关闭阅读框时铺在卡片原来的位置上，往上飘散。
//
// 为什么是 DOM 粒子而不是 canvas：
//   · 粒子要按卡片在屏幕上的实际位置铺开，`getBoundingClientRect()` 拿到的是视口坐标，
//     配 `position:fixed` 直接用，不必每帧同步 canvas 尺寸与 DPR；
//   · 一百多个 2~5px 的圆点在合成层上开销很低，而这个效果的观感几乎全部来自
//     「数量 + 随机延迟 + 上飘」，不来自逐像素还原卡片的颜色。
//   · 代价说清楚：粒子不采样卡片像素（做不到，没有 html2canvas 这类依赖），
//     用的是主题色。所以它是「同一片尘埃」，不是「这张卡片的碎屑」。
//
// 只在 `closing` 为真时挂载，所以 SSR 不会渲染它，也就不存在水合不一致。
const props = defineProps({
  /** 卡片关闭那一刻的 getBoundingClientRect()。 */
  rect: { type: Object, required: true },
  /** 粒子数。手机上少一些，省一点合成开销。 */
  count: { type: Number, default: 150 },
  /**
   * 起始延后（毫秒），要和外壳的「退场前静止」一致——
   * 卡片先定住不动一拍，粒子再从卡片上「剥落」下来，两边同时对得上。
   */
  hold: { type: Number, default: 0 },
})

// 按「卡片宽高比」算行列，让粒子均匀铺满而不是挤在一条线上。
const { left, top, width, height } = props.rect
const cols = Math.max(6, Math.round(Math.sqrt(props.count * (Math.max(width, 1) / Math.max(height, 1)))))
const rows = Math.max(4, Math.ceil(props.count / Math.max(cols, 1)))

const bits = []
for (let row = 0; row < rows; row += 1) {
  for (let col = 0; col < cols; col += 1) {
    const cellW = width / cols
    const cellH = height / rows
    bits.push({
      x: left + (col + 0.5) * cellW + (Math.random() - 0.5) * cellW * 1.7,
      y: top + (row + 0.5) * cellH + (Math.random() - 0.5) * cellH * 1.7,
      size: 1.4 + Math.random() * 3.6,
      dx: (Math.random() - 0.38) * (cellW + 70),
      dy: -24 - Math.random() * 150,
      rot: (Math.random() - 0.5) * 240,
      delay: props.hold + Math.random() * 140,
      dur: 500 + Math.random() * 260,
      // 越靠下的粒子越晚一点飞走，看起来像从下往上被「吹散」
      skew: (row / Math.max(rows - 1, 1)) * 60,
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
        '--dx': bit.dx.toFixed(1) + 'px',
        '--dy': bit.dy.toFixed(1) + 'px',
        '--rot': bit.rot.toFixed(0) + 'deg',
        animationDelay: (bit.delay + bit.skew).toFixed(0) + 'ms',
        animationDuration: bit.dur.toFixed(0) + 'ms',
      }"
    />
  </div>
</template>
