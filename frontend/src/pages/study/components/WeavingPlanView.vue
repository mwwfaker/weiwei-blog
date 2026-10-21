<script setup>
// 手工编织与纤维手作：这一页是为这份课程单独做的版面。
// 内容有六种形状：技法（单元 + 图 + 链接）、40 周路线（可勾选）、项目库（自带资源）、
// 材料工具、公开资源。资源挂在它该在的位置，而不是最后堆一串。
import { computed, ref, watch } from 'vue'
import { readStoredJson, writeStoredJson } from '@/services/storage'
import { weavingPlan as plan } from '../data/weavingPlan'

defineEmits(['back'])

const PROGRESS_KEY = 'weiwei-blog-weaving-progress-v2'
const done = ref(readStoredJson(PROGRESS_KEY, {}) || {})
watch(done, (value) => writeStoredJson(PROGRESS_KEY, value), { deep: true })

const totalWeeks = computed(() => plan.weeks.length)
const weeksDone = computed(() => plan.weeks.filter((week) => done.value[`w${week.n}`]).length)
const weekPercent = computed(() => (totalWeeks.value ? Math.round((weeksDone.value / totalWeeks.value) * 100) : 0))

const allUnits = computed(() => plan.techniques.flatMap((tech) => tech.units))
const unitCount = computed(() => allUnits.value.length)
const unitsDone = computed(() => allUnits.value.filter((unit) => done.value[`u${unit.code}`]).length)
const unitPercent = computed(() => (unitCount.value ? Math.round((unitsDone.value / unitCount.value) * 100) : 0))

function toggle(key) {
  if (done.value[key]) delete done.value[key]
  else done.value[key] = new Date().toISOString().slice(0, 10)
}
function weeksOf(phase) {
  const [from, to] = String(phase.weeks).split(/[–-]/).map((value) => Number(String(value).replace(/[^\d]/g, '')))
  return plan.weeks.filter((week) => week.n >= from && week.n <= (to || from))
}
const phaseDone = (phase) => weeksOf(phase).filter((week) => done.value[`w${week.n}`]).length
</script>

<template>
  <section class="weave-page">
    <header class="weave-hero">
      <div class="weave-hero-copy">
        <div class="weave-kicker">FIBER CRAFT · 40 WEEKS</div>
        <h1>{{ plan.meta.title }}</h1>
        <p class="weave-subtitle">{{ plan.meta.subtitle }}</p>
        <p class="weave-intro">{{ plan.meta.intro }}</p>

        <div class="weave-statline">
          <span><b>{{ plan.phases.length }}</b> 阶段</span>
          <span><b>{{ plan.techniques.length }}</b> 技法</span>
          <span><b>{{ totalWeeks }}</b> 周</span>
          <span><b>{{ unitCount }}</b> 单元</span>
          <span><b>{{ plan.projects.length }}</b> 项目</span>
        </div>

        <div class="weave-progress">
          <div class="weave-progress-bar"><i :style="{ width: `${weekPercent}%` }"></i></div>
          <span>40 周路线：{{ weeksDone }} / {{ totalWeeks }} 周 · {{ weekPercent }}%</span>
        </div>
        <div class="weave-progress">
          <div class="weave-progress-bar weave-progress-bar-alt"><i :style="{ width: `${unitPercent}%` }"></i></div>
          <span>技法单元：{{ unitsDone }} / {{ unitCount }} 个 · {{ unitPercent }}%</span>
        </div>

        <div class="weave-actions">
          <button class="doc-btn" @click="$emit('back')">← 学习库</button>
        </div>
        <p class="weave-usage">{{ plan.meta.usage }}</p>
      </div>

      <figure class="weave-cover">
        <img src="/weaving/fig-5.jpg" alt="课程配图：拼布拼接与压线" loading="eager" />
        <figcaption>课程配图 · 拼布与布艺</figcaption>
      </figure>
    </header>

    <!-- 技法地图 -->
    <section class="weave-block">
      <header class="weave-head">
        <span class="weave-no">01</span>
        <h2>技法地图</h2>
        <span class="weave-hint">{{ plan.techniques.length }} 个方向 · {{ unitCount }} 个单元，每单元都有图和链接</span>
      </header>
      <div class="weave-tech-grid">
        <details v-for="tech in plan.techniques" :key="tech.id" class="weave-tech">
          <summary>
            <span class="weave-tech-thumb">
              <img v-if="tech.figures?.length" :src="tech.figures[0]" alt="" loading="lazy" />
              <b v-else>{{ tech.code }}</b>
            </span>
            <span class="weave-tech-title">
              <strong>{{ tech.name }}</strong>
              <small>{{ tech.summary }}</small>
            </span>
            <span class="weave-tech-count">{{ tech.units.length }} 单元</span>
          </summary>

          <div v-if="tech.figures?.length" class="weave-tech-figures">
            <a v-for="src in tech.figures" :key="src" :href="src" target="_blank" rel="noopener noreferrer">
              <img :src="src" alt="" loading="lazy" />
            </a>
          </div>

          <ul class="weave-units">
            <li v-for="unit in tech.units" :key="unit.code" :class="{ 'is-done': done[`u${unit.code}`] }">
              <label>
                <input type="checkbox" :checked="Boolean(done[`u${unit.code}`])" @change="toggle(`u${unit.code}`)" />
                <b>{{ unit.code }}</b>
                <span>{{ unit.skill }}</span>
                <small>{{ unit.pass }}</small>
              </label>
            </li>
          </ul>

          <div v-if="tech.links?.length" class="weave-links">
            <a v-for="link in tech.links" :key="link.url" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.title }} ↗</a>
          </div>
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
            <li v-for="week in weeksOf(phase)" :key="week.n" :class="{ 'is-done': done[`w${week.n}`] }">
              <label>
                <input type="checkbox" :checked="Boolean(done[`w${week.n}`])" @change="toggle(`w${week.n}`)" />
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
        <span class="weave-hint">从围巾到毛衣，每个项目都带教程链接</span>
      </header>
      <div class="weave-project-grid">
        <article v-for="project in plan.projects" :key="project.name" class="weave-project">
          <a v-if="project.figure" :href="project.figure" target="_blank" rel="noopener noreferrer" class="weave-project-figure">
            <img :src="project.figure" alt="" loading="lazy" />
          </a>
          <div class="weave-project-head">
            <strong>{{ project.name }}</strong>
            <span class="weave-project-level">{{ project.level }}</span>
          </div>
          <small>{{ project.size }}</small>
          <em>练什么：{{ project.learn }}</em>
          <div v-if="project.links?.length" class="weave-links">
            <a v-for="link in project.links" :key="link.url" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.title }} ↗</a>
          </div>
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

    <!-- 公开资源 -->
    <section v-if="plan.miscResources?.length" class="weave-block">
      <header class="weave-head">
        <span class="weave-no">05</span>
        <h2>公开资源</h2>
        <span class="weave-hint">跨方向的免费资料与图库</span>
      </header>
      <div class="weave-resource-links">
        <a v-for="item in plan.miscResources" :key="item.url" :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.title }} ↗</a>
      </div>
    </section>

    <footer class="weave-footer">
      <span>{{ plan.meta.source }}</span>
      <span>{{ weeksDone }} / {{ totalWeeks }} 周 · {{ unitsDone }} / {{ unitCount }} 单元</span>
    </footer>
  </section>
</template>
