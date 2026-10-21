// 启动页的收尾。
//
// 启动页本身写在 index.html 里（内联样式与标记，样式表还没到就能画出来），
// 这里只负责在应用挂载后把它淡出。最短展示时间是为了不让它「闪一下就没」——
// 那比看着它数秒更难受，而且动画本身就是这段等待的内容。
const START = typeof performance === 'undefined' ? 0 : performance.now()
const MIN_VISIBLE = 720
const FADE_OUT = 560

export function bootReady() {
  if (typeof document === 'undefined') return
  const boot = document.getElementById('boot')
  if (!boot) return
  const elapsed = (typeof performance === 'undefined' ? Date.now() : performance.now()) - (window.__bootStart || START)
  const wait = Math.max(0, MIN_VISIBLE - elapsed)
  window.setTimeout(() => {
    boot.classList.add('boot-done')
    window.setTimeout(() => boot.remove(), FADE_OUT)
  }, wait)
}
