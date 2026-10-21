// 首页 3D 舞台的「素材工厂」：GLSL 与几何数据在这里生成，three 的组装留在 HeroScene.vue。
//
// 为什么单独一个 .js 而不是全塞进 HeroScene.vue：
//   · HeroScene 已经是「生命周期 + 交互 + 渲染循环」，再从里面长出采样与噪声代码就会过 400 行；
//   · 这里的函数都是纯的（输入→数组/字符串），不解构 Vue，也不 import three，
//     所以模块在 SSR 渲染测试里被安全加载，而 three 仍然只在浏览器里动态 import。
//
// 颜色是固定的「夜空」：首页首屏是整页唯一一块恒暗的区域，不跟主题走。
// 原因见 modules/particle/README.md —— 粒子在浅色底上会整片消失，强行跟主题只会两头不讨好。

/** 背景液态金属的顶点着色器：铺满屏幕的 2×2 平面，直接写 NDC。 */
export const LIQUID_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

/**
 * 背景液态金属：域扭曲噪声 + 虹彩油膜高光 + 指针涟漪 + 点击扩散环。
 *
 * 几条约定的来由：
 *   · 亮度压低（整体 0.02~0.35）——它是「字后面的水」，抢了亮度标题就看不清；
 *   · 左上角额外压暗：首页的标题与按钮固定在那里，靠 CSS 遮罩不够稳（画布内容会变）；
 *   · 指针涟漪的强度用 exp(-d) 衰减，鼠标离开后自然消失，不需要每帧重置状态。
 */
export const LIQUID_FRAGMENT = `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform vec2 uPointer;
uniform vec2 uPulseAt;
uniform float uPulse;
uniform float uAspect;
uniform float uFade;
uniform float uLight;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p = p * 2.03 + 11.3;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  vec2 pointer = (uPointer - 0.5) * vec2(uAspect, 1.0);
  float t = uTime * 0.05;

  // 指针涟漪：手指搅动水面
  float d = length(p - pointer);
  float ripple = sin(d * 13.0 - uTime * 2.2) * exp(-d * 3.4);

  // 点击扩散环：uPulse 从 0 涨到 1，环半径随之扩大并淡出
  vec2 pulseOrigin = (uPulseAt - 0.5) * vec2(uAspect, 1.0);
  float dp = length(p - pulseOrigin);
  float ring = exp(-pow((dp - uPulse * 2.0) * 5.0, 2.0)) * (1.0 - uPulse);

  vec2 q = p * 1.7 + vec2(ripple * 0.05) + ring * 0.05;
  float n = fbm(q * 1.5 + vec2(t, -t * 0.8));
  n = 0.6 * n + 0.4 * fbm(q * 3.4 - vec2(t * 1.3, t * 0.6));

  float ridge = smoothstep(0.30, 0.92, n);
  vec3 deep = vec3(0.018, 0.016, 0.060);
  vec3 mid = vec3(0.150, 0.082, 0.380);
  vec3 high = vec3(0.400, 0.250, 0.880);
  // 白天主题：同一套噪声换成「纸 + 雾 + 一点紫」的亮色系，而不是把夜晚的图整体提亮
  vec3 deepLight = vec3(0.965, 0.955, 0.972);
  vec3 midLight = vec3(0.885, 0.870, 0.930);
  vec3 highLight = vec3(0.740, 0.715, 0.900);
  deep = mix(deep, deepLight, uLight);
  mid = mix(mid, midLight, uLight);
  high = mix(high, highLight, uLight);
  vec3 col = mix(deep, mid, ridge);
  col = mix(col, high, smoothstep(0.62, 1.0, n));

  // 油膜：两组相位不同的高光带，颜色在青与粉之间走，是「虹彩」的来源
  float sheen = pow(max(0.0, sin(n * 9.0 + t * 6.0)), 4.0)
    + 0.5 * pow(max(0.0, sin(n * 17.0 - t * 4.0)), 6.0);
  vec3 iridescence = mix(
    vec3(0.24, 0.82, 0.96),
    vec3(1.0, 0.42, 0.80),
    0.5 + 0.5 * sin(n * 7.0 + t * 3.0)
  );
  col += iridescence * sheen * mix(0.30, 0.10, uLight);

  col += vec3(0.42, 0.34, 1.0) * ripple * mix(0.14, 0.05, uLight);
  col += vec3(0.72, 0.54, 1.0) * ring * mix(0.50, 0.16, uLight);

  float vignette = smoothstep(0.12, 0.95, length((uv - 0.5) * vec2(1.0, 1.15)));
  col *= 1.0 - mix(0.50, 0.16, uLight) * vignette;

  // 左上留给标题：夜里压暗，白天则不需要（标题是深色的）
  col *= mix(mix(0.42, 1.0, smoothstep(0.0, 0.70, uv.x + (1.0 - uv.y) * 0.5)), 1.0, uLight);

  gl_FragColor = vec4(col * uFade, 1.0);
}
`

/** 首屏的粒子字。改这句等于改主视觉，长度别超过 4 个字（采样宽度会挤成一团）。 */
export const WORDMARK = '唯唯园'

/** 星体的颜色池：紫、青、粉各一颗，读起来像同一片星云而不是随机彩灯。 */
export const STAR_COLORS = ['#c9b6ff', '#8fd7ff', '#ffc6e8', '#a9a0ff', '#e7dcff', '#9f8cff']

const canUseCanvas = () => typeof document !== 'undefined'

/**
 * 把一句话采样成点云。
 *
 * 做法：把字画到离屏画布上，按 alpha 取点，再洗牌取子集。
 * **必须洗牌**：按行顺序取前 N 个点，字会被裁成只剩上半截；即使不裁，点也会排成栅格，
 * 旋转时能看见一条条扫描线。
 *
 * 返回的 xs/ys 已经归一化到 0~1（y 轴翻转成向上为正），aspect 保留字宽高比，
 * 由调用方决定世界尺寸，这样换字号不会改变排版。
 */
export function sampleWordmark(text, { target = 4200, stride = 2, width = 1024, height = 512 } = {}) {
  if (!canUseCanvas()) return null
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null

  const family = '"Noto Serif SC", "Songti SC", STSong, serif'
  let size = Math.round(height * 0.62)
  context.font = `700 ${size}px ${family}`
  while (size > 48 && context.measureText(text).width > width * 0.88) {
    size -= 6
    context.font = `700 ${size}px ${family}`
  }

  context.clearRect(0, 0, width, height)
  context.fillStyle = '#ffffff'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, width / 2, height / 2)

  const { data } = context.getImageData(0, 0, width, height)
  const points = []
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      if (data[(y * width + x) * 4 + 3] > 140) points.push(x, y)
    }
  }
  if (!points.length) return null

  const total = points.length / 2
  for (let i = total - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const px = points[i * 2]
    const py = points[i * 2 + 1]
    points[i * 2] = points[j * 2]
    points[i * 2 + 1] = points[j * 2 + 1]
    points[j * 2] = px
    points[j * 2 + 1] = py
  }

  const count = Math.min(total, target)
  const xs = new Float32Array(count)
  const ys = new Float32Array(count)
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let i = 0; i < count; i += 1) {
    // ±0.8px 抖动：去掉采样栅格留下的规则感
    const x = points[i * 2] + (Math.random() - 0.5) * 1.6
    const y = points[i * 2 + 1] + (Math.random() - 0.5) * 1.6
    xs[i] = x
    ys[i] = y
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const spanX = Math.max(1, maxX - minX)
  const spanY = Math.max(1, maxY - minY)
  for (let i = 0; i < count; i += 1) {
    xs[i] = (xs[i] - minX) / spanX
    // 画布 y 向下，世界 y 向上，这里翻一次
    ys[i] = 1 - (ys[i] - minY) / spanY
  }
  return { xs, ys, count, aspect: spanX / spanY }
}

/**
 * 采样失败时的替身：一圈发光点。
 * 有它，字体没装上或画布被禁时首屏依然是「有东西」的，而不是一片黑。
 */
export function ringWordmark(count = 1600) {
  const xs = new Float32Array(count)
  const ys = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.05
    const radius = 0.5 + Math.random() * 0.045
    xs[i] = 0.5 + Math.cos(angle) * radius * 0.98
    ys[i] = 0.5 + Math.sin(angle) * radius
  }
  return { xs, ys, count, aspect: 1 }
}

/** 星尘/粒子共用的圆点贴图：没有它，PointsMaterial 画的是方块。 */
export function makeDotCanvas(size = 64) {
  if (!canUseCanvas()) return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null
  const half = size / 2
  const gradient = context.createRadialGradient(half, half, 0, half, half, half)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.32, 'rgba(255,255,255,0.62)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  return canvas
}

/** 日记星体的光晕贴图：中心实、外圈很散，叠在夜空里像「有星芒的星」。 */
export function makeGlowCanvas(size = 128) {
  if (!canUseCanvas()) return null
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) return null
  const half = size / 2
  const gradient = context.createRadialGradient(half, half, 0, half, half, half)
  gradient.addColorStop(0, 'rgba(255,255,255,1)')
  gradient.addColorStop(0.12, 'rgba(255,255,255,0.95)')
  gradient.addColorStop(0.34, 'rgba(255,255,255,0.32)')
  gradient.addColorStop(1, 'rgba(255,255,255,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, size, size)
  return canvas
}

/**
 * 星尘的位置/速度/相位。
 * 速度不设零：完全静止的粉尘在缓慢旋转的镜头里会像贴图，动一点点就「活着」。
 */
export function buildDust(count, { x = 18, y = 10, z = 12 } = {}) {
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  const phases = new Float32Array(count)
  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3
    positions[i3] = (Math.random() - 0.5) * x
    positions[i3 + 1] = (Math.random() - 0.5) * y
    positions[i3 + 2] = (Math.random() - 0.5) * z
    velocities[i3] = (Math.random() - 0.5) * 0.014
    velocities[i3 + 1] = (Math.random() - 0.5) * 0.012
    velocities[i3 + 2] = (Math.random() - 0.5) * 0.01
    phases[i] = Math.random() * Math.PI * 2
  }
  return { positions, velocities, phases }
}
