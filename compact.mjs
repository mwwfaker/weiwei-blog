import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const anchor = '/* 员工名单：邮箱列要够宽才看得全 */'
if (!s.includes(anchor)) { console.log('ANCHOR MISSING'); process.exit(1) }

const css = `/* ---- 把纵向空间尽量留给数据表 -------------------------------------------
   用户反馈「可视化的面积太少」。汇总卡和工资构成卡原来各占一百多像素，
   压扁之后表格能多显示好几行。 */
.perf-summary{gap:8px;margin-bottom:-2px}
.perf-stat{padding:9px 12px;border-radius:12px}
.perf-stat strong{margin:2px 0 1px;font-size:clamp(14px,1.4vw,18px)}
.perf-stat small{font-size:9.5px}
.perf-stat span{font-size:9.5px}

.perf-body{gap:10px;padding-top:11px}
.perf-tabs{padding:3px}
.perf-tabs button{padding:6px 14px}

.perf-breakdown{gap:8px}
.perf-breakdown>div{padding:8px 12px;border-radius:11px}
.perf-breakdown small{font-size:9.5px}
.perf-breakdown strong{margin-top:2px;font-size:14px}
.perf-breakdown .grand strong{font-size:16px}

.perf-summary-line{padding:8px 13px}
.perf-queue-bar{padding:9px 13px}

/* 表格行更紧凑，一屏能多放几行 */
.perf-grid th,.perf-grid td{padding:6px 11px}
.perf-cell{padding:5px 9px}

`
s = s.replace(anchor, css + anchor)
fs.writeFileSync(f, s, 'utf8')
console.log('已压扁汇总卡与工资构成卡')
