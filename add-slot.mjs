import fs from 'node:fs'
const f = 'frontend/src/style.css'
let s = fs.readFileSync(f, 'utf8')
if (!s.includes('.perf-page-slot')) {
  const anchor = '.app-shell.tool-mode .page-stage{'
  if (!s.includes(anchor)) { console.log('ANCHOR MISSING'); process.exit(1) }
  s = s.replace(anchor, '/* 工具页的插槽：撑满整屏，不要博客页面的内边距 */\n.app-shell.tool-mode .perf-page-slot{display:block;padding:0;margin:0;max-width:none}\n' + anchor)
  fs.writeFileSync(f, s, 'utf8')
  console.log('已补上 .perf-page-slot 规则')
} else { console.log('已存在') }
