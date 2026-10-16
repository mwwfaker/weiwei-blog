<script setup>
// 相册页：**盒子的首页** + 打开某个盒子看照片。
//
// 版面分两层是有意的：首页看的是相册本身（一盒一盒摆着），点开某个盒子才看里面的照片。
// 这样「建一本相册」和「往里放照片」是两件看得见的事，而不是一排筛选胶囊。
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
/** 虚拟盒子（全部照片 / 未分类）没有相册记录，标题只能写死。 */
const title = computed(() => media.currentAlbum?.name
  || (media.openAlbum === 'photos' ? '全部照片' : '未分类'))
const description = computed(() => media.currentAlbum?.description || '')
const canEdit = computed(() => Boolean(media.currentAlbum?.mine))

/** 首页在「一张照片都没有、也一本相册都没有」时才显示空状态：有盒子就该让盒子摆出来。 */
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

    <!-- 首页：摆的是一盒一盒相册 -->
    <template v-if="atHome">
      <div class="album-home-bar">
        <span>{{ media.allPhotoCount }} 张照片 · {{ media.rootAlbums.length }} 本相册</span>
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

      <AlbumBoxes v-else :albums="media.rootAlbums" show-pseudo />
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
