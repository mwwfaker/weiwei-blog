<script setup>
// 足迹：把有拍摄地点的照片铺到地图上，按时间连成一条线。
//
// Leaflet 与它的样式都是**进这一页才加载**的（动态 import + 本页自己的 css），
// 所以平时翻别的页面不会多下一字节，也不用把地图样式塞进全局 styles/index.css。
//
// 地图瓦片用 OpenStreetMap 的公共服务（免费、不要 key）。国内可能慢或取不到 ——
// 那时 Leaflet 只会留一个背景色 + 我们的标记点，功能不崩：**标记点是自己画的，不依赖瓦片**。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import EmptyState from '@/modules/page/EmptyState.vue'
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { useMediaStore } from '@/stores/media'
import './map.css'

const media = useMediaStore()
const mapEl = ref(null)
const status = ref('loading') // loading | ready | failed
const failed = ref(false)

/** 有拍摄地点的照片，按拍摄（或上传）时间从早到晚 —— 这条顺序就是"足迹"。 */
const points = computed(() => [...media.geoPhotos].sort((a, b) => {
  const at = new Date(a.takenAt || 0).getTime()
  const bt = new Date(b.takenAt || 0).getTime()
  return at - bt
}))

/** 照片名称会拼进气泡的 HTML 里，必须转义（名字是用户自己写的）。 */
function escapeHtml(text) {
  return String(text || '').replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ))
}

let map = null

onMounted(async () => {
  if (!points.value.length) { status.value = 'ready'; return }
  try {
    const L = (await import('leaflet')).default
    await import('leaflet/dist/leaflet.css')
    map = L.map(mapEl.value, { worldCopyJump: true })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap',
    })
      .on('tileerror', () => { failed.value = true })
      .addTo(map)

    const route = []
    for (const photo of points.value) {
      const latlng = [photo.latitude, photo.longitude]
      route.push(latlng)
      const marker = L.circleMarker(latlng, {
        radius: 7, weight: 2, color: '#f3f1ff', fillColor: '#7779a6', fillOpacity: 0.95,
      }).addTo(map)
      const thumb = photo.thumb || photo.image
      const when = photo.takenAt ? new Date(photo.takenAt).toLocaleDateString('zh-CN') : photo.date
      marker.bindPopup(
        `<figure class="map-pop"><img src="${escapeHtml(thumb)}" alt="" /><figcaption><strong>${escapeHtml(photo.caption)}</strong><span>${escapeHtml(when)}</span></figcaption></figure>`,
        { closeButton: false, minWidth: 168 },
      )
      marker.on('click', () => { media.galleryPreview = photo })
    }
    if (route.length > 1) {
      L.polyline(route, { color: '#7779a6', weight: 2, opacity: 0.55, dashArray: '5 7' }).addTo(map)
    }
    map.fitBounds(L.latLngBounds(route).pad(0.25), { maxZoom: 12 })
    status.value = 'ready'
  } catch {
    status.value = 'failed'
    map = null
  }
})

onBeforeUnmount(() => { map?.remove?.(); map = null })
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="PLACES I HAVE BEEN"
      title="足迹"
      mark="⌖"
      subtitle="有拍摄地点的照片会落在地图上，按时间连成一条线。"
    />

    <EmptyState
      v-if="!points.length"
      icon="⌖"
      title="还没有带地点的照片"
      text="相机或手机导出的原图通常带着拍摄地点，上传时会自动读出来。微信、微博里保存的图一般没有。"
    />

    <template v-else>
      <p class="map-note">
        {{ points.length }} 张照片有拍摄地点<template v-if="failed">（底图没加载出来，但标记点仍然可用）</template>
      </p>
      <div ref="mapEl" class="map-canvas"></div>
    </template>
  </section>
</template>
