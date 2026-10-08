// Runtime smoke test: renders the real App through the real route table and reports anything that
// throws or warns. Catches setup()/render errors that a production build cannot.
// Globals are installed before the bundle is imported, because the modules read them at load time.

// Minimal browser surface the app reads during setup/render.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}
globalThis.sessionStorage = { ...globalThis.localStorage }
globalThis.Storage = function Storage() {}
globalThis.window = globalThis
globalThis.document = { querySelector: () => null, createElement: () => ({ click() {} }) }
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
globalThis.fetch = async () => { throw new Error('offline smoke test') }
globalThis.URL.createObjectURL = () => 'blob:smoke'
globalThis.URL.revokeObjectURL = () => {}
globalThis.location = { host: 'localhost', pathname: '/', search: '', hash: '', href: 'http://localhost/' }
globalThis.history = { pushState() {}, replaceState() {}, state: null, go() {}, back() {}, forward() {} }
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}

const { render } = await import('./dist-ssr/entry.js')

const routes = ['/', '/about', '/study', '/perf', '/articles', '/categories', '/tags', '/diary', '/public-diary',
  '/gallery', '/music', '/messages', '/friends', '/archives', '/admin', '/account']

let failures = 0
for (const route of routes) {
  try {
    const { html, warnings } = await render(route)
    const bad = warnings.filter((w) => !/Hydration|__VUE_OPTIONS_API__|__VUE_PROD/.test(w))
    const ok = html.length > 400
    if (!ok || bad.length) failures += 1
    console.log(`${ok && !bad.length ? 'PASS' : 'FAIL'}  ${route.padEnd(15)} ${String(html.length).padStart(6)} bytes${bad.length ? '  warnings: ' + bad.join(' | ') : ''}`)
  } catch (error) {
    failures += 1
    console.log(`FAIL  ${route.padEnd(15)} threw: ${error.message}`)
  }
}

console.log(failures === 0
  ? `\nAll ${routes.length} routes rendered without errors.`
  : `\n${failures} of ${routes.length} routes failed.`)
process.exitCode = failures ? 1 : 0
