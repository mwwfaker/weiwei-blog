// 权限模型只有一条：看是公开的，改要登录。
//
// 所有「新建 / 编辑 / 上传 / 导入」的入口都先走这里——未登录就直接把人带到登录页，
// 而不是在本机起草一份之后又要想办法合并进某个账号。
import { useAuthStore } from '@/stores/auth'
import { go } from './usePageNav'
import { notify } from './useToast'

export function requireLogin(action) {
  const auth = useAuthStore()
  if (auth.isLoggedIn) return true
  notify(`登录后才能${action}；现在可以浏览全部公开内容`)
  go('account')
  return false
}
