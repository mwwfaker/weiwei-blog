<script setup>
// 全屏看图。点空白或右上角关闭；本人照片可以在这里直接删。
//
// 关闭复用阅读弹窗那套「先定住一拍、再化作尘埃」的动效（composables/useDustClose.js），
// 粒子层铺在图片原来的位置上。所以这个组件**必须自己把退场动画播完再 emit('close')**：
// 外层一旦用 <Transition> 或立刻 v-if 摘掉它，效果根本来不及开始（两套动效也会打架）。
import { ref } from 'vue'
import { useDustClose } from '@/composables/useDustClose'
import DustBurst from '@/modules/modal/DustBurst.vue'
import { useAuthStore } from '@/stores/auth'
import { useMediaStore } from '@/stores/media'

const props = defineProps({ photo: { type: Object, required: true } })
const emit = defineEmits(['close'])

const media = useMediaStore()
const auth = useAuthStore()

// 量的是图片本身而不是整块背板：尘埃要从照片上剥落下来，不是从整个屏幕上。
const frame = ref(null)
const { closing, dustRect, dustCount, requestClose, DUST_HOLD_MS, DUST_MS } = useDustClose({
  target: frame,
  onClose: () => emit('close'),
})
</script>

<template>
  <div
    class="gallery-viewer"
    :class="{ 'is-dusting': closing }"
    :style="{ '--dust-ms': DUST_MS + 'ms' }"
    @click.self="requestClose"
  >
    <button class="viewer-close" aria-label="关闭大图" @click="requestClose">×</button>
    <button v-if="auth.isLoggedIn && props.photo.mine" class="viewer-delete" @click="media.remove(props.photo)">删除照片</button>
    <img ref="frame" :src="props.photo.image" :alt="props.photo.caption" />
    <div class="viewer-caption">
      <strong>{{ props.photo.caption }}</strong>
      <p v-if="props.photo.description" class="viewer-desc">{{ props.photo.description }}</p>
      <span>{{ props.photo.albumName || '日常' }} · {{ props.photo.date }}</span>
    </div>
    <DustBurst v-if="closing && dustRect" :rect="dustRect" :hold="DUST_HOLD_MS" :count="dustCount" />
  </div>
</template>
