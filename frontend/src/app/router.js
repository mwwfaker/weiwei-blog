import { createRouter, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { askLogin } from './useGuard'
import { routes } from './routes'

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0, behavior: 'smooth' }),
})

/**
 * 路由守卫。
 *
 * 只有带 `meta.requiresAuth` 的路由会被拦（目前是 `/perf`）。拦下来**不是**弹一句了事：
 * 手动敲地址的人会以为自己进错了，所以统一送到账号页，并带上「为什么」——
 * 那一层弹窗（app/useGuard.js 的 loginPrompt）会把原因写在脸上。
 *
 * 关键一点：Supabase 的会话是**异步**恢复的，刷新页面时第一次导航发生在它答复之前。
 * 不等 `auth.ready` 就直接判 `isLoggedIn`，会把已登录的人当成访客踢到登录页
 * （现象是「每次刷新 /perf 都要重新登录一次」）。
 */
router.beforeEach(async (to) => {
  if (!to.meta?.requiresAuth) return true

  const auth = useAuthStore()
  if (!auth.isLoggedIn && !auth.ready) await auth.restoreSession()
  if (auth.isLoggedIn) return true

  askLogin(
    typeof to.meta.gateName === 'string' ? to.meta.gateName : '这个页面',
    '这个工具会写入数据，所以要先登录；浏览全站内容仍然不需要账号。',
  )
  return { name: 'account' }
})
