<script setup>
// 照片网格。每张照片下面挂一排只有本人可见的操作（编辑 / 移动 / 改可见范围 / 删除）。
//
// 还带一层**多选**：整理相册是一批一批挪的，一张张点「编辑」再选相册太慢。
// 顶部那条工具条在多选时变成「已选 N 张 / 移到相册 / 取消」。
import { useAuthStore } from '@/stores/auth'
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()
const auth = useAuthStore()
defineEmits(['preview'])
</script>

<template>
  <div class="gallery-block">
    <!-- 多选工具条：登录后才有意义（访客本来就不能改）。数量由版面标题负责，这里只放动作。 -->
    <div v-if="auth.isLoggedIn" class="gallery-toolbar">
      <template v-if="media.selecting">
        <span class="gallery-toolbar-count">已选 {{ media.selectedPhotoIds.length }} 张</span>
        <button class="gallery-tool-action" :disabled="!media.selectedPhotoIds.length" @click="media.openPhotoMover()">移到相册</button>
        <button class="gallery-tool-action" @click="media.toggleSelecting(false)">取消</button>
      </template>
      <button v-else class="gallery-tool-action" @click="media.toggleSelecting(true)">选择照片</button>
    </div>

    <div class="gallery-grid album-grid">
      <figure v-for="photo in media.visibleGallery" :key="photo.id" :class="{ 'is-selected': media.isSelected(photo.id) }">
        <button class="gallery-photo" @click="media.selecting && auth.isLoggedIn ? media.togglePhotoSelection(photo.id) : $emit('preview', photo)">
          <!-- 网格里用缩略图（~30KB）；没有缩略图的老照片回退到原图 -->
          <img :src="photo.thumb || photo.image" :alt="photo.caption" loading="lazy" />
          <span v-if="media.selecting && auth.isLoggedIn" class="gallery-pick">{{ media.isSelected(photo.id) ? '✓' : '' }}</span>
        </button>
        <figcaption>
          <span>{{ photo.caption }}</span>
          <!-- 没进盒子的照片就说它「散落着」，不要凭空给它造一个「未分类」的名字 -->
          <small>{{ photo.albumId ? (photo.albumName || '') : '散落在外' }} · {{ photo.date }}</small>
          <em v-if="photo.description" class="gallery-desc">{{ photo.description }}</em>
        </figcaption>
        <div v-if="auth.isLoggedIn && photo.mine && !media.selecting" class="gallery-actions">
          <button @click="media.openEditor(photo)">编辑</button>
          <button @click="media.openPhotoMover([photo.id])">移动</button>
          <button @click="media.changeVisibility(photo)">{{ photo.visibility === 'PUBLIC' ? '设私密' : '公开' }}</button>
          <button class="danger-text" @click="media.remove(photo)">删除</button>
        </div>
      </figure>
    </div>
  </div>
</template>
