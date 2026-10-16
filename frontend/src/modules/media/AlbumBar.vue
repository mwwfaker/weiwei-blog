<script setup>
// 相册条：第一排是一级相册（外加「全部 / 未分类」），选中带子相册的那本时再出现第二排。
//
// 为什么把两级都摊在一条横条上而不是做树：相册最多两级，一层胶囊加一行子胶囊，
// 比一个可展开的树少一次交互，也不会在手机上撑出一个滚动窗口套滚动窗口。
import { useAuthStore } from '@/stores/auth'
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()
const auth = useAuthStore()
</script>

<template>
  <div class="album-bar">
    <div class="album-nav">
      <div class="album-pills">
        <button :class="{ active: media.selectedAlbum === 'all' }" @click="media.selectAlbum('all')">
          全部<small>{{ media.albumCounts.all || 0 }}</small>
        </button>
        <button :class="{ active: media.selectedAlbum === 'none' }" @click="media.selectAlbum('none')">
          未分类<small>{{ media.albumCounts.none || 0 }}</small>
        </button>
        <button
          v-for="album in media.rootAlbums"
          :key="album.id"
          :class="{ active: media.activeRootId === album.id }"
          @click="media.selectAlbum(album.id)"
        >
          {{ album.name }}<small>{{ media.albumCounts[album.id] || 0 }}</small>
        </button>
      </div>
      <div class="album-tools">
        <span>{{ media.visibleGallery.length }} 张照片</span>
        <button v-if="auth.isLoggedIn" class="album-manage" @click="media.albumManager = true">管理相册</button>
      </div>
    </div>

    <div v-if="media.activeChildren.length" class="album-pills album-subpills">
      <button :class="{ active: media.selectedAlbum === media.activeRootId }" @click="media.selectAlbum(media.activeRootId)">
        整个相册<small>{{ media.albumCounts[media.activeRootId] || 0 }}</small>
      </button>
      <button
        v-for="child in media.activeChildren"
        :key="child.id"
        :class="{ active: media.selectedAlbum === child.id }"
        @click="media.selectAlbum(child.id)"
      >
        {{ child.name }}<small>{{ media.albumCounts[child.id] || 0 }}</small>
      </button>
    </div>
  </div>
</template>
