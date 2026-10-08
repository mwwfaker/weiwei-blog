// Static checks that a production build cannot catch. Run with: node verify-frontend.mjs
//   1. Every identifier used in the App.vue template must exist in <script setup> (or be a Vue
//      instance property). A missing one compiles to `_ctx.name` and throws or silently no-ops.
//   2. Every page id the app navigates to must have a matching route name, otherwise
//      router.push({ name }) throws and the page becomes unreachable.
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(new URL('./frontend/package.json', import.meta.url))
const { parse, compileScript, compileTemplate } = require('vue/compiler-sfc')

// Paths are resolved against this file so the script works from any working directory.
const appUrl = new URL('./frontend/src/App.vue', import.meta.url)
const routesUrl = new URL('./frontend/src/routes.js', import.meta.url)
const filename = 'frontend/src/App.vue'
const source = fs.readFileSync(appUrl, 'utf8')
const { descriptor, errors } = parse(source, { filename })
if (errors.length) {
  console.error('App.vue failed to parse:', errors)
  process.exit(1)
}

let failures = 0

// --- 1. undefined template identifiers -------------------------------------------------------
const script = compileScript(descriptor, { id: 'x', inlineTemplate: false })
const template = compileTemplate({
  source: descriptor.template.content,
  filename,
  id: 'x',
  compilerOptions: { prefixIdentifiers: true, bindingMetadata: script.bindings },
})
const setupNames = new Set(Object.keys(script.bindings || {}))
const ctxRefs = new Map()
for (const m of template.code.matchAll(/_ctx\.([A-Za-z_$][\w$]*)/g)) {
  ctxRefs.set(m[1], (ctxRefs.get(m[1]) || 0) + 1)
}

console.log('[1] template identifiers')
const undefinedRefs = []
for (const [name, count] of [...ctxRefs].sort()) {
  if (setupNames.has(name)) continue
  if (name.startsWith('$')) continue // Vue instance properties such as $nextTick
  undefinedRefs.push(`${name} (x${count})`)
}
if (undefinedRefs.length) {
  failures += undefinedRefs.length
  console.log(`    FAIL  not defined in <script setup>: ${undefinedRefs.join(', ')}`)
} else {
  console.log(`    OK    all ${ctxRefs.size} non-setup template names are Vue instance properties`)
}

// --- 2. every navigated page id has a route -------------------------------------------------
console.log('[2] navigation targets vs routes')
const routeSource = fs.readFileSync(routesUrl, 'utf8')
// Only route records: `name:` must sit on the same line as `path:` (avoids the no-op view's name).
const routeNames = new Set(
  [...routeSource.matchAll(/path:\s*'[^']*'[^}]*?name:\s*'([^']+)'/g)].map((m) => m[1]),
)

const pageIds = new Set()
for (const m of source.matchAll(/\bgo\(\s*'([^']+)'\s*\)/g)) pageIds.add(m[1])
for (const m of source.matchAll(/currentPage\s*===\s*'([^']+)'/g)) pageIds.add(m[1])
// Page ids come from the two navigation arrays; other `{ id, label }` literals (such as the diary
// visibility filter) are not page ids and must not be treated as navigation targets.
for (const arrayName of ['navigation', 'secondaryNavigation']) {
  const block = source.match(new RegExp(`const ${arrayName} = \\[([\\s\\S]*?)\\n\\]`))
  if (!block) { console.log(`    FAIL  could not find the ${arrayName} array`); failures += 1; continue }
  for (const m of block[1].matchAll(/\{\s*id:\s*'([^']+)'/g)) pageIds.add(m[1])
}

const unrouted = [...pageIds].filter((id) => !routeNames.has(id)).sort()
const unusedRoutes = [...routeNames].filter((name) => !pageIds.has(name)).sort()
if (unrouted.length) {
  failures += unrouted.length
  console.log(`    FAIL  navigated but has no route: ${unrouted.join(', ')}`)
} else {
  console.log(`    OK    all ${pageIds.size} page ids have a route`)
}
if (unusedRoutes.length) console.log(`    note  routes with no navigated page id: ${unusedRoutes.join(', ')}`)

// --- 3. position:fixed ancestors ------------------------------------------------------------
// The bottom music player and every modal are position:fixed descendants of .app-shell. A
// transform/filter/perspective/backdrop-filter/contain on an ancestor, or one left behind by a
// finished animation with fill-mode:both, silently turns that ancestor into their containing block —
// then the player sticks to the bottom of the document and modals centre on the whole page instead
// of the viewport. That regression shipped once, so it is checked here.
console.log('[3] fixed-position ancestors')
const css = fs.readFileSync(new URL('./frontend/src/style.css', import.meta.url), 'utf8')
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
const fixedAncestors = ['html', 'body', '#app', '.app-shell']
// transform, filter, perspective, backdrop-filter, contain, and the individual translate/rotate/
// scale properties all make an element the containing block for fixed-position descendants.
const containingProps = ['transform', 'filter', 'perspective', 'backdrop-filter', 'contain', 'translate', 'rotate', 'scale']
const offenders = []
for (const m of cssNoComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const selector = m[1].trim()
  if (selector.startsWith('@')) continue
  // Only the ancestor itself, not its descendants or pseudo-elements.
  const parts = selector.split(',').map((s) => s.trim())
  const targetsAncestor = parts.some((s) => fixedAncestors.includes(s))
  if (!targetsAncestor) continue
  for (const prop of containingProps) {
    const hit = m[2].match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'))
    if (hit && !/^\s*none\s*$/.test(hit[1])) offenders.push(`${selector} sets ${prop}: ${hit[1].trim()}`)
  }
}
// A keyframe that animates any of them re-introduces the problem through animation-fill-mode.
for (const m of cssNoComments.matchAll(/@keyframes\s+shellReveal\s*\{([\s\S]*?)\n\}/g)) {
  for (const prop of ['transform', 'filter', 'perspective', 'backdrop-filter', 'translate', 'rotate', 'scale']) {
    if (new RegExp(`${prop}\\s*:`, 'i').test(m[1])) offenders.push(`@keyframes shellReveal animates ${prop}`)
  }
}
if (offenders.length) {
  failures += offenders.length
  for (const o of offenders) console.log(`    FAIL  ${o}`)
} else {
  console.log('    OK    no fixed-position containing block on html/body/#app/.app-shell')
}

// --- 4. particle field visibility -----------------------------------------------------------
// mix-blend-mode:screen made the particles vanish on the light theme (screen against a near-white
// backdrop is near-white). Colours are chosen per theme in ParticleField instead.
console.log('[4] background particle visibility')
const particleRule = cssNoComments.match(/\.particle-field\{[^}]*\}/g) || []
const blended = particleRule.filter((rule) => /mix-blend-mode\s*:\s*(?!normal)/i.test(rule))
// Below ~0.2 the canvas is effectively invisible against the page background.
const zeroed = particleRule.filter((rule) => {
  const hit = rule.match(/opacity\s*:\s*([\d.]+)/)
  return hit && Number(hit[1]) < 0.2
})
if (blended.length || zeroed.length) {
  failures += 1
  console.log(`    FAIL  particle canvas is blended or faded out: ${[...blended, ...zeroed].join(' | ')}`)
} else {
  console.log('    OK    particle canvas is not blended away or faded to near-zero')
}

// --- 5. dropdown inside a scroll container ---------------------------------------------------
// .side-nav uses overflow-x:auto so the seven nav items can scroll on narrow screens. A scroll
// container CLIPS its absolutely-positioned descendants, so the 更多 dropdown rendered completely
// invisibly: the button highlighted, the menu even reported a layout box, but nothing was painted
// and no item could be clicked. It is teleported to <body> instead. Guard both halves.
console.log('[5] dropdown vs scroll container')
const sideNavRules = cssNoComments.match(/\.side-nav[^{]*\{[^}]*\}/g) || []
const scrollableNav = sideNavRules.filter((rule) => /overflow(-x)?\s*:\s*(auto|scroll|hidden)/i.test(rule))
const teleportsMenu = /<Teleport\s+to="body">[\s\S]*?nav-more-menu[\s\S]*?<\/Teleport>/.test(source)
if (scrollableNav.length && !teleportsMenu) {
  failures += 1
  console.log('    FAIL  .side-nav is a scroll container but .nav-more-menu is not teleported to body')
  console.log(`          ${scrollableNav[0].slice(0, 96)}`)
} else if (scrollableNav.length) {
  console.log('    OK    scrollable nav, and the dropdown is teleported out of it')
} else {
  console.log('    OK    .side-nav is not a scroll container')
}

// --- 6. class used in a template but missing from the stylesheet ---------------------------------
// A marker-based CSS splice once wiped a whole block of rules (.perf-stat, .perf-tabs, .perf-card…)
// and nothing caught it: the build stays green and the page just renders unstyled.
// Scoped styles must define every `perf-*` class the template uses.
console.log('[6] scoped classes have styles')
const perfCss = cssNoComments
const missingClasses = []
for (const [, list] of source.matchAll(/(?<!:)class="([^"]*)"/g)) {
  for (const name of list.split(/\s+/)) {
    if (!name.startsWith('perf-')) continue
    if (missingClasses.some((m) => m.name === name)) continue
    const re = new RegExp('\\.' + name.replace(/[-]/g, '\\-') + '(?![\\w-])')
    if (!re.test(perfCss)) missingClasses.push({ name })
  }
}
if (missingClasses.length) {
  failures += 1
  console.log('    FAIL  template uses classes with no CSS rule: ' + missingClasses.map((m) => '.' + m.name).join(', '))
} else {
  console.log('    OK    every perf-* class used in the template has a style rule')
}

// --- 7. scoped classes of the perf tool --------------------------------------------------------
// The [6] check only looked at App.vue against style.css, so it missed that PerfPanel.vue had lost
// its own toolbar rules (.perf-bar, .perf-btn, .perf-mark…) — the page rendered but the header was
// unstyled. Check every component's template against its own <style scoped> block.
console.log('[7] component scoped classes have styles')
const componentFiles = ['frontend/src/PerfPanel.vue', 'frontend/src/StudyPlan.vue']
const scopedGaps = []
for (const rel of componentFiles) {
  const text = fs.readFileSync(new URL('./' + rel, import.meta.url), 'utf8')
  const styleAt = text.indexOf('<style scoped>')
  if (styleAt < 0) continue
  const scoped = text.slice(styleAt).replace(/\/\*[\s\S]*?\*\//g, '')
  const seen = new Set()
  for (const [, list] of text.matchAll(/(?<!:)class="([^"]*)"/g)) {
    for (const name of list.split(/\s+/)) {
      if (!name || seen.has(name)) continue
      seen.add(name)
      const re = new RegExp('\\.' + name.replace(/[-]/g, '\\-') + '(?![\\w-])')
      // 有些类（.roster 这类钩子、.button-secondary 这类全局按钮）本来就不在 scoped 块里，
      // 只要全局 style.css 里有定义就不算缺失。
      if (!re.test(scoped) && !re.test(cssNoComments)) scopedGaps.push(rel.split('/').pop() + ' → .' + name)
    }
  }
}
if (scopedGaps.length) {
  failures += 1
  console.log('    FAIL  classes used but never styled: ' + scopedGaps.slice(0, 8).join(', '))
} else {
  console.log('    OK    every class in PerfPanel / StudyPlan has a scoped style rule')
}

console.log(failures ? `\n${failures} problem(s) found.` : '\nAll frontend checks passed.')
process.exitCode = failures ? 1 : 0
