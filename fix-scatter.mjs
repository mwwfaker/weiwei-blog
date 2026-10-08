import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
// 散点：只给金额靠前的点标名字，避免挤成一团
const old = "    const short = (row.member.name || '').split(/[.\\s]/)[0].slice(0, 7)\n    return { id: row.member.id, x, y, r: 4 + (row.result.total / maxTotal) * 8, short }"
const neu = "    const short = (row.member.name || '').split(/[.\\s]/)[0].slice(0, 7)\n    const share = row.result.total / maxTotal\n    // 只标金额较大的点：全标会在左下角挤成一团\n    return { id: row.member.id, x, y, r: 4 + share * 8, short, show: share >= 0.45 }"
if (!s.includes(old)) { console.log('ANCHOR MISSING'); process.exit(1) }
s = s.replace(old, neu)
s = s.replace('<text :x="p.x" :y="p.y - p.r - 4" class="dotlabel">{{ p.short }}</text>',
              '<text v-if="p.show" :x="p.x" :y="p.y - p.r - 5" class="dotlabel">{{ p.short }}</text>')
fs.writeFileSync(f, s, 'utf8')
console.log('散点标签已收敛')
