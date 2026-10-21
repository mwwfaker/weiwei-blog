// Static checks that a production build cannot catch. Run with: cd frontend && npm run verify
//
// 这轮重构把 App.vue（1540 行）拆成了 15 个页面文件夹 + 一批可复用模块，所以检查也跟着变成
// 「对每个 .vue 都跑一遍」——只盯着 App.vue 的话，重构之后它会永远是绿的，等于没有检查。
//
// 前七项是「别改坏」的回归网，后两项是「照约定加东西」的结构约束。
//
//   [1] 模板里用到的标识符必须在 <script setup> 里定义（缺失会编译成 _ctx.x，运行时才炸）
//   [2] 模板里的自定义指令必须在脚本里 import（v-reveal 是局部注册的，全局没注册）
//   [3] 页面 id ↔ 路由 ↔ 页面注册表三者一致，且每个页面组件住在 pages/<id>/ 里
//   [4] 模板里写到的 class 必须真的有一条样式规则（手抄类名抄错是最常见的一类回归）
//   [5] html/body/#app/.app-shell 上不能有会变成 fixed 包含块的属性
//   [6] 粒子画布不能被混合模式或低透明度弄没
//   [7] .side-nav 是滚动容器时，「更多」菜单必须 teleport 到 body
//   [8] 每个目录都有一份 README.md，没有空目录，根目录的契约文件齐全
//   [9] 没有「谁都不引用」的孤儿文件
//  [10] 分层越界：页面/模块不许直接调后端或读本机存储；services 不许 import Vue 或 store
//  [11] 不许新增 <style scoped>（它会压过 styles/ 里的覆盖层）
//  [12] 单文件体积提示（把该拆出去的板块找出来）
//  [13] 样式里的类名都必须有人在用（删组件/删页面之后别忘了删样式）
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(new URL('../package.json', import.meta.url))
const { parse, compileScript, compileTemplate } = require('vue/compiler-sfc')

const root = fileURLToPath(new URL('../src', import.meta.url))
const frontendDir = fileURLToPath(new URL('..', import.meta.url))
const stylesDir = path.join(root, 'styles')
const rel = (file) => path.relative(frontendDir, file).replace(/\\/g, '/')
/** 相对于 frontend/src 的路径：长度短、读起来也更像「哪个模块的哪一段」。 */
const srcRel = (file) => path.relative(root, file).replace(/\\/g, '/')

function walk(dir, filter) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full, filter))
    else if (filter(entry.name)) out.push(full)
  }
  return out.sort()
}

const vueFiles = walk(root, (name) => name.endsWith('.vue'))

// 样式表要从 index.css 顺着 @import 一路走下来，而不是只看 styles/ 目录里的 *.css：
// 页面自己的样式（例如 pages/perf/perf.css）是挂在 import 链上的，不跟进去就会误报「没有样式」。
function collectStyles(entry) {
  const seen = new Set()
  const files = []
  const chunks = []
  const visit = (file) => {
    if (seen.has(file) || !fs.existsSync(file)) return
    seen.add(file)
    files.push(file)
    const text = fs.readFileSync(file, 'utf8')
    chunks.push(text)
    for (const m of text.matchAll(/@import\s+(?:url\()?['"]([^'"]+)['"]/g)) {
      if (m[1].startsWith('.')) visit(path.resolve(path.dirname(file), m[1]))
    }
  }
  visit(entry)
  return { files, text: chunks.join('\n') }
}

const styles = collectStyles(path.join(stylesDir, 'index.css'))
// 样式也可能由 JS 直接 import（`import './perf.css'`）。不把这些算进来的话，
// 页面自带的样式会被误判成「模板里用了但没有任何规则」。
for (const file of walk(root, (name) => name.endsWith('.js') || name.endsWith('.vue'))) {
  const text = fs.readFileSync(file, 'utf8')
  for (const m of text.matchAll(/(?:^|\n)\s*import\s+['"]([^'"]+\.css)['"]/g)) {
    const target = m[1].startsWith('.') ? path.resolve(path.dirname(file), m[1]) : null
    if (target && !styles.files.includes(target)) {
      if (fs.existsSync(target)) {
        styles.files.push(target)
        styles.text += '\n' + fs.readFileSync(target, 'utf8')
      }
    }
  }
}
const cssFiles = styles.files
const cssNoComments = styles.text.replace(/\/\*[\s\S]*?\*\//g, '')

let failures = 0
const fail = (message) => { failures += 1; console.log(`    FAIL  ${message}`) }

// SFC 解析与编译结果缓存：下面好几项检查都要用。
const parsed = new Map()
for (const file of vueFiles) {
  const source = fs.readFileSync(file, 'utf8')
  const { descriptor, errors } = parse(source, { filename: file })
  if (errors.length) { fail(`${rel(file)} 解析失败: ${errors.map((e) => e.message).join(', ')}`); continue }
  let bindings = {}
  let templateCode = ''
  if (descriptor.scriptSetup) {
    try {
      const script = compileScript(descriptor, { id: 'verify', inlineTemplate: false })
      bindings = script.bindings || {}
    } catch (error) { fail(`${rel(file)} 的 <script setup> 编译失败: ${error.message}`) }
  }
  if (descriptor.template) {
    try {
      const template = compileTemplate({
        source: descriptor.template.content,
        filename: file,
        id: 'verify',
        compilerOptions: { prefixIdentifiers: true, bindingMetadata: bindings },
      })
      templateCode = template.code
    } catch (error) { fail(`${rel(file)} 的模板编译失败: ${error.message}`) }
  }
  parsed.set(file, { source, descriptor, bindings, templateCode })
}

// --- [1] 模板标识符 -------------------------------------------------------------------------
console.log('[1] 模板标识符')
let identifierCount = 0
for (const [file, info] of parsed) {
  const names = new Set([...info.templateCode.matchAll(/_ctx\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]))
  const missing = [...names].filter((name) => !info.bindings[name] && !name.startsWith('$'))
  identifierCount += names.size
  if (missing.length) fail(`${rel(file)} 模板用到了 <script setup> 里没有的: ${missing.join(', ')}`)
}
if (!failures) console.log(`    OK    ${vueFiles.length} 个组件里 ${identifierCount} 个模板标识符都有定义`)

const beforeDirective = failures

// --- [2] 自定义指令必须被 import --------------------------------------------------------------
// v-reveal 是在每个用到它的组件里 `import { vReveal }` 的（不给全局注册），
// 漏掉 import 时编译器只会生成 _resolveDirective('reveal')，运行时静默失效、只在控制台警告。
console.log('[2] 自定义指令')
const BUILTIN_DIRECTIVES = new Set(['if', 'else', 'else-if', 'for', 'model', 'bind', 'on', 'slot', 'html', 'text', 'show', 'cloak', 'once', 'memo', 'pre', 'is'])
let directiveUses = 0
for (const [file, info] of parsed) {
  if (!info.descriptor.template) continue
  const used = new Set([...info.descriptor.template.content.matchAll(/\sv-([a-z][\w-]*)/g)].map((m) => m[1]))
  for (const name of used) {
    if (BUILTIN_DIRECTIVES.has(name)) continue
    directiveUses += 1
    const camel = 'v' + name.replace(/(^|-)([a-z])/g, (_, __, c) => c.toUpperCase())
    if (!info.bindings[camel]) fail(`${rel(file)} 用了 v-${name}，但脚本里没有 import ${camel}`)
  }
}
if (failures === beforeDirective) console.log(`    OK    ${directiveUses} 处自定义指令都在各自组件里 import 了`)

// --- [3] 导航目标 ↔ 路由 ↔ 页面组件 -----------------------------------------------------------
console.log('[3] 导航目标 / 路由 / 页面组件')
const routesSource = fs.readFileSync(path.join(root, 'app/routes.js'), 'utf8')
const navigationSource = fs.readFileSync(path.join(root, 'app/navigation.js'), 'utf8')
const registrySource = fs.readFileSync(path.join(root, 'app/pageRegistry.js'), 'utf8')

// 只认路由记录：`name:` 必须和 `path:` 在同一行（避开 NoopView 自己的 name）。
const routeNames = new Set([...routesSource.matchAll(/path:\s*'[^']*'[^}]*?name:\s*'([^']+)'/g)].map((m) => m[1]))

const pageIds = new Set()
for (const [file, info] of parsed) {
  for (const m of info.source.matchAll(/\bgo\(\s*'([^']+)'\s*\)/g)) pageIds.add(m[1])
  for (const m of info.source.matchAll(/currentPage\s*===\s*'([^']+)'/g)) pageIds.add(m[1])
  void file
}
// 页面 id 也来自两个导航数组（其他 `{ id, label }` 字面量不是页面 id）。
for (const arrayName of ['navigation', 'secondaryNavigation']) {
  const block = navigationSource.match(new RegExp(`export const ${arrayName} = \\[([\\s\\S]*?)\\n\\]`))
  if (!block) { fail(`app/navigation.js 里找不到 ${arrayName} 数组`); continue }
  for (const m of block[1].matchAll(/\{\s*id:\s*'([^']+)'/g)) pageIds.add(m[1])
}
// 页面注册表里的键就是可渲染的页面集合。带连字符的 id 必须写成 'smoke-test': X，
// 所以两种写法都要认（否则「有路由但没组件」会误报）。
const registryBlock = registrySource.match(/export const pageComponents = \{([\s\S]*?)\n\}/)
const registered = new Set(registryBlock ? [...registryBlock[1].matchAll(/^\s*'?([A-Za-z][\w-]*)'?\s*:/gm)].map((m) => m[1]) : [])
if (!registryBlock) fail('app/pageRegistry.js 里找不到 pageComponents')

const unrouted = [...pageIds].filter((id) => !routeNames.has(id)).sort()
const unregistered = [...routeNames].filter((name) => !registered.has(name) && name !== 'publicDiary').sort()
const unusedRoutes = [...routeNames].filter((name) => !pageIds.has(name)).sort()
if (unrouted.length) fail(`有页面 id 但没有对应路由: ${unrouted.join(', ')}`)
if (unregistered.length) fail(`有路由但页面注册表里没有组件: ${unregistered.join(', ')}`)
if (!unrouted.length && !unregistered.length) console.log(`    OK    ${pageIds.size} 个页面 id 都能路由到、也都有组件`)
if (unusedRoutes.length) console.log(`    note  没有被导航到的路由: ${unusedRoutes.join(', ')}`)

// 页面组件必须住在自己的文件夹里：pages/<页面 id>/<Xxx>Page.vue
// 这是「一个页面一个文件夹」这条约定唯一能自动验证的部分。
// 同步 import 和 defineAsyncComponent 里那种按需 import 都要认。
for (const m of registrySource.matchAll(/^\s*'?([A-Za-z][\w-]*)'?:\s*([A-Za-z]\w*),/gm)) {
  const [, id, symbol] = m
  const direct = registrySource.match(new RegExp(`import\\s+${symbol}\\s+from\\s+'([^']+)'`))
  const lazy = registrySource.match(new RegExp(`const\\s+${symbol}\\s*=\\s*defineAsyncComponent\\(([\\s\\S]*?)\\n\\}\\)`))
  const lazyTarget = lazy?.[1].match(/import\('([^']+)'\)/)?.[1]
  const target = direct?.[1] || lazyTarget
  if (!target) { fail(`app/pageRegistry.js 里的 ${id} 既没有 import 也没有 defineAsyncComponent 的 loader`); continue }
  const expected = `@/pages/${id}/`
  if (!target.startsWith(expected)) fail(`页面 ${id} 的组件在 ${target}，应当放在 ${expected} 下`)
}
const lazyImports = [...registrySource.matchAll(/import\('@\/pages\/([a-zA-Z]+)\//g)].map((m) => m[1])
for (const id of lazyImports) {
  if (!registered.has(id)) fail(`按需加载的页面 ${id} 不在 pageComponents 里`)
}

// --- [4] 模板 class 必须有样式 ----------------------------------------------------------------
// 手抄模板时把 `diary-card-actions` 写成 `diary-card-action`，构建照样绿、页面只是少一块样式。
//
// KNOWN_UNSTYLED：这是重构之前就存在的、模板里用到但样式表里根本没有规则的一批 class。
// 它们大多是纯钩子（页面标识、修饰名），也可能是当年漏写的样式。**没有替它们发明样式**——
// 那属于设计改动，不是重构该做的事。清单一旦过期（某个 class 后来被赋予了样式）就会报错，
// 所以它不会悄悄烂掉。
console.log('[4] 模板 class 与样式规则')
const KNOWN_UNSTYLED = new Set([
  'modules/article/ArticleEditorDialog.vue → .article-editor',
  'modules/article/ArticleEditorDialog.vue → .visibility-field',
  'modules/diary/DiaryEditorDialog.vue → .visibility-field',
  'modules/media/MediaEditorDialog.vue → .visibility-field',
  'modules/music/MusicEditorDialog.vue → .visibility-field',
  'modules/music/MusicLibrary.vue → .danger-icon',
  'pages/about/AboutPage.vue → .about-page',
  'pages/messages/MessagesPage.vue → .message-list',
])
const scopedCssByFile = new Map()
for (const [file, info] of parsed) {
  const blocks = [...info.source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
  scopedCssByFile.set(file, blocks.replace(/\/\*[\s\S]*?\*\//g, ''))
}
const missingClasses = []
const stillMissing = new Set()
for (const [file, info] of parsed) {
  if (!info.descriptor.template) continue
  const own = scopedCssByFile.get(file) || ''
  const seen = new Set()
  // class="..." 里只取静态部分；`:class="{ active: x }"` 这种动态类名由 JS 决定，不在这里查。
  for (const m of info.descriptor.template.content.matchAll(/(?<!:)class="([^"]*)"/g)) {
    for (const name of m[1].split(/\s+/)) {
      if (!name || seen.has(name)) continue
      seen.add(name)
      const re = new RegExp('\\.' + name.replace(/[-.]/g, '\\$&') + '(?![\\w-])')
      if (re.test(own) || re.test(cssNoComments)) continue
      const key = `${srcRel(file)} → .${name}`
      if (KNOWN_UNSTYLED.has(key)) { stillMissing.add(key); continue }
      missingClasses.push(key)
    }
  }
}
const staleAllowlist = [...KNOWN_UNSTYLED].filter((key) => !stillMissing.has(key))
if (missingClasses.length) fail(`模板里用到但任何地方都没有样式的 class: ${missingClasses.slice(0, 12).join(', ')}${missingClasses.length > 12 ? ` …共 ${missingClasses.length} 个` : ''}`)
if (staleAllowlist.length) fail(`「已知无样式」清单已经过期，请从 verify-frontend.mjs 的 KNOWN_UNSTYLED 里删掉: ${staleAllowlist.join(', ')}`)
if (!missingClasses.length && !staleAllowlist.length) {
  console.log('    OK    模板里每个静态 class 都有样式规则')
  if (KNOWN_UNSTYLED.size) console.log(`    note  ${KNOWN_UNSTYLED.size} 个 class 在重构前就没有样式，已登记在脚本的 KNOWN_UNSTYLED 里`)
}

// --- [5] fixed 定位的包含块 --------------------------------------------------------------------
// 右下角播放器和所有弹窗都是 .app-shell 的 position:fixed 后代。祖先上只要出现
// transform/filter/perspective/backdrop-filter/contain，或者动画以 fill-mode:both 留下了这些属性，
// 这个祖先就会变成它们的包含块——播放器会贴到文档底部、弹窗会以整页而不是视口居中。这个回归上线过一次。
console.log('[5] fixed 定位的包含块')
const fixedAncestors = ['html', 'body', '#app', '.app-shell']
const containingProps = ['transform', 'filter', 'perspective', 'backdrop-filter', 'contain', 'translate', 'rotate', 'scale']
const offenders = []
for (const m of cssNoComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim()
  if (selector.startsWith('@')) continue
  const parts = selector.split(',').map((s) => s.trim())
  if (!parts.some((s) => fixedAncestors.includes(s))) continue
  for (const prop of containingProps) {
    const hit = m[2].match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'))
    if (hit && !/^\s*none\s*$/.test(hit[1])) offenders.push(`${selector} sets ${prop}: ${hit[1].trim()}`)
  }
}
for (const m of cssNoComments.matchAll(/@keyframes\s+shellReveal\s*\{([\s\S]*?)\n\}/g)) {
  for (const prop of containingProps) {
    if (new RegExp(`${prop}\\s*:`, 'i').test(m[1])) offenders.push(`@keyframes shellReveal animates ${prop}`)
  }
}
if (offenders.length) offenders.forEach(fail)
else console.log('    OK    html/body/#app/.app-shell 上没有会形成包含块的属性')

// --- [6] 粒子背景可见性 -------------------------------------------------------------------------
// mix-blend-mode:screen 会让粒子在浅色主题下消失（对近白背景做 screen 还是近白）。
console.log('[6] 粒子背景可见性')
const particleRules = cssNoComments.match(/\.particle-field\{[^}]*\}/g) || []
const blended = particleRules.filter((rule) => /mix-blend-mode\s*:\s*(?!normal)/i.test(rule))
const faded = particleRules.filter((rule) => {
  const hit = rule.match(/opacity\s*:\s*([\d.]+)/)
  return hit && Number(hit[1]) < 0.2
})
if (blended.length || faded.length) fail(`粒子画布被混合或淡到看不见: ${[...blended, ...faded].join(' | ')}`)
else console.log('    OK    粒子画布没有被混合掉或淡到接近 0')

// --- [7] 滚动容器里的下拉菜单 --------------------------------------------------------------------
// 导航在窄屏是横向滚动容器。滚动容器会裁掉绝对定位的后代，「更多」菜单因此整块画不出来
// （按钮高亮、菜单有布局盒，但一个像素都没画、也点不到）。
//
// 2026 换壳后导航从 .side-nav 变成 .dock-track，所以这里不再写死某一个选择器：
// 凡是「模板里真的在用、且 CSS 把它设成滚动容器」的导航容器，都必须把菜单 teleport 出去。
console.log('[7] 下拉菜单 vs 滚动容器')
const navSelectors = ['.side-nav', '.dock-track']
const scrollableNav = navSelectors.filter((selector) => {
  const rules = cssNoComments.match(new RegExp(`${selector.replace('.', '\\.')}[^{]*\\{[^}]*\\}`, 'g')) || []
  return rules.some((rule) => /overflow(-x)?\s*:\s*(auto|scroll|hidden)/i.test(rule))
})
const layoutSource = walk(path.join(root, 'layouts'), (name) => name.endsWith('.vue'))
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n')
const usesScrollableNav = scrollableNav.some((selector) => (
  new RegExp(`class="[^"]*${selector.slice(1)}\\b`).test(layoutSource)
))
const teleportsMenu = /<Teleport\s+to="body">[\s\S]*?(nav-more-menu|dock-more-panel)[\s\S]*?<\/Teleport>/.test(layoutSource)
if (scrollableNav.length && usesScrollableNav && !teleportsMenu) {
  fail(`${scrollableNav.join(' / ')} 是滚动容器，但「更多」菜单没有 teleport 到 body`)
} else if (scrollableNav.length && usesScrollableNav) {
  console.log(`    OK    ${scrollableNav.join(' / ')} 可滚动，且「更多」菜单被 teleport 出了滚动容器`)
} else if (scrollableNav.length) {
  console.log(`    OK    ${scrollableNav.join(' / ')} 有滚动规则，但模板里没有用它（历史样式）`)
} else {
  console.log('    OK    导航不是滚动容器')
}

// --- [8] 每个目录都有一份 README ---------------------------------------------------------------
// 「每个文件夹写一份 README」是这次重构定下的约定，光靠自觉会慢慢烂掉，所以直接查。
console.log('[8] 目录 README')
const folders = []
const collectFolders = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    folders.push(full)
    collectFolders(full)
  }
}
collectFolders(root)
const missingReadme = folders.filter((dir) => !fs.existsSync(path.join(dir, 'README.md')))
// 空的目录（例如删了文件之后剩下的壳）不算数。
const emptyFolders = folders.filter((dir) => fs.readdirSync(dir).length === 0)
// 根目录那几份「契约文件」也不能少：AGENTS.md 是 AI 在新会话里唯一会自动读到的文件，
// 它一旦被删，所有约定就只剩人记得了。
const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const requiredDocs = ['AGENTS.md', 'README.md', 'CONTRIBUTING.md', '项目结构说明.md', 'CHANGELOG.md', 'LICENSE']
const missingDocs = requiredDocs.filter((name) => !fs.existsSync(path.join(repoRoot, name)))
if (missingReadme.length) fail(`这些目录没有 README.md: ${missingReadme.map((d) => srcRel(d)).join(', ')}`)
if (emptyFolders.length) fail(`这些目录是空的: ${emptyFolders.map((d) => srcRel(d)).join(', ')}`)
if (missingDocs.length) fail(`仓库根目录缺少这些文件: ${missingDocs.join(', ')}`)
if (!missingReadme.length && !emptyFolders.length && !missingDocs.length) console.log(`    OK    ${folders.length} 个目录都有自己的 README.md，没有空目录；根目录 ${requiredDocs.length} 份契约文件齐全`)

// --- [9] 孤儿文件 --------------------------------------------------------------------------------
// 「拆分之后某个组件谁都不引用了」是重构最常见的遗留物：构建照样过、页面看起来也正常，
// 只是包里多带一份没人用的代码。这里顺着 import 图找一遍。
//
// KNOWN_UNREFERENCED 是明确知道「当前没有挂载」的文件。清单一旦过期（有人把它接回去了）
// 就会报错，所以它不会悄悄烂掉。
console.log('[9] 孤儿文件')
const KNOWN_UNREFERENCED = new Set([
  // 歌词栏：当前版本的播放器是单栏，它还没接回来。它是可用功能，不是死代码——
  // ssr-smoke 仍在覆盖它的四个状态分支。要接回来只需在音乐页的 .music-console 里加一列。
  'modules/music/LyricsPanel.vue',
])

const codeFiles = walk(root, (name) => /\.(vue|js|ts|css)$/.test(name))
const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  .replace(/<!--[\s\S]*?-->/g, '')
const importRe = /(?:import\s+[^'"]*?from\s*|import\s*\(\s*|import\s+|@import\s+|url\(\s*)['"]([^'"]+)['"]/g
const referenced = new Set()
const unresolvedImports = []
for (const file of codeFiles) {
  const text = stripComments(fs.readFileSync(file, 'utf8'))
  for (const m of text.matchAll(importRe)) {
    let spec = m[1]
    // Vite 的查询后缀（`perf.css?inline`、`icon.svg?raw`）不是路径的一部分，解析前先剥掉。
    // 只剥后缀、照样校验文件存在——`?inline` 引进来的文件一样可能被删掉。
    const queryAt = spec.indexOf('?')
    if (queryAt >= 0) spec = spec.slice(0, queryAt)
    // `@/` 就是 frontend/src 本身（见 vite.config.js 的 alias），所以剥掉前缀即可；
    // `./x` 则相对于当前文件所在的 src 子目录。
    if (spec.startsWith('@/')) spec = spec.slice(2)
    else if (spec.startsWith('.')) spec = path.posix.join(path.dirname(srcRel(file)), spec)
    else continue // 裸包名
    const candidates = [
      path.join(root, spec),
      ...['js', 'ts', 'vue', 'css', 'json'].map((ext) => path.join(root, `${spec}.${ext}`)),
      ...['index.js', 'index.ts', 'index.vue', 'index.css'].map((f) => path.join(root, spec, f)),
    ]
    const hit = candidates.find((c) => fs.existsSync(c))
    if (hit) referenced.add(hit)
    else unresolvedImports.push(`${srcRel(file)} → ${m[1]}`)
  }
}
// main.js 是入口，由 index.html 加载，没有谁 import 它。
const orphans = codeFiles.filter((f) => !referenced.has(f) && srcRel(f) !== 'main.js')
const unknownOrphans = orphans.filter((f) => !KNOWN_UNREFERENCED.has(srcRel(f)))
const staleKnown = [...KNOWN_UNREFERENCED].filter((key) => !orphans.some((f) => srcRel(f) === key))
if (unresolvedImports.length) fail(`解析不了的 import: ${unresolvedImports.join('; ')}`)
if (unknownOrphans.length) fail(`没有任何地方引用的文件: ${unknownOrphans.map(srcRel).join(', ')}`)
if (staleKnown.length) fail(`KNOWN_UNREFERENCED 已经过期（这些文件有人引用了）: ${staleKnown.join(', ')}`)
if (!unknownOrphans.length && !staleKnown.length && !unresolvedImports.length) {
  console.log(`    OK    ${codeFiles.length} 个文件都有引用${KNOWN_UNREFERENCED.size ? `（${KNOWN_UNREFERENCED.size} 个已知未挂载，见脚本里的 KNOWN_UNREFERENCED）` : ''}`)
}

// --- [10] 分层越界 ------------------------------------------------------------------------------
// 「页面里不许出现 request() / localStorage」「services 不许读响应式状态」这两条是结构的地基：
// 破一条，页面就开始各写各的、离屏测试也开始失效。它们没有编译期检查，所以在这里查。
console.log('[10] 分层越界')
const layerRules = [
  {
    // 页面与可复用块只做呈现与编排；要数据就问 store，要改数据就调 store 的动作。
    dirs: ['pages', 'modules'],
    files: (f) => f.endsWith('.vue'),
    pattern: /\b(request|uploadMedia)\s*\(|\b(localStorage|sessionStorage)\b/,
    message: '页面/模块组件里直接调了后端或读本机存储',
    hint: '这些属于 services（请求）与 stores（状态），组件只该调 store 的动作',
  },
  {
    // 服务层保持「纯函数 + 参数进参数出」，这样 verify-lyrics/ocr/perf 才能离线 import 它们对拍。
    dirs: ['services'],
    files: (f) => f.endsWith('.js'),
    pattern: /from\s+['"](?:vue|@\/stores\/|\.\.?\/stores\/)/,
    message: '服务层 import 了 Vue 或 store',
    hint: 'services 只接受参数、返回结果；需要响应式就去 store 里包一层',
  },
]
let layerViolations = 0
for (const rule of layerRules) {
  for (const dir of rule.dirs) {
    const base = path.join(root, dir)
    if (!fs.existsSync(base)) continue
    for (const file of walk(base, rule.files)) {
      const text = stripComments(fs.readFileSync(file, 'utf8'))
      for (const m of text.matchAll(new RegExp(rule.pattern.source, 'g'))) {
        // 报出行号，方便直接跳过去
        const line = text.slice(0, m.index).split('\n').length
        fail(`${srcRel(file)}:${line} ${rule.message}（${m[0].trim()}）—— ${rule.hint}`)
        layerViolations += 1
      }
    }
  }
}
if (!layerViolations) console.log('    OK    页面/模块没有直接调后端或读本机存储；服务层没有 import Vue 或 store')

// --- [11] 不许写 <style scoped> ------------------------------------------------------------------
// scoped 会给选择器加一个属性选择器（类 + 属性），于是它能压过 styles/ 里同选择器的规则——
// 「统一圆角」那一层就是这么对学习页失效的（学习页到现在还有 30/19/17 三种圆角）。
// 现在只剩学习页一处历史遗留，修好它比在新组件里复制这个坑重要得多。
console.log('[11] 不许写 <style scoped>')
const KNOWN_SCOPED_STYLES = new Set([
  // 学习页：把 177 条 scoped 规则里的 border-radius 与 transition 提高优先级，压过了
  // styles/polish-and-light-theme.css 的统一圆角层。要改就得连视觉一起改，所以留作待办，
  // 见 pages/study/README.md。新组件不要照抄这个写法。
  'pages/study/StudyPage.vue',
])
const scopedUses = []
for (const [file, info] of parsed) {
  if (!/<style[^>]*\bscoped\b/.test(info.source)) continue
  scopedUses.push(srcRel(file))
}
const unknownScoped = scopedUses.filter((f) => !KNOWN_SCOPED_STYLES.has(f))
const staleScoped = [...KNOWN_SCOPED_STYLES].filter((f) => !scopedUses.includes(f))
if (unknownScoped.length) fail(`新写了 <style scoped>: ${unknownScoped.join(', ')}—— 样式请放进 styles/，或（按需加载的页面）用 import './xxx.css'`)
if (staleScoped.length) fail(`KNOWN_SCOPED_STYLES 已经过期（这些文件不再用 scoped 了）: ${staleScoped.join(', ')}`)
if (!unknownScoped.length && !staleScoped.length) {
  console.log(`    OK    没有新增 <style scoped>${KNOWN_SCOPED_STYLES.size ? '（1 处历史遗留已登记）' : ''}`)
}

// --- [12] 单文件体积提示 -------------------------------------------------------------------------
// 这次结构重排就是为了把 1540 行的 App.vue 拆开。如果某个页面/块又长成几百行，多半是
// 「本该拆出去的板块」又堆回去了。只提示不拦：有些页面（绩效、学习）本来就是整块业务。
console.log('[12] 文件体积')
const BIG = 400
const bigFiles = []
for (const [file, info] of parsed) {
  if (!/(^|\/)(pages|modules|layouts)\//.test(srcRel(file))) continue
  const lines = info.source.split('\n').length
  if (lines > BIG) bigFiles.push(`${srcRel(file)} (${lines} 行)`)
}
if (bigFiles.length) console.log(`    note  超过 ${BIG} 行的页面/块（考虑把板块拆到 components/）: ${bigFiles.join(', ')}`)
else console.log(`    OK    没有超过 ${BIG} 行的页面/块`)

// --- [13] 样式里没有「谁都不用的类名」 --------------------------------------------------------
// [4] 管「模板里写的 class 必须有规则」；这一项管反方向——**样式里的每个类名都必须有人用**。
//
// 为什么需要它：组件删了、页面下线了、版式改版了，样式却几乎没人回头删。2026 年清过一次：
// 179 个类名在整个 src 里一次都不出现，占全部样式的 25%（首屏 CSS 206 kB → 164 kB）。
// 起因是四件事叠加——首页重做（HeroCard/QuoteCard/DiaryPreview 删除）、侧边栏删除、
// 归档/分类/标签/友链四个页面下线、学习页改版六次，每一次都只加样式不删。
// 这种腐烂完全安静，所以必须由检查盯着。
//
// 判据故意从宽：类名当成普通单词，在**去掉注释的** .vue/.js 里搜，任何一处出现就算在用。
// 这样将来有人用拼接的方式生成类名（`'is-' + state`）也不会被误判成死样式。
// 框架自己生成的类要减掉：<Transition>/<TransitionGroup> 的六个阶段类、
// `is-${…}` 这类模板字面量前缀、以及 v-reveal 与 useDark 注入的 reveal / is-visible / dark。
console.log('[13] 样式里没有没人用的类名')
const KNOWN_UNUSED_CSS = new Set([
  // 每条都要写清原因。现在一条都没有——2026 年这一轮清干净了，保持住。
  // 注意：修好对应样式之后这一行会变成「过期登记」并报错，所以它不会悄悄留住垃圾。
])

const codeWords = new Set()
for (const file of walk(root, (name) => /\.(vue|js)$/.test(name))) {
  const text = stripComments(fs.readFileSync(file, 'utf8'))
  for (const m of text.matchAll(/[A-Za-z_$][\w$-]*/g)) codeWords.add(m[0])
}

const cssClassNames = new Set()
for (const file of cssFiles) {
  const text = fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@import[^;]+;/g, '')
    // 相对路径与引号里的东西（`url(./a.png)`、`[href$=".pdf"]`）不是类名
    .replace(/url\([^)]*\)/g, '')
    .replace(/"[^"]*"|'[^']*'/g, '')
  for (const m of text.matchAll(/\.([A-Za-z][\w-]*)/g)) cssClassNames.add(m[1])
}

const cssGenerated = new Set(['reveal', 'is-visible', 'dark', 'light'])
for (const file of vueFiles) {
  const text = fs.readFileSync(file, 'utf8')
  for (const m of text.matchAll(/<Transition(?:Group)?\s+name="([\w-]+)"/g)) {
    for (const phase of ['enter-active', 'enter-from', 'enter-to', 'leave-active', 'leave-from', 'leave-to']) {
      cssGenerated.add(`${m[1]}-${phase}`)
    }
  }
  for (const m of text.matchAll(/`([A-Za-z][\w-]*-)\$\{/g)) {
    for (const name of cssClassNames) if (name.startsWith(m[1])) cssGenerated.add(name)
  }
}

const unusedCss = [...cssClassNames].filter((n) => !codeWords.has(n) && !cssGenerated.has(n)).sort()
const notRegistered = unusedCss.filter((n) => !KNOWN_UNUSED_CSS.has(n))
const staleUnused = [...KNOWN_UNUSED_CSS].filter((n) => !unusedCss.includes(n))
if (notRegistered.length) {
  const shown = notRegistered.slice(0, 12).join('、')
  fail(`样式里有 ${notRegistered.length} 个类名没有任何模板/脚本在用: ${shown}${notRegistered.length > 12 ? ' …' : ''}—— 删掉那些规则；确实要留就登记进 KNOWN_UNUSED_CSS 并写清原因`)
}
if (staleUnused.length) fail(`KNOWN_UNUSED_CSS 已经过期（这些类名现在有人用了）: ${staleUnused.join(', ')}`)
if (!notRegistered.length && !staleUnused.length) {
  console.log(`    OK    ${cssClassNames.size} 个类名都有对应的模板/脚本在用`)
}

console.log(failures ? `\n${failures} problem(s) found.` : `\nAll frontend checks passed (${vueFiles.length} components, ${cssFiles.length} stylesheets, ${folders.length} folders).`)
process.exitCode = failures ? 1 : 0