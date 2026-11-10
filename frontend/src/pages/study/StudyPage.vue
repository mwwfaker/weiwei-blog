<script setup>
// 学习板块：把《金融学系统自学路线》结构化呈现，并记录本机学习进度。
// 数据全部来自 data/studyPlan.js（由原始文档结构化而来），这里只负责呈现与交互。
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { studyPlans } from './data/studyPlans'
import { lifeChapterLoaders } from './data/lifeChunks'
import ModalShell from '@/modules/modal/ModalShell.vue'
import { readStoredJson, writeStoredJson } from '@/services/storage'
// Imported (not globally registered) so the directive is available in any app that mounts this
// component, including the render test.
import { useCountUp, vReveal } from '@/composables/motion'

const PROGRESS_KEY = 'weiwei-blog-study-progress'

// 学习库 → 计划详情。库是入口，详情是现在这股金融路线。
const view = ref('library')

function openPlan(id) {
  switchPlan(id)
  view.value = 'plan'
}

function backToLibrary() {
  view.value = 'library'
}

// 深链接：`#/study?plan=scarf` 直接打开某份计划（书签/分享用）。
// id 全部从 studyPlans 里找，加计划不用再改这里。
onMounted(() => {
  const match = /plan=([\w-]+)/.exec(window.location.hash)
  if (!match) return
  if (studyPlans.some((item) => item.id === match[1])) openPlan(match[1])
})

// ---- plan library -----------------------------------------------------------
// 学习页现在是「计划库 + 当前计划」：数据从 data/studyPlans.js 来，切换计划只换 plan 的内容，
// 不重新挂载页面。以后加一份新学习计划 = 往数组里加一项（见 data/README.md）。
const activeId = ref(studyPlans[0].id)
// 开页时只拷第一份计划的字段（applyPlan 在下面定义，这里直接用它的键表）
const plan = reactive({})
Object.assign(plan, studyPlans[0].plan)
// ---- 章节全文（「高性价比人生指南」用） -------------------------------------
// 34 章原文合计 2.3 MB，不能进主包，也不能一次全下：lifeChapterLoaders（data/lifeChunks.js）
// 把每一章变成一个独立的懒加载块，点开哪一章才取哪一章。
const openChapter = ref(null)
const chapterBusy = ref('')

// ---- 书本布局（「高性价比人生指南」） ---------------------------------------
// 那本书是 34 章、772 条，学生页把它当「课程」排版并不合适：它没有过关标准、没有实战任务，
// 就是一条条建议。所以给它一套书页排版：左边目录，右边正文，点一章取一章。
const bookChapterId = ref('')
const bookChapter = ref(null)
const bookLoading = ref(false)
const activeItem = ref(-1)
/** 书页工具条：滚过一屏才出现。 */
const showBookBar = ref(false)
const bookEl = ref(null)
const bookItemsEl = ref(null)

async function openBookChapter(chapter) {
  if (bookLoading.value || bookChapterId.value === chapter.id) return
  bookChapterId.value = chapter.id
  bookChapter.value = null
  activeItem.value = -1
  const loader = lifeChapterLoaders[chapter.id]
  if (!loader) return
  bookLoading.value = true
  try {
    bookChapter.value = (await loader()).default
    // 换章要回到这一章的开头。必须等 DOM 换完再滚，否则滚的还是上一章的高度，
    // 看起来就像「切了目录但正文还停在最下面」。
    await nextTick()
    scrollToBook()
  } finally {
    bookLoading.value = false
  }
}

/** 让书页顶端对齐视口（不是整页回到顶，封面就别再滚回去了）。 */
function scrollToBook() {
  if (typeof window === 'undefined') return
  const el = bookEl.value
  if (!el) return
  const top = el.getBoundingClientRect().top + window.scrollY - 84
  window.scrollTo({ top, behavior: 'smooth' })
}

/** 三级目录：跳到本章第 n 条。 */
function jumpToItem(index) {
  const list = bookItemsEl.value
  const node = list?.children?.[index]
  if (!node) return
  const top = node.getBoundingClientRect().top + window.scrollY - 96
  window.scrollTo({ top, behavior: 'smooth' })
  activeItem.value = index
}

/**
 * 读到第几条：靠滚动位置算，比 IntersectionObserver 稳（条目高度差很大）。
 * 只在这一章真的挂上以后才监听。
 */
function measureActiveItem() {
  const list = bookItemsEl.value
  if (!list) return
  const nodes = [...list.children]
  let current = 0
  for (let i = 0; i < nodes.length; i += 1) {
    if (nodes[i].getBoundingClientRect().top <= 130) current = i
    else break
  }
  activeItem.value = nodes.length ? current : -1
  showBookBar.value = (window.scrollY || document.documentElement.scrollTop || 0) > 520
}

let itemScrollQueued = false
function onItemScroll() {
  if (itemScrollQueued) return
  itemScrollQueued = true
  requestAnimationFrame(() => { itemScrollQueued = false; measureActiveItem() })
}

watch(bookChapter, (chapter) => {
  if (typeof window === 'undefined') return
  if (chapter) window.addEventListener('scroll', onItemScroll, { passive: true })
  else window.removeEventListener('scroll', onItemScroll)
})
onUnmounted(() => { if (typeof window !== 'undefined') window.removeEventListener('scroll', onItemScroll) })

/** 书页的三个数字：章数、条数、分几组（不套「课时 0—0」那套课程口径）。 */
const bookStats = computed(() => ({
  chapters: plan.bookChapters?.length || 0,
  items: plan.totalItems || 0,
  parts: plan.stages?.length || 0,
}))

/** 当前章在目录里的位置，用来做「上一章 / 下一章」。 */
const bookIndex = computed(() => (plan.bookChapters || []).findIndex((chapter) => chapter.id === bookChapterId.value))

function stepChapter(delta) {
  const list = plan.bookChapters || []
  const next = list[bookIndex.value + delta]
  if (next) openBookChapter(next)
}

async function readChapter(course) {
  if (!course.chapter || chapterBusy.value) return
  const loader = lifeChapterLoaders[course.chapter]
  if (!loader) return
  chapterBusy.value = course.code
  try {
    const mod = await loader()
    openChapter.value = mod.default
  } finally {
    chapterBusy.value = ''
  }
}

function progressKey() {
  return `${PROGRESS_KEY}:${activeId.value}`
}

// ---- progress（按计划分开存，换计划不会串进度） ------------------------------
function loadProgress() {
  const stored = readStoredJson(progressKey(), {})
  done.value = stored && typeof stored.done === 'object' && stored.done ? { ...stored.done } : {}
}
const done = ref({})
loadProgress()
watch(done, (value) => writeStoredJson(progressKey(), { done: value, updatedAt: new Date().toISOString() }), { deep: true })

/**
 * 换计划时**先把上一份的字段全删掉**，再整份写进去。
 *
 * 原来是 `Object.assign(plan, next.plan)`：这份计划没有的字段会原样留着上一份的，
 * 于是《学习库》里切到「高性价比人生指南」，下面还挂着金融学那份的周模板、进阶顺序、
 * totals——看起来就是两门课串在了一起。字段是页面读过的全部键，缺了就当没有（v-if 为假）。
 */
const PLAN_FIELDS = ['meta', 'howToUse', 'importanceScale', 'stages', 'courses', 'order', 'totals',
  'weeklyTemplate', 'weeklyNote', 'graduationRules', 'pythonTimeline', 'firstYearGoals', 'finalStandards',
  'resourceNotes', 'resources', 'weeks', 'afterMain', 'foundationTitle', 'bookChapters', 'totalItems']

/**
 * 每份计划都有、但内容可以为空的那几块，给一份空默认值。
 * 只靠 delete 是不够的：模板里有 `plan.finalStandards.intro` 这种直接取下一层的写法，
 * 字段缺失就会抛错，换计划时整页停在原地。
 */
const PLAN_DEFAULTS = {
  weeks: [], afterMain: [], weeklyTemplate: [], graduationRules: [], pythonTimeline: [],
  firstYearGoals: [], finalStandards: { intro: '', items: [] }, resources: [], resourceNotes: [],
  order: null, totals: null, bookChapters: [], totalItems: 0,
}

function applyPlan(next) {
  for (const key of PLAN_FIELDS) delete plan[key]
  Object.assign(plan, PLAN_DEFAULTS, next)
}

function switchPlan(id) {
  const next = studyPlans.find((item) => item.id === id)
  if (!next || id === activeId.value) return
  activeId.value = id
  applyPlan(next.plan)
  // 换计划时把书页也合上，否则会留着上一份计划某一章的正文
  bookChapterId.value = ''
  bookChapter.value = null
  activeStage.value = '全部'
  query.value = ''
  statusFilter.value = 'all'
  coreOnly.value = false
  expanded.value = {}
  loadProgress()
  // 页头四个统计是在 setup 时按当前计划算的，换计划要跟着重算，
  // 否则会一直停在上一次的数字上（29 门课 / 1200–1800 小时）。
  coursesCount.run()
  hoursLow.run()
  hoursHigh.run()
  stageTotal.run()
  resourceTotal.run()
}

const isDone = (code) => Boolean(done.value[code])
const completedCount = computed(() => plan.courses.filter((course) => isDone(course.code)).length)
const progressPercent = computed(() => Math.round((completedCount.value / plan.courses.length) * 100))
const doneOn = (code) => (typeof done.value[code] === 'string' ? done.value[code] : '')

function toggleDone(code) {
  if (done.value[code]) delete done.value[code]
  else done.value[code] = new Date().toISOString().slice(0, 10)
}
function resetProgress() {
  if (!completedCount.value) return
  if (typeof window !== 'undefined' && !window.confirm(`确定清空全部 ${completedCount.value} 门课的完成记录吗？`)) return
  done.value = {}
}

// ---- stage tabs -------------------------------------------------------------
// 阶段标签从课程数据里长出来，而不是写死：「预科 / 本科核心 / …」是这份计划的说法，
// 换一份学习计划就不一定长这样。
const stages = computed(() => plan.stages)
const stageTabs = computed(() => {
  // 用 stageLabel：详细课程里没有 stage 字段，取错了整排阶段会退化成一个空标签。
  const labels = [...new Set(plan.courses.map((course) => course.stageLabel))]
  return labels.map((label, index) => ({
    key: label,
    // 角标不重复阶段名：卡片上「准备 / 准备」是原来看起来最怪的一处。
    tag: `STAGE ${String(index + 1).padStart(2, '0')}`,
    meta: plan.stages[index] || plan.stages[plan.stages.length - 1],
  }))
})
const ALL = '全部'
const activeStage = ref(ALL)

const stageCount = (key) => plan.courses.filter((course) => course.stageLabel === key).length
const stageDone = (key) => plan.courses.filter((course) => course.stageLabel === key && isDone(course.code)).length
const stagePercent = (key) => {
  const total = stageCount(key)
  return total ? Math.round((stageDone(key) / total) * 100) : 0
}

// ---- filters ----------------------------------------------------------------
const query = ref('')
const statusFilter = ref('all') // all | pending | done
const coreOnly = ref(false)

const visibleCourses = computed(() => {
  const q = query.value.trim().toLowerCase()
  return plan.courses.filter((course) => {
    if (activeStage.value !== ALL && course.stageLabel !== activeStage.value) return false
    if (coreOnly.value && course.importance < 5) return false
    if (statusFilter.value === 'done' && !isDone(course.code)) return false
    if (statusFilter.value === 'pending' && isDone(course.code)) return false
    if (!q) return true
    const haystack = [course.code, course.name, course.stageLabel, course.prerequisite,
      ...course.concepts, ...course.criteria, course.practice,
      ...course.resources.map((r) => r.title)].join(' ').toLowerCase()
    return haystack.includes(q)
  })
})

const activeTabMeta = computed(() => stageTabs.value.find((tab) => tab.key === activeStage.value) || null)
const activePlan = computed(() => studyPlans.find((item) => item.id === activeId.value) || null)

// ---- expand / collapse ------------------------------------------------------
const expanded = ref({})
const isExpanded = (code) => expanded.value[code] !== false // cards start open
function toggleExpanded(code) { expanded.value[code] = expanded.value[code] === false }
const allOpen = computed(() => visibleCourses.value.every((course) => isExpanded(course.code)))
function toggleAll() {
  const next = !allOpen.value
  const map = {}
  for (const course of visibleCourses.value) map[course.code] = next
  expanded.value = map
}
function clearFilters() {
  query.value = ''
  statusFilter.value = 'all'
  coreOnly.value = false
  activeStage.value = ALL
}

// ---- stat count-ups ---------------------------------------------------------
// 传函数而不是数字：换计划时数字要跟着新计划走，run() 里会重新取值。
const coursesCount = useCountUp(() => plan.courses.length, { duration: 900 })
// 不是每份计划都有 totals（「高性价比人生指南」就没有 hoursLow/hoursHigh）：
// 这里必须用可选链 + 兜底，否则换计划时这个 getter 会抛错，
// 整个 switchPlan 中断，页面就停在「学习库」根本进不去。
const hoursLow = useCountUp(() => plan.totals?.hoursLow ?? 0, { duration: 1400 })
const hoursHigh = useCountUp(() => plan.totals?.hoursHigh ?? 0, { duration: 1600 })
const stageTotal = useCountUp(() => stages.value.length, { duration: 800 })
const resourceTotal = useCountUp(() => plan.courses.reduce((sum, course) => sum + course.resources.length, 0), { duration: 1200 })
</script>

<template>
  <!-- .page-content / .inner-page 是内页的内边距与最大宽度；.study-wrap 负责底部留白，
       并且用 `.study-wrap > .study-page` 播放一次 contentReveal 入场动画。
       这三层以前由 App.vue 的 <section> 提供，拆出页面后要跟着页面自己走。 -->
  <section class="page-content inner-page study-wrap">
  <div class="study-page">
    <!-- 学习库：以后加计划就是往 data/studyPlans.js 里加一项 -->
    <section v-if="view === 'library'" class="study-library">
      <header class="study-library-head">
        <div>
          <div class="section-kicker">STUDY LIBRARY <span></span></div>
          <h1>学习库</h1>
          <p>想学什么就打开哪一份。新的学习计划由站主单独定制一页。</p>
        </div>
      </header>

      <div class="study-library-grid">
        <button v-for="item in studyPlans" :key="item.id" class="study-card" @click="openPlan(item.id)">
          <span class="study-card-kicker">CURATED</span>
          <strong>{{ item.name }}</strong>
          <small>{{ item.plan.courses.length }} {{ item.unit || '门课程' }} · {{ item.plan.stages.length }} 个阶段 · 完整资源</small>
          <span class="study-card-go">打开 ↗</span>
        </button>
        <div class="study-card study-card-add">
          <strong>＋ 还想学什么</strong>
          <small>把文档给站主，单独定制一份</small>
        </div>
      </div>
      <p class="study-library-hint">每份计划都有自己的进度记录，互不干扰。</p>
    </section>

    <template v-else>
    <nav class="study-plan-bar" aria-label="学习计划">
      <button class="study-plan-back" @click="backToLibrary">← 学习库</button>
      <span class="study-plan-name">{{ activePlan?.name }}</span>
      <span class="study-plan-note">{{ activePlan?.note }}</span>
    </nav>
    <!-- ── 头部 ─────────────────────────────────────────────── -->
    <section class="study-hero" :class="{ 'is-book': plan.meta.layout === 'book' }" v-reveal>
      <div class="study-hero-glow" aria-hidden="true"></div>
      <div class="study-hero-main">
        <div class="section-kicker">SELF-STUDY ROADMAP <span></span></div>
        <h1>{{ plan.meta.title }}<em>。</em></h1>
        <p class="study-subtitle">{{ plan.meta.subtitle }}</p>
        <div class="study-tags"><span v-for="tag in plan.meta.tags" :key="tag">{{ tag }}</span></div>
        <p class="study-principle">{{ plan.meta.corePrinciple.replace(/^这份计划的核心原则\s*/, '') }}</p>
        <p class="study-version">{{ plan.meta.version }}</p>
      </div>
      <div class="study-hero-stats">
        <!-- 书没有「课时」这个概念，别拿课程的四个数字往上套（原来会显示「0—0 建议总投入」） -->
        <template v-if="plan.meta.layout === 'book'">
          <div class="study-stat" v-reveal="{ delay: 60 }">
            <strong><span>{{ bookStats.chapters }}</span></strong><small>章</small>
          </div>
          <div class="study-stat" v-reveal="{ delay: 130 }">
            <strong><span>{{ bookStats.items }}</span></strong><small>条</small>
          </div>
          <div class="study-stat wide" v-reveal="{ delay: 200 }">
            <strong><span>{{ bookStats.parts }}</span></strong><small>组（保命 → 事业）</small>
          </div>
        </template>
        <template v-else>
        <div class="study-stat" v-reveal="{ delay: 60 }">
          <strong><span>{{ coursesCount.value }}</span></strong><small>门课程</small>
        </div>
        <div class="study-stat" v-reveal="{ delay: 130 }">
          <strong><span>{{ stageTotal.value }}</span></strong><small>个阶段</small>
        </div>
        <div class="study-stat wide" v-reveal="{ delay: 200 }">
          <strong><span>{{ hoursLow.value }}</span>–<span>{{ hoursHigh.value }}</span></strong><small>建议总投入（小时）</small>
        </div>
        <div class="study-stat" v-reveal="{ delay: 270 }">
          <strong><span>{{ resourceTotal.value }}</span></strong><small>条学习资源</small>
        </div>
        </template>
      </div>
    </section>

    <div v-if="plan.meta.layout !== 'book'">
    <!-- ── 进度总览 ─────────────────────────────────────────── -->
    <section class="study-section" v-reveal>
      <div class="study-section-head">
        <div>
          <div class="section-kicker">YOUR PROGRESS <span></span></div>
          <h2>学习进度</h2>
        </div>
        <div class="study-progress-actions">
          <span class="study-progress-count">{{ completedCount }} / {{ plan.courses.length }} 门已完成</span>
          <button class="study-ghost-button" :disabled="!completedCount" @click="resetProgress">清空进度</button>
        </div>
      </div>

      <div class="study-progress-bar" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
        <div class="study-progress-fill" :style="{ width: `${progressPercent}%` }">
          <span class="study-progress-shine" aria-hidden="true"></span>
        </div>
        <span class="study-progress-value">{{ progressPercent }}%</span>
      </div>

      <div class="study-stage-grid">
        <button
          v-for="(tab, index) in stageTabs"
          :key="tab.key"
          class="study-stage-card"
          :class="{ active: activeStage === tab.key, complete: stagePercent(tab.key) === 100 }"
          v-reveal="{ delay: index * 55 }"
          @click="activeStage = activeStage === tab.key ? ALL : tab.key"
        >
          <span class="study-stage-tag">{{ tab.tag }}</span>
          <strong>{{ tab.key }}</strong>
          <small>{{ tab.meta?.goal }}</small>
          <span class="study-stage-meter"><i :style="{ width: `${stagePercent(tab.key)}%` }"></i></span>
          <span class="study-stage-meta">{{ stageDone(tab.key) }}/{{ stageCount(tab.key) }} · {{ tab.meta?.duration }}</span>
        </button>
      </div>
    </section>

    <!-- ── 怎么用这份路线 ───────────────────────────────────── -->
    <section class="study-section" v-reveal>
      <div class="study-section-head">
        <div>
          <div class="section-kicker">HOW TO USE IT <span></span></div>
          <h2>怎么用这份路线</h2>
        </div>
      </div>
      <ol class="study-rules">
        <li v-for="(rule, index) in plan.howToUse" :key="index" v-reveal="{ delay: index * 60 }">
          <span class="study-rule-index">{{ String(index + 1).padStart(2, '0') }}</span>
          <p>{{ rule }}</p>
        </li>
      </ol>
    </section>

    <!-- ── 重要程度 ─────────────────────────────────────────── -->
    <section class="study-section" v-reveal>
      <div class="study-section-head">
        <div>
          <div class="section-kicker">PRIORITY SCALE <span></span></div>
          <h2>重要程度标尺</h2>
        </div>
        <p class="study-hint">用它决定每门课该投入多少精力。</p>
      </div>
      <div class="study-scale">
        <div v-for="(row, index) in plan.importanceScale" :key="row.mark" class="study-scale-row" v-reveal="{ delay: index * 55 }">
          <span class="study-scale-stars" :data-level="row.stars">{{ row.mark }}</span>
          <strong>{{ row.name }}</strong>
          <p>{{ row.strategy }}</p>
        </div>
      </div>
    </section>

    <!-- ── 主线顺序 ─────────────────────────────────────────── -->
    <!-- 只有金融学那份计划有 order（一张手写的主线顺序表）；别的计划没有就整块不出现，
         否则 template 里 plan.order.chain 会在换计划时直接抛错。 -->
    <section v-if="plan.order" class="study-section" v-reveal>
      <div class="study-section-head">
        <div>
          <div class="section-kicker">THE ORDER <span></span></div>
          <h2>主线顺序（不要打乱）</h2>
        </div>
      </div>
      <div class="study-chain">
        <template v-for="(step, index) in plan.order.chain" :key="step">
          <span class="study-chain-node" v-reveal="{ delay: Math.min(index * 40, 600) }">{{ step }}</span>
          <span v-if="index < plan.order.chain.length - 1" class="study-chain-arrow" aria-hidden="true">→</span>
        </template>
      </div>
      <div class="study-foundation">
        <strong>{{ plan.order.foundationTitle || '最不能跳过的「地基六门」' }}</strong>
        <span v-for="name in plan.order.foundation" :key="name">{{ name }}</span>
      </div>
    </section>

    <!-- ── 课程 ─────────────────────────────────────────────── -->
    <section class="study-section" v-reveal>
      <div class="study-section-head">
        <div>
          <div class="section-kicker">THE COURSES <span></span></div>
          <h2>课程清单</h2>
        </div>
        <p class="study-hint">勾选左边圆圈标记完成；点卡片标题展开知识点、资源与过关标准。</p>
      </div>

      <div class="study-toolbar">
        <div class="study-pills">
          <button :class="{ active: activeStage === ALL }" @click="activeStage = ALL">全部 <small>{{ plan.courses.length }}</small></button>
          <button v-for="tab in stageTabs" :key="tab.key" :class="{ active: activeStage === tab.key }" @click="activeStage = tab.key">
            {{ tab.key }} <small>{{ stageCount(tab.key) }}</small>
          </button>
        </div>
        <label class="study-search">
          <span aria-hidden="true">⌕</span>
          <input v-model="query" type="search" placeholder="搜索课程、知识点或资源…" aria-label="搜索课程" />
        </label>
        <div class="study-filters">
          <button :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">全部</button>
          <button :class="{ active: statusFilter === 'pending' }" @click="statusFilter = 'pending'">未完成</button>
          <button :class="{ active: statusFilter === 'done' }" @click="statusFilter = 'done'">已完成</button>
          <button :class="{ active: coreOnly }" @click="coreOnly = !coreOnly">仅核心必修</button>
          <button class="study-ghost-button" @click="toggleAll">{{ allOpen ? '收起全部' : '展开全部' }}</button>
        </div>
      </div>

      <p v-if="activeTabMeta" class="study-stage-intro">
        <strong>{{ activeTabMeta.tag }} · {{ activeTabMeta.key }}</strong>
        <span>{{ activeTabMeta.summary || activeTabMeta.meta?.summary }}</span>
      </p>

      <div class="study-course-list">
        <article
          v-for="(course, index) in visibleCourses"
          :key="course.code"
          class="study-course"
          :class="{ done: isDone(course.code), open: isExpanded(course.code), core: course.importance === 5 }"
          v-reveal="{ delay: Math.min(index * 30, 300) }"
        >
          <div class="study-course-head">
            <button
              class="study-check"
              :aria-pressed="isDone(course.code)"
              :aria-label="`标记 ${course.name} 为${isDone(course.code) ? '未完成' : '已完成'}`"
              @click.stop="toggleDone(course.code)"
            >
              <span aria-hidden="true">✓</span>
            </button>
            <button class="study-course-title" @click="toggleExpanded(course.code)">
              <span class="study-course-code">{{ course.code }}</span>
              <span class="study-course-name">
                <strong>{{ course.name }}</strong>
                <small>
                  {{ course.stageLabel }} · 前置：{{ course.prerequisite }} · {{ course.hoursText }}
                  <template v-if="doneOn(course.code)"> · {{ doneOn(course.code) }} 完成</template>
                </small>
              </span>
              <span class="study-course-stars" :data-level="course.importance" :title="`重要程度 ${course.importance}/5`">{{ course.stars }}</span>
              <span class="study-course-caret" aria-hidden="true">▾</span>
            </button>
          </div>

          <div class="study-course-body">
            <div class="study-course-body-inner">
              <div class="study-course-col">
                <h4>核心知识点</h4>
                <ul><li v-for="item in course.concepts" :key="item">{{ item }}</li></ul>
                <button
                  v-if="course.chapter"
                  class="study-chapter-open"
                  @click.stop="readChapter(course)"
                >{{ chapterBusy === course.code ? '正在读取全文…' : `读这一章全文（${course.concepts.length} 条）↗` }}</button>
              </div>
              <div class="study-course-col">
                <h4>过关标准</h4>
                <ul class="study-criteria"><li v-for="item in course.criteria" :key="item">{{ item }}</li></ul>
                <template v-if="course.practice">
                  <h4 class="study-practice-title">配套实战</h4>
                  <p class="study-practice">{{ course.practice }}</p>
                </template>
              </div>
              <div class="study-course-col">
                <h4>推荐学习途径</h4>
                <ul class="study-resource-list">
                  <li v-for="resource in course.resources" :key="resource.url + resource.title">
                    <a v-if="resource.url" :href="resource.url" target="_blank" rel="noopener noreferrer">
                      <span>{{ resource.title }}</span><i aria-hidden="true">↗</i>
                    </a>
                    <span v-else>{{ resource.title }}</span>
                  </li>
                </ul>
                <p v-if="!course.resources.length" class="study-empty">文档未给出固定资源，按“学校 + 课程名 + 主讲人”搜索。</p>
              </div>
            </div>
          </div>
        </article>

        <div v-if="!visibleCourses.length" class="study-no-result">
          <span aria-hidden="true">✳</span>
          <h3>没有符合条件的课程</h3>
          <p>换个关键词，或清空筛选条件。</p>
          <button class="button-secondary" @click="clearFilters">清空筛选</button>
        </div>
      </div>
    </section>

    <!-- ── 每周模板 ─────────────────────────────────────────── -->
    <section v-if="plan.weeklyTemplate.length" class="study-section" v-reveal>
      <div class="study-section-head">
        <div>
          <div class="section-kicker">WEEKLY RHYTHM <span></span></div>
          <h2>工作党可执行的每周模板</h2>
        </div>
        <p class="study-hint">{{ plan.weeklyNote || '每周 8–12 小时，工作日看视频，周末做题与实战。' }}</p>
      </div>
      <div class="study-week">
        <div v-for="(row, index) in plan.weeklyTemplate" :key="row.day" class="study-week-row" v-reveal="{ delay: index * 50 }">
          <span class="study-week-day">{{ row.day }}</span>
          <span class="study-week-task">{{ row.task }}</span>
          <span class="study-week-time">{{ row.duration }}</span>
          <span class="study-week-req">{{ row.requirement }}</span>
        </div>
      </div>
    </section>

    <!-- ── 规则 / 目标 / 画像 ───────────────────────────────── -->
    <section v-if="plan.graduationRules.length || plan.pythonTimeline.length || plan.firstYearGoals.length || plan.finalStandards.items.length" class="study-section study-multi" v-reveal>
      <div v-if="plan.graduationRules.length" class="study-panel" v-reveal="{ delay: 40 }">
        <h3>每门课的「毕业考试」规则</h3>
        <ul><li v-for="item in plan.graduationRules" :key="item">{{ item }}</li></ul>
      </div>
      <div v-if="plan.pythonTimeline.length" class="study-panel" v-reveal="{ delay: 120 }">
        <h3>什么时候开始 Python</h3>
        <ul class="study-steps"><li v-for="item in plan.pythonTimeline" :key="item">{{ item }}</li></ul>
      </div>
      <div v-if="plan.firstYearGoals.length" class="study-panel" v-reveal="{ delay: 200 }">
        <h3>第一年建议目标</h3>
        <ul><li v-for="item in plan.firstYearGoals" :key="item">{{ item }}</li></ul>
      </div>
      <div v-if="plan.finalStandards.items.length" class="study-panel accent" v-reveal="{ delay: 280 }">
        <h3>最终毕业画像</h3>
        <p class="study-panel-intro">{{ plan.finalStandards.intro }}</p>
        <ul><li v-for="item in plan.finalStandards.items" :key="item">{{ item }}</li></ul>
      </div>
    </section>

    <!-- ── 资源 ─────────────────────────────────────────────── -->
    <section v-if="plan.resources.length || plan.resourceNotes.length" class="study-section" v-reveal>
      <div class="study-section-head">
        <div>
          <div class="section-kicker">WHERE TO LEARN <span></span></div>
          <h2>核心在线资源入口</h2>
        </div>
      </div>
      <div class="study-resources">
        <a v-for="(resource, index) in plan.resources" :key="resource.url" class="study-resource-card"
           :href="resource.url" target="_blank" rel="noopener noreferrer" v-reveal="{ delay: index * 70 }">
          <strong>{{ resource.name }}</strong>
          <p>{{ resource.note }}</p>
          <span class="study-resource-link">{{ resource.url.replace(/^https?:\/\//, '').replace(/\/$/, '') }} <i aria-hidden="true">↗</i></span>
        </a>
      </div>
      <ul class="study-notes">
        <li v-for="note in plan.resourceNotes" :key="note">{{ note }}</li>
      </ul>
    </section>
    </div>

    <!-- ── 书本式计划 ───────────────────────────────────────────
         「高性价比人生指南」不是课程表，是一本书：左边目录、右边正文，
         一条一条顺着读。这里只做排版，不再加「过关标准 / 实战任务」那种课程化的东西。 -->
    <div v-if="plan.meta.layout === 'book'" class="study-book" v-reveal>
      <aside class="study-book-toc" aria-label="章节目录">
        <div class="study-book-toc-head">
          <span>目录</span>
          <b>{{ plan.bookChapters.length }} 章 · {{ plan.totalItems }} 条</b>
        </div>
        <nav class="study-book-toc-list">
          <template v-for="chapter in plan.bookChapters" :key="chapter.id">
            <button
              class="study-book-toc-item"
              :class="{ active: bookChapterId === chapter.id }"
              @click="openBookChapter(chapter)"
            >
              <b>{{ String(chapter.no).padStart(2, '0') }}</b>
              <span>{{ chapter.title }}</span>
              <em>{{ chapter.count }}</em>
            </button>
            <!-- 三级目录：当前这一章的每一条。读到第几条会跟着滚动高亮。 -->
            <div v-if="chapter.id === bookChapterId && bookChapter" class="study-book-toc-items">
              <button
                v-for="(item, index) in bookChapter.items"
                :key="index"
                class="study-book-toc-sub"
                :class="{ current: activeItem === index, seen: index < activeItem }"
                @click="jumpToItem(index)"
              >
                <i>{{ index + 1 }}</i><span>{{ item.t }}</span>
              </button>
            </div>
          </template>
        </nav>
      </aside>

      <article class="study-book-page" ref="bookEl">
        <div v-if="bookLoading" class="study-book-empty">正在取这一章…</div>
        <div v-else-if="!bookChapter" class="study-book-empty">
          <small>共 {{ plan.bookChapters.length }} 章 · {{ plan.totalItems }} 条</small>
          <h2>从左边挑一章开始读</h2>
          <p>每一条都写了成本、说人话、收益、证据等级和出处。顺着读就行，不需要做别的。</p>
          <button class="button-primary" @click="openBookChapter(plan.bookChapters[0])">从第 1 章开始 →</button>
        </div>
        <template v-else>
          <header class="study-book-head">
            <div class="study-book-head-meta">
              <span>第 {{ bookChapter.no }} 章</span>
              <span class="study-book-head-sep" aria-hidden="true">/</span>
              <span>{{ plan.bookChapters.length }} 章中第 {{ bookIndex + 1 }} 章</span>
              <span class="study-book-head-sep" aria-hidden="true">·</span>
              <span>{{ bookChapter.items.length }} 条</span>
              <span class="study-book-head-sep" aria-hidden="true">·</span>
              <span class="study-book-progress">读到第 {{ Math.max(1, activeItem + 1) }} 条</span>
            </div>
            <h2>{{ bookChapter.title }}</h2>
            <div v-if="bookChapter.intro" class="study-book-intro">
              <small>本章导读</small>
              <p>{{ bookChapter.intro }}</p>
            </div>
          </header>

          <ol class="study-book-items" ref="bookItemsEl">
            <li v-for="(item, index) in bookChapter.items" :key="index" :class="{ current: activeItem === index }">
              <h3><span class="study-book-num">{{ index + 1 }}</span>{{ item.t }}</h3>
              <p v-if="item.cost"><b>成本</b><span>{{ item.cost }}</span></p>
              <p v-if="item.plain" class="is-plain"><b>说人话</b><span>{{ item.plain }}</span></p>
              <p v-if="item.benefit"><b>收益</b><span>{{ item.benefit }}</span></p>
              <p v-if="item.note" class="is-note"><b>备注</b><span>{{ item.note }}</span></p>
              <p v-if="item.source || item.evidence" class="study-book-src">
                <span v-if="item.evidence" class="study-book-evidence">证据 {{ item.evidence }}</span>
                <span v-if="item.source">{{ item.source }}</span>
              </p>
            </li>
          </ol>

          <nav class="study-book-nav" aria-label="翻章">
            <button class="button-secondary" :disabled="bookIndex <= 0" @click="stepChapter(-1)">← 上一章</button>
            <span>第 {{ bookIndex + 1 }} / {{ plan.bookChapters.length }} 章</span>
            <button class="button-secondary" :disabled="bookIndex >= plan.bookChapters.length - 1" @click="stepChapter(1)">下一章 →</button>
          </nav>
        </template>
      </article>
    </div>

    <!-- 读到深处时顶栏早就滚出去了，这里给一条常驻的小工具条：
         回学习库、看进度、回本章开头。往下滑出现，回到顶部自动收起。
         **必须 teleport 到 body**：`.study-book` 上有 v-reveal 的 translate，
         会给 fixed 子元素造出包含块，工具条就会被摆到那块几万像素高的区域底部去。 -->
    <Teleport to="body">
      <div v-if="showBookBar && plan.meta.layout === 'book'" class="study-book-bar">
        <button class="study-book-bar-back" @click="backToLibrary">← 学习库</button>
        <span class="study-book-bar-pos">
          第 {{ bookIndex + 1 }} / {{ plan.bookChapters.length }} 章
          <template v-if="bookChapter"> · 第 {{ Math.max(1, activeItem + 1) }} / {{ bookChapter.items.length }} 条</template>
        </span>
        <button class="study-book-bar-top" @click="scrollToBook">↑ 回到本章开头</button>
      </div>
    </Teleport>
    </template>
  </div>
  </section>

  <!-- 章节全文：「高性价比人生指南」的每一章原文，按需加载 -->
  <ModalShell
    v-if="openChapter"
    card-class="study-chapter"
    :kicker="`第 ${openChapter.no} 章 · ${openChapter.items.length} 条`"
    :title="openChapter.title"
    @close="openChapter = null"
  >
    <p v-if="openChapter.intro" class="study-chapter-intro">{{ openChapter.intro }}</p>
    <ol class="study-chapter-list">
      <li v-for="(item, index) in openChapter.items" :key="index">
        <h4>{{ item.t }}</h4>
        <p v-if="item.cost"><b>成本</b>{{ item.cost }}</p>
        <p v-if="item.plain"><b>说人话</b>{{ item.plain }}</p>
        <p v-if="item.benefit"><b>收益</b>{{ item.benefit }}</p>
        <p v-if="item.evidence"><b>证据等级</b>{{ item.evidence }} 级</p>
        <p v-if="item.note"><b>备注</b>{{ item.note }}</p>
        <p v-if="item.source" class="study-chapter-source">{{ item.source }}</p>
      </li>
    </ol>
  </ModalShell>
</template>

<style scoped>
/* ── 通用 ───────────────────────────────────────────────── */
.study-page { display: grid; gap: clamp(34px, 5vw, 66px); padding-bottom: 24px; }
.study-section { display: grid; gap: 20px; }
.study-section-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
.study-section-head h2 { margin: 8px 0 0; font-family: var(--serif); font-size: clamp(21px, 2.6vw, 31px); font-weight: 600; letter-spacing: -.01em; }
.study-hint { margin: 0; max-width: 46ch; font-size: 12px; line-height: 1.7; color: var(--muted); }
.study-page :deep(.section-kicker) { font-size: 9px; letter-spacing: .2em; text-transform: uppercase; }

/* ── 头部 ───────────────────────────────────────────────── */
.study-hero {
  position: relative; overflow: hidden; isolation: isolate;
  display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(240px, .9fr); gap: clamp(22px, 3.4vw, 46px);
  padding: clamp(26px, 4vw, 52px); border-radius: 30px;
  border: 1px solid var(--line);
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, var(--panel)) 0%, var(--panel) 46%, color-mix(in srgb, var(--accent) 7%, var(--panel-raised)) 100%);
  box-shadow: 0 30px 80px -30px color-mix(in srgb, var(--accent) 40%, transparent);
}
.study-hero-glow {
  position: absolute; inset: -40% -10% auto auto; width: 62%; aspect-ratio: 1;
  background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 45%, transparent), transparent 66%);
  filter: blur(30px); opacity: .5; z-index: -1; pointer-events: none;
  animation: studyFloat 13s ease-in-out infinite alternate;
}
.study-hero-main h1 { margin: 12px 0 6px; font-family: var(--serif); font-size: clamp(27px, 4vw, 46px); font-weight: 600; line-height: 1.16; letter-spacing: -.02em; }
.study-hero-main h1 em { font-style: normal; color: var(--accent); }
.study-subtitle { margin: 0 0 14px; font-size: 13px; color: var(--muted); letter-spacing: .04em; }
.study-tags { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 16px; }
.study-tags span {
  padding: 5px 11px; border-radius: 999px; font-size: 10px; letter-spacing: .06em;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 26%, transparent);
  color: color-mix(in srgb, var(--accent) 70%, var(--ink));
}
.study-principle { margin: 0 0 12px; max-width: 62ch; font-size: 13px; line-height: 1.85; color: color-mix(in srgb, var(--ink) 84%, transparent); }
.study-version { margin: 0; font-size: 10px; letter-spacing: .05em; color: var(--muted); }

.study-hero-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; align-content: center; }
.study-stat {
  padding: 15px 14px; border-radius: 18px; text-align: center;
  background: color-mix(in srgb, var(--panel-raised) 72%, transparent);
  border: 1px solid var(--line);
  transition: transform .4s cubic-bezier(.2,.8,.2,1), border-color .4s ease, box-shadow .4s ease;
}
.study-stat:hover { transform: translateY(-4px); border-color: color-mix(in srgb, var(--accent) 45%, transparent); box-shadow: 0 18px 40px -20px color-mix(in srgb, var(--accent) 55%, transparent); }
.study-stat.wide { grid-column: span 2; }
.study-stat strong { display: block; font-family: var(--serif); font-size: clamp(21px, 2.6vw, 30px); font-weight: 600; color: var(--accent); font-variant-numeric: tabular-nums; }
.study-stat small { display: block; margin-top: 3px; font-size: 10px; letter-spacing: .07em; color: var(--muted); }

/* ── 进度 ───────────────────────────────────────────────── */
.study-progress-actions { display: flex; align-items: center; gap: 12px; }
.study-progress-count { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.study-ghost-button {
  padding: 7px 13px; border-radius: 999px; font-size: 11px; cursor: pointer;
  background: transparent; border: 1px solid var(--line); color: var(--muted);
  transition: color .3s ease, border-color .3s ease, transform .3s ease;
}
.study-ghost-button:hover:not(:disabled) { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 50%, transparent); transform: translateY(-1px); }
.study-ghost-button:disabled { opacity: .45; cursor: default; }

.study-progress-bar {
  position: relative; height: 15px; border-radius: 999px; overflow: hidden;
  background: color-mix(in srgb, var(--ink) 8%, transparent);
  border: 1px solid var(--line);
}
.study-progress-fill {
  position: relative; height: 100%; border-radius: 999px;
  background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 75%, transparent), var(--accent));
  transition: width 1s cubic-bezier(.2,.9,.2,1);
  box-shadow: 0 0 22px color-mix(in srgb, var(--accent) 55%, transparent);
}
.study-progress-shine {
  position: absolute; inset: 0;
  background: linear-gradient(100deg, transparent 20%, rgba(255,255,255,.55) 50%, transparent 80%);
  transform: translateX(-100%);
  animation: studyShine 2.6s ease-in-out infinite;
}
.study-progress-value { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 9px; font-weight: 700; letter-spacing: .08em; color: var(--ink); mix-blend-mode: difference; }

.study-stage-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(178px, 1fr)); gap: 11px; }
.study-stage-card {
  display: grid; gap: 5px; padding: 14px; border-radius: 17px; text-align: left; cursor: pointer;
  background: color-mix(in srgb, var(--panel) 82%, transparent);
  border: 1px solid var(--line); color: var(--ink);
  transition: transform .38s cubic-bezier(.2,.8,.2,1), border-color .35s ease, box-shadow .35s ease, background-color .35s ease;
}
.study-stage-card:hover { transform: translateY(-4px); border-color: color-mix(in srgb, var(--accent) 42%, transparent); box-shadow: 0 20px 44px -24px color-mix(in srgb, var(--accent) 60%, transparent); }
.study-stage-card.active { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--panel)); }
.study-stage-card.complete { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent); }
.study-stage-tag { font-size: 9px; letter-spacing: .16em; color: var(--accent); text-transform: uppercase; }
.study-stage-card strong { font-family: var(--serif); font-size: 15px; font-weight: 600; }
.study-stage-card small { font-size: 10px; line-height: 1.5; color: var(--muted); }
.study-stage-meter { display: block; height: 4px; margin-top: 4px; border-radius: 999px; background: color-mix(in srgb, var(--ink) 9%, transparent); overflow: hidden; }
.study-stage-meter i { display: block; height: 100%; border-radius: 999px; background: var(--accent); transition: width .9s cubic-bezier(.2,.9,.2,1); }
.study-stage-meta { font-size: 9px; color: var(--muted); font-variant-numeric: tabular-nums; }

/* ── 规则 / 标尺 ────────────────────────────────────────── */
.study-rules { display: grid; gap: 10px; margin: 0; padding: 0; list-style: none; }
.study-rules li {
  display: grid; grid-template-columns: auto 1fr; gap: 14px; align-items: start;
  padding: 15px 17px; border-radius: 16px; border: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel) 76%, transparent);
  transition: transform .38s cubic-bezier(.2,.8,.2,1), border-color .35s ease;
}
.study-rules li:hover { transform: translateX(5px); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
.study-rule-index { font-family: var(--serif); font-size: 15px; color: var(--accent); }
.study-rules p { margin: 0; font-size: 12.5px; line-height: 1.8; color: color-mix(in srgb, var(--ink) 86%, transparent); }

.study-scale { display: grid; gap: 8px; }
.study-scale-row {
  display: grid; grid-template-columns: 92px 92px 1fr; gap: 14px; align-items: center;
  padding: 12px 16px; border-radius: 14px; border: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel) 70%, transparent);
  transition: border-color .35s ease, transform .35s ease;
}
.study-scale-row:hover { transform: translateX(4px); border-color: color-mix(in srgb, var(--accent) 38%, transparent); }
.study-scale-stars { letter-spacing: .12em; font-size: 12px; color: color-mix(in srgb, var(--ink) 32%, transparent); }
.study-scale-stars[data-level="5"] { color: #f0a72c; }
.study-scale-stars[data-level="4"] { color: #efb95a; }
.study-scale-stars[data-level="3"] { color: #9c93b5; }
.study-scale-row strong { font-size: 12px; font-weight: 600; }
.study-scale-row p { margin: 0; font-size: 11.5px; line-height: 1.7; color: var(--muted); }

/* ── 主线链 ─────────────────────────────────────────────── */
.study-chain { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.study-chain-node {
  padding: 7px 12px; border-radius: 10px; font-size: 11px;
  background: color-mix(in srgb, var(--panel-raised) 80%, transparent);
  border: 1px solid var(--line);
  transition: transform .35s cubic-bezier(.2,.8,.2,1), border-color .35s ease, color .35s ease;
}
.study-chain-node:hover { transform: translateY(-3px) scale(1.04); border-color: var(--accent); color: var(--accent); }
.study-chain-arrow { font-size: 10px; color: color-mix(in srgb, var(--accent) 70%, transparent); animation: studyPulse 2.4s ease-in-out infinite; }
.study-foundation {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 4px;
  padding: 13px 16px; border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  border: 1px dashed color-mix(in srgb, var(--accent) 38%, transparent);
}
.study-foundation strong { font-size: 11px; letter-spacing: .05em; }
.study-foundation span { padding: 4px 10px; border-radius: 999px; font-size: 10.5px; background: color-mix(in srgb, var(--accent) 18%, transparent); }

/* ── 工具栏 ─────────────────────────────────────────────── */
.study-toolbar { display: grid; gap: 11px; }
.study-pills { display: flex; flex-wrap: wrap; gap: 7px; }
.study-pills button, .study-filters button {
  padding: 7px 13px; border-radius: 999px; font-size: 11.5px; cursor: pointer;
  background: color-mix(in srgb, var(--panel) 80%, transparent);
  border: 1px solid var(--line); color: var(--muted);
  transition: transform .3s ease, color .3s ease, border-color .3s ease, background-color .3s ease;
}
.study-pills button:hover, .study-filters button:hover { transform: translateY(-2px); color: var(--ink); border-color: color-mix(in srgb, var(--accent) 42%, transparent); }
.study-pills button.active, .study-filters button.active {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  color: color-mix(in srgb, var(--accent) 78%, var(--ink)); font-weight: 600;
}
.study-pills small { opacity: .6; font-size: 9px; margin-left: 3px; }
.study-search {
  display: flex; align-items: center; gap: 9px; padding: 10px 15px; border-radius: 13px;
  background: color-mix(in srgb, var(--panel) 82%, transparent); border: 1px solid var(--line);
  transition: border-color .3s ease, box-shadow .3s ease;
}
.study-search:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 16%, transparent); }
.study-search span { color: var(--muted); }
.study-search input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--ink); font-size: 12.5px; outline: none; }
.study-filters { display: flex; flex-wrap: wrap; gap: 7px; }

.study-stage-intro {
  display: grid; gap: 5px; margin: 0; padding: 15px 18px; border-radius: 15px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-left: 2px solid var(--accent);
}
.study-stage-intro strong { font-size: 12px; }
.study-stage-intro span { font-size: 12px; line-height: 1.75; color: color-mix(in srgb, var(--ink) 80%, transparent); }

/* ── 课程卡片 ───────────────────────────────────────────── */
.study-course-list { display: grid; gap: 10px; }
.study-course {
  border-radius: 19px; overflow: hidden; border: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel) 78%, transparent);
  transition: border-color .4s ease, box-shadow .45s ease, transform .45s cubic-bezier(.2,.8,.2,1), opacity .4s ease;
}
.study-course:hover { border-color: color-mix(in srgb, var(--accent) 38%, transparent); box-shadow: 0 24px 54px -30px color-mix(in srgb, var(--accent) 65%, transparent); }
.study-course.core { border-left: 2px solid color-mix(in srgb, #f0a72c 65%, transparent); }
.study-course.done { background: color-mix(in srgb, var(--accent) 7%, var(--panel)); }
.study-course.done .study-course-name strong { text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--accent) 60%, transparent); opacity: .72; }

.study-course-head { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px; padding: 6px 14px 6px 12px; }
.study-check {
  width: 26px; height: 26px; border-radius: 50%; cursor: pointer; display: grid; place-items: center;
  border: 1.5px solid color-mix(in srgb, var(--ink) 22%, transparent); background: transparent;
  color: transparent; font-size: 12px; flex: none;
  transition: transform .35s cubic-bezier(.2,.8,.2,1), background-color .3s ease, border-color .3s ease, color .3s ease;
}
.study-check:hover { transform: scale(1.14); border-color: var(--accent); }
.study-course.done .study-check { background: var(--accent); border-color: var(--accent); color: #fff; animation: studyPop .42s cubic-bezier(.2,1.5,.4,1); }
.study-course-title {
  display: grid; grid-template-columns: auto 1fr auto auto; align-items: center; gap: 13px;
  width: 100%; padding: 9px 4px; border: 0; background: transparent; color: var(--ink); text-align: left; cursor: pointer;
}
.study-course-code { font-family: var(--serif); font-size: 15px; color: color-mix(in srgb, var(--accent) 80%, var(--ink)); font-variant-numeric: tabular-nums; }
.study-course-name { display: grid; gap: 2px; }
.study-course-name strong { font-family: var(--serif); font-size: 15px; font-weight: 600; transition: color .3s ease; }
.study-course-name small { font-size: 10.5px; color: var(--muted); }
.study-course-stars { font-size: 11px; letter-spacing: .1em; color: color-mix(in srgb, var(--ink) 30%, transparent); }
.study-course-stars[data-level="5"] { color: #f0a72c; }
.study-course-stars[data-level="4"] { color: #efb95a; }
.study-course-stars[data-level="3"] { color: #9c93b5; }
.study-course-caret { font-size: 11px; color: var(--muted); transition: transform .42s cubic-bezier(.2,.8,.2,1); }
.study-course.open .study-course-caret { transform: rotate(180deg); }

/* grid-template-rows 0fr → 1fr 让展开有过渡且不必知道内容高度 */
.study-course-body { display: grid; grid-template-rows: 0fr; transition: grid-template-rows .48s cubic-bezier(.2,.8,.2,1); }
.study-course.open .study-course-body { grid-template-rows: 1fr; }
.study-course-body-inner { overflow: hidden; }
.study-course.open .study-course-body-inner { border-top: 1px solid var(--line); }
.study-course-body-inner { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: clamp(16px, 2.4vw, 34px); padding: 0 clamp(16px, 2.4vw, 28px); }
.study-course.open .study-course-body-inner { padding-top: 18px; padding-bottom: 22px; }
.study-course-col h4 { margin: 0 0 9px; font-size: 10px; letter-spacing: .16em; text-transform: uppercase; color: var(--accent); }
.study-course-col h4.study-practice-title { margin-top: 15px; }
.study-course-col ul { margin: 0; padding-left: 15px; display: grid; gap: 6px; }
.study-course-col li { font-size: 11.5px; line-height: 1.75; color: color-mix(in srgb, var(--ink) 84%, transparent); }
.study-criteria li::marker { color: color-mix(in srgb, var(--accent) 70%, transparent); }
.study-practice { margin: 0; padding: 10px 12px; border-radius: 11px; font-size: 11.5px; line-height: 1.75; background: color-mix(in srgb, var(--accent) 9%, transparent); }
.study-resource-list { list-style: none; padding: 0; }
.study-resource-list a {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 9px 12px; border-radius: 11px; text-decoration: none; color: var(--ink); font-size: 11.5px;
  border: 1px solid var(--line); background: color-mix(in srgb, var(--panel-raised) 60%, transparent);
  transition: transform .35s cubic-bezier(.2,.8,.2,1), border-color .3s ease, color .3s ease;
}
.study-resource-list a:hover { transform: translateX(4px); border-color: var(--accent); color: var(--accent); }
.study-resource-list i { font-style: normal; opacity: .6; }
.study-empty { margin: 0; font-size: 11px; color: var(--muted); }

.study-no-result { display: grid; place-items: center; gap: 8px; padding: 46px 20px; text-align: center; border-radius: 18px; border: 1px dashed var(--line); }
.study-no-result span { font-size: 22px; color: var(--accent); }
.study-no-result h3 { margin: 0; font-family: var(--serif); font-size: 16px; font-weight: 600; }
.study-no-result p { margin: 0 0 6px; font-size: 11.5px; color: var(--muted); }

/* ── 每周模板 ───────────────────────────────────────────── */
.study-week { display: grid; gap: 8px; }
.study-week-row {
  display: grid; grid-template-columns: 96px 132px 96px 1fr; gap: 14px; align-items: center;
  padding: 12px 16px; border-radius: 14px; border: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel) 72%, transparent);
  transition: transform .38s cubic-bezier(.2,.8,.2,1), border-color .35s ease;
}
.study-week-row:hover { transform: translateX(5px); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
.study-week-day { font-family: var(--serif); font-size: 12.5px; }
.study-week-task { font-size: 11.5px; color: var(--accent); }
.study-week-time { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.study-week-req { font-size: 11.5px; color: color-mix(in srgb, var(--ink) 78%, transparent); }

/* ── 面板 ───────────────────────────────────────────────── */
.study-multi { display: grid; grid-template-columns: repeat(auto-fit, minmax(268px, 1fr)); gap: 13px; }
.study-panel {
  padding: 20px; border-radius: 19px; border: 1px solid var(--line);
  background: color-mix(in srgb, var(--panel) 76%, transparent);
  transition: transform .42s cubic-bezier(.2,.8,.2,1), border-color .4s ease, box-shadow .42s ease;
}
.study-panel:hover { transform: translateY(-5px); border-color: color-mix(in srgb, var(--accent) 40%, transparent); box-shadow: 0 26px 56px -32px color-mix(in srgb, var(--accent) 70%, transparent); }
.study-panel.accent { background: linear-gradient(150deg, color-mix(in srgb, var(--accent) 13%, var(--panel)), var(--panel)); border-color: color-mix(in srgb, var(--accent) 32%, transparent); }
.study-panel h3 { margin: 0 0 12px; font-family: var(--serif); font-size: 15.5px; font-weight: 600; }
.study-panel ul { margin: 0; padding-left: 16px; display: grid; gap: 8px; }
.study-panel li { font-size: 11.5px; line-height: 1.8; color: color-mix(in srgb, var(--ink) 84%, transparent); }
.study-panel-intro { margin: 0 0 11px; font-size: 11.5px; line-height: 1.75; color: var(--muted); }
.study-steps { list-style: none; padding: 0; }
.study-steps li { position: relative; padding-left: 20px; }
.study-steps li::before { content: ""; position: absolute; left: 3px; top: 8px; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent); }
.study-steps li:not(:last-child)::after { content: ""; position: absolute; left: 6px; top: 17px; bottom: -8px; width: 1px; background: color-mix(in srgb, var(--accent) 28%, transparent); }

/* ── 资源 ───────────────────────────────────────────────── */
.study-resources { display: grid; grid-template-columns: repeat(auto-fit, minmax(238px, 1fr)); gap: 12px; }
.study-resource-card {
  display: grid; gap: 8px; padding: 19px; border-radius: 19px; text-decoration: none; color: var(--ink);
  border: 1px solid var(--line);
  background: linear-gradient(150deg, color-mix(in srgb, var(--panel-raised) 78%, transparent), color-mix(in srgb, var(--panel) 82%, transparent));
  transition: transform .42s cubic-bezier(.2,.8,.2,1), border-color .4s ease, box-shadow .42s ease;
}
.study-resource-card:hover { transform: translateY(-6px) scale(1.012); border-color: var(--accent); box-shadow: 0 30px 62px -34px color-mix(in srgb, var(--accent) 80%, transparent); }
.study-resource-card strong { font-family: var(--serif); font-size: 14.5px; font-weight: 600; }
.study-resource-card p { margin: 0; font-size: 11.5px; line-height: 1.75; color: var(--muted); }
.study-resource-link { font-size: 10.5px; color: var(--accent); word-break: break-all; }
.study-resource-link i { font-style: normal; }
.study-notes { margin: 4px 0 0; padding-left: 16px; display: grid; gap: 6px; }
.study-notes li { font-size: 11px; line-height: 1.75; color: var(--muted); }

/* ── 动画 ───────────────────────────────────────────────── */
@keyframes studyFloat { from { transform: translate3d(0,0,0) scale(1); } to { transform: translate3d(-6%, 7%, 0) scale(1.12); } }
@keyframes studyShine { 0% { transform: translateX(-100%); } 55%, 100% { transform: translateX(220%); } }
@keyframes studyPulse { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@keyframes studyPop { 0% { transform: scale(.6); } 60% { transform: scale(1.2); } 100% { transform: scale(1); } }

/* ── 响应式 ─────────────────────────────────────────────── */
@media (max-width: 1080px) {
  .study-hero { grid-template-columns: 1fr; }
  .study-hero-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .study-stat.wide { grid-column: span 1; }
}
@media (max-width: 760px) {
  .study-hero-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .study-scale-row { grid-template-columns: 84px 1fr; row-gap: 4px; }
  .study-scale-row p { grid-column: 1 / -1; }
  .study-week-row { grid-template-columns: 1fr 1fr; row-gap: 4px; }
  .study-week-req { grid-column: 1 / -1; }
  .study-course-title { grid-template-columns: auto 1fr auto; row-gap: 4px; }
  .study-course-stars { grid-column: 2; }
  .study-course-caret { grid-row: 1; grid-column: 3; }
}

/* 计划库：一行很薄的条，不抢首屏 */
.study-plan-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
  font-size: 11.5px;
  color: var(--muted);
}
.study-plan-label { letter-spacing: .2em; font-size: 9.5px; }
.study-plan-list { display: flex; gap: 8px; flex-wrap: wrap; }
.study-plan-list button {
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 11.5px;
  cursor: pointer;
  transition: color .2s, border-color .2s, background .2s;
}
.study-plan-list button:hover { color: var(--ink); border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); }
.study-plan-list button.active { border-color: var(--accent); background: var(--accent); color: #fff; }
.study-plan-note { margin-left: auto; font-size: 10.5px; color: var(--muted); }
@media (max-width: 760px) {
  .study-plan-note { display: none; }
}
.study-chapter-open { margin-top: 10px; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); background: transparent; color: var(--accent); font-size: 11.5px; cursor: pointer; transition: background-color .22s ease, border-color .22s ease; }
.study-chapter-open:hover { background: color-mix(in srgb, var(--accent) 12%, transparent); border-color: color-mix(in srgb, var(--accent) 45%, var(--line)); }
.study-chapter { width: min(100%, 820px); }
.study-chapter-intro { margin: 0 0 14px; font-size: 13px; line-height: 1.9; color: var(--muted); }
.study-chapter-list { margin: 0; padding: 0 0 0 18px; display: grid; gap: 18px; }
.study-chapter-list > li { padding-bottom: 14px; border-bottom: 1px solid var(--line); }
.study-chapter-list > li:last-child { border-bottom: 0; }
.study-chapter-list h4 { margin: 0 0 8px; font-family: var(--serif); font-size: 14.5px; line-height: 1.6; }
.study-chapter-list p { margin: 4px 0 0; font-size: 12.5px; line-height: 1.9; color: var(--ink); }
.study-chapter-list b { display: inline-block; min-width: 4.5em; margin-right: 6px; font-weight: 600; font-size: 10.5px; letter-spacing: .06em; color: var(--accent); }
.study-chapter-source { font-size: 10.5px !important; color: var(--muted) !important; word-break: break-word; }
/* 书页的封面别那么爱发光：默认那层 80px 的紫色投影落在卡片下面，像一摊漏光。 */
.study-hero.is-book { box-shadow: 0 24px 60px -34px color-mix(in srgb, var(--accent) 26%, transparent); }
.study-hero.is-book .study-hero-glow { opacity: .32; }
/* 书页常驻工具条：顶栏滚出去之后还能退出、还能知道读到哪 */
.study-book-bar { position: fixed; left: 50%; bottom: 26px; z-index: 30; transform: translateX(-50%); display: flex; align-items: center; gap: 14px; padding: 8px 10px 8px 16px; border-radius: 999px; border: 1px solid var(--line); background: var(--glass-strong, var(--panel)); box-shadow: 0 18px 40px -22px rgba(10, 6, 30, .8); animation: bookBarIn .28s ease both; }
.study-book-bar-back, .study-book-bar-top { padding: 5px 12px; border-radius: 999px; border: 1px solid transparent; background: transparent; color: var(--muted); font-size: 11.5px; cursor: pointer; transition: color .2s ease, background-color .2s ease; }
.study-book-bar-back { color: var(--ink); }
.study-book-bar-back:hover, .study-book-bar-top:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }
.study-book-bar-pos { font-size: 10.5px; letter-spacing: .06em; color: var(--muted); font-variant-numeric: tabular-nums; }
@keyframes bookBarIn { from { opacity: 0; transform: translate(-50%, 12px); } to { opacity: 1; transform: translate(-50%, 0); } }
@media (max-width: 560px) { .study-book-bar { bottom: 84px; gap: 6px; padding: 6px 8px 6px 12px; } .study-book-bar-pos { display: none; } }
/* 三级目录：当前章的条目，跟着滚动高亮 */
.study-book-toc-sub { display: grid; grid-template-columns: 20px minmax(0, 1fr); gap: 7px; width: 100%; padding: 4px 8px 4px 26px; border: 0; border-radius: 7px; background: transparent; color: var(--muted); font-size: 11.5px; line-height: 1.5; text-align: left; cursor: pointer; }
.study-book-toc-sub i { font-style: normal; font-size: 9.5px; color: color-mix(in srgb, var(--muted) 70%, transparent); font-variant-numeric: tabular-nums; padding-top: 2px; }
.study-book-toc-sub span { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.study-book-toc-sub:hover { background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--ink); }
.study-book-toc-sub.seen i { color: color-mix(in srgb, var(--accent) 55%, transparent); }
.study-book-toc-sub.current { background: color-mix(in srgb, var(--accent) 13%, transparent); color: var(--ink); }
.study-book-toc-sub.current i { color: var(--accent); font-weight: 600; }
.study-book-toc-items { margin: 2px 0 8px; padding-left: 6px; border-left: 1px solid color-mix(in srgb, var(--accent) 25%, transparent); display: grid; gap: 1px; }
.study-book-progress { color: var(--accent); }
/* 当前正在读的那一条：左边一条细线，扫一眼就知道读到哪 */
.study-book-items > li.current { position: relative; }
.study-book-items > li.current::before { content: ""; position: absolute; left: -14px; top: 2px; bottom: 0; width: 2px; border-radius: 2px; background: color-mix(in srgb, var(--accent) 45%, transparent); }
/* 书本式计划：左目录（面板）+ 右正文（书页）。
   这一份是「读」的，不是「刷进度」的：正文 15px / 行高 2.1，条目之间留白比课程卡大得多。 */
.study-book { display: grid; grid-template-columns: 288px minmax(0, 1fr); gap: 44px; align-items: start; margin: 34px 0 90px; }
.study-book-toc { position: sticky; top: 92px; max-height: calc(100vh - 130px); display: flex; flex-direction: column; padding: 14px 12px; border: 1px solid var(--line); border-radius: 16px; background: color-mix(in srgb, var(--panel) 62%, transparent); }
.study-book-toc-head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 0 6px 10px; margin-bottom: 6px; border-bottom: 1px solid var(--line); }
.study-book-toc-head span { font-size: 11px; letter-spacing: .22em; color: var(--accent); }
.study-book-toc-head b { font-size: 10.5px; font-weight: 400; color: var(--muted); }
.study-book-toc-list { overflow-y: auto; display: grid; gap: 1px; margin: 0 -4px; padding: 0 4px; }
.study-book-toc-item { position: relative; display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: baseline; gap: 9px; width: 100%; padding: 7px 9px; border: 0; border-radius: 9px; background: transparent; color: var(--ink); font-size: 12.5px; text-align: left; cursor: pointer; transition: background-color .18s ease, color .18s ease; }
.study-book-toc-item b { font-size: 10px; font-weight: 400; color: var(--muted); font-variant-numeric: tabular-nums; }
.study-book-toc-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.study-book-toc-item em { font-style: normal; font-size: 9.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.study-book-toc-item:hover { background: color-mix(in srgb, var(--accent) 9%, transparent); }
.study-book-toc-item.active { background: color-mix(in srgb, var(--accent) 17%, transparent); }
.study-book-toc-item.active b, .study-book-toc-item.active span, .study-book-toc-item.active em { color: var(--accent); }
.study-book-toc-item.active::before { content: ""; position: absolute; left: 0; top: 7px; bottom: 7px; width: 2px; border-radius: 2px; background: var(--accent); }
.study-book-page { min-width: 0; max-width: 720px; }
.study-book-empty { padding: 54px 0; color: var(--muted); }
.study-book-empty small { font-size: 10.5px; letter-spacing: .16em; color: var(--accent); }
.study-book-empty h2 { margin: 10px 0 12px; font-family: var(--serif); font-size: 27px; color: var(--ink); }
.study-book-empty p { margin: 0 0 20px; font-size: 13.5px; line-height: 2; }
.study-book-head { padding-bottom: 24px; margin-bottom: 30px; border-bottom: 1px solid var(--line); }
.study-book-head-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; font-size: 10.5px; letter-spacing: .1em; color: var(--muted); }
.study-book-head-meta span:first-child { color: var(--accent); }
.study-book-head-sep { opacity: .5; }
.study-book-head h2 { margin: 10px 0 14px; font-family: var(--serif); font-size: 31px; line-height: 1.4; letter-spacing: .01em; }
.study-book-intro { margin-top: 4px; padding: 14px 18px 16px; border-left: 2px solid color-mix(in srgb, var(--accent) 55%, transparent); border-radius: 0 12px 12px 0; background: color-mix(in srgb, var(--accent) 5%, transparent); }
.study-book-intro small { display: block; margin-bottom: 8px; font-size: 9.5px; letter-spacing: .18em; color: var(--accent); }
.study-book-intro p { margin: 0; font-size: 12.8px; line-height: 1.95; color: var(--muted); }
.study-book-items { margin: 0; padding: 0; list-style: none; display: grid; gap: 34px; }
.study-book-items > li { padding-bottom: 30px; border-bottom: 1px solid color-mix(in srgb, var(--line) 55%, transparent); }
.study-book-items > li:last-child { border-bottom: 0; padding-bottom: 0; }
.study-book-items h3 { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 6px; margin: 0 0 14px; font-family: var(--serif); font-size: 18.5px; font-weight: 500; line-height: 1.62; }
.study-book-num { font-family: var(--sans, inherit); font-size: 11px; font-weight: 400; color: var(--muted); padding-top: 7px; font-variant-numeric: tabular-nums; }
.study-book-items p { display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 10px; margin: 9px 0 0; font-size: 14px; line-height: 2.05; }
.study-book-items p b { font-size: 10.5px; font-weight: 600; letter-spacing: .08em; color: var(--accent); padding-top: 5px; }
.study-book-items p span { min-width: 0; }
.study-book-items .is-plain span { color: var(--ink); }
.study-book-items .is-note,
.study-book-items .is-note span { font-size: 12.8px; line-height: 1.95; color: var(--muted); }
.study-book-src { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin-top: 14px !important; padding-top: 12px; border-top: 1px dashed color-mix(in srgb, var(--line) 70%, transparent); font-size: 10.8px !important; line-height: 1.85 !important; color: var(--muted); }
.study-book-src span:last-child { flex: 1 1 260px; min-width: 0; word-break: break-word; opacity: .82; }
.study-book-evidence { flex: 0 0 auto; padding: 1px 9px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); font-size: 10px; letter-spacing: .04em; }
.study-book-nav { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-top: 38px; padding-top: 22px; border-top: 1px solid var(--line); }
.study-book-nav span { font-size: 11px; letter-spacing: .1em; color: var(--muted); }
.study-book-nav button { min-width: 118px; }
.study-book-nav button:disabled { opacity: .38; cursor: not-allowed; }
@media (max-width: 1024px) { .study-book { grid-template-columns: 236px minmax(0, 1fr); gap: 28px; } .study-book-head h2 { font-size: 26px; } }
@media (max-width: 760px) {
  .study-book { display: block; }
  .study-book-toc { position: static; max-height: none; margin-bottom: 28px; }
  .study-book-toc-list { max-height: 260px; }
  .study-book-items p { grid-template-columns: 1fr; gap: 2px; }
  .study-book-items h3 { grid-template-columns: 20px minmax(0, 1fr); font-size: 17px; }
}
</style>
