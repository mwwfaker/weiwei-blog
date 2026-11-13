// 「当前盖在页面上的那个阅读层」的关闭入口。
//
// 为什么需要：阅读层（文章、日记、大图）的关闭动画是**组件自己播的**——先定住一拍、
// 再化作尘埃，播完才 emit('close')。但浏览器的返回手势是直接改地址的：
// 路由一变，AppShell 立刻把组件从 DOM 摘掉，尘埃根本没机会播。
//
// 所以路由守卫需要一种办法「请那个组件自己关一下」。这里就是那根线：
// 组件挂载时登记自己的 requestClose，卸载时清掉；守卫调用 closeOverlay()。
let closer = null

export function setOverlayCloser(fn) {
  closer = fn
}

export function clearOverlayCloser(fn) {
  // 只有当前登记的还是自己时才清，避免「新的先挂上、旧的随后卸载」把它抹掉
  if (!fn || closer === fn) closer = null
}

export function closeOverlay() {
  if (typeof closer === 'function') closer()
  return typeof closer === 'function'
}
