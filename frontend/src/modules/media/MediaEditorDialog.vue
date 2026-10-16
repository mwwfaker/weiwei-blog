<script setup>
// 照片信息编辑：名称、描述、所属相册、可见范围。
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
    <label>
      照片描述
      <textarea
        v-model="media.mediaDraft.description"
        rows="3"
        maxlength="500"
        placeholder="写点什么：当时的光线、心情、和谁在一起……"
      ></textarea>
    </label>
    <label>
      所属相册
      <select v-model="media.mediaDraft.albumId">
        <option :value="null">未分类</option>
        <optgroup v-for="album in media.rootAlbums" :key="album.id" :label="album.name">
          <option :value="album.id">{{ album.name }}（整个相册）</option>
          <option v-for="child in media.childrenOf(album.id)" :key="child.id" :value="child.id">{{ child.name }}</option>
        </optgroup>
      </select>
    </label>
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
