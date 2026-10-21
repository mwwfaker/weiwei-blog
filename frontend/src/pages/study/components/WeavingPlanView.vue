<script setup>
// 手工编织与纤维手作：这一页是为这份课程单独做的版面。
// 四块内容各有形状：技法单元（卡片 + 展开）、40 周路线（阶段折叠 + 每周勾选）、项目库、材料工具。
// 进度按周存在本机（这份课程的时间轴是周，不是“课程”）。
import { computed, ref, watch } from 'vue'
import { readStoredJson, writeStoredJson } from '@/services/storage'
import { weavingPlan as plan } from '../data/weavingPlan'

defineEmits(['back'])

const PROGRESS_KEY = 'weiwei-blog-weaving-progress-v1'
const done = ref(readStoredJson(PROGRESS_KEY, {}) || {})
watch(done, (value) => writeStoredJson(PROGRESS_KEY, value), { deep: true })

const totalWeeks = computed(() => plan.weeks.length)
const doneCount = computed(() => plan.weeks.filter((week) => done.value[week.n]).length)
const percent = computed(() => (totalWeeks.value ? Math.round((doneCount.value / totalWeeks.value) * 100) : 0))
const unitCount = computed(() => plan.techniques.reduce((sum, tech) => sum + tech.units.length, 0))

function toggleWeek(n) {
  if (done.value[n]) delete done.value[n]
  else done.value[n] = new Date().toISOString().slice(0, 10)
}
function weeksOf(phase) {
  const [from, to] = String(phase.weeks).split(/[–-]/).map((value) => Number(String(value).replace(/[^\d]/g, '')))
  return plan.weeks.filter((week) => week.n >= from && week.n <= (to || from))
}
const phaseDone = (phase) => weeksOf(phase).filter((week) => done.value[week.n]).length
</script>

<template>
  <section class="weave-page">
    <header class="weave-hero">
      <div class="weave-kicker">FIBER CRAFT · 40 WEEKS</div>
      <h1>{{ plan.meta.title }}</h1>
      <p class="weave-subtitle">{{ plan.meta.subtitle }}</p>
      <p class="weave-intro">{{ plan.meta.intro }}</p>
      <div class="weave-actions">
        <button class="doc-btn" @click="$emit('back')">← 学习库</button>
      </div>

      <div class="weave-stats">
        <div><b>{{ plan.phases.length }}</b><span>个阶段</span></div>
        <div><b>{{ plan.techniques.length }}</b><span>大技法</span></div>
        <div><b>{{ totalWeeks }}</b><span>周课程</span></div>
        <div><b>{{ plan.projects.length }}</b><span>个项目</span></div>
      </div>

      <div class="weave-progress">
        <div class="weave-progress-bar"><i :style="{ width: `${percent}%` }"></i></div>
        <span>{{ doneCount }} / {{ totalWeeks }} 周已完成 · {{ percent }}%</span>
      </div>
      <p class="weave-usage">{{ plan.meta.usage }}</p>
    </header>

    <!-- 技法地图 -->
    <section class="weave-block">
      <header class="weave-head">
        <span class="weave-no">01</span>
        <h2>技法地图</h2>
        <span class="weave-hint">{{ plan.techniques.length }} 个方向 · {{ unitCount }} 个单元，点开看每单元的达标点</span>
      </header>
      <div class="weave-tech-grid">
        <details v-for="tech in plan.techniques" :key="tech.id" class="weave-tech">
          <summary>
            <span class="weave-tech-code">{{ tech.code }}</span>
            <strong>{{ tech.name }}</strong>
            <span class="weave-tech-count">{{ tech.units.length }} 单元</span>
          </summary>
          <p class="weave-tech-summary">{{ tech.summary }}</p>
          <ul class="weave-units">
            <li v-for="unit in tech.units" :key="unit.code">
              <b>{{ unit.code }}</b>
              <span>{{ unit.skill }}</span>
              <small>{{ unit.pass }}</small>
            </li>
          </ul>
        </details>
      </div>
    </section>

    <!-- 40 周路线 -->
    <section class="weave-block">
      <header class="weave-head">
        <span class="weave-no">02</span>
        <h2>40 周路线</h2>
        <span class="weave-hint">按阶段推进；勾掉每周，进度自动累计</span>
      </header>
      <div class="weave-phases">
        <details v-for="(phase, index) in plan.phases" :key="phase.name" class="weave-phase" :open="index === 0">
          <summary>
            <span class="weave-phase-weeks">第 {{ phase.weeks }} 周</span>
            <strong>{{ phase.name }}</strong>
            <span class="weave-phase-done">{{ phaseDone(phase) }} / {{ weeksOf(phase).length }}</span>
          </summary>
          <p class="weave-phase-focus">{{ phase.focus }}</p>
          <p class="weave-phase-outcome"><b>阶段成果</b>{{ phase.outcome }}</p>
          <p v-if="phase.can" class="weave-phase-check"><b>过关标准</b>{{ phase.can }}</p>
          <p v-if="phase.fix" class="weave-phase-fix"><b>没达到</b>{{ phase.fix }}</p>
          <ul class="weave-weeks">
            <li v-for="week in weeksOf(phase)" :key="week.n" :class="{ 'is-done': done[week.n] }">
              <label>
                <input type="checkbox" :checked="Boolean(done[week.n])" @change="toggleWeek(week.n)" />
                <span class="weave-week-no">W{{ week.n }}</span>
                <span class="weave-week-copy">
                  <strong>{{ week.topic }}</strong>
                  <small>{{ week.work }}</small>
                  <em>过关：{{ week.pass }}</em>
                </span>
              </label>
            </li>
          </ul>
        </details>
      </div>
    </section>

    <!-- 项目库 -->
    <section class="weave-block">
      <header class="weave-head">
        <span class="weave-no">03</span>
        <h2>项目库</h2>
        <span class="weave-hint">从围巾到毛衣，按难度递进</span>
      </header>
      <div class="weave-project-grid">
        <article v-for="project in plan.projects" :key="project.name" class="weave-project">
          <strong>{{ project.name }}</strong>
          <span class="weave-project-level">{{ project.level }}</span>
          <small>{{ project.size }}</small>
          <em>{{ project.learn }}</em>
        </article>
      </div>
    </section>

    <!-- 材料与工具 -->
    <section class="weave-block">
      <header class="weave-head">
        <span class="weave-no">04</span>
        <h2>材料与工具</h2>
        <span class="weave-hint">先买够用的，别一次配齐</span>
      </header>
      <div class="weave-two-col">
        <div class="weave-table-card">
          <h3>线材怎么选</h3>
          <ul class="weave-materials">
            <li v-for="item in plan.materials" :key="item.name">
              <strong>{{ item.name }}</strong>
              <span>{{ item.use }}</span>
              <small>{{ item.note }}</small>
            </li>
          </ul>
        </div>
        <div class="weave-table-card">
          <h3>工具清单</h3>
          <ul class="weave-materials">
            <li v-for="item in plan.tools" :key="item.area">
              <strong>{{ item.area }}</strong>
              <span>{{ item.core }}</span>
              <small>可暂缓：{{ item.later }}</small>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <footer class="weave-footer">
      <span>{{ plan.meta.source }}</span>
      <span>{{ doneCount }} / {{ totalWeeks }} 周 · {{ percent }}%</span>
    </footer>
  </section>
</template>
