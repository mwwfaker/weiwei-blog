// 加一个页面：建目录 + 写骨架 + 同时改三处注册点，最后自己验证一遍。
//
// 为什么要脚本：#1「一个页面一个文件夹」这条约定要求同时改 routes.js / pageRegistry.js /
// navigation.js，漏一处页面就是死的（点导航抛错、或者地址能进但菜单里没有）。
// 靠人记三处一定会漏，所以做成一条命令。
//
// 用法（在 frontend/ 下）：
//   npm run new:page -- notes "随手记"
//   npm run new:page -- stats "数据看板" --primary --icon ◈
//
// 只用 Node 内置模块——自检与工具脚本都不引依赖（见 AGENTS.md 第五节）。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url)) // frontend/
const srcDir = path.join(root, 'src')

const die = (msg) => { console.error(`\n✗ ${msg}\n`); process.exit(1) }
const ok = (msg) => console.log(`  ✓ ${msg}`)

// ---------------------------------------------------------------- 参数
const argv = process.argv.slice(2)
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const positional = argv.filter((a) => !a.startsWith('--'))
const [id, label, ...rest] = positional
const iconIndex = argv.indexOf('--icon')
const icon = iconIndex >= 0 ? argv[iconIndex + 1] : '·'
const primary = flags.has('--primary')

if (!id || !label) {
  die(`用法：npm run new:page -- <页面 id> "中文导航标题" [--primary] [--icon ◈]

  页面 id  小写字母开头，只能含小写字母、数字和连字符，例如 notes、data-board
  标题     会出现在侧边栏和面包屑上
  --primary  加到主导航（默认加到「更多」菜单里）
  --icon     导航图标，默认 ·`)
}
if (rest.length) die(`多余的参数：${rest.join(' ')}`)
if (!/^[a-z][a-z0-9-]*$/.test(id)) die(`页面 id 不合法：${id}\n只能用 [a-z0-9-]，且必须以字母开头。`)
if (id === 'publicDiary') die('publicDiary 是保留名（老地址 #/public-diary 的兼容路由）。')

const pascal = id.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('') + 'Page'
const dir = path.join(srcDir, 'pages', id)
const routesPath = path.join(srcDir, 'app/routes.js')
const registryPath = path.join(srcDir, 'app/pageRegistry.js')
const navPath = path.join(srcDir, 'app/navigation.js')

// ---------------------------------------------------------------- 先检查冲突
for (const f of [routesPath, registryPath, navPath]) {
  if (!fs.existsSync(f)) die(`找不到 ${path.relative(root, f)}，确定在 frontend/ 下运行吗？`)
}
if (fs.existsSync(dir)) die(`目录已存在：${path.relative(root, dir)}`)
for (const [f, re] of [[routesPath, new RegExp(`name:\\s*'${id}'`)], [registryPath, new RegExp(`^\\s*${id}:`, 'm')]]) {
  if (re.test(fs.readFileSync(f, 'utf8'))) die(`页面 id 已被占用：${id}（见 ${path.relative(root, f)}）`)
}

console.log(`\n新建页面：${id}  →  pages/${id}/${pascal}.vue\n`)

// ---------------------------------------------------------------- 1. 写目录
fs.mkdirSync(dir, { recursive: true })

fs.writeFileSync(path.join(dir, `${pascal}.vue`), `<script setup>
// ${label}。只做编排：数据从 store 拿、动作调 store 的方法。
//
// 待办：接上真正的数据来源。把下面两行注释换掉，并删掉这段说明。
// import { useXxxStore } from '@/stores/xxx'
// const xxx = useXxxStore()
import InnerPageHeader from '@/modules/page/InnerPageHeader.vue'
</script>

<template>
  <section class="page-content inner-page">
    <InnerPageHeader
      kicker="SECTION KICKER"
      title="${label}"
      mark="✧"
      subtitle="一句话说明这个页面是干什么的。"
    />

    <!-- 页面内容。只在这一页用的板块放 ./components/，两个以上页面要用的放 @/modules/。 -->
  </section>
</template>
`, 'utf8')
ok(`pages/${id}/${pascal}.vue`)

fs.writeFileSync(path.join(dir, 'README.md'), `# ${label}

路由 \`/${id}\`。

## 这个页面是干什么的

（一句话。写完删掉这行提示。）

## 状态从哪来

| 界面元素 | 来源 |
| --- | --- |
| | |

## 文件

| 文件 | 内容 |
| --- | --- |
| \`${pascal}.vue\` | 页面本体：编排，不写业务逻辑 |

## 需要注意的地方

（踩过的坑、不能随手改的实现约束。没有就删掉这一节。）

## 待办

- [ ] 接上真实的数据来源
`, 'utf8')
ok(`pages/${id}/README.md`)

// ---------------------------------------------------------------- 2. 改 routes.js
{
  const before = fs.readFileSync(routesPath, 'utf8')
  const anchor = "  { path: '/:pathMatch(.*)*', redirect: '/' },"
  if (!before.includes(anchor)) die('routes.js 里找不到 catch-all 那一行，手工加一下路由。')
  const after = before.replace(anchor, `  { path: '/${id}', name: '${id}', component: NoopView },\n${anchor}`)
  fs.writeFileSync(routesPath, after, 'utf8')
  assertPatched(routesPath, `name: '${id}'`, before)
  ok('app/routes.js')
}

// ---------------------------------------------------------------- 3. 改 pageRegistry.js
{
  const before = fs.readFileSync(registryPath, 'utf8')

  // import 按路径字母序插入，保持文件一直是排好序的。
  const importLines = [...before.matchAll(/^import\s+\w+\s+from\s+'@\/pages\/([^/]+)\//gm)]
  if (!importLines.length) die('pageRegistry.js 里没有找到任何 @/pages/ 的 import。')
  const mine = `import ${pascal} from '@/pages/${id}/${pascal}.vue'`
  // 插到第一个「文件夹名比它大」的 import 前面；都比它小就插到最后一个后面。
  const next = importLines.find((m) => m[1] > id)
  let afterImports
  if (next) {
    afterImports = before.slice(0, next.index) + mine + '\n' + before.slice(next.index)
  } else {
    const last = importLines[importLines.length - 1]
    const insertAt = last.index + last[0].length
    afterImports = before.slice(0, insertAt) + '\n' + mine + before.slice(insertAt)
  }

  // pageComponents 里加一条（放在对象末尾）。
  // 带连字符的 id 不是合法标识符，必须加引号——写成 `smoke-test: X` 是语法错误，
  // 构建会直接挂掉（这个坑是生成器第一次跑的时候被 verify 抓出来的）。
  const key = /^[A-Za-z_$][\w$]*$/.test(id) ? id : `'${id}'`
  const mapRe = /(export const pageComponents = \{[\s\S]*?)(\n\})/
  if (!mapRe.test(afterImports)) die('pageRegistry.js 里找不到 pageComponents 对象。')
  const patched = afterImports.replace(mapRe, `$1\n  ${key}: ${pascal},$2`)

  fs.writeFileSync(registryPath, patched, 'utf8')
  assertPatched(registryPath, `${key}: ${pascal},`, before)
  assertPatched(registryPath, mine, before)
  ok('app/pageRegistry.js')
}

// ---------------------------------------------------------------- 4. 改 navigation.js
{
  const before = fs.readFileSync(navPath, 'utf8')
  const arrayName = primary ? 'navigation' : 'secondaryNavigation'
  const re = new RegExp(`(export const ${arrayName} = \\[[\\s\\S]*?)(\\n\\])`)
  if (!re.test(before)) die(`navigation.js 里找不到 ${arrayName} 数组。`)
  const after = before.replace(re, `$1\n  { id: '${id}', label: '${label}', icon: '${icon}' },$2`)
  fs.writeFileSync(navPath, after, 'utf8')
  assertPatched(navPath, `id: '${id}'`, before)
  ok(`app/navigation.js（加到 ${primary ? '主导航' : '「更多」菜单'}）`)
}

// ---------------------------------------------------------------- 5. 自己验证一遍
function assertPatched(file, needle, before) {
  const after = fs.readFileSync(file, 'utf8')
  if (!after.includes(needle)) die(`${path.relative(root, file)} 里没写进去：${needle}`)
  const braces = (s) => (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length
  if (braces(after) !== braces(before)) die(`${path.relative(root, file)} 花括号不配平了，请 git checkout 后重来。`)
}

console.log(`
下一步：
  1. cd frontend && npm run verify        ← 第 [3] 项会确认三处注册点一致
  2. 编辑 src/pages/${id}/${pascal}.vue 填内容
  3. 需要页面专属板块时建 src/pages/${id}/components/ 并配一份 README.md

注意：src/pages/${id}/ 这个文件夹、以及它下面的每个子目录，都必须有 README.md，
     否则 npm run verify 会红（第 [8] 项）。
`)
