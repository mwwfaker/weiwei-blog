<script setup>
// 相册盒子：封面拼贴 + 名字 + 张数 + 描述。
//
// 为什么是「盒子」而不是一排筛选胶囊：胶囊只能筛，看不见里面有什么，也放不下描述。
// 盒子的意义是**能先建好、先取名字、先写好描述，再慢慢往里放照片** —— 所以空盒子照样显示，
// 给一套默认样式，而不是因为还没照片就悄悄消失。
//
// 封面最多拼 4 张（一级相册连子相册的照片一起算，只拍子相册的那本不该显示成空盒）。
import { computed } from 'vue'
import { useMediaStore } from '@/stores/media'

const props = defineProps({
  /** 要摆出来的相册。首页传一级相册，相册内部传它的子相册。 */
  albums: { type: Array, default: () => [] },
  /** 首页额外摆两个虚拟盒子：「全部照片」「未分类」。 */
  showPseudo: { type: Boolean, default: false },
  /** 相册内部的子相册盒子：小一号。 */
  compact: { type: Boolean, default: false },
})

const media = useMediaStore()

/** 虚拟盒子和真实相册在这里统一成同一种形状，模板里就不用维护两套。 */
const boxes = computed(() => {
  const list = []
  if (props.showPseudo) {
    list.push({
      key: 'photos', name: '全部照片', description: '',
      count: media.allPhotoCount, panes: media.albumPreview(null),
    })
    list.push({
      key: 'none', name: '未分类', description: '',
      count: media.unclassifiedCount, panes: media.unclassifiedPreview(),
    })
  }
  for (const album of props.albums) {
    list.push({
      key: album.id,
      name: album.name,
      description: album.description || '',
      count: media.albumTotal(album),
      panes: media.albumPreview(album),
    })
  }
  return list
})

// 用 background-image 而不是 <img>：拼贴面板不需要各自的加载/失败状态，
// URL 里带括号或空格时一定要加引号，否则整条声明会被浏览器丢掉。
const background = (url) => ({ backgroundImage: `url("${url}")` })
</script>

<template>
  <div class="album-boxes" :class="{ 'is-compact': compact }">
    <button v-for="box in boxes" :key="box.key" class="album-box" @click="media.openBox(box.key)">
      <span class="album-box-cover" :class="`has-${box.panes.length}`">
        <span v-for="photo in box.panes" :key="photo.id" class="album-box-pane" :style="background(photo.image)"></span>
        <!-- 空盒子也有一套默认样式：它只是还没装东西，不是不存在 -->
        <span v-if="!box.panes.length" class="album-box-blank">▧</span>
      </span>
      <strong class="album-box-name">{{ box.name }}</strong>
      <small class="album-box-meta">{{ box.count }} 张</small>
      <em v-if="box.description" class="album-box-desc">{{ box.description }}</em>
    </button>
  </div>
</template>
