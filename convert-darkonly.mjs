import fs from 'node:fs'
const f = 'frontend/src/style.css'
let css = fs.readFileSync(f, 'utf8')

// 深色字面量 -> 主题变量（这样同一条规则在两种主题下各自取到正确颜色）
const MAP = [
  [/#1a1928|#201e32|#181a29|#11131c|#151622|#100e18/gi, 'var(--panel)'],
  [/#343147|#393650|#2a2839|#2b2940/gi, 'var(--line)'],
  [/#8b879c|#a09cac|#7d7990/gi, 'var(--muted)'],
  [/#c5b6ff|#a97cf0/gi, 'var(--accent)'],
  [/#e6e2f2|#ece9f5|#f2eff9/gi, 'var(--ink)'],
]

// 找出所有「整条选择器都带 :root.dark 前缀」的规则
const rules = []
for (const m of css.matchAll(/(^|\n)([^{}\n][^{}]*?)\{([^{}]*)\}/g)) {
  const sel = m[2].trim()
  const body = m[3]
  if (!sel.split(',').every((s) => s.trim().startsWith(':root.dark'))) continue
  rules.push({ sel, body })
}

// 已经有浅色写法的选择器不动（避免覆盖有意的浅色样式）
const existing = new Set()
for (const m of css.matchAll(/(^|\n)([^{}\n][^{}]*?)\{/g)) {
  for (const s of m[2].split(',')) {
    const t = s.trim()
    if (t && !t.startsWith(':root.dark') && !t.startsWith('@')) existing.add(t)
  }
}

const added = []
for (const rule of rules) {
  const bare = rule.sel.split(',').map((s) => s.trim().replace(/^:root\.dark\s*/, ''))
  if (bare.some((b) => existing.has(b))) continue
  let body = rule.body
  for (const [re, rep] of MAP) body = body.replace(re, rep)
  added.push(bare.join(', ') + '{' + body.trim() + '}')
}

if (!added.length) { console.log('没有可转换的规则'); process.exit(0) }
css += '\n/* ===== 原先只在黑夜主题下写的规则改为两种主题通用，颜色走主题变量 =====\n' +
  '   （这些页面此前在白天主题下会退回浏览器默认样式） */\n' + added.join('\n') + '\n'
fs.writeFileSync(f, css, 'utf8')
console.log('转换了', added.length, '条规则')
