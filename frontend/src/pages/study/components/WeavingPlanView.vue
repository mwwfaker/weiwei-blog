<script setup>
// 手工编织与纤维手作：版面与金融计划保持一致（同样的 hero、统计卡、分节标题、卡片语言），
// 只是内容的形状不同：技法单元、40 周路线、项目库、材料工具。
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
    <nav class="weave-topbar" aria-label="当前计划">
      <button class="weave-back" @click="$emit('back')">← 学习库</button>
      <span class="weave-topbar-name">手工编织与纤维手作</span>
      <span class="weave-topbar-note">7 大技法 · 40 周 · 13 个项目</span>
    </nav>

    <!-- 首屏：和金融计划同一套 hero -->
    <section class="weave-hero">
      <div class="weave-hero-glow" aria-hidden="true"></div>
      <div class="weave-hero-main">
        <div class="section-kicker">FIBER CRAFT · 40 WEEKS <span></span></div>
        <h1>手工编织与纤维手作<em>。</em></h1>
        <p class="weave-subtitle">{{ plan.meta.subtitle }}</p>
        <div class="weave-tags">
          <span v-for="tech in plan.techniques" :key="tech.id">{{ tech.name }}</span>
        </div>
        <p class="weave-principle">{{ plan.meta.intro }}</p>
        <p class="weave-start"><b>第 1 周</b>整理工具与材料 → 认识线材 → 织 / 钩出第一块 10×10 cm 样片</p>
        <p class="weave-version">{{ plan.meta.source }}</p>
      </div>
      <div class="weave-hero-stats">
        <div class="weave-stat"><strong>{{ plan.phases.length }}</strong><small>个阶段</small></div>
        <div class="weave-stat"><strong>{{ plan.techniques.length }}</strong><small>大技法</small></div>
        <div class="weave-stat"><strong>{{ totalWeeks }}</strong><small>周课程</small></div>
        <div class="weave-stat"><strong>{{ unitCount }}</strong><small>个技法单元</small></div>
        <div class="weave-stat is-wide"><strong>{{ plan.projects.length }}</strong><small>个项目（从围巾到毛衣）</small></div>
      </div>
    </section>

    <!-- 进度 -->
    <section class="weave-section">
      <header class="weave-section-head">
        <div>
          <div class="section-kicker">YOUR PROGRESS <span></span></div>
          <h2>学习进度</h2>
        </div>
        <span class="weave-hint">勾选单元或周次都会累计到这里</span>
      </header>
      <div class="weave-progress-row">
        <div class="weave-progress-card">
          <div class="weave-progress-top"><span>40 周路线</span><b>{{ weeksDone }} / {{ totalWeeks }} · {{ weekPercent }}%</b></div>
          <div class="weave-progress-bar"><i :style="{ width: `${weekPercent}%` }"></i></div>
        </div>
        <div class="weave-progress-card">
          <div class="weave-progress-top"><span>技法单元</span><b>{{ unitsDone }} / {{ unitCount }} · {{ unitPercent }}%</b></div>
          <div class="weave-progress-bar is-alt"><i :style="{ width: `${unitPercent}%` }"></i></div>
        </div>
      </div>
    </section>

    <!-- 从这里开始 -->
    <section class="weave-section">
      <header class="weave-section-head">
        <div>
          <div class="section-kicker">HOW TO START <span></span></div>
          <h2>从这里开始</h2>
        </div>
        <span class="weave-hint">{{ plan.meta.usage }}</span>
      </header>
      <div class="weave-steps">
        <article class="weave-step">
          <span class="weave-step-no">01</span>
          <strong>先打基础（第 1–4 周）</strong>
          <p>棒针起针与下针、钩针锁针与短针、手缝三种线迹。展开下面「技法地图」里的 B / C / S，把前两个单元的「达标点」做出来再往后走。</p>
        </article>
        <article class="weave-step">
          <span class="weave-step-no">02</span>
          <strong>按周推进（每周 3 次）</strong>
          <p>用「40 周路线」当课表：每次 45–90 分钟，先做 10×10 cm 样片再做成品。每周勾掉一格，不追求速度。</p>
        </article>
        <article class="weave-step">
          <span class="weave-step-no">03</span>
          <strong>用作品验收</strong>
          <p>围巾 → 帽子/方片 → 修补 → 刺绣/拼布 → 编绳/羊毛毡 → 毛衣。每个阶段做完一件再进入下一段，项目卡里都有对应教程。</p>
        </article>
      </div>
    </section>

    <!-- 技法地图 -->
    <section class="weave-section">
      <header class="weave-section-head">
        <div>
          <div class="section-kicker">TECHNIQUE MAP <span></span></div>
          <h2>技法地图</h2>
        </div>
        <span class="weave-hint">{{ plan.techniques.length }} 个方向 · {{ unitCount }} 个单元，点开看单元达标点、配图与教程</span>
      </header>
      <div class="weave-tech-grid">
        <details v-for="(tech, techIndex) in plan.techniques" :key="tech.id" class="weave-tech" :open="techIndex === 0">
          <summary>
            <span class="weave-tech-thumb">
              <img v-if="tech.figures?.length" :src="tech.figures[0]" alt="" loading="lazy" />
              <b v-else>{{ tech.code }}</b>
            </span>
            <span class="weave-tech-title">
              <strong>{{ tech.name }}</strong>
              <small>{{ tech.summary }}</small>
            </span>
            <span class="weave-tech-count">{{ tech.units.length }} 单元 · {{ tech.links?.length || 0 }} 链接</span>
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
    <section class="weave-section">
      <header class="weave-section-head">
        <div>
          <div class="section-kicker">40-WEEK ROADMAP <span></span></div>
          <h2>40 周路线</h2>
        </div>
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
    <section class="weave-section">
      <header class="weave-section-head">
        <div>
          <div class="section-kicker">PROJECTS <span></span></div>
          <h2>项目库</h2>
        </div>
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
    <section class="weave-section">
      <header class="weave-section-head">
        <div>
          <div class="section-kicker">MATERIALS &amp; TOOLS <span></span></div>
          <h2>材料与工具</h2>
        </div>
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
    <section v-if="plan.miscResources?.length" class="weave-section">
      <header class="weave-section-head">
        <div>
          <div class="section-kicker">RESOURCES <span></span></div>
          <h2>公开资源</h2>
        </div>
        <span class="weave-hint">跨方向的免费资料与图库</span>
      </header>
      <div class="weave-links is-wide">
        <a v-for="item in plan.miscResources" :key="item.url" :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.title }} ↗</a>
      </div>
    </section>

    <footer class="weave-footer">
      <span>{{ plan.meta.source }}</span>
      <span>{{ weeksDone }} / {{ totalWeeks }} 周 · {{ unitsDone }} / {{ unitCount }} 单元</span>
    </footer>
  </section>
</template>
