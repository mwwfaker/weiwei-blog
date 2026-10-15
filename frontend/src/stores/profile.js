import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { request, uploadMedia } from '@/services/api'
import { notify } from '@/app/useToast'
import { requireLogin } from '@/app/useGuard'
import { useAuthStore } from './auth'
import { useMediaStore } from './media'

/**
 * 个人资料与站点偏好。
 *
 * 三层数据各有归属，别混：
 *   · 昵称 / 简介 / 头像：登录后以账号库为准，同时镜像一份到 localStorage，
 *     这样退出登录不会看起来像「资料丢了」。
 *   · 头像可以是绝对地址，也可以是 `media:<id>` 引用——引用会按当前媒体库即时解析，
 *     所以不依赖「谁先加载完」。
 *   · 站点可见范围与日记默认可见范围只是本机偏好，不落库。
 */
export const useProfileStore = defineStore('profile', () => {
  const auth = useAuthStore()
  const media = useMediaStore()

  const profileDialog = ref(false)
  const profileName = ref(localStorage.getItem('weiwei-blog-name') || '唯唯')
  const profileBio = ref(localStorage.getItem('weiwei-blog-bio') || '喜欢记录日常，也喜欢在路上。')
  const profileAvatar = ref(localStorage.getItem('weiwei-blog-avatar') || '')
  const siteVisibility = ref(localStorage.getItem('weiwei-blog-site-visibility') || 'PUBLIC')
  const defaultVisibility = ref(localStorage.getItem('weiwei-blog-default-visibility') || 'PRIVATE')

  // Resolved at render time, so a `media:<id>` avatar still resolves once the media library has
  // loaded (and re-resolves when it changes) instead of depending on load order.
  const profileAvatarSrc = computed(() => media.mediaImage(profileAvatar.value))

  /** 会话恢复 / 登录成功后把账号资料写进界面。`fallbackName` 用于 /api/account/me 没返回昵称时。 */
  function applyUser(user, fallbackName = '') {
    if (!user) return
    profileName.value = user.displayName || fallbackName || profileName.value
    profileBio.value = user.bio || ''
    profileAvatar.value = user.avatarUrl || ''
  }

  function openEditor() {
    if (!requireLogin('编辑个人资料')) return
    profileDialog.value = true
  }

  function persistDefaultVisibility() {
    localStorage.setItem('weiwei-blog-default-visibility', defaultVisibility.value)
  }

  function toggleSiteVisibility() {
    siteVisibility.value = siteVisibility.value === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
    localStorage.setItem('weiwei-blog-site-visibility', siteVisibility.value)
    notify(siteVisibility.value === 'PUBLIC' ? '博客首页已设为公开' : '博客首页已设为仅自己可见')
  }

  async function save() {
    if (!requireLogin('保存个人资料')) return
    if (!profileName.value.trim()) return notify('请填写昵称')
    // Mirror to this browser too, so signing out does not look like the profile was lost.
    localStorage.setItem('weiwei-blog-name', profileName.value.trim())
    localStorage.setItem('weiwei-blog-bio', profileBio.value)
    localStorage.setItem('weiwei-blog-avatar', profileAvatar.value)
    try {
      // avatarUrl keeps an absolute URL or this app's `media:<id>` reference; a signed media link
      // would expire, and a data: URL from the signed-out preview is far too long for the column.
      const avatar = String(profileAvatar.value || '')
      const avatarUrl = avatar.startsWith('data:') ? null : (avatar || null)
      const profile = await request('/api/account/me', {
        token: auth.token,
        method: 'PUT',
        body: JSON.stringify({ displayName: profileName.value.trim(), bio: profileBio.value, avatarUrl }),
      })
      auth.user = profile
      profileName.value = profile.displayName
      profileDialog.value = false
      return notify('个人资料已保存到数据库')
    } catch (error) { return notify(`资料未保存：${error.message}`) }
  }

  async function chooseAvatar(file) {
    if (!file) return
    if (!requireLogin('上传头像')) return
    try {
      const uploaded = await uploadMedia(file, auth.token)
      const saved = await request('/api/media', {
        token: auth.token,
        method: 'POST',
        body: JSON.stringify({ kind: 'IMAGE', title: `${profileName.value}的头像`, objectKey: uploaded.key, contentType: uploaded.contentType, visibility: 'PUBLIC', albumName: '头像' }),
      })
      media.galleryItems.unshift({ ...media.mapMedia(saved), mine: true })
      profileAvatar.value = `media:${saved.id}`
    } catch (error) { notify(`头像上传失败：${error.message}`) }
  }

  return {
    profileDialog, profileName, profileBio, profileAvatar, profileAvatarSrc,
    siteVisibility, defaultVisibility,
    applyUser, openEditor, persistDefaultVisibility, toggleSiteVisibility, save, chooseAvatar,
  }
})
