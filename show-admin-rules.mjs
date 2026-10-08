import fs from 'node:fs'
const css = fs.readFileSync('frontend/src/style.css', 'utf8')
for (const name of ['.stats-grid', '.quick-actions']) {
  console.log('=== ' + name + ' ===')
  let idx = -1
  let n = 0
  while ((idx = css.indexOf(name, idx + 1)) >= 0 && n < 4) {
    n += 1
    // 往前找最近的 @media / @layer / 选择器起点
    const before = css.slice(Math.max(0, idx - 400), idx)
    const atRules = [...before.matchAll(/@[a-z-]+[^{]*\{/g)].map(m => m[0].trim().slice(0, 60))
    const line = css.slice(0, idx).split('\n').length
    console.log(`  第 ${line} 行: ${css.slice(idx, idx + 90).split('\n')[0]}`)
    if (atRules.length) console.log('     前方最近 at 规则:', atRules.slice(-2).join(' / '))
  }
  if (n === 0) console.log('  没有找到')
}
