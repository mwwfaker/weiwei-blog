import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const old = `// 注意：这个 watch 在 tab 声明之前，不能 immediate —— 会撞上暂时性死区。
// 初次注册放在 onMounted 里（那时 setup 已经跑完，tab 已初始化）。
watch(tab, (now) => {
  if (typeof document === 'undefined') return
  if (now === 'import') document.addEventListener('paste', handlePaste)
  else document.removeEventListener('paste', handlePaste)
})

onMounted(() => {
  pullWorkspace()
  if (typeof document !== 'undefined' && tab.value === 'import') document.addEventListener('paste', handlePaste)
})`
const neu = `// 这里在 tab 声明之前，连 watch(tab, …) 都不能写（传引用就会撞上暂时性死区）。
// 所以只注册一次监听，在回调里判断当前是不是「导入截图」页。
onMounted(() => {
  pullWorkspace()
  if (typeof document !== 'undefined') document.addEventListener('paste', handlePaste)
})`
if (!s.includes(old)) { console.log('WATCH ANCHOR MISSING'); process.exit(1) }
s = s.replace(old, neu)

// 回调里加一个「只在导入页生效」的判断
const oldPaste = `function handlePaste(event) {
  const data = event.clipboardData
  if (!data) return`
const newPaste = `function handlePaste(event) {
  // 只在「导入截图」页生效，免得在别处 Ctrl+V 被吃掉
  if (tab.value !== 'import') return
  const data = event.clipboardData
  if (!data) return`
if (!s.includes(oldPaste)) { console.log('PASTE ANCHOR MISSING'); process.exit(1) }
s = s.replace(oldPaste, newPaste)

fs.writeFileSync(f, s, 'utf8')
console.log('已改成单次注册 + 回调内判断')
