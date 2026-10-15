<script setup>
import { computed, defineAsyncComponent, h, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDark } from '@vueuse/core'
import mammoth from 'mammoth/mammoth.browser'
import { request, uploadMedia } from './services/api'
import { useAuthStore } from './stores/auth'
import ParticleField from './ParticleField.vue'
import MusicVisualizer from './MusicVisualizer.vue'
import LyricsPanel from './components/LyricsPanel.vue'
import MusicDock from './components/MusicDock.vue'
import { parseLrc, resolveLyrics, LYRICS_SOURCE_LABELS } from './services/lyrics'
import { vReveal } from './composables/motion'
import { readStoredJson, readStoredText, writeStoredJson, writeStoredText } from './services/storage'

// 中文歌词源要经一个中转才能从浏览器调用（它的接口不带跨域响应头）。没配就整条源跳过，
// 只走 LRCLIB 和「手动粘贴」。仓库里附了一个 Supabase Edge Function 的实现。
const LYRICS_PROXY = import.meta.env?.VITE_LYRICS_PROXY || ''

// The study plan carries ~300 kB of course data. Loading it on demand keeps that out of the bundle
// every visitor downloads; the delay means the placeholder never flashes on a warm cache.
const StudyPlan = defineAsyncComponent({
  loader: () => import('./StudyPlan.vue'),
  delay: 140,
  loadingComponent: { name: 'StudyPlanLoading', render: () => h('div', { class: 'study-loading' }, '正在展开学习路线…') },
})

// 绩效管理只在打开时加载：它带着队列配置、OCR 与公式，没必要进首屏包。
const PerfPanel = defineAsyncComponent({
  loader: () => import('./PerfPanel.vue'),
  delay: 140,
  loadingComponent: { name: 'PerfLoading', render: () => h('div', { class: 'study-loading' }, '正在打开绩效管理…') },
})

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const isDark = useDark({ initialValue: 'dark' })
const currentPage = ref(typeof route.name === 'string' ? route.name : 'home')
// 「日记」页内部的两个视图：'mine'（我的日记）/ 'public'（公开日记）。访客只有后者。
// 声明得这么靠前，是因为下面的路由 watch 要在遇到旧地址 #/public-diary 时立刻用它。
const diaryTab = ref('mine')
watch(() => route.name, (name) => {
  if (typeof name !== 'string') return
  // 「公开日记」已经并进「日记」页当第二个标签，不再是独立页面。
  // 老的 #/public-diary 链接照旧能打开：切到公开标签，同时把地址换成 #/diary。
  if (name === 'publicDiary') {
    currentPage.value = 'diary'
    diaryTab.value = 'public'
    router.replace({ name: 'diary' })
    return
  }
  currentPage.value = name
}, { immediate: true })
// 绩效计算器是独立工具，不是博客的一个页面：打开它时把侧边导航、顶部栏、粒子背景和
// 播放器都收起来，让它自己占满整屏（见 style.css 的 .app-shell.tool-mode）。
const isToolPage = computed(() => currentPage.value === 'perf')

// 滚动方向感知的收起状态。三项处理让它不再「生硬」：
//   · rAF 节流：一帧最多处理一次滚动事件
//   · 迟滞：位移不足 26px 不判断方向，避免触控板抖动来回翻转
//   · 冷却：一次切换后 320ms 内不再切换，方向刚变也不会立刻弹回
const scrolled = ref(false)
let lastScrollY = 0
let scrollQueued = false
let lastToggleAt = 0
const SCROLL_MIN_DELTA = 26
const SCROLL_TOGGLE_COOLDOWN = 320
function applyScrollState() {
  scrollQueued = false
  const y = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0)
  // 回到顶部一定展开，不受迟滞与冷却限制。
  if (y <= 90) { scrolled.value = false; lastScrollY = y; return }
  const delta = y - lastScrollY
  if (Math.abs(delta) < SCROLL_MIN_DELTA) return
  const now = Date.now()
  if (now - lastToggleAt < SCROLL_TOGGLE_COOLDOWN) { lastScrollY = y; return }
  if (!scrolled.value && y > 130 && delta > 0) { scrolled.value = true; lastToggleAt = now }
  else if (scrolled.value && delta < 0) { scrolled.value = false; lastToggleAt = now }
  lastScrollY = y
}
function onScroll() {
  if (scrollQueued) return
  scrollQueued = true
  requestAnimationFrame(applyScrollState)
}

// 播放器不再是一个「悬停会变大」的浮动方块。
//
// 原来右下角那块东西平时是 300×52 的胶囊，悬停/开始播放时展开成 430×200 的卡片，尺寸过渡
// 还带着 backdrop-filter。三个后果：一直压在正文右下角、鼠标扫过就自己长大、而且每次收放
// 都要重新模糊整个背景（掉帧的直接来源）。现在桌面端的播放器固定在侧边栏的空白处，
// 尺寸恒定不展开；窄屏才退回底部的一条小胶囊。
// 播放器：歌词与「曲目 → 解析状态」的对应关系都放在下面的音乐状态里。
// 读：公开内容对所有人完全一致——登录与否都从 /api/public/* 读同一份数据。
// 登录不会改变别人看到的东西，只是在同一份公开内容上再叠一层自己账号里的私密内容。
onMounted(async () => {
  // 会话交给 Supabase 自己持久化，刷新页面后 auth.token 一开始是空的，
  // 所以这里不能再用 token 当判断条件，直接问一次「有没有已登录的会话」即可。
  const user = await auth.restoreSession()
  if (user) {
    profileName.value = user.displayName
    profileBio.value = user.bio || ''
    profileAvatar.value = user.avatarUrl || ''
  }
  await Promise.all([refreshDiaries(), refreshArticles(), refreshMedia()])
})
onMounted(() => {
  lastScrollY = Math.max(0, window.scrollY || 0)
  window.addEventListener('scroll', onScroll, { passive: true })
  // 「更多」菜单挂在 body 上，所以关闭逻辑要挂在 document 上
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
  window.addEventListener('resize', onViewportChange)
  window.addEventListener('scroll', onViewportChange, { passive: true })
  // 直接打开音乐页时也要对一次高度（上面的 watch 只在歌词变化时才跑）。
  requestAnimationFrame(syncConsoleHeight)
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  window.removeEventListener('resize', onViewportChange)
  window.removeEventListener('scroll', onViewportChange)
})

// 音乐放在主导航里——之前被收进「更多」，很难找到入口。
// 绩效计算器是独立工具，不占主导航——从「更多」或创作管理页路由进去。
const navigation = [
  { id: 'home', label: '首页', icon: '⌂' },
  { id: 'study', label: '学习', icon: '✦' },
  { id: 'music', label: '音乐', icon: '♫' },
  { id: 'articles', label: '文章', icon: '✎' },
  { id: 'diary', label: '日记', icon: '❏' },
  { id: 'gallery', label: '相册', icon: '▧' },
]
// 其余页面收在「更多」里。
const secondaryNavigation = [
  { id: 'admin', label: '创作管理', icon: '⚙' },
  { id: 'perf', label: '绩效计算器', icon: '¥' },
  { id: 'about', label: '关于我', icon: '✿' },
  { id: 'categories', label: '文章分类', icon: '◈' },
  { id: 'tags', label: '标签星图', icon: '＃' },
  { id: 'archives', label: '时光归档', icon: '◷' },
  { id: 'messages', label: '留言板', icon: '✉' },
  { id: 'friends', label: '朋友们', icon: '↔' },
]
const allNavigation = [...navigation, ...secondaryNavigation]
const moreOpen = ref(false)

// 「更多」菜单被 teleport 到 body。原因是 .side-nav 为了在窄屏能横向滚动用了
// overflow-x:auto，而滚动容器会裁掉绝对定位的子元素——菜单明明渲染了却一个字都看不见
// （实测按钮已经变成选中态，菜单整体被裁掉）。挂到 body 上用 fixed 定位就不受裁剪影响，
// 而且 body 上没有 transform/filter，fixed 的参照是真正的视口。
const moreButton = ref(null)
const moreMenuStyle = ref({})
const MORE_MENU_WIDTH = 214
function positionMoreMenu() {
  const button = moreButton.value
  if (!button || typeof window === 'undefined') return
  const rect = button.getBoundingClientRect()
  const width = Math.min(MORE_MENU_WIDTH, window.innerWidth - 20)
  const left = Math.max(10, Math.min(rect.right - width, window.innerWidth - width - 10))
  const top = Math.min(rect.bottom + 8, Math.max(10, window.innerHeight - 120))
  moreMenuStyle.value = { width: `${width}px`, left: `${left}px`, top: `${top}px`, right: 'auto' }
}
function toggleMore() {
  moreOpen.value = !moreOpen.value
  if (!moreOpen.value) return
  positionMoreMenu()
  // 导航栏还有收起/展开的过渡，下一帧再量一次才准
  requestAnimationFrame(positionMoreMenu)
}
function onDocumentPointerDown(event) {
  if (!moreOpen.value) return
  const target = event.target
  if (moreButton.value && moreButton.value.contains(target)) return
  if (target && typeof target.closest === 'function' && target.closest('.nav-more-menu')) return
  moreOpen.value = false
}
function onDocumentKeydown(event) {
  if (event.key === 'Escape') moreOpen.value = false
}
function onViewportChange() {
  if (moreOpen.value) moreOpen.value = false
  // 窗口尺寸变了，播放器栏的高度跟着变，歌词栏要重新对齐。
  syncConsoleHeight()
}

const currentPageLabel = computed(() => allNavigation.find((item) => item.id === currentPage.value)?.label || '')
const todayDisplay = new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date())
function go(page) {
  currentPage.value = page
  moreOpen.value = false
  if (route.name !== page) router.push({ name: page })
}
const search = ref('')
const toast = ref('')
let toastTimer

// Records created in this browser carry a string id; records from the server keep their numeric id.
// That is an unambiguous "not yet synced" marker, unlike guessing from the magnitude of a number.
function localId() { return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
function isLocalId(id) { return typeof id === 'string' && id.startsWith('local-') }

const demoArticles = [
  { id: 1, category: '慢生活', tags: ['日常', '慢生活'], content: '给自己一段没有安排的下午。泡一杯茶，翻几页书，原来留白也是一种答案。', date: '2026.09.18', title: '把生活调成喜欢的亮度', excerpt: '给自己一段没有安排的下午。泡一杯茶，翻几页书，原来留白也是一种答案。', image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=840&q=80', read: '3 分钟阅读' },
  { id: 2, category: '旅行手记', tags: ['旅行', '海边'], content: '在日落前抵达海边，天空慢慢从金色变成蓝紫色。那一刻，我什么也没有想。', date: '2026.08.26', title: '海风经过的那个夏天', excerpt: '在日落前抵达海边，天空慢慢从金色变成蓝紫色。那一刻，我什么也没有想。', image: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=840&q=80', read: '5 分钟阅读' },
  { id: 3, category: '日常片段', tags: ['日常', '音乐'], content: '花市捧回一束洋桔梗，旧唱片转过一面。普通的日子，也有它柔软的回声。', date: '2026.07.09', title: '周末的花与唱片', excerpt: '花市捧回一束洋桔梗，旧唱片转过一面。普通的日子，也有它柔软的回声。', image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=840&q=80', read: '2 分钟阅读' },
]
const articleKey = 'weiwei-blog-articles-v1'
const articles = ref(readStoredJson(articleKey, null) || demoArticles)
watch(articles, (value) => writeStoredJson(articleKey, value), { deep: true })
// coverUrl holds either an absolute image URL or a `media:<id>` reference into this account's media
// library. A reference is used on purpose: media links are short-lived signed URLs, so persisting
// the link itself would expire. `mapArticle` reads the same field back. A data: URL only exists in
// the signed-out preview and can run to hundreds of KB against a 1000-char column, so it is dropped.
function articlePayload(article) {
  const cover = String(article.image || '')
  return { title: article.title, category: article.category, visibility: article.visibility || 'PUBLIC', tags: (article.tags || []).join(','), excerpt: article.excerpt || '', content: article.content || article.excerpt || '', coverUrl: cover.startsWith('data:') ? '' : cover, articleDate: String(article.date || new Date().toISOString().slice(0, 10)).replaceAll('.', '-') }
}
function mapArticle(article) {
  return { id: article.id, title: article.title, category: article.category, visibility: article.visibility, tags: article.tags ? article.tags.split(/[，,\s]+/).filter(Boolean) : [], excerpt: article.excerpt, content: article.content, image: article.coverUrl || '', date: article.articleDate?.replaceAll('-', '.'), read: '文章' }
}
function mediaImage(reference) {
  const match = /^media:(\d+)$/.exec(reference || '')
  if (match) return galleryItems.value.find((asset) => String(asset.id) === match[1])?.image || ''
  return reference || ''
}
function articleImage(article) { return mediaImage(article.image) }
/**
 * 读文章：公开列表对所有人一致，登录后再叠上自己账号里的全部文章（含私密）。
 * `mine` 决定这篇能不能编辑/删除——公开列表里也有别人的文章，没有它就会在别人的文章上出现编辑按钮。
 *
 * 本机草稿（旧版本在未登录时写的）不再自动上传：它们只留在当前浏览器，
 * 想看就点开、按「保存文章」手动发到自己的账号，不会再悄悄进到之后登录的那个账号里。
 */
async function refreshArticles() {
  let own = null
  if (auth.isLoggedIn) {
    try { own = (await request('/api/articles', { token: auth.token })).map((article) => ({ ...mapArticle(article), mine: true })) }
    catch (error) { notify(`自己的文章读取失败：${error.message}`) }
  } else {
    own = [] // 没登录就没有「自己的文章」，公开文章在下面同一份列表里
  }
  try {
    const publicArticles = (await request('/api/public/articles')).map((article) => ({ ...mapArticle(article), mine: false }))
    const localDrafts = articles.value.filter((article) => isLocalId(article.id)).map((article) => ({ ...article, mine: false, local: true }))
    const ownIds = new Set((own || []).map((article) => article.id))
    // 自己的记录优先：同 id 的公开条目丢掉，避免同一篇文章出现两次。
    articles.value = own === null
      ? [...localDrafts, ...publicArticles]
      : [...localDrafts, ...own, ...publicArticles.filter((article) => !ownIds.has(article.id))]
  } catch { /* 接口不可达时保留本机内容，本机预览照常可用。 */ }
}
const categoryNames = computed(() => [...new Set(articles.value.map((article) => article.category))])
const tagNames = computed(() => [...new Set(articles.value.flatMap((article) => article.tags || []))])
const categoryFilter = ref('')
const tagFilter = ref('')
const visibleArticles = computed(() => articles.value.filter((article) => (!categoryFilter.value || article.category === categoryFilter.value) && (!tagFilter.value || article.tags?.includes(tagFilter.value))))
const photos = [
  { image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=800&q=80', caption: '花店刚开门的清晨', date: '2026 / 09' },
  { image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=800&q=80', caption: '山谷里慢慢亮起灯', date: '2026 / 08' },
  { image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80', caption: '在路上的某个傍晚', date: '2026 / 07' },
  { image: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=800&q=80', caption: '海风经过的那个夏天', date: '2026 / 06' },
]
const galleryPicker = ref(null)
const articleCoverPicker = ref(null)
// String ids keep the built-in samples from ever colliding with a real media id, which is what a
// `media:<id>` cover or avatar reference resolves against.
const galleryItems = ref(photos.map((photo, index) => ({ ...photo, id: `demo-${index + 1}`, visibility: 'PUBLIC', key: '' })))
const selectedAlbum = ref('全部')
const galleryPreview = ref(null)
const mediaEditor = ref(null)
const mediaDraft = ref({ title: '', albumName: '日常', visibility: 'PRIVATE' })
const albumNames = computed(() => ['全部', ...new Set(galleryItems.value.map((item) => item.albumName || '日常'))])
const visibleGallery = computed(() => selectedAlbum.value === '全部' ? galleryItems.value : galleryItems.value.filter((item) => (item.albumName || '日常') === selectedAlbum.value))
function mapMedia(media) {
  return { id: media.id, caption: media.title, name: media.title, albumName: media.albumName || '日常', date: media.createdAt ? media.createdAt.slice(0, 7).replace('-', ' / ') : new Date().toISOString().slice(0, 7).replace('-', ' / '), image: media.url, src: media.url, key: media.objectKey, visibility: media.visibility, kind: media.kind, lyrics: media.lyrics || '', lyricsSource: media.lyricsSource || '' }
}
// A stored media record always carries an object key and was never created in this browser. The
// built-in samples and anything added while signed out are local-only, so only real records may be
// addressed by id in the API. Without this guard a sample could send `PUT /api/media/1` and silently
// change an unrelated real photo.
function isStoredMedia(item) { return Boolean(item && item.key && !item.local) }
/**
 * 读相册与音乐：公开的那部分对所有人生效且完全一致，登录后再叠上自己账号里的私密媒体。
 * 和文章一样用 `mine` 标记归属，别人的公开照片/曲目上不会出现编辑和删除按钮。
 */
async function refreshMedia() {
  let own = null
  if (auth.isLoggedIn) {
    try { own = (await request('/api/media', { token: auth.token })).map((asset) => ({ ...mapMedia(asset), mine: true })) }
    catch (error) { notify(`媒体库同步失败：${error.message}`) }
  } else {
    own = []
  }

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
    const tracks = (await request('/api/public/media/music')).map((asset) => ({ ...mapMedia(asset), mine: false }))
    const ownTracks = (own || []).filter((item) => item.kind === 'MUSIC' || item.kind === 'MUSIC_URL')
    const ownTrackIds = new Set(ownTracks.map((item) => item.id))
    const localTracks = musicItems.value.filter((item) => item.local && !item.key)
    musicItems.value = own === null
      ? [...localTracks, ...tracks]
      : [...localTracks, ...ownTracks, ...tracks.filter((item) => !ownTrackIds.has(item.id))]
  } catch { /* 播放器仍可用公开的 HTTPS 音频直链。 */ }
}
async function changeMediaVisibility(item) {
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
async function addPhoto(event) {
  if (!requireLogin('上传照片')) { event.target.value = ''; return }
  const file = event.target.files?.[0]
  if (!file) return
  const item = { id: Date.now(), caption: file.name.replace(/\.[^.]+$/, ''), date: new Date().toISOString().slice(0, 7).replace('-', ' / '), image: '', visibility: 'PRIVATE', key: '', albumName: '日常' }
  try {
    const uploaded = await uploadMedia(file, auth.token)
    const saved = await request('/api/media', { token: auth.token, method: 'POST', body: JSON.stringify({ kind: 'IMAGE', title: item.caption, objectKey: uploaded.key, contentType: uploaded.contentType, visibility: 'PRIVATE', albumName: '日常' }) })
    Object.assign(item, mapMedia(saved), { mine: true })
  }
  catch (error) { event.target.value = ''; return notify(`图片未保存：${error.message}`) }
  galleryItems.value.unshift(item)
  notify('照片已上传到对象存储')
  event.target.value = ''
}
function openMediaEditor(item) {
  mediaDraft.value = { title: item.caption, albumName: item.albumName || '日常', visibility: item.visibility }
  mediaEditor.value = item
}
async function saveMediaEdit() {
  const item = mediaEditor.value
  if (!item || !mediaDraft.value.title.trim() || !mediaDraft.value.albumName.trim()) return notify('请填写名称和相册名')
  if (!item.mine) return notify('这不是你自己的照片，只能查看')
  if (isStoredMedia(item)) {
    try {
      const saved = await request(`/api/media/${item.id}`, { token: auth.token, method: 'PUT', body: JSON.stringify({ visibility: mediaDraft.value.visibility, title: mediaDraft.value.title.trim(), albumName: mediaDraft.value.albumName.trim() }) })
      Object.assign(item, mapMedia(saved))
    } catch (error) { return notify(`相册修改失败：${error.message}`) }
  } else Object.assign(item, { caption: mediaDraft.value.title.trim(), albumName: mediaDraft.value.albumName.trim(), visibility: mediaDraft.value.visibility })
  mediaEditor.value = null
  notify('相册内容已保存')
}
async function deleteMedia(item) {
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

const initialDiaries = [
  { id: 1, title: '周三，雨停以后', date: '2026-09-30', weather: '🌦', mood: '平静', tags: ['日常', '散步'], visibility: 'PRIVATE', content: '雨停以后，路边的树叶像是刚洗过。绕远路回家，买了一小束白色洋桔梗。今天没有什么特别的事，但也不需要每一天都特别。\n\n晚饭后听了一会儿歌，窗户开着，风刚刚好。' },
  { id: 2, title: '想念海边的风', date: '2026-09-12', weather: '☀️', mood: '开心', tags: ['旅行'], visibility: 'PUBLIC', content: '忽然想起上个月在海边的傍晚。没有行程，也没有赶时间，只是沿着海岸线一直走，等天色变暗。原来我最喜欢的旅行方式，是慢一点。' },
  { id: 3, title: '给未来的一封信', date: '2026-08-28', weather: '☁️', mood: '期待', tags: ['随想'], visibility: 'PRIVATE', content: '嘿，未来的我。希望你还记得现在喜欢的这些小事：早晨的咖啡、旧书的气味，还有把心情认真写下来的习惯。慢慢来，一切都会发生。' },
]
const diaryKey = 'weiwei-blog-diaries-v1'
const defaultVisibility = ref(localStorage.getItem('weiwei-blog-default-visibility') || 'PRIVATE')
const diaryScope = ref('ALL')
const diaries = ref(readStoredJson(diaryKey, null) || initialDiaries)
watch(diaries, (value) => writeStoredJson(diaryKey, value), { deep: true })
const filteredDiaries = computed(() => diaries.value.filter((entry) => (diaryScope.value === 'ALL' || (diaryScope.value === 'PUBLIC' ? entry.visibility === 'PUBLIC' : entry.visibility !== 'PUBLIC')) && `${entry.title} ${entry.content} ${(entry.tags || []).join(' ')}`.toLowerCase().includes(search.value.toLowerCase())))
const remotePublicDiaries = ref([])
const publicDiariesLoaded = ref(false)
// 公开日记：对所有人完全一致——登录与否都用同一份公开列表。
// 自己的公开日记在这里用本机那一份（刚改完可见范围就是最新的），别人的照原样列出。
const publicDiaries = computed(() => {
  if (!publicDiariesLoaded.value) return diaries.value.filter((entry) => entry.visibility === 'PUBLIC')
  const ownIds = new Set(diaries.value.map((entry) => entry.id))
  return [...diaries.value.filter((entry) => entry.visibility === 'PUBLIC'), ...remotePublicDiaries.value.filter((entry) => !ownIds.has(entry.id))]
})
/**
 * 首页「日记碎片」显示哪两条：
 *   自己写过 -> 显示自己最近的；还没写（含访客、新账号）-> 显示大家的公开日记。
 * 原来这里直接写死 `diaries`（= 当前账号自己的日记），所以访客和新账号打开首页是一片空白，
 * 即使站上已经有公开日记。
 */
const homeShowsOwnDiaries = computed(() => diaries.value.length > 0)
const homeDiaries = computed(() => (homeShowsOwnDiaries.value ? diaries.value : publicDiaries.value).slice(0, 2))
/**
 * 「日记」页当前看的是哪一份。切换走页面内的标签状态（diaryTab），不再走路由，
 * 所以地址栏始终是 #/diary，两个视图在同一个页面上。
 * 访客没有「我的日记」这一份，只能看公开的。
 */
const showMyDiary = computed(() => auth.isLoggedIn && diaryTab.value === 'mine')
const selectedDiary = ref(null)
const diaryDialog = ref(false)
const draft = ref(emptyDraft())
const articleDialog = ref(false)
const articleDraft = ref(emptyArticleDraft())
const selectedArticle = ref(null)
const importReview = ref([])
const importDialog = ref(false)
const picker = ref(null)
const musicPicker = ref(null)
const playerPicker = ref(null)
const searchInput = ref(null)
const audioElement = ref(null)
const musicName = ref('')
const audioUrl = ref('')
const playing = ref(false)
const analyser = ref(null)
const volume = ref(45)
const profileDialog = ref(false)
const profileName = ref(localStorage.getItem('weiwei-blog-name') || '唯唯')
const profileBio = ref(localStorage.getItem('weiwei-blog-bio') || '喜欢记录日常，也喜欢在路上。')
const profileAvatar = ref(localStorage.getItem('weiwei-blog-avatar') || '')
// Resolved at render time, so a `media:<id>` avatar still resolves once the media library has
// loaded (and re-resolves when it changes) instead of depending on load order.
const profileAvatarSrc = computed(() => mediaImage(profileAvatar.value))
const siteVisibility = ref(localStorage.getItem('weiwei-blog-site-visibility') || 'PUBLIC')
const guestbookKey = 'weiwei-blog-messages-v1'
const messages = ref(readStoredJson(guestbookKey, null) || [
  { id: 1, name: '小岛', date: '2026-09-26', content: '喜欢这个安静的小世界，祝你每天都有好心情。' },
  { id: 2, name: '阿橘', date: '2026-09-21', content: '“慢一点也没关系”这句话送给最近忙碌的自己。' },
])
watch(messages, (value) => writeStoredJson(guestbookKey, value), { deep: true })
const messageDraft = ref({ name: '', content: '' })
const friendLinks = ref(readStoredJson('weiwei-blog-friends-v1', null) || [
  { name: '纸飞机的信箱', url: 'https://example.com', note: '写字、读书和散步。' },
  { name: '小岛日记', url: 'https://example.org', note: '收藏沿途的风景。' },
])
watch(friendLinks, (value) => writeStoredJson('weiwei-blog-friends-v1', value), { deep: true })
const musicItems = ref([])
const remoteMusicUrl = ref('')
const remoteAudioElement = ref(null)
const activeRemoteAudio = ref(false)
const musicEditor = ref(null)
const musicDraft = ref({ title: '', visibility: 'PRIVATE' })
// 当前加载的曲目与播放进度，供音乐页的「正在播放」面板和底部播放器共用。
const activeTrackId = ref(null)
const currentTime = ref(0)
const trackDuration = ref(0)
const currentTrack = computed(() => musicItems.value.find((track) => track.id === activeTrackId.value) || null)

/**
 * 这是不是一个能直接交给 <audio> 的地址。
 *
 * 必须区分：签名链接失败时 API 会把 url 退化成**对象键**（`users/…/x.mp3`），
 * 那是个相对路径——交给 <audio> 只会被解析成页面下的路径然后 404。
 * 以前 playMusicItem 判断的是 `if (!source && item.key)`，而对象键是真值，
 * 于是"换一次短期链接"的分支永远不会执行。表现就是：有的歌点了没反应，
 * 有的抛一个解不出来的错、再被笼统地报成"浏览器不允许播放"。
 */
function isDirectAudioUrl(value) {
  return /^(https?:|blob:|data:)/.test(String(value || ''))
}

/**
 * 一首歌到底能不能播。
 *
 * 曲库里的条目未必都放得出来：签名链接可能没签成功（那时 src 会是对象键而不是地址）、
 * 也可能只有对象键需要现换链接。把它们排除掉，切歌和"播第一首"才不会一上去就卡住。
 */
function isPlayableTrack(track) {
  if (!track) return false
  if (track.file) return true
  if (isDirectAudioUrl(track.src)) return true
  return Boolean(track.key)
}
/** 曲库里真正能播的那些，顺序就是列表顺序。 */
const playableTracks = computed(() => musicItems.value.filter(isPlayableTrack))

// 没有选中曲目时显示中性文案，不再显示一个假的示例曲名。
const nowPlayingLabel = computed(() => currentTrack.value?.name || musicName.value || '未选择曲目')
const progressPercent = computed(() => (trackDuration.value > 0 ? Math.min(100, (currentTime.value / trackDuration.value) * 100) : 0))
// 本机临时选中的文件（不在曲库里）。它也要能有歌词，所以单独留一份引用。
const localFileTrack = ref(null)

// ---- 歌词 -----------------------------------------------------------------
// 歌词的解析发生在上传的时候，不是打开页面的时候：上传时手里有完整文件（能读内嵌标签），
// 上传的人又是登录状态（能把匹配结果直接存回数据库）。这样访客打开音乐页时，歌词已经是
// 现成的一行文本，不用等、也不会因为在线接口挂了就看不到。
//
// lyricsLrc 是当前正在播放这首歌的歌词原文，LyricsPanel 直接吃它。
const lyricsLrc = ref('')
const lyricsSource = ref('')
const lyricsParsed = computed(() => (lyricsLrc.value ? parseLrc(lyricsLrc.value) : null))
// 每首歌一个解析任务状态：parsing / ready / none。曲库列表和上传弹窗都读它。
const lyricJobs = ref({})
function lyricJob(id) { return lyricJobs.value[id] || null }
function setLyricJob(id, patch) {
  lyricJobs.value = { ...lyricJobs.value, [id]: { ...(lyricJobs.value[id] || {}), ...patch } }
}
// ---- 音频通路 --------------------------------------------------------------
// 本机播放的音频会被接进 Web Audio（AnalyserNode）来驱动频谱和粒子律动。
// 代价是这时候音频不再走浏览器原生的播放通路，而是绕一圈经过音频图——在 GPU/主线程
// 比较吃紧的机器上，这一绕就可能表现为"播一下卡一下"。
//
// 省电模式就是把这一圈整个去掉：不建音频图（原生通路最稳）、不画粒子、不画频谱。
// 它同时也是一个诊断开关——打开它之后如果不卡了，问题就在这条通路上；
// 如果还是卡，那问题在文件本身或存储端的读取。
const lowPower = ref(readStoredText('weiwei-blog-low-power', '') === '1')
function setLowPower(value) {
  lowPower.value = value
  writeStoredText('weiwei-blog-low-power', value ? '1' : '0')
  // 音频图一旦建起来，就和当时那个 <audio> 元素绑死了（同一元素只能接一个
  // MediaElementAudioSourceNode，且无法断开）。所以切换设置时要连元素一起换掉：
  // 模板里 <audio> 的 key 绑在 lowPower 上，Vue 会重新创建一个干净的元素。
  if (audioGraph) { audioGraph.context.close().catch(() => {}); audioGraph = null }
  analyser.value = null
  playing.value = false
  notify(value
    ? '已切到省电模式：原生播放通路 + 关闭粒子与频谱，重新选一首歌即可'
    : '已恢复完整动效，重新选一首歌即可')
}

// 曲目取源只做两件事：本机文件直接用，其余交给 <audio> 自己流式播放。
// 这里刻意**不再**做「后台整段取回 blob」那套缓存：它和下面的预缓冲抢同一份带宽
// （两个都在下同一个文件），反而把起播拖慢；而且它只在空闲时跑，基本跑不完。
const localFileUrls = new Map()

/** 本次会话刚上传 / 本机选择的文件，直接给一个本地地址；没有就返回空串。 */
function localSourceFor(item) {
  if (!item?.file) return ''
  if (!localFileUrls.has(item.id)) localFileUrls.set(item.id, URL.createObjectURL(item.file))
  return localFileUrls.get(item.id) || ''
}

// 歌词是异步到位的。它一到，右侧内容就换了，这时候要：
//   1. 重新对一次高度（歌词栏不再把整块撑长）
//   2. 再看一眼播放器还在不在视野里 —— 之前只点了播放才滚，歌词稍后加载出来时页面已经变了
watch([lyricsLrc, () => lyricsParsed.value?.lines.length], async () => {
  await nextTick()
  syncConsoleHeight()
  revealPlayerPanel()
})

watch([currentPage, () => musicItems.value.length], () => {
  if (currentPage.value !== 'music') return
  preloadFirstTrack()
})

// ---- 提前预缓冲：让起播不再等待 ----------------------------------------------
//
// 打开音乐页、且没有在播放时，先把队列第一首的地址交给 <audio>，让浏览器自己开始缓冲。
// 这样你点播放时数据已经在缓冲区里，起播几乎是瞬间的。
//
// 为什么这不算"和播放抢带宽"（那条铁律针对的是并发下载）：这里下载的就是你点播放后要下的
// 同一个文件、走的还是媒体元素自己那条流，只是**提前开始**。没有第二路下载，也没有等整段。
// 换歌时旧的请求会被新的 src 自动中断，重叠极少。
let preloadedTrackId = null
function preloadFirstTrack() {
  if (currentPage.value !== 'music' || playing.value) return
  const audio = audioElement.value
  if (!audio) return
  // 已经选过曲目（有正在用的源）就别动它，免得把当前缓冲丢掉。
  if (activeTrackId.value) return
  const first = playableTracks.value[0]
  if (!first) return
  let target = localSourceFor(first)
  if (!target && isDirectAudioUrl(first.src)) target = first.src
  if (!target) return
  if (preloadedTrackId === first.id && audio.getAttribute('src')) return
  preloadedTrackId = first.id
  // preload=auto 才会真的缓冲音频数据（默认的 metadata 只取头部）。
  audio.preload = 'auto'
  audio.src = target
  audio.load()
}


// 本机文件不卡、曲库里的卡，就说明瓶颈在「把文件从存储取回来」这一段，和 CPU / 解码 /
// 渲染 / 音频图都无关。这个测速只抓前 256KB 就中止，几秒出结果，用来分清两件事：
//   · 实测速率 < 需要的速率  → 带宽不够，只能压小文件或换更近的存储
//   · 实测速率够、但播放还卡 → 带宽没问题，是请求模式/延迟的问题
// ---- 后台导入任务 -----------------------------------------------------------
const uploadJobs = ref([])
// 每步对应的进度。上传和歌词匹配拿不到真实字节数（匹配要等在线接口），
// 所以这两步只给一个大致位置，由 CSS 的流动条纹表示「还在动」。
const UPLOAD_STEP_PROGRESS = { uploading: 22, saving: 48, lyrics: 74, done: 100, error: 100 }
const UPLOAD_INDETERMINATE_STEPS = new Set(['uploading', 'lyrics'])

function addUploadJob(name) {
  const job = {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name, step: 'uploading', message: '正在上传到对象存储…',
    trackId: null, hasLyrics: false, error: '', createdAt: Date.now(),
  }
  uploadJobs.value = [job, ...uploadJobs.value]
  return job
}
function patchUploadJob(job, patch) {
  uploadJobs.value = uploadJobs.value.map((item) => (item.id === job.id ? { ...item, ...patch } : item))
}
function dismissUploadJob(id) {
  uploadJobs.value = uploadJobs.value.filter((item) => item.id !== id)
}
function uploadJobProgress(job) { return UPLOAD_STEP_PROGRESS[job.step] ?? 10 }
function uploadJobIndeterminate(job) { return UPLOAD_INDETERMINATE_STEPS.has(job.step) }
const UPLOAD_STEP_LABELS = { uploading: '上传中', saving: '写入音乐库', lyrics: '解析歌词', done: '已完成', error: '失败' }
function uploadStepLabel(job) { return UPLOAD_STEP_LABELS[job.step] || job.step }
const activeUploadCount = computed(() => uploadJobs.value.filter((job) => job.step !== 'done' && job.step !== 'error').length)
function clearFinishedJobs() {
  uploadJobs.value = uploadJobs.value.filter((job) => job.step !== 'done')
}
function playJobTrack(job) {
  const track = musicItems.value.find((item) => item.id === job.trackId)
  dismissUploadJob(job.id)
  if (track) playMusicItem(track)
  else go('music')
}

// 可视化模式：频谱柱 / 声波 / 涟漪 / 长条矩阵。选择记在本机，下次打开保持一致。
const vizModes = [
  { id: 'bars', label: '频谱' },
  { id: 'matrix', label: '矩阵' },
  { id: 'wave', label: '声波' },
  { id: 'ripple', label: '涟漪' },
]
const vizMode = ref(readStoredText('weiwei-blog-viz-mode', 'bars'))
watch(vizMode, (value) => writeStoredText('weiwei-blog-viz-mode', value))
const authMode = ref('login')
const authForm = ref({ email: '', password: '', displayName: '' })
const adminUploadMessage = ref('')
const friendDraft = ref({ name: '', url: '', note: '' })

function emptyDraft() { return { id: null, title: '', date: new Date().toISOString().slice(0, 10), mood: '平静', weather: '☀️', visibility: defaultVisibility.value, tags: '日常', content: '' } }
// The date input is type="date", which requires YYYY-MM-DD; articles are displayed as YYYY.MM.DD.
function toIsoDate(value) { return String(value || new Date().toISOString().slice(0, 10)).replaceAll('.', '-') }
function emptyArticleDraft() { return { id: null, title: '', date: new Date().toISOString().slice(0, 10), category: '日常片段', tags: '日常', excerpt: '', content: '', image: '', visibility: 'PUBLIC' } }
function notify(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2600)
}
/**
 * 权限模型只有一条：看是公开的，改要登录。
 * 所有「新建/编辑/上传/导入」的入口都先走这里——未登录就直接把人带到登录页，
 * 而不是在本机起草一份之后又要想办法合并进某个账号。
 */
function requireLogin(action) {
  if (auth.isLoggedIn) return true
  notify(`登录后才能${action}；现在可以浏览全部公开内容`)
  go('account')
  return false
}
/**
 * 退出后要重新拉一次：自己账号里的私密内容不能再留在屏幕上，
 * 而且列表要回到「所有人的公开内容」这一份，和陌生人看到的完全一样。
 */
function logout() {
  auth.logout()
  notify('已退出账号；现在显示的是所有人的公开内容')
  refreshDiaries()
  refreshArticles()
  refreshMedia()
}
function openNewDiary() { if (!requireLogin('写日记')) return; draft.value = emptyDraft(); diaryDialog.value = true }
function openEditDiary(entry) {
  if (!requireLogin('编辑日记')) return
  if (!entry.mine && !isLocalId(entry.id)) return notify('这不是你自己的日记，只能阅读')
  draft.value = { ...entry, tags: (entry.tags || []).join('，') }; selectedDiary.value = null; diaryDialog.value = true
}
function diaryPayload(entry) {
  return { title: entry.title, entryDate: entry.date, mood: entry.mood, weather: entry.weather, visibility: entry.visibility, tags: (entry.tags || []).join(','), content: entry.content }
}
function mapDiary(entry) {
  return { id: entry.id, title: entry.title, date: entry.entryDate, weather: entry.weather, mood: entry.mood, visibility: entry.visibility, tags: entry.tags ? entry.tags.split(/[，,\s]+/).filter(Boolean) : [], content: entry.content }
}
/**
 * 读日记：公开列表对所有人一致；「我的日记」是登录后自己账号里的全部日记（含私密）。
 * 未登录时这里没有「自己的日记」——公开日记去「公开日记」页看，两个页面不会互相顶替。
 */
async function refreshDiaries() {
  let own = null
  if (auth.isLoggedIn) {
    try { own = (await request('/api/diaries', { token: auth.token })).map((entry) => ({ ...mapDiary(entry), mine: true })) }
    catch (error) { notify(`无法同步日记：${error.message}`) }
  }
  // 本机草稿（旧版本在未登录时写的）不再自动上传，只留在当前浏览器里。
  const localDrafts = diaries.value.filter((entry) => isLocalId(entry.id)).map((entry) => ({ ...entry, mine: false, local: true }))

  let backendAnswered = false
  try {
    const remote = await request('/api/public/diaries')
    remotePublicDiaries.value = remote.map((entry) => ({ ...mapDiary(entry), mine: false }))
    publicDiariesLoaded.value = true
    backendAnswered = true
  } catch { /* 接口不可达时保留本机预览。 */ }

  // 后端答上来了，内置示例就不该再冒充「我的日记」：未登录的人这里本来就没有自己的日记，
  // 只留下本机草稿。登录的人换成自己那一份；自己那份没读到就不要用空数组把已有内容顶掉。
  if (!auth.isLoggedIn && backendAnswered) diaries.value = localDrafts
  else if (own !== null) diaries.value = [...localDrafts, ...own]
}
async function changeDiaryVisibility(entry) {
  if (!requireLogin('修改日记可见范围')) return
  const nextVisibility = entry.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
  if (!isLocalId(entry.id)) {
    try {
      const updated = await request(`/api/diaries/${entry.id}`, {
        token: auth.token, method: 'PUT', body: JSON.stringify(diaryPayload({ ...entry, visibility: nextVisibility })),
      })
      Object.assign(entry, mapDiary(updated), { mine: true })
      notify(nextVisibility === 'PUBLIC' ? '这篇日记已公开' : '这篇日记已设为仅自己可见')
      return
    } catch (error) { return notify(`可见范围未更新：${error.message}`) }
  }
  entry.visibility = nextVisibility
  notify(nextVisibility === 'PUBLIC' ? '这篇日记已公开' : '这篇日记已设为仅自己可见')
}
async function saveDiary() {
  if (!requireLogin('保存日记')) return
  if (!draft.value.title.trim() || !draft.value.content.trim()) return notify('请填写日记标题和内容')
  const record = { ...draft.value, id: draft.value.id || localId(), tags: String(draft.value.tags || '').split(/[，,\s]+/).filter(Boolean) }
  if (record.visibility !== 'PUBLIC') record.visibility = 'PRIVATE'
  let index = diaries.value.findIndex((item) => item.id === record.id)
  // 本机草稿（旧版本留下的）在服务器上没有对应记录，要 POST 而不是 PUT 一个不存在的路径。
  const isUpdate = !isLocalId(draft.value.id) && Boolean(draft.value.id)
  try {
    const saved = await request(isUpdate ? `/api/diaries/${draft.value.id}` : '/api/diaries', {
      token: auth.token,
      method: isUpdate ? 'PUT' : 'POST',
      body: JSON.stringify(diaryPayload(record)),
    })
    Object.assign(record, mapDiary(saved), { mine: true })
    index = diaries.value.findIndex((item) => item.id === record.id)
  } catch (error) { return notify(`日记未保存：${error.message}`) }
  if (index >= 0) diaries.value[index] = record
  else diaries.value.unshift(record)
  diaryDialog.value = false
  notify(index >= 0 ? '日记已保存到数据库' : '日记已写入数据库')
}
function openArticle(article) { selectedArticle.value = article }
function editArticle(article) {
  if (!requireLogin('编辑文章')) return
  if (!article.mine) return notify('这不是你自己的文章，只能阅读')
  articleDraft.value = { ...article, date: toIsoDate(article.date), tags: (article.tags || []).join('，') }; selectedArticle.value = null; articleDialog.value = true
}
function createArticle() { if (!requireLogin('写文章')) return; articleDraft.value = emptyArticleDraft(); articleDialog.value = true }
function openDiaryImport() { if (!requireLogin('导入日记')) return; picker.value?.click() }
function openGalleryPicker() { if (!requireLogin('上传照片')) return; galleryPicker.value?.click() }
function openMusicPicker() { if (!requireLogin('上传音乐')) return; musicPicker.value?.click() }
async function chooseArticleCover(event) {
  if (!requireLogin('上传封面')) { event.target.value = ''; return }
  const file = event.target.files?.[0]
  if (!file) return
  try {
    const uploaded = await uploadMedia(file, auth.token)
    const saved = await request('/api/media', { token: auth.token, method: 'POST', body: JSON.stringify({ kind: 'IMAGE', title: `${articleDraft.value.title || '文章'}封面`, objectKey: uploaded.key, contentType: uploaded.contentType, visibility: articleDraft.value.visibility || 'PUBLIC', albumName: '文章封面' }) })
    galleryItems.value.unshift({ ...mapMedia(saved), mine: true })
    articleDraft.value.image = `media:${saved.id}`
  } catch (error) { notify(`封面上传失败：${error.message}`) }
  event.target.value = ''
}
async function saveArticle() {
  if (!requireLogin('保存文章')) return
  if (!articleDraft.value.title.trim() || !articleDraft.value.content.trim()) return notify('请填写文章标题和正文')
  const record = { ...articleDraft.value, id: articleDraft.value.id || localId(), tags: String(articleDraft.value.tags || '').split(/[，,\s]+/).filter(Boolean), read: '新文章' }
  let index = articles.value.findIndex((item) => item.id === record.id)
  // 本机草稿（旧版本留下的）在服务器上没有对应记录，要 POST 而不是 PUT 一个不存在的路径。
  const isUpdate = !isLocalId(articleDraft.value.id) && Boolean(articleDraft.value.id)
  try {
    const coverId = /^media:(\d+)$/.exec(record.image || '')?.[1]
    const cover = coverId ? galleryItems.value.find((media) => String(media.id) === coverId) : null
    if (cover && cover.mine && cover.visibility !== record.visibility) {
      const updatedCover = await request(`/api/media/${cover.id}`, { token: auth.token, method: 'PUT', body: JSON.stringify({ visibility: record.visibility, title: cover.caption, albumName: cover.albumName }) })
      Object.assign(cover, mapMedia(updatedCover))
    }
    const saved = await request(isUpdate ? `/api/articles/${articleDraft.value.id}` : '/api/articles', {
      token: auth.token, method: isUpdate ? 'PUT' : 'POST', body: JSON.stringify(articlePayload(record)),
    })
    Object.assign(record, mapArticle(saved), { mine: true })
    index = articles.value.findIndex((item) => item.id === record.id)
  } catch (error) { return notify(`文章未保存：${error.message}`) }
  if (index >= 0) articles.value[index] = record
  else articles.value.unshift(record)
  articleDialog.value = false
  notify(index >= 0 ? '文章已保存到数据库' : '文章已发布到数据库')
}
async function removeArticle(id) {
  const article = articles.value.find((item) => item.id === id)
  if (!article?.mine) return notify('这不是你自己的文章，只能阅读')
  if (!isLocalId(id)) {
    try { await request(`/api/articles/${id}`, { token: auth.token, method: 'DELETE' }) }
    catch (error) { return notify(`文章未删除：${error.message}`) }
  }
  articles.value = articles.value.filter((item) => item.id !== id)
  selectedArticle.value = null
  notify('文章已删除')
}
function saveMessage() {
  if (!messageDraft.value.name.trim() || !messageDraft.value.content.trim()) return notify('请填写昵称和留言内容')
  messages.value.unshift({ ...messageDraft.value, id: Date.now(), date: new Date().toISOString().slice(0, 10) })
  messageDraft.value = { name: '', content: '' }
  notify('留言已添加到预览')
}
function persistDefaultVisibility() { localStorage.setItem('weiwei-blog-default-visibility', defaultVisibility.value) }
function toggleSiteVisibility() {
  siteVisibility.value = siteVisibility.value === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
  localStorage.setItem('weiwei-blog-site-visibility', siteVisibility.value)
  notify(siteVisibility.value === 'PUBLIC' ? '博客首页已设为公开' : '博客首页已设为仅自己可见')
}
function addFriend() {
  if (!friendDraft.value.name.trim() || !friendDraft.value.url.trim()) return notify('请填写网站名称和地址')
  friendLinks.value.unshift({ ...friendDraft.value })
  friendDraft.value = { name: '', url: '', note: '' }
  notify('友链已添加到预览')
}
// Only report success once the account is really usable. `restoreSession` clears the token when
// /api/account/me fails, so on failure this must say so instead of navigating as if signed in.
async function authenticate() {
  auth.error = ''
  try {
    const user = authMode.value === 'login'
      ? await auth.login(authForm.value.email, authForm.value.password)
      : await auth.register(authForm.value.email, authForm.value.password, authForm.value.displayName)
    const profile = await auth.restoreSession()
    if (!profile) return notify('账号已登录，但无法读取账号资料，请稍后重试')
    profileName.value = profile.displayName || user.displayName
    profileBio.value = profile.bio || ''
    profileAvatar.value = profile.avatarUrl || ''
    await Promise.all([refreshDiaries(), refreshArticles(), refreshMedia()])
    go('admin')
    notify('账号验证成功')
  } catch { /* auth.error already carries the reason and is shown in the form. */ }
}
// ------------------------------------------------------------------ 歌词解析
/** 把解析到的歌词写回数据库。访客不会走到这里，只有登录的曲目所有者会。 */
async function persistTrackLyrics(item, lrc, source) {
  if (!isStoredMedia(item) || !auth.isLoggedIn) return false
  try {
    await request(`/api/media/${item.id}`, {
      token: auth.token,
      method: 'PUT',
      body: JSON.stringify({ lyrics: lrc, lyricsSource: source }),
    })
    Object.assign(item, { lyrics: lrc, lyricsSource: source })
    return true
  } catch (error) {
    setLyricJob(item.id, { saveError: error.message })
    return false
  }
}

/**
 * 解析一首歌的歌词。上传时调用，也用于给老曲目补歌词、以及在音乐页点「重新匹配」。
 *
 * 顺序在 services/lyrics.js 里：已保存的 → 文件内嵌标签 → LRCLIB → 中文源。
 * `force` 会跳过第一步，用于「我已经有歌词了，但想重新在线匹配一次」。
 *
 * 这里**刻意不为了拿时长去探测音频**。之前有个 probeDuration：另建一个 <audio>、把同一个
 * 文件按 metadata 再下载一遍，只为了给 LRCLIB 的精确匹配补一个 duration 字段。代价完全
 * 不成比例——那等于在用户播放的时候再抢一份同一文件的下载与解码，是"播一下卡一下"的直接来源。
 * 现在时长只取播放器已经读到的值（有就传、没有就不传），匹配退到搜索路径，精度略降而已。
 */
async function resolveTrackLyrics(item, { force = false, announce = false } = {}) {
  if (!item) return null
  const id = item.id
  setLyricJob(id, { status: 'parsing', source: '', error: '', saveError: '' })
  try {
    const duration = id === activeTrackId.value ? trackDuration.value : 0
    const source = force ? { ...item, lyrics: '' } : item
    const result = await resolveLyrics(source, { proxyUrl: LYRICS_PROXY, duration })
    if (result?.lrc) {
      Object.assign(item, { lyrics: result.lrc, lyricsSource: result.source })
      setLyricJob(id, { status: 'ready', source: result.source })
      // 正在播的就是这首歌 → 立刻把歌词交给右侧歌词栏，不用再等。
      if (id === activeTrackId.value) {
        lyricsLrc.value = result.lrc
        lyricsSource.value = result.source
      }
      if (result.source !== 'saved' && result.source !== 'manual') await persistTrackLyrics(item, result.lrc, result.source)
      if (announce) notify(`歌词已就绪（${LYRICS_SOURCE_LABELS[result.source] || result.source}）`)
      return result
    }
    setLyricJob(id, { status: 'none' })
    if (announce) notify('这首歌没有匹配到歌词，可以在歌词栏手动粘贴 LRC')
    return null
  } catch (error) {
    setLyricJob(id, { status: 'none', error: error.message })
    return null
  }
}

/** 给曲库里所有还没有歌词的曲子补一遍。老曲目（在这次改动之前上传的）靠它补上。 */
async function fillMissingLyrics() {
  if (!requireLogin('补全歌词')) return
  const pending = musicItems.value.filter((item) => item.mine && !item.lyrics && lyricJob(item.id)?.status !== 'parsing')
  if (!pending.length) return notify('所有曲目都已经有歌词了')
  notify(`正在为 ${pending.length} 首曲目匹配歌词…`)
  let found = 0
  for (const item of pending) {
    // 一首一首来：几首歌同时打歌词接口容易被限流，也没必要。
    const result = await resolveTrackLyrics(item)
    if (result) found += 1
  }
  notify(found ? `补全完成，新增 ${found} 首歌词` : '没有匹配到新的歌词，可以在音乐页手动粘贴')
}

/** 歌词栏里手动保存的那一份。手动内容永远覆盖自动匹配的结果。 */
async function saveLyricsFromPanel(lrc) {
  const track = currentTrack.value || localFileTrack.value
  lyricsLrc.value = lrc
  lyricsSource.value = 'manual'
  if (!track) return
  const parsed = parseLrc(lrc)
  if (!parsed.lines.some((line) => line.text)) return notify('这段歌词里没有内容')
  Object.assign(track, { lyrics: lrc, lyricsSource: 'manual' })
  setLyricJob(track.id, { status: 'ready', source: 'manual' })
  if (!isStoredMedia(track) || !auth.isLoggedIn) {
    notify('歌词已显示；登录后会保存到账号，换设备也能看到')
    return
  }
  const saved = await persistTrackLyrics(track, lrc, 'manual')
  notify(saved ? '歌词已保存到账号' : '歌词已显示，但没能保存到账号')
}

/** 音乐页歌词栏的「重新匹配」。跳过已保存的那一份，重新走内嵌 + 在线。 */
async function rematchLyrics() {
  const track = currentTrack.value || localFileTrack.value
  if (!track) return notify('请先选择一首曲目')
  notify('正在重新匹配歌词…')
  await resolveTrackLyrics(track, { force: true, announce: true })
}

// ------------------------------------------------------------------ 后台导入
/**
 * 上传 + 入库 + 解析歌词，全程在后台跑。
 *
 * 这里刻意不弹模态框：上传和在线匹配都可能花上十几秒，把用户按在一个不能关的窗口前面
 * 是没必要的。进度改由左下角的任务卡显示，关掉卡片任务照跑；跑完自动收起（出错则留着，
 * 等你看到为止）。
 */
async function addMusic(event) {
  if (!requireLogin('上传音乐')) { event.target.value = ''; return }
  const file = event.target.files?.[0]
  if (musicPicker.value) musicPicker.value.value = ''
  if (!file) return
  const item = { id: Date.now(), name: file.name, file, src: URL.createObjectURL(file), visibility: 'PRIVATE', key: '' }
  const job = addUploadJob(file.name)

  // 上传要占带宽，流式播放也要占带宽，两个一起走谁都走不动——实测过：播放中上传，
  // 进度会一直卡在"上传中"。所以先把播放停掉，让上传独占，传完再接着放。
  const resumeAfterUpload = playing.value
  if (resumeAfterUpload) {
    audioElement.value?.pause()
    remoteAudioElement.value?.pause()
    playing.value = false
    notify('上传期间已暂停播放，传完会继续')
  } else {
    notify('已开始后台导入，解析好歌词会告诉你')
  }

  try {
    const uploaded = await uploadMedia(file, auth.token)
    patchUploadJob(job, { step: 'saving', message: '正在写入音乐库…' })
    const saved = await request('/api/media', { token: auth.token, method: 'POST', body: JSON.stringify({ kind: 'MUSIC', title: file.name, objectKey: uploaded.key, contentType: uploaded.contentType, visibility: 'PRIVATE', albumName: '我的音乐' }) })
    Object.assign(item, mapMedia(saved), { mine: true, file }); item.name = saved.title
  } catch (error) {
    adminUploadMessage.value = error.message
    patchUploadJob(job, { step: 'error', message: `音乐未保存：${error.message}` })
    return
  } finally {
    if (resumeAfterUpload) resumePlayback()
  }

  musicItems.value.unshift(item)
  patchUploadJob(job, {
    step: 'lyrics',
    trackId: item.id,
    message: '正在解析歌词：先读音频文件里的内嵌标签，没有就去在线歌词库匹配…',
  })
  const result = await resolveTrackLyrics(item)
  const lyricState = lyricJob(item.id) || {}
  patchUploadJob(job, {
    step: 'done',
    trackId: item.id,
    hasLyrics: Boolean(result?.lrc),
    message: result?.lrc
      ? `歌词已就绪（${LYRICS_SOURCE_LABELS[result.source] || result.source}）${lyricState.saveError ? '，但没能保存到账号' : '，已存进音乐库'}`
      : '这首歌没有匹配到歌词，可以到音乐页手动粘贴 LRC。',
  })
  // 成功就自己收起来，别一直占着；失败的那张留着。
  setTimeout(() => dismissUploadJob(job.id), 9000)
}

/**
 * 把播放器/歌词那一块滚进视野。
 *
 * 曲库列表在页面下方，从那里点播之后，播放器和歌词其实在上面——不滚一下就得自己往上找。
 * 已经在视野里就不动，免得把用户正在看的东西顶走。
 */
function revealPlayerPanel() {
  if (currentPage.value !== 'music') return
  const panel = document.querySelector('.music-console')
  if (!panel) return
  const rect = panel.getBoundingClientRect()
  const viewport = window.innerHeight || document.documentElement.clientHeight
  // 已经露出大半就不动。
  if (rect.top >= 0 && rect.top < viewport * 0.55) return
  // 顶部有吸顶导航，留出它的高度。
  const navOffset = 96
  window.scrollTo({ top: Math.max(0, rect.top + window.scrollY - navOffset), behavior: 'smooth' })
}

/**
 * 让歌词栏的高度跟着播放器栏走。
 *
 * 歌词栏的滚动区是 `overflow:auto`，它**不会**限制自身高度——于是面板的自然高度会随着
 * 歌词行数一起长，把整块 console 顶高，播放器栏也跟着被拉伸。这就是"歌词一加载出来
 * 整个变长了"的原因。
 *
 * 这里量出播放器栏的自然高度写进 CSS 变量，歌词栏用这个高度：
 * 两块严格等高，而且歌词再多也不会把页面撑长。
 */
function syncConsoleHeight() {
  if (currentPage.value !== 'music') return
  const consoleEl = document.querySelector('.music-console')
  const player = consoleEl?.querySelector('.music-player-panel')
  if (!consoleEl || !player) return
  // 先撤掉约束再量，否则量到的是上一次的结果。
  consoleEl.style.removeProperty('--console-h')
  const height = player.offsetHeight
  if (height > 0) consoleEl.style.setProperty('--console-h', `${height}px`)
}

/** 暂停之后把刚才那首接着放（上传等占用带宽的操作结束后调用）。 */
function resumePlayback() {
  const audio = activeAudio()
  if (!audio || !audio.src || !audio.paused) return
  audio.play().then(() => { playing.value = true }).catch(() => {})
}

async function playMusicItem(item) {
  musicName.value = item.name
  activeTrackId.value = item.id
  // 从下面的曲库点播时，播放器/歌词那一块在上面，不滚一下就得自己去找。
  revealPlayerPanel()
  // 标题换了，播放器栏的高度可能跟着变，重新对一次高度。
  nextTick(syncConsoleHeight)
  localFileTrack.value = null
  currentTime.value = 0
  trackDuration.value = 0
  // 歌词先立刻换上这首歌已经有的那一份（上传时就解析过），页面不会空白一下再跳出来。
  lyricsLrc.value = item.lyrics || ''
  lyricsSource.value = item.lyricsSource || ''
  // 老曲目（这次改动之前上传的）没有存过歌词，这时才现去解析一次。
  // 已经解析过的、或者刚刚解析失败的，不再重复打网络。
  const job = lyricJob(item.id)
  if (!lyricsLrc.value && job?.status !== 'none') {
    // 推到 1.2 秒之后再开始：让播放器先把音频拉起来、进入播放状态，别在起播的那一瞬
    // 和它抢 CPU 和带宽。
    setTimeout(() => {
      if (activeTrackId.value === item.id && !lyricsLrc.value) resolveTrackLyrics(item)
    }, 1200)
  }
  if (item.kind === 'MUSIC_URL') {
    activeRemoteAudio.value = true
    audioElement.value?.pause()
    const remote = remoteAudioElement.value
    // 外链音频不加 crossorigin，浏览器因此不允许 Web Audio 读取它；粒子会退化为缓慢呼吸，
    // 而不是伪造频谱。上传到对象存储或本机选择的音频走真实 analyser。
    if (remote) { remote.src = item.src; remote.load(); remote.play().then(() => { playing.value = true }).catch(() => notify('这条链接无法播放，请使用可直接播放的 MP3、M4A、OGG 或 WAV 地址')) }
    analyser.value = null
    return
  }
  activeRemoteAudio.value = false
  remoteAudioElement.value?.pause()
  const audio = audioElement.value
  if (!audio) return
  audio.pause()

  // item.src 不一定是可以直接播的地址：签名失败时 API 会把它退化成对象键（users/…）。
  // 那是相对路径，交给 <audio> 只会 404。这种时候必须去换一次短期链接。
  let source = isDirectAudioUrl(item.src) ? item.src : ''
  if (!source && item.key) {
    try {
      const target = await request('/api/storage/presign-download', { token: auth.token, method: 'POST', body: JSON.stringify({ key: item.key }) })
      source = isDirectAudioUrl(target?.url) ? target.url : ''
    } catch (error) {
      adminUploadMessage.value = error.message
      return skipAfterFailure('无法获取这首音乐')
    }
  }
  if (activeTrackId.value !== item.id) return
  const localUrl = localSourceFor(item)
  if (!localUrl && !source) {
    // 既没有本地源、也换不到链接：跳过这一首，别把队列停在这里。
    return skipAfterFailure('这首音乐没有可播放的地址')
  }
  const target = localUrl || source
  // 用本地源时把在线地址留在 dataset 上，万一本地那份坏了 @error 能切回去。
  audio.dataset.fallback = localUrl && source ? source : ''
  if (audio.getAttribute('src') === target) {
    // 页面打开时已经预缓冲过这一首了。**这里绝不能再 load()** —— 那会把已经缓冲好的
    // 数据整段丢掉、从头再来一遍，预缓冲就白做了。直接播即可。
    preloadedTrackId = item.id
    toggleMusic()
    return
  }
  audio.src = target
  audio.load()
  toggleMusic()
}

/**
 * 音频播放失败时的兜底：如果手上还有在线地址，就切回去重试一次。
 * 没有这条，本地缓存一旦出问题就是"完全没声"，而且看不出原因。
 */
function onAudioError() {
  const audio = audioElement.value
  if (!audio) return
  const fallback = audio.dataset.fallback
  if (fallback) {
    delete audio.dataset.fallback
    notify('这段音频没能播放，已改回在线播放')
    audio.src = fallback
    audio.load()
    audio.play().then(() => { consecutiveFailures = 0 }).catch(() => skipAfterFailure('这首音乐暂时无法播放'))
    return
  }
  // 没有可退的地址：跳过这一首，别让队列停在一个播不出来的条目上。
  skipAfterFailure('这首音乐暂时无法播放')
}
// ---- 播放进度与切歌 -------------------------------------------------------
function activeAudio() { return activeRemoteAudio.value ? remoteAudioElement.value : audioElement.value }
function onTimeUpdate() {
  const audio = activeAudio()
  if (!audio) return
  currentTime.value = audio.currentTime || 0
  if (Number.isFinite(audio.duration) && audio.duration > 0) trackDuration.value = audio.duration
}
function onLoadedMetadata() {
  const audio = activeAudio()
  if (audio && Number.isFinite(audio.duration) && audio.duration > 0) trackDuration.value = audio.duration
}
function seekTo(event) {
  const audio = activeAudio()
  if (!audio || !trackDuration.value) return
  const rect = event.currentTarget.getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  audio.currentTime = ratio * trackDuration.value
  currentTime.value = audio.currentTime
}
/** 直接按秒跳转：歌词点某一句、侧边栏进度条都用它。 */
function seekToTime(seconds) {
  const audio = activeAudio()
  if (!audio || !Number.isFinite(seconds)) return
  const limit = trackDuration.value || audio.duration || 0
  audio.currentTime = limit > 0 ? Math.min(Math.max(0, seconds), limit) : Math.max(0, seconds)
  currentTime.value = audio.currentTime
}
function playOffset(step) {
  // 在"能播的曲目"里走，而不是整个列表——列表里可能混着放不出来的条目，
  // 切到它就会停在那儿，看起来就是"卡住了不往下走"。
  const list = playableTracks.value
  if (!list.length) return
  const index = list.findIndex((track) => track.id === activeTrackId.value)
  const next = index < 0 ? 0 : (index + step + list.length) % list.length
  playMusicItem(list[next])
}

/** 播放失败之后自动跳到下一首，别让整个队列停在一个播不出来的条目上。 */
let consecutiveFailures = 0
function skipAfterFailure(reason) {
  if (consecutiveFailures >= 3) return notify(reason)
  consecutiveFailures += 1
  if (playableTracks.value.length > 1) {
    notify(`${reason}，已跳到下一首`)
    playOffset(1)
  } else {
    notify(reason)
  }
}
function formatTime(value) {
  if (!Number.isFinite(value) || value <= 0) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
function addRemoteMusic() {
  if (!requireLogin('添加在线音乐')) return
  let url
  try { url = new URL(remoteMusicUrl.value) } catch { return notify('请输入有效的 HTTPS 音乐地址') }
  if (url.protocol !== 'https:') return notify('公网音乐地址需要使用 HTTPS')
  const item = { id: Date.now(), name: decodeURIComponent(url.pathname.split('/').pop() || '在线音乐'), src: url.href, visibility: 'PUBLIC', kind: 'MUSIC_URL', key: url.href }
  remoteMusicUrl.value = ''
  request('/api/media', { token: auth.token, method: 'POST', body: JSON.stringify({ kind: 'MUSIC_URL', title: item.name, objectKey: url.href, contentType: 'audio/url', visibility: 'PUBLIC', albumName: '在线音乐' }) })
    .then(async (raw) => {
      const saved = mapMedia(raw)
      const track = { ...item, ...saved, mine: true, name: saved.name || item.name, src: saved.src || item.src }
      musicItems.value.unshift(track)
      // 外链没有文件可以读内嵌标签，但曲名 + 时长照样能拿去做在线匹配。
      notify('在线音乐已保存，正在解析歌词…')
      await resolveTrackLyrics(track, { announce: true })
    })
    .catch((error) => notify(`在线音乐未保存：${error.message}`))
}
function editMusic(item) {
  if (!item.mine) return notify('这不是你自己的曲目，只能播放')
  musicEditor.value = item; musicDraft.value = { title: item.name, visibility: item.visibility }
}
async function saveMusicEdit() {
  const item = musicEditor.value
  if (!item || !musicDraft.value.title.trim()) return notify('请填写曲目名称')
  if (!item.mine) return notify('这不是你自己的曲目，只能播放')
  if (isStoredMedia(item)) {
    try {
      const saved = await request(`/api/media/${item.id}`, { token: auth.token, method: 'PUT', body: JSON.stringify({ title: musicDraft.value.title.trim(), visibility: musicDraft.value.visibility }) })
      Object.assign(item, mapMedia(saved)); item.name = saved.title
    } catch (error) { return notify(`曲目信息未保存：${error.message}`) }
  } else Object.assign(item, { name: musicDraft.value.title.trim(), visibility: musicDraft.value.visibility })
  musicEditor.value = null
  notify('曲目信息已保存')
}
async function deleteMusic(item) {
  if (!item.mine) return notify('这不是你自己的曲目，只能播放')
  if (!window.confirm(`确定从音乐库删除“${item.name}”吗？`)) return
  if (isStoredMedia(item)) {
    try { await request(`/api/media/${item.id}`, { token: auth.token, method: 'DELETE' }) }
    catch (error) { return notify(`曲目未删除：${error.message}`) }
  }
  if (musicName.value === item.name) { audioElement.value?.pause(); remoteAudioElement.value?.pause(); playing.value = false }
  if (item.id === activeTrackId.value) { lyricsLrc.value = ''; lyricsSource.value = '' }
  musicItems.value = musicItems.value.filter((track) => track.id !== item.id)
  notify('曲目已删除')
}
async function deleteDiary(id) {
  if (!requireLogin('删除日记')) return
  if (!isLocalId(id)) {
    try { await request(`/api/diaries/${id}`, { token: auth.token, method: 'DELETE' }) }
    catch (error) { return notify(`删除失败：${error.message}`) }
  }
  diaries.value = diaries.value.filter((entry) => entry.id !== id)
  selectedDiary.value = null
  notify('日记已删除')
}
function exportDiary(entry) {
  const text = `${entry.title}\n${entry.date} · ${entry.weather} ${entry.mood}\n\n${entry.content}\n`
  downloadText(text, `${entry.date}-${entry.title}.txt`)
}
function exportAll() {
  const text = diaries.value.map((entry) => `${entry.title}\n${entry.date} · ${entry.weather} ${entry.mood}\n标签：${(entry.tags || []).join('、')}\n\n${entry.content}`).join('\n\n------------------------------\n\n')
  downloadText(text, '唯唯的日记合集.txt')
}
function downloadText(text, name) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  link.href = url
  link.download = name
  link.click()
  // Revoking in the same task can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000)
  notify('已导出 TXT 文件')
}
async function readDiaryFiles(event) {
  if (!requireLogin('导入日记')) { event.target.value = ''; return }
  const files = Array.from(event.target.files || [])
  const parsed = []
  for (const file of files) {
    try {
      const extension = file.name.toLowerCase().split('.').pop()
      let content = ''
      if (extension === 'txt') content = await file.text()
      else if (extension === 'docx') {
        const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
        content = result.value
      } else { notify(`已跳过不支持的文件：${file.name}`); continue }
      const lines = content.split(/\r?\n/)
      const title = lines.shift()?.trim() || file.name.replace(/\.(txt|docx)$/i, '')
      parsed.push({ id: localId(), title, date: new Date().toISOString().slice(0, 10), weather: '☀️', mood: '平静', tags: ['导入'], content: lines.join('\n').trim() || content.trim(), source: file.name })
    } catch (error) { notify(`无法读取 ${file.name}：${error.message}`) }
  }
  event.target.value = ''
  if (!parsed.length) return notify('没有读到内容。请选择 TXT 或 DOCX 格式的日记文件')
  importReview.value = parsed
  importDialog.value = true
}
async function confirmImport() {
  const drafts = importReview.value
  if (!drafts.length) return
  if (!requireLogin('导入日记')) return
  // allSettled, not all: one rejected file must not hide the ones the server already accepted,
  // otherwise retrying the dialog would insert duplicates of them.
  const results = await Promise.allSettled(drafts.map((entry) => request('/api/diaries', {
    token: auth.token, method: 'POST', body: JSON.stringify(diaryPayload(entry)),
  })))
  const saved = results.filter((result) => result.status === 'fulfilled').map((result) => ({ ...mapDiary(result.value), mine: true }))
  const failed = results.filter((result) => result.status === 'rejected')
  // Keep whatever the server refused so the user can retry it instead of losing it.
  importReview.value = drafts.filter((entry, index) => results[index].status === 'rejected')
  diaries.value = [...saved, ...diaries.value]
  if (failed.length) return notify(`已导入 ${saved.length} 篇，${failed.length} 篇失败：${failed[0].reason?.message || ''}`)
  importDialog.value = false
  notify(`已导入 ${drafts.length} 篇日记`)
}
function chooseMusic(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  activeRemoteAudio.value = false
  remoteAudioElement.value?.pause()
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  audioUrl.value = URL.createObjectURL(file)
  musicName.value = file.name
  playing.value = false
  // 一次性选择的本机文件不属于列表曲目，清空高亮以免指错行。
  activeTrackId.value = null
  currentTime.value = 0
  trackDuration.value = 0
  if (audioElement.value) {
    audioElement.value.src = audioUrl.value
    audioElement.value.load()
  }
  // 本机试听的文件不在曲库里，也就不进上传流水线；但它的内嵌歌词/在线匹配照常做，
  // 放在 localFileTrack 上，歌词栏照样能显示。
  localFileTrack.value = { id: `local-${Date.now()}`, name: file.name, file, src: audioUrl.value, local: true }
  lyricsLrc.value = ''
  lyricsSource.value = ''
  resolveTrackLyrics(localFileTrack.value, { announce: true })
}
// The Web Audio graph for the local <audio> element is built exactly once. A media element may be
// connected to only one MediaElementAudioSourceNode: building it again throws InvalidStateError and
// silently kills every later local track, which is what happened after playing an online track.
let audioGraph = null
function ensureAnalyser(audio) {
  // 省电模式：完全不建音频图，音频走浏览器原生通路（最稳的一条路）。
  if (lowPower.value) { analyser.value = null; return }
  if (audioGraph) { analyser.value = audioGraph.meter; audioGraph.context.resume().catch(() => {}); return }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return
  try {
    const context = new AudioContextClass()
    const source = context.createMediaElementSource(audio)
    const meter = context.createAnalyser()
    // fftSize 决定 frequencyBinCount（这里 = 512 个频点）。
    // 原来设成 128，也就是只有 64 个频点，而柱子上限有 44 根——平均每根柱子摊到一个频点，
    // 每根柱子都在跟着单个频点的抖动乱跳，所以看起来"波动太大、没有效果"。
    // 512 个频点下每根柱子摊到十几个频点取平均，读数才是稳的。
    meter.fftSize = 1024
    // 时间平滑：0.86 比默认的 0.8 更稳，快节奏段落也不会闪成一片。
    meter.smoothingTimeConstant = 0.86
    source.connect(meter)
    meter.connect(context.destination)
    audioGraph = { context, meter }
    analyser.value = meter
    context.resume().catch(() => {})
  } catch { /* The visualiser is optional; playback must still work without it. */ }
}
async function toggleMusic() {
  // 还没有选过曲目时，播放键就应该是"放队列里的第一首"——而不是弹一句提示什么都不做。
  if (!currentTrack.value && !localFileTrack.value && !audioUrl.value) {
    const first = playableTracks.value[0]
    if (!first) return notify('音乐库还是空的，先上传一首吧')
    return playMusicItem(first)
  }
  const audio = activeRemoteAudio.value ? remoteAudioElement.value : audioElement.value
  if (!audio) return
  if (!audio.src) {
    // 选过，但源还没就绪（例如刚被删掉）——退回放第一首，别让播放键失灵。
    const first = playableTracks.value[0]
    if (first) return playMusicItem(first)
    return notify('请先从列表选择一首音乐')
  }
  // Online tracks are not routed through the analyser, so clear it — the graph is reused, not rebuilt.
  if (activeRemoteAudio.value) analyser.value = null
  else ensureAnalyser(audio)
  if (audio.paused) {
    try {
      await audio.play()
      playing.value = true
      consecutiveFailures = 0
    } catch (error) {
      // 以前这里是空的 catch + 一句"浏览器暂不允许播放"：于是**任何**失败都被报成自动播放被拦，
      // 包括被新的加载打断的 AbortError、以及根本解不出来的源。按名字分开处理才说得清。
      const name = error?.name || ''
      if (name === 'AbortError') return
      if (name === 'NotAllowedError') return notify('浏览器阻止了自动播放，再点一次播放键即可')
      skipAfterFailure('这首音乐暂时无法播放')
    }
  } else {
    audio.pause()
    playing.value = false
  }
}
function setVolume() {
  if (audioElement.value) audioElement.value.volume = volume.value / 100
  if (remoteAudioElement.value) remoteAudioElement.value.volume = volume.value / 100
}
watch(volume, setVolume, { immediate: true })
async function saveProfile() {
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
    const profile = await request('/api/account/me', { token: auth.token, method: 'PUT', body: JSON.stringify({ displayName: profileName.value.trim(), bio: profileBio.value, avatarUrl }) })
    auth.user = profile
    profileName.value = profile.displayName
    profileDialog.value = false
    return notify('个人资料已保存到数据库')
  } catch (error) { return notify(`资料未保存：${error.message}`) }
}
function openProfileEditor() { if (!requireLogin('编辑个人资料')) return; profileDialog.value = true }
async function chooseAvatar(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!requireLogin('上传头像')) { event.target.value = ''; return }
  try {
    const uploaded = await uploadMedia(file, auth.token)
    const saved = await request('/api/media', { token: auth.token, method: 'POST', body: JSON.stringify({ kind: 'IMAGE', title: `${profileName.value}的头像`, objectKey: uploaded.key, contentType: uploaded.contentType, visibility: 'PUBLIC', albumName: '头像' }) })
    galleryItems.value.unshift({ ...mapMedia(saved), mine: true })
    profileAvatar.value = `media:${saved.id}`
  } catch (error) { notify(`头像上传失败：${error.message}`) }
  event.target.value = ''
}
function onAudioEnded(event) {
  // 两个 <audio> 都挂了 ended。只有当前正在用的那个才有资格触发切歌，
  // 否则另一个元素残留的 ended 会造成一次连跳两首。
  if (event?.target && event.target !== activeAudio()) return
  playing.value = false
  currentTime.value = 0
  consecutiveFailures = 0
  // 有多首就接着放下一首；只有一首就停下，免得看起来像卡住了。
  if (playableTracks.value.length > 1) playOffset(1)
}
onUnmounted(() => {
  clearTimeout(toastTimer)
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  // 本机文件的临时地址也要释放。
  for (const url of localFileUrls.values()) URL.revokeObjectURL(url)
  localFileUrls.clear()
})
</script>

<template>
  <ParticleField v-if="!isToolPage && !lowPower" :playing="playing" :analyser="analyser" :is-dark="isDark" />
  <div class="app-shell" :class="{ 'chrome-condensed': scrolled, 'tool-mode': isToolPage }">
    <aside class="sidebar" :class="{ condensed: scrolled }">
      <a class="brand" href="#/" @click.prevent="go('home')">
        <span class="brand-mark"><span></span><span></span><span></span></span>
        <span class="brand-copy"><strong>唯唯园</strong><small>WEIWEI'S LITTLE GARDEN</small></span>
      </a>
      <div class="sidebar-label">MENU <span></span></div>
      <nav class="side-nav" aria-label="主导航">
        <button v-for="item in navigation" :key="item.id" :class="['nav-item', { active: currentPage === item.id }]" @click="go(item.id)">
          <span class="nav-icon">{{ item.icon }}</span><span>{{ item.label }}</span><span v-if="item.id === 'diary' && auth.isLoggedIn" class="nav-count">{{ diaries.length }}</span><span v-if="item.id === 'music' && activeUploadCount" class="nav-count">{{ activeUploadCount }}</span><span v-if="currentPage === item.id" class="active-dot"></span>
        </button>
        <div class="nav-more">
          <button ref="moreButton" class="nav-item nav-more-trigger" :class="{ active: secondaryNavigation.some(item => item.id === currentPage) }" :aria-expanded="moreOpen" aria-haspopup="true" @click="toggleMore">
            <span class="nav-icon">⋯</span><span>更多</span><span class="nav-more-caret">{{ moreOpen ? '▴' : '▾' }}</span>
          </button>
          <Teleport to="body">
            <div v-if="moreOpen" class="nav-more-menu is-floating" :style="moreMenuStyle" role="menu">
              <button v-for="item in secondaryNavigation" :key="item.id" role="menuitem" :class="['nav-more-item', { active: currentPage === item.id }]" @click="go(item.id)">
                <span class="nav-icon">{{ item.icon }}</span><span>{{ item.label }}</span>
              </button>
            </div>
          </Teleport>
        </div>
      </nav>
      <div class="sidebar-bottom">
        <div class="mini-profile">
          <img v-if="profileAvatarSrc" :src="profileAvatarSrc" alt="头像" class="avatar-img" />
          <div v-else class="avatar">唯</div>
          <div><strong>{{ profileName }}</strong><span>记录生活的收藏家</span></div>
          <button class="edit-profile" aria-label="编辑个人资料" @click="openProfileEditor()">↗</button>
        </div>
        <div class="sidebar-note"><span class="note-star">✳</span><p>“慢一点，也没关系。”</p><small>写给每一个今天</small></div>
        <div class="copyright">© {{ new Date().getFullYear() }} {{ profileName }} · 用心记录</div>
      </div>
    </aside>

    <main class="main-area">
      <Transition name="page" mode="out-in">
      <div :key="currentPage" class="page-stage">
      <header class="topbar">
        <div class="breadcrumb"><span>我的空间</span><b>/</b><strong>{{ currentPageLabel }}</strong></div>
        <div class="top-actions"><span class="today-date">✳ &nbsp;{{ todayDisplay }}</span><button class="icon-button" :aria-label="isDark ? '切换浅色主题' : '切换深色主题'" @click="isDark = !isDark">{{ isDark ? '☼' : '☾' }}</button><button class="icon-button search-button" aria-label="搜索日记" @click="go('diary'); $nextTick(() => searchInput?.focus())">⌕</button><button class="top-avatar" @click="go(auth.isLoggedIn ? 'admin' : 'account')" :aria-label="auth.isLoggedIn ? '内容管理' : '登录账号'"><img v-if="profileAvatarSrc" :src="profileAvatarSrc" alt="" /><span v-else>唯</span></button></div>
      </header>

      <section v-if="currentPage === 'home'" class="page-content home-page">
        <div class="hero-card" v-reveal>
          <div class="hero-copy">
            <div class="eyebrow"><span class="eyebrow-line"></span> A LITTLE SPACE FOR MYSELF</div>
            <h1>把日子写成<br /><em>喜欢的样子。</em></h1>
            <p>你好，我是{{ profileName }}。这里收集生活里的小小闪光，<br class="desktop-only" />也收藏那些不想忘记的瞬间。</p>
            <div class="hero-buttons"><button class="button-primary" @click="go('diary'); openNewDiary()">写下一篇日记 <span>↗</span></button><button class="button-text" @click="go('about')">关于我 <span>→</span></button></div>
            <div class="hero-meta"><span class="meta-line"></span><span>记下第 <strong>{{ 128 + diaries.length }}</strong> 个日子</span><span class="meta-divider">·</span><span>持续记录中</span></div>
          </div>
          <div class="hero-art" aria-hidden="true">
            <div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div>
            <div class="sun-disc"></div><div class="art-label label-top">little moments</div><div class="art-label label-bottom">vol. 06 &nbsp; / &nbsp; the soft days</div>
            <div class="art-spark spark-one">✳</div><div class="art-spark spark-two">✧</div><div class="art-spark spark-three">·</div>
            <div class="art-ribbon"></div><div class="art-ribbon ribbon-two"></div>
            <div class="art-stamp"><span>W</span><small>EST. 2021</small></div>
          </div>
          <div class="hero-index"><span>01</span><i></i><span>04</span></div>
        </div>

        <div class="section-heading" v-reveal><div><div class="section-kicker">FRESHLY WRITTEN <span></span></div><h2>最近的故事</h2></div><button class="view-all" @click="go('articles')">看看所有文章 <span>↗</span></button></div>
        <div class="article-grid">
          <article v-for="(article, index) in articles.slice(0, 3)" :key="article.id" class="article-card" v-reveal="{ delay: index * 90 }" @click="openArticle(article)">
            <div class="article-image-wrap"><img v-if="articleImage(article)" :src="articleImage(article)" :alt="article.title" /><span v-else class="cover-placeholder">唯唯园</span><span class="image-index">0{{ index + 1 }}</span><span class="image-open">↗</span></div>
            <div class="article-info"><div class="article-meta"><span>{{ article.category }}</span><i>·</i><time>{{ article.date }}</time></div><h3>{{ article.title }}</h3><p>{{ article.excerpt }}</p><div class="article-footer"><span>{{ article.read }}</span><span class="read-arrow">→</span></div></div>
          </article>
        </div>

        <div class="lower-grid" v-reveal>
          <section class="diary-preview"><div class="lower-heading"><div><div class="section-kicker">{{ homeShowsOwnDiaries ? 'FROM MY DIARY' : 'FROM PUBLIC DIARIES' }} <span></span></div><h2>日记碎片</h2></div><button class="round-link" @click="go('diary')">↗</button></div>
            <button v-for="entry in homeDiaries" :key="entry.id" class="diary-row" @click="selectedDiary = entry"><span class="diary-date"><strong>{{ entry.date.slice(8) }}</strong><small>{{ entry.date.slice(0, 7).replace('-', '.') }}</small></span><span class="diary-row-copy"><strong>{{ entry.title }}</strong><small>{{ entry.content.slice(0, 44) }}{{ entry.content.length > 44 ? '…' : '' }}</small></span><span class="diary-mood">{{ entry.weather }}</span></button>
          </section>
          <section class="quote-card"><div class="quote-mark">“</div><p>生活不是等待风暴过去，<br />而是学会在雨中跳舞。</p><div class="quote-bottom"><span>— Vivian Greene</span><span class="quote-flowers">✳ &nbsp;✧</span></div><div class="quote-circle"></div></section>
        </div>
        <footer class="page-footer"><span>Made with <b>♡</b> by {{ profileName }}</span><span>把平凡的日子，慢慢过成喜欢的样子。</span></footer>
      </section>

      <section v-else-if="currentPage === 'diary'" class="page-content inner-page">
        <div class="inner-title-row" v-reveal><div><div class="section-kicker">{{ showMyDiary ? 'LITTLE MOMENTS, KEPT FOREVER' : 'LET THE LITTLE MOMENTS BE SEEN' }} <span></span></div><h1>{{ showMyDiary ? '我的日记' : '公开日记' }} <em>{{ showMyDiary ? '✳' : '◎' }}</em></h1><p>{{ showMyDiary ? '每一页，都是好好生活过的证据。' : '这里收集所有人设为公开的日记。' }}</p></div><div v-if="showMyDiary" class="diary-actions"><button class="button-secondary" @click="openDiaryImport()">⇧ &nbsp;导入日记</button><input ref="picker" type="file" accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple hidden @change="readDiaryFiles" /><button class="button-secondary" @click="exportAll">⇩ &nbsp;导出全部</button><button class="button-primary" @click="openNewDiary">＋ &nbsp;写日记</button></div><span v-else class="privacy-pill">{{ siteVisibility === 'PUBLIC' ? '◉ 博客公开' : '◌ 博客仅自己可见' }}</span></div>
        <div class="diary-toolbar"><div class="diary-filters"><button v-if="auth.isLoggedIn" :class="{ active: showMyDiary }" @click="diaryTab = 'mine'">我的日记</button><button v-if="auth.isLoggedIn" :class="{ active: !showMyDiary }" @click="diaryTab = 'public'">公开日记</button><template v-if="showMyDiary"><button v-for="scope in [{ id: 'ALL', label: '全部日记' }, { id: 'PRIVATE', label: '仅自己' }, { id: 'PUBLIC', label: '已公开' }]" :key="scope.id" :class="{ active: diaryScope === scope.id }" @click="diaryScope = scope.id">{{ scope.label }}</button></template></div><label v-if="showMyDiary" class="search-input-wrap"><span>⌕</span><input ref="searchInput" v-model="search" class="search-input" placeholder="搜索日记标题、内容或标签…" /></label><span class="diary-count">{{ showMyDiary ? filteredDiaries.length : publicDiaries.length }} 篇</span></div>
        <div v-if="showMyDiary" class="diary-list"><article v-for="entry in filteredDiaries" :key="entry.id" class="diary-card"><button class="diary-card-main" @click="selectedDiary = entry"><span class="calendar-badge"><strong>{{ entry.date.slice(8) }}</strong><small>{{ entry.date.slice(0,7).replace('-', ' / ') }}</small></span><span class="diary-card-body"><span class="diary-card-top"><b>{{ entry.title }}</b><span>{{ entry.weather }} &nbsp; {{ entry.mood }} &nbsp;·&nbsp; {{ entry.visibility === 'PUBLIC' ? '◉ 公开' : '◌ 仅自己' }}</span></span><span class="diary-excerpt">{{ entry.content }}</span><span class="tag-list"><i v-for="tag in entry.tags" :key="tag"># {{ tag }}</i></span></span><span class="diary-chevron">↗</span></button><div class="diary-card-actions"><button @click="openEditDiary(entry)">编辑</button><button @click="changeDiaryVisibility(entry)">{{ entry.visibility === 'PUBLIC' ? '设为私密' : '公开' }}</button><button @click="exportDiary(entry)">导出</button><button @click="deleteDiary(entry.id)">删除</button></div></article><div v-if="!filteredDiaries.length" class="empty-state"><span>✳</span><h3>还没有找到这篇日记</h3><p>试试别的关键词，或者写下一段新的回忆。</p><button class="button-primary" @click="openNewDiary">写日记</button></div></div>
        <div v-else class="diary-list"><article v-for="entry in publicDiaries" :key="entry.id" class="diary-card"><button class="diary-card-main" @click="selectedDiary = entry"><span class="calendar-badge"><strong>{{ entry.date.slice(8) }}</strong><small>{{ entry.date.slice(0,7).replace('-', ' / ') }}</small></span><span class="diary-card-body"><span class="diary-card-top"><b>{{ entry.title }}</b><span>{{ entry.weather }} &nbsp; {{ entry.mood }}</span></span><span class="diary-excerpt">{{ entry.content }}</span><span class="tag-list"><i v-for="tag in entry.tags" :key="tag"># {{ tag }}</i></span></span><span class="diary-chevron">↗</span></button></article><div v-if="!publicDiaries.length" class="empty-state"><span>◎</span><h3>还没有公开日记</h3><p>{{ auth.isLoggedIn ? '编辑一篇日记，把可见范围改成“公开”，就会显示在这里。' : '还没有人公开日记。' }}</p><button v-if="auth.isLoggedIn" class="button-secondary" @click="diaryTab = 'mine'">管理我的日记</button></div></div>
        <footer class="page-footer"><span>Made with <b>♡</b> by {{ profileName }}</span><span>{{ showMyDiary ? '你的故事，都值得好好珍藏。' : '把平凡的日子，慢慢过成喜欢的样子。' }}</span></footer>
      </section>

      <section v-else-if="currentPage === 'articles'" class="page-content inner-page">
        <div class="inner-title-row" v-reveal><div><div class="section-kicker">STORIES & THOUGHTS <span></span></div><h1>文章宇宙 <em>✧</em></h1><p>从灵感草稿到正式发布，慢慢构建你的内容世界。</p></div><button class="button-primary" @click="createArticle">＋ &nbsp;写文章</button></div>
        <div class="article-toolbar"><span>文章分类</span><div class="category-pills"><button :class="{ active: !categoryFilter }" @click="categoryFilter = ''">全部 <small>{{ articles.length }}</small></button><button v-for="category in categoryNames" :key="category" :class="{ active: categoryFilter === category }" @click="categoryFilter = category">{{ category }} <small>{{ articles.filter(article => article.category === category).length }}</small></button></div><input v-model="search" placeholder="搜索文章标题或正文…" aria-label="搜索文章" /></div>
        <div class="article-grid article-grid-page"><article v-for="(article,index) in visibleArticles.filter(entry => `${entry.title} ${entry.content || ''}`.toLowerCase().includes(search.toLowerCase()))" :key="article.id" class="article-card" @click="openArticle(article)"><div class="article-image-wrap"><img v-if="articleImage(article)" :src="articleImage(article)" :alt="article.title" /><span v-else class="cover-placeholder">唯唯园</span><span class="image-index">{{ String(index + 1).padStart(2, '0') }}</span><span class="image-open">阅读 ↗</span></div><div class="article-info"><div class="article-meta"><span>{{ article.category }}</span><i>·</i><time>{{ article.date }}</time></div><h3>{{ article.title }}</h3><p>{{ article.excerpt }}</p><div class="article-footer"><span>{{ (article.tags || []).slice(0, 2).map(tag => `#${tag}`).join('  ') || '文章' }}</span><span class="read-arrow">→</span></div></div></article></div>
        <div v-if="!visibleArticles.length" class="empty-state"><span>✧</span><h3>还没有内容</h3><p>创建一篇文章，开启你的创作。</p><button class="button-primary" @click="createArticle">写文章</button></div>
      </section>

      <section v-else-if="currentPage === 'categories'" class="page-content inner-page">
        <div class="inner-title-row" v-reveal><div><div class="section-kicker">A LIBRARY OF IDEAS <span></span></div><h1>文章分类 <em>◈</em></h1><p>给灵感安一个小小的家。</p></div><button class="button-primary" @click="createArticle">＋ &nbsp;写文章</button></div>
        <div class="taxonomy-grid"><button v-for="(category,index) in categoryNames" :key="category" class="taxonomy-card" @click="categoryFilter = category; go('articles')"><span class="taxonomy-number">0{{ index + 1 }}</span><span class="taxonomy-symbol">{{ ['✳','✧','◈','⌁'][index % 4] }}</span><strong>{{ category }}</strong><small>{{ articles.filter(item => item.category === category).length }} 篇故事</small><i>↗</i></button></div>
      </section>

      <section v-else-if="currentPage === 'tags'" class="page-content inner-page">
        <div class="inner-title-row" v-reveal><div><div class="section-kicker">WORDS THAT FIND THEIR WAY <span></span></div><h1>标签星图 <em>＃</em></h1><p>一点一点，把相关的灵感串起来。</p></div></div>
        <div class="tag-cloud"><button v-for="(tag,index) in tagNames" :key="tag" :style="{ '--tag-size': `${12 + (index % 4) * 3}px` }" @click="tagFilter = tag; go('articles')"># {{ tag }} <small>{{ articles.filter(item => item.tags?.includes(tag)).length }}</small></button></div>
      </section>

      <section v-else-if="currentPage === 'music'" class="page-content inner-page">
        <div class="inner-title-row" v-reveal><div><div class="section-kicker">SOUNDS FOR YOUR LITTLE WORLD <span></span></div><h1>音乐收藏 <em>♫</em></h1><p>左边播放，右边跟着唱。上传时就会把歌词解析好，粒子跟着节拍流动。</p></div><div class="music-title-actions"><button v-if="auth.isLoggedIn" class="button-secondary" @click="fillMissingLyrics">↻ &nbsp;补全歌词</button><button class="button-secondary" :class="{ 'is-on': lowPower }" :title="lowPower ? '恢复粒子与频谱动效' : '关闭粒子与频谱，音频改走原生通路（卡顿时可以试）'" @click="setLowPower(!lowPower)">{{ lowPower ? '◌ 省电模式' : '◉ 完整动效' }}</button><button class="button-primary" @click="openMusicPicker()">＋ &nbsp;添加音乐</button></div></div>


        <!-- 左播放器 / 右歌词：和主流播放器一致的分工。窄屏会自动上下堆叠。 -->
        <div class="music-console" v-reveal>
          <section class="music-player-panel" aria-label="播放器">
            <div class="music-disc">
              <!-- 唱片周围的涟漪一直存在，跟着节拍一圈圈扩散。
                   它是慢速的装饰，24fps 完全够用，没必要和主频谱抢帧。 -->
              <MusicVisualizer v-if="!lowPower" class="music-disc-ripple" mode="ripple" :analyser="analyser" :playing="playing" :is-dark="isDark" :max-fps="24" />
              <div class="music-disc-vinyl" :class="{ spinning: playing }" aria-hidden="true"><span>♫</span></div>
            </div>
            <div class="music-player-copy">
              <div class="section-kicker">NOW PLAYING <span></span></div>
              <h2>{{ nowPlayingLabel }}</h2>
              <p class="music-stage-note">
                {{ playing
                  ? (analyser ? '正在播放 · 频谱驱动背景粒子' : '正在播放 · 外链音频无法读取频谱，粒子为待机呼吸')
                  : '从下面的曲库选一首，或上传本机音乐' }}
              </p>
            </div>
            <MusicVisualizer v-if="!lowPower" class="music-stage-viz" :mode="vizMode" :analyser="analyser" :playing="playing" :is-dark="isDark" :bars="44" />
            <div v-if="!lowPower" class="music-viz-modes" role="group" aria-label="可视化模式">
              <button v-for="m in vizModes" :key="m.id" :class="{ active: vizMode === m.id }" @click="vizMode = m.id">{{ m.label }}</button>
            </div>
            <div class="music-progress" role="slider" :aria-valuenow="Math.round(progressPercent)" aria-valuemin="0" aria-valuemax="100" aria-label="播放进度" @click="seekTo">
              <div class="music-progress-fill" :style="{ width: `${progressPercent}%` }"></div>
              <span class="music-progress-knob" :style="{ left: `${progressPercent}%` }"></span>
            </div>
            <div class="music-time"><span>{{ formatTime(currentTime) }}</span><span>{{ formatTime(trackDuration) }}</span></div>
            <div class="music-controls">
              <button class="music-skip" aria-label="上一首" @click="playOffset(-1)">⏮</button>
              <button class="music-control-main" :class="{ isPlaying: playing }" aria-label="播放或暂停" @click="toggleMusic"><span v-if="playing">Ⅱ</span><span v-else>▶</span></button>
              <button class="music-skip" aria-label="下一首" @click="playOffset(1)">⏭</button>
              <label class="music-volume"><span aria-hidden="true">🔊</span><input type="range" min="0" max="100" v-model="volume" @input="setVolume" aria-label="音量" /></label>
            </div>
          </section>

          <LyricsPanel
            :parsed="lyricsParsed"
            :source="lyricsSource"
            :current-time="currentTime"
            :loading="Boolean(lyricJob((currentTrack || localFileTrack)?.id)?.status === 'parsing')"
            :can-save="auth.isLoggedIn"
            :track-name="nowPlayingLabel"
            @seek="seekToTime"
            @save="saveLyricsFromPanel"
            @rematch="rematchLyrics"
          />
        </div>

        <!-- 导入队列：上传、入库、解析歌词都在这一条条上走。放在曲库上方而不是浮在屏幕上，
             因为你就在这一页，没必要再弹一个窗口挡着自己。 -->
        <section v-if="uploadJobs.length" class="import-queue" v-reveal aria-live="polite">
          <header class="import-queue-head">
            <div>
              <div class="section-kicker">IMPORT QUEUE <span></span></div>
              <h2>导入队列 <em>{{ uploadJobs.length }}</em></h2>
            </div>
            <div class="import-queue-tools">
              <span v-if="activeUploadCount" class="import-queue-live"><i aria-hidden="true"></i>{{ activeUploadCount }} 首处理中</span>
              <button v-else class="lyrics-tool" @click="clearFinishedJobs">清空已完成</button>
            </div>
          </header>
          <div class="import-list">
            <article
              v-for="(job, index) in uploadJobs"
              :key="job.id"
              class="import-row"
              :class="[`is-${job.step}`, { 'is-indeterminate': uploadJobIndeterminate(job) }]"
            >
              <span class="import-row-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="import-row-mark" aria-hidden="true">
                <i v-if="job.step === 'done'">✓</i>
                <i v-else-if="job.step === 'error'">!</i>
                <!-- 解析歌词时动效就跑在这一行上：一排跳动的电平柱 -->
                <span v-else-if="job.step === 'lyrics'" class="import-row-eq"><i v-for="n in 4" :key="n" :style="{ '--n': n }"></i></span>
                <i v-else class="import-row-spinner"></i>
              </span>
              <span class="import-row-copy">
                <strong :title="job.name">{{ job.name }}</strong>
                <small>{{ job.message }}</small>
              </span>
              <span class="import-row-stage">{{ uploadStepLabel(job) }}</span>
              <span class="import-row-actions">
                <button v-if="job.step === 'done'" class="button-secondary import-row-play" @click="playJobTrack(job)">▶ &nbsp;播放</button>
                <button class="import-row-close" :aria-label="`从队列移除 ${job.name}`" @click="dismissUploadJob(job.id)">×</button>
              </span>
              <span class="import-row-bar" role="progressbar" :aria-valuenow="uploadJobProgress(job)" aria-valuemin="0" aria-valuemax="100">
                <i :style="{ width: `${uploadJobProgress(job)}%` }"></i>
              </span>
            </article>
          </div>
        </section>

        <div class="music-library-controls"><button class="button-primary" @click="openMusicPicker()">＋ 上传本地音乐</button><button class="button-secondary" @click="playerPicker?.click()">♫ 本机试听</button><input v-model="remoteMusicUrl" placeholder="HTTPS 音频文件直链（MP3 / M4A / OGG）" /><button class="button-secondary" @click="addRemoteMusic">加入列表</button><input ref="musicPicker" type="file" accept="audio/*" hidden @change="addMusic" /><input ref="playerPicker" type="file" accept="audio/*" hidden @change="chooseMusic" /></div>
        <div class="music-list"><article v-for="(item,index) in musicItems" :key="item.id" class="music-row" :class="{ playing: item.id === activeTrackId }"><span class="music-row-index">{{ String(index + 1).padStart(2, '0') }}</span><button class="music-row-play" :aria-label="`播放 ${item.name}`" @click="playMusicItem(item)"><span v-if="item.id === activeTrackId && playing">Ⅱ</span><span v-else>▶</span></button><span class="music-row-name"><strong>{{ item.name }}</strong><small>{{ item.visibility === 'PUBLIC' ? '公开曲目' : item.key ? '已保存到音乐库' : '本机预览' }}<template v-if="item.id === activeTrackId"> · 正在播放</template></small></span><span class="music-row-lyrics" :class="`is-${lyricJob(item.id)?.status || (item.lyrics ? 'ready' : 'idle')}`" :title="lyricJob(item.id)?.error || ''"><template v-if="lyricJob(item.id)?.status === 'parsing'"><i class="music-row-spinner" aria-hidden="true"></i>解析歌词中</template><template v-else-if="item.lyrics || lyricJob(item.id)?.status === 'ready'">✓ 有歌词</template><template v-else-if="lyricJob(item.id)?.status === 'none'">暂无歌词</template><template v-else>—</template></span><span v-if="item.id === activeTrackId" class="music-row-bars" aria-hidden="true"><i v-for="n in 4" :key="n" :style="{ '--n': n }"></i></span><button v-if="auth.isLoggedIn && item.mine && !item.lyrics" class="lyrics-fetch" title="为这首曲目匹配歌词" @click="resolveTrackLyrics(item, { force: true, announce: true })">↻ 取歌词</button><button v-if="auth.isLoggedIn && item.mine" class="privacy-toggle" @click="changeMediaVisibility(item)">{{ item.visibility === 'PUBLIC' ? '公开' : '仅自己' }}</button><button v-if="auth.isLoggedIn && item.mine" class="icon-button" title="修改曲目" @click="editMusic(item)">✎</button><button v-if="auth.isLoggedIn && item.mine" class="icon-button danger-icon" title="删除曲目" @click="deleteMusic(item)">×</button></article><div v-if="!musicItems.length" class="empty-state"><span>♫</span><h3>音乐库还是空的</h3><p>上传本地音频，或添加可直接播放的 HTTPS 音频文件地址。网页链接通常不能直接播放。</p><button class="button-primary" @click="openMusicPicker()">选择音乐文件</button></div></div>
      </section>

      <section v-else-if="currentPage === 'messages'" class="page-content inner-page">
        <div class="inner-title-row" v-reveal><div><div class="section-kicker">LEAVE A LITTLE NOTE <span></span></div><h1>留言板 <em>✉</em></h1><p>留下一句话，让这个小世界热闹一点。</p></div><span class="privacy-pill">{{ messages.length }} 条留言</span></div>
        <form class="guestbook-form" @submit.prevent="saveMessage"><input v-model="messageDraft.name" maxlength="30" placeholder="你的昵称" /><textarea v-model="messageDraft.content" maxlength="400" rows="3" placeholder="写下你的留言…"></textarea><button class="button-primary">留下这句话 ↗</button></form>
        <div class="message-list"><article v-for="(message,index) in messages" :key="message.id" class="message-card"><span class="message-avatar">{{ message.name.slice(0,1) }}</span><div><div class="message-meta"><strong>{{ message.name }}</strong><time>{{ message.date }}</time></div><p>{{ message.content }}</p></div><span class="message-index">{{ String(index + 1).padStart(2,'0') }}</span></article></div>
      </section>

      <section v-else-if="currentPage === 'friends'" class="page-content inner-page">
        <div class="inner-title-row" v-reveal><div><div class="section-kicker">GOOD PEOPLE, GOOD PLACES <span></span></div><h1>朋友们 <em>↔</em></h1><p>一些值得拜访的地方，也欢迎交换友链。</p></div></div>
        <div class="friends-grid"><a v-for="friend in friendLinks" :key="friend.name" :href="friend.url" target="_blank" rel="noopener noreferrer" class="friend-card"><span class="friend-mark">{{ friend.name.slice(0,1) }}</span><span><strong>{{ friend.name }}</strong><small>{{ friend.note }}</small></span><i>↗</i></a><form class="friend-request" @submit.prevent="addFriend"><strong>添加一个新朋友</strong><input v-model="friendDraft.name" placeholder="博客名称" required /><input v-model="friendDraft.url" placeholder="网站地址 https://…" type="url" required /><input v-model="friendDraft.note" placeholder="一句介绍" /><button class="button-secondary">添加友链 ↗</button></form></div>
      </section>

      <section v-else-if="currentPage === 'archives'" class="page-content inner-page">
        <div class="inner-title-row" v-reveal><div><div class="section-kicker">A TIMELINE OF MY DAYS <span></span></div><h1>时光归档 <em>◷</em></h1><p>走过的日子，都在这里留下了印记。</p></div><span class="privacy-pill">{{ articles.length + diaries.length }} 件记录</span></div>
        <div class="archive-timeline"><div v-for="yearMonth in [...new Set([...articles.map(item => item.date?.slice(0,7)), ...diaries.map(item => item.date?.slice(0,7).replace('-', '.'))])].sort().reverse()" :key="yearMonth" class="archive-month"><h2>{{ yearMonth }}</h2><div v-for="article in articles.filter(item => item.date?.slice(0,7) === yearMonth)" :key="`a-${article.id}`" class="archive-event" @click="openArticle(article)"><span class="archive-type">文章</span><strong>{{ article.title }}</strong><time>{{ article.date.slice(-2) }}</time></div><div v-for="entry in diaries.filter(item => item.date?.slice(0,7).replace('-', '.') === yearMonth)" :key="`d-${entry.id}`" class="archive-event" @click="selectedDiary = entry"><span class="archive-type diary-type">日记 · {{ entry.visibility === 'PUBLIC' ? '公开' : '仅自己' }}</span><strong>{{ entry.title }}</strong><time>{{ entry.date.slice(-2) }}</time></div></div></div>
      </section>

      <section v-else-if="currentPage === 'admin'" class="page-content inner-page">
        <div class="inner-title-row" v-reveal><div><div class="section-kicker">YOUR CONTENT LIBRARY</div><h1>创作管理</h1><p>{{ auth.isLoggedIn ? `账号：${auth.user.displayName} · 内容保存在云端账号里（Supabase）。看到的公开内容所有人都能看，只有你自己账号里的内容能改。` : '未登录时全站只能查看；公开内容对所有人可见，登录后才能新增和修改自己账号里的内容。' }}</p></div><button v-if="!auth.isLoggedIn" class="button-primary" @click="go('account')">登录后开始记录 ↗</button><button v-else class="button-secondary" @click="logout(); go('account')">退出账号</button></div>
        <div class="stats-grid"><article v-for="(stat, index) in [{ label: '文章', value: articles.length, note: '文章和分类' }, { label: '日记', value: diaries.length, note: '公开与私密分开管理' }, { label: '相册', value: galleryItems.length, note: '图片存储在对象存储' }, { label: '音乐', value: musicItems.length, note: '本地音频或 HTTPS 直链' }]" :key="stat.label" v-reveal="{ delay: index * 80 }"><small>{{ stat.label }}</small><strong>{{ stat.value }}</strong><span>{{ stat.note }}</span></article></div>
        <div class="admin-panels"><section class="admin-panel"><div class="admin-panel-title"><div><small>DEFAULT PRIVACY</small><h2>日记默认可见范围</h2></div></div><p>新建日记先按这个范围保存；每篇日记也可以单独修改。私密日记不会出现在公开日记列表。</p><div class="setting-row"><span><strong>新日记设置</strong><small>只影响之后新建的日记。</small></span><select v-model="defaultVisibility" @change="persistDefaultVisibility"><option value="PRIVATE">仅自己可见</option><option value="PUBLIC">公开</option></select></div><div class="setting-row"><span><strong>博客首页</strong><small>{{ siteVisibility === 'PUBLIC' ? '访客可以看到首页与公开日记' : '只有你自己可以看到公开页面' }}</small></span><button class="button-secondary" @click="toggleSiteVisibility">{{ siteVisibility === 'PUBLIC' ? '设为仅自己可见' : '设为公开' }}</button></div></section><section class="admin-panel"><div class="admin-panel-title"><div><small>QUICK CREATE</small><h2>去管理内容</h2></div><span class="admin-spark">✦</span></div><div class="quick-actions"><button @click="createArticle">＋ 写文章</button><button @click="go('diary'); openNewDiary()">＋ 写日记</button><button @click="go('gallery')">整理相册 →</button><button @click="go('music')">管理音乐 →</button><button @click="go('perf')">绩效计算器 →</button></div><p v-if="adminUploadMessage" class="error-message">{{ adminUploadMessage }}</p></section></div>
      </section>

      <section v-else-if="currentPage === 'account'" class="page-content inner-page account-page">
        <div class="account-card"><div class="account-visual"><span>唯</span><strong>你的故事<br />有自己的位置。</strong><small>WEIWEI GARDEN · MEMBER SPACE</small></div><form class="account-form" @submit.prevent="authenticate"><div class="section-kicker">{{ authMode === 'login' ? 'WELCOME BACK' : 'CREATE YOUR SPACE' }} <span></span></div><h1>{{ authMode === 'login' ? '欢迎回来' : '创建账号' }}</h1><p>登录后可以跨设备保存日记、管理公开范围和上传媒体。</p><label v-if="authMode === 'register'">昵称<input v-model="authForm.displayName" autocomplete="name" required /></label><label>邮箱<input v-model="authForm.email" type="email" autocomplete="email" required /></label><label>密码<input v-model="authForm.password" type="password" :autocomplete="authMode === 'login' ? 'current-password' : 'new-password'" :minlength="authMode === 'register' ? 10 : 1" required /><small v-if="authMode === 'register'">至少 10 个字符</small></label><p v-if="auth.error" class="error-message">{{ auth.error.includes('localhost') || auth.error.includes('fetch') ? '账号服务暂时连接不上，请检查网络后重试。' : auth.error }}</p><button class="button-primary account-submit" :disabled="auth.busy">{{ auth.busy ? '正在验证…' : authMode === 'login' ? '登录账号 ↗' : '创建账号 ↗' }}</button><button class="button-text account-switch" type="button" @click="authMode = authMode === 'login' ? 'register' : 'login'; auth.error = ''">{{ authMode === 'login' ? '还没有账号？创建一个' : '已有账号？返回登录' }}</button><small class="account-note">密码经过加密后保存。创建账号后，你可以逐篇决定哪些日记公开。</small></form></div>
      </section>

      <section v-else-if="currentPage === 'gallery'" class="page-content inner-page">
        <div class="inner-title-row" v-reveal><div><div class="section-kicker">A CAMERA ROLL OF LITTLE JOYS <span></span></div><h1>生活切片 <em>♡</em></h1><p>被光照亮的瞬间，我都悄悄收好了。</p></div><button class="button-primary" @click="openGalleryPicker()">⇧ &nbsp;添加照片</button><input ref="galleryPicker" type="file" accept="image/*" hidden @change="addPhoto" /></div>
        <div class="album-bar"><div class="album-pills"><button v-for="album in albumNames" :key="album" :class="{ active: selectedAlbum === album }" @click="selectedAlbum = album">{{ album }}</button></div><span>{{ visibleGallery.length }} 张照片</span></div><div v-if="!galleryItems.length" class="empty-state"><span>▧</span><h3>这里还没有照片</h3><p>上传照片后，可以建立相册、预览大图，并按需公开或删除。</p><button class="button-primary" @click="openGalleryPicker()">上传本地照片</button></div><div class="gallery-grid album-grid"><figure v-for="photo in visibleGallery" :key="photo.id"><button class="gallery-photo" @click="galleryPreview = photo"><img :src="photo.image" :alt="photo.caption" /></button><figcaption><span>{{ photo.caption }}</span><small>{{ photo.albumName || '日常' }} · {{ photo.date }}</small></figcaption><div v-if="auth.isLoggedIn && photo.mine" class="gallery-actions"><button @click="openMediaEditor(photo)">编辑</button><button @click="changeMediaVisibility(photo)">{{ photo.visibility === 'PUBLIC' ? '设私密' : '公开' }}</button><button class="danger-text" @click="deleteMedia(photo)">删除</button></div></figure></div>
      </section>

      <section v-else-if="currentPage === 'study'" class="page-content inner-page study-wrap">
        <StudyPlan />
      </section>

      <section v-else-if="currentPage === 'perf'" class="perf-page-slot">
        <PerfPanel />
      </section>

      <section v-else class="page-content inner-page about-page">
        <div class="about-card"><div class="about-image"><img :src="profileAvatarSrc || 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1100&q=85'" alt="清晨的光" /><span>你好，欢迎来我的小世界。</span></div><div class="about-copy"><div class="section-kicker">A NOTE ABOUT ME <span></span></div><h1>你好，我是{{ profileName }}<em>。</em></h1><p>{{ profileBio }}</p><p>我相信，每一个认真度过的日子，都值得被好好记下。于是有了这个小小的角落，放文章、照片、日记，还有那些不一定重要却舍不得忘记的事。</p><div class="about-tags"><span>☕ 慢生活</span><span>✈ 在路上</span><span>✿ 爱记录</span></div><button class="button-primary" @click="openProfileEditor()">编辑个人资料 <span>↗</span></button></div></div>
      </section>
      </div>
      </Transition>
    </main>

    <!-- 右下角的音乐盒：尺寸恒定的小卡，不展开、不模糊背景。
         窄屏时变成贴在底部标签栏上方的一条胶囊（见 style.css 的媒体查询）。 -->
    <MusicDock
      :playing="playing"
      :title="nowPlayingLabel"
      :current-time="currentTime"
      :duration="trackDuration"
      :has-track="Boolean(currentTrack || localFileTrack || audioUrl)"
      @toggle="toggleMusic"
      @prev="playOffset(-1)"
      @next="playOffset(1)"
      @seek="seekToTime"
      @open="go('music')"
    />
    <!-- preload="auto"：提前缓冲，别等播到一半才去要数据。
         waiting / stalled / error 三个事件是音频卡顿的直接证据，计数显示在音乐页上。 -->
    <audio :key="lowPower ? 'audio-lite' : 'audio-full'" ref="audioElement" crossorigin="anonymous"
      @ended="onAudioEnded($event)" @timeupdate="onTimeUpdate" @loadedmetadata="onLoadedMetadata"
      @play="playing = true" @pause="playing = false"
      @error="onAudioError" />
    <audio ref="remoteAudioElement"
      @ended="onAudioEnded($event)" @timeupdate="onTimeUpdate" @loadedmetadata="onLoadedMetadata"
      @play="playing = true" @pause="playing = false"
      @error="onAudioError" />

    <!-- 后台导入任务：上传 → 入库 → 解析歌词，全程不挡人。
         它是音乐页里的一条内联队列（不是浮层弹窗），进度和解析动效都长在各自那一行上。 -->
    <Transition name="toast"><div v-if="toast" class="toast-message">✳ &nbsp;{{ toast }}</div></Transition>
    <div v-if="diaryDialog" class="modal-backdrop" @click.self="diaryDialog = false"><section class="modal-card diary-editor"><div class="modal-top"><div><div class="section-kicker">WRITE IT DOWN <span></span></div><h2>{{ draft.id ? '改写这一页' : '写一篇日记' }}</h2></div><button class="modal-close" @click="diaryDialog = false">×</button></div><label>标题<input v-model="draft.title" maxlength="80" placeholder="给今天起个名字…" /></label><div class="form-row"><label>日期<input v-model="draft.date" type="date" /></label><label>心情<select v-model="draft.mood"><option>平静</option><option>开心</option><option>期待</option><option>疲惫</option><option>难过</option></select></label><label>天气<select v-model="draft.weather"><option>☀️</option><option>☁️</option><option>🌦</option><option>🌧</option><option>❄️</option></select></label></div><label class="visibility-field">谁可以看到这篇日记？<select v-model="draft.visibility"><option value="PRIVATE">◌ 仅自己可见</option><option value="PUBLIC">◉ 公开给访客</option></select><small>默认仅自己可见。设为公开后，访客可以阅读这篇内容。</small></label><label>标签<input v-model="draft.tags" placeholder="用逗号分隔，例如：日常，散步" /></label><label>日记内容<textarea v-model="draft.content" rows="8" placeholder="今天发生了什么？有什么想留下来的？"></textarea></label><div class="modal-actions"><span>写给未来某天的自己 ♡</span><button class="button-primary" @click="saveDiary">保存日记 &nbsp;↗</button></div></section></div>

    <div v-if="articleDialog" class="modal-backdrop" @click.self="articleDialog = false"><section class="modal-card diary-editor article-editor"><div class="modal-top"><div><div class="section-kicker">WRITE YOUR STORY <span></span></div><h2>{{ articleDraft.id ? '编辑文章' : '写一篇新文章' }}</h2></div><button class="modal-close" @click="articleDialog = false">×</button></div><label>文章标题<input v-model="articleDraft.title" maxlength="120" placeholder="给这篇文章起个名字" /></label><div class="form-row"><label>分类<input v-model="articleDraft.category" placeholder="例如：旅行、生活、阅读" /></label><label>发布日期<input v-model="articleDraft.date" type="date" /></label></div><div class="cover-upload"><img v-if="articleImage(articleDraft)" :src="articleImage(articleDraft)" alt="文章封面预览" /><div v-else class="cover-placeholder">选择一张本地图片作为封面</div><button type="button" class="button-secondary" @click="articleCoverPicker?.click()">从电脑选择封面</button><input ref="articleCoverPicker" type="file" accept="image/*" hidden @change="chooseArticleCover" /></div><label>标签<input v-model="articleDraft.tags" placeholder="多个标签用逗号隔开" /></label><label>摘要<textarea v-model="articleDraft.excerpt" rows="2" maxlength="240" placeholder="列表页显示的简短介绍"></textarea></label><label>正文<textarea v-model="articleDraft.content" rows="12" placeholder="在这里写下文章…"></textarea></label><label class="visibility-field">文章可见范围<select v-model="articleDraft.visibility"><option value="PUBLIC">公开</option><option value="PRIVATE">仅自己可见</option></select></label><div class="modal-actions"><span>保存到账号和数据库</span><button class="button-primary" @click="saveArticle">保存文章</button></div></section></div>

    <div v-if="selectedDiary" class="modal-backdrop" @click.self="selectedDiary = null"><article class="modal-card diary-reading"><div class="reading-meta">{{ selectedDiary.date }} &nbsp;·&nbsp; {{ selectedDiary.weather }} {{ selectedDiary.mood }}</div><button class="modal-close reading-close" @click="selectedDiary = null">×</button><h2>{{ selectedDiary.title }}</h2><div class="reading-tags"><span v-for="tag in selectedDiary.tags" :key="tag"># {{ tag }}</span></div><p>{{ selectedDiary.content }}</p><div class="reading-actions"><button class="button-secondary" @click="exportDiary(selectedDiary)">导出 TXT</button><button v-if="selectedDiary.mine || isLocalId(selectedDiary.id)" class="button-primary" @click="openEditDiary(selectedDiary)">编辑日记 ↗</button></div></article></div>

    <Transition name="reader"><div v-if="selectedArticle" class="modal-backdrop article-reader-backdrop" @click.self="selectedArticle = null"><article class="modal-card diary-reading article-reading"><div class="reading-toolbar"><span>{{ selectedArticle.category }} <i>·</i> {{ selectedArticle.date }}</span><button class="modal-close" @click="selectedArticle = null" aria-label="关闭阅读">×</button></div><img v-if="articleImage(selectedArticle)" class="reading-image" :src="articleImage(selectedArticle)" :alt="selectedArticle.title" /><h1>{{ selectedArticle.title }}</h1><p class="reader-excerpt">{{ selectedArticle.excerpt }}</p><div class="reading-tags"><span v-for="tag in selectedArticle.tags" :key="tag"># {{ tag }}</span></div><p class="article-body">{{ selectedArticle.content || selectedArticle.excerpt }}</p><div v-if="auth.isLoggedIn && selectedArticle.mine" class="reading-actions"><button class="button-secondary danger-text" @click="removeArticle(selectedArticle.id)">删除</button><button class="button-primary" @click="editArticle(selectedArticle)">编辑文章</button></div></article></div></Transition>

    <Transition name="reader"><div v-if="galleryPreview" class="gallery-viewer" @click.self="galleryPreview = null"><button class="viewer-close" @click="galleryPreview = null">×</button><button class="viewer-delete" v-if="auth.isLoggedIn && galleryPreview.mine" @click="deleteMedia(galleryPreview)">删除照片</button><img :src="galleryPreview.image" :alt="galleryPreview.caption" /><div class="viewer-caption"><strong>{{ galleryPreview.caption }}</strong><span>{{ galleryPreview.albumName || '日常' }} · {{ galleryPreview.date }}</span></div></div></Transition>

    <div v-if="mediaEditor" class="modal-backdrop" @click.self="mediaEditor = null"><section class="modal-card profile-editor"><div class="modal-top"><div><div class="section-kicker">PHOTO DETAILS</div><h2>编辑照片</h2></div><button class="modal-close" @click="mediaEditor = null">×</button></div><label>照片名称<input v-model="mediaDraft.title" maxlength="180" /></label><label>所属相册<input v-model="mediaDraft.albumName" maxlength="80" placeholder="例如：旅行、日常、家人" /></label><label class="visibility-field">可见范围<select v-model="mediaDraft.visibility"><option value="PRIVATE">仅自己可见</option><option value="PUBLIC">公开</option></select></label><div class="modal-actions"><span>删除照片会同时移除对象存储文件</span><button class="button-primary" @click="saveMediaEdit">保存信息</button></div></section></div>

    <div v-if="musicEditor" class="modal-backdrop" @click.self="musicEditor = null"><section class="modal-card profile-editor"><div class="modal-top"><div><div class="section-kicker">MUSIC LIBRARY</div><h2>曲目设置</h2></div><button class="modal-close" @click="musicEditor = null">×</button></div><label>曲目名称<input v-model="musicDraft.title" maxlength="180" /></label><label class="visibility-field">可见范围<select v-model="musicDraft.visibility"><option value="PRIVATE">仅自己可见</option><option value="PUBLIC">公开播放</option></select></label><div class="modal-actions"><span>更改保存到你的账号</span><button class="button-primary" @click="saveMusicEdit">保存设置</button></div></section></div>

    <div v-if="importDialog" class="modal-backdrop" @click.self="importDialog = false"><section class="modal-card import-card"><div class="modal-top"><div><div class="section-kicker">READY TO KEEP <span></span></div><h2>确认导入的日记</h2></div><button class="modal-close" @click="importDialog = false">×</button></div><p class="import-hint">已读取 {{ importReview.length }} 篇内容。你可以先检查并修改标题与正文，确认后才会保存。</p><article v-for="entry in importReview" :key="entry.id" class="import-item"><small>来自 {{ entry.source }}</small><input v-model="entry.title" aria-label="日记标题" /><textarea v-model="entry.content" rows="5" aria-label="日记内容"></textarea></article><div class="modal-actions"><span>支持 .txt 和 .docx · 可一次导入多篇</span><button class="button-primary" @click="confirmImport">确认并保存 &nbsp;↗</button></div></section></div>

    <div v-if="profileDialog" class="modal-backdrop" @click.self="profileDialog = false"><section class="modal-card profile-editor"><div class="modal-top"><div><div class="section-kicker">YOUR LITTLE SPACE <span></span></div><h2>个人资料</h2></div><button class="modal-close" @click="profileDialog = false">×</button></div><label class="avatar-upload"><img v-if="profileAvatarSrc" :src="profileAvatarSrc" alt="头像预览" /><span v-else>唯</span><span>更换头像<small>点击上传</small></span><input type="file" accept="image/*" hidden @change="chooseAvatar" /></label><label>怎么称呼你？<input v-model="profileName" maxlength="20" /></label><label>写一句自我介绍<textarea v-model="profileBio" rows="3" maxlength="160"></textarea></label><div class="modal-actions"><span>头像和资料会保存到账号数据库</span><button class="button-primary" @click="saveProfile">保存资料</button></div></section></div>
  </div>
</template>
