<script setup>
// 照片信息编辑：名称、所属相册、可见范围。
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()
</script>

<template>
  <ModalShell
    close-label="关闭照片编辑"
    card-class="profile-editor"
    kicker="PHOTO DETAILS"
    title="编辑照片"
    @close="media.mediaEditor = null"
  >
    <label>照片名称<input v-model="media.mediaDraft.title" maxlength="180" /></label>
    <label>所属相册<input v-model="media.mediaDraft.albumName" maxlength="80" placeholder="例如：旅行、日常、家人" /></label>
    <label class="visibility-field">
      可见范围
      <select v-model="media.mediaDraft.visibility"><option value="PRIVATE">仅自己可见</option><option value="PUBLIC">公开</option></select>
    </label>
    <div class="modal-actions">
      <span>删除照片会同时移除对象存储文件</span>
      <button class="button-primary" @click="media.saveEdit()">保存信息</button>
    </div>
  </ModalShell>
</template>
