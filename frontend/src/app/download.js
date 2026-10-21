// 触发一次浏览器下载。文本类导出（日记 TXT、绩效 HTML）走这里，
// 别在每个调用点重复一遍 a 标签那套。
// `mime` 决定浏览器认成什么：给 .html 用 text/plain 会变成「查看纯文本源码」。
export function downloadText(text, name, mime = 'text/plain;charset=utf-8') {
  const link = document.createElement('a')
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  link.href = url
  link.download = name
  link.click()
  // Revoking in the same task can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
