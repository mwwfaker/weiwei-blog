/**
 * 「关掉时化作尘埃」的共用逻辑：阅读弹窗（`modules/modal/ReadingSheet.vue`）与
 * 全屏看图（`modules/media/GalleryViewer.vue`）共用同一套时序。
 *
 * 为什么连时序也一起抽出来，而不是只共用粒子层 `DustBurst.vue`：
 * 「量出目标位置 → 先定住一拍 → 等粒子飞完再 emit close」这三步里只要有一个数字
 * 两边写得不一样，症状都是「粒子还在飞，组件已经被摘掉了」——而且只在自己那处看得见。
 * 时长写在 JS 里、通过 `--dust-ms` 下发给 CSS，就是为了不让两边各写一个数字。
 */
import { ref } from 'vue'
// 和 DiaryTree 一样走 motion 聚合对象：prefersReducedMotion 不是具名导出。
// **必须改名导入**：下面那个选项也叫 `motion`，同名的话参数会把这个对象整个遮住，
// `motion.prefersReducedMotion()` 直接抛 TypeError（关不掉弹窗，只在控制台报错）。
import { motion as motionHelpers } from './motion'

/** 进场时长（毫秒）。只用于样式里的动画，不需要 JS 等待。 */
export const ENTER_MS = 560
/**
 * 退场前的静止时长（毫秒）。
 * 一上来就化灰会「看不见」——眼睛需要一拍才反应过来要发生什么，
 * 所以先定住不动、再开始消散。别调大：超过 ~250ms 就会被当成卡住了。
 */
export const DUST_HOLD_MS = 180
/** 退场总时长（毫秒）。必须覆盖「静止 + 消散 + 最后一批粒子飞完」，JS 要等它跑完再交差。 */
export const DUST_MS = 1320

/**
 * @param target  量位置的元素 ref（卡片 / 图片）。量不到时退回屏幕中央一块区域。
 * @param motion  是否播放动效；可以传函数，跟着 prop 走。
 * @param onClose 动画跑完（或不做动效时立刻）调用；组件要在这一刻才真正消失。
 */
export function useDustClose({ target, motion = true, onClose }) {
  const closing = ref(false)
  const dustRect = ref(null)
  const dustCount = ref(420)

  /** 窄屏粒子给少一些：几百个带发光阴影的圆点在小手机上不划算。 */
  const particleCount = () => (typeof matchMedia === 'function' && matchMedia('(min-width: 761px)').matches ? 420 : 240)

  function requestClose() {
    if (closing.value) return
    const wantsMotion = typeof motion === 'function' ? motion() : motion
    if (!wantsMotion || motionHelpers.prefersReducedMotion()) { onClose(); return }
    closing.value = true
    dustCount.value = particleCount()

    // 粒子层要有地方铺。正常情况用元素的真实位置；万一量不到（ref 没就绪等），
    // 退回一块屏幕中央的区域——宁可铺得不准，也不能一声不响地什么都不显示。
    const rect = target?.value?.getBoundingClientRect?.()
    if (rect && rect.width > 1 && rect.height > 1) {
      dustRect.value = { left: rect.left, top: rect.top, width: rect.width, height: rect.height }
    } else {
      const vw = globalThis.innerWidth || 1024
      const vh = globalThis.innerHeight || 768
      dustRect.value = { left: vw * 0.16, top: vh * 0.12, width: vw * 0.68, height: vh * 0.62 }
    }
    globalThis.setTimeout(onClose, DUST_MS)
  }

  return { closing, dustRect, dustCount, requestClose, ENTER_MS, DUST_HOLD_MS, DUST_MS }
}
