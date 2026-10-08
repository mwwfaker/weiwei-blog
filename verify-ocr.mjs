// 解析器的测试：包含「用用户真实截图的真实 OCR 输出」做回归。
// 运行：node verify-ocr.mjs
import fs from 'node:fs'
import {
  employeeNoOf, matchMember, mergeRows, normalizeOcrText, parseRows,
} from './frontend/src/services/ocr.js'

let pass = 0
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) { pass += 1; console.log(`  PASS  ${name}`) }
  else { failures.push(name); console.log(`  FAIL  ${name}${detail ? '  -> ' + detail : ''}`) }
}

// 飞书里直接复制出来的文本形态（制表符分隔，最理想的情况）
const pasted = [
  '审核员\t已审数\t平均审核时长(s)\t平均审核延时(s)',
  'zhangwei.5406@example.com\t7167\t33.42\t18400.13',
  'liuyang.5402@example.com\t5784\t26.05\t18869.57',
  'chenxiu.5386@example.com\t5014\t28.31\t23608.45',
  'zhaomin.5459@example.com\t4091\t29.11\t17238.22',
  'luyao.5405@example.com\t790\t41.74\t33398.18',
].join('\n')

console.log('[1] 从飞书直接复制的文本')
const rows1 = parseRows(pasted)
check('识别出 5 行', rows1.length === 5, `got ${rows1.length}`)
check('第 1 行邮箱正确', rows1[0].email === 'zhangwei.5406@example.com', rows1[0].email)
check('第 1 行已审数 = 7167', rows1[0].auditCount === 7167, `${rows1[0].auditCount}`)
check('第 1 行平均审核时长 = 33.42', rows1[0].actualAht === 33.42, `${rows1[0].actualAht}`)
check('工号被提取出来', rows1[0].employeeNo === '5406', rows1[0].employeeNo)
check('表头不会被当成数据行', rows1.length === 5)
check('最后一行也正确', rows1[4].auditCount === 790 && rows1[4].actualAht === 41.74, JSON.stringify(rows1[4]))

console.log('\n[2] 仿真 OCR 输出（千分位 / 全角数字）')
const ocrish = [
  'zhangwei.5406@example.com 7,167 33.42 18400.13 67.52 0',
  'zhouqi.5379@example.com ３６７５ 28.5 23915.75',
].join('\n')
const rows2 = parseRows(ocrish)
check('千分位 7,167 被解析为 7167', rows2[0].auditCount === 7167, `${rows2[0].auditCount}`)
check('全角数字被转换', rows2[1].auditCount === 3675, `${rows2[1].auditCount}`)

console.log('\n[3] 小数点被 OCR 吞掉时补回来')
const decimals = parseRows([
  'a.5406@x.com.cn 7167 3342 18400.13',   // 33.42
  'b.5402@x.com.cn 3675 285 23915.75',    // 28.5
  'c.5384@x.com.cn 3381 2473 28155.53',   // 24.73
].join('\n'))
check('3342 -> 33.42', decimals[0].actualAht === 33.42, `${decimals[0].actualAht}`)
check('285 -> 28.5', decimals[1].actualAht === 28.5, `${decimals[1].actualAht}`)
check('2473 -> 24.73', decimals[2].actualAht === 24.73, `${decimals[2].actualAht}`)
check('被推断出来的行有标记', decimals.every((r) => r.inferredDecimal === true))
const normal = parseRows('d.5406@x.com.cn 7167 33.42 18400.13')
check('正常带小数点的行不会被标记', normal[0].inferredDecimal === false && normal[0].actualAht === 33.42)

console.log('\n[4] 顺序颠倒时自动交换')
const swapped = parseRows('someone.1234@example.com 33.42 7167')
check('时长与数量被正确归位', swapped[0].auditCount === 7167 && swapped[0].actualAht === 33.42, JSON.stringify(swapped[0]))

console.log('\n[5] 缺列与异常输入')
const missing = parseRows('a.b@example.com 1234')
check('只有一列时 actualAht 为 null', missing[0].auditCount === 1234 && missing[0].actualAht === null, JSON.stringify(missing[0]))
check('空文本返回空数组', parseRows('').length === 0)
check('没有邮箱时返回空数组', parseRows('审核员 已审数 时长\n-\t-\t-').length === 0)
check('不会产生 NaN', !parseRows(ocrish).some((r) => Number.isNaN(r.auditCount) || Number.isNaN(r.actualAht)))

console.log('\n[6] 去重按工号')
const dup = parseRows('same.1.5406@x.com.cn 100 30\nother.9999@x.com.cn 200 31')
check('不同工号保留两行', mergeRows(dup).length === 2)
const dup2 = parseRows('a.5406@x.com.cn 100 30\na.5406@other.com 200 31')
check('同一工号合并成一行', mergeRows(dup2).length === 1, `${mergeRows(dup2).length}`)

console.log('\n[7] 工号提取')
check('zhangwei.5406 -> 5406', employeeNoOf('zhangwei.5406@example.com') === '5406')
check('没有工号时返回空串', employeeNoOf('someone@x.com') === '')
check('空值不报错', employeeNoOf('') === '')

// ---- 8. 用真实截图的真实 OCR 输出做回归 ----
console.log('\n[8] 真实截图 OCR 输出 -> 按工号匹配到花名册（关键回归）')
const fixturePath = new URL('./frontend/ssr-smoke/fixtures/real-ocr.txt', import.meta.url)
let fixture = ''
try { fixture = fs.readFileSync(fixturePath, 'utf8') } catch { /* 见下方提示 */ }

if (!fixture) {
  check('真实 OCR 样本存在', false, '缺少 frontend/ssr-smoke/fixtures/real-ocr.txt')
} else {
  const roster = [
    'zhangwei.5406', 'liuyang.5402', 'chenxiu.5386', 'wanglu.5396',
    'zhaomin.5459', 'sunhao.5397', 'zhouqi.5379', 'wujing.5408',
    'zhengkai.5384', 'fangyu.5392', 'hexin.5418', 'luyao.5405',
  ].map((local, index) => ({ id: `m${index}`, name: local, email: `${local}@example.com` }))

  const truth = {
    5406: { count: 7167, aht: 33.42 }, 5402: { count: 5784, aht: 26.05 },
    5386: { count: 5014, aht: 28.31 }, 5396: { count: 4476, aht: 28.46 },
    5459: { count: 4091, aht: 29.11 }, 5397: { count: 3785, aht: 22.58 },
    5379: { count: 3675, aht: 28.5 }, 5408: { count: 3565, aht: 29.19 },
    5384: { count: 3381, aht: 24.73 }, 5392: { count: 2789, aht: 35.72 },
    5418: { count: 2109, aht: 26.37 }, 5405: { count: 790, aht: 41.74 },
  }

  const rows = mergeRows(parseRows(fixture))
  console.log(`  解析出 ${rows.length} 行`)
  let matched = 0
  let countOk = 0
  let ahtOk = 0
  const misses = []
  for (const row of rows) {
    const hit = matchMember(row, roster)
    if (!hit.member) { misses.push(`${row.rawEmail} 未匹配`); continue }
    matched += 1
    const expect = truth[row.employeeNo]
    if (!expect) { misses.push(`工号 ${row.employeeNo} 不在名单`); continue }
    if (row.auditCount === expect.count) countOk += 1
    else misses.push(`数量 工号${row.employeeNo}: 期望 ${expect.count} 得 ${row.auditCount}`)
    if (Math.abs(row.actualAht - expect.aht) < 0.005) ahtOk += 1
    else misses.push(`时长 工号${row.employeeNo}: 期望 ${expect.aht} 得 ${row.actualAht}`)
  }
  console.log(`  匹配到人 ${matched}/${rows.length} · 审核量正确 ${countOk}/${rows.length} · 时长正确 ${ahtOk}/${rows.length}`)
  if (misses.length) { console.log('  问题:'); for (const m of misses.slice(0, 10)) console.log('    ' + m) }

  check('真实截图里 12 个人一个都不丢', rows.length === 12, `${rows.length}`)
  check('真实截图里每一行都能匹配到人', matched === rows.length, `${matched}/${rows.length}`)
  check('真实截图里审核量全部正确', countOk === rows.length, `${countOk}/${rows.length}`)
  check('真实截图里平均审核时长全部正确（含小数点被吞的）', ahtOk === rows.length, `${ahtOk}/${rows.length}`)
  check('12 个人的工号都被正确提取', new Set(rows.map((r) => r.employeeNo)).size === 12,
    JSON.stringify([...new Set(rows.map((r) => r.employeeNo))]))
  check('邮箱文字本身不可信（域名被认错），这正是不靠它匹配的原因',
    rows.some((r) => !String(r.rawEmail).includes('examp')))
}

console.log('\n[9] 匹配的兜底与边界')
const small = [{ id: 'x', name: '张三', email: 'zhangsan.1234@example.com' }]
check('邮箱完全一致时匹配成功', matchMember({ email: 'zhangsan.1234@example.com', employeeNo: '1234' }, small).member?.id === 'x')
check('文字被打乱但工号一致时仍能匹配',
  matchMember({ email: 'zhaugxan.1234@examp1e.com', employeeNo: '1234' }, small).member?.id === 'x')
check('完全不相关的人不会误匹配',
  matchMember({ email: 'someone.9999@other.com', employeeNo: '9999' }, small).member === null,
  JSON.stringify(matchMember({ email: 'someone.9999@other.com', employeeNo: '9999' }, small)))
check('名单为空时返回 null', matchMember({ email: 'a@b.com' }, []).member === null)

console.log('\n[10] 文本归一化')
check('竖线被当作分隔符', normalizeOcrText('a|b｜c') === 'a b c')
check('全角数字被转换', normalizeOcrText('１２３') === '123')

// ---- 11. 用户从页面直接复制的文本（最准的路径，也是他们实际会用的方式）----
console.log('\n[11] 用户粘贴的页面文本 -> 12 人全部正确（含被忽略的噪声行）')
const pastedPagePath = new URL('./frontend/ssr-smoke/fixtures/pasted-page.txt', import.meta.url)
let pastedPage = ''
try { pastedPage = fs.readFileSync(pastedPagePath, 'utf8') } catch { /* 缺失时下面会报 */ }

if (!pastedPage) {
  check('粘贴文本样例存在', false, '缺少 frontend/ssr-smoke/fixtures/pasted-page.txt')
} else {
  // 真实名单（用户提供的原文）
  const real = [
    ['zhangwei.5406', 'zhangwei', 7167, 33.42],
    ['liuyang.5402', 'liuyang', 5784, 26.05],
    ['chenxiu.5386', 'chenxiu', 5014, 28.31],
    ['wanglu.5396', 'wanglu', 4476, 28.46],
    ['zhaomin.5459', 'zhaomin', 4091, 29.11],
    ['sunhao.5397', 'sunhao', 3785, 22.58],
    ['zhouqi.5379', 'zhouqi', 3675, 28.5],
    ['wujing.5408', 'wujing', 3565, 29.19],
    ['zhengkai.5384', 'zhengkai', 3381, 24.73],
    ['fangyu.5392', 'fangyu', 2789, 35.72],
    ['hexin.5418', 'hexin', 2109, 26.37],
    ['luyao.5405', 'luyao', 790, 41.74],
  ]
  const rows = mergeRows(parseRows(pastedPage))
  const byNo = new Map(rows.map((r) => [r.employeeNo, r]))
  console.log(`  解析出 ${rows.length} 行`)
  let ok = 0
  const bad = []
  for (const [local, name, count, aht] of real) {
    const no = local.split('.').pop()
    const row = byNo.get(no)
    if (!row) { bad.push(`工号 ${no} 没解析出来`); continue }
    const nameOk = row.nameGuess === name
    const mailOk = row.email === `${local}@example.com`
    const numOk = row.auditCount === count
    const ahtOk = Math.abs(row.actualAht - aht) < 0.005
    if (nameOk && mailOk && numOk && ahtOk) ok += 1
    else bad.push(`${local}: 名字=${row.nameGuess}(${nameOk}) 邮箱=${row.email}(${mailOk}) 数量=${row.auditCount}(${numOk}) 时长=${row.actualAht}(${ahtOk})`)
  }
  if (bad.length) { console.log('  问题:'); for (const b of bad.slice(0, 8)) console.log('    ' + b) }
  console.log(`  12 人全字段正确: ${ok}/12`)
  check('粘贴页面的文本 12 人全部正确解析（姓名/邮箱/审核量/时长）', ok === 12, `${ok}/12`)
  check('噪声行不会被当成数据', rows.length === 12, `${rows.length}`)
  check('姓名取的是「.工号」之前的部分',
    byNo.get('5406')?.nameGuess === 'zhangwei' && byNo.get('5402')?.nameGuess === 'liuyang')
  check('邮箱是 examptech 而不是 examp', byNo.get('5406')?.email === 'zhangwei.5406@example.com',
    byNo.get('5406')?.email)
  check('日指标那些行里没有邮箱，因此不会被误读',
    !rows.some((r) => r.auditCount === 1048 || r.auditCount === 417))
}

console.log(failures.length ? `\n${failures.length} 项失败：${failures.join('; ')}` : `\n全部通过（${pass} 项）`)
process.exitCode = failures.length ? 1 : 0
