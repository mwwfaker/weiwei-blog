import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import LyricsPanel from '../src/modules/music/LyricsPanel.vue'
import MusicDock from '../src/modules/music/MusicDock.vue'
import { routes } from '../src/app/routes'
import { useDustClose, DUST_MS } from '../src/composables/useDustClose'

/**
 * 冒烟测试要覆盖的路径，**直接从真实路由表推导**。
 *
 * 原来这里是一份手写的列表，新加页面时没人记得同步它——测试会一直是绿的，
 * 而新页面从来没被渲染过。现在从 routeName 里长出来，加页面就自动被覆盖。
 * catch-all（`/:pathMatch(.*)*`）含冒号，被过滤掉。
 */
export const routePaths = routes
  .filter((route) => typeof route.path === 'string' && !route.path.includes(':'))
  .map((route) => route.path)

// Uses the real route table with in-memory history, so every named route the app navigates to is
// exercised without needing a browser location/history.
export async function render(url) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  const app = createSSRApp(App)
  app.use(createPinia())
  app.use(router)
  const warnings = []
  app.config.warnHandler = (msg) => warnings.push(msg)
  await router.push(url)
  await router.isReady()
  const html = await renderToString(app)
  return { html, warnings }
}

/**
 * 单独渲染一个组件。整页渲染只能覆盖「默认状态」，而歌词栏和音乐盒真正要检查的是
 * 「有歌词时的当前句高亮」「解析中」「没有歌词」这些分支，得直接把 props 喂进去。
 */
async function renderComponent(component, props) {
  const app = createSSRApp({ render: () => h(component, props) })
  const warnings = []
  app.config.warnHandler = (msg) => warnings.push(msg)
  const html = await renderToString(app)
  return { html, warnings }
}

export function renderLyrics(props) { return renderComponent(LyricsPanel, props) }
export function renderDock(props) { return renderComponent(MusicDock, props) }

/**
 * 「关掉时化作尘埃」这条路径**只有用户点关闭时才会跑**：整页渲染走不到，静态检查也看不见。
 * 它一旦抛错，症状是「点了关闭没反应」，控制台里只有一行 TypeError——上线过一次
 * （`useDustClose` 里 import 进来的 `motion` 被同名的参数遮住了）。
 *
 * 所以这里真的调一次 `requestClose()`，把「有没有抛错 / 有没有进入消散状态 /
 * 粒子有没有按目标位置铺开 / 有没有傻等到动画播完」四件事报给 `run.mjs`。
 * 这个组合函数不依赖组件实例（没有生命周期钩子、没有 inject），可以这样直接调用。
 */
export function probeDustClose() {
  let closed = false
  const rect = { left: 12, top: 34, width: 800, height: 600 }
  // 传函数而不是布尔值：真实调用点（ReadingSheet）就是这么跟着 prop 走的。
  const state = useDustClose({
    target: { value: { getBoundingClientRect: () => rect } },
    motion: () => true,
    onClose: () => { closed = true },
  })
  let error = ''
  try {
    state.requestClose()
  } catch (thrown) {
    error = `${thrown.name}: ${thrown.message}`
  }
  return {
    error,
    ms: DUST_MS,
    closing: state.closing.value,
    dustRect: state.dustRect.value,
    count: state.dustCount.value,
    // 动画是异步播的，这一刻还**不该**通知关闭；立刻关闭等于把特效整段跳过。
    closedImmediately: closed,
  }
}
