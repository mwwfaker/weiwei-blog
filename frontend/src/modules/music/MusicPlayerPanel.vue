<script setup>
// 音乐页的播放器面板：唱片 + 频谱 + 进度 + 控制条。
//
// 这个组件只负责「显示与转发」，全部状态和动作来自 stores/music.js。
// 性能取舍写在模板里的注释上（涟漪 24fps、省电模式整块关掉）。
import { useIsDark } from '@/app/theme'
import MusicVisualizer from './MusicVisualizer.vue'
import { formatTime, useMusicStore, vizModes } from '@/stores/music'

const music = useMusicStore()
const isDark = useIsDark()
</script>

<template>
  <section class="music-player-panel" aria-label="播放器">
    <div class="music-disc">
      <!-- 唱片周围的涟漪一直存在，跟着节拍一圈圈扩散。
           它是慢速的装饰，24fps 完全够用，没必要和主频谱抢帧。 -->
      <MusicVisualizer
        v-if="!music.lowPower"
        class="music-disc-ripple"
        mode="ripple"
        :analyser="music.analyser"
        :playing="music.playing"
        :is-dark="isDark"
        :max-fps="24"
      />
      <div class="music-disc-vinyl" :class="{ spinning: music.playing }" aria-hidden="true"><span>♫</span></div>
    </div>

    <div class="music-player-copy">
      <div class="section-kicker">NOW PLAYING <span></span></div>
      <h2>{{ music.nowPlayingLabel }}</h2>
      <p class="music-stage-note">
        {{ music.playing
          ? (music.analyser ? '正在播放 · 频谱驱动背景粒子' : '正在播放 · 外链音频无法读取频谱，粒子为待机呼吸')
          : '从下面的曲库选一首，或上传本机音乐' }}
      </p>
    </div>

    <MusicVisualizer
      v-if="!music.lowPower"
      class="music-stage-viz"
      :mode="music.vizMode"
      :analyser="music.analyser"
      :playing="music.playing"
      :is-dark="isDark"
      :bars="44"
    />

    <div v-if="!music.lowPower" class="music-viz-modes" role="group" aria-label="可视化模式">
      <button
        v-for="mode in vizModes"
        :key="mode.id"
        :class="{ active: music.vizMode === mode.id }"
        @click="music.setVizMode(mode.id)"
      >{{ mode.label }}</button>
    </div>

    <div
      class="music-progress"
      role="slider"
      :aria-valuenow="Math.round(music.progressPercent)"
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label="播放进度"
      @click="music.seekTo"
    >
      <div class="music-progress-fill" :style="{ width: `${music.progressPercent}%` }"></div>
      <span class="music-progress-knob" :style="{ left: `${music.progressPercent}%` }"></span>
    </div>

    <div class="music-time">
      <span>{{ formatTime(music.currentTime) }}</span>
      <span>{{ formatTime(music.trackDuration) }}</span>
    </div>

    <div class="music-controls">
      <button class="music-skip" aria-label="上一首" @click="music.playOffset(-1)">⏮</button>
      <button class="music-control-main" :class="{ isPlaying: music.playing }" aria-label="播放或暂停" @click="music.toggleMusic">
        <span v-if="music.playing">Ⅱ</span><span v-else>▶</span>
      </button>
      <button class="music-skip" aria-label="下一首" @click="music.playOffset(1)">⏭</button>
      <label class="music-volume">
        <span aria-hidden="true">🔊</span>
        <input type="range" min="0" max="100" v-model="music.volume" @input="music.setVolume" aria-label="音量" />
      </label>
    </div>
  </section>
</template>
