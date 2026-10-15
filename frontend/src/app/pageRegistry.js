import { defineAsyncComponent, h } from 'vue'
import AboutPage from '@/pages/about/AboutPage.vue'
import AccountPage from '@/pages/account/AccountPage.vue'
import AdminPage from '@/pages/admin/AdminPage.vue'
import ArchivesPage from '@/pages/archives/ArchivesPage.vue'
import ArticlesPage from '@/pages/articles/ArticlesPage.vue'
import CategoriesPage from '@/pages/categories/CategoriesPage.vue'
import DiaryPage from '@/pages/diary/DiaryPage.vue'
import FriendsPage from '@/pages/friends/FriendsPage.vue'
import GalleryPage from '@/pages/gallery/GalleryPage.vue'
import HomePage from '@/pages/home/HomePage.vue'
import MessagesPage from '@/pages/messages/MessagesPage.vue'
import MusicPage from '@/pages/music/MusicPage.vue'
import TagsPage from '@/pages/tags/TagsPage.vue'

// The study plan carries ~300 kB of course data. Loading it on demand keeps that out of the bundle
// every visitor downloads; the delay means the placeholder never flashes on a warm cache.
const StudyPage = defineAsyncComponent({
  loader: () => import('@/pages/study/StudyPage.vue'),
  delay: 140,
  loadingComponent: { name: 'StudyPlanLoading', render: () => h('div', { class: 'study-loading' }, '正在展开学习路线…') },
})

// 绩效管理只在打开时加载：它带着队列配置、OCR 与公式，没必要进首屏包。
const PerfPage = defineAsyncComponent({
  loader: () => import('@/pages/perf/PerfPage.vue'),
  delay: 140,
  loadingComponent: { name: 'PerfLoading', render: () => h('div', { class: 'study-loading' }, '正在打开绩效管理…') },
})

/**
 * 页面 id → 页面组件。
 *
 * 注意这仍然是「一个外壳渲染所有页面」，没有换成 `<router-view>`：
 * 页面之间的切换动画、以及切页时保持播放器与音乐盒存活，都依赖同一棵组件树。
 * 路由表仍旧负责地址与历史（见 app/routes.js）。
 */
export const pageComponents = {
  home: HomePage,
  about: AboutPage,
  study: StudyPage,
  articles: ArticlesPage,
  categories: CategoriesPage,
  tags: TagsPage,
  diary: DiaryPage,
  gallery: GalleryPage,
  music: MusicPage,
  messages: MessagesPage,
  friends: FriendsPage,
  archives: ArchivesPage,
  admin: AdminPage,
  perf: PerfPage,
  account: AccountPage,
}

/** 未知 id 落到「关于我」——和之前 v-else 的行为一致。 */
export function pageComponent(id) {
  return pageComponents[id] || AboutPage
}
