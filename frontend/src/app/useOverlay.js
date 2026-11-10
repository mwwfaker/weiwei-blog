// 「现在有没有浮层盖在页面上」。
//
// 为什么需要它：`.modal-backdrop` 是 `backdrop-filter: blur(...)`，一块铺满视口的毛玻璃。
// 它后面的东西只要在动（粒子画布每帧重绘、极光每帧位移），这块毛玻璃就得**每帧重新模糊**
// 整个视口。实测：登录弹窗盖在账号页上时 11fps，把 backdrop-filter 去掉立刻 30fps。
//
// 所以弹窗一开就把背景动画停住——反正它被盖住、还被压暗了，看不出停：
//   · 粒子画布：ParticleField 读这个标记，直接不画
//   · 页面里的 CSS 动画：`body.overlay-open` 那条规则把它们 pause 掉
//
// 做成模块级计数而不是 Pinia：ModalShell 在弹窗挂载/卸载时直接调，
// 不需要知道 store 存不存在；同时开两层弹窗也不会数错。
import { ref } from 'vue'

const openCount = ref(0)

function sync() {
  if (typeof document === 'undefined') return
  document.body.classList.toggle('overlay-open', openCount.value > 0)
}

/** 浮层打开。ModalShell 挂载时调。 */
export function holdOverlay() {
  openCount.value += 1
  sync()
}

/** 浮层关闭。必须和 holdOverlay 成对调用（ModalShell 卸载时）。 */
export function releaseOverlay() {
  openCount.value = Math.max(0, openCount.value - 1)
  sync()
}

/** 有浮层盖着时，背景那些一直在动的东西可以歇着。 */
export function overlayOpen() {
  return openCount.value > 0
}
