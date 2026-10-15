<script setup>
// 创作管理 · 可见范围设置：新日记的默认范围 + 博客首页开关。
import { useProfileStore } from '@/stores/profile'

const profile = useProfileStore()
</script>

<template>
  <section class="admin-panel">
    <div class="admin-panel-title">
      <div><small>DEFAULT PRIVACY</small><h2>日记默认可见范围</h2></div>
    </div>
    <p>新建日记先按这个范围保存；每篇日记也可以单独修改。私密日记不会出现在公开日记列表。</p>

    <div class="setting-row">
      <span><strong>新日记设置</strong><small>只影响之后新建的日记。</small></span>
      <select v-model="profile.defaultVisibility" @change="profile.persistDefaultVisibility()">
        <option value="PRIVATE">仅自己可见</option>
        <option value="PUBLIC">公开</option>
      </select>
    </div>

    <div class="setting-row">
      <span>
        <strong>博客首页</strong>
        <small>{{ profile.siteVisibility === 'PUBLIC' ? '访客可以看到首页与公开日记' : '只有你自己可以看到公开页面' }}</small>
      </span>
      <button class="button-secondary" @click="profile.toggleSiteVisibility()">
        {{ profile.siteVisibility === 'PUBLIC' ? '设为仅自己可见' : '设为公开' }}
      </button>
    </div>
  </section>
</template>
