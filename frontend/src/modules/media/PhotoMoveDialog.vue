<script setup>
// 「移到相册」：把一张或一批照片挪到别的盒子里，也可以挪到盒子外面（散落）。
//
// 目标列表和「所属相册」那个下拉是同一套层级（一级相册 + 它的子相册），
// 但这里用**单选列表**而不是下拉：整理照片时一次要挪好几张，列表能一眼看全所有盒子。
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()
</script>

<template>
  <ModalShell
    close-label="关闭移动照片"
    card-class="album-manager"
    kicker="MOVE PHOTOS"
    title="移到相册"
    @close="media.photoMover = null"
  >
    <p class="move-hint">共 {{ media.photoMover?.ids.length || 0 }} 张照片，选一个去处：</p>

    <div class="move-list">
      <label class="move-option" :class="{ active: media.moveDraft.albumId === null }">
        <input v-model="media.moveDraft.albumId" type="radio" :value="null" />
        <span>不放进盒子（散落在外面）</span>
      </label>

      <template v-for="album in media.rootAlbums" :key="album.id">
        <label class="move-option" :class="{ active: media.moveDraft.albumId === album.id }">
          <input v-model="media.moveDraft.albumId" type="radio" :value="album.id" />
          <span>{{ album.name }}</span>
        </label>
        <label
          v-for="child in media.childrenOf(album.id)"
          :key="child.id"
          class="move-option move-option-child"
          :class="{ active: media.moveDraft.albumId === child.id }"
        >
          <input v-model="media.moveDraft.albumId" type="radio" :value="child.id" />
          <span>{{ album.name }} / {{ child.name }}</span>
        </label>
      </template>
    </div>

    <p v-if="!media.rootAlbums.length" class="album-empty">
      你还没有相册。先去「管理相册」建一本，照片才有地方可挪。
    </p>

    <div class="modal-actions">
      <span>一次只能挪到一本相册</span>
      <button class="button-primary" @click="media.savePhotoMove()">移动</button>
    </div>
  </ModalShell>
</template>
