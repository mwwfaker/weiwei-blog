<script setup>
// 相册网格。每张照片下面挂一排只有本人可见的操作（编辑 / 改可见范围 / 删除）。
import { useAuthStore } from '@/stores/auth'
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()
const auth = useAuthStore()
defineEmits(['preview'])
</script>

<template>
  <div class="gallery-grid album-grid">
    <figure v-for="photo in media.visibleGallery" :key="photo.id">
      <button class="gallery-photo" @click="$emit('preview', photo)">
        <img :src="photo.image" :alt="photo.caption" />
      </button>
      <figcaption>
        <span>{{ photo.caption }}</span>
        <small>{{ photo.albumName || '日常' }} · {{ photo.date }}</small>
      </figcaption>
      <div v-if="auth.isLoggedIn && photo.mine" class="gallery-actions">
        <button @click="media.openEditor(photo)">编辑</button>
        <button @click="media.changeVisibility(photo)">{{ photo.visibility === 'PUBLIC' ? '设私密' : '公开' }}</button>
        <button class="danger-text" @click="media.remove(photo)">删除</button>
      </div>
    </figure>
  </div>
</template>
