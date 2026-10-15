// 导入失败时的提示窗状态。
//
// 为什么是一个模块级单例，而不是 Pinia store：
//   它不是业务数据，是「刚刚那次操作失败了」的一过性提示——用户关掉就没了，
//   不需要跨页面存活、也不需要被持久化。而且**日记导入和文章导入都要能触发它**，
//   塞进任何一边的 store 都会让另一边反向依赖。放成模块级状态，全站只有一个提示窗，
//   谁都能 raise。内容由 services/articleImport.js 的 `importProblem()` 生成（纯函数、可对拍）。
import { ref } from 'vue'

/** `{ kind, title, message, steps }`；null 表示没有要提示的。 */
const alert = ref(null)

export function useImportAlert() {
  /** 弹窗。`problem` 直接来自 `importProblem()`。 */
  function raise(problem) {
    alert.value = problem ? { ...problem } : null
  }
  function dismiss() {
    alert.value = null
  }
  return { alert, raise, dismiss }
}
