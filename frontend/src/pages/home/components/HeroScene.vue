<script setup>
// 首页首屏的 3D 舞台：虹彩液态背景 + 粒子字「唯唯园」+ 围着它运行的日记星体。
//
// 三条边界（改之前先读）：
//   1. three 只在 onMounted 里动态 import。静态 import 会把 600 kB 的库塞进首屏包，
//      而且 SSR 渲染测试会在 Node 里加载它——和 modules/media/PhotoDepthViewer.vue 同一套做法。
//   2. 这里不读 store、不碰路由：星体数据由 props 进来，点开日记只 emit('open')。
//      渲染循环里混进业务，是这个组件以后最难拆的地方。
//   3. 没有 WebGL 就 emit('failed')，让 HomeHero 退回 CSS 版主视觉。**不要在这里抛错**：
//      首屏组件挂载失败会把整个首页的白底露出来。
//
// 剩下的分块：背景液态在这一个文件里（它就是一块 mesh + 几个 uniform），
// 会动的粒子字/星尘在 heroParticles.js，日记星体在 heroStars.js。
// 每个文件都只依赖传进来的 three 命名空间，互相不 import。
//
// 性能约束：
//   · 视口外 / 标签页隐藏时不渲染（滚到下面读文章时停笔）；
//   · devicePixelRatio 封顶 1.5：首屏是一整块液态噪声，按 2 倍渲染等于多涂一倍像素；
//   · 指针投影、悬停拾取共用同一次相机矩阵更新，不在循环里 new Vector3。
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LIQUID_FRAGMENT, LIQUID_VERTEX, makeDotCanvas, makeGlowCanvas } from './heroStage'
import { createDustField, createWordmark } from './heroParticles'
import { createStars } from './heroStars'

const props = defineProps({
  entries: { type: Array, default: () => [] },
  /** 白天主题用另一套配色（纸/雾/紫），不是把夜空整体提亮。 */
  light: { type: Boolean, default: false },
})
const emit = defineEmits(['ready', 'failed', 'hover', 'open'])

const host = ref(null)
const canvas = ref(null)

/** 整套 three 状态在 build() 里组装；null = 还没好或已销毁。 */
let stage = null
let alive = true

onMounted(async () => {
  const api = await build()
  if (!alive) { api?.destroy(); return }
  stage = api
})
onBeforeUnmount(() => {
  alive = false
  stage?.destroy()
  stage = null
})
// 日记是异步到的：列表一变就重挂星体，不重建整个场景（重建会闪一下黑）。
watch(() => props.entries, (entries) => stage?.syncStars(entries))

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

async function build() {
  const hostEl = host.value
  const canvasEl = canvas.value
  if (!hostEl || !canvasEl) return null

  let THREE
  try {
    THREE = await import('three')
  } catch (error) {
    emit('failed')
    return null
  }
  if (!canvasEl.isConnected) return null

  // 粒子字是用网页字体采样出来的：字体没到就采样会拿到一套衬线不对的字形。
  // 只等一小会儿——等不到也得显示，宁可字形普通，不能首屏空着。
  if (document.fonts?.ready) {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => { setTimeout(resolve, 1200) }),
    ])
    if (!canvasEl.isConnected) return null
  }

  let renderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvasEl,
      alpha: false,
      antialias: false,
      powerPreference: 'high-performance',
    })
  } catch (error) {
    emit('failed')
    return null
  }
  const reduced = typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.autoClear = false
  renderer.setClearColor(0x05040c, 1)

  const dotCanvas = makeDotCanvas()
  const glowCanvas = makeGlowCanvas()
  if (!dotCanvas || !glowCanvas) {
    emit('failed')
    renderer.dispose()
    return null
  }
  const dotTexture = new THREE.CanvasTexture(dotCanvas)
  const glowTexture = new THREE.CanvasTexture(glowCanvas)

  // ---------- 背景：液态虹彩（正交相机铺满屏幕，先画它） ----------
  const uniforms = {
    uTime: { value: 0 },
    uPointer: { value: new THREE.Vector2(-2, -2) },
    uPulseAt: { value: new THREE.Vector2(0.5, 0.5) },
    uPulse: { value: 0 },
    uAspect: { value: 1 },
    uFade: { value: 1 },
    uLight: { value: props.light ? 1 : 0 },
  }
  const backdropScene = new THREE.Scene()
  const backdropCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const backdropGeometry = new THREE.PlaneGeometry(2, 2)
  const backdropMaterial = new THREE.ShaderMaterial({
    vertexShader: LIQUID_VERTEX,
    fragmentShader: LIQUID_FRAGMENT,
    uniforms,
    depthTest: false,
    depthWrite: false,
  })
  const backdrop = new THREE.Mesh(backdropGeometry, backdropMaterial)
  backdrop.frustumCulled = false
  backdropScene.add(backdrop)

  // ---------- 主体场景 ----------
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 80)
  // 相机绕原点转（画面中心），但字与星体摆在右边：标题在左、星座在右。
  // 如果让相机 lookAt 字的锚点，字会被摆到正中间，压住标题。
  const orbitCenter = new THREE.Vector3(0, 0, 0)
  const wordAnchor = new THREE.Vector3(2.35, 0.1, 0)
  let radius = 8.4
  let compact = false

  const small = hostEl.clientWidth < 760
  const dust = createDustField(THREE, { texture: dotTexture, count: small ? 1100 : 2400, light: props.light })
  scene.add(dust.points)

  const word = createWordmark(THREE, { texture: dotTexture, compact, width: 3.2, light: props.light })
  word.group.position.copy(wordAnchor)
  scene.add(word.group)

  const stars = createStars(THREE, { texture: glowTexture, center: wordAnchor, light: props.light })
  stars.group.position.set(0, 0, 0)
  scene.add(stars.group)
  stars.sync(props.entries)

  // 轨道环：让「可以转」这件事在静止时也看得出来
  const orbitGroup = new THREE.Group()
  orbitGroup.position.copy(wordAnchor)
  scene.add(orbitGroup)
  const ringGeometry = []
  const ringMaterial = new THREE.LineBasicMaterial({
    color: 0x8f7bff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  for (let i = 0; i < 3; i += 1) {
    const points = []
    const ringRadius = 2.3 + i * 1.05
    for (let step = 0; step <= 128; step += 1) {
      const angle = (step / 128) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * ringRadius, Math.sin(angle) * ringRadius * 0.4, 0))
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const line = new THREE.Line(geometry, ringMaterial)
    line.rotation.set(1.15 - i * 0.55, 0.2 + i * 0.3, i * 0.4)
    orbitGroup.add(line)
    ringGeometry.push(geometry)
  }

  // ---------- 指针与相机 ----------
  const raycaster = new THREE.Raycaster()
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  const ndc = new THREE.Vector2()
  const pointerWorld = new THREE.Vector3()
  const localPoint = new THREE.Vector3(0, 0, -99)
  const pointerUv = new THREE.Vector2(-2, -2)
  let pointerActive = false
  let yaw = 0
  let pitch = 0
  let yawTarget = 0
  let pitchTarget = 0
  let dragging = false
  let moved = 0
  let downAt = 0
  let dragX = 0
  let dragY = 0
  let hovered = -1
  let scrollShift = 0
  let scrollDirty = true
  let pulse = 0
  let pulseActive = false
  let pointerRect = hostEl.getBoundingClientRect()

  function placeCamera() {
    const distance = radius + scrollShift * 1.5
    const cosPitch = Math.cos(pitch)
    camera.position.set(
      orbitCenter.x + Math.sin(yaw) * distance * cosPitch,
      orbitCenter.y + 0.12 + Math.sin(pitch) * distance,
      orbitCenter.z + Math.cos(yaw) * distance * cosPitch,
    )
    camera.lookAt(orbitCenter)
    camera.updateMatrixWorld()
  }

  function resize() {
    pointerRect = hostEl.getBoundingClientRect()
    const width = Math.max(1, Math.round(pointerRect.width))
    const height = Math.max(1, Math.round(pointerRect.height))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    uniforms.uAspect.value = width / height
    const nextCompact = width < 820
    if (nextCompact !== compact) {
      compact = nextCompact
      wordAnchor.set(compact ? 0 : 2.35, compact ? -0.9 : 0.1, 0)
      word.group.position.copy(wordAnchor)
      word.group.scale.setScalar(compact ? 0.78 : 1)
      orbitGroup.position.copy(wordAnchor)
      orbitGroup.scale.setScalar(compact ? 0.82 : 1)
      radius = compact ? 9.4 : 8.4
      stars.sync(props.entries)
      hovered = -1
    }
  }
  resize()

  function pointerWorldAt() {
    raycaster.setFromCamera(ndc, camera)
    return raycaster.ray.intersectPlane(plane, pointerWorld) ? pointerWorld : null
  }

  function updateHover(index, x, y) {
    stars.setHovered(index)
    hostEl.classList.toggle('is-star', index >= 0)
    if (index < 0) {
      hovered = -1
      emit('hover', null)
      return
    }
    hovered = index
    const entry = stars.entryAt(index)
    if (!entry) {
      emit('hover', null)
      return
    }
    emit('hover', {
      x: Math.round(x),
      y: Math.round(y),
      entry: {
        id: entry.id,
        title: entry.title,
        date: entry.date,
        excerpt: (entry.content || '').slice(0, 40),
      },
    })
  }

  /** 点击空白处：给粒子一记向外的冲量，并在液体上放一圈扩散环。 */
  function shock() {
    const origin = pointerWorldAt() || new THREE.Vector3(wordAnchor.x, 0, 0)
    localPoint.copy(origin)
    word.group.updateMatrixWorld()
    word.group.worldToLocal(localPoint)
    word.shock(localPoint)
    dust.shock(origin)
    stars.shock(origin)
    uniforms.uPulseAt.value.set(pointerUv.x, pointerUv.y)
    pulse = 0.001
    pulseActive = true
  }

  // ---------- 事件 ----------
  function onPointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    dragging = true
    moved = 0
    downAt = performance.now()
    dragX = event.clientX
    dragY = event.clientY
    hostEl.setPointerCapture?.(event.pointerId)
  }

  function onPointerMove(event) {
    pointerRect = hostEl.getBoundingClientRect()
    const px = event.clientX - pointerRect.left
    const py = event.clientY - pointerRect.top
    ndc.set((px / pointerRect.width) * 2 - 1, -((py / pointerRect.height) * 2 - 1))
    pointerUv.set(px / pointerRect.width, 1 - py / pointerRect.height)
    uniforms.uPointer.value.copy(pointerUv)
    pointerActive = true

    if (dragging) {
      const dx = event.clientX - dragX
      const dy = event.clientY - dragY
      dragX = event.clientX
      dragY = event.clientY
      moved += Math.abs(dx) + Math.abs(dy)
      yawTarget = clamp(yawTarget + dx * 0.0042, -0.62, 0.62)
      pitchTarget = clamp(pitchTarget + dy * 0.0028, -0.32, 0.32)
      if (moved > 8 && hovered >= 0) updateHover(-1, 0, 0)
      return
    }

    const pick = stars.pick(px, py, pointerRect, camera)
    if (pick.index !== hovered) updateHover(pick.index, pick.x, pick.y)
    else if (pick.index >= 0) updateHover(pick.index, pick.x, pick.y)
  }

  function onPointerUp(event) {
    const quick = performance.now() - downAt < 650 && moved < 8
    dragging = false
    hostEl.releasePointerCapture?.(event.pointerId)
    if (!quick) return
    const pick = stars.pick(event.clientX - pointerRect.left, event.clientY - pointerRect.top, pointerRect, camera)
    if (pick.index >= 0) {
      const entry = stars.entryAt(pick.index)
      if (entry) {
        emit('open', entry)
        return
      }
    }
    shock()
  }

  function onPointerLeave() {
    pointerActive = false
    if (!dragging) updateHover(-1, 0, 0)
  }

  const onScroll = () => { scrollDirty = true }
  hostEl.addEventListener('pointerdown', onPointerDown)
  hostEl.addEventListener('pointermove', onPointerMove)
  hostEl.addEventListener('pointerup', onPointerUp)
  hostEl.addEventListener('pointercancel', onPointerUp)
  hostEl.addEventListener('pointerleave', onPointerLeave)
  window.addEventListener('scroll', onScroll, { passive: true })
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(hostEl)

  // 滚下去读文章时停笔：这块画布不该在视口外继续吃 GPU
  let visible = true
  let intersectionObserver = null
  if (typeof IntersectionObserver !== 'undefined') {
    intersectionObserver = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting)
    }, { threshold: 0.02 })
    intersectionObserver.observe(hostEl)
  }

  // ---------- 每帧 ----------
  let raf = 0
  let clock = 0
  let last = 0
  let firstFrame = true

  function tick(now) {
    raf = requestAnimationFrame(tick)
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000))
    last = now
    if (!visible || document.hidden) return

    if (!reduced) clock += dt
    uniforms.uTime.value = clock

    if (scrollDirty) {
      scrollDirty = false
      // 舞台现在是固定在视口上的（首页整页都是这个世界），所以进度要按整篇文档算：
      // 用 host 的 rect 永远是 0，镜头就永远不会动。
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
      scrollShift = clamp(window.scrollY / max, 0, 1)
      uniforms.uFade.value = 1 - scrollShift * 0.35
      word.setFade(1 - scrollShift * 2.2)
    }

    yaw += (yawTarget - yaw) * clamp(dt * 6, 0.05, 1)
    pitch += (pitchTarget - pitch) * clamp(dt * 6, 0.05, 1)
    placeCamera()
    word.group.quaternion.copy(camera.quaternion)
    word.group.updateMatrixWorld()

    if (pointerActive) {
      const hit = pointerWorldAt()
      if (hit) {
        localPoint.copy(hit)
        word.group.worldToLocal(localPoint)
        word.setPointer(localPoint)
      }
    } else {
      word.setPointer(null)
    }

    if (pulseActive) {
      pulse += dt / 1.1
      if (pulse >= 1) { pulseActive = false; uniforms.uPulse.value = 0 }
      else uniforms.uPulse.value = pulse
    }

    word.update(dt)
    dust.update({ dt, clock, pointer: pointerActive ? pointerWorld : null })
    stars.update({ dt, reduced })
    if (!reduced) {
      orbitGroup.rotation.z += dt * 0.05
      orbitGroup.rotation.y += dt * 0.03
    }

    renderer.clear()
    renderer.render(backdropScene, backdropCamera)
    renderer.render(scene, camera)

    if (firstFrame) {
      firstFrame = false
      emit('ready')
    }
  }
  raf = requestAnimationFrame(tick)

  function destroy() {
    cancelAnimationFrame(raf)
    resizeObserver.disconnect()
    intersectionObserver?.disconnect()
    window.removeEventListener('scroll', onScroll)
    hostEl.removeEventListener('pointerdown', onPointerDown)
    hostEl.removeEventListener('pointermove', onPointerMove)
    hostEl.removeEventListener('pointerup', onPointerUp)
    hostEl.removeEventListener('pointercancel', onPointerUp)
    hostEl.removeEventListener('pointerleave', onPointerLeave)
    word.dispose()
    dust.dispose()
    stars.dispose()
    ringGeometry.forEach((geometry) => geometry.dispose())
    ringMaterial.dispose()
    backdropGeometry.dispose()
    backdropMaterial.dispose()
    dotTexture.dispose()
    glowTexture.dispose()
    renderer.dispose()
    renderer.forceContextLoss?.()
  }

  return {
    syncStars(entries) {
      stars.sync(entries)
      hovered = -1
      hostEl.classList.remove('is-star')
      emit('hover', null)
    },
    destroy,
  }
}
</script>

<template>
  <div ref="host" class="world-scene">
    <canvas ref="canvas" class="world-scene-canvas"></canvas>
  </div>
</template>
