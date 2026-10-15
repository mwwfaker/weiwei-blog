// 滚动方向感知的导航收起状态。三项处理让它不再「生硬」：
//   · rAF 节流：一帧最多处理一次滚动事件
//   · 迟滞：位移不足 26px 不判断方向，避免触控板抖动来回翻转
//   · 冷却：一次切换后 320ms 内不再切换，方向刚变也不会立刻弹回
import { onMounted, onUnmounted, ref } from 'vue'

const SCROLL_MIN_DELTA = 26
const SCROLL_TOGGLE_COOLDOWN = 320

export function useScrollChrome({ onViewportChange } = {}) {
  const scrolled = ref(false)
  let lastScrollY = 0
  let scrollQueued = false
  let lastToggleAt = 0

  function applyScrollState() {
    scrollQueued = false
    const y = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0)
    // 回到顶部一定展开，不受迟滞与冷却限制。
    if (y <= 90) { scrolled.value = false; lastScrollY = y; return }
    const delta = y - lastScrollY
    if (Math.abs(delta) < SCROLL_MIN_DELTA) return
    const now = Date.now()
    if (now - lastToggleAt < SCROLL_TOGGLE_COOLDOWN) { lastScrollY = y; return }
    if (!scrolled.value && y > 130 && delta > 0) { scrolled.value = true; lastToggleAt = now }
    else if (scrolled.value && delta < 0) { scrolled.value = false; lastToggleAt = now }
    lastScrollY = y
  }

  function onScroll() {
    if (scrollQueued) return
    scrollQueued = true
    requestAnimationFrame(applyScrollState)
  }

  function resize() {
    onViewportChange?.()
  }

  onMounted(() => {
    lastScrollY = Math.max(0, window.scrollY || 0)
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', resize, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', resize)
    window.removeEventListener('scroll', resize)
  })

  return { scrolled }
}
