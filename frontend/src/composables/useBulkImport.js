// 批量导入的共用状态机。
//
// 为什么抽出来：日记和文章的导入流程**一模一样**——把文件解析成一批草稿 → 让人逐条核对、
// 统一设置 → 确认后逐条写库，写入期间禁用按钮、用 allSettled 保住已经写成功的那些。
// 抄第二遍就是两份要同步维护的代码，改动一处另一处必然漏。
//
// 边界：这个文件只管「一批草稿」这件事。**解析文件不在里面**（docx/txt 的读法两边不同，
// 而且只有浏览器里能做），调用方解析完把草稿交给 `setReview` 即可。
import { ref } from 'vue'
import { notify } from '@/app/useToast'
import { requireLogin } from '@/app/useGuard'

/**
 * @param {object} options
 * @param {string} options.label   权限提示与完成通知里用的名字，如「导入日记」
 * @param {(entry: object) => Promise<object>} options.save  单条写库，返回服务端记录
 * @param {(count: number) => string} [options.doneMessage]  成功时的通知文案
 * @param {string} [options.initialVisibility]  统一可见范围的初值（日记跟着个人默认设置走）
 */
export function useBulkImport({ label, save, doneMessage, initialVisibility = 'PUBLIC' }) {
  /** 待确认的草稿。关掉弹窗不会丢——它留在这里，重新打开还在。 */
  const review = ref([])
  /** 统一可见范围，新解析出来的草稿都先按它填。写成响应式是为了让按钮显示当前选的是哪个。 */
  const visibility = ref(initialVisibility === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC')
  const dialog = ref(false)
  const importing = ref(false)
  const saved = ref(0)

  function setReview(entries) {
    review.value = entries
    saved.value = 0
    dialog.value = true
  }

  function drop(id) {
    review.value = review.value.filter((entry) => entry.id !== id)
  }

  /** 统一设置：一次把每一条的同一个字段写成同一个值。 */
  function applyField(field, value) {
    for (const entry of review.value) entry[field] = Array.isArray(value) ? [...value] : value
  }

  function applyVisibility(value) {
    visibility.value = value === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE'
    applyField('visibility', visibility.value)
  }

  /** 单条切换，和「统一设置」并存：先统一，再挑几条单独改。 */
  function toggleVisibility(entry) {
    if (!entry) return
    entry.visibility = entry.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'
  }

  /**
   * 逐条写库。返回 `{ saved, failed }`，调用方负责把 saved 并进自己的列表。
   * 写入期间**必须挡住重复点击**：一次点击会发几十个请求，能再点一下就会存进两份。
   */
  async function confirm() {
    const drafts = review.value
    if (!drafts.length || importing.value) return { saved: [], failed: [] }
    if (!requireLogin(label)) return { saved: [], failed: [] }
    importing.value = true
    saved.value = 0
    let results = []
    try {
      // allSettled，不是 all：一条失败不能连累服务端已经收下的那些，
      // 否则重试这个弹窗就会把它们再插一遍。
      results = await Promise.allSettled(drafts.map(async (entry) => {
        const record = await save(entry)
        saved.value += 1
        return record
      }))
    } finally {
      // 一定要复位：不然一次网络异常就会让按钮永久卡在「保存中」。
      importing.value = false
    }
    const ok = results.filter((result) => result.status === 'fulfilled').map((result) => result.value)
    const failed = results.filter((result) => result.status === 'rejected')
    // 只留下失败的那些，用户可以直接重试，不会丢掉内容
    review.value = drafts.filter((entry, index) => results[index].status === 'rejected')
    if (failed.length) {
      notify(`已导入 ${ok.length} 条，${failed.length} 条失败：${failed[0].reason?.message || ''}`)
    } else {
      dialog.value = false
      notify(doneMessage ? doneMessage(drafts.length) : `已导入 ${drafts.length} 条`)
    }
    return { saved: ok, failed }
  }

  return {
    review, visibility, dialog, importing, saved,
    setReview, drop, applyField, applyVisibility, toggleVisibility, confirm,
  }
}
