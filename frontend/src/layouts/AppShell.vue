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
import { useScrollChrome } from '@/app/useScrollChrome'
import ArticleEditorDialog from '@/modules/article/ArticleEditorDialog.vue'
import ArticleImportDialog from '@/modules/article/ArticleImportDialog.vue'
import ArticleReaderDialog from '@/modules/article/ArticleReaderDialog.vue'
import DiaryEditorDialog from '@/modules/diary/DiaryEditorDialog.vue'
import DiaryImportDialog from '@/modules/diary/DiaryImportDialog.vue'
import ImportProblemDialog from '@/modules/modal/ImportProblemDialog.vue'
import DiaryReaderDialog from '@/modules/diary/DiaryReaderDialog.vue'
import GalleryViewer from '@/modules/media/GalleryViewer.vue'
import AlbumManagerDialog from '@/modules/media/AlbumManagerDialog.vue'
import AlbumEditorDialog from '@/modules/media/AlbumEditorDialog.vue'
import PhotoMoveDialog from '@/modules/media/PhotoMoveDialog.vue'
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

const isDark = useDark({ initialValue: 'dark' })
provide(THEME_KEY, isDark)

const { toast } = useToast()

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

    <Transition name="toast"><div v-if="toast" class="toast-message">✳ &nbsp;{{ toast }}</div></Transition>

    <DiaryEditorDialog v-if="diaries.diaryDialog" @close="diaries.diaryDialog = false" />
    <ArticleEditorDialog v-if="articles.articleDialog" @close="articles.articleDialog = false" />

    <DiaryReaderDialog
      v-if="diaries.selectedDiary"
      :entry="diaries.selectedDiary"
      @close="diaries.selectedDiary = null"
      @edit="diaries.openEdit"
      @export="diaries.exportOne"
    />

    <ArticleReaderDialog
      v-if="articles.selectedArticle"
      :article="articles.selectedArticle"
      @close="articles.selectedArticle = null"
      @edit="articles.edit"
      @remove="articles.remove"
    />

    <GalleryViewer
      v-if="media.galleryPreview"
      :photo="media.galleryPreview"
      @close="media.galleryPreview = null"
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
    <ProfileEditorDialog v-if="profile.profileDialog" @close="profile.profileDialog = false" />
  </div>
</template>
