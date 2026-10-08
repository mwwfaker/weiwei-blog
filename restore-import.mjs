import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
if (s.includes('const importRows = ref(')) { console.log('导入脚本还在，无需恢复'); process.exit(0) }
const anchor = '/** 一个人跨队列时的加权平均 AHT（给总表用）。 */'
if (!s.includes(anchor)) { console.log('ANCHOR MISSING'); process.exit(1) }

const block = `// ---- 导入 ------------------------------------------------------------------
// 说明：这一段曾在改导出函数时被误删（替换范围跨过了它），导致「导入截图」标签页
// 一点就抛 TypeError、页面切不过去。现在补回来。
const importQueue = ref('')
const importRows = ref([])
const importText = ref('')
const importBusy = ref(false)
const importMessage = ref('')
const screenshotInput = ref(null)

function setParsed(text, confidence = null) {
  const parsed = mergeRows(parseRows(text)).map((row) => {
    const hit = matchMember(row, members.value)
    return {
      ...row,
      matchedId: hit.member?.id || '',
      matchedName: hit.member?.name || '',
      matchReason: hit.reason,
    }
  })
  importRows.value = parsed
  if (!parsed.length) {
    importMessage.value = '没有识别到数据行。可以直接从页面复制文本粘贴到上面。'
    return
  }
  const matched = parsed.filter((row) => row.matchedId).length
  importMessage.value = \`识别出 \${parsed.length} 行，其中 \${matched} 行匹配到了名单里的人。\`
  if (confidence != null) importMessage.value += \`（识别置信度 \${Math.round(confidence)}%）\`
  const inferred = parsed.filter((row) => row.inferredDecimal).length
  if (inferred) importMessage.value += \` 有 \${inferred} 行的小数点是推断出来的，请核对。\`
}
function parsePasted() { setParsed(importText.value) }

/** 写入前的预览：会更新谁、会新建谁。 */
const importPlan = computed(() => {
  let update = 0
  let create = 0
  for (const row of importRows.value) {
    if (row.matchedId) update += 1
    else create += 1
  }
  return { update, create, total: importRows.value.length }
})

async function handleScreenshot(event) {
  const file = event.target.files?.[0]
  if (!file) return
  importBusy.value = true
  importMessage.value = '正在识别图片…首次会下载中英文识别模型（约 20 MB）。'
  importRows.value = []
  try {
    const { text, confidence } = await recognizeImage(file, (p) => {
      if (p.progress) importMessage.value = \`正在识别图片… \${Math.round(p.progress * 100)}%\`
    })
    importText.value = text
    setParsed(text, confidence)
  } catch (error) {
    importMessage.value = \`识别失败：\${error.message}。可以直接从页面复制文本粘贴。\`
  } finally {
    importBusy.value = false
    if (screenshotInput.value) screenshotInput.value = ''
  }
}

function applyImport() {
  const queueName = activeQueue.value
  if (!importRows.value.length || !queueName) return
  let updated = 0
  let created = 0
  let lastMemberId = ''
  for (const row of importRows.value) {
    if (row.auditCount == null && row.actualAht == null) continue
    let member = members.value.find((m) => m.id === row.matchedId)
    if (!member) {
      member = emptyMember(checkHours.value)
      member.name = row.nameGuess || row.name || \`工号\${row.employeeNo || ''}\`
      member.email = row.email || (row.employeeNo ? \`no\${row.employeeNo}@imported\` : '')
      members.value.push(member)
      created += 1
    }
    let entry = entries.value.find((e) => e.memberId === member.id && e.queue === queueName)
    if (!entry) { entry = emptyEntry(member.id, queueName); entries.value.push(entry) }
    if (row.actualAht != null) entry.actualAht = row.actualAht
    if (row.auditCount != null) entry.auditCount = row.auditCount
    updated += 1
    lastMemberId = member.id
  }
  importMessage.value = \`已把 \${updated} 行写入「\${queueName}」\${created ? \`，并新增 \${created} 人\` : ''}。\`
  importRows.value = []
  importText.value = ''
  tab.value = 'entry'
  if (lastMemberId) activeMemberId.value = lastMemberId
}

`
s = s.replace(anchor, block + anchor)
fs.writeFileSync(f, s, 'utf8')
console.log('导入脚本已恢复')
