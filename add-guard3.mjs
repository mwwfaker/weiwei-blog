import fs from 'node:fs'
const f = 'verify-frontend.mjs'
let s = fs.readFileSync(f, 'utf8')
const anchor = "console.log(failures ? `\\n${failures} problem(s) found.` : '\\nAll frontend checks passed.')"
if (!s.includes(anchor)) { console.log('ANCHOR MISSING'); process.exit(1) }

const guard = `// --- 8. template bindings must resolve ------------------------------------------------------
// [1] only surfaced a single name, so it stayed green while a whole block of script (the import
// feature) had been deleted and the tab threw "reading 'trim' of undefined" on click. This walks
// every binding expression, skips template-local aliases, and requires the root identifier to be
// declared in <script setup>.
console.log('[8] template bindings resolve')
const BUILTINS = new Set(['true', 'false', 'null', 'undefined', 'Math', 'Number', 'String', 'Object',
  'Array', 'JSON', 'Date', 'Boolean', 'isNaN', 'parseInt', 'parseFloat', 'console', 'window', 'document',
  '$event', '$refs', '$slots', '$attrs', 'item', 'index', 'key'])
const unresolved = []
for (const rel of ['frontend/src/App.vue', 'frontend/src/PerfPanel.vue', 'frontend/src/StudyPlan.vue']) {
  const text = fs.readFileSync(new URL('./' + rel, import.meta.url), 'utf8')
  const scriptEnd = text.indexOf('</script>')
  const tplStart = text.indexOf('<template>')
  if (scriptEnd < 0 || tplStart < 0) continue
  const script = text.slice(0, scriptEnd)
  const tpl = text.slice(tplStart, text.indexOf('</template>', tplStart))
  const declared = new Set()
  for (const m of script.matchAll(/(?:const|let|var|function|class)\\s+([A-Za-z_$][\\w$]*)/g)) declared.add(m[1])
  for (const m of script.matchAll(/import\\s+([A-Za-z_$][\\w$]*)/g)) declared.add(m[1])
  for (const m of script.matchAll(/import\\s*\\{([^}]*)\\}/g)) {
    for (const part of m[1].split(',')) declared.add(part.trim().split(/\\s+as\\s+/).pop().trim())
  }
  // v-for 的别名是模板局部的
  for (const m of tpl.matchAll(/v-for="\\(?([^)"]*?)\\)?\\s+in\\s/g)) {
    for (const alias of m[1].split(',')) declared.add(alias.trim())
  }
  const exprs = []
  for (const m of tpl.matchAll(/[:@]?[\\w-]+="([^"]*)"/g)) exprs.push(m[1])
  for (const expr of exprs) {
    if (/^\\s*$/.test(expr)) continue
    // 取每个成员表达式的根标识符
    for (const m of expr.matchAll(/(?<![.\\w$'"\`])([A-Za-z_$][\\w$]*)/g)) {
      const name = m[1]
      if (BUILTINS.has(name) || declared.has(name)) continue
      // 字符串字面量里的词、对象字面量的键都跳过
      if (new RegExp("['\\"\`][^'\\"\`]*" + name).test(expr)) continue
      const where = rel.split('/').pop()
      if (!unresolved.some((u) => u.endsWith(where + ' → ' + name))) unresolved.push(rel + ' → ' + name)
    }
  }
}
if (unresolved.length) {
  failures += 1
  console.log('    FAIL  bindings referencing undeclared names: ' + unresolved.slice(0, 8).map((u) => u.split('/').pop()).join(', '))
} else {
  console.log('    OK    every template binding resolves to a declared name')
}

`
s = s.replace(anchor, guard + anchor)
fs.writeFileSync(f, s, 'utf8')
console.log('已加入第 8 项检查')
