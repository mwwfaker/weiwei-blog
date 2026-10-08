// Confirms /perf renders the real panel (not the async loading placeholder).
import { render } from './dist-ssr/entry.js'

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
globalThis.fetch = async () => { throw new Error('offline') }
globalThis.URL.createObjectURL = () => 'blob:x'
globalThis.URL.revokeObjectURL = () => {}
globalThis.location = { host: 'localhost', pathname: '/', search: '', hash: '', href: 'http://localhost/' }
globalThis.history = { pushState() {}, replaceState() {}, state: null, go() {}, back() {}, forward() {} }
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}

const { html } = await render('/perf')
const markers = ['绩效管理', '小组人数', '本月合计', '成员绩效', '队列配置', '导入数据', '计算说明', '还没有成员数据']
let missing = 0
for (const m of markers) {
  const ok = html.includes(m)
  if (!ok) missing += 1
  console.log(`${ok ? 'FOUND' : 'MISSING'}  ${m}`)
}
console.log(`\nhtml length: ${html.length}`)
console.log(html.includes('正在打开绩效管理') ? 'NOTE: the loading placeholder is present' : 'no loading placeholder — the real panel rendered')
process.exitCode = missing ? 1 : 0
