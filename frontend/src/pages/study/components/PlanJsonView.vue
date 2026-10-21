<script setup>
// 渲染导入的 JSON 学习计划：统计、阶段、课程卡、勾选进度。
// 结构由 services/studyJson.js 归一化过，这里不做任何猜测。
import { computed, ref, watch } from 'vue'
import { readStoredJson, writeStoredJson } from '@/services/storage'

const props = defineProps({ plan: { type: Object, required: true }, planId: { type: String, required: true } })
defineEmits(['back', 'remove'])

const progressKey = computed(() => `weiwei-blog-study-done:${props.planId}`)
const done = ref(readStoredJson(progressKey.value, {}) || {})
watch(progressKey, (key) => { done.value = readStoredJson(key, {}) || {} })
watch(done, (value) => writeStoredJson(progressKey.value, value), { deep: true })

const courses = computed(() => props.plan.stages.flatMap((stage) => stage.courses))
const doneCount = computed(() => courses.value.filter((_, index) => done.value[`${index}`]).length)
const percent = computed(() => (courses.value.length ? Math.round((doneCount.value / courses.value.length) * 100) : 0))
const resourceCount = computed(() => courses.value.reduce((sum, course) => sum + course.resources.length, 0))
const hoursLabel = computed(() => {
  const { low = 0, high = 0 } = props.plan.totalHours || {}
  if (!low && !high) return '未估算'
  return low && high ? `${low}–${high} 小时` : `${low || high} 小时`
})
const stars = (value) => '★★★★★'.slice(0, value) + '☆☆☆☆☆'.slice(0, 5 - value)
const courseIndex = (stageIndex, courseIndex_) => {
  let index = 0
  for (let i = 0; i < stageIndex; i += 1) index += props.plan.stages[i].courses.length
  return index + courseIndex_
}
function toggle(index) {
  const key = `${index}`
  if (done.value[key]) delete done.value[key]
  else done.value[key] = new Date().toISOString().slice(0, 10)
}
</script>

<template>
  <section class="plan-view">
    <header class="plan-hero">
      <div class="plan-kicker">IMPORTED PLAN · JSON</div>
      <h1 class="plan-title">{{ plan.title }}</h1>
      <p v-if="plan.subtitle" class="plan-subtitle">{{ plan.subtitle }}</p>
      <p v-if="plan.summary" class="plan-summary">{{ plan.summary }}</p>
      <div v-if="plan.tags.length" class="plan-tags"><span v-for="tag in plan.tags" :key="tag">{{ tag }}</span></div>
      <div class="plan-actions">
        <button class="doc-btn" @click="$emit('back')">← 学习库</button>
        <button class="doc-btn doc-btn-quiet" @click="$emit('remove')">移除这份计划</button>
      </div>
    </header>

    <div class="plan-stats">
      <div><b>{{ plan.stages.length }}</b><span>个阶段</span></div>
      <div><b>{{ courses.length }}</b><span>门课程</span></div>
      <div><b>{{ hoursLabel }}</b><span>建议投入</span></div>
      <div><b>{{ resourceCount }}</b><span>条资源</span></div>
    </div>

    <div class="plan-progress">
      <div class="plan-progress-bar"><i :style="{ width: `${percent}%` }"></i></div>
      <span>{{ doneCount }} / {{ courses.length }} 已完成 · {{ percent }}%</span>
    </div>

    <section v-for="(stage, si) in plan.stages" :key="si" class="plan-stage">
      <header class="plan-stage-head">
        <span class="plan-stage-no">{{ String(si + 1).padStart(2, '0') }}</span>
        <div>
          <h2>{{ stage.title }}</h2>
          <p v-if="stage.goal">{{ stage.goal }}</p>
        </div>
        <span v-if="stage.duration" class="plan-stage-duration">{{ stage.duration }}</span>
      </header>

      <article v-for="(course, ci) in stage.courses" :key="ci" class="plan-course" :class="{ 'is-done': done[`${courseIndex(si, ci)}`] }">
        <label class="plan-check">
          <input type="checkbox" :checked="Boolean(done[`${courseIndex(si, ci)}`])" @change="toggle(courseIndex(si, ci))" />
          <span></span>
        </label>
        <div class="plan-course-main">
          <div class="plan-course-top">
            <strong>{{ course.name }}</strong>
            <span class="plan-stars" :title="`重要性 ${course.importance} / 5`">{{ stars(course.importance) }}</span>
          </div>
          <div class="plan-course-meta">
            <span v-if="course.hours">{{ course.hours }}</span>
            <span v-if="course.prerequisite">前置：{{ course.prerequisite }}</span>
          </div>
          <div v-if="course.concepts.length" class="plan-chips">
            <span v-for="concept in course.concepts" :key="concept">{{ concept }}</span>
          </div>
          <ul v-if="course.criteria.length" class="plan-criteria">
            <li v-for="(item, i) in course.criteria" :key="i">{{ item }}</li>
          </ul>
          <div v-if="course.resources.length" class="plan-links">
            <a v-for="link in course.resources" :key="link.url || link.title" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.title || link.url }} ↗</a>
          </div>
        </div>
      </article>
    </section>
  </section>
</template>
