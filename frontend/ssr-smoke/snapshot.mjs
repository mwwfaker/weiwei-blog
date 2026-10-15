// 临时工具：把某个路由的 SSR 渲染结果写成文件，用于「重构前后 HTML 必须逐字一致」的比对。
// 只在重构期间使用，验证完即删。
import { writeFileSync } from 'node:fs'

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
globalThis.fetch = async () => { throw new Error('offline snapshot') }
globalThis.URL.createObjectURL = () => 'blob:snapshot'
globalThis.URL.revokeObjectURL = () => {}
globalThis.location = { host: 'localhost', pathname: '/', search: '', hash: '', href: 'http://localhost/' }
globalThis.history = { pushState() {}, replaceState() {}, state: null, go() {}, back() {}, forward() {} }
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}

const { render } = await import('./dist-ssr/entry.js')

const routes = ['/', '/about', '/study', '/perf', '/articles', '/categories', '/tags', '/diary', '/gallery', '/music', '/messages', '/friends', '/archives', '/admin', '/account']
const outDir = process.argv[2]
if (!outDir) { console.error('usage: node snapshot.mjs <outDir>'); process.exit(2) }

for (const route of routes) {
  const { html, warnings } = await render(route)
  const name = route === '/' ? 'home' : route.replace(/[^a-zA-Z0-9]/g, '_')
  writeFileSync(`${outDir}/${name}.html`, html, 'utf8')
  if (warnings.length) console.error(`warnings on ${route}: ${warnings.join(' | ')}`)
}
console.log(`snapshots written to ${outDir}`)
process.exit(0)
