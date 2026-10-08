import fs from 'node:fs'
const f = 'frontend/src/PerfPanel.vue'
let s = fs.readFileSync(f, 'utf8')
const old = `watch(tab, (now) => {
  if (typeof document === 'undefined') return
  if (now === 'import') document.addEventListener('paste', handlePaste)
  else document.removeEventListener('paste', handlePaste)
}, { immediate: true })

onMounted(pullWorkspace)`
const neu = `// 注意：这个 watch 在 tab 声明之前，不能 immediate —— 会撞上暂时性死区。
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
if (!s.includes(old)) { console.log('ANCHOR MISSING'); process.exit(1) }
fs.writeFileSync(f, s.replace(old, neu), 'utf8')
console.log('已改为挂载时注册')
