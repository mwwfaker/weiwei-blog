import fs from 'node:fs'
const f = 'verify-frontend.mjs'
let s = fs.readFileSync(f, 'utf8')
const old = `      const re = new RegExp('\\\\.' + name.replace(/[-]/g, '\\\\-') + '(?![\\\\w-])')
      if (!re.test(scoped)) scopedGaps.push(rel.split('/').pop() + ' → .' + name)`
const neu = `      const re = new RegExp('\\\\.' + name.replace(/[-]/g, '\\\\-') + '(?![\\\\w-])')
      // 有些类（.roster 这类钩子、.button-secondary 这类全局按钮）本来就不在 scoped 块里，
      // 只要全局 style.css 里有定义就不算缺失。
      if (!re.test(scoped) && !re.test(cssNoComments)) scopedGaps.push(rel.split('/').pop() + ' → .' + name)`
if (!s.includes(old)) { console.log('ANCHOR MISSING'); process.exit(1) }
fs.writeFileSync(f, s.replace(old, neu), 'utf8')
console.log('守卫已回退查全局样式')
