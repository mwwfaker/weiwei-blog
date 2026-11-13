<script setup>
// 应用外壳：全站一条顶栏 + 页面内容 + 常驻播放器与弹窗。
// 顶栏放在 .page-frame 之外，首页和内页才会共用同一份左右留白。
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useDark } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import { pageComponent } from '@/app/pageRegistry'
import { THEME_KEY } from '@/app/theme'
import { disposeToast, useToast } from '@/app/useToast'
import { bindRouter, currentPage, go, isToolPage, moreOpen, resolvePageName } from '@/app/usePageNav'
import { closeOverlay } from '@/app/overlayClose'
import { useScrollChrome } from '@/app/useScrollChrome'
import { dismissLogin, loginPrompt } from '@/app/useGuard'
import ArticleEditorDialog from '@/modules/article/ArticleEditorDialog.vue'
import ArticleImportDialog from '@/modules/article/ArticleImportDialog.vue'
import ArticleReaderDialog from '@/modules/article/ArticleReaderDialog.vue'
import DiaryEditorDialog from '@/modules/diary/DiaryEditorDialog.vue'
import DiaryImportDialog from '@/modules/diary/DiaryImportDialog.vue'
import ImportProblemDialog from '@/modules/modal/ImportProblemDialog.vue'
import LoginRequiredDialog from '@/modules/modal/LoginRequiredDialog.vue'
import DiaryReaderDialog from '@/modules/diary/DiaryReaderDialog.vue'
import GalleryViewer from '@/modules/media/GalleryViewer.vue'
import AlbumManagerDialog from '@/modules/media/AlbumManagerDialog.vue'
import AlbumEditorDialog from '@/modules/media/AlbumEditorDialog.vue'
import PhotoMoveDialog from '@/modules/media/PhotoMoveDialog.vue'
import PhotoOrbit from '@/modules/media/PhotoOrbit.vue'
import PhotoUploadDialog from '@/modules/media/PhotoUploadDialog.vue'
import MediaEditorDialog from '@/modules/media/MediaEditorDialog.vue'
import AudioEngine from '@/modules/music/AudioEngine.vue'
import MusicDock from '@/modules/music/MusicDock.vue'
import MusicEditorDialog from '@/modules/music/MusicEditorDialog.vue'
import ParticleField from '@/modules/particle/ParticleField.vue'
import ProfileEditorDialog from '@/modules/profile/ProfileEditorDialog.vue'
import { useArticlesStore } from '@/stores/articles'
import { useDiariesStore } from '@/stores/diaries'
import { useLibraryStore } from '@/stores/library'
import { useMediaStore } from '@/stores/media'
import { useMusicStore } from '@/stores/music'
import { useProfileStore } from '@/stores/profile'
import AppTopBar from './AppTopBar.vue'

const route = useRoute()
const router = useRouter()
bindRouter(router)

const articles = useArticlesStore()
const diaries = useDiariesStore()
const media = useMediaStore()
const music = useMusicStore()
const profile = useProfileStore()
const library = useLibraryStore()

// 默认白天主题（2026-11 站主定）。
// 存储键也换了：站点以前默认深色，浏览器里存的 `vueuse-color-scheme: dark` 其实只是
// 「当时的默认值」，不是谁的选择。沿用旧键会让所有人继续看到深色，所以换成 `weiwei-theme`，
// 老值不再被读；之后用户手动切换的选择仍然会记住。
const isDark = useDark({ initialValue: 'light', storageKey: 'weiwei-theme' })
provide(THEME_KEY, isDark)

// 主题一换，浏览器地址栏的颜色也要跟着换（index.html 里只处理了首屏那一次）。
// SSR / 渲染测试里的 document 是个残缺桩子（没有 documentElement），所以逐层判空。
watch(isDark, (dark) => {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (root && root.style) root.style.colorScheme = dark ? 'dark' : 'light'
  const meta = typeof document.querySelector === 'function' ? document.querySelector('meta[name="theme-color"]') : null
  if (meta) meta.setAttribute('content', dark ? '#05050c' : '#eef2fb')
}, { immediate: true })

const { toast } = useToast()

/** 回顶部（平滑）。`scrolled` 在滚过 130px 后为真，正好当显示条件。 */
function scrollTop() {
  if (typeof window === 'undefined') return
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ---- 详情地址 ⇄ 抽屉 -------------------------------------------------------
// 文章/日记原来是纯抽屉，地址停在列表页：不能分享、刷新就丢、后退也不是关掉它。
// 现在详情有自己的地址（#/articles/:id、#/diary/:id），两边双向同步：
//   · 地址有 id → 打开对应抽屉（刷新、分享链接、前进后退都走这条）
//   · 点了文章/日记 → push 一个详情地址（这样后退就等于关掉）
//   · 关闭按钮 → 地址换回列表
const DETAIL_ROUTES = ['articleDetail', 'diaryDetail', 'galleryDetail']

function articleById(id) {
  return articles.articles.find((item) => String(item.id) === String(id)) || null
}
function diaryById(id) {
  return [...diaries.diaries, ...diaries.publicDiaries].find((item) => String(item.id) === String(id)) || null
}
function photoById(id) {
  return media.galleryItems.find((item) => String(item.id) === String(id)) || null
}

function openFromRoute() {
  if (route.name === 'articleDetail' && !articles.selectedArticle) {
    const found = articleById(route.params.id)
    if (found) articles.selectedArticle = found
  }
  if (route.name === 'diaryDetail' && !diaries.selectedDiary) {
    const found = diaryById(route.params.id)
    if (found) diaries.openReader(found, 'right')
  }
  if (route.name === 'galleryDetail' && !media.galleryPreview) {
    const found = photoById(route.params.id)
    if (found) media.galleryPreview = found
  }
}

watch(() => route.params.id, openFromRoute, { immediate: true })
// 还要盯着路由名：刷新详情页时，params 在导航完成前就已经就位，
// 光看 params 会在「名字还没变成 detail」的那一刻空跑一次，之后再没人来补。
watch(() => route.name, () => openFromRoute(), { immediate: true })
// 访客刷新详情页时，列表可能还在路上：等列表到了再补一次。
watch(() => [articles.articles.length, diaries.diaries.length, diaries.publicDiaries.length], openFromRoute)

watch(
  () => articles.selectedArticle,
  (article) => {
    if (article && route.name !== 'articleDetail') {
      router.push({ name: 'articleDetail', params: { id: String(article.id) } })
    }
  },
)

watch(
  () => diaries.selectedDiary,
  (entry) => {
    if (entry && route.name !== 'diaryDetail') {
      router.push({ name: 'diaryDetail', params: { id: String(entry.id) } })
    }
  },
)

watch(
  () => media.galleryPreview,
  (photo) => {
    if (photo && route.name !== 'galleryDetail') {
      router.push({ name: 'galleryDetail', params: { id: String(photo.id) } })
    }
  },
)

/**
 * 返回手势也要先播完尘埃。
 *
 * 手机的侧滑/返回是直接改地址的：不拦的话路由一变，组件立刻被摘掉，
 * 于是文章、日记、大图都没有那一下「化作尘埃」的收场（站主就是这么发现的）。
 * 这里拦住「从详情回列表」的那一次导航，请组件自己关（它会播动画再 emit close），
 * 关完由 close*Reader 把地址 replace 回列表；`detailExitAllowed` 防止那次 replace 又被拦。
 */
let detailExitAllowed = false

router.beforeEach((to, from) => {
  if (!DETAIL_ROUTES.includes(from.name) || detailExitAllowed) return true
  const open = articles.selectedArticle || diaries.selectedDiary || media.galleryPreview
  if (!open) return true
  detailExitAllowed = true
  if (!closeOverlay()) detailExitAllowed = false
  return false
})

watch(
  () => route.name,
  (name) => { if (!DETAIL_ROUTES.includes(name)) detailExitAllowed = false },
)

// 离开详情（浏览器后退、或点了别的页）→ 把抽屉收掉
watch(
  () => route.name,
  (name, old) => {
    if (!DETAIL_ROUTES.includes(old) || DETAIL_ROUTES.includes(name)) return
    if (articles.selectedArticle) articles.selectedArticle = null
    if (diaries.selectedDiary) diaries.selectedDiary = null
    if (media.galleryPreview) media.galleryPreview = null
  },
)

function closeArticleReader() {
  articles.selectedArticle = null
  if (route.name === 'articleDetail') router.replace({ name: 'articles' })
}

function closeDiaryReader() {
  diaries.selectedDiary = null
  if (route.name === 'diaryDetail') router.replace({ name: 'diary' })
}

function closeGalleryViewer() {
  media.galleryPreview = null
  if (route.name === 'galleryDetail') router.replace({ name: 'gallery' })
}
// ---- 标签页标题 -------------------------------------------------------------
// 之前所有页面共用 index.html 里那一个标题：开三个标签分不清、收藏夹里也是一堆同名。
// 这里按当前页面（或打开的文章/日记）更新，改名不动任何版面。
const BASE_TITLE = '唯唯园 · 把日子写成喜欢的样子'
const PAGE_TITLES = {
  home: BASE_TITLE, about: '关于我', study: '学习', articles: '文章', diary: '日记',
  gallery: '相册', music: '音乐', messages: '留言板', admin: '创作管理',
  account: '账号', tools: '工具箱', clipboard: '快捷复制', perf: '绩效计算器', notFound: '找不到这一页',
}

watch(
  [currentPage, () => articles.selectedArticle, () => diaries.selectedDiary],
  ([page, article, diary]) => {
    if (typeof document === 'undefined') return
    const detail = article?.title || diary?.title
    if (detail) { document.title = `${detail} · 唯唯园`; return }
    const label = PAGE_TITLES[page]
    document.title = !label || label === BASE_TITLE ? BASE_TITLE : `${label} · 唯唯园`
  },
  { immediate: true },
)
const { scrolled } = useScrollChrome({
  onViewportChange: () => {
    moreOpen.value = false
    music.syncConsoleHeight()
  },
})

watch(
  () => route.name,
  (name) => resolvePageName(name, { onLegacyPublicDiary: () => { diaries.diaryTab = 'public' } }),
  { immediate: true },
)

// 换页面只做交叉淡入，不再放帘子：帘子扫过时会先闪一下底色，那一下就是「闪」的来源。
// 现在旧页绝对定位淡出、新页同时淡入，中间没有空白帧。

// 顶部一条很细的进度线：换页的 0.5 秒里走完，让「正在切」这件事有反馈。
const routing = ref(false)
let routingTimer = 0
watch(currentPage, () => {
  routing.value = false
  requestAnimationFrame(() => {
    routing.value = true
    window.clearTimeout(routingTimer)
    routingTimer = window.setTimeout(() => { routing.value = false }, 560)
  })
})

/** 首页是「一整个世界」：外壳的容器让位，但顶栏仍然常驻。 */
const homeMode = computed(() => currentPage.value === 'home')

// 主题切换：夜→昼是一片白光扩散，昼→夜是一团墨色收拢。
// 换主题时整页会重排配色，这一层幕让「换」本身有方向感。
const themeVeil = ref('')
let veilTimer = 0
watch(isDark, (dark) => {
  themeVeil.value = dark ? 'to-dark' : 'to-light'
  window.clearTimeout(veilTimer)
  veilTimer = window.setTimeout(() => { themeVeil.value = '' }, 640)
})

onMounted(async () => {
  await library.restoreSession()
  await library.refreshAll()
  requestAnimationFrame(() => music.syncConsoleHeight())
})
onUnmounted(() => {
  window.clearTimeout(routingTimer)
  window.clearTimeout(veilTimer)
  disposeToast()
})
</script>

<template>
  <ParticleField
    v-if="!isToolPage && !music.lowPower"
    :playing="music.playing"
    :analyser="music.analyser"
    :is-dark="isDark"
  />

  <div class="app-shell" :class="{ 'chrome-condensed': scrolled, 'tool-mode': isToolPage, 'home-mode': homeMode }">
    <div class="route-line" :class="{ 'is-running': routing }" aria-hidden="true"></div>
    <div class="route-sheen" :class="{ 'is-running': routing }" aria-hidden="true"></div>
    <div class="theme-veil" :class="themeVeil" aria-hidden="true"></div>
    <main class="main-area">
      <AppTopBar v-if="!isToolPage" :condensed="scrolled" />
      <div class="page-frame">
        <Transition name="page-swap">
          <div :key="currentPage" class="page-stage">
            <component :is="pageComponent(currentPage)" />
          </div>
        </Transition>
      </div>
    </main>

    <MusicDock
      :playing="music.playing"
      :title="music.nowPlayingLabel"
      :current-time="music.currentTime"
      :duration="music.trackDuration"
      :has-track="Boolean(music.currentTrack || music.localFileTrack || music.audioUrl)"
      @toggle="music.toggleMusic"
      @prev="music.playOffset(-1)"
      @next="music.playOffset(1)"
      @seek="music.seekToTime"
      @open="go('music')"
    />

    <AudioEngine />

    <!-- 回顶部：整页动辄几千像素，滑到底再回去太费劲。滚过一屏才出现。 -->
    <Transition name="to-top">
      <button v-if="scrolled" class="back-to-top" aria-label="回到顶部" @click="scrollTop">
        <span aria-hidden="true">↑</span>
      </button>
    </Transition>

    <Transition name="toast"><div v-if="toast" class="toast-message">✳ &nbsp;{{ toast }}</div></Transition>

    <DiaryEditorDialog v-if="diaries.diaryDialog" @close="diaries.diaryDialog = false" />
    <ArticleEditorDialog v-if="articles.articleDialog" @close="articles.articleDialog = false" />

    <DiaryReaderDialog
      v-if="diaries.selectedDiary"
      :entry="diaries.selectedDiary"
      @close="closeDiaryReader"
      @edit="diaries.openEdit"
      @export="diaries.exportOne"
    />

    <ArticleReaderDialog
      v-if="articles.selectedArticle"
      :article="articles.selectedArticle"
      @close="closeArticleReader"
      @edit="articles.edit"
      @remove="articles.remove"
    />

    <!-- 3D 照片墙：fixed 全屏，必须挂在外壳上（相册页的 .page-content 有 transform，
         fixed 会被框成内容区大小）。开关在 media store，相册页只负责打开它。 -->
    <PhotoOrbit
      v-if="media.galleryField"
      :photos="media.galleryItems"
      @close="media.galleryField = false"
      @preview="media.galleryPreview = $event"
    />

    <GalleryViewer
      v-if="media.galleryPreview"
      :photo="media.galleryPreview"
      @close="closeGalleryViewer"
    />

    <MediaEditorDialog v-if="media.mediaEditor" @close="media.mediaEditor = null" />
    <AlbumManagerDialog v-if="media.albumManager" @close="media.albumManager = false" />
    <AlbumEditorDialog v-if="media.albumEditor" @close="media.albumEditor = null" />
    <PhotoMoveDialog v-if="media.photoMover" @close="media.photoMover = null" />
    <PhotoUploadDialog v-if="media.uploadDialog" @close="media.closeUploadDialog()" />
    <MusicEditorDialog v-if="music.musicEditor" @close="music.musicEditor = null" />
    <DiaryImportDialog v-if="diaries.importDialog" @close="diaries.importDialog = false" />
    <ArticleImportDialog v-if="articles.importDialog" @close="articles.importDialog = false" />
    <ImportProblemDialog />
    <LoginRequiredDialog
      v-if="loginPrompt"
      :action="loginPrompt.action"
      :reason="loginPrompt.reason"
      @close="dismissLogin()"
      @login="dismissLogin(); go('account')"
    />
    <ProfileEditorDialog v-if="profile.profileDialog" @close="profile.profileDialog = false" />
  </div>
</template>
