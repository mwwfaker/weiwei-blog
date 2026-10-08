// 截图/文本导入：把「审核员 + 已审数 + 平均审核时长」这类表格转成结构化行。
//
// 重要经验（用用户真实截图实测得出）：
//   审核量与工号的 OCR 正确率是 12/12，但邮箱**文字**几乎全错 —— 域名里的
//   examp 会被稳定识别成 exampfech，截图上的打码横杠还会往名字里插垃圾字符。
//   所以匹配不靠邮箱文字，而是按「工号」（邮箱里那段唯一数字）匹配到花名册。
//
// 解析部分是纯函数，可以单独测试；OCR 用 tesseract.js，按需动态加载，不进首屏包。

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const NUMBER_RE = /-?\d[\d,]*(?:\.\d+)?/g

/** OCR 常见的字符混淆与空白问题。 */
export function normalizeOcrText(text) {
  return String(text || '')
    .replace(/[Ｏ]/g, 'O')
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[｜|]/g, ' ')
    .replace(/[ \t\u00a0]+/g, ' ')
    .split('\n').map((line) => line.trim()).join('\n')
}

/** 从邮箱里取工号（结尾那段唯一数字）。这是最可靠的匹配依据。 */
export function employeeNoOf(email) {
  const local = String(email || '').split('@')[0]
  const hit = local.match(/(\d{3,})\s*$/)
  return hit ? hit[1] : ''
}

/**
 * OCR 有时会吞掉小数点：33.42 被读成 3342、28.5 被读成 285、24.73 被读成 2473。
 * 审核时长不可能上千，所以按位数把小数点补回去，并标记为「推断」，交给人工核对。
 */
function repairAht(raw, value) {
  const text = String(raw)
  if (text.includes('.') || !Number.isFinite(value)) return { value, inferred: false }
  const digits = text.replace(/\D/g, '')
  if (digits.length >= 4) return { value: Number(digits) / 100, inferred: true }
  if (digits.length === 3) return { value: Number(digits) / 10, inferred: true }
  return { value, inferred: false }
}

/**
 * 从一段文本里逐行解析。
 *
 * 不用「邮箱正则切分」而是逐行处理，因为实测 OCR 会往邮箱里插东西：
 *   examp 有 ech.com.cn        （插入了中文）
 *   zhangififwei.5406 @examp…   （@ 前多了空格）
 * 这两种都会让邮箱正则整行匹配失败、白白丢掉一个人。逐行处理时只要行里有 @ 就能救回来：
 * 工号取 @ 前面最后一段数字，数据列取域名之后的部分。
 */
export function parseRows(text) {
  const clean = normalizeOcrText(text)
  const lines = clean.split('\n')
  const rows = []

  // 先找出所有含邮箱的行，再逐段处理。两种来源的排版不一样：
  //   OCR 截图：一行里就是「邮箱 + 数字 数字 数字 …」
  //   复制粘贴：邮箱单独一行，后面的数字各自一行
  // 所以数字要从「本行 @ 之后 + 后续行」里一起取，直到下一个含邮箱的行为止。
  const emailLines = []
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].includes('@')) emailLines.push(i)
  }

  for (let k = 0; k < emailLines.length; k += 1) {
    const index = emailLines[k]
    const line = lines[index].trim()
    const at = line.indexOf('@')
    if (at < 0) continue

    const local = line.slice(0, at)
    // 工号：@ 前面最后一段 3 位以上的数字（允许中间夹着 OCR 垃圾）
    const noHit = local.match(/(\d{3,})\D*$/)
    const employeeNo = noHit ? noHit[1] : ''
    // 姓名：去掉尾部的「.工号」与所有非拉丁字符
    const nameGuess = local
      .replace(/\d{3,}\D*$/, '')
      .replace(/[^A-Za-z.\-_\s]/g, '')
      .replace(/[\s._-]+/g, '')
      .toLowerCase()

    // 邮箱文字只在「整行干干净净」时才可信（从飞书直接复制就是这样）。OCR 出来的行
    // 会因为打码横杠和域名误认而偏离，这时留空，匹配交给工号。
    const strictMail = line.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)

    // 本行域名之后的部分
    const tldMatches = [...line.matchAll(/\.(?:com|cn|net|org)(?:\.cn)?/gi)]
    const lastTld = tldMatches.length ? tldMatches[tldMatches.length - 1] : null
    const ownTail = lastTld ? line.slice(lastTld.index + lastTld[0].length) : line.slice(at + 1)

    // 再加上后续行，直到下一个含邮箱的行
    const nextEmailLine = k + 1 < emailLines.length ? emailLines[k + 1] : lines.length
    const following = []
    for (let j = index + 1; j < nextEmailLine; j += 1) following.push(lines[j])
    const tail = [ownTail, ...following].join(' ')

    const tokens = [...tail.matchAll(NUMBER_RE)].map((m) => m[0].replace(/,/g, ''))
    let auditCount = tokens[0] != null ? Number(tokens[0]) : null
    let ahtRaw = tokens[1] != null ? tokens[1] : null
    let inferred = false
    let actualAht = ahtRaw != null ? Number(ahtRaw) : null

    // 已审数不该有小数、时长通常是小数；顺序反了就换回来。
    if (auditCount != null && actualAht != null
      && Number.isInteger(actualAht) && !Number.isInteger(auditCount)) {
      [auditCount, ahtRaw] = [actualAht, String(auditCount)]
      actualAht = Number(ahtRaw)
    }
    if (ahtRaw != null) {
      const repaired = repairAht(ahtRaw, actualAht)
      actualAht = repaired.value
      inferred = repaired.inferred
    }

    rows.push({
      email: strictMail ? strictMail[0].toLowerCase() : '',
      employeeNo,
      nameGuess,
      name: nameGuess,
      auditCount,
      actualAht,
      inferredDecimal: inferred,
      rawEmail: local,
      raw: tail.trim().replace(/\s+/g, ' ').slice(0, 120),
    })
  }
  return rows
}

/** 合并同一工号（或同一段文字）的重复行。 */
export function mergeRows(rows) {
  const seen = new Map()
  const out = []
  for (const row of rows) {
    const key = row.employeeNo ? `no:${row.employeeNo}` : `guess:${row.nameGuess || row.email}`
    if (seen.has(key)) {
      const kept = seen.get(key)
      if (kept.auditCount == null && row.auditCount != null) kept.auditCount = row.auditCount
      if (kept.actualAht == null && row.actualAht != null) kept.actualAht = row.actualAht
      continue
    }
    const copy = { ...row }
    seen.set(key, copy)
    out.push(copy)
  }
  return out
}

function levenshtein(a, b) {
  const s = String(a)
  const t = String(b)
  if (!s.length) return t.length
  if (!t.length) return s.length
  let prev = Array.from({ length: t.length + 1 }, (_, i) => i)
  for (let i = 1; i <= s.length; i += 1) {
    const cur = [i]
    for (let j = 1; j <= t.length; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (s[i - 1] === t[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[t.length]
}

function similarity(a, b) {
  const s = String(a || '').toLowerCase()
  const t = String(b || '').toLowerCase()
  if (!s && !t) return 1
  const longest = Math.max(s.length, t.length)
  if (!longest) return 0
  return 1 - levenshtein(s, t) / longest
}

/**
 * 把一行识别结果匹配到花名册里的人。
 * 依次尝试：工号 → 邮箱完全一致 → 姓名相似度。返回匹配方式和置信度，界面上会显示出来让人确认。
 */
export function matchMember(row, members) {
  const list = Array.isArray(members) ? members : []
  if (!list.length) return { member: null, reason: '名单为空', score: 0 }

  if (row.employeeNo) {
    const byNo = list.filter((m) => employeeNoOf(m.email) === row.employeeNo)
    if (byNo.length === 1) return { member: byNo[0], reason: `工号 ${row.employeeNo}`, score: 1 }
  }

  const mail = String(row.email || '').toLowerCase()
  if (mail) {
    const exact = list.find((m) => String(m.email || '').toLowerCase() === mail)
    if (exact) return { member: exact, reason: '邮箱一致', score: 1 }
  }

  // 邮箱文字不可靠（域名会被认错、打码会插字符），所以退回到前缀的相似度
  let best = null
  let bestScore = 0
  for (const m of list) {
    const candidate = String(m.email || '').split('@')[0] || m.name
    const score = Math.max(
      similarity(row.nameGuess || mail.split('@')[0], candidate),
      similarity(row.name, m.name),
    )
    if (score > bestScore) { bestScore = score; best = m }
  }
  // 0.62 是实测出来的分界：同一个人的乱码邮箱相似度约 0.7 以上，不同人低于 0.5
  return bestScore >= 0.62
    ? { member: best, reason: `姓名相似 ${(bestScore * 100).toFixed(0)}%`, score: bestScore }
    : { member: null, reason: '没有匹配到', score: bestScore }
}

/** 对图片做 OCR。tesseract.js 体积较大，所以调用时才加载；首次会下载中英文模型。 */
export async function recognizeImage(file, onProgress) {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker(['chi_sim', 'eng'], 1, {
    logger: (m) => {
      if (typeof onProgress === 'function' && m && m.status) {
        onProgress({ status: m.status, progress: m.progress || 0 })
      }
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return { text: data.text || '', confidence: data.confidence }
  } finally {
    await worker.terminate()
  }
}
