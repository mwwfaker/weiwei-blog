<script setup>
// 音乐页内联的导入队列。
//
// 放在曲库上方而不是浮在屏幕上：上传和歌词匹配可能跑十几秒，但用户就在这一页，
// 没必要再弹一个窗口挡着他自己。关掉某一行不会中断任务本身。
import { vReveal } from '@/composables/motion'
import { useMusicStore } from '@/stores/music'

const music = useMusicStore()
</script>

<template>
  <section v-if="music.uploadJobs.length" class="import-queue" v-reveal aria-live="polite">
    <header class="import-queue-head">
      <div>
        <div class="section-kicker">IMPORT QUEUE <span></span></div>
        <h2>导入队列 <em>{{ music.uploadJobs.length }}</em></h2>
      </div>
      <div class="import-queue-tools">
        <span v-if="music.activeUploadCount" class="import-queue-live"><i aria-hidden="true"></i>{{ music.activeUploadCount }} 首处理中</span>
        <button v-else class="lyrics-tool" @click="music.clearFinishedJobs()">清空已完成</button>
      </div>
    </header>
    <div class="import-list">
      <article
        v-for="(job, index) in music.uploadJobs"
        :key="job.id"
        class="import-row"
        :class="[`is-${job.step}`, { 'is-indeterminate': music.uploadJobIndeterminate(job) }]"
      >
        <span class="import-row-index">{{ String(index + 1).padStart(2, '0') }}</span>
        <span class="import-row-mark" aria-hidden="true">
          <i v-if="job.step === 'done'">✓</i>
          <i v-else-if="job.step === 'error'">!</i>
          <!-- 解析歌词时动效就跑在这一行上：一排跳动的电平柱 -->
          <span v-else-if="job.step === 'lyrics'" class="import-row-eq"><i v-for="n in 4" :key="n" :style="{ '--n': n }"></i></span>
          <i v-else class="import-row-spinner"></i>
        </span>
        <span class="import-row-copy">
          <strong :title="job.name">{{ job.name }}</strong>
          <small>{{ job.message }}</small>
        </span>
        <span class="import-row-stage">{{ music.uploadStepLabel(job) }}</span>
        <span class="import-row-actions">
          <button v-if="job.step === 'done'" class="button-secondary import-row-play" @click="music.playJobTrack(job)">▶ &nbsp;播放</button>
          <button class="import-row-close" :aria-label="`从队列移除 ${job.name}`" @click="music.dismissUploadJob(job.id)">×</button>
        </span>
        <span class="import-row-bar" role="progressbar" :aria-valuenow="music.uploadJobProgress(job)" aria-valuemin="0" aria-valuemax="100">
          <i :style="{ width: `${music.uploadJobProgress(job)}%` }"></i>
        </span>
      </article>
    </div>
  </section>
</template>
