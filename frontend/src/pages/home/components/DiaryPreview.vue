<script setup>
// 首页的「日记碎片」：自己写过就显示自己最近的，还没写过（访客、新账号）就显示大家的公开日记。
import { go } from '@/app/usePageNav'
import { useDiariesStore } from '@/stores/diaries'

const diaries = useDiariesStore()
</script>

<template>
  <section class="diary-preview">
    <div class="lower-heading">
      <div>
        <div class="section-kicker">{{ diaries.homeShowsOwnDiaries ? 'FROM MY DIARY' : 'FROM PUBLIC DIARIES' }} <span></span></div>
        <h2>日记碎片</h2>
      </div>
      <button class="round-link" @click="go('diary')">↗</button>
    </div>
    <button
      v-for="entry in diaries.homeDiaries"
      :key="entry.id"
      class="diary-row"
      @click="diaries.selectedDiary = entry"
    >
      <span class="diary-date">
        <strong>{{ entry.date.slice(8) }}</strong>
        <small>{{ entry.date.slice(0, 7).replace('-', '.') }}</small>
      </span>
      <span class="diary-row-copy">
        <strong>{{ entry.title }}</strong>
        <small>{{ entry.content.slice(0, 44) }}{{ entry.content.length > 44 ? '…' : '' }}</small>
      </span>
      <span class="diary-mood">{{ entry.weather }}</span>
    </button>
  </section>
</template>
