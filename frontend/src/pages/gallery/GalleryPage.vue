<script setup>
// 相册页：**首页 = 一盒一盒相册 + 散落在外的照片**；点开某盒 = 子盒子 + 这本相册自己的照片。
//
// 刻意没有「未分类」这个盒子：没归进盒子的照片就散落在首页上正常展示。
// 多一个「未分类」盒子等于凭空多一层收纳，而它装的其实是「我还没想好放哪」的东西。
import { computed, ref } from 'vue'
import AlbumBoxes from '@/modules/media/AlbumBoxes.vue'
import GalleryGrid from '@/modules/media/GalleryGrid.vue'
import EmptyState from '@/modules/page/EmptyState.vue'
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
import { requireLogin } from '@/app/useGuard'
import { useAuthStore } from '@/stores/auth'
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()
const auth = useAuthStore()
const picker = ref(null)

const atHome = computed(() => media.openAlbum === 'all')
const title = computed(() => media.currentAlbum?.name || '')
const description = computed(() => media.currentAlbum?.description || '')
const canEdit = computed(() => Boolean(media.currentAlbum?.mine))

/** 一张照片都没有、也一本相册都没有时才显示空状态：有盒子就该让盒子摆出来。 */
const homeIsEmpty = computed(() => !media.galleryItems.length && !media.rootAlbums.length)
/** 一级相册自己的照片为空、但下面有子相册：这时该说的话和「一张都没有」不一样。 */
const emptyText = computed(() => (media.currentChildren.length
  ? '这本相册自己的照片还空着 —— 照片可能都在下面的子相册里，也可以直接加到这里。'
  : '点上面的「添加照片」，照片就会放进这一盒。'))

function openPicker() {
  if (!requireLogin('上传照片')) return
  picker.value?.click()
}

function onPicked(event) {
  const files = [...(event.target.files || [])]
  event.target.value = ''
  // 一次可以选多张：先进上传对话框填名称/描述/去处，再统一传。
  if (files.length) media.openUploadDialog(files)
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
      <input ref="picker" type="file" accept="image/*" multiple hidden @change="onPicked" />
    </InnerPageHeader>

    <!-- 首页：盒子在前，散落在外的照片在后 -->
    <template v-if="atHome">
      <div class="album-home-bar">
        <span>{{ media.rootAlbums.length }} 本相册 · {{ media.loosePhotos.length }} 张散落在外面</span>
        <button v-if="auth.isLoggedIn" class="album-manage" @click="media.albumManager = true">管理相册</button>
      </div>

      <EmptyState
        v-if="homeIsEmpty"
        icon="▧"
        title="这里还没有照片"
        text="上传照片后，可以建一本本相册把它们分开收好：相册里还能再分子相册，每张照片、每本相册都可以写描述。"
        action-label="上传本地照片"
        @action="openPicker"
      />

      <template v-else>
        <AlbumBoxes v-if="media.rootAlbums.length" :albums="media.rootAlbums" />
        <p v-else class="album-home-hint">
          还没有相册。上面「管理相册」里建一本（比如「旅行」），就能把照片一盒一盒收好了。
        </p>

        <template v-if="media.loosePhotos.length">
          <h3 class="album-section-title">
            散落在外的照片
            <small>{{ media.loosePhotos.length }} 张 · 还没放进盒子</small>
          </h3>
          <GalleryGrid @preview="media.galleryPreview = $event" />
        </template>
      </template>
    </template>

    <!-- 打开了一盒：先看子盒子，再看这本相册自己的照片 -->
    <template v-else>
      <button class="album-back" @click="media.openBox('all')">← 所有相册</button>

      <header class="album-detail-head">
        <div class="album-detail-copy">
          <h2 class="album-detail-title">{{ title }}</h2>
          <p v-if="description" class="album-detail-desc">{{ description }}</p>
        </div>
        <div class="album-detail-tools">
          <span class="album-detail-meta">{{ media.visibleGallery.length }} 张照片</span>
          <button v-if="canEdit" class="album-detail-edit" @click="media.openAlbumEditor(media.currentAlbum)">编辑相册</button>
        </div>
      </header>

      <AlbumBoxes v-if="media.currentChildren.length" :albums="media.currentChildren" compact />

      <EmptyState
        v-if="!media.visibleGallery.length"
        icon="▧"
        :title="media.currentChildren.length ? '这盒里还没有照片' : '这里还没有照片'"
        :text="emptyText"
        action-label="上传本地照片"
        @action="openPicker"
      />

      <GalleryGrid v-else @preview="media.galleryPreview = $event" />
    </template>
  </section>
</template>
