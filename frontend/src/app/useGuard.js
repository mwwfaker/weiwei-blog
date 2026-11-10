// 权限模型只有一条：看是公开的，改要登录。
//
// 拦截有两种说法，按场景挑，别混用：
//   · requireLogin()  写内容的入口（写文章、上传照片、导入日记…）。用户是在浏览途中顺手点了一下，
//                     一句轻提示 + 跳到账号页最省事。
//   · askLogin()      工具类页面（绩效计算器）。用户是**特意**来用这个工具的，直接把人甩到登录页
//                     会让他以为自己点错了，所以先弹一层把话说清楚，再由他自己决定要不要登录。
//
// 状态做成模块级单例而不是 Pinia store：路由守卫在组件树之外执行，没有 active pinia
// 也得能拿到这份状态。
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { go } from './usePageNav'
import { notify } from './useToast'

/** 要弹的登录提示：`{ action, reason }`；null = 不弹。 */
export const loginPrompt = ref(null)

/**
 * 弹一层「需要登录」。
 * @param {string} action 用户在做什么（「绩效计算器」），用来把话说具体
 * @param {string} reason 需要解释原因时的一句话（被路由守卫重定向过来时会带）
 */
export function askLogin(action, reason = '') {
  loginPrompt.value = { action, reason }
}

export function dismissLogin() {
  loginPrompt.value = null
}

export function requireLogin(action) {
  const auth = useAuthStore()
  if (auth.isLoggedIn) return true
  notify(`登录后才能${action}；现在可以浏览全部公开内容`)
  go('account')
  return false
}
