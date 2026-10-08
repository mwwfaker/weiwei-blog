import fs from 'node:fs'
const app = fs.readFileSync('frontend/src/App.vue', 'utf8')
const css = fs.readFileSync('frontend/src/style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
// 取「创作管理」那一段模板
const i = app.indexOf("currentPage === 'admin'")
const j = app.indexOf('currentPage ===', i + 10)
const seg = app.slice(i, j > 0 ? j : i + 4000)
const classes = new Set()
for (const m of seg.matchAll(/(?<!:)class="([^"]*)"/g)) {
  for (const c of m[1].split(/\s+/)) if (c) classes.add(c)
}
const missing = []
for (const c of classes) {
  const re = new RegExp('\\.' + c.replace(/[-]/g, '\\-') + '(?![\\w-])')
  if (!re.test(css)) missing.push(c)
}
console.log('创作管理页用到的类共', classes.size, '个')
console.log('样式里没有定义的:', missing.length)
missing.forEach((m) => console.log('  .' + m))
