// 「数据重置」：换月或填错时只清当月数据，不动名单结构。
//
// 这一组动作原来直接写在 PerfPage.vue 里（+67 行）。抽出来有两个理由：
//   1. 这一页的惯例就是「一组一起用的逻辑放 composables/」（见同目录 README）；
//   2. 抽出来之后 verify-perf.mjs 能直接对拍。**「该清的清了、该保留的还留着」是这段代码
//      唯一有风险的地方**（清多了会丢数据、清少了没效果），埋在 SFC 里就只能靠肉眼看。
//
// 约定（和同目录其它 composable 一致）：只接收 ref，不接收裸值——否则父级重新求值
// （例如套用云端数据时 `members.value` 被整个换掉）之后这里会读到旧引用。
//
// 为什么是两个「三薪」按钮而不是一个：**「三薪」在两个地方各存一份，别混为一谈**
//   · 名单里的 member.tripleHours —— 三薪时长，按 62 元/小时直接算钱
//   · 明细里的 entry.tripleCount  —— 三薪日那天的审核量，要从计件量里扣掉（否则同一批活付两次）
//
// 所有「重置员工数据」的动作都遵循同一条：**保留姓名、邮箱、队列归属**。
// 清的是「当月干了多少活」，不是「这个人是谁」——所以换月不用重新加人、重新对队列。
//
// 实际 AHT（`entry.actualAht`）**要一起清零**：它是这个月在这条队列上测出来的平均处理时长，
// 属于当月数据；留着的话新月份会拿上个月的手速去算工时，工资会偏。（这一条改过一次——
// 最初写成「保留实际 AHT，因为它是单价口径」，那是错的：单价由队列 KPI 推，与这个字段无关。）
//
// 全部不可撤销，所以每个动作都先确认一次，并把「会清什么 / 保留什么」写进提示里。

/** 名单里那三个「按月重填」的小时数。 */
const HOUR_FIELDS = ['transferHours', 'overtimeHours', 'tripleHours']

const memberLabel = (member) => member?.name || member?.email || '这位员工'

/** 默认确认框。渲染测试里没有 `window`，这时直接放行——没有点击，也就不会真的重置。 */
const defaultConfirm = (message) => typeof globalThis.window === 'undefined' || Boolean(globalThis.window.confirm(message))

/**
 * @param {object} options
 * @param {import('vue').Ref<Array>} options.members  员工名单（就地修改）
 * @param {import('vue').Ref<Array>} options.entries  队列明细（就地修改）
 * @param {(message: string) => boolean} [options.confirm]  替换确认框，测试用
 * @returns 四个重置动作；每个都返回「是否真的执行了」（取消 / 没数据 / 找不到人时为 false）
 */
export function usePerfReset({ members, entries, confirm = defaultConfirm }) {
  /** 清掉某位员工所有队列里属于「当月」的录入数据：实际 AHT、审核量、其中三薪日。 */
  function zeroEntryCounts(memberId) {
    for (const entry of entries.value) {
      if (entry.memberId !== memberId) continue
      entry.actualAht = 0
      entry.auditCount = 0
      entry.tripleCount = 0
    }
  }

  /** 员工名单里那一行的「↺」：清抽调/加班/三薪时长，外加他所有队列的实际 AHT、审核量与其中三薪日。 */
  function resetMemberData(id) {
    const member = members.value.find((m) => m.id === id)
    if (!member) return false
    if (!confirm(`重置「${memberLabel(member)}」的数据？\n\n清空：抽调时长、加班时长、三薪时长，以及他在所有队列里的实际 AHT、审核量、其中三薪日。\n保留：姓名、邮箱、队列归属。`)) return false
    for (const field of HOUR_FIELDS) member[field] = 0
    zeroEntryCounts(id)
    return true
  }

  /** 「重置全部员工数据」：上面那件事对所有人做一遍，员工名单本身不动。 */
  function resetAllMemberData() {
    if (!members.value.length) return false
    if (!confirm(`重置全部 ${members.value.length} 位员工的数据？\n\n清空：每个人的抽调/加班/三薪时长，以及所有队列里的实际 AHT、审核量、其中三薪日。\n保留：员工名单、队列 KPI。`)) return false
    for (const member of members.value) {
      for (const field of HOUR_FIELDS) member[field] = 0
      zeroEntryCounts(member.id)
    }
    return true
  }

  /** 「重置抽调/加班/三薪时长」：只动名单里那三个小时数，队列里的录入数据一概不碰。 */
  function resetExtraHours() {
    if (!members.value.length) return false
    if (!confirm(`把全部 ${members.value.length} 个人的抽调、加班、三薪时长清零？\n\n队列里的实际 AHT、审核量、其中三薪日都不受影响。`)) return false
    for (const member of members.value) for (const field of HOUR_FIELDS) member[field] = 0
    return true
  }

  /**
   * 「重置三薪审核量」：只清三薪日那天的审核量，审核量本身保持不动。
   * 清掉之后这部分工作量会回到计件里，所以提示里要说清楚钱会怎么变。
   *
   * 一个都没填过时直接返回 false、**不弹确认框**，省得用户以为自己漏点了什么。
   */
  function resetMemberTripleCount(id) {
    const member = members.value.find((m) => m.id === id)
    if (!member) return false
    const hit = entries.value.filter((e) => e.memberId === id && Number(e.tripleCount)).length
    if (!hit) return false
    if (!confirm(`把「${memberLabel(member)}」在 ${hit} 个队列里的「其中三薪日」审核量清零？\n\n审核量不变，计件量会随之变多；三薪那部分钱改由「三薪时长 × 62」计算。`)) return false
    for (const entry of entries.value) if (entry.memberId === id) entry.tripleCount = 0
    return true
  }

  return { resetMemberData, resetAllMemberData, resetExtraHours, resetMemberTripleCount }
}
