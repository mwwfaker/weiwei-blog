// 日记星体：每篇日记一颗发光 sprite，悬停放大、点击打开。
//
// 这个模块只管「第几颗星、在屏幕哪、被点到了就报出去」。
// 打开日记由外层（HomeHero → 页面）决定——星体不该知道 store 或路由的存在。
import { STAR_COLORS } from './heroStage'

/** 黄金角：按这个角度撒点，星体的角分布不会出现明显的一圈圈对称。 */
const GOLDEN = 2.399963

export function createStars(THREE, { texture, center, light = false }) {
  const group = new THREE.Group()
  let stars = []
  let hovered = -1

  function anchor(index) {
    const angle = index * GOLDEN + 0.6
    const ring = 2.45 + (index % 4) * 0.5
    return new THREE.Vector3(
      center.x + Math.cos(angle) * ring,
      center.y + 0.3 + Math.sin(angle) * ring * 0.66,
      Math.sin(angle * 1.7) * 1.15 - 0.2,
    )
  }

  function clear() {
    for (const star of stars) {
      group.remove(star.sprite)
      star.material.dispose()
    }
    stars = []
    hovered = -1
  }

  /**
   * 重新挂一遍星体。`entries` 是日记数组，可以带 `entry` 为 null 的装饰星。
   * 没有日记时留 7 颗装饰星：访客打开首页，右半边不该是空的。
   */
  function sync(entries) {
    clear()
    const list = (entries || []).slice(0, 12)
    const items = list.length
      ? list.map((entry) => ({ entry }))
      : Array.from({ length: 7 }, () => ({ entry: null }))

    items.forEach((item, index) => {
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: new THREE.Color(STAR_COLORS[index % STAR_COLORS.length]),
        transparent: true,
        opacity: light ? 0.7 : 0.86,
        depthWrite: false,
        blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
      })
      const sprite = new THREE.Sprite(material)
      const base = anchor(index)
      sprite.position.copy(base)
      const scale = 0.5 + (index % 3) * 0.08
      sprite.scale.set(scale, scale, 1)
      group.add(sprite)
      stars.push({
        entry: item.entry,
        sprite,
        material,
        base,
        offset: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        phase: Math.random() * Math.PI * 2,
        scale,
        current: scale,
      })
    })
  }

  function update({ dt, reduced }) {
    const ease = Math.min(1, Math.max(0.1, dt * 9))
    const steps = Math.min(3, Math.max(0.4, dt * 60))
    for (let i = 0; i < stars.length; i += 1) {
      const star = stars[i]
      star.phase += reduced ? 0 : dt * 0.35
      star.offset.add(star.velocity)
      star.velocity.multiplyScalar(Math.pow(0.92, steps))
      star.offset.multiplyScalar(Math.pow(0.94, steps))
      const wobble = reduced ? 0 : Math.sin(star.phase) * 0.05
      star.sprite.position.set(
        star.base.x + star.offset.x + wobble,
        star.base.y + star.offset.y + Math.cos(star.phase * 0.8) * 0.045,
        star.base.z + star.offset.z,
      )
      const wanted = star.scale * (i === hovered ? 1.8 : 1)
      star.current += (wanted - star.current) * ease
      star.sprite.scale.set(star.current, star.current, 1)
      star.material.opacity = 0.72 + (i === hovered ? 0.28 : 0) + Math.sin(star.phase * 1.7) * 0.06
    }
  }

  /**
   * 屏幕空间拾取：把每颗星投影到画布像素坐标，取最近的一颗。
   * 用屏幕距离而不是 Raycaster：星体是 sprite、半径很小，手在触屏上要「点得中」，
   * 像素阈值（30px）比精确射线宽容得多。
   */
  function pick(px, py, rect, camera) {
    let best = -1
    let bestDistance = 30
    let bestX = 0
    let bestY = 0
    for (let i = 0; i < stars.length; i += 1) {
      const projected = stars[i].sprite.position.clone().project(camera)
      if (projected.z > 1) continue
      const x = (projected.x * 0.5 + 0.5) * rect.width
      const y = (-projected.y * 0.5 + 0.5) * rect.height
      const distance = Math.hypot(x - px, y - py)
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
        bestX = x
        bestY = y
      }
    }
    return { index: best, x: bestX, y: bestY }
  }

  /** 点击空白处时给星体一点位移，随后由 offset 的衰减拉回锚点。 */
  function shock(origin) {
    for (const star of stars) {
      const dx = star.sprite.position.x - origin.x
      const dy = star.sprite.position.y - origin.y
      const dz = star.sprite.position.z - origin.z
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.001
      const power = Math.exp(-distance * distance * 0.12) * 0.7
      star.velocity.x += (dx / distance) * power
      star.velocity.y += (dy / distance) * power
      star.velocity.z += (dz / distance) * power
    }
  }

  return {
    group,
    sync,
    update,
    pick,
    shock,
    setHovered(index) { hovered = index },
    entryAt(index) { return stars[index]?.entry || null },
    count() { return stars.length },
    dispose() {
      clear()
      group.clear()
    },
  }
}
