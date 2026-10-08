import fs from 'node:fs'
const css = fs.readFileSync('frontend/src/style.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const PREFIX = ['account', 'auth', 'login', 'register']
const out = []
for (const m of css.matchAll(/(^|\n)([^{}\n][^{}]*?)\{([^{}]*)\}/g)) {
  const parts = m[2].trim().split(',').map((s) => s.trim())
  if (!parts.every((s) => s.startsWith(':root.dark'))) continue
  const bare = parts.map((s) => s.replace(/^:root\.dark\s*/, ''))
  if (!bare.some((b) => PREFIX.some((p) => b.replace(/^[.#]/, '').startsWith(p)))) continue
  out.push(bare.join(', ') + ' { ' + m[3].trim().replace(/\s+/g, ' ') + ' }')
}
console.log('登录/账号页的深色规则共', out.length, '条：')
out.forEach((o) => console.log('  ' + o.slice(0, 120)))
