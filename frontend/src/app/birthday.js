// 「在这个世界的第 N 天」的唯一来源。
//
// 生日是**农历** 2002 年九月廿二，换算成公历是 **2002-10-27**（两个日历站互证）。
// 以前这个数字在首页两处各写了一遍 `128 + 日记数`（夜里那套和白天那套），
// 所以改了一处、另一处还显示旧值——站主看到的就是「出生的计算也没有」。
// 现在两个页面都从这里取，别再各算各的。
export const BIRTH_DATE = new Date(2002, 9, 27)
export const BIRTH_LABEL = '2002.10.27'

/** 出生当天算第 1 天，按自然日差计算（不掐时分秒，避免跨时区差一天）。 */
export function daysSinceBirth(now = new Date()) {
  const start = new Date(BIRTH_DATE.getFullYear(), BIRTH_DATE.getMonth(), BIRTH_DATE.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.floor((today - start) / 86400000) + 1
}
