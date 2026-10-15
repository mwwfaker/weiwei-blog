// 全局轻提示。做成模块级单例而不是 Pinia store：
// 提示要被 store（articles / diaries / music）和组件同时调用，直接 import 最省事，
// 也避免「store 里再 useStore 触发实例化顺序问题」。
import { readonly, ref } from 'vue'

const TOAST_DURATION = 2600
const toast = ref('')
let timer

/** 显示一条提示，2.6 秒后自动消失；连续调用只保留最后一条。 */
export function notify(message) {
  toast.value = message
  clearTimeout(timer)
  timer = setTimeout(() => { toast.value = '' }, TOAST_DURATION)
}

/** 卸载时清掉计时器，避免组件已经销毁还去改状态。 */
export function disposeToast() {
  clearTimeout(timer)
}

export function useToast() {
  return { toast: readonly(toast), notify }
}
