<script setup>
// 照片信息面板：拍摄参数（EXIF）与这张照片的主色。
//
// 两块都是**点开才算**的：EXIF 只取图片前 256 KB，配色板把图画到 96×96 数一遍。
// 两者都失败也正常（社交平台会抹掉 EXIF、跨域图片可能读不了像素）——
// 这时面板显示一句"没有"，而不是报错。
import { computed, onMounted, ref } from 'vue'
import { readPhotoExif } from '@/services/exif'
import { extractPalette } from '@/services/palette'

const props = defineProps({ photo: { type: Object, required: true } })

const rows = ref([])
const palette = ref([])
const loading = ref(true)
const copied = ref('')

const hasAny = computed(() => rows.value.length || palette.value.length)

async function load() {
  loading.value = true
  const [exif, colors] = await Promise.all([
    readPhotoExif(props.photo.image),
    extractPalette(props.photo.image, 5),
  ])
  rows.value = exif
  palette.value = colors
  loading.value = false
}

async function copyColor(hex) {
  try {
    await navigator.clipboard.writeText(hex)
    copied.value = hex
    setTimeout(() => { if (copied.value === hex) copied.value = '' }, 1600)
  } catch { /* 没有剪贴板权限就算了，不值得打扰用户 */ }
}

onMounted(load)
</script>

<template>
  <aside class="photo-info">
    <p v-if="loading" class="photo-info-loading">正在读这张照片的信息…</p>

    <template v-else>
      <p v-if="!hasAny" class="photo-info-loading">
        这张照片没有可读的拍摄信息 —— 截图、或从社交平台保存的图，元数据通常会被抹掉。
      </p>

      <div v-if="palette.length" class="photo-info-block">
        <h4>这张的主色</h4>
        <div class="photo-palette">
          <button
            v-for="color in palette"
            :key="color"
            class="photo-swatch"
            :style="{ background: color }"
            :title="`点一下复制 ${color}`"
            @click="copyColor(color)"
          ><span>{{ copied === color ? '已复制' : color }}</span></button>
        </div>
      </div>

      <div v-if="rows.length" class="photo-info-block">
        <h4>拍摄信息</h4>
        <dl class="photo-exif">
          <template v-for="row in rows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>
              <a v-if="row.href" :href="row.href" target="_blank" rel="noreferrer noopener">{{ row.value }} ↗</a>
              <span v-else>{{ row.value }}</span>
            </dd>
          </template>
        </dl>
      </div>
    </template>
  </aside>
</template>
