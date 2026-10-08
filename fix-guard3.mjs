import fs from 'node:fs'
const f = 'verify-frontend.mjs'
let lines = fs.readFileSync(f, 'utf8').split('\n')
const out = lines.map((l) => {
  if (l.includes("matchAll(/(?<![.\\w$'")) { return "    for (const m of expr.matchAll(/(?<![.\\w$'\"])" + "([A-Za-z_$][\\w$]*)/g)) {" }
  if (l.includes('new RegExp("[\'\\"')) { return '      if (new RegExp("[\\x27\\x22]" + "[^\\x27\\x22]*" + name).test(expr)) continue' }
  return l
})
fs.writeFileSync(f, out.join('\n'), 'utf8')
console.log('已修正正则')
