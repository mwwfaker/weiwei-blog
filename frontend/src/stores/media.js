import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { request, uploadMedia } from '@/services/api'
import { notify } from '@/app/useToast'
import { requireLogin } from '@/app/useGuard'
import { demoPhotos } from '@/data/seed'
import { useAuthStore } from './auth'

/**
 * 媒体库：图片与音频的**元数据**。
 *
 * 文件本体在 MinIO/S3：浏览器拿签名链接直传，下载时再换一次短期链接。这里只保存
 * 名称、相册、可见范围、对象键，以及（对音频）已经解析好的歌词。
 *
 * 读的策略和文章/日记一致：公开的那一份对所有人完全一致（`/api/public/*`），
 * 登录后再叠上自己账号里的私密媒体。`mine` 标记归属，别人的公开照片上不会出现编辑按钮。
 *
 * 音频的**播放**逻辑不在这里，在 stores/music.js；那边通过 `ownTracks` / `publicTracks`
 * 取这份元数据，避免为了同一份列表再打一次接口。
 */
export const useMediaStore = defineStore('media', () => {
  const auth = useAuthStore()

  // String ids keep the built-in samples from ever colliding with a real media id, which is what a
  // `media:<id>` cover or avatar reference resolves against.
  const galleryItems = ref(demoPhotos.map((photo, index) => ({ ...photo, id: `demo-${index + 1}`, visibility: 'PUBLIC', key: '' })))
  const publicTracks = ref([])
  /** 自己账号里的全部媒体（含音乐）；null = 没登录或没读成功。 */
  const ownMedia = ref(null)

  const selectedAlbum = ref('全部')
  const galleryPreview = ref(null)
  const mediaEditor = ref(null)
  const mediaDraft = ref({ title: '', albumName: '日常', visibility: 'PRIVATE' })

  const albumNames = computed(() => ['全部', ...new Set(galleryItems.value.map((item) => (item.albumName || '日常')))])
  const visibleGallery = computed(() => (selectedAlbum.value === '全部'
    ? galleryItems.value
    : galleryItems.value.filter((item) => (item.albumName || '日常') === selectedAlbum.value)))

  const ownTracks = computed(() => (ownMedia.value || []).filter((item) => item.kind === 'MUSIC' || item.kind === 'MUSIC_URL'))

  function mapMedia(media) {
    return {
      id: media.id,
      caption: media.title,
      name: media.title,
      albumName: media.albumName || '日常',
      date: media.createdAt ? media.createdAt.slice(0, 7).replace('-', ' / ') : new Date().toISOString().slice(0, 7).replace('-', ' / '),
      image: media.url,
      src: media.url,
      key: media.objectKey,
      visibility: media.visibility,
      kind: media.kind,
      lyrics: media.lyrics || '',
      lyricsSource: media.lyricsSource || '',
    }
  }

  // A stored media record always carries an object key and was never created in this browser. The
  // built-in samples and anything added while signed out are local-only, so only real records may be
  // addressed by id in the API. Without this guard a sample could send `PUT /api/media/1` and
  // silently change an unrelated real photo.
  function isStoredMedia(item) {
    return Boolean(item && item.key && !item.local)
  }

  /** 把 `media:<id>` 引用解析成当前有效的图片地址；普通地址原样返回。 */
  function mediaImage(reference) {
    const match = /^media:(\d+)$/.exec(reference || '')
    if (match) return galleryItems.value.find((asset) => String(asset.id) === match[1])?.image || ''
    return reference || ''
  }

  /**
   * 读整个媒体库：自己的那份 + 所有人的公开图片 + 所有人的公开音频。
   * 自己那份同时留给音乐库用（ownTracks），不重复请求。
   */
  async function refresh() {
    let own = null
    if (auth.isLoggedIn) {
      try { own = (await request('/api/media', { token: auth.token })).map((asset) => ({ ...mapMedia(asset), mine: true })) }
      catch (error) { notify(`媒体库同步失败：${error.message}`) }
    } else {
      own = [] // 没登录就没有「自己的媒体」
    }
    ownMedia.value = own

    try {
      const publicAssets = (await request('/api/public/media')).map((asset) => ({ ...mapMedia(asset), mine: false }))
      // 未登录时在本机加的照片只存在 localStorage（data: URL，没有对象键），要把它们留住。
      // 内置示例照片在接口答上来之后就不再展示，真实部署的访客不会看到示例相册。
      const localUploads = galleryItems.value.filter((item) => !item.key && String(item.image || '').startsWith('data:'))
      const ownImageIds = new Set((own || []).filter((item) => item.kind === 'IMAGE').map((item) => item.id))
      galleryItems.value = own === null
        ? [...localUploads, ...publicAssets]
        : [...localUploads, ...own.filter((item) => item.kind === 'IMAGE'), ...publicAssets.filter((item) => !ownImageIds.has(item.id))]
    } catch {
      // 公开接口不可达：至少把已经读到的自己那份显示出来，本机预览照常可用。
      if (own) galleryItems.value = [...galleryItems.value.filter((item) => !item.key), ...own.filter((item) => item.kind === 'IMAGE')]
    }

    try {
      publicTracks.value = (await request('/api/public/media/music')).map((asset) => ({ ...mapMedia(asset), mine: false }))
    } catch { /* 播放器仍可用公开的 HTTPS 音频直链。 */ }
  }

  async function addPhoto(file) {
    if (!requireLogin('上传照片')) return
    if (!file) return
    const item = {
      id: Date.now(),
      caption: file.name.replace(/\.[^.]+$/, ''),
      date: new Date().toISOString().slice(0, 7).replace('-', ' / '),
      image: '', visibility: 'PRIVATE', key: '', albumName: '日常',
    }
    try {
      const uploaded = await uploadMedia(file, auth.token)
      const saved = await request('/api/media', {
        token: auth.token,
        method: 'POST',
        body: JSON.stringify({ kind: 'IMAGE', title: item.caption, objectKey: uploaded.key, contentType: uploaded.contentType, visibility: 'PRIVATE', albumName: '日常' }),
      })
      Object.assign(item, mapMedia(saved), { mine: true })
    } catch (error) { return notify(`图片未保存：${error.message}`) }
    galleryItems.value.unshift(item)
    notify('照片已上传到对象存储')
  }

  function openEditor(item) {
    mediaDraft.value = { title: item.caption, albumName: item.albumName || '日常', visibility: item.visibility }
    mediaEditor.value = item
  }

  async function saveEdit() {
    const item = mediaEditor.value
    if (!item || !mediaDraft.value.title.trim() || !mediaDraft.value.albumName.trim()) return notify('请填写名称和相册名')
    if (!item.mine) return notify('这不是你自己的照片，只能查看')
    if (isStoredMedia(item)) {
      try {
        const saved = await request(`/api/media/${item.id}`, {
          token: auth.token,
          method: 'PUT',
          body: JSON.stringify({ visibility: mediaDraft.value.visibility, title: mediaDraft.value.title.trim(), albumName: mediaDraft.value.albumName.trim() }),
        })
        Object.assign(item, mapMedia(saved))
      } catch (error) { return notify(`相册修改失败：${error.message}`) }
    } else {
      Object.assign(item, { caption: mediaDraft.value.title.trim(), albumName: mediaDraft.value.albumName.trim(), visibility: mediaDraft.value.visibility })
    }
    mediaEditor.value = null
    notify('相册内容已保存')
  }

  async function changeVisibility(item) {
    const visibility = item.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
    if (!item.mine) return notify('这不是你自己的内容，只能查看')
    if (isStoredMedia(item)) {
      try {
        const updated = await request(`/api/media/${item.id}`, { token: auth.token, method: 'PUT', body: JSON.stringify({ visibility, title: item.caption || item.name }) })
        Object.assign(item, mapMedia(updated))
      } catch (error) { return notify(`媒体可见范围未更新：${error.message}`) }
    } else {
      item.visibility = visibility
      return notify('本机草稿不会写入数据库；重新保存一次即可发到你的账号')
    }
    notify(visibility === 'PUBLIC' ? '已设为公开' : '已设为仅自己可见')
  }

  async function remove(item) {
    if (!item.mine) return notify('这不是你自己的照片，只能查看')
    if (!window.confirm(`确定删除“${item.caption || item.name}”吗？`)) return
    if (item.key) {
      try { await request(`/api/media/${item.id}`, { token: auth.token, method: 'DELETE' }) }
      catch (error) { return notify(`删除失败：${error.message}`) }
    }
    galleryItems.value = galleryItems.value.filter((photo) => photo.id !== item.id)
    galleryPreview.value = null
    mediaEditor.value = null
    notify('照片已删除')
  }

  return {
    galleryItems, publicTracks, ownMedia, selectedAlbum, galleryPreview, mediaEditor, mediaDraft,
    albumNames, visibleGallery, ownTracks,
    mapMedia, isStoredMedia, mediaImage, refresh, addPhoto, openEditor, saveEdit, changeVisibility, remove,
  }
})
