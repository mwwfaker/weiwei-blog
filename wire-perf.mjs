import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')

// 1) import 加上 API 与 auth store
s = s.replace(
  "import { matchMember, mergeRows, parseRows, recognizeImage } from './services/ocr'",
  "import { matchMember, mergeRows, parseRows, recognizeImage } from './services/ocr'\nimport { fromServer, loadWorkspace, saveWorkspace } from './services/perfApi'\nimport { useAuthStore } from './stores/auth'")

// 2) 在 router 之后拿 auth store
s = s.replace('const router = useRouter()', "const router = useRouter()\nconst auth = useAuthStore()")

// 3) 在 month 的 watch 之后插入云同步逻辑
const anchor = "watch(month, (v) => writeStoredJson(MONTH_KEY, v))"
if (!s.includes(anchor)) { console.log('ANCHOR 3 MISSING'); process.exit(1) }
const cloud = anchor + `

// ---- 云端同步 --------------------------------------------------------------
// 登录后绩效数据存账号数据库，换设备也能用；未登录时仍然只存本机，
// 这样不登录也能当计算器用。写入做 800ms 防抖，避免每敲一个数字发一次请求。
const syncState = ref(auth.isLoggedIn ? 'idle' : 'local')
const syncMessage = ref('')
let syncTimer
let skipNextSync = false

async function pullWorkspace() {
  if (!auth.isLoggedIn) { syncState.value = 'local'; return }
  syncState.value = 'loading'
  try {
    const payload = await loadWorkspace(auth.token)
    const parsed = fromServer(payload, checkHours.value)
    // 云端还没有数据时，把本机已有的内容推上去，而不是清空
    if (!parsed.members.length && members.value.length) {
      skipNextSync = true
      syncState.value = 'saving'
      await saveWorkspace(auth.token, { queues: queues.value, members: members.value, entries: entries.value })
      syncState.value = 'saved'
      syncMessage.value = '已把本机数据同步到账号'
      return
    }
    skipNextSync = true
    if (parsed.queues.length) queues.value = parsed.queues
    members.value = parsed.members
    entries.value = parsed.entries
    syncState.value = 'saved'
    syncMessage.value = ''
  } catch (error) {
    syncState.value = 'error'
    syncMessage.value = \`云端读取失败，当前用的是本机数据：\${error.message}\`
  }
}

async function pushWorkspace() {
  if (!auth.isLoggedIn) return
  syncState.value = 'saving'
  try {
    await saveWorkspace(auth.token, { queues: queues.value, members: members.value, entries: entries.value })
    syncState.value = 'saved'
    syncMessage.value = ''
  } catch (error) {
    syncState.value = 'error'
    syncMessage.value = \`保存到云端失败：\${error.message}\`
  }
}

watch([members, entries, queues], () => {
  if (!auth.isLoggedIn) return
  if (skipNextSync) { skipNextSync = false; return }
  clearTimeout(syncTimer)
  syncTimer = setTimeout(pushWorkspace, 800)
}, { deep: true })

onMounted(pullWorkspace)
onUnmounted(() => clearTimeout(syncTimer))
`
s = s.replace(anchor, cloud)

// 4) 补上 onMounted / onUnmounted 的 import
s = s.replace("import { computed, ref, watch } from 'vue'", "import { computed, onMounted, onUnmounted, ref, watch } from 'vue'")

fs.writeFileSync(f, s, 'utf8')
console.log('PerfPanel wired to the API')
