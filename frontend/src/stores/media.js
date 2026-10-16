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
 * 名称、描述、所属相册、可见范围、对象键，以及（对音频）已经解析好的歌词。
 *
 * 读的策略和文章/日记一致：公开的那一份对所有人完全一致（`/api/public/*`），
 * 登录后再叠上自己账号里的私密媒体。`mine` 标记归属，别人的公开照片上不会出现编辑按钮。
 *
 * 相册是**两级**的（相册 → 子相册），照片只挂在其中一层上。照片同时带着 `albumId`
 * （真正的归属）和 `albumName`（显示用的副本）——副本是给公开照片墙用的，原因见 services/api.js。
 * 这里的 id 一律用字符串：它会在 `<select>`、筛选键和接口参数之间来回走，
 * 类型一旦一边是数字一边是字符串，`'12' === 12` 这种比较会让筛选静默地少一批照片。
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

  /** 自己的相册（两级拉平存放，父子关系看 parentId）。 */
  const albums = ref([])
  /** 访客能看到的相册：只包含「装着公开照片」的那些（见 services/api.js）。 */
  const publicAlbums = ref([])
  const albumManager = ref(false)
  const albumDraft = ref({ name: '', parentId: null })

  /** 当前筛选：`'all'` / `'none'`（未分类）/ 相册 id。 */
  const selectedAlbum = ref('all')
  const galleryPreview = ref(null)
  const mediaEditor = ref(null)
  const mediaDraft = ref({ title: '', description: '', albumId: null, visibility: 'PRIVATE' })

  /** 相册的备选框：登录后是自己的相册，访客看到的是公开照片所在的相册。 */
  const albumList = computed(() => (auth.isLoggedIn ? albums.value : publicAlbums.value))
  const albumById = computed(() => new Map(albumList.value.map((album) => [album.id, album])))
  /**
   * 子相册的父相册不在列表里时，把它当一级看。
   * 访客那条路会真的出现这种情况：一级相册自己没有公开照片时读不到（RLS），
   * 而它的子相册里有一张——不这么处理的话这本子相册会从相册条上整个消失。
   */
  const isChild = (album) => album.parentId != null && albumById.value.has(album.parentId)
  const rootAlbums = computed(() => albumList.value.filter((album) => !isChild(album)))
  const childrenOf = (id) => albumList.value.filter((album) => isChild(album) && album.parentId === String(id))

  /** 当前选中的相册属于哪本一级相册（用于决定第二排显示谁）。 */
  const activeRootId = computed(() => {
    const album = albumById.value.get(selectedAlbum.value)
    if (!album) return null
    return isChild(album) ? album.parentId : album.id
  })
  const activeChildren = computed(() => (activeRootId.value ? childrenOf(activeRootId.value) : []))

  /**
   * 选中相册时要放行的相册 id 集合。
   * 选一级相册时把子相册的照片一起放进来——「整个相册」的语义就是这些全都算。
   */
  function scopeIds(key) {
    const album = albumById.value.get(key)
    if (!album) return new Set()
    const ids = new Set([album.id])
    if (!isChild(album)) for (const child of childrenOf(album.id)) ids.add(child.id)
    return ids
  }

  const visibleGallery = computed(() => {
    const key = selectedAlbum.value
    if (key === 'all') return galleryItems.value
    if (key === 'none') return galleryItems.value.filter((item) => !item.albumId)
    const ids = scopeIds(key)
    return galleryItems.value.filter((item) => item.albumId && ids.has(item.albumId))
  })

  /** 相册条上的数字。一级相册的数字含它的子相册，否则「旅行」显示 0 张、点进去却有照片。 */
  const albumCounts = computed(() => {
    const counts = { all: galleryItems.value.length, none: 0 }
    for (const album of albumList.value) counts[album.id] = 0
    for (const item of galleryItems.value) {
      if (!item.albumId) { counts.none += 1; continue }
      if (counts[item.albumId] != null) counts[item.albumId] += 1
    }
    for (const album of rootAlbums.value) {
      for (const child of childrenOf(album.id)) counts[album.id] += counts[child.id] || 0
    }
    return counts
  })

  const ownTracks = computed(() => (ownMedia.value || []).filter((item) => item.kind === 'MUSIC' || item.kind === 'MUSIC_URL'))

  function mapMedia(media) {
    return {
      id: media.id,
      caption: media.title,
      name: media.title,
      albumId: media.albumId == null ? null : String(media.albumId),
      albumName: media.albumName || '日常',
      description: media.description || '',
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

    await refreshAlbums()
  }

  /**
   * 相册分两份读：自己那份（登录后才有）和公开照片所在的那些。
   * 相册表是这次新加的，旧部署上还没执行 schema.sql 时这里会报错——所以失败只提示，
   * 不让它挡住照片墙本身（那才是这个页面主要的东西）。
   */
  async function refreshAlbums() {
    if (auth.isLoggedIn) {
      try { albums.value = await request('/api/photo-albums', { token: auth.token }) }
      catch (error) { notify(`相册同步失败：${error.message}`) }
    } else {
      albums.value = []
    }
    try { publicAlbums.value = await request('/api/public/photo-albums') }
    catch { publicAlbums.value = [] }
    // 选中的相册可能已经不存在了（换了账号、换了一台设备删过）。留在一个空筛选上会
    // 显示「0 张照片」，看起来像照片丢了。
    if (selectedAlbum.value !== 'all' && selectedAlbum.value !== 'none' && !albumById.value.has(selectedAlbum.value)) {
      selectedAlbum.value = 'all'
    }
  }

  function selectAlbum(key) {
    selectedAlbum.value = key == null ? 'all' : String(key)
  }

  /** 上传的照片落到当前正在看的那个相册；看的是「全部 / 未分类」时就不归相册。 */
  function targetAlbum() {
    return albumById.value.get(selectedAlbum.value) || null
  }

  async function createAlbum(parentId = null) {
    if (!requireLogin('新建相册')) return
    const name = albumDraft.value.name.trim()
    if (!name) return notify('请先给相册取个名字')
    try {
      const created = await request('/api/photo-albums', {
        token: auth.token,
        method: 'POST',
        body: JSON.stringify({ name, parentId: parentId == null ? null : String(parentId) }),
      })
      albums.value.push(created)
      albumDraft.value.name = ''
      notify(parentId == null ? `相册「${created.name}」建好了` : `子相册「${created.name}」建好了`)
    } catch (error) { notify(`相册没建成：${error.message}`) }
  }

  async function renameAlbum(album, rawName) {
    const name = String(rawName || '').trim()
    if (!name || name === album.name) return
    if (!requireLogin('修改相册')) return
    try {
      const saved = await request(`/api/photo-albums/${album.id}`, {
        token: auth.token, method: 'PUT', body: JSON.stringify({ name }),
      })
      Object.assign(album, saved)
      // 照片上的相册名是显示用的副本，本地这些也要跟着改，否则网格里还挂着旧名字。
      for (const item of galleryItems.value) if (item.albumId === album.id) item.albumName = saved.name
      notify('相册名已改好')
    } catch (error) { notify(`改不动：${error.message}`) }
  }

  async function removeAlbum(album) {
    if (!requireLogin('删除相册')) return
    const children = childrenOf(album.id)
    const photos = albumCounts.value[album.id] || 0
    const extra = children.length ? `它下面的 ${children.length} 个子相册会一起删掉，` : ''
    if (!window.confirm(`确定删除相册「${album.name}」吗？${extra}里面的 ${photos} 张照片不会被删除，会回到「未分类」。`)) return
    try {
      await request(`/api/photo-albums/${album.id}`, { token: auth.token, method: 'DELETE' })
    } catch (error) { return notify(`相册没删掉：${error.message}`) }

    const removed = new Set([album.id, ...children.map((child) => child.id)])
    albums.value = albums.value.filter((item) => !removed.has(item.id))
    for (const item of galleryItems.value) {
      if (item.albumId && removed.has(item.albumId)) {
        item.albumId = null
        item.albumName = '日常'
      }
    }
    if (removed.has(selectedAlbum.value)) selectedAlbum.value = 'all'
    notify('相册已删除，照片回到未分类')
  }

  async function addPhoto(file) {
    if (!requireLogin('上传照片')) return
    if (!file) return
    const album = targetAlbum()
    const item = {
      id: Date.now(),
      caption: file.name.replace(/\.[^.]+$/, ''),
      description: '',
      date: new Date().toISOString().slice(0, 7).replace('-', ' / '),
      image: '', visibility: 'PRIVATE', key: '',
      albumId: album ? album.id : null,
      albumName: album ? album.name : '日常',
    }
    try {
      const uploaded = await uploadMedia(file, auth.token)
      const saved = await request('/api/media', {
        token: auth.token,
        method: 'POST',
        body: JSON.stringify({
          kind: 'IMAGE',
          title: item.caption,
          description: '',
          objectKey: uploaded.key,
          contentType: uploaded.contentType,
          visibility: 'PRIVATE',
          albumId: album ? album.id : null,
        }),
      })
      Object.assign(item, mapMedia(saved), { mine: true })
    } catch (error) { return notify(`图片未保存：${error.message}`) }
    galleryItems.value.unshift(item)
    notify(album ? `照片已收进「${album.name}」` : '照片已上传到对象存储')
  }

  function openEditor(item) {
    mediaDraft.value = {
      title: item.caption,
      description: item.description || '',
      albumId: item.albumId ?? null,
      visibility: item.visibility,
    }
    mediaEditor.value = item
  }

  async function saveEdit() {
    const item = mediaEditor.value
    const draft = mediaDraft.value
    if (!item || !draft.title.trim()) return notify('请填写照片名称')
    if (!item.mine) return notify('这不是你自己的照片，只能查看')
    const albumId = draft.albumId == null ? null : String(draft.albumId)
    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      albumId,
      visibility: draft.visibility,
    }
    if (isStoredMedia(item)) {
      try {
        const saved = await request(`/api/media/${item.id}`, {
          token: auth.token, method: 'PUT', body: JSON.stringify(payload),
        })
        Object.assign(item, mapMedia(saved))
      } catch (error) { return notify(`照片信息没保存：${error.message}`) }
    } else {
      // 本机草稿（示例照片、未登录时加的）：接口没答上来，只能就地改。
      const album = albumById.value.get(albumId)
      Object.assign(item, {
        caption: payload.title,
        description: payload.description,
        albumId: album ? album.id : null,
        albumName: album ? album.name : '日常',
        visibility: payload.visibility,
      })
    }
    mediaEditor.value = null
    notify('照片信息已保存')
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
    albums, publicAlbums, albumManager, albumDraft,
    visibleGallery, ownTracks, rootAlbums, childrenOf, albumCounts, activeRootId, activeChildren,
    mapMedia, isStoredMedia, mediaImage, refresh, refreshAlbums, selectAlbum,
    createAlbum, renameAlbum, removeAlbum,
    addPhoto, openEditor, saveEdit, changeVisibility, remove,
  }
})
