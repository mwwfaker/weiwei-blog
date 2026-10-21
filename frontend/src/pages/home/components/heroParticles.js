// 首页舞台里「会动的东西」：粒子字与星尘。
//
// 两个工厂都只使用传进来的 three 命名空间，**不 import three**：
// 这样 HeroScene.vue 只剩「装配 + 事件 + 每帧调用」，而这份模拟逻辑可以在渲染测试里安全解析，
// 也不会把 three 拖进任何静态依赖图。
//
// 两套粒子共用一个约束：位置、速度、基准点是三条并行的 Float32Array，不建对象。
// 每帧几千个点，各自 new 一个 Vector3 会立刻把 GC 压力堆起来。
import { WORDMARK, buildDust, ringWordmark, sampleWordmark } from './heroStage'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

/**
 * 粒子字「唯唯园」。
 * 采样 → 摆进世界坐标 → 每帧：弹簧回位 + 指针推开 + 点击冲量。
 */
export function createWordmark(THREE, { texture, compact, width = 4.4, light = false }) {
  // stride 4：2 像素一个采样点会让字的笔画糊成一块实心板（截图里就是一团灰雾）。
  // 隔 4 像素取点、点再放大一点，字才读得出是「点组成的字」。
  const data = sampleWordmark(WORDMARK, { target: compact ? 2400 : 5200, stride: 4 })
    || ringWordmark(compact ? 1200 : 1800)
  const count = data.count
  const height = width / Math.max(0.2, data.aspect)

  const base = new Float32Array(count * 3)
  const positions = new Float32Array(count * 3)
  const velocities = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const tint = new THREE.Color(light ? '#3a3550' : '#f4ecff')

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3
    const x = (data.xs[i] - 0.5) * width
    const y = (data.ys[i] - 0.5) * height
    // 厚度只给一点点：太厚像一块饼干，太薄转起来看不出是立体的
    const z = (Math.random() - 0.5) * 0.16
    base[i3] = x
    base[i3 + 1] = y
    base[i3 + 2] = z
    positions[i3] = x
    positions[i3 + 1] = y
    positions[i3 + 2] = z
    const glow = 0.62 + Math.random() * 0.38
    colors[i3] = tint.r * glow
    colors[i3 + 1] = tint.g * glow
    colors[i3 + 2] = tint.b * glow
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.PointsMaterial({
    size: 0.04,
    map: texture,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geometry, material)
  // 第二层：同一份点、大一圈的柔光。没有它，点云在暗底上只是「碎屑」；
  // 叠一层才像霓虹灯管，远看也能认出字形。白天反过来：它是一团很淡的雾。
  const haloMaterial = new THREE.PointsMaterial({
    size: 0.13,
    map: texture,
    color: light ? 0x8b7bc0 : 0xa98cff,
    transparent: true,
    opacity: light ? 0.10 : 0.22,
    depthWrite: false,
    blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const halo = new THREE.Points(geometry, haloMaterial)
  const group = new THREE.Group()
  group.add(halo)
  group.add(points)

  const pointer = new THREE.Vector3(0, 0, -99)
  let active = false

  return {
    group,
    /** 首页现在是「一整个世界」：往下滚时字要淡出，把画面让给内容。 */
    setFade(value) {
      const fade = Math.min(1, Math.max(0, value))
      material.opacity = fade
      haloMaterial.opacity = 0.22 * fade
    },
    /** 指针在字所在组的本地坐标；null = 指针不在舞台上。 */
    setPointer(point) {
      if (point) {
        pointer.copy(point)
        active = true
      } else {
        active = false
      }
    },
    update(dt) {
      const steps = clamp(dt * 60, 0.4, 3)
      const repel = 0.66
      const repelSq = repel * repel
      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3
        let vx = velocities[i3]
        let vy = velocities[i3 + 1]
        let vz = velocities[i3 + 2]
        // 弹簧回位：离基准点越远，拉得越狠
        vx += (base[i3] - positions[i3]) * 0.05 * steps
        vy += (base[i3 + 1] - positions[i3 + 1]) * 0.05 * steps
        vz += (base[i3 + 2] - positions[i3 + 2]) * 0.05 * steps
        if (active) {
          const dx = positions[i3] - pointer.x
          const dy = positions[i3 + 1] - pointer.y
          const dz = positions[i3 + 2] - pointer.z
          const distanceSq = dx * dx + dy * dy + dz * dz
          if (distanceSq < repelSq) {
            const distance = Math.sqrt(distanceSq) + 0.001
            const push = (1 - distance / repel) * 0.22 * steps
            vx += (dx / distance) * push
            vy += (dy / distance) * push
            vz += (dz / distance) * push
          }
        }
        const damping = Math.pow(0.9, steps)
        vx *= damping
        vy *= damping
        vz *= damping
        velocities[i3] = vx
        velocities[i3 + 1] = vy
        velocities[i3 + 2] = vz
        positions[i3] += vx * steps
        positions[i3 + 1] += vy * steps
        positions[i3 + 2] += vz * steps
      }
      geometry.attributes.position.needsUpdate = true
    },
    /** 点击空白：从点击点向外推一把，随后由弹簧拉回字形。 */
    shock(point) {
      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3
        const dx = positions[i3] - point.x
        const dy = positions[i3 + 1] - point.y
        const dz = positions[i3 + 2] - point.z
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001
        const power = Math.exp(-distance * distance * 1.8) * 0.9
        velocities[i3] += (dx / distance) * power
        velocities[i3 + 1] += (dy / distance) * power
        velocities[i3 + 2] += (dz / distance) * power
      }
    },
    dispose() {
      geometry.dispose()
      material.dispose()
      haloMaterial.dispose()
    },
  }
}

/**
 * 星尘：铺满整块舞台的微小颗粒，负责「这里是有深度的空间」。
 * 没有弹簧——尘是环境，被推开就该慢慢飘走；出界折回另一侧，保证密度不衰减。
 */
export function createDustField(THREE, { texture, count, light = false }) {
  const source = buildDust(count)
  const positions = source.positions
  const velocities = source.velocities
  const phases = source.phases

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const material = new THREE.PointsMaterial({
    size: 0.042,
    map: texture,
    color: light ? 0x8a819f : 0x9c93dc,
    transparent: true,
    opacity: light ? 0.38 : 0.55,
    depthWrite: false,
    blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  const points = new THREE.Points(geometry, material)

  return {
    points,
    update({ dt, clock, pointer }) {
      const steps = clamp(dt * 60, 0.4, 3)
      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3
        const phase = phases[i]
        let vx = velocities[i3]
        let vy = velocities[i3 + 1]
        let vz = velocities[i3 + 2]
        // 极慢的呼吸漂移：完全静止的粉尘在移动的镜头里像贴图
        vx += Math.sin(clock * 0.22 + phase) * 0.0016 * steps
        vy += Math.cos(clock * 0.18 + phase * 1.3) * 0.0014 * steps
        vz += Math.sin(clock * 0.15 + phase * 0.7) * 0.0012 * steps
        if (pointer) {
          const dx = positions[i3] - pointer.x
          const dy = positions[i3 + 1] - pointer.y
          const dz = positions[i3 + 2] - pointer.z
          const distanceSq = dx * dx + dy * dy + dz * dz
          if (distanceSq < 1.35) {
            const distance = Math.sqrt(distanceSq) + 0.001
            const push = (1 - distance / 1.16) * 0.05 * steps
            vx += (dx / distance) * push
            vy += (dy / distance) * push
            vz += (dz / distance) * push
          }
        }
        const damping = Math.pow(0.955, steps)
        vx *= damping
        vy *= damping
        vz *= damping
        velocities[i3] = vx
        velocities[i3 + 1] = vy
        velocities[i3 + 2] = vz
        positions[i3] += vx * steps
        positions[i3 + 1] += vy * steps
        positions[i3 + 2] += vz * steps
        if (positions[i3] > 9.5) positions[i3] = -9.5
        if (positions[i3] < -9.5) positions[i3] = 9.5
        if (positions[i3 + 1] > 5.5) positions[i3 + 1] = -5.5
        if (positions[i3 + 1] < -5.5) positions[i3 + 1] = 5.5
        if (positions[i3 + 2] > 6) positions[i3 + 2] = -6
        if (positions[i3 + 2] < -6) positions[i3 + 2] = 6
      }
      geometry.attributes.position.needsUpdate = true
    },
    shock(point) {
      for (let i = 0; i < count; i += 1) {
        const i3 = i * 3
        const dx = positions[i3] - point.x
        const dy = positions[i3 + 1] - point.y
        const dz = positions[i3 + 2] - point.z
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001
        const power = Math.exp(-distance * distance * 0.35) * 0.55
        velocities[i3] += (dx / distance) * power
        velocities[i3 + 1] += (dy / distance) * power
        velocities[i3 + 2] += (dz / distance) * power
      }
    },
    dispose() {
      geometry.dispose()
      material.dispose()
    },
  }
}
