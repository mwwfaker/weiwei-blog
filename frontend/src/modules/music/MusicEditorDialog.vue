<script setup>
// 曲目设置：改名、改可见范围。
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useMusicStore } from '@/stores/music'

const music = useMusicStore()
</script>

<template>
  <ModalShell
    close-label="关闭曲目设置"
    card-class="profile-editor"
    kicker="MUSIC LIBRARY"
    title="曲目设置"
    @close="music.musicEditor = null"
  >
    <label>曲目名称<input v-model="music.musicDraft.title" maxlength="180" /></label>
    <label class="visibility-field">
      可见范围
      <select v-model="music.musicDraft.visibility"><option value="PRIVATE">仅自己可见</option><option value="PUBLIC">公开播放</option></select>
    </label>
    <div class="modal-actions">
      <span>更改保存到你的账号</span>
      <button class="button-primary" @click="music.saveEdit()">保存设置</button>
    </div>
  </ModalShell>
</template>
