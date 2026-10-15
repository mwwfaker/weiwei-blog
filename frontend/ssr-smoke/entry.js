import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import LyricsPanel from '../src/modules/music/LyricsPanel.vue'
import MusicDock from '../src/modules/music/MusicDock.vue'
import { routes } from '../src/app/routes'

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
