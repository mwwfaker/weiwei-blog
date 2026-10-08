// 绩效公式验证：把计算结果和用户飞书表格里的真实数字逐个对比。
// 关键前提：KPI 是输入，标准 AHT = ROUND(24480/KPI, 2) 是算出来的。
// 运行：node verify-perf.mjs
import {
  PERF_CONSTANTS, PERF_QUEUES, ahtOf, computeAll, entryNumbers, memberTotals,
  nameFromEmail, normalizeQueues, priceCheck, unitPriceOf,
} from './frontend/src/services/perf.js'

let pass = 0
const failures = []
function check(name, ok, detail = '') {
  if (ok) { pass += 1; console.log(`  PASS  ${name}`) }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`) }
}
const close = (a, b, tol) => Math.abs(a - b) <= tol

// ---- 1. 标准 AHT = ROUND(24480 / KPI, 2)，和表格 AHT 列逐个核对 ----
console.log('[1] 标准 AHT = ROUND(24480 ÷ KPI, 2)  ← KPI 是输入，AHT 是算出来的')
const ahtCases = [
  ['图片', 884, 27.69], ['视频', 941, 26.01], ['纠错', 968, 25.29], ['生服', 685, 35.74],
  ['假店', 727, 33.67], ['水位', 1714, 14.28], ['资质', 2377, 10.3], ['加盟', 126, 194.29],
  ['特色', 405, 60.44], ['线索', 6245, 3.92], ['医师', 65, 376.62], ['标注', 343, 71.37],
  ['Q4', 457, 53.57], ['ocr', 436, 56.15], ['查漏补缺', 1105, 22.15], ['老poi', 764, 32.04], ['Q3', 629, 38.92],
]
for (const [name, kpi, expected] of ahtCases) {
  const got = ahtOf(kpi)
  check(`${name}: KPI ${kpi} -> AHT ${expected}`, got === expected, `got ${got}`)
}

// ---- 2. 用表格里的单价反解月要求工时，应当收敛到同一个数 ----
console.log('\n[2] 反解「月要求工时」应当收敛到同一个数（这同时验证了取整位置）')
const solved = []
for (const queue of PERF_QUEUES) {
  if (queue.referencePrice == null) continue
  const aht = ahtOf(queue.kpi)
  const hours = (PERF_CONSTANTS.baseAmount * aht * PERF_CONSTANTS.factor) / (3600 * queue.referencePrice)
  solved.push({ name: queue.name, hours })
}
const values = solved.map((s) => s.hours)
const minHours = Math.min(...values)
const maxHours = Math.max(...values)
console.log(`  反解出的月要求工时范围: ${minHours.toFixed(4)} – ${maxHours.toFixed(4)} 小时（${solved.length} 个队列）`)
check('所有队列反解出的要求工时一致（极差 < 0.01 小时）', maxHours - minHours < 0.01, `极差 ${(maxHours - minHours).toFixed(6)}`)
const requiredHours = Number(((minHours + maxHours) / 2).toFixed(4))
console.log(`  取用: ${requiredHours} 小时`)

console.log('\n[3] 用该要求工时正算单价，对比表格里的单价')
const checks = priceCheck(PERF_QUEUES, requiredHours)
for (const c of checks) {
  check(`${c.name}: 算得 ${c.computed.toFixed(7)} vs 表格 ${c.reference.toFixed(7)}`, c.ok, `差 ${c.delta.toExponential(2)}`)
}

// ---- 4. 改变 KPI 时 AHT 与单价要跟着变 ----
console.log('\n[4] 改 KPI 会带动 AHT 与单价（每月手改 KPI 的场景）')
const before = ahtOf(884)
const after = ahtOf(1000)
check('提高 KPI 会降低 AHT', after < before, `${before} -> ${after}`)
check('AHT 仍是两位小数', String(after).split('.')[1]?.length <= 2, `${after}`)
const p1 = unitPriceOf(ahtOf(884), requiredHours)
const p2 = unitPriceOf(ahtOf(1000), requiredHours)
check('AHT 变小则单价变小', p2 < p1, `${p1.toFixed(7)} -> ${p2.toFixed(7)}`)

// ---- 5. 单人完整计算（员工 × 队列 的明细模型） ----
console.log('\n[5] 单人完整计算')
const member = {
  id: 'test', name: '测试', email: 'a.5406@b.com',
  requiredHours, transferHours: 8, overtimeHours: 10, tripleHours: 4,
}
const queue = PERF_QUEUES.find((q) => q.name === '图片')
const entry = { id: 'e1', memberId: 'test', queue: '图片', auditCount: 5000, actualAht: 29.5 }
const n = entryNumbers(entry, member, queue)
const r = memberTotals(member, [entry], PERF_QUEUES)
console.log(`  KPI ${n.kpi}  标准AHT ${n.standardAht}  单价 ${n.unitPrice.toFixed(7)}  审核工资 ${r.auditPay.toFixed(2)}  补时 ${r.subsidyPay.toFixed(2)}  合计 ${r.total.toFixed(2)}`)
console.log(`  审核效率 ${(r.efficiency * 100).toFixed(2)}%  完成度 ${(r.completion * 100).toFixed(2)}%  月实际工时 ${r.actualHours.toFixed(2)} h（算出来的）`)
check('KPI 就是队列配置的 KPI', n.kpi === 884)
check('标准 AHT 由 KPI 算出', n.standardAht === 27.69)
check('审核工资 = 审核量 × 单价', close(n.auditPay, 5000 * n.unitPrice, 1e-6))
check('标准总时长 = 标准AHT × 审核量', close(n.standardSeconds, 27.69 * 5000, 1e-6))
check('实际总时长 = 实际AHT × 审核量', close(n.actualSeconds, 29.5 * 5000, 1e-6))
check('审核效率 = 标准总时长 ÷ 实际总时长', close(r.efficiency, 27.69 / 29.5, 1e-9), `${r.efficiency}`)
// 用户给的完成度公式：
//   =IFERROR(SUMPRODUCT(审核量, 标准AHT) / (((要求工时 + 加班时长) * 0.85 - 抽调时长) * 3600), "")
check('完成度 = 标准总时长 ÷ (((要求工时+加班)×0.85−抽调)×3600)',
  close(r.completion, (27.69 * 5000) / (((requiredHours + 10) * 0.85 - 8) * 3600), 1e-9), `${r.completion}`)
const lessTransfer = memberTotals({ ...member, transferHours: 0 }, [entry], PERF_QUEUES)
// 抽调从可用时间里扣掉，所以抽调越少、可用时间越多、完成度反而越低——公式就是这么定义的
check('抽调越少 → 可用时间越多 → 完成度越低', lessTransfer.completion < r.completion, `${lessTransfer.completion} vs ${r.completion}`)
const moreOvertime = memberTotals({ ...member, overtimeHours: 40 }, [entry], PERF_QUEUES)
check('加班越多，完成度越低（分母变大）', moreOvertime.completion < r.completion, `${moreOvertime.completion} vs ${r.completion}`)
// 用户明确说月实际工时是算出来的，不用填
check('月实际工时 = 实际总时长 ÷ 3600（算出来的）', close(r.actualHours, 29.5 * 5000 / 3600, 1e-9), `${r.actualHours}`)
check('补时工资 = 审核工资 × 抽调时长 × 0.85 ÷ 月实际工时',
  close(r.subsidyPay, (r.auditPay * 8 * 0.85) / (29.5 * 5000 / 3600), 1e-9))
check('加班工资 = 加班工时 × 31', r.overtimePay === 310, `${r.overtimePay}`)
check('三薪工资 = 三薪工时 × 62', r.triplePay === 248, `${r.triplePay}`)
check('合计 = 审核 + 补时 + 加班 + 三薪', close(r.total, r.auditPay + r.subsidyPay + 310 + 248, 1e-9))

// ---- 5a. 三薪日审核量要从计件里剔除 ----
console.log('\n[5a] 三薪日审核量从计件工资里剔除')
const tripleEntry = { ...entry, auditCount: 5000, actualAht: 29.5, tripleCount: 800 }
const withTriple = entryNumbers(tripleEntry, member, queue)
check('计件量 = 审核量 − 三薪日审核量', withTriple.pieceCount === 4200, `${withTriple.pieceCount}`)
check('审核工资只按计件量算', close(withTriple.auditPay, 4200 * withTriple.unitPrice, 1e-9), `${withTriple.auditPay}`)
check('对比：不剔除时会多算 800 条的钱', close(n.auditPay - withTriple.auditPay, 800 * n.unitPrice, 1e-9))
check('效率仍按全部审核量算（衡量实际工作量）', close(withTriple.standardSeconds, 27.69 * 5000, 1e-6))
const tripleTotals = memberTotals({ ...member, tripleHours: 8 }, [tripleEntry], PERF_QUEUES)
check('三薪工资 = 三薪时长 × 62（固定）', tripleTotals.triplePay === 496, `${tripleTotals.triplePay}`)
check('汇总里带着三薪量', tripleTotals.tripleCount === 800 && tripleTotals.pieceCount === 4200)
// 三薪量填得比审核量还大时不能算成负数
const overTriple = entryNumbers({ ...entry, auditCount: 100, tripleCount: 999 }, member, queue)
check('三薪量超过审核量时计件量为 0（不会负数）', overTriple.pieceCount === 0 && overTriple.auditPay === 0, JSON.stringify({ p: overTriple.pieceCount }))
// 没填三薪时行为和以前完全一样
const noTriple = entryNumbers(entry, member, queue)
check('没填三薪列时与之前一致', noTriple.pieceCount === noTriple.auditCount && close(noTriple.auditPay, n.auditPay, 1e-9))
// ---- 5b. 一个人做多个队列会按队列分别计价再汇总 ----
console.log('\n[5b] 一个人做多个队列')
const twoEntries = [
  { id: 'a', memberId: 'test', queue: '图片', auditCount: 1000, actualAht: 30 },
  { id: 'b', memberId: 'test', queue: '医师', auditCount: 100, actualAht: 400 },
]
const multi = memberTotals(member, twoEntries, PERF_QUEUES)
const pImage = unitPriceOf(ahtOf(884), requiredHours)
const pDoctor = unitPriceOf(ahtOf(65), requiredHours)
check('审核工资按各队列单价分别算再相加',
  close(multi.auditPay, 1000 * pImage + 100 * pDoctor, 1e-6), `${multi.auditPay}`)
check('标准总时长跨队列累加', close(multi.standardSeconds, 27.69 * 1000 + 376.62 * 100, 1e-6))
check('实际总时长跨队列累加', close(multi.actualSeconds, 30 * 1000 + 400 * 100, 1e-6))
check('月实际工时跨队列累加', close(multi.actualHours, (30 * 1000 + 400 * 100) / 3600, 1e-9))
check('效率是跨队列的加权值', close(multi.efficiency, (27.69 * 1000 + 376.62 * 100) / (30 * 1000 + 400 * 100), 1e-9))

// ---- 6. 姓名从邮箱前缀取 ----
console.log('\n[6] 姓名默认取邮箱前缀（去掉结尾工号）')
check('zhangwei.5406@... -> zhangwei', nameFromEmail('zhangwei.5406@example.com') === 'zhangwei', nameFromEmail('zhangwei.5406@example.com'))
check('luyao.5405@... -> luyao', nameFromEmail('luyao.5405@example.com') === 'luyao', nameFromEmail('luyao.5405@example.com'))
check('没有工号时原样保留', nameFromEmail('sunhao.5397@x.com') === 'sunhao', nameFromEmail('sunhao.5397@x.com'))
check('空邮箱不报错', nameFromEmail('') === '')

// ---- 7. 旧数据迁移（标准AHT -> KPI） ----
console.log('\n[7] 旧存档迁移')
const migrated = normalizeQueues([{ name: '图片', standardAht: 27.69, referencePrice: 0.0885230 }])
check('旧的 standardAht 被换算成 kpi', migrated[0].kpi === 884, JSON.stringify(migrated[0]))
const kept = normalizeQueues([{ name: '图片', kpi: 900 }])
check('已经带 kpi 的原样保留', kept[0].kpi === 900)
check('空存档回退到默认值', normalizeQueues([]).length === PERF_QUEUES.length)

// ---- 8. 边界 ----
console.log('\n[8] 边界：审核量为 0 / 找不到队列 / KPI 为 0')
const blank = memberTotals(member, [{ id: 'z', memberId: 'test', queue: '图片', auditCount: 0, actualAht: 0 }], PERF_QUEUES)
check('审核量为 0 时效率为 0', blank.efficiency === 0)
check('没有 NaN', !Object.values(blank).some((v) => typeof v === 'number' && Number.isNaN(v)))
const noQueue = entryNumbers(entry, member, null)
check('找不到队列时不产生 NaN', !Object.values(noQueue).some((v) => typeof v === 'number' && Number.isNaN(v)))
check('找不到队列时 AHT 为 0', noQueue.standardAht === 0)
check('KPI 为 0 时 AHT 为 0 而不是 Infinity', ahtOf(0) === 0 && ahtOf(null) === 0)

// ---- 9. 汇总 ----
console.log('\n[9] 小组汇总')
const members = [
  { ...member, id: '1' },
  { ...member, id: '2' },
  { ...member, id: '3' },
]
const entries = [
  { id: 'e1', memberId: '1', queue: '图片', auditCount: 5000, actualAht: 29.5 },
  { id: 'e2', memberId: '2', queue: '医师', auditCount: 120, actualAht: 400 },
  { id: 'e3', memberId: '3', queue: '线索', auditCount: 20000, actualAht: 4.2 },
]
const all = computeAll(members, entries, PERF_QUEUES)
console.log(`  人数 ${all.summary.headcount}  合计 ${all.summary.total.toFixed(2)}  审量 ${all.summary.auditCount}  加权效率 ${(all.summary.efficiency * 100).toFixed(2)}%`)
check('汇总人数正确', all.summary.headcount === 3)
check('汇总合计 = 各行合计之和', close(all.summary.total, all.rows.reduce((s, x) => s + x.result.total, 0), 1e-9))
check('加权效率 = Σ标准时长 ÷ Σ实际时长', close(all.summary.efficiency, all.rows.reduce((s, x) => s + x.result.standardSeconds, 0) / all.rows.reduce((s, x) => s + x.result.actualSeconds, 0), 1e-9))
check('最高/最低收入可识别', all.summary.highest && all.summary.lowest && all.summary.highest.result.total >= all.summary.lowest.result.total)

console.log(failures.length ? `\n${failures.length} 项失败：${failures.join('; ')}` : `\n全部通过（${pass} 项）`)
process.exitCode = failures.length ? 1 : 0
