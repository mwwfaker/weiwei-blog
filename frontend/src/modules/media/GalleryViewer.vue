<script setup>
// 全屏看图。点空白或右上角关闭；本人照片可以在这里直接删。
import { useAuthStore } from '@/stores/auth'
import { useMediaStore } from '@/stores/media'

const props = defineProps({ photo: { type: Object, required: true } })
defineEmits(['close'])

const media = useMediaStore()
const auth = useAuthStore()
</script>

<template>
  <div class="gallery-viewer" @click.self="$emit('close')">
    <button class="viewer-close" aria-label="关闭大图" @click="$emit('close')">×</button>
    <button v-if="auth.isLoggedIn && props.photo.mine" class="viewer-delete" @click="media.remove(props.photo)">删除照片</button>
    <img :src="props.photo.image" :alt="props.photo.caption" />
    <div class="viewer-caption">
      <strong>{{ props.photo.caption }}</strong>
      <span>{{ props.photo.albumName || '日常' }} · {{ props.photo.date }}</span>
    </div>
  </div>
</template>
