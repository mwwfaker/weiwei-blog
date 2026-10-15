<script setup>
// 音乐库：上传入口、在线直链、曲目列表。
//
// 列表里每一行都只在「本人 + 已登录」时显示可见范围切换、编辑和删除；
// 播放按钮对所有人可用（公开曲目本来就能播）。
import { ref } from 'vue'
import EmptyState from '@/modules/page/EmptyState.vue'
import { requireLogin } from '@/app/useGuard'
import { useAuthStore } from '@/stores/auth'
import { useMediaStore } from '@/stores/media'
import { useMusicStore } from '@/stores/music'

const music = useMusicStore()
const media = useMediaStore()
const auth = useAuthStore()

const uploadPicker = ref(null)
const previewPicker = ref(null)

function openUploadPicker() {
  if (!requireLogin('上传音乐')) return
  uploadPicker.value?.click()
}

function onUploadPicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) music.addMusic(file)
}

function onPreviewPicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) music.playLocalFile(file)
}

// 音乐页标题栏的「添加音乐」要复用同一个入口，所以把打开选择框的动作暴露出去。
defineExpose({ openUploadPicker })
</script>

<template>
  <div class="music-library-controls">
    <button class="button-primary" @click="openUploadPicker">＋ 上传本地音乐</button>
    <button class="button-secondary" @click="previewPicker?.click()">♫ 本机试听</button>
    <input v-model="music.remoteMusicUrl" placeholder="HTTPS 音频文件直链（MP3 / M4A / OGG）" />
    <button class="button-secondary" @click="music.addRemoteMusic()">加入列表</button>
    <input ref="uploadPicker" type="file" accept="audio/*" hidden @change="onUploadPicked" />
    <input ref="previewPicker" type="file" accept="audio/*" hidden @change="onPreviewPicked" />
  </div>

  <div class="music-list">
    <article
      v-for="(item, index) in music.musicItems"
      :key="item.id"
      class="music-row"
      :class="{ playing: item.id === music.activeTrackId }"
    >
      <span class="music-row-index">{{ String(index + 1).padStart(2, '0') }}</span>
      <button class="music-row-play" :aria-label="`播放 ${item.name}`" @click="music.playMusicItem(item)">
        <span v-if="item.id === music.activeTrackId && music.playing">Ⅱ</span><span v-else>▶</span>
      </button>
      <span class="music-row-name">
        <strong>{{ item.name }}</strong>
        <small>
          {{ item.visibility === 'PUBLIC' ? '公开曲目' : item.key ? '已保存到音乐库' : '本机预览' }}<template v-if="item.id === music.activeTrackId"> · 正在播放</template>
        </small>
      </span>
      <span v-if="item.id === music.activeTrackId" class="music-row-bars" aria-hidden="true">
        <i v-for="n in 4" :key="n" :style="{ '--n': n }"></i>
      </span>
      <button v-if="auth.isLoggedIn && item.mine" class="privacy-toggle" @click="media.changeVisibility(item)">{{ item.visibility === 'PUBLIC' ? '公开' : '仅自己' }}</button>
      <button v-if="auth.isLoggedIn && item.mine" class="icon-button" title="修改曲目" @click="music.edit(item)">✎</button>
      <button v-if="auth.isLoggedIn && item.mine" class="icon-button danger-icon" title="删除曲目" @click="music.deleteTrack(item)">×</button>
    </article>

    <EmptyState
      v-if="!music.musicItems.length"
      icon="♫"
      title="音乐库还是空的"
      text="上传本地音频，或添加可直接播放的 HTTPS 音频文件地址。网页链接通常不能直接播放。"
      action-label="选择音乐文件"
      @action="openUploadPicker"
    />
  </div>
</template>
