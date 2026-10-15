import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import mammoth from 'mammoth/mammoth.browser'
import { request } from '@/services/api'
import { splitDiaryText } from '@/services/diaryImport'
import { isLocalId, localId } from '@/app/ids'
import { downloadText } from '@/app/download'
import { notify } from '@/app/useToast'
import { requireLogin } from '@/app/useGuard'
import { readStoredJson, writeStoredJson } from '@/services/storage'
import { demoDiaries } from '@/data/seed'
import { useAuthStore } from './auth'
import { useProfileStore } from './profile'

const STORAGE_KEY = 'weiwei-blog-diaries-v1'

/**
 * 日记。一个页面里装了两份列表：
 *   · 「我的日记」= 登录后自己账号里的全部日记（含私密）
 *   · 「公开日记」= 所有人的公开日记，登录与否完全一致
 * 切换靠页面内的标签状态 `diaryTab`，不走路由，所以地址栏始终是 #/diary。
 * 访客没有「我的日记」这一份，只能看公开的。
 */
export const useDiariesStore = defineStore('diaries', () => {
  const auth = useAuthStore()
  const profile = useProfileStore()

  const diaries = ref(readStoredJson(STORAGE_KEY, null) || demoDiaries)
  watch(diaries, (value) => writeStoredJson(STORAGE_KEY, value), { deep: true })

  /** 日记页内部的两个视图：'mine' / 'public'。 */
  const diaryTab = ref('mine')
  const diaryScope = ref('ALL')
  const search = ref('')
  const remotePublicDiaries = ref([])
  const publicDiariesLoaded = ref(false)

  const selectedDiary = ref(null)
  /**
   * 阅读弹窗从哪一边滑进来。
   * 时间树里点的是左边的挂件就从左边进、点右边的就从右边进——「从卡片那一侧展开」，
   * 视线不用跨过屏幕去找弹窗。默认从右（不在树里的入口：首页日记碎片、归档页）。
   */
  const selectedDiaryFrom = ref('right')
  const diaryDialog = ref(false)
  const draft = ref(emptyDraft())
  const importReview = ref([])
  const importDialog = ref(false)
  /**
   * 导入时「统一发布权限」。整合日记一次能拆出几十篇，逐篇点太累，
   * 所以弹窗顶端有一组按钮一次性写进所有草稿；写成响应式是为了让按钮能显示当前选的是哪个。
   */
  const importVisibility = ref(profile.defaultVisibility)
  /**
   * 导入正在进行 / 已经存下几篇。
   *
   * 加这两个是因为「确认并保存」是**一次点击发几十个请求**（实测 50 篇约 1 秒）：
   * 按钮在这期间不禁用的话，手快的人点两下就是两份完全相同的日记，
   * 而且它们长得一模一样，事后只能靠日期+标题配对删——踩过一次就够。
   */
  const importing = ref(false)
  const importSaved = ref(0)

  const filteredDiaries = computed(() => diaries.value.filter((entry) => (diaryScope.value === 'ALL' || (diaryScope.value === 'PUBLIC' ? entry.visibility === 'PUBLIC' : entry.visibility !== 'PUBLIC'))
    && `${entry.title} ${entry.content} ${(entry.tags || []).join(' ')}`.toLowerCase().includes(search.value.toLowerCase())))

  /**
   * 公开日记：对所有人完全一致——登录与否都用同一份公开列表。
   * 自己的公开日记在这里用本机那一份（刚改完可见范围就是最新的），别人的照原样列出。
   */
  const publicDiaries = computed(() => {
    if (!publicDiariesLoaded.value) return diaries.value.filter((entry) => entry.visibility === 'PUBLIC')
    const ownIds = new Set(diaries.value.map((entry) => entry.id))
    return [...diaries.value.filter((entry) => entry.visibility === 'PUBLIC'), ...remotePublicDiaries.value.filter((entry) => !ownIds.has(entry.id))]
  })

  /** 访客没有「我的日记」这一份。 */
  const showMyDiary = computed(() => auth.isLoggedIn && diaryTab.value === 'mine')

  /**
   * 首页「日记碎片」显示哪两条：
   *   自己写过 -> 显示自己最近的；还没写（含访客、新账号）-> 显示大家的公开日记。
   * 原来这里直接写死 `diaries`（= 当前账号自己的日记），所以访客和新账号打开首页是一片空白，
   * 即使站上已经有公开日记。
   */
  const homeShowsOwnDiaries = computed(() => diaries.value.length > 0)
  const homeDiaries = computed(() => (homeShowsOwnDiaries.value ? diaries.value : publicDiaries.value).slice(0, 2))

  function emptyDraft() {
    return { id: null, title: '', date: new Date().toISOString().slice(0, 10), mood: '平静', weather: '☀️', visibility: profile.defaultVisibility, tags: '日常', content: '' }
  }

  function diaryPayload(entry) {
    return { title: entry.title, entryDate: entry.date, mood: entry.mood, weather: entry.weather, visibility: entry.visibility, tags: (entry.tags || []).join(','), content: entry.content }
  }

  function mapDiary(entry) {
    return {
      id: entry.id,
      title: entry.title,
      date: entry.entryDate,
      weather: entry.weather,
      mood: entry.mood,
      visibility: entry.visibility,
      tags: entry.tags ? entry.tags.split(/[，,\s]+/).filter(Boolean) : [],
      content: entry.content,
    }
  }

  /**
   * 读日记：公开列表对所有人一致；「我的日记」是登录后自己账号里的全部日记（含私密）。
   * 未登录时这里没有「自己的日记」——公开日记去公开日记标签看，两份不会互相顶替。
   */
  async function refresh() {
    let own = null
    if (auth.isLoggedIn) {
      try { own = (await request('/api/diaries', { token: auth.token })).map((entry) => ({ ...mapDiary(entry), mine: true })) }
      catch (error) { notify(`无法同步日记：${error.message}`) }
    }
    // 本机草稿（旧版本在未登录时写的）不再自动上传，只留在当前浏览器里。
    const localDrafts = diaries.value.filter((entry) => isLocalId(entry.id)).map((entry) => ({ ...entry, mine: false, local: true }))

    let backendAnswered = false
    try {
      const remote = await request('/api/public/diaries')
      remotePublicDiaries.value = remote.map((entry) => ({ ...mapDiary(entry), mine: false }))
      publicDiariesLoaded.value = true
      backendAnswered = true
    } catch { /* 接口不可达时保留本机预览。 */ }

    // 后端答上来了，内置示例就不该再冒充「我的日记」：未登录的人这里本来就没有自己的日记，
    // 只留下本机草稿。登录的人换成自己那一份；自己那份没读到就不要用空数组把已有内容顶掉。
    if (!auth.isLoggedIn && backendAnswered) diaries.value = localDrafts
    else if (own !== null) diaries.value = [...localDrafts, ...own]
  }

  function openNew() {
    if (!requireLogin('写日记')) return
    draft.value = emptyDraft()
    diaryDialog.value = true
  }

  /**
   * 打开阅读弹窗。`from` 是卡片所在的那一侧（时间树传 'left' / 'right'），
   * 决定弹窗从哪边滑进来；不在树里的入口不传，按默认的右边。
   */
  function openReader(entry, from) {
    if (!entry) return
    selectedDiaryFrom.value = from === 'left' ? 'left' : 'right'
    selectedDiary.value = entry
  }

  function openEdit(entry) {
    if (!requireLogin('编辑日记')) return
    if (!entry.mine && !isLocalId(entry.id)) return notify('这不是你自己的日记，只能阅读')
    draft.value = { ...entry, tags: (entry.tags || []).join('，') }
    selectedDiary.value = null
    diaryDialog.value = true
  }

  async function save() {
    if (!requireLogin('保存日记')) return
    if (!draft.value.title.trim() || !draft.value.content.trim()) return notify('请填写日记标题和内容')
    const record = { ...draft.value, id: draft.value.id || localId(), tags: String(draft.value.tags || '').split(/[，,\s]+/).filter(Boolean) }
    if (record.visibility !== 'PUBLIC') record.visibility = 'PRIVATE'
    let index = diaries.value.findIndex((item) => item.id === record.id)
    // 本机草稿（旧版本留下的）在服务器上没有对应记录，要 POST 而不是 PUT 一个不存在的路径。
    const isUpdate = !isLocalId(draft.value.id) && Boolean(draft.value.id)
    try {
      const saved = await request(isUpdate ? `/api/diaries/${draft.value.id}` : '/api/diaries', {
        token: auth.token,
        method: isUpdate ? 'PUT' : 'POST',
        body: JSON.stringify(diaryPayload(record)),
      })
      Object.assign(record, mapDiary(saved), { mine: true })
      index = diaries.value.findIndex((item) => item.id === record.id)
    } catch (error) { return notify(`日记未保存：${error.message}`) }
    if (index >= 0) diaries.value[index] = record
    else diaries.value.unshift(record)
    diaryDialog.value = false
    notify(index >= 0 ? '日记已保存到数据库' : '日记已写入数据库')
  }

  async function changeVisibility(entry) {
    if (!requireLogin('修改日记可见范围')) return
    const nextVisibility = entry.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
    if (!isLocalId(entry.id)) {
      try {
        const updated = await request(`/api/diaries/${entry.id}`, {
          token: auth.token,
          method: 'PUT',
          body: JSON.stringify(diaryPayload({ ...entry, visibility: nextVisibility })),
        })
        Object.assign(entry, mapDiary(updated), { mine: true })
        notify(nextVisibility === 'PUBLIC' ? '这篇日记已公开' : '这篇日记已设为仅自己可见')
        return
      } catch (error) { return notify(`可见范围未更新：${error.message}`) }
    }
    entry.visibility = nextVisibility
    notify(nextVisibility === 'PUBLIC' ? '这篇日记已公开' : '这篇日记已设为仅自己可见')
  }

  async function remove(id) {
    if (!requireLogin('删除日记')) return
    if (!isLocalId(id)) {
      try { await request(`/api/diaries/${id}`, { token: auth.token, method: 'DELETE' }) }
      catch (error) { return notify(`删除失败：${error.message}`) }
    }
    diaries.value = diaries.value.filter((entry) => entry.id !== id)
    selectedDiary.value = null
    notify('日记已删除')
  }

  function exportOne(entry) {
    const text = `${entry.title}\n${entry.date} · ${entry.weather} ${entry.mood}\n\n${entry.content}\n`
    downloadText(text, `${entry.date}-${entry.title}.txt`)
  }

  function exportAll() {
    const text = diaries.value
      .map((entry) => `${entry.title}\n${entry.date} · ${entry.weather} ${entry.mood}\n标签：${(entry.tags || []).join('、')}\n\n${entry.content}`)
      .join('\n\n------------------------------\n\n')
    downloadText(text, '唯唯的日记合集.txt')
  }

  /**
   * 解析 .txt / .docx 为待确认的日记草稿。真正入库在 confirmImport。
   *
   * 一个文件里装了很多篇（「整合日记」）时按日期头拆开——拆分规则在 services/diaryImport.js。
   * 一个日期头都没有的文件仍按老办法当成一篇：第一行是标题。
   * 返回条数；0 表示没读到内容（提示已经发出去）。
   */
  async function parseImportFiles(files) {
    if (!requireLogin('导入日记')) return 0
    const parsed = []
    for (const file of files) {
      try {
        const extension = file.name.toLowerCase().split('.').pop()
        let content = ''
        if (extension === 'txt') content = await file.text()
        else if (extension === 'docx') {
          const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
          content = result.value
        } else { notify(`已跳过不支持的文件：${file.name}`); continue }
        const groups = splitDiaryText(content)
        if (groups.length) {
          for (const group of groups) {
            parsed.push({
              id: localId(), title: group.title, date: group.date || new Date().toISOString().slice(0, 10),
              weather: '☀️', mood: '平静', tags: ['日记'], visibility: importVisibility.value,
              content: group.content, source: file.name,
            })
          }
        } else {
          const lines = content.split(/\r?\n/)
          const title = lines.shift()?.trim() || file.name.replace(/\.(txt|docx)$/i, '')
          parsed.push({
            id: localId(), title, date: new Date().toISOString().slice(0, 10), weather: '☀️', mood: '平静',
            tags: ['导入'], visibility: importVisibility.value, content: lines.join('\n').trim() || content.trim(), source: file.name,
          })
        }
      } catch (error) { notify(`无法读取 ${file.name}：${error.message}`) }
    }
    if (!parsed.length) { notify('没有读到内容。请选择 TXT 或 DOCX 格式的日记文件'); return 0 }
    importReview.value = parsed
    importSaved.value = 0
    importDialog.value = true
    return parsed.length
  }

  /** 「统一发布权限」：一次把待确认的每一篇都设成同一个可见范围。 */
  function applyImportVisibility(value) {
    importVisibility.value = value === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE'
    for (const entry of importReview.value) entry.visibility = importVisibility.value
  }

  /** 拆分偶尔会多切出一小段（例如文件顶部的总标题），导入前可以就地删掉。 */
  function dropImportDraft(id) {
    importReview.value = importReview.value.filter((entry) => entry.id !== id)
  }

  /** 单篇的可见范围切换（和「统一发布权限」并存：先统一，再挑几篇单独改）。 */
  function toggleImportVisibility(entry) {
    if (!entry) return
    entry.visibility = entry.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
  }

  async function confirmImport() {
    const drafts = importReview.value
    if (!drafts.length || importing.value) return
    if (!requireLogin('导入日记')) return
    importing.value = true
    importSaved.value = 0
    let results = []
    try {
      // allSettled, not all: one rejected file must not hide the ones the server already accepted,
      // otherwise retrying the dialog would insert duplicates of them.
      results = await Promise.allSettled(drafts.map(async (entry) => {
        const saved = await request('/api/diaries', {
          token: auth.token,
          method: 'POST',
          // 每篇自己的可见范围优先；没设过就跟随顶端的「统一发布权限」。
          body: JSON.stringify(diaryPayload({ ...entry, visibility: entry.visibility || importVisibility.value })),
        })
        importSaved.value += 1
        return saved
      }))
    } finally {
      // 一定要复位：不然一次网络异常就会让按钮永久卡在「保存中」。
      importing.value = false
    }
    const saved = results.filter((result) => result.status === 'fulfilled').map((result) => ({ ...mapDiary(result.value), mine: true }))
    const failed = results.filter((result) => result.status === 'rejected')
    // Keep whatever the server refused so the user can retry it instead of losing it.
    importReview.value = drafts.filter((entry, index) => results[index].status === 'rejected')
    diaries.value = [...saved, ...diaries.value]
    if (failed.length) return notify(`已导入 ${saved.length} 篇，${failed.length} 篇失败：${failed[0].reason?.message || ''}`)
    importDialog.value = false
    notify(`已导入 ${drafts.length} 篇日记`)
  }

  return {
    diaries, diaryTab, diaryScope, search, remotePublicDiaries, publicDiariesLoaded,
    selectedDiary, selectedDiaryFrom, diaryDialog, draft, importReview, importDialog, importVisibility, importing, importSaved,
    filteredDiaries, publicDiaries, showMyDiary, homeShowsOwnDiaries, homeDiaries,
    emptyDraft, diaryPayload, mapDiary,
    refresh, openNew, openReader, openEdit, save, changeVisibility, remove,
    exportOne, exportAll, parseImportFiles, applyImportVisibility, dropImportDraft, toggleImportVisibility, confirmImport,
  }
})
