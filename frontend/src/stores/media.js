import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { request, uploadMedia } from '@/services/api'
import { makeThumbnail, readPhotoMeta } from '@/services/photoUpload'
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
  /** 正在编辑名字/描述的那本相册；null = 没开编辑窗。 */
  const albumEditor = ref(null)
  const albumEditDraft = ref({ name: '', description: '' })

  /**
   * 当前打开的地方：
   *   `'all'`  首页 —— 先摆一盒一盒相册，下面是**没进盒子的那些照片**（散落在外）
   *   `<id>`   某一本相册
   *
   * 刻意**没有「未分类」这个盒子**：没归进盒子的照片就散落在外面正常展示。
   * 多一个「未分类」盒子等于凭空多出一层收纳，而它装的其实是「我还没想好放哪」的东西。
   */
  const openAlbum = ref('all')
  const galleryPreview = ref(null)
  const mediaEditor = ref(null)
  const mediaDraft = ref({ title: '', description: '', albumId: null, visibility: 'PRIVATE' })

  /** 多选与「移到相册」：ids 是字符串，和别处的相册 id 口径一致。 */
  const selecting = ref(false)
  const selectedPhotoIds = ref([])
  const photoMover = ref(null)
  const moveDraft = ref({ albumId: null })

  /** 上传：选好的照片先排在这里，填完名称/描述、选好去处再传。 */
  const uploadDialog = ref(null)
  const uploadDraft = ref({ albumId: null, description: '', visibility: 'PRIVATE' })
  const uploadProgress = ref({ done: 0, total: 0, running: false })

  /** 相册的备选框：登录后是自己的相册，访客看到的是公开照片所在的相册。 */
  const albumList = computed(() => (auth.isLoggedIn ? albums.value : publicAlbums.value))
  const albumById = computed(() => new Map(albumList.value.map((album) => [album.id, album])))
  /**
   * 子相册的父相册不在列表里时，把它当一级看。
   * 访客那条路会真的出现这种情况：一级相册自己没有公开照片时读不到（RLS），
   * 而它的子相册里有一张——不这么处理的话这本子相册会从盒子列表里整个消失。
   */
  const isChild = (album) => album.parentId != null && albumById.value.has(album.parentId)
  const rootAlbums = computed(() => albumList.value.filter((album) => !isChild(album)))
  const childrenOf = (id) => albumList.value.filter((album) => isChild(album) && album.parentId === String(id))

  /** 当前打开的那本相册（首页 / 虚拟盒子时为 null）。 */
  const currentAlbum = computed(() => albumById.value.get(openAlbum.value) || null)
  /** 打开一本一级相册时，它下面的子相册——这些会以「小一号的盒子」出现在里面。 */
  const currentChildren = computed(() => {
    const album = currentAlbum.value
    return album && !isChild(album) ? childrenOf(album.id) : []
  })

  /**
   * 相册里**直辖**的照片（不含子相册的）。
   * 盒子里的照片和子盒子是分开摆的：照片是真的在这本相册里，子相册的照片在子盒子里，
   * 混在一起会让人分不清「这张到底在哪一层」。
   */
  const albumPhotos = (albumId) => galleryItems.value.filter((item) => item.albumId === String(albumId))
  /** 没进任何盒子的照片：它们就散落在首页上，不是「未分类」这种盒子。 */
  const loosePhotos = computed(() => galleryItems.value.filter((item) => !item.albumId))

  /** 每本相册直辖照片的预览（封面上最多拼 4 张，所以每本只留 8 张就够）。 */
  const previewByAlbum = computed(() => {
    const map = new Map()
    for (const item of galleryItems.value) {
      const key = item.albumId || ''
      if (!map.has(key)) map.set(key, [])
      const list = map.get(key)
      if (list.length < 8) list.push(item)
    }
    return map
  })
  const directCount = (albumId) => (previewByAlbum.value.get(String(albumId)) || []).length

  /**
   * 盒子封面用哪几张照片。
   * 一级相册连子相册的照片一起算——只拍子相册的那本相册不该是个空盒子。
   */
  function albumPreview(album, limit = 4) {
    const pool = [...(previewByAlbum.value.get(album.id) || [])]
    for (const child of childrenOf(album.id)) pool.push(...(previewByAlbum.value.get(child.id) || []))
    return pool.slice(0, limit)
  }

  /** 盒子上显示的数字：一级相册含子相册，否则「旅行」显示 0 张、点进去却有照片。 */
  function albumTotal(album) {
    let total = directCount(album.id)
    for (const child of childrenOf(album.id)) total += directCount(child.id)
    return total
  }
  const allPhotoCount = computed(() => galleryItems.value.length)
  const looseCount = computed(() => (previewByAlbum.value.get('') || []).length)

  /** 有拍摄地点的照片：地图上的足迹用它们。没有 GPS 的照片不进这个列表，这不是错误。 */
  const geoPhotos = computed(() => galleryItems.value.filter((item) => item.latitude != null && item.longitude != null))

  /**
   * 「X 年前的今天」：按拍摄时间的**月日**匹配今天（年份要早于今年）。
   * 刻意不查数据库：照片本来就已经全在内存里（公开的 + 自己的），客户端一算就有。
   */
  const onThisDay = computed(() => {
    const now = new Date()
    const monthDay = `${now.getMonth() + 1}-${now.getDate()}`
    const hits = galleryItems.value
      .filter((item) => {
        if (!item.takenAt) return false
        const taken = new Date(item.takenAt)
        return taken.getFullYear() < now.getFullYear()
          && `${taken.getMonth() + 1}-${taken.getDate()}` === monthDay
      })
      .sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt))
    if (!hits.length) return null
    return {
      photo: hits[0],
      years: now.getFullYear() - new Date(hits[0].takenAt).getFullYear(),
      count: hits.length,
    }
  })

  /**
   * 当前要显示的照片。
   * 首页给的是**没进盒子的那些**（散落在外面）；打开某本相册就是它直辖的照片。
   */
  const visibleGallery = computed(() => {
    const key = openAlbum.value
    if (key === 'all') return loosePhotos.value
    if (!albumById.value.has(key)) return []
    return albumPhotos(key)
  })

  const ownTracks = computed(() => (ownMedia.value || []).filter((item) => item.kind === 'MUSIC' || item.kind === 'MUSIC_URL'))

  function mapMedia(media) {
    // 界面上显示的日期优先用**拍摄时间**：用 created_at（上传时间）会让「X 年前的今天」
    // 变成「你哪天传的」，也会让相册里的时间排序莫名其妙。
    const when = media.takenAt || media.createdAt
    return {
      id: media.id,
      caption: media.title,
      name: media.title,
      albumId: media.albumId == null ? null : String(media.albumId),
      albumName: media.albumName || '日常',
      description: media.description || '',
      date: when ? when.slice(0, 7).replace('-', ' / ') : new Date().toISOString().slice(0, 7).replace('-', ' / '),
      takenAt: media.takenAt || null,
      latitude: media.latitude ?? null,
      longitude: media.longitude ?? null,
      image: media.url,
      src: media.url,
      // 网格与盒子封面用缩略图；没有就回退原图（老照片就是这样，不影响显示）
      thumb: media.thumbUrl || media.url,
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
      // mine 标记和照片上那套一致：访客看到的公开相册不能编辑。
      try { albums.value = (await request('/api/photo-albums', { token: auth.token })).map((album) => ({ ...album, mine: true })) }
      catch (error) { notify(`相册同步失败：${error.message}`) }
    } else {
      albums.value = []
    }
    try { publicAlbums.value = (await request('/api/public/photo-albums')).map((album) => ({ ...album, mine: false })) }
    catch { publicAlbums.value = [] }
    // 打开着的那本相册可能已经不存在了（换了账号、在另一台设备上删过）。
    // 停在一本不存在的相册上会看到空盒子，看起来像照片丢了。
    if (openAlbum.value !== 'all' && !albumById.value.has(openAlbum.value)) openAlbum.value = 'all'
  }

  /** 打开一本相册；`'all'` 回首页。 */
  function openBox(key) {
    openAlbum.value = key == null ? 'all' : String(key)
  }

  /* ---------------------------------------------------------------- 多选与移动 */

  const isSelected = (id) => selectedPhotoIds.value.includes(String(id))

  function toggleSelecting(force) {
    selecting.value = force == null ? !selecting.value : Boolean(force)
    if (!selecting.value) selectedPhotoIds.value = []
  }

  function togglePhotoSelection(id) {
    const key = String(id)
    selectedPhotoIds.value = isSelected(key)
      ? selectedPhotoIds.value.filter((item) => item !== key)
      : [...selectedPhotoIds.value, key]
  }

  /** 打开「移到相册」窗口。不传 ids 就用当前勾选的那批。 */
  function openPhotoMover(ids) {
    const list = (ids ?? selectedPhotoIds.value).map(String)
    if (!list.length) return
    const first = galleryItems.value.find((item) => String(item.id) === list[0])
    const current = first?.albumId ?? null
    // 默认选中「它们现在在哪」，这样打开就能看出当前归属；要改才动一下。
    moveDraft.value = { albumId: current }
    photoMover.value = { ids: list }
  }

  /**
   * 把选中的照片移到目标相册（`albumId` 为 null = 移出盒子、散落在外面）。
   * 一张一张 PUT：批量并发几十条请求在免费额度上更容易被限流，而且失败时也不好说清是哪张。
   */
  async function savePhotoMove() {
    const ids = photoMover.value?.ids || []
    if (!ids.length) return
    if (!requireLogin('移动照片')) return
    const albumId = moveDraft.value.albumId == null ? null : String(moveDraft.value.albumId)
    const album = albumId ? albumById.value.get(albumId) : null
    let moved = 0
    let failed = 0
    for (const id of ids) {
      const item = galleryItems.value.find((photo) => String(photo.id) === id)
      if (!item || !item.mine) { failed += 1; continue }
      if (isStoredMedia(item)) {
        try {
          const saved = await request(`/api/media/${item.id}`, {
            token: auth.token, method: 'PUT', body: JSON.stringify({ albumId }),
          })
          Object.assign(item, mapMedia(saved))
          moved += 1
        } catch { failed += 1 }
      } else {
        // 本机草稿（示例照片、未登录时加的）：接口没答上来，就地改。
        item.albumId = album ? album.id : null
        item.albumName = album ? album.name : '日常'
        moved += 1
      }
    }
    photoMover.value = null
    toggleSelecting(false)
    const where = album ? `「${album.name}」` : '盒子外面'
    notify(`${moved} 张已移到${where}${failed ? `，${failed} 张没成功` : ''}`)
  }

  /** 上传的照片落到当前正开着的那本相册；停在首页时就不归相册（散落在外面）。 */
  function targetAlbum() {
    return currentAlbum.value
  }

  /* ---------------------------------------------------------------- 上传（多张 + 先填信息） */

  /**
   * 打开上传对话框。选好的照片先在这里排队，可以一张张写名称/描述，
   * 也可以在上面写一条**统一描述**（下面留空的就用它），再选放进哪一本。
   */
  function openUploadDialog(files) {
    const list = [...(files || [])].filter((file) => file && String(file.type || '').startsWith('image/'))
    if (!list.length) return notify('这些文件里没有图片')
    const album = targetAlbum()
    uploadDraft.value = { albumId: album ? album.id : null, description: '', visibility: 'PRIVATE' }
    uploadProgress.value = { done: 0, total: list.length, running: false }
    uploadDialog.value = {
      entries: list.map((file, index) => ({
        key: `up-${Date.now()}-${index}`,
        file,
        // 本机预览用 object URL：照片还没上传，只能靠它显示缩略图。
        preview: URL.createObjectURL(file),
        caption: file.name.replace(/\.[^.]+$/, ''),
        description: '',
        // 下面三项都在本机读/算，不花流量：拍摄时间与地点来自 EXIF，缩略图由 canvas 生成
        takenAt: null,
        latitude: null,
        longitude: null,
        thumb: null,
      })),
    }
    // 每张几十毫秒，并行做；结果直接写进条目，界面上会显示拍到的日期
    for (const entry of uploadDialog.value.entries) {
      readPhotoMeta(entry.file).then((meta) => {
        if (!uploadDialog.value?.entries.includes(entry)) return
        entry.takenAt = meta.takenAt
        entry.latitude = meta.latitude
        entry.longitude = meta.longitude
      }).catch(() => {})
      makeThumbnail(entry.file).then((blob) => {
        if (!uploadDialog.value?.entries.includes(entry)) return
        entry.thumb = blob
      }).catch(() => {})
    }
  }

  function closeUploadDialog() {
    // object URL 不释放就会一直占着内存（一次选二十张手机照片很可观）
    for (const entry of uploadDialog.value?.entries || []) URL.revokeObjectURL(entry.preview)
    uploadDialog.value = null
    uploadProgress.value = { done: 0, total: 0, running: false }
  }

  /** 挑出来的照片之间去掉重名，避免同一张被选两次时看起来像是丢了一张。 */
  function removeUploadEntry(key) {
    const entries = uploadDialog.value?.entries || []
    const entry = entries.find((item) => item.key === key)
    if (!entry) return
    URL.revokeObjectURL(entry.preview)
    uploadDialog.value = { entries: entries.filter((item) => item.key !== key) }
    uploadProgress.value = { ...uploadProgress.value, total: uploadDialog.value.entries.length }
    if (!uploadDialog.value.entries.length) closeUploadDialog()
  }

  /** 一张一张传：并发的几十条上传在免费额度上更容易被限流，进度也说不清。 */
  async function runUpload() {
    const entries = uploadDialog.value?.entries || []
    if (!entries.length || uploadProgress.value.running) return
    if (!requireLogin('上传照片')) return
    const albumId = uploadDraft.value.albumId
    const album = albumId ? albumById.value.get(String(albumId)) : null
    uploadProgress.value = { done: 0, total: entries.length, running: true }
    let done = 0
    for (const entry of entries) {
      const saved = await addPhoto(entry.file, {
        title: entry.caption,
        description: entry.description.trim() || uploadDraft.value.description,
        albumId,
        visibility: uploadDraft.value.visibility,
        // 这三项在打开对话框时就本机读/算好了（见 openUploadDialog）
        thumb: entry.thumb,
        takenAt: entry.takenAt,
        latitude: entry.latitude,
        longitude: entry.longitude,
      })
      if (saved) done += 1
      uploadProgress.value = { done: uploadProgress.value.done + 1, total: entries.length, running: true }
    }
    const where = album ? `「${album.name}」` : '外面（还没放进盒子）'
    notify(`${done} 张已上传到${where}${done < entries.length ? `，${entries.length - done} 张没成功` : ''}`)
    // 失败的条目留在列表里，方便重试；全成功才关窗。
    if (done === entries.length) closeUploadDialog()
    else uploadProgress.value = { done: 0, total: entries.length, running: false }
  }

  function openAlbumEditor(album) {
    albumEditDraft.value = { name: album.name, description: album.description || '' }
    albumEditor.value = album
  }

  /** 保存相册的名字与描述。描述允许清空（传空串）。 */
  async function saveAlbumEditor() {
    const album = albumEditor.value
    if (!album) return
    if (!requireLogin('修改相册')) return
    const name = albumEditDraft.value.name.trim()
    if (!name) return notify('相册名不能为空')
    if (!album.mine) return notify('这不是你自己的相册，只能查看')
    try {
      const saved = await request(`/api/photo-albums/${album.id}`, {
        token: auth.token,
        method: 'PUT',
        body: JSON.stringify({ name, description: albumEditDraft.value.description }),
      })
      Object.assign(album, saved)
      // 照片上的相册名是显示用的副本，本地这些也要跟着改，否则网格里还挂着旧名字。
      for (const item of galleryItems.value) if (item.albumId === album.id) item.albumName = saved.name
    } catch (error) { return notify(`相册没保存：${error.message}`) }
    albumEditor.value = null
    notify('相册信息已保存')
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
      albums.value.push({ ...created, mine: true })
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
    const photos = albumTotal(album)
    const extra = children.length ? `它下面的 ${children.length} 个子相册会一起删掉，` : ''
    if (!window.confirm(`确定删除相册「${album.name}」吗？${extra}里面的 ${photos} 张照片不会被删除，会散落到外面。`)) return
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
    if (removed.has(openAlbum.value)) openAlbum.value = 'all'
    albumEditor.value = null
    notify('相册已删除，照片散落到外面')
  }

  /**
   * 上传一张照片（带名称 / 描述 / 去处）。由上传对话框逐张调用，成功返回那条记录。
   * 这里**不报成功的提示**：批量上传时每张弹一句会刷屏，由调用方汇总一句。
   */
  async function addPhoto(file, draft = {}) {
    if (!requireLogin('上传照片')) return null
    if (!file) return null
    const albumId = draft.albumId == null ? null : String(draft.albumId)
    const album = albumId ? albumById.value.get(albumId) : null
    const item = {
      // 批量上传时 Date.now() 会撞（同一毫秒里连着建），所以掺一个随机数当临时 id
      id: `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      caption: (draft.title || '').trim() || file.name.replace(/\.[^.]+$/, ''),
      description: (draft.description || '').trim(),
      date: new Date().toISOString().slice(0, 7).replace('-', ' / '),
      image: '', visibility: draft.visibility || 'PRIVATE', key: '',
      albumId: album ? album.id : null,
      albumName: album ? album.name : '日常',
    }
    try {
      const uploaded = await uploadMedia(file, auth.token)
      // 缩略图单独传一份。它失败**不算失败**：mediaView 会自动回退到原图，
      // 照片该显示还是显示，只是网格慢一点。
      let thumbKey = null
      if (draft.thumb) {
        try { thumbKey = (await uploadMedia(draft.thumb, auth.token)).key } catch { thumbKey = null }
      }
      const saved = await request('/api/media', {
        token: auth.token,
        method: 'POST',
        body: JSON.stringify({
          kind: 'IMAGE',
          title: item.caption,
          description: item.description,
          objectKey: uploaded.key,
          thumbKey,
          contentType: uploaded.contentType,
          visibility: item.visibility,
          albumId: album ? album.id : null,
          takenAt: draft.takenAt || null,
          latitude: draft.latitude ?? null,
          longitude: draft.longitude ?? null,
        }),
      })
      Object.assign(item, mapMedia(saved), { mine: true })
    } catch (error) {
      notify(`「${item.caption}」没上传成功：${error.message}`)
      return null
    }
    galleryItems.value.unshift(item)
    return item
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
    galleryItems, publicTracks, ownMedia, galleryPreview, mediaEditor, mediaDraft,
    albums, publicAlbums, albumManager, albumDraft, albumEditor, albumEditDraft,
    openAlbum, currentAlbum, currentChildren, rootAlbums, childrenOf,
    albumPhotos, loosePhotos, albumPreview, albumTotal, directCount,
    allPhotoCount, looseCount, visibleGallery, ownTracks, onThisDay, geoPhotos,
    selecting, selectedPhotoIds, photoMover, moveDraft,
    isSelected, toggleSelecting, togglePhotoSelection, openPhotoMover, savePhotoMove,
    uploadDialog, uploadDraft, uploadProgress,
    openUploadDialog, closeUploadDialog, removeUploadEntry, runUpload,
    mapMedia, isStoredMedia, mediaImage, refresh, refreshAlbums, openBox,
    createAlbum, renameAlbum, removeAlbum, openAlbumEditor, saveAlbumEditor,
    addPhoto, openEditor, saveEdit, changeVisibility, remove,
  }
})
