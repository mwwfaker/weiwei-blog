<script setup>
// 两个 <audio> 元素。它们在应用外壳里常驻，所以切页面不会中断播放。
//
// 为什么不放在音乐页：右下角的音乐盒在任何页面都能控制播放，音频元素一旦随音乐页卸载，
// 换页就断声。
//
// 省电模式切换时要换掉这个元素：Web Audio 的 MediaElementAudioSourceNode 一旦建立就和元素
// 绑死，同一个元素不能再建第二个。`key` 绑在 lowPower 上，Vue 会创建干净的元素，
// watchEffect 再把新的引用交给 store。
import { onUnmounted, ref, watchEffect } from 'vue'
import { useMusicStore } from '@/stores/music'

const music = useMusicStore()
const audioElement = ref(null)
const remoteAudioElement = ref(null)

watchEffect(() => music.attachAudio(audioElement.value, remoteAudioElement.value))
onUnmounted(() => music.dispose())
</script>

<template>
  <!-- preload="auto"：提前缓冲，别等播到一半才去要数据。
       waiting / stalled / error 三个事件是音频卡顿的直接证据，计数显示在音乐页上。 -->
  <audio
    :key="music.lowPower ? 'audio-lite' : 'audio-full'"
    ref="audioElement"
    crossorigin="anonymous"
    @ended="music.onAudioEnded($event)"
    @timeupdate="music.onTimeUpdate"
    @loadedmetadata="music.onLoadedMetadata"
    @play="music.setPlaying(true)"
    @pause="music.setPlaying(false)"
    @error="music.onAudioError"
  />
  <audio
    ref="remoteAudioElement"
    @ended="music.onAudioEnded($event)"
    @timeupdate="music.onTimeUpdate"
    @loadedmetadata="music.onLoadedMetadata"
    @play="music.setPlaying(true)"
    @pause="music.setPlaying(false)"
    @error="music.onAudioError"
  />
</template>
