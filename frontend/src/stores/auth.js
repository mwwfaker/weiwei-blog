import { defineStore } from 'pinia'
import { backendConfigured, request, supabase } from '../services/api'

/**
 * 账号状态。原来是自己保存 JWT 到 sessionStorage，现在交给 Supabase Auth：
 * 会话由 supabase-js 自己持久化（localStorage），刷新页面后 `restoreSession` 把它接回来。
 *
 * 对外暴露的字段和动作名保持不变（`isLoggedIn` / `login` / `register` / `restoreSession` / `logout`），
 * 所以 App.vue、PerfPanel.vue 里的调用点不需要改。
 */
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '',
    user: null,
    busy: false,
    error: '',
    // 会话状态是否已经确定。刷新页面后要异步问一次 Supabase 才知道登录没登录，
    // 在那之前 isLoggedIn 一律是 false —— 不能拿它判断「访客」，否则会把已登录的人误判成访客。
    ready: false,
  }),
  getters: { isLoggedIn: (state) => Boolean(state.token && state.user) },
  actions: {
    async authenticate(path, details) {
      if (!backendConfigured) {
        this.error = '后端尚未配置（缺少 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY）'
        throw new Error(this.error)
      }
      this.busy = true
      this.error = ''
      try {
        const result = await request(path, { method: 'POST', body: JSON.stringify(details) })
        this.token = result.accessToken
        this.user = { id: result.id, email: result.email, displayName: result.displayName }
        return this.user
      } catch (error) {
        this.error = error instanceof Error ? error.message : '无法连接账号服务'
        throw error
      } finally {
        this.busy = false
        this.ready = true
      }
    },
    async login(email, password) { return this.authenticate('/api/auth/login', { email, password }) },
    async register(email, password, displayName) { return this.authenticate('/api/auth/register', { email, password, displayName }) },
    async restoreSession() {
      if (!backendConfigured) { this.ready = true; return null }
      try {
        const { data } = await supabase.auth.getSession()
        if (!data?.session) { this.clear(); return null }
        this.token = data.session.access_token
        this.user = await request('/api/account/me')
        return this.user
      } catch (error) {
        // 只有认证失败才清掉会话：网络抖动或 5xx 时清掉，会让所有后续保存悄悄退回本机存储。
        if (error?.status === 401 || error?.status === 403) this.logout()
        return null
      } finally {
        this.ready = true
      }
    },
    clear() {
      this.token = ''
      this.user = null
    },
    logout() {
      this.clear()
      // 通知 Supabase 注销本地会话；失败也无所谓，本地状态已经清了。
      if (supabase) supabase.auth.signOut().catch(() => {})
    },
  },
})
