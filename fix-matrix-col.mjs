import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
// 矩阵本来就能横滚,不必限制列宽把名字截掉
s = s.replace('.matrix-col{max-width:58px;overflow:hidden;text-overflow:ellipsis}', '.matrix-col{white-space:nowrap}')
fs.writeFileSync(f, s, 'utf8')
console.log('已去掉矩阵列宽限制')
