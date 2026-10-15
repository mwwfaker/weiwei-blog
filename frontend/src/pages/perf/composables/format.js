// 绩效页共用的格式化：模板、导出、可视化都读这一份，改口径只改这里。
// 注意这些函数原样搬自 PerfPage.vue，输出格式（含「—」和精度）不能动。
export const money = (v) => (Number.isFinite(v) ? v.toFixed(2) : '0.00')
export const price = (v) => (Number.isFinite(v) ? v.toFixed(7) : '0.0000000')
export const percent = (v) => (Number.isFinite(v) && v > 0 ? `${(v * 100).toFixed(1)}%` : '—')
export const hoursText = (seconds) => (Number.isFinite(seconds) ? (seconds / 3600).toFixed(2) : '0.00')
export const pctText = (v) => (Number.isFinite(v) ? `${(v * 100).toFixed(2)}%` : '')
