<script setup>
// 相册分类条：左边是一排相册胶囊，右边是当前筛选出的照片数。
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()
</script>

<template>
  <div class="album-bar">
    <div class="album-pills">
      <button
        v-for="album in media.albumNames"
        :key="album"
        :class="{ active: media.selectedAlbum === album }"
        @click="media.selectedAlbum = album"
      >{{ album }}</button>
    </div>
    <span>{{ media.visibleGallery.length }} 张照片</span>
  </div>
</template>
