<script setup>
// 音乐页：标题栏（省电开关 / 添加音乐）+ 播放器面板 + 导入队列 + 曲库。
//
// 歌词栏组件（modules/music/LyricsPanel.vue）目前没有挂在这一页上：当前版本的播放器是单栏，
// 组件仍然保留、也有渲染测试覆盖，接回来只需要在 .music-console 里加一列。
import { ref } from 'vue'
import ImportQueue from '@/modules/music/ImportQueue.vue'
import MusicLibrary from '@/modules/music/MusicLibrary.vue'
import MusicPlayerPanel from '@/modules/music/MusicPlayerPanel.vue'
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { vReveal } from '@/composables/motion'
import { useMusicStore } from '@/stores/music'

const music = useMusicStore()
// 标题栏的「添加音乐」和曲库里的「上传本地音乐」是同一个入口，复用曲库组件暴露的方法。
const library = ref(null)
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="SOUNDS FOR YOUR LITTLE WORLD"
      title="音乐收藏"
      mark="♫"
      subtitle="点开就播，粒子跟着节拍流动。"
    >
      <div class="music-title-actions">
        <button
          class="button-secondary"
          :class="{ 'is-on': music.lowPower }"
          :title="music.lowPower ? '恢复粒子与频谱动效' : '关闭粒子与频谱，音频改走原生通路（卡顿时可以试）'"
          @click="music.setLowPower(!music.lowPower)"
        >{{ music.lowPower ? '◌ 省电模式' : '◉ 完整动效' }}</button>
        <button class="button-primary" @click="library?.openUploadPicker()">＋ &nbsp;添加音乐</button>
      </div>
    </InnerPageHeader>

    <!-- 左播放器 / 右歌词：和主流播放器一致的分工。窄屏会自动上下堆叠。 -->
    <div class="music-console" v-reveal>
      <MusicPlayerPanel />
    </div>

    <!-- 导入队列：上传、入库、解析歌词都在这一条条上走。放在曲库上方而不是浮在屏幕上，
         因为你就在这一页，没必要再弹一个窗口挡着自己。 -->
    <ImportQueue />

    <MusicLibrary ref="library" />
  </section>
</template>
