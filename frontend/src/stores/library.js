import { defineStore } from 'pinia'
import { notify } from '@/app/useToast'
import { useArticlesStore } from './articles'
import { useAuthStore } from './auth'
import { useDiariesStore } from './diaries'
import { useMediaStore } from './media'
import { useMusicStore } from './music'
import { useProfileStore } from './profile'

/**
 * 会话级别的「重新读一遍」。
 *
 * 登录成功、退出登录、页面首次挂载这三处要做的事完全一样：资料、日记、文章、媒体、曲库
 * 全部按新身份重新拉一次。原来这段在 App.vue 里抄了三遍，漏掉任何一处就会出现
 * 「退出了还能看到自己的私密内容」这类问题。
 *
 * 只做编排，不持有状态。
 */
export const useLibraryStore = defineStore('library', () => {
  const auth = useAuthStore()
  const articles = useArticlesStore()
  const diaries = useDiariesStore()
  const media = useMediaStore()
  const music = useMusicStore()
  const profile = useProfileStore()

  /** 首屏 / 切换身份之后：把公开内容 + 自己那份一起读回来。 */
  async function refreshAll() {
    await Promise.all([diaries.refresh(), articles.refresh(), media.refresh()])
    music.syncLibrary()
  }

  /**
   * 恢复登录态（刷新页面后的第一步）。
   * 会话交给 Supabase 自己持久化，刷新页面后 auth.token 一开始是空的，
   * 所以这里不能再用 token 当判断条件，直接问一次「有没有已登录的会话」即可。
   */
  async function restoreSession() {
    const user = await auth.restoreSession()
    if (user) profile.applyUser(user)
  }

  /** 登录成功后：接上资料，按新身份重读一遍。返回是否真的可用。 */
  async function completeLogin(fallbackName = '') {
    const user = await auth.restoreSession()
    if (!user) { notify('账号已登录，但无法读取账号资料，请稍后重试'); return false }
    profile.applyUser(user, fallbackName)
    await refreshAll()
    return true
  }

  /**
   * 退出后要重新拉一次：自己账号里的私密内容不能再留在屏幕上，
   * 而且列表要回到「所有人的公开内容」这一份，和陌生人看到的完全一样。
   */
  async function logout() {
    auth.logout()
    notify('已退出账号；现在显示的是所有人的公开内容')
    await refreshAll()
  }

  return { refreshAll, restoreSession, completeLogin, logout }
})
