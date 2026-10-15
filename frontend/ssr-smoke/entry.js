import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
import LyricsPanel from '../src/components/LyricsPanel.vue'
import MusicDock from '../src/components/MusicDock.vue'
import { routes } from '../src/routes'

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
