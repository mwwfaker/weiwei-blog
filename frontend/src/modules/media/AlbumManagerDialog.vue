<script setup>
// 相册管理：新建一级相册 / 子相册、改名、删除。
//
// 改名走 `@change`（失焦或回车才提交），不是 `@input`：每敲一个字就 PUT 一次，
// 中间那些半截名字可能撞上「同层不许重名」而被拒，用户还以为改名失败了。
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()
</script>

<template>
  <ModalShell
    close-label="关闭相册管理"
    card-class="album-manager"
    kicker="PHOTO ALBUMS"
    title="管理相册"
    @close="media.albumManager = false"
  >
    <div class="album-create">
      <input v-model="media.albumDraft.name" maxlength="80" placeholder="新相册的名字，例如：旅行" @keyup.enter="media.createAlbum(media.albumDraft.parentId)" />
      <select v-model="media.albumDraft.parentId">
        <option :value="null">顶层相册</option>
        <option v-for="album in media.rootAlbums" :key="album.id" :value="album.id">放进「{{ album.name }}」</option>
      </select>
      <button class="button-primary" @click="media.createAlbum(media.albumDraft.parentId)">创建</button>
    </div>

    <p v-if="!media.rootAlbums.length" class="album-empty">
      还没有相册。建一个（比如「旅行」），就能把照片按自己的想法分开收好；需要再分细一点，
      还可以在它下面加子相册（比如「海边」「山里」）。
    </p>

    <ul v-else class="album-list">
      <li v-for="album in media.rootAlbums" :key="album.id">
        <div class="album-row">
          <input :value="album.name" maxlength="80" aria-label="相册名" @change="media.renameAlbum(album, $event.target.value)" />
          <small>{{ media.albumTotal(album) }} 张</small>
          <button class="danger-text" @click="media.removeAlbum(album)">删除</button>
        </div>
        <div v-for="child in media.childrenOf(album.id)" :key="child.id" class="album-row album-row-child">
          <input :value="child.name" maxlength="80" aria-label="子相册名" @change="media.renameAlbum(child, $event.target.value)" />
          <small>{{ media.albumTotal(child) }} 张</small>
          <button class="danger-text" @click="media.removeAlbum(child)">删除</button>
        </div>
      </li>
    </ul>
  </ModalShell>
</template>
