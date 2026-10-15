import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { defineStore } from 'pinia'
import { request, uploadMedia } from '@/services/api'
import { notify } from '@/app/useToast'
import { requireLogin } from '@/app/useGuard'
import { currentPage, go } from '@/app/usePageNav'
import { readStoredText, writeStoredText } from '@/services/storage'
import { LYRICS_SOURCE_LABELS, parseLrc, resolveLyrics } from '@/services/lyrics'
import { useAuthStore } from './auth'
import { useMediaStore } from './media'

// 中文歌词源要经一个中转才能从浏览器调用（它的接口不带跨域响应头）。没配就整条源跳过，
// 只走 LRCLIB 和「手动粘贴」。仓库里附了一个 Supabase Edge Function 的实现。
const LYRICS_PROXY = import.meta.env?.VITE_LYRICS_PROXY || ''

// 可视化模式：频谱柱 / 声波 / 涟漪 / 长条矩阵。选择记在本机，下次打开保持一致。
export const vizModes = [
  { id: 'bars', label: '频谱' },
  { id: 'matrix', label: '矩阵' },
  { id: 'wave', label: '声波' },
  { id: 'ripple', label: '涟漪' },
]

// 每步对应的进度。上传和歌词匹配拿不到真实字节数（匹配要等在线接口），
// 所以这两步只给一个大致位置，由 CSS 的流动条纹表示「还在动」。
const UPLOAD_STEP_PROGRESS = { uploading: 22, saving: 48, lyrics: 74, done: 100, error: 100 }
const UPLOAD_INDETERMINATE_STEPS = new Set(['uploading', 'lyrics'])
const UPLOAD_STEP_LABELS = { uploading: '上传中', saving: '写入音乐库', lyrics: '解析歌词', done: '已完成', error: '失败' }

/** 秒数 → `m:ss`。纯函数，页面与音乐盒共用。 */
export function formatTime(value) {
  if (!Number.isFinite(value) || value <= 0) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/**
 * 这是不是一个能直接交给 <audio> 的地址。
 *
 * 必须区分：签名链接失败时 API 会把 url 退化成**对象键**（`users/…/x.mp3`），
 * 那是个相对路径——交给 <audio> 只会被解析成页面下的路径然后 404。
 */
function isDirectAudioUrl(value) {
  return /^(https?:|blob:|data:)/.test(String(value || ''))
}

/**
 * 一首歌到底能不能播。
 *
 * 曲库里的条目未必都放得出来：签名链接可能没签成功（那时 src 会是对象键而不是地址）、
 * 也可能只有对象键需要现换链接。把它们排除掉，切歌和「播第一首」才不会一上去就卡住。
 */
function isPlayableTrack(track) {
  if (!track) return false
  if (track.file) return true
  if (isDirectAudioUrl(track.src)) return true
  return Boolean(track.key)
}

/**
 * 播放器、歌词、上传队列。
 *
 * 这块刻意和媒体库（stores/media.js）分开：媒体库管「有哪些曲子、可见范围、能不能删」，
 * 这里管「正在播哪一首、音频图怎么接、歌词匹配到哪一步」。两边的接缝只有
 * `syncLibrary()` 和 `deleteTrack()` 两处。
 */
export const useMusicStore = defineStore('music', () => {
  const auth = useAuthStore()
  const media = useMediaStore()

  const musicItems = ref([])
  const remoteMusicUrl = ref('')
  const musicName = ref('')
  const playing = ref(false)
  const volume = ref(45)
  const activeTrackId = ref(null)
  const currentTime = ref(0)
  const trackDuration = ref(0)
  const activeRemoteAudio = ref(false)
  const musicEditor = ref(null)
  const musicDraft = ref({ title: '', visibility: 'PRIVATE' })
  const adminUploadMessage = ref('')

  // 两个 <audio> 元素由 modules/music/AudioEngine.vue 挂上来，store 只持有引用。
  // 用 shallowRef：DOM 元素不需要（也不该）被 Vue 深度代理。
  const audioEl = shallowRef(null)
  const remoteAudioEl = shallowRef(null)
  // analyser 是 Web Audio 的 AnalyserNode，同理。
  const analyser = shallowRef(null)

  // 本机临时选中的文件（不在曲库里）。它也要能有歌词，所以单独留一份引用。
  const localFileTrack = ref(null)
  const audioUrl = ref('')

  // ---- 歌词 -----------------------------------------------------------------
  // 歌词的解析发生在上传的时候，不是打开页面的时候：上传时手里有完整文件（能读内嵌标签），
  // 上传的人又是登录状态（能把匹配结果直接存回数据库）。这样访客打开音乐页时，歌词已经是
  // 现成的一行文本，不用等、也不会因为在线接口挂了就看不到。
  const lyricsLrc = ref('')
  const lyricsSource = ref('')
  const lyricsParsed = computed(() => (lyricsLrc.value ? parseLrc(lyricsLrc.value) : null))
  // 每首歌一个解析任务状态：parsing / ready / none。曲库列表和上传弹窗都读它。
  const lyricJobs = ref({})

  // ---- 音频通路 --------------------------------------------------------------
  // 本机播放的音频会被接进 Web Audio（AnalyserNode）来驱动频谱和粒子律动。
  // 代价是这时候音频不再走浏览器原生的播放通路，而是绕一圈经过音频图——在 GPU/主线程
  // 比较吃紧的机器上，这一绕就可能表现为「播一下卡一下」。
  //
  // 省电模式就是把这一圈整个去掉：不建音频图（原生通路最稳）、不画粒子、不画频谱。
  // 它同时也是一个诊断开关——打开它之后如果不卡了，问题就在这条通路上。
  const lowPower = ref(readStoredText('weiwei-blog-low-power', '') === '1')
  const vizMode = ref(readStoredText('weiwei-blog-viz-mode', 'bars'))
  watch(vizMode, (value) => writeStoredText('weiwei-blog-viz-mode', value))

  // The Web Audio graph for the local <audio> element is built exactly once. A media element may be
  // connected to only one MediaElementAudioSourceNode: building it again throws InvalidStateError and
  // silently kills every later local track, which is what happened after playing an online track.
  let audioGraph = null
  let consecutiveFailures = 0
  const localFileUrls = new Map()
  const jobTimers = new Set()

  const currentTrack = computed(() => musicItems.value.find((track) => track.id === activeTrackId.value) || null)
  /** 曲库里真正能播的那些，顺序就是列表顺序。 */
  const playableTracks = computed(() => musicItems.value.filter(isPlayableTrack))
  // 没有选中曲目时显示中性文案，不再显示一个假的示例曲名。
  const nowPlayingLabel = computed(() => currentTrack.value?.name || musicName.value || '未选择曲目')
  const progressPercent = computed(() => (trackDuration.value > 0 ? Math.min(100, (currentTime.value / trackDuration.value) * 100) : 0))

  // ---- 曲库同步 --------------------------------------------------------------
  /**
   * 把公开曲目和自己账号里的曲目合成一份列表。
   * 元数据由 stores/media.js 一次请求拿到（`ownTracks` / `publicTracks`），这里不重复请求。
   */
  function syncLibrary() {
    const ownTracks = media.ownTracks
    const publicTracks = media.publicTracks
    const ownTrackIds = new Set(ownTracks.map((item) => item.id))
    const localTracks = musicItems.value.filter((item) => item.local && !item.key)
    musicItems.value = media.ownMedia === null
      ? [...localTracks, ...publicTracks]
      : [...localTracks, ...ownTracks, ...publicTracks.filter((item) => !ownTrackIds.has(item.id))]
  }

  // ---- 播放地址 --------------------------------------------------------------
  /** 本次会话刚上传 / 本机选择的文件，直接给一个本地地址；没有就返回空串。 */
  function localSourceFor(item) {
    if (!item?.file) return ''
    if (!localFileUrls.has(item.id)) localFileUrls.set(item.id, URL.createObjectURL(item.file))
    return localFileUrls.get(item.id) || ''
  }

  function activeAudio() {
    return activeRemoteAudio.value ? remoteAudioEl.value : audioEl.value
  }

  function attachAudio(localEl, remoteEl) {
    audioEl.value = localEl || null
    remoteAudioEl.value = remoteEl || null
    setVolume()
  }

  // ---- 歌词任务 --------------------------------------------------------------
  function lyricJob(id) { return lyricJobs.value[id] || null }

  function setLyricJob(id, patch) {
    lyricJobs.value = { ...lyricJobs.value, [id]: { ...(lyricJobs.value[id] || {}), ...patch } }
  }

  /** 把解析到的歌词写回数据库。访客不会走到这里，只有登录的曲目所有者会。 */
  async function persistTrackLyrics(item, lrc, source) {
    if (!media.isStoredMedia(item) || !auth.isLoggedIn) return false
    try {
      await request(`/api/media/${item.id}`, {
        token: auth.token,
        method: 'PUT',
        body: JSON.stringify({ lyrics: lrc, lyricsSource: source }),
      })
      Object.assign(item, { lyrics: lrc, lyricsSource: source })
      return true
    } catch (error) {
      setLyricJob(item.id, { saveError: error.message })
      return false
    }
  }

  /**
   * 解析一首歌的歌词。上传时调用，也用于给老曲目补歌词、以及在音乐页点「重新匹配」。
   *
   * 顺序在 services/lyrics.js 里：已保存的 → 文件内嵌标签 → LRCLIB → 中文源。
   * `force` 会跳过第一步，用于「我已经有歌词了，但想重新在线匹配一次」。
   *
   * 这里**刻意不为了拿时长去探测音频**。之前有个 probeDuration：另建一个 <audio>、把同一个
   * 文件按 metadata 再下载一遍，只为了给 LRCLIB 的精确匹配补一个 duration 字段。代价完全
   * 不成比例——那等于在用户播放的时候再抢一份同一文件的下载与解码，是「播一下卡一下」的直接来源。
   * 现在时长只取播放器已经读到的值（有就传、没有就不传），匹配退到搜索路径，精度略降而已。
   */
  async function resolveTrackLyrics(item, { force = false, announce = false } = {}) {
    if (!item) return null
    const id = item.id
    setLyricJob(id, { status: 'parsing', source: '', error: '', saveError: '' })
    try {
      const duration = id === activeTrackId.value ? trackDuration.value : 0
      const source = force ? { ...item, lyrics: '' } : item
      const result = await resolveLyrics(source, { proxyUrl: LYRICS_PROXY, duration })
      if (result?.lrc) {
        Object.assign(item, { lyrics: result.lrc, lyricsSource: result.source })
        setLyricJob(id, { status: 'ready', source: result.source })
        // 正在播的就是这首歌 → 立刻把歌词交给右侧歌词栏，不用再等。
        if (id === activeTrackId.value) {
          lyricsLrc.value = result.lrc
          lyricsSource.value = result.source
        }
        if (result.source !== 'saved' && result.source !== 'manual') await persistTrackLyrics(item, result.lrc, result.source)
        if (announce) notify(`歌词已就绪（${LYRICS_SOURCE_LABELS[result.source] || result.source}）`)
        return result
      }
      setLyricJob(id, { status: 'none' })
      if (announce) notify('这首歌没有匹配到歌词，可以在歌词栏手动粘贴 LRC')
      return null
    } catch (error) {
      setLyricJob(id, { status: 'none', error: error.message })
      return null
    }
  }

  /** 给曲库里所有还没有歌词的曲子补一遍。老曲目（在这次改动之前上传的）靠它补上。 */
  async function fillMissingLyrics() {
    if (!requireLogin('补全歌词')) return
    const pending = musicItems.value.filter((item) => item.mine && !item.lyrics && lyricJob(item.id)?.status !== 'parsing')
    if (!pending.length) return notify('所有曲目都已经有歌词了')
    notify(`正在为 ${pending.length} 首曲目匹配歌词…`)
    let found = 0
    for (const item of pending) {
      // 一首一首来：几首歌同时打歌词接口容易被限流，也没必要。
      const result = await resolveTrackLyrics(item)
      if (result) found += 1
    }
    notify(found ? `补全完成，新增 ${found} 首歌词` : '没有匹配到新的歌词，可以在音乐页手动粘贴')
  }

  /** 歌词栏里手动保存的那一份。手动内容永远覆盖自动匹配的结果。 */
  async function saveLyrics(lrc) {
    const track = currentTrack.value || localFileTrack.value
    lyricsLrc.value = lrc
    lyricsSource.value = 'manual'
    if (!track) return
    const parsed = parseLrc(lrc)
    if (!parsed.lines.some((line) => line.text)) return notify('这段歌词里没有内容')
    Object.assign(track, { lyrics: lrc, lyricsSource: 'manual' })
    setLyricJob(track.id, { status: 'ready', source: 'manual' })
    if (!media.isStoredMedia(track) || !auth.isLoggedIn) {
      notify('歌词已显示；登录后会保存到账号，换设备也能看到')
      return
    }
    const saved = await persistTrackLyrics(track, lrc, 'manual')
    notify(saved ? '歌词已保存到账号' : '歌词已显示，但没能保存到账号')
  }

  /** 音乐页歌词栏的「重新匹配」。跳过已保存的那一份，重新走内嵌 + 在线。 */
  async function rematchLyrics() {
    const track = currentTrack.value || localFileTrack.value
    if (!track) return notify('请先选择一首曲目')
    notify('正在重新匹配歌词…')
    await resolveTrackLyrics(track, { force: true, announce: true })
  }

  // ---- 后台导入队列 ----------------------------------------------------------
  const uploadJobs = ref([])

  function addUploadJob(name) {
    const job = {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name, step: 'uploading', message: '正在上传到对象存储…',
      trackId: null, hasLyrics: false, error: '', createdAt: Date.now(),
    }
    uploadJobs.value = [job, ...uploadJobs.value]
    return job
  }

  function patchUploadJob(job, patch) {
    uploadJobs.value = uploadJobs.value.map((item) => (item.id === job.id ? { ...item, ...patch } : item))
  }

  function dismissUploadJob(id) {
    uploadJobs.value = uploadJobs.value.filter((item) => item.id !== id)
  }

  function uploadJobProgress(job) { return UPLOAD_STEP_PROGRESS[job.step] ?? 10 }
  function uploadJobIndeterminate(job) { return UPLOAD_INDETERMINATE_STEPS.has(job.step) }
  function uploadStepLabel(job) { return UPLOAD_STEP_LABELS[job.step] || job.step }

  const activeUploadCount = computed(() => uploadJobs.value.filter((job) => job.step !== 'done' && job.step !== 'error').length)

  function clearFinishedJobs() {
    uploadJobs.value = uploadJobs.value.filter((job) => job.step !== 'done')
  }

  function playJobTrack(job) {
    const track = musicItems.value.find((item) => item.id === job.trackId)
    dismissUploadJob(job.id)
    if (track) playMusicItem(track)
    else go('music')
  }

  // 队列跑完自动收起用的定时器；组件卸载时要一起清掉。
  function scheduleDismiss(id, delay) {
    const timer = setTimeout(() => { jobTimers.delete(timer); dismissUploadJob(id) }, delay)
    jobTimers.add(timer)
  }

  // ---- 播放控制 --------------------------------------------------------------
  /**
   * 把播放器/歌词那一块滚进视野。
   *
   * 曲库列表在页面下方，从那里点播之后，播放器和歌词其实在上面——不滚一下就得自己往上找。
   * 已经在视野里就不动，免得把用户正在看的东西顶走。
   */
  function revealPlayerPanel() {
    if (currentPage.value !== 'music') return
    const panel = typeof document === 'undefined' ? null : document.querySelector('.music-console')
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    const viewport = window.innerHeight || document.documentElement.clientHeight
    // 已经露出大半就不动。
    if (rect.top >= 0 && rect.top < viewport * 0.55) return
    // 顶部有吸顶导航，留出它的高度。
    const navOffset = 96
    window.scrollTo({ top: Math.max(0, rect.top + window.scrollY - navOffset), behavior: 'smooth' })
  }

  /**
   * 让歌词栏的高度跟着播放器栏走。
   *
   * 歌词栏的滚动区是 `overflow:auto`，它**不会**限制自身高度——于是面板的自然高度会随着
   * 歌词行数一起长，把整块 console 顶高，播放器栏也跟着被拉伸。这就是「歌词一加载出来
   * 整个变长了」的原因。
   *
   * 这里量出播放器栏的自然高度写进 CSS 变量，歌词栏用这个高度：两块严格等高，
   * 而且歌词再多也不会把页面撑长。
   */
  function syncConsoleHeight() {
    if (currentPage.value !== 'music') return
    if (typeof document === 'undefined') return
    const consoleEl = document.querySelector('.music-console')
    const player = consoleEl?.querySelector('.music-player-panel')
    if (!consoleEl || !player) return
    // 先撤掉约束再量，否则量到的是上一次的结果。
    consoleEl.style.removeProperty('--console-h')
    const height = player.offsetHeight
    if (height > 0) consoleEl.style.setProperty('--console-h', `${height}px`)
  }

  watch([currentPage, () => musicItems.value.length], () => {
    if (currentPage.value !== 'music') return
    syncConsoleHeight()
  })

  /** 暂停之后把刚才那首接着放（上传等占用带宽的操作结束后调用）。 */
  function resumePlayback() {
    const audio = activeAudio()
    if (!audio || !audio.src || !audio.paused) return
    audio.play().then(() => { playing.value = true }).catch(() => {})
  }

  async function playMusicItem(item) {
    musicName.value = item.name
    activeTrackId.value = item.id
    // 从下面的曲库点播时，播放器/歌词那一块在上面，不滚一下就得自己去找。
    revealPlayerPanel()
    // 标题换了，播放器栏的高度可能跟着变，重新对一次高度。
    nextTick(syncConsoleHeight)
    localFileTrack.value = null
    currentTime.value = 0
    trackDuration.value = 0
    if (item.kind === 'MUSIC_URL') {
      activeRemoteAudio.value = true
      audioEl.value?.pause()
      const remote = remoteAudioEl.value
      // 外链音频不加 crossorigin，浏览器因此不允许 Web Audio 读取它；粒子会退化为缓慢呼吸，
      // 而不是伪造频谱。上传到对象存储或本机选择的音频走真实 analyser。
      if (remote) {
        remote.src = item.src
        remote.load()
        remote.play().then(() => { playing.value = true }).catch(() => notify('这条链接无法播放，请使用可直接播放的 MP3、M4A、OGG 或 WAV 地址'))
      }
      analyser.value = null
      return
    }
    activeRemoteAudio.value = false
    remoteAudioEl.value?.pause()
    const audio = audioEl.value
    if (!audio) return
    audio.pause()

    // item.src 不一定是可以直接播的地址：签名失败时 API 会把它退化成对象键（users/…）。
    // 那是相对路径，交给 <audio> 只会 404。这种时候必须去换一次短期链接。
    let source = isDirectAudioUrl(item.src) ? item.src : ''
    if (!source && item.key) {
      try {
        const target = await request('/api/storage/presign-download', { token: auth.token, method: 'POST', body: JSON.stringify({ key: item.key }) })
        source = isDirectAudioUrl(target?.url) ? target.url : ''
      } catch (error) {
        adminUploadMessage.value = error.message
        return skipAfterFailure('无法获取这首音乐')
      }
    }
    if (activeTrackId.value !== item.id) return
    const localUrl = localSourceFor(item)
    if (!localUrl && !source) {
      // 既没有本地源、也换不到链接：跳过这一首，别把队列停在这里。
      return skipAfterFailure('这首音乐没有可播放的地址')
    }
    const target = localUrl || source
    // 用本地源时把在线地址留在 dataset 上，万一本地那份坏了 @error 能切回去。
    audio.dataset.fallback = localUrl && source ? source : ''
    audio.src = target
    audio.load()
    toggleMusic()
  }

  /**
   * 音频播放失败时的兜底：如果手上还有在线地址，就切回去重试一次。
   * 没有这条，本地缓存一旦出问题就是「完全没声」，而且看不出原因。
   */
  function onAudioError() {
    const audio = audioEl.value
    if (!audio) return
    const fallback = audio.dataset.fallback
    if (fallback) {
      delete audio.dataset.fallback
      notify('这段音频没能播放，已改回在线播放')
      audio.src = fallback
      audio.load()
      audio.play().then(() => { consecutiveFailures = 0 }).catch(() => skipAfterFailure('这首音乐暂时无法播放'))
      return
    }
    // 没有可退的地址：跳过这一首，别让队列停在一个播不出来的条目上。
    skipAfterFailure('这首音乐暂时无法播放')
  }

  function onTimeUpdate() {
    const audio = activeAudio()
    if (!audio) return
    currentTime.value = audio.currentTime || 0
    if (Number.isFinite(audio.duration) && audio.duration > 0) trackDuration.value = audio.duration
  }

  function onLoadedMetadata() {
    const audio = activeAudio()
    if (audio && Number.isFinite(audio.duration) && audio.duration > 0) trackDuration.value = audio.duration
  }

  function seekTo(event) {
    const audio = activeAudio()
    if (!audio || !trackDuration.value) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * trackDuration.value
    currentTime.value = audio.currentTime
  }

  /** 直接按秒跳转：歌词点某一句、侧边栏进度条都用它。 */
  function seekToTime(seconds) {
    const audio = activeAudio()
    if (!audio || !Number.isFinite(seconds)) return
    const limit = trackDuration.value || audio.duration || 0
    audio.currentTime = limit > 0 ? Math.min(Math.max(0, seconds), limit) : Math.max(0, seconds)
    currentTime.value = audio.currentTime
  }

  function playOffset(step) {
    // 在「能播的曲目」里走，而不是整个列表——列表里可能混着放不出来的条目，
    // 切到它就会停在那儿，看起来就是「卡住了不往下走」。
    const list = playableTracks.value
    if (!list.length) return
    const index = list.findIndex((track) => track.id === activeTrackId.value)
    const next = index < 0 ? 0 : (index + step + list.length) % list.length
    playMusicItem(list[next])
  }

  /** 播放失败之后自动跳到下一首，别让整个队列停在一个播不出来的条目上。 */
  function skipAfterFailure(reason) {
    if (consecutiveFailures >= 3) return notify(reason)
    consecutiveFailures += 1
    if (playableTracks.value.length > 1) {
      notify(`${reason}，已跳到下一首`)
      playOffset(1)
    } else {
      notify(reason)
    }
  }

  function ensureAnalyser(audio) {
    // 省电模式：完全不建音频图，音频走浏览器原生通路（最稳的一条路）。
    if (lowPower.value) { analyser.value = null; return }
    if (audioGraph) { analyser.value = audioGraph.meter; audioGraph.context.resume().catch(() => {}); return }
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    try {
      const context = new AudioContextClass()
      const source = context.createMediaElementSource(audio)
      const meter = context.createAnalyser()
      // fftSize 决定 frequencyBinCount（这里 = 512 个频点）。
      // 原来设成 128，也就是只有 64 个频点，而柱子上限有 44 根——平均每根柱子摊到一个频点，
      // 每根柱子都在跟着单个频点的抖动乱跳，所以看起来「波动太大、没有效果」。
      // 512 个频点下每根柱子摊到十几个频点取平均，读数才是稳的。
      meter.fftSize = 1024
      // 时间平滑：0.86 比默认的 0.8 更稳，快节奏段落也不会闪成一片。
      meter.smoothingTimeConstant = 0.86
      source.connect(meter)
      meter.connect(context.destination)
      audioGraph = { context, meter }
      analyser.value = meter
      context.resume().catch(() => {})
    } catch { /* The visualiser is optional; playback must still work without it. */ }
  }

  async function toggleMusic() {
    // 还没有选过曲目时，播放键就应该是「放队列里的第一首」——而不是弹一句提示什么都不做。
    if (!currentTrack.value && !localFileTrack.value && !audioUrl.value) {
      const first = playableTracks.value[0]
      if (!first) return notify('音乐库还是空的，先上传一首吧')
      return playMusicItem(first)
    }
    const audio = activeRemoteAudio.value ? remoteAudioEl.value : audioEl.value
    if (!audio) return
    if (!audio.src) {
      // 选过，但源还没就绪（例如刚被删掉）——退回放第一首，别让播放键失灵。
      const first = playableTracks.value[0]
      if (first) return playMusicItem(first)
      return notify('请先从列表选择一首音乐')
    }
    // Online tracks are not routed through the analyser, so clear it — the graph is reused, not rebuilt.
    if (activeRemoteAudio.value) analyser.value = null
    else ensureAnalyser(audio)
    if (audio.paused) {
      try {
        await audio.play()
        playing.value = true
        consecutiveFailures = 0
      } catch (error) {
        // 以前这里是空的 catch + 一句「浏览器暂不允许播放」：于是**任何**失败都被报成自动播放被拦，
        // 包括被新的加载打断的 AbortError、以及根本解不出来的源。按名字分开处理才说得清。
        const name = error?.name || ''
        if (name === 'AbortError') return
        if (name === 'NotAllowedError') return notify('浏览器阻止了自动播放，再点一次播放键即可')
        skipAfterFailure('这首音乐暂时无法播放')
      }
    } else {
      audio.pause()
      playing.value = false
    }
  }

  function setPlaying(value) { playing.value = value }

  function setVolume() {
    if (audioEl.value) audioEl.value.volume = volume.value / 100
    if (remoteAudioEl.value) remoteAudioEl.value.volume = volume.value / 100
  }
  watch(volume, setVolume, { immediate: true })

  function onAudioEnded(event) {
    // 两个 <audio> 都挂了 ended。只有当前正在用的那个才有资格触发切歌，
    // 否则另一个元素残留的 ended 会造成一次连跳两首。
    if (event?.target && event.target !== activeAudio()) return
    playing.value = false
    currentTime.value = 0
    consecutiveFailures = 0
    // 有多首就接着放下一首；只有一首就停下，免得看起来像卡住了。
    if (playableTracks.value.length > 1) playOffset(1)
  }

  function setLowPower(value) {
    lowPower.value = value
    writeStoredText('weiwei-blog-low-power', value ? '1' : '0')
    // 音频图一旦建起来，就和当时那个 <audio> 元素绑死了（同一元素只能接一个
    // MediaElementAudioSourceNode，且无法断开）。所以切换设置时要连元素一起换掉：
    // AudioEngine 里 <audio> 的 key 绑在 lowPower 上，Vue 会重新创建一个干净的元素。
    if (audioGraph) { audioGraph.context.close().catch(() => {}); audioGraph = null }
    analyser.value = null
    playing.value = false
    notify(value
      ? '已切到省电模式：原生播放通路 + 关闭粒子与频谱，重新选一首歌即可'
      : '已恢复完整动效，重新选一首歌即可')
  }

  function setVizMode(mode) { vizMode.value = mode }

  // ---- 曲库写入 --------------------------------------------------------------
  /**
   * 上传 + 入库，全程在后台跑。
   *
   * 这里刻意不弹模态框：上传和在线匹配都可能花上十几秒，把用户按在一个不能关的窗口前面
   * 是没必要的。进度改由音乐页内联的任务卡显示，关掉卡片任务照跑；跑完自动收起（出错则留着，
   * 等你看到为止）。
   */
  async function addMusic(file) {
    if (!requireLogin('上传音乐')) return
    if (!file) return
    const item = { id: Date.now(), name: file.name, file, src: URL.createObjectURL(file), visibility: 'PRIVATE', key: '' }
    const job = addUploadJob(file.name)

    // 上传要占带宽，流式播放也要占带宽，两个一起走谁都走不动——实测过：播放中上传，
    // 进度会一直卡在「上传中」。所以先把播放停掉，让上传独占，传完再接着放。
    const resumeAfterUpload = playing.value
    if (resumeAfterUpload) {
      audioEl.value?.pause()
      remoteAudioEl.value?.pause()
      playing.value = false
      notify('上传期间已暂停播放，传完会继续')
    } else {
      notify('已开始后台导入')
    }

    try {
      const uploaded = await uploadMedia(file, auth.token)
      patchUploadJob(job, { step: 'saving', message: '正在写入音乐库…' })
      const saved = await request('/api/media', {
        token: auth.token,
        method: 'POST',
        body: JSON.stringify({ kind: 'MUSIC', title: file.name, objectKey: uploaded.key, contentType: uploaded.contentType, visibility: 'PRIVATE', albumName: '我的音乐' }),
      })
      Object.assign(item, media.mapMedia(saved), { mine: true, file })
      item.name = saved.title
    } catch (error) {
      adminUploadMessage.value = error.message
      patchUploadJob(job, { step: 'error', message: `音乐未保存：${error.message}` })
      return
    } finally {
      if (resumeAfterUpload) resumePlayback()
    }

    musicItems.value.unshift(item)
    patchUploadJob(job, { step: 'done', trackId: item.id, message: '已存入音乐库。' })
    // 成功就自己收起来，别一直占着；失败的那张留着。
    scheduleDismiss(job.id, 9000)
  }

  /** 本机试听：一次性的文件，不进曲库，但歌词照常解析。 */
  function playLocalFile(file) {
    if (!file) return
    activeRemoteAudio.value = false
    remoteAudioEl.value?.pause()
    if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
    audioUrl.value = URL.createObjectURL(file)
    musicName.value = file.name
    playing.value = false
    // 一次性选择的本机文件不属于列表曲目，清空高亮以免指错行。
    activeTrackId.value = null
    currentTime.value = 0
    trackDuration.value = 0
    if (audioEl.value) {
      audioEl.value.src = audioUrl.value
      audioEl.value.load()
    }
    // 本机试听的文件不在曲库里，也就不进上传流水线；但它的内嵌歌词/在线匹配照常做，
    // 放在 localFileTrack 上，歌词栏照样能显示。
    localFileTrack.value = { id: `local-${Date.now()}`, name: file.name, file, src: audioUrl.value, local: true }
    lyricsLrc.value = ''
    lyricsSource.value = ''
    resolveTrackLyrics(localFileTrack.value, { announce: true })
  }

  function addRemoteMusic() {
    if (!requireLogin('添加在线音乐')) return
    let url
    try { url = new URL(remoteMusicUrl.value) } catch { return notify('请输入有效的 HTTPS 音乐地址') }
    if (url.protocol !== 'https:') return notify('公网音乐地址需要使用 HTTPS')
    const item = { id: Date.now(), name: decodeURIComponent(url.pathname.split('/').pop() || '在线音乐'), src: url.href, visibility: 'PUBLIC', kind: 'MUSIC_URL', key: url.href }
    remoteMusicUrl.value = ''
    request('/api/media', {
      token: auth.token,
      method: 'POST',
      body: JSON.stringify({ kind: 'MUSIC_URL', title: item.name, objectKey: url.href, contentType: 'audio/url', visibility: 'PUBLIC', albumName: '在线音乐' }),
    })
      .then(async (raw) => {
        const saved = media.mapMedia(raw)
        const track = { ...item, ...saved, mine: true, name: saved.name || item.name, src: saved.src || item.src }
        musicItems.value.unshift(track)
        // 外链没有文件可以读内嵌标签，但曲名 + 时长照样能拿去做在线匹配。
        notify('在线音乐已保存，正在解析歌词…')
        await resolveTrackLyrics(track, { announce: true })
      })
      .catch((error) => notify(`在线音乐未保存：${error.message}`))
  }

  function edit(item) {
    if (!item.mine) return notify('这不是你自己的曲目，只能播放')
    musicEditor.value = item
    musicDraft.value = { title: item.name, visibility: item.visibility }
  }

  async function saveEdit() {
    const item = musicEditor.value
    if (!item || !musicDraft.value.title.trim()) return notify('请填写曲目名称')
    if (!item.mine) return notify('这不是你自己的曲目，只能播放')
    if (media.isStoredMedia(item)) {
      try {
        const saved = await request(`/api/media/${item.id}`, {
          token: auth.token,
          method: 'PUT',
          body: JSON.stringify({ title: musicDraft.value.title.trim(), visibility: musicDraft.value.visibility }),
        })
        Object.assign(item, media.mapMedia(saved))
        item.name = saved.title
      } catch (error) { return notify(`曲目信息未保存：${error.message}`) }
    } else {
      Object.assign(item, { name: musicDraft.value.title.trim(), visibility: musicDraft.value.visibility })
    }
    musicEditor.value = null
    notify('曲目信息已保存')
  }

  async function deleteTrack(item) {
    if (!item.mine) return notify('这不是你自己的曲目，只能播放')
    if (!window.confirm(`确定从音乐库删除“${item.name}”吗？`)) return
    if (media.isStoredMedia(item)) {
      try { await request(`/api/media/${item.id}`, { token: auth.token, method: 'DELETE' }) }
      catch (error) { return notify(`曲目未删除：${error.message}`) }
    }
    if (musicName.value === item.name) { audioEl.value?.pause(); remoteAudioEl.value?.pause(); playing.value = false }
    if (item.id === activeTrackId.value) { lyricsLrc.value = ''; lyricsSource.value = '' }
    musicItems.value = musicItems.value.filter((track) => track.id !== item.id)
    notify('曲目已删除')
  }

  /** 组件卸载：释放临时地址、音频图与定时器。 */
  function dispose() {
    if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
    for (const url of localFileUrls.values()) URL.revokeObjectURL(url)
    localFileUrls.clear()
    for (const timer of jobTimers) clearTimeout(timer)
    jobTimers.clear()
    if (audioGraph) { audioGraph.context.close().catch(() => {}); audioGraph = null }
  }

  return {
    musicItems, remoteMusicUrl, musicName, playing, volume, activeTrackId, currentTime, trackDuration,
    activeRemoteAudio, musicEditor, musicDraft, adminUploadMessage, analyser, lowPower, vizMode,
    localFileTrack, audioUrl, lyricsLrc, lyricsSource, lyricJobs, uploadJobs,
    currentTrack, playableTracks, nowPlayingLabel, progressPercent, lyricsParsed, activeUploadCount,
    syncLibrary, attachAudio, localSourceFor, lyricJob, setLyricJob,
    resolveTrackLyrics, fillMissingLyrics, saveLyrics, rematchLyrics,
    addUploadJob, patchUploadJob, dismissUploadJob, uploadJobProgress, uploadJobIndeterminate,
    uploadStepLabel, clearFinishedJobs, playJobTrack, revealPlayerPanel, syncConsoleHeight,
    playMusicItem, onAudioError, onTimeUpdate, onLoadedMetadata, seekTo, seekToTime, playOffset,
    toggleMusic, setPlaying, setVolume, onAudioEnded, setLowPower, setVizMode,
    addMusic, playLocalFile, addRemoteMusic, edit, saveEdit, deleteTrack, dispose,
    isDirectAudioUrl, isPlayableTrack,
  }
})
