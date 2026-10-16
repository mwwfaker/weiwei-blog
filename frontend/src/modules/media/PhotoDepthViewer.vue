<script setup>
// 立体浏览：把照片按深度图摊成一团**点云**，可以拖动换视角。
//
// 说清楚它是什么：这是**浮雕/视差级**的 2.5D，不是重建出一个能走进去的真实 3D 场景
// （那需要 image-blaster 那种生成式流水线 + 付费 API）。照片的每个像素按深度前后错开，
// 转起来有立体感，仅此而已 —— 但观感足够惊喜，而且完全在本机算、不花一分钱。
//
// three.js 与深度模型都是**点进来才加载**（动态 import + 模型懒载），
// 所以平时翻相册不会多下一字节。
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { estimateDepth, pickDepthBackend } from '@/modules/media/depth'

const props = defineProps({ photo: { type: Object, required: true } })
defineEmits(['close'])

const canvas = ref(null)
const stage = ref('loading') // loading | ready | failed
const note = ref('正在准备…')
const percent = ref(0)
const backend = ref(null)

let stop = null // 卸载时用它收尾（取消动画帧、释放 GPU 资源）

// 点云的列数：行数按图片比例算。约两万个点，手机上也不吃力。
const COLS = 176

async function build() {
  stage.value = 'loading'
  percent.value = 0
  note.value = '正在检查这台设备能不能算深度…'
  const chosen = await pickDepthBackend()
  backend.value = chosen
  note.value = `正在载入深度模型（${chosen.label}，首次${chosen.size}）…`

  // 1) 先把照片画到画布上：后面既要用它取颜色，也要把它喂给深度模型。
  const image = new Image()
  // 必须带 crossOrigin，否则画布会被标成"被污染"，getImageData 直接抛错。
  image.crossOrigin = 'anonymous'
  image.src = props.photo.image
  await image.decode()

  const source = document.createElement('canvas')
  const sw = 512
  const sh = Math.max(1, Math.round((sw * image.naturalHeight) / image.naturalWidth))
  source.width = sw
  source.height = sh
  const context = source.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, sw, sh)
  const pixels = context.getImageData(0, 0, sw, sh).data

  // 2) 深度图
  note.value = '正在计算深度…'
  const { depth, backend: used } = await estimateDepth(source, (event) => {
    if (event?.status === 'progress' && event.progress != null) {
      percent.value = Math.round(event.progress)
      note.value = `正在下载深度模型 ${percent.value}%`
    }
  })
  if (used.device !== chosen.device) note.value = `已自动改用 ${used.label} 计算…`

  // 3) 点云
  note.value = '正在拼点云…'
  const THREE = await import('three')
  const { OrbitControls } = await import('three/addons/controls/OrbitControls.js')

  const rows = Math.max(2, Math.round((COLS * sh) / sw))
  const count = COLS * rows
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const aspect = sw / sh
  const spanX = 1.7
  const spanY = spanX / aspect
  // 深度方向的厚度：太薄没有立体感，太厚会像刺猬。
  const spanZ = Math.min(spanY * 0.9, 0.85)

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const index = row * COLS + col
      const u = col / (COLS - 1)
      const v = row / (rows - 1)
      // 深度图里 1 = 离镜头近
      const dx = Math.min(depth.width - 1, Math.round(u * (depth.width - 1)))
      const dy = Math.min(depth.height - 1, Math.round(v * (depth.height - 1)))
      const d = depth.gray[dy * depth.width + dx]

      positions[index * 3] = (u - 0.5) * spanX
      positions[index * 3 + 1] = (0.5 - v) * spanY
      positions[index * 3 + 2] = (d - 0.5) * spanZ

      const px = Math.min(sw - 1, Math.round(u * (sw - 1)))
      const py = Math.min(sh - 1, Math.round(v * (sh - 1)))
      const offset = (py * sw + px) * 4
      // 线性空间里上色更接近原图观感（three 默认按 sRGB 输出，这里做一次近似转换）
      colors[index * 3] = (pixels[offset] / 255) ** 2.2
      colors[index * 3 + 1] = (pixels[offset + 1] / 255) ** 2.2
      colors[index * 3 + 2] = (pixels[offset + 2] / 255) ** 2.2
    }
  }

  const renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1))
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80)
  camera.position.set(0, 0, Math.max(spanX, spanY) * 1.25)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.PointsMaterial({
    size: spanX / COLS * 1.9,
    vertexColors: true,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.97,
  })
  const cloud = new THREE.Points(geometry, material)
  scene.add(cloud)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.rotateSpeed = 0.55
  controls.zoomSpeed = 0.7
  controls.minDistance = Math.max(spanX, spanY) * 0.45
  controls.maxDistance = Math.max(spanX, spanY) * 3.2
  // 轻轻自转，像还活着；手一碰就停（下面监听 start 事件）。
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.55
  controls.addEventListener('start', () => { controls.autoRotate = false })

  const resize = () => {
    const box = canvas.value?.parentElement?.getBoundingClientRect()
    if (!box || !box.width) return
    renderer.setSize(box.width, box.height, false)
    camera.aspect = box.width / box.height
    camera.updateProjectionMatrix()
  }
  resize()
  const observer = new ResizeObserver(resize)
  if (canvas.value?.parentElement) observer.observe(canvas.value.parentElement)

  let frame = 0
  const tick = () => {
    controls.update()
    renderer.render(scene, camera)
    frame = requestAnimationFrame(tick)
  }
  tick()

  stop = () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
    controls.dispose()
    geometry.dispose()
    material.dispose()
    renderer.dispose()
  }

  stage.value = 'ready'
  note.value = ''
}

onMounted(() => {
  build().catch((error) => {
    stage.value = 'failed'
    note.value = error?.message || '深度计算失败'
  })
})

onBeforeUnmount(() => {
  stop?.()
  stop = null
})
</script>

<template>
  <div class="depth-viewer">
    <canvas ref="canvas" class="depth-canvas"></canvas>

    <div v-if="stage === 'loading'" class="depth-overlay">
      <span class="depth-spinner"></span>
      <strong>{{ note }}</strong>
      <small v-if="percent">首次要下模型，之后再看别的照片是秒开</small>
    </div>

    <div v-else-if="stage === 'failed'" class="depth-overlay">
      <strong>立体浏览没能起来</strong>
      <small>{{ note }}</small>
      <small>（模型要从网上取一次，网络不通就换不了视角；照片本身不受影响）</small>
      <button class="depth-back" @click="$emit('close')">回到平面</button>
    </div>

    <div v-else class="depth-hint">
      <span>拖动换视角 · 滚轮缩放</span>
      <button class="depth-back" @click="$emit('close')">回到平面</button>
    </div>
  </div>
</template>
