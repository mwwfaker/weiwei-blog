import fs from 'node:fs'
const f = 'frontend/src/style.css'
let css = fs.readFileSync(f, 'utf8')
const marker = '/* ===== 原先只在黑夜主题下写的规则改为两种主题通用'
const i = css.indexOf(marker)
if (i < 0) { console.log('没有找到转换块，无需撤销'); process.exit(0) }
css = css.slice(0, i).trimEnd() + '\n'
fs.writeFileSync(f, css, 'utf8')
console.log('已撤销批量转换')
