import fs from 'node:fs'
const css = fs.readFileSync('frontend/src/style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
// 收集所有选择器
const lightOnly = new Set()
const darkOnly = new Set()
for (const m of css.matchAll(/([^{}]+)\{/g)) {
  const sels = m[1].split(',').map((s) => s.trim()).filter(Boolean)
  for (const sel of sels) {
    if (sel.startsWith('@') || sel.startsWith(':root{') || sel === ':root') continue
    const dark = sel.startsWith(':root.dark')
    const bare = sel.replace(/^:root\.dark\s*/, '').replace(/^\.dark\s*/, '')
    if (dark) darkOnly.add(bare)
    else lightOnly.add(sel)
  }
}
// 只在黑夜出现、白天没有任何对应写法的选择器
const missing = [...darkOnly].filter((bare) => {
  if (!/^\./.test(bare)) return false
  return !lightOnly.has(bare)
})
console.log('只在黑夜主题定义的选择器共', missing.length, '个：')
missing.slice(0, 40).forEach((m) => console.log('  ' + m))
