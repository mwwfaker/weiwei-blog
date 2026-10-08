import { createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import App from '../src/App.vue'
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
