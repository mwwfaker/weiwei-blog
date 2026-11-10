<script setup>
// 相册管理：新建一级相册 / 子相册、改名、删除。
//
// 改名走 `@change`（失焦或回车才提交），不是 `@input`：每敲一个字就 PUT 一次，
// 中间那些半截名字可能撞上「同层不许重名」而被拒，用户还以为改名失败了。
//
// 创建要有明确的「正在建」：请求是一个来回（几百毫秒到一两秒），
// 期间按钮不禁用、文字也不变的话，看起来就是「点了没反应」——站主就是这么报的。
// 建完弹窗**不自动关**（通常还要接着建第二个），所以补了两件事：
// 新行闪一下，以及底部一个明确的「完成」退出。
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()

/** 防止连点：按钮在请求期间禁用，回车也不放行。 */
function submit() {
  if (media.albumCreating) return
  media.createAlbum(media.albumDraft.parentId)
}

function close() {
  media.albumManager = false
}
</script>

<template>
  <ModalShell
    close-label="完成并关闭相册管理"
    card-class="album-manager"
    kicker="PHOTO ALBUMS"
    title="管理相册"
    @close="close"
  >
    <div class="album-create">
      <input
        v-model="media.albumDraft.name"
        maxlength="80"
        placeholder="新相册的名字，例如：旅行"
        :disabled="media.albumCreating"
        @keyup.enter="submit"
      />
      <select v-model="media.albumDraft.parentId" :disabled="media.albumCreating">
        <option :value="null">顶层相册</option>
        <option v-for="album in media.rootAlbums" :key="album.id" :value="album.id">放进「{{ album.name }}」</option>
      </select>
      <button class="button-primary" :disabled="media.albumCreating" @click="submit">
        {{ media.albumCreating ? '创建中…' : '创建' }}
      </button>
    </div>

    <p v-if="!media.rootAlbums.length && !media.albumCreating" class="album-empty">
      还没有相册。建一个（比如「旅行」），就能把照片按自己的想法分开收好；需要再分细一点，
      还可以在它下面加子相册（比如「海边」「山里」）。
    </p>

    <ul v-else class="album-list">
      <li v-for="album in media.rootAlbums" :key="album.id">
        <div class="album-row" :class="{ 'is-new': String(album.id) === media.albumNewId }">
          <input :value="album.name" maxlength="80" aria-label="相册名" @change="media.renameAlbum(album, $event.target.value)" />
          <small>{{ media.albumTotal(album) }} 张</small>
          <button class="danger-text" @click="media.removeAlbum(album)">删除</button>
        </div>
        <div
          v-for="child in media.childrenOf(album.id)"
          :key="child.id"
          class="album-row album-row-child"
          :class="{ 'is-new': String(child.id) === media.albumNewId }"
        >
          <input :value="child.name" maxlength="80" aria-label="子相册名" @change="media.renameAlbum(child, $event.target.value)" />
          <small>{{ media.albumTotal(child) }} 张</small>
          <button class="danger-text" @click="media.removeAlbum(child)">删除</button>
        </div>
      </li>
    </ul>

    <div class="album-manager-foot">
      <span>{{ media.albumCreating ? '正在创建，请稍等…' : '建好就能在相册首页看到它' }}</span>
      <button class="button-secondary" @click="close">完成</button>
    </div>
  </ModalShell>
</template>
