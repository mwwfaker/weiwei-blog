<script setup>
// 应用外壳：左侧导航 + 顶栏 + 当前页面 + 常驻的播放器/弹窗/提示。
//
// 这里只做「编排」：页面内容在 pages/ 下，导航与顶栏在 layouts/ 下，可复用块在 modules/ 下，
// 状态在 stores/ 下。这个文件从 1540 行降到只剩接线，改一个页面不需要再碰它。
import { onMounted, onUnmounted, provide, watch } from 'vue'
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
import AppSidebar from './AppSidebar.vue'
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

// 主题只有外壳知道（@vueuse 的 useDark 会写 <html> 的 class 和 localStorage），
// 音乐页的频谱与粒子背景通过 inject 拿「现在是深色吗」。
const isDark = useDark({ initialValue: 'dark' })
provide(THEME_KEY, isDark)

const { toast } = useToast()

// 滚动方向决定导航是否收起；窗口尺寸变化时还要重算播放器栏的高度。
const { scrolled } = useScrollChrome({
  onViewportChange: () => {
    moreOpen.value = false
    music.syncConsoleHeight()
  },
})

// 路由 → 页面 id。老地址 #/public-diary 会被认成「日记页 · 公开标签」。
watch(
  () => route.name,
  (name) => resolvePageName(name, { onLegacyPublicDiary: () => { diaries.diaryTab = 'public' } }),
  { immediate: true },
)

onMounted(async () => {
  await library.restoreSession()
  await library.refreshAll()
  // 直接打开音乐页时也要对一次高度（store 里的 watch 只在歌词或曲目数变化时才跑）。
  requestAnimationFrame(() => music.syncConsoleHeight())
})
onUnmounted(() => disposeToast())
</script>

<template>
  <ParticleField
    v-if="!isToolPage && !music.lowPower"
    :playing="music.playing"
    :analyser="music.analyser"
    :is-dark="isDark"
  />

  <div class="app-shell" :class="{ 'chrome-condensed': scrolled, 'tool-mode': isToolPage }">
    <AppSidebar :condensed="scrolled" />

    <main class="main-area">
      <Transition name="page" mode="out-in">
        <div :key="currentPage" class="page-stage">
          <AppTopBar />
          <component :is="pageComponent(currentPage)" />
        </div>
      </Transition>
    </main>

    <!-- 右下角的音乐盒：尺寸恒定的小卡，不展开、不模糊背景。
         窄屏时变成贴在底部标签栏上方的一条胶囊（见 styles 里的媒体查询）。 -->
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

    <!-- 两个 <audio> 常驻在这里，所以切页面不会中断播放。 -->
    <AudioEngine />

    <Transition name="toast"><div v-if="toast" class="toast-message">✳ &nbsp;{{ toast }}</div></Transition>

    <!-- 跨页面共用的弹窗。它们的可见性由各自的 store 决定，所以首页、归档页、
         文章页点开的是同一份草稿，不会出现「两个编辑器各改各的」。 -->
    <DiaryEditorDialog v-if="diaries.diaryDialog" @close="diaries.diaryDialog = false" />
    <ArticleEditorDialog v-if="articles.articleDialog" @close="articles.articleDialog = false" />

    <DiaryReaderDialog
      v-if="diaries.selectedDiary"
      :entry="diaries.selectedDiary"
      @close="diaries.selectedDiary = null"
      @edit="diaries.openEdit"
      @export="diaries.exportOne"
    />

    <!-- 阅读弹窗自己播入场/退场动画（见 ReadingSheet）：外层再包 <Transition> 会打架，
         而且它会在组件被摘掉时才播 leave，等于把化灰效果盖掉。 -->
    <ArticleReaderDialog
      v-if="articles.selectedArticle"
      :article="articles.selectedArticle"
      @close="articles.selectedArticle = null"
      @edit="articles.edit"
      @remove="articles.remove"
    />

    <!-- 全屏看图自己播入场/退场（退场是「化作尘埃」的粒子层），所以这里不包 <Transition>：
         外层一包，v-if 会在动画开始前就把组件摘掉，粒子一个都来不及飞。
         它内部用的是和阅读弹窗同一份退场时序。 -->
    <GalleryViewer
      v-if="media.galleryPreview"
      :photo="media.galleryPreview"
      @close="media.galleryPreview = null"
    />

    <MediaEditorDialog v-if="media.mediaEditor" @close="media.mediaEditor = null" />
    <AlbumManagerDialog v-if="media.albumManager" @close="media.albumManager = false" />
    <MusicEditorDialog v-if="music.musicEditor" @close="music.musicEditor = null" />
    <DiaryImportDialog v-if="diaries.importDialog" @close="diaries.importDialog = false" />
    <ArticleImportDialog v-if="articles.importDialog" @close="articles.importDialog = false" />
    <!-- 文件打不开时的提示窗。它读的是全站共用的模块级状态（composables/useImportAlert.js），
         所以挂在最外层只此一处，日记与文章导入都往这同一个窗口里报。 -->
    <ImportProblemDialog />
    <ProfileEditorDialog v-if="profile.profileDialog" @close="profile.profileDialog = false" />
  </div>
</template>
