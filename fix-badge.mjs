import fs from 'node:fs'
const f = 'frontend/src/style.css'
let css = fs.readFileSync(f, 'utf8')
// 徽章是绝对定位在 30,30，正文要往下让开，否则第一个字被圆圈压住
css = css.replace(
  ':root:not(.dark) .account-visual{\n  position:relative;min-height:420px;padding:30px;',
  ':root:not(.dark) .account-visual{\n  position:relative;min-height:420px;padding:96px 30px 30px;')
fs.writeFileSync(f, css, 'utf8')
console.log('已让正文避开徽章')
