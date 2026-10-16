<script setup>
// 上传对话框：一次选多张，传之前先把名称/描述写好、去处挑好。
//
// 为什么不在选文件时就直接传：一次选十张手机照片，全部落进同一个相册、名字都是
// IMG_2031 这种，事后还得一张张回去改。所以顺序反过来 —— **先填信息，再上传**。
//
// 描述有两种写法：上面「统一描述」写一次给所有张用；某张想单独写，就改它自己那格
// （填了就优先用它）。这样「这一批去哪儿玩了」和「这张单独说一句」都不别扭。
import { computed } from 'vue'
import ModalShell from '@/modules/modal/ModalShell.vue'
import { useMediaStore } from '@/stores/media'

const media = useMediaStore()

const entries = computed(() => media.uploadDialog?.entries || [])
const running = computed(() => media.uploadProgress.running)
const done = computed(() => media.uploadProgress.done)
</script>

<template>
  <ModalShell
    close-label="关闭上传"
    card-class="album-manager upload-card"
    kicker="UPLOAD PHOTOS"
    :title="`上传 ${entries.length} 张照片`"
    @close="media.closeUploadDialog()"
  >
    <!-- 统一设置：这一批的共同信息 -->
    <div class="upload-setup">
      <label>
        放进哪一本
        <select v-model="media.uploadDraft.albumId" :disabled="running">
          <option :value="null">先散落在外面（以后再用「移到相册」归置）</option>
          <optgroup v-for="album in media.rootAlbums" :key="album.id" :label="album.name">
            <option :value="album.id">{{ album.name }}（整个相册）</option>
            <option v-for="child in media.childrenOf(album.id)" :key="child.id" :value="child.id">{{ child.name }}</option>
          </optgroup>
        </select>
      </label>
      <label>
        统一描述（可选）
        <textarea
          v-model="media.uploadDraft.description"
          rows="2"
          maxlength="500"
          :disabled="running"
          placeholder="这一批照片共同的一句话，比如「十月去海边」。下面哪张单独写了描述，就以那张为准。"
        ></textarea>
      </label>
      <label>
        可见范围
        <select v-model="media.uploadDraft.visibility" :disabled="running">
          <option value="PRIVATE">仅自己可见</option>
          <option value="PUBLIC">公开</option>
        </select>
      </label>
    </div>

    <!-- 每张一张卡：缩略图 + 名称 + 自己的描述 -->
    <ul class="upload-list">
      <li v-for="entry in entries" :key="entry.key" class="upload-item">
        <img class="upload-thumb" :src="entry.preview" :alt="entry.caption" />
        <div class="upload-fields">
          <input v-model="entry.caption" maxlength="180" :disabled="running" placeholder="照片名称" />
          <textarea
            v-model="entry.description"
            rows="2"
            maxlength="500"
            :disabled="running"
            placeholder="这张的描述（留空就用上面的统一描述）"
          ></textarea>
          <!-- 拍摄时间/地点是上传前在本机从 EXIF 读的；读不到就显示"没有"，不是错误 -->
          <small class="upload-meta">
            <template v-if="entry.takenAt">摄于 {{ new Date(entry.takenAt).toLocaleString('zh-CN', { hour12: false }) }}</template>
            <template v-else>没有拍摄时间（截图或平台抹掉了元数据）</template>
            <template v-if="entry.latitude != null"> · 有定位</template>
          </small>
        </div>
        <button class="upload-remove" :disabled="running" aria-label="不传这张" @click="media.removeUploadEntry(entry.key)">×</button>
      </li>
    </ul>

    <div class="modal-actions">
      <span v-if="running">正在上传 {{ done }} / {{ entries.length }} …</span>
      <span v-else>共 {{ entries.length }} 张 · 逐张上传，中途可以关窗，已经传好的不会丢</span>
      <button class="button-primary" :disabled="running || !entries.length" @click="media.runUpload()">
        {{ running ? '上传中…' : '开始上传' }}
      </button>
    </div>
  </ModalShell>
</template>
