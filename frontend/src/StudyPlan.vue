<script setup>
// 学习板块：把《金融学系统自学路线》结构化呈现，并记录本机学习进度。
// 数据全部来自 data/studyPlan.js（由原始文档结构化而来），这里只负责呈现与交互。
import { computed, ref, watch } from 'vue'
import { studyPlan as plan } from './data/studyPlan'
import { readStoredJson, writeStoredJson } from './services/storage'
// Imported (not globally registered) so the directive is available in any app that mounts this
// component, including the render test.
import { useCountUp, vReveal } from './composables/motion'

const PROGRESS_KEY = 'weiwei-blog-study-progress'

// ---- progress ---------------------------------------------------------------
const stored = readStoredJson(PROGRESS_KEY, {})
const done = ref(stored && typeof stored.done === 'object' && stored.done ? { ...stored.done } : {})
watch(done, (value) => writeStoredJson(PROGRESS_KEY, { done: value, updatedAt: new Date().toISOString() }), { deep: true })

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
const stages = plan.stages
const stageTabs = [
  { key: '预科', tag: '阶段 0', meta: stages[0] },
  { key: '本科核心', tag: '阶段 1', meta: stages[1] },
  { key: '硕士核心', tag: '阶段 2', meta: stages[2] },
  { key: '硕士进阶', tag: '阶段 2+', meta: stages[2], summary: stages[2]?.supplement?.summary },
  { key: '博士工具', tag: '阶段 3', meta: stages[3] },
  { key: '博士研究', tag: '阶段 4', meta: stages[4] },
]
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

const activeTabMeta = computed(() => stageTabs.find((tab) => tab.key === activeStage.value) || null)

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
const coursesCount = useCountUp(plan.courses.length, { duration: 900 })
const hoursLow = useCountUp(plan.totals.hoursLow, { duration: 1400 })
const hoursHigh = useCountUp(plan.totals.hoursHigh, { duration: 1600 })
const stageTotal = useCountUp(stages.length, { duration: 800 })
const resourceTotal = useCountUp(plan.courses.reduce((sum, course) => sum + course.resources.length, 0), { duration: 1200 })
</script>

<template>
  <div class="study-page">
    <!-- ── 头部 ─────────────────────────────────────────────── -->
    <section class="study-hero" v-reveal>
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
      </div>
    </section>

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
    <section class="study-section" v-reveal>
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
        <strong>最不能跳过的「地基六门」</strong>
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
    <section class="study-section" v-reveal>
      <div class="study-section-head">
        <div>
          <div class="section-kicker">WEEKLY RHYTHM <span></span></div>
          <h2>工作党可执行的每周模板</h2>
        </div>
        <p class="study-hint">每周 8–12 小时，工作日看视频，周末做题与实战。</p>
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
    <section class="study-section study-multi" v-reveal>
      <div class="study-panel" v-reveal="{ delay: 40 }">
        <h3>每门课的「毕业考试」规则</h3>
        <ul><li v-for="item in plan.graduationRules" :key="item">{{ item }}</li></ul>
      </div>
      <div class="study-panel" v-reveal="{ delay: 120 }">
        <h3>什么时候开始 Python</h3>
        <ul class="study-steps"><li v-for="item in plan.pythonTimeline" :key="item">{{ item }}</li></ul>
      </div>
      <div class="study-panel" v-reveal="{ delay: 200 }">
        <h3>第一年建议目标</h3>
        <ul><li v-for="item in plan.firstYearGoals" :key="item">{{ item }}</li></ul>
      </div>
      <div class="study-panel accent" v-reveal="{ delay: 280 }">
        <h3>最终毕业画像</h3>
        <p class="study-panel-intro">{{ plan.finalStandards.intro }}</p>
        <ul><li v-for="item in plan.finalStandards.items" :key="item">{{ item }}</li></ul>
      </div>
    </section>

    <!-- ── 资源 ─────────────────────────────────────────────── -->
    <section class="study-section" v-reveal>
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
</style>
