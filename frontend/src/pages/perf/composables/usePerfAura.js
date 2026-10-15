// 氛围层：跟着指针走的那团柔光。
// 位置只用 transform 写，而且按帧合并一次——鼠标连点也不会堆出一串待处理的写入。
// 不用 CSS 变量：改 .perf-tool 上的自定义属性会让整棵子树（几百个单元格）重算样式，
// 而 transform 这条路只走合成器，表格滚动时也不会跟着掉帧。
//
// 两个元素（.perf-tool 和 .perf-aura）留在 PerfPage 的模板里，这里只负责算位置。
import { onUnmounted } from 'vue'

export function usePerfAura({ toolRef, auraRef }) {
  let auraTarget = null
  let auraFrame = 0

  function flushAura() {
    auraFrame = 0
    const el = auraRef.value
    const host = toolRef.value
    if (!el || !host || !auraTarget) return
    const rect = host.getBoundingClientRect()
    el.style.transform = `translate3d(${auraTarget.x - rect.left}px,${auraTarget.y - rect.top}px,0)`
  }

  function trackCursor(event) {
    auraTarget = { x: event.clientX, y: event.clientY }
    if (!auraFrame) auraFrame = requestAnimationFrame(flushAura)
  }

  onUnmounted(() => { if (auraFrame) cancelAnimationFrame(auraFrame) })

  return { trackCursor }
}
