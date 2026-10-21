// 工具：把每条路由的 SSR 渲染结果写成文件，用于「只搬代码、不改行为」的逐字节比对。
// 路径从真实路由表推导（和 run.mjs 同一来源），新加/删除页面会自动跟上——
// 之前这里是手写列表，页面删了它还照着渲染，白白生成几条已经不存在路由的快照。
import { mkdirSync, writeFileSync } from 'node:fs'

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

const { render, routePaths } = await import('./dist-ssr/entry.js')

const outDir = process.argv[2]
if (!outDir) { console.error('usage: node snapshot.mjs <outDir>'); process.exit(2) }
mkdirSync(outDir, { recursive: true })

for (const route of routePaths) {
  const { html, warnings } = await render(route)
  const name = route === '/' ? 'home' : route.replace(/[^a-zA-Z0-9]/g, '_')
  writeFileSync(`${outDir}/${name}.html`, html, 'utf8')
  if (warnings.length) console.error(`warnings on ${route}: ${warnings.join(' | ')}`)
}
console.log(`snapshots written to ${outDir}（${routePaths.length} 条路由）`)
process.exit(0)
