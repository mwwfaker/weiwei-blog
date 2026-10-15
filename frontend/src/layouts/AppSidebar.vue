<script setup>
// 左侧导航栏：主导航 + 「更多」菜单 + 底部迷你资料卡。
//
// 「更多」菜单被 teleport 到 body。原因是 .side-nav 为了在窄屏能横向滚动用了
// overflow-x:auto，而滚动容器会裁掉绝对定位的子元素——菜单明明渲染了却一个字都看不见
// （实测按钮已经变成选中态，菜单整体被裁掉）。挂到 body 上用 fixed 定位就不受裁剪影响，
// 而且 body 上没有 transform/filter，fixed 的参照是真正的视口。
import { onMounted, onUnmounted, ref } from 'vue'
import { navigation, secondaryNavigation } from '@/app/navigation'
import { closeMoreMenu, currentPage, go, moreOpen } from '@/app/usePageNav'
import { useAuthStore } from '@/stores/auth'
import { useDiariesStore } from '@/stores/diaries'
import { useMusicStore } from '@/stores/music'
import { useProfileStore } from '@/stores/profile'

const auth = useAuthStore()
const diaries = useDiariesStore()
const music = useMusicStore()
const profile = useProfileStore()

/** 下滑收起导航时由外壳传入。 */
defineProps({ condensed: { type: Boolean, default: false } })

const moreButton = ref(null)
const moreMenuStyle = ref({})
const MORE_MENU_WIDTH = 214

function positionMoreMenu() {
  const button = moreButton.value
  if (!button || typeof window === 'undefined') return
  const rect = button.getBoundingClientRect()
  const width = Math.min(MORE_MENU_WIDTH, window.innerWidth - 20)
  const left = Math.max(10, Math.min(rect.right - width, window.innerWidth - width - 10))
  const top = Math.min(rect.bottom + 8, Math.max(10, window.innerHeight - 120))
  moreMenuStyle.value = { width: `${width}px`, left: `${left}px`, top: `${top}px`, right: 'auto' }
}

function toggleMore() {
  moreOpen.value = !moreOpen.value
  if (!moreOpen.value) return
  positionMoreMenu()
  // 导航栏还有收起/展开的过渡，下一帧再量一次才准
  requestAnimationFrame(positionMoreMenu)
}

function onDocumentPointerDown(event) {
  if (!moreOpen.value) return
  const target = event.target
  if (moreButton.value && moreButton.value.contains(target)) return
  if (target && typeof target.closest === 'function' && target.closest('.nav-more-menu')) return
  closeMoreMenu()
}

function onDocumentKeydown(event) {
  if (event.key === 'Escape') closeMoreMenu()
}

onMounted(() => {
  // 「更多」菜单挂在 body 上，所以关闭逻辑要挂在 document 上
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeydown)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
})
</script>

<template>
  <aside class="sidebar" :class="{ condensed }">
    <a class="brand" href="#/" @click.prevent="go('home')">
      <span class="brand-mark"><span></span><span></span><span></span></span>
      <span class="brand-copy"><strong>唯唯园</strong><small>WEIWEI'S LITTLE GARDEN</small></span>
    </a>

    <div class="sidebar-label">MENU <span></span></div>

    <nav class="side-nav" aria-label="主导航">
      <button
        v-for="item in navigation"
        :key="item.id"
        :class="['nav-item', { active: currentPage === item.id }]"
        @click="go(item.id)"
      >
        <span class="nav-icon">{{ item.icon }}</span>
        <span>{{ item.label }}</span>
        <span v-if="item.id === 'diary' && auth.isLoggedIn" class="nav-count">{{ diaries.diaries.length }}</span>
        <span v-if="item.id === 'music' && music.activeUploadCount" class="nav-count">{{ music.activeUploadCount }}</span>
        <span v-if="currentPage === item.id" class="active-dot"></span>
      </button>

      <div class="nav-more">
        <button
          ref="moreButton"
          class="nav-item nav-more-trigger"
          :class="{ active: secondaryNavigation.some((item) => item.id === currentPage) }"
          :aria-expanded="moreOpen"
          aria-haspopup="true"
          @click="toggleMore"
        >
          <span class="nav-icon">⋯</span><span>更多</span><span class="nav-more-caret">{{ moreOpen ? '▴' : '▾' }}</span>
        </button>
        <Teleport to="body">
          <div v-if="moreOpen" class="nav-more-menu is-floating" :style="moreMenuStyle" role="menu">
            <button
              v-for="item in secondaryNavigation"
              :key="item.id"
              role="menuitem"
              :class="['nav-more-item', { active: currentPage === item.id }]"
              @click="go(item.id)"
            >
              <span class="nav-icon">{{ item.icon }}</span><span>{{ item.label }}</span>
            </button>
          </div>
        </Teleport>
      </div>
    </nav>

    <div class="sidebar-bottom">
      <div class="mini-profile">
        <img v-if="profile.profileAvatarSrc" :src="profile.profileAvatarSrc" alt="头像" class="avatar-img" />
        <div v-else class="avatar">唯</div>
        <div><strong>{{ profile.profileName }}</strong><span>记录生活的收藏家</span></div>
        <button class="edit-profile" aria-label="编辑个人资料" @click="profile.openEditor()">↗</button>
      </div>
      <div class="sidebar-note"><span class="note-star">✳</span><p>“慢一点，也没关系。”</p><small>写给每一个今天</small></div>
      <div class="copyright">© {{ new Date().getFullYear() }} {{ profile.profileName }} · 用心记录</div>
    </div>
  </aside>
</template>
