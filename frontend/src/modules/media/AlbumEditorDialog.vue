<script setup>
// 编辑一本相册的名字与描述。名字是「这是什么」，描述是「里面都是些什么照片」。
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()
</script>

<template>
  <ModalShell
    close-label="关闭相册编辑"
    card-class="album-manager"
    kicker="ALBUM DETAILS"
    title="编辑相册"
    @close="media.albumEditor = null"
  >
    <label>相册名字<input v-model="media.albumEditDraft.name" maxlength="80" /></label>
    <label>
      相册描述
      <textarea
        v-model="media.albumEditDraft.description"
        rows="4"
        maxlength="500"
        placeholder="这一盒里都是些什么照片？什么时候拍的、和谁一起、为什么想留着……"
      ></textarea>
    </label>
    <div class="modal-actions">
      <span>描述会显示在盒子上，也会显示在相册里面</span>
      <button class="button-primary" @click="media.saveAlbumEditor()">保存</button>
    </div>
  </ModalShell>
</template>
