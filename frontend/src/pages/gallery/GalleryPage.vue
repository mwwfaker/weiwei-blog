<script setup>
// 相册页：相册筛选 + 网格 + 大图查看。
import { ref } from 'vue'
import AlbumBar from '@/modules/media/AlbumBar.vue'
import GalleryGrid from '@/modules/media/GalleryGrid.vue'
import EmptyState from '@/modules/page/EmptyState.vue'
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { requireLogin } from '@/app/useGuard'
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()
const picker = ref(null)

function openPicker() {
  if (!requireLogin('上传照片')) return
  picker.value?.click()
}

function onPicked(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (file) media.addPhoto(file)
}
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="A CAMERA ROLL OF LITTLE JOYS"
      title="生活切片"
      mark="♡"
      subtitle="被光照亮的瞬间，我都悄悄收好了。"
    >
      <button class="button-primary" @click="openPicker">⇧ &nbsp;添加照片</button>
      <input ref="picker" type="file" accept="image/*" hidden @change="onPicked" />
    </InnerPageHeader>

    <AlbumBar />

    <EmptyState
      v-if="!media.galleryItems.length"
      icon="▧"
      title="这里还没有照片"
      text="上传照片后，可以建相册与子相册把它们分开收好，给每张写下描述，并按需公开或删除。"
      action-label="上传本地照片"
      @action="openPicker"
    />

    <GalleryGrid @preview="media.galleryPreview = $event" />
  </section>
</template>
