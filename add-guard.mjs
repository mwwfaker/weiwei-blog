import fs from 'node:fs'
const f = 'verify-frontend.mjs'
let s = fs.readFileSync(f, 'utf8')
const anchor = "console.log(failures ? `\\n${failures} problem(s) found.` : '\\nAll frontend checks passed.')"
if (!s.includes(anchor)) { console.log('ANCHOR MISSING'); process.exit(1) }

const guard = `// --- 6. class used in a template but missing from the stylesheet ---------------------------------
// A marker-based CSS splice once wiped a whole block of rules (.perf-stat, .perf-tabs, .perf-card…)
// and nothing caught it: the build stays green and the page just renders unstyled.
// Scoped styles must define every \`perf-*\` class the template uses.
console.log('[6] scoped classes have styles')
const perfCss = cssNoComments
const missingClasses = []
for (const [, list] of source.matchAll(/class="([^"]*)"/g)) {
  for (const name of list.split(/\\s+/)) {
    if (!name.startsWith('perf-')) continue
    if (missingClasses.some((m) => m.name === name)) continue
    const re = new RegExp('\\\\.' + name.replace(/[-]/g, '\\\\-') + '(?![\\\\w-])')
    if (!re.test(perfCss)) missingClasses.push({ name })
  }
}
if (missingClasses.length) {
  failures += 1
  console.log('    FAIL  template uses classes with no CSS rule: ' + missingClasses.map((m) => '.' + m.name).join(', '))
} else {
  console.log('    OK    every perf-* class used in the template has a style rule')
}

`
s = s.replace(anchor, guard + anchor)
fs.writeFileSync(f, s, 'utf8')
console.log('已加入第 6 项检查')
