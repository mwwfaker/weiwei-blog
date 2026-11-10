<script setup>
// 404：地址打错了、或者旧链接指向已经下线的页面。
//
// 以前 catch-all 是 `redirect: '/'`，看起来「没坏」，实际是把人静默送回首页——
// 用户会以为链接有效、只是内容换了，于是下次还会用那个错链接。
// 现在明确说「这一页不在」，并把几个真正值得去的地方摆出来。
//
// 这个页面**没有导航入口**（只在 app/routes.js 的 catch-all 上），所以不出现在
// app/navigation.js 里——这是唯一一个「有路由、无菜单」的页面。
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { go } from '@/app/usePageNav'

const route = useRoute()
/** 把用户实际敲的地址原样显示出来，这样他能一眼看出是不是拼错了。 */
const attempted = computed(() => route.fullPath || route.path || '/')
</script>

<template>
  <section class="page-content inner-page">
    <div class="lost-page">
      <div class="section-kicker">LOST IN THE GARDEN <span></span></div>
      <h1 class="lost-title">这一页不在园子里<em>。</em></h1>
      <p class="lost-copy">
        地址可能是打错了，也可能这个页面早就下线了。下面这几个地方都在，随便挑一个。
      </p>
      <div class="lost-actions">
        <button class="button-primary" @click="go('home')">回到首页 ↗</button>
        <button class="button-secondary" @click="go('articles')">看看文章</button>
        <button class="button-secondary" @click="go('gallery')">翻翻相册</button>
      </div>
      <p class="lost-address">你打开的地址：<code>{{ attempted }}</code></p>
    </div>
  </section>
</template>
