import fs from 'node:fs'
const f = 'verify-frontend.mjs'
let s = fs.readFileSync(f, 'utf8')
const anchor = "console.log(failures ? `\\n${failures} problem(s) found.` : '\\nAll frontend checks passed.')"
if (!s.includes(anchor)) { console.log('ANCHOR MISSING'); process.exit(1) }

const guard = `// --- 7. scoped classes of the perf tool --------------------------------------------------------
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
  const scoped = text.slice(styleAt).replace(/\\/\\*[\\s\\S]*?\\*\\//g, '')
  const seen = new Set()
  for (const [, list] of text.matchAll(/class="([^"]*)"/g)) {
    for (const name of list.split(/\\s+/)) {
      if (!name || seen.has(name)) continue
      seen.add(name)
      const re = new RegExp('\\\\.' + name.replace(/[-]/g, '\\\\-') + '(?![\\\\w-])')
      if (!re.test(scoped)) scopedGaps.push(rel.split('/').pop() + ' → .' + name)
    }
  }
}
if (scopedGaps.length) {
  failures += 1
  console.log('    FAIL  classes used but never styled: ' + scopedGaps.slice(0, 8).join(', '))
} else {
  console.log('    OK    every class in PerfPanel / StudyPlan has a scoped style rule')
}

`
s = s.replace(anchor, guard + anchor)
fs.writeFileSync(f, s, 'utf8')
console.log('已加入第 7 项检查')
