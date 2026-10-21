<script setup>
// 全站唯一的顶栏：首页与内页共用同一套导航。
//
// 之前的两个问题在这里一并解决：
//   · 首页有一套自己的「一行字」导航、内页是另一套玻璃胶囊 + 底部 dock——换个页面像换了个站；
//   · dock 浮在内容上，窄屏还会压住最后一屏。
// 现在只剩这一条：品牌、页面链接、「更多」、主题。
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { navigation, secondaryNavigation } from '@/app/navigation'
import { closeMoreMenu, currentPage, go, moreOpen } from '@/app/usePageNav'
import { useIsDark } from '@/app/theme'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'

const auth = useAuthStore()
const profile = useProfileStore()
const isDark = useIsDark()

const links = computed(() => navigation.filter((item) => item.id !== 'home'))
const moreButton = ref(null)
const panelStyle = ref({})

defineProps({ condensed: { type: Boolean, default: false } })

function toggleMore() {
  moreOpen.value = !moreOpen.value
  if (!moreOpen.value) return
  // 面板跟着「更多」按钮走：固定贴右边会跑到屏幕另一头，看起来像属于别的东西。
  const button = moreButton.value
  if (!button) return
  const rect = button.getBoundingClientRect()
  const width = 200
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
  const top = Math.min(rect.bottom + 10, window.innerHeight - 220)
  panelStyle.value = { left: `${left}px`, top: `${top}px`, width: `${width}px` }
}

function onPointerDown(event) {
  if (!moreOpen.value) return
  const target = event.target
  if (moreButton.value && moreButton.value.contains(target)) return
  if (target && typeof target.closest === 'function' && target.closest('.nav-more-panel')) return
  closeMoreMenu()
}

function onKeydown(event) {
  if (event.key === 'Escape') closeMoreMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <header class="topbar" :class="{ 'is-condensed': condensed }">
    <button class="topbar-brand" aria-label="回到首页" @click="go('home')">
      <span class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></span>
      <span class="topbar-brand-copy"><strong>唯唯园</strong><small>WEIWEI'S LITTLE GARDEN</small></span>
    </button>

    <nav class="topbar-links" aria-label="主导航">
      <button
        v-for="item in links"
        :key="item.id"
        :class="{ active: currentPage === item.id }"
        @click="go(item.id)"
      >{{ item.label }}</button>
      <button
        ref="moreButton"
        class="topbar-more"
        :class="{ active: secondaryNavigation.some((item) => item.id === currentPage) }"
        :aria-expanded="moreOpen"
        aria-haspopup="true"
        @click="toggleMore"
      >更多</button>
    </nav>

    <div class="topbar-actions">
      <button class="topbar-theme" :aria-label="isDark ? '切换浅色主题' : '切换深色主题'" @click="isDark = !isDark">
        {{ isDark ? '☼' : '☾' }}
      </button>
      <button class="top-avatar" :aria-label="auth.isLoggedIn ? '内容管理' : '登录账号'" @click="go(auth.isLoggedIn ? 'admin' : 'account')">
        <img v-if="profile.profileAvatarSrc" :src="profile.profileAvatarSrc" alt="" />
        <span v-else>唯</span>
      </button>
    </div>

    <Teleport to="body">
      <Transition name="dock-sheet">
        <div v-if="moreOpen" class="nav-more-panel" :style="panelStyle" role="menu">
          <button
            v-for="item in secondaryNavigation"
            :key="item.id"
            role="menuitem"
            :class="['nav-more-item', { active: currentPage === item.id }]"
            @click="go(item.id)"
          ><span aria-hidden="true">{{ item.icon }}</span>{{ item.label }}</button>
        </div>
      </Transition>
    </Teleport>
  </header>
</template>
