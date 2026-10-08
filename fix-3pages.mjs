import fs from 'node:fs'
const f = 'frontend/src/style.css'
const css = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const PREFIX = ['message', 'friend', 'guestbook', 'archive']

const PANEL = 'color-mix(in srgb, var(--panel) 84%, transparent)'
const mapColors = (body) => body
  .replace(/#77738b|#79758b|#89859a|#8b879c/gi, 'var(--muted)')
  .replace(/#aaa5ba|#e4e0ef|#e6e2f2/gi, 'var(--ink)')
  .replace(/#c3b8f1|#ae9de8|#aaa0df|#c5b6ff/gi, 'var(--accent)')
  .replace(/#80bcc3/gi, 'var(--accent)')
  .replace(/#11121c|#1a1928|#151622|#181a29|#100e18/gi, PANEL)
  .replace(/#2827\w*|#343147|#393650/gi, 'var(--line)')
  .replace(/background\s*:\s*#[0-9a-f]{3,8}/gi, 'background:' + PANEL)

const added = []
const seen = new Set()
for (const m of css.matchAll(/(^|\n)([^{}\n][^{}]*?)\{([^{}]*)\}/g)) {
  const parts = m[2].trim().split(',').map((s) => s.trim())
  if (!parts.every((s) => s.startsWith(':root.dark'))) continue
  const bare = parts.map((s) => s.replace(/^:root\.dark\s*/, ''))
  if (!bare.some((b) => PREFIX.some((p) => b.replace(/^\./, '').startsWith(p)))) continue
  const sel = bare.map((b) => ':root:not(.dark) ' + b).join(', ')
  if (seen.has(sel)) continue
  seen.add(sel)
  added.push(sel + '{' + mapColors(m[3].trim().replace(/\s+/g, ' ')) + '}')
}
const block = `
/* ===== 留言板 / 朋友们 / 时光归档 的白天主题写法 =====
   这三页原先只写了 \`:root.dark\` 的样式，白天主题下卡片没有背景和描边，
   看起来就是一堆没有样式的文字。布局属性原样保留，颜色改走主题变量。 */
` + added.join('\n') + '\n'
fs.writeFileSync(f, fs.readFileSync(f, 'utf8').trimEnd() + '\n' + block, 'utf8')
console.log('为三页生成', added.length, '条浅色规则')
console.log('示例:'); added.slice(1, 3).forEach((a) => console.log('  ' + a.slice(0, 120)))
