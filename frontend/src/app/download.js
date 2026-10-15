// 触发一次浏览器下载。文本类导出（日记 TXT）走这里，别在每个调用点重复一遍 a 标签那套。
export function downloadText(text, name) {
  const link = document.createElement('a')
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
  link.href = url
  link.download = name
  link.click()
  // Revoking in the same task can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
