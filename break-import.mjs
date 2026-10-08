import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
const s = fs.readFileSync(f, 'utf8')
fs.writeFileSync(f + '.bak', s, 'utf8')
const start = s.indexOf('// ---- 导入 ---')
const end = s.indexOf('/** 一个人跨队列时的加权平均 AHT')
fs.writeFileSync(f, s.slice(0, start) + s.slice(end), 'utf8')
