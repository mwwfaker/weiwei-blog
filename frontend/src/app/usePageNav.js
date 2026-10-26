// 页面调度：当前页面 id、「更多」菜单、以及跳转。
//
// 刻意用模块级单例而不是 Pinia：`currentPage` 被顶栏、侧边栏、每个页面和若干 store 同时读，
// 而且路由同步要在 AppShell 挂载时就装好，不能等某个 store 第一次被用到才建。
import { computed, ref } from 'vue'

// 路由实例在 AppShell 里绑进来，这样本模块不依赖 vue-router 的注入上下文，
// 在 SSR / 渲染测试里（没有组件实例）也能安全调用。
let router = null

const currentPage = ref('home')
const moreOpen = ref(false)

export function bindRouter(instance) {
  router = instance
}

function setPage(page) {
  currentPage.value = page
  moreOpen.value = false
  if (router && router.currentRoute.value.name !== page) router.push({ name: page })
}

export function closeMoreMenu() {
  moreOpen.value = false
}

/**
 * 路由名 → 页面 id。
 *
 * 「公开日记」已经并进「日记」页当第二个标签，不再是独立页面；老的 #/public-diary 链接照旧能打开：
 * 切到公开标签，同时把地址换成 #/diary。
 *
 * @returns {'applied'|'legacyPublicDiary'|'ignored'}
 */
export function resolvePageName(name, { onLegacyPublicDiary } = {}) {
  if (typeof name !== 'string') return 'ignored'
  if (name === 'publicDiary') {
    currentPage.value = 'diary'
    onLegacyPublicDiary?.()
    router?.replace({ name: 'diary' })
    return 'legacyPublicDiary'
  }
  currentPage.value = name
  return 'applied'
}

export const isToolPage = computed(() => ['perf', 'clipboard'].includes(currentPage.value))

export { currentPage, moreOpen }
export const go = setPage
