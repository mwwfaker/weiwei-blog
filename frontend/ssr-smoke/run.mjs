// Runtime smoke test: renders the real App through the real route table and reports anything that
// throws or warns. Catches setup()/render errors that a production build cannot.
// Globals are installed before the bundle is imported, because the modules read them at load time.

// Minimal browser surface the app reads during setup/render.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}
globalThis.sessionStorage = { ...globalThis.localStorage }
globalThis.Storage = function Storage() {}
globalThis.window = globalThis
globalThis.document = { querySelector: () => null, createElement: () => ({ click() {} }) }
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
globalThis.fetch = async () => { throw new Error('offline smoke test') }
globalThis.URL.createObjectURL = () => 'blob:smoke'
globalThis.URL.revokeObjectURL = () => {}
globalThis.location = { host: 'localhost', pathname: '/', search: '', hash: '', href: 'http://localhost/' }
globalThis.history = { pushState() {}, replaceState() {}, state: null, go() {}, back() {}, forward() {} }
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}

const { render, renderLyrics, renderDock, probeDustClose, routePaths } = await import('./dist-ssr/entry.js')

// 路径来自真实路由表（见 entry.js 的 routePaths），新加页面会自动被覆盖。
const routes = routePaths

let failures = 0
for (const route of routes) {
  try {
    const { html, warnings } = await render(route)
    const bad = warnings.filter((w) => !/Hydration|__VUE_OPTIONS_API__|__VUE_PROD/.test(w))
    const ok = html.length > 400
    if (!ok || bad.length) failures += 1
    console.log(`${ok && !bad.length ? 'PASS' : 'FAIL'}  ${route.padEnd(15)} ${String(html.length).padStart(6)} bytes${bad.length ? '  warnings: ' + bad.join(' | ') : ''}`)
  } catch (error) {
    failures += 1
    console.log(`FAIL  ${route.padEnd(15)} threw: ${error.message}`)
  }
}

// ---------------------------------------------------------------- 组件分支
// 整页渲染走的是「什么都没选」的默认状态，歌词栏的高亮分支只有把 props 直接喂进去才走得到。
//
// 注意 Vue SSR 的 class 顺序：动态 class 排在静态 class 前面（`class="is-active lyric-line"`），
// 所以断言一律按「整个 class 列表里有没有这个词」来判断，不去比对固定的字符串顺序。
const classListOf = (html, selector) => {
  const match = html.match(new RegExp(`<[a-z]+ class="([^"]*${selector}[^"]*)"`))
  return match ? match[1].split(/\s+/) : []
}
const parsedLyrics = {
  lines: [{ time: 0, text: '第一句' }, { time: 5, text: '第二句' }, { time: 10, text: '第三句' }],
  synced: true, offset: 0, raw: '[00:00.00]第一句',
}
const cases = [
  {
    name: 'lyrics 当前句高亮',
    run: () => renderLyrics({ parsed: parsedLyrics, currentTime: 6, trackName: '测试曲目', source: 'lrclib' }),
    expect: (html) => {
      const active = html.match(/<p class="[^"]*is-active[^"]*"/g) || []
      if (active.length !== 1) throw new Error(`应有 1 行高亮，实际 ${active.length} 行`)
      // 高亮必须落在第二句上；错一句是这套逻辑最典型的 bug。
      const block = html.slice(html.indexOf('is-active') - 400, html.indexOf('is-active') + 400)
      if (!block.includes('第二句')) throw new Error('高亮的不是第二句')
      if (!html.includes('来自 LRCLIB 自动匹配')) throw new Error('没有显示歌词来源')
    },
  },
  {
    name: 'lyrics 解析中',
    run: () => renderLyrics({ parsed: null, loading: true, trackName: '测试曲目' }),
    expect: (html) => {
      if (!html.includes('正在为你找这首歌的歌词')) throw new Error('解析中状态没有提示')
      // 骨架行：等待期间右栏不能只有一句提示悬在中央
      if (!html.includes('lyrics-skeleton')) throw new Error('解析中没有骨架占位')
    },
  },
  {
    name: 'lyrics 没有歌词',
    run: () => renderLyrics({ parsed: null, loading: false, trackName: '测试曲目' }),
    expect: (html) => {
      if (!html.includes('这首歌还没有歌词')) throw new Error('空状态没有提示')
      if (!html.includes('粘贴 / 上传 LRC')) throw new Error('没有手动添加歌词的入口')
    },
  },
  {
    name: 'lyrics 纯文本（不假高亮）',
    run: () => renderLyrics({ parsed: { lines: [{ time: null, text: '甲' }, { time: null, text: '乙' }], synced: false, offset: 0, raw: '甲\n乙' }, currentTime: 30 }),
    expect: (html) => {
      if (!html.includes('lyrics-plain')) throw new Error('纯文本应走 lyrics-plain')
      if (html.includes('is-active')) throw new Error('没有时间轴时不该有高亮行')
    },
  },
  {
    name: 'dock 收起态且播放中',
    run: () => renderDock({ playing: true, title: '测试曲目', currentTime: 12, duration: 60, hasTrack: true }),
    expect: (html) => {
      if (!classListOf(html, 'music-dock is-').includes('is-collapsed')) throw new Error('默认应是收起态')
      if (!classListOf(html, 'music-dock-eq').includes('active')) throw new Error('播放时电平柱应是 active')
      if (!classListOf(html, 'music-dock-vinyl').includes('spinning')) throw new Error('播放时唱片应在旋转')
      if (!html.includes('0:12')) throw new Error('没有显示已播时长')
    },
  },
  {
    name: 'dock 暂停态不抖动',
    run: () => renderDock({ playing: false, title: '测试曲目', currentTime: 0, duration: 60, hasTrack: true }),
    expect: (html) => {
      if (classListOf(html, 'music-dock-vinyl').includes('spinning')) throw new Error('暂停时唱片不该再转')
      if (classListOf(html, 'music-dock-eq').includes('active')) throw new Error('暂停时电平柱不该跳')
    },
  },
  {
    name: 'dock 未选曲目时切歌按钮禁用',
    run: () => renderDock({ playing: false, title: '', currentTime: 0, duration: 0, hasTrack: false }),
    expect: (html) => {
      if (!html.includes('未选择曲目')) throw new Error('没有显示未选曲目的文案')
      if ((html.match(/disabled/g) || []).length < 2) throw new Error('上一首 / 下一首应当被禁用')
    },
  },
]

for (const item of cases) {
  try {
    const { html, warnings } = await item.run()
    const bad = warnings.filter((w) => !/Hydration|__VUE_OPTIONS_API__|__VUE_PROD/.test(w))
    if (bad.length) throw new Error('warnings: ' + bad.join(' | '))
    item.expect(html)
    console.log(`PASS  ${item.name}`)
  } catch (error) {
    failures += 1
    console.log(`FAIL  ${item.name}  ${error.message}`)
  }
}

// ---------------------------------------------------------------- 关闭动效（不是渲染）
// 「化作尘埃」只在用户点关闭时才跑，整页渲染和组件渲染都碰不到它。这里真的调一次。
//
// 为什么值得单独一条：它抛错时的症状是「点了关闭没反应」，页面上什么都不显示，
// 只有控制台里一行 TypeError。上线过一次——`useDustClose` 里 import 进来的 `motion`
// 被同名的参数遮住了，日记和全屏看图两条关闭路径一起废掉。
try {
  const report = await probeDustClose()
  const problems = []
  if (report.error) problems.push(`requestClose 抛错：${report.error}`)
  if (!report.closing) problems.push('没有进入消散状态（动效不会播）')
  if (report.closedImmediately) problems.push('没等动效播完就通知关闭了')
  if (!report.dustRect || report.dustRect.width !== 800 || report.dustRect.left !== 12) {
    problems.push(`粒子没有按目标元素的真实位置铺开：${JSON.stringify(report.dustRect)}`)
  }
  if (report.count < 200) problems.push(`粒子太少（${report.count}），会看不出是「尘埃」`)
  if (problems.length) throw new Error(problems.join('；'))
  console.log(`PASS  dust close  ${report.count} 颗粒子，${report.ms}ms 后关闭`)
} catch (error) {
  failures += 1
  console.log(`FAIL  dust close  ${error.message}`)
}

console.log(failures === 0
  ? `\nAll ${routes.length} routes + ${cases.length} component branches + 1 close-animation probe passed.`
  : `\n${failures} of ${routes.length + cases.length + 1} checks failed.`)
// 显式退出：SSR 之后还挂着 supabase 之类的句柄，不主动退的话脚本会在打印完结果后一直不结束。
process.exit(failures ? 1 : 0)
