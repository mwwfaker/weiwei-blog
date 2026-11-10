// 《高性价比人生指南》—— 数据来自 GitHub 上的 eternity4719/HowToLiveBetter（7 万+ star）。
//
// 结构：**34 章全部收录**，一章一门课；每门课的「核心知识点」就是这一章里**所有条目的标题**
// （772 条，一条不落）。点开「读这一章全文」会按需加载 ./life/chNN.js——那里是逐条原文
// （成本 / 说人话 / 收益 / 证据等级 / 来源 / 备注），没有改写。
//
// 为什么标题放索引、原文按需加载：34 章原文合计 2.3 MB，一次性塞进学习页会把整页拖死；
// 索引只有一百来 KB，展开阅读时再单独取一章。
import { lifeChapters, lifeRepoRaw, lifeSource } from './lifeIndex'

/** 章 → 阶段。34 章分六组：先保命，再省精力、省钱，然后才是法律、人生大事和事业。 */
const STAGE_OF = {
  'ch01': 's0', 'ch02': 's0', 'ch13': 's0', 'ch16': 's0', 'ch17': 's0', 'ch24': 's0', 'ch34': 's0',
  'ch03': 's1', 'ch04': 's1', 'ch22': 's1', 'ch28': 's1',
  'ch05': 's2', 'ch06': 's2', 'ch07': 's2', 'ch15': 's2',
  'ch08': 's3', 'ch09': 's3', 'ch11': 's3', 'ch14': 's3',
  'ch10': 's4', 'ch18': 's4', 'ch20': 's4', 'ch25': 's4', 'ch27': 's4',
  'ch29': 's4', 'ch30': 's4', 'ch31': 's4', 'ch32': 's4', 'ch33': 's4',
  'ch12': 's5', 'ch19': 's5', 'ch21': 's5', 'ch23': 's5', 'ch26': 's5',
}

const stages = [
  { id: 's0', index: '0', equivalent: '保命', goal: '先别早死、也别慢慢死', duration: '先读这一组', summary: '这一组是全书的地基：什么会让人早死、什么在慢慢磨损身体、急症怎么办、慢性病和家里老人怎么管、药怎么吃不出事。它不产生收益，但挡掉的是不可逆的损失，所以排在最前面。' },
  { id: 's1', index: '1', equivalent: '精力', goal: '精力、时间与情绪别被白白吃掉', duration: '第 1–2 周', summary: '同样的时间，有人做成了事、有人只是累了。这一组管的是注意力怎么被切碎、拖延怎么破、什么时候该停下来恢复。' },
  { id: 's2', index: '2', equivalent: '钱', goal: '不浪费钱，也别在没钱时做错决定', duration: '第 2–4 周', summary: '先看钱是怎么被日常消耗掉的，再看真没钱的时候哪些动作能救命、哪些是陷阱。买房租房单独一章，因为那是大多数人最大的一笔支出。' },
  { id: 's3', index: '3', equivalent: '风险', goal: '法律红线、信息安全和「别把自己搭进去」', duration: '第 4–6 周', summary: '普通人最容易踩的坑往往不是投资亏钱，而是签字、担保、账号、兼职和技术上的红线。这一组的目标是：别因为一个决定把后面十年赔进去。' },
  { id: 's4', index: '4', equivalent: '人生', goal: '恋爱、婚育、孩子、意外与身后事', duration: '第 6–9 周', summary: '这些是人生里金额最大、最难反悔的决定。书里对每一件都算了成本收益和证据等级——不是劝你做或不做，而是让你知道自己在为什么付钱。' },
  { id: 's5', index: '5', equivalent: '事业', goal: '学什么技能、做什么生意、怎么不吃劳动的亏', duration: '第 9–12 周', summary: '最后一组是「怎么把时间换成钱」：哪些技能回报高、做平台要办哪些证、打工时哪些权利是法定的、出国怎么不踩坑。' },
]

const criteria = [
  '这一章的条目不用全做：先挑 3 条与你现在处境相符的，写下来本周怎么执行。',
  '每条都标了成本、收益和证据等级；证据等级 C 的先当参考，别当定论。',
  '做过一轮之后回来看一遍，把不适用你情况的划掉，剩下的才是个人的清单。',
]

const hoursOf = (count) => {
  const minutes = count * 4
  if (minutes < 60) return `约 ${minutes} 分钟`
  return `约 ${Math.round(minutes / 60)} 小时`
}

const courses = lifeChapters
  .filter((chapter) => STAGE_OF[chapter.id])
  .map((chapter) => {
    const stage = stages.find((item) => item.id === STAGE_OF[chapter.id])
    return {
      code: `L${String(chapter.no).padStart(2, '0')}`,
      name: chapter.title,
      stageLabel: stage.equivalent,
      importance: stage.id === 's0' || stage.id === 's2' || stage.id === 's3' ? 5 : 4,
      hoursText: `${hoursOf(chapter.count)}（${chapter.count} 条）`,
      prerequisite: stage.index === '0' ? '无，从这里开始' : stages[Number(stage.index) - 1].equivalent,
      concepts: chapter.titles,
      criteria,
      practice: `从本章 ${chapter.count} 条里挑 3 条，写下「我这周具体怎么做、花多少钱和时间、怎么算做到了」。`,
      resources: [
        { title: `原文这一章（GitHub · 高性价比人生指南）`, url: `${lifeRepoRaw}/${chapter.file}` },
        { title: '全书仓库（含引用对照与核实记录）', url: lifeSource },
      ],
      chapter: chapter.id,
    }
  })

export const studyPlan = {
  meta: {
    title: '高性价比人生指南',
    subtitle: '把人生当系统来运维：34 章、772 条，每条都写明成本、收益和证据等级',
    tags: ['循证', '成本收益', '只引论文与官方文件', '772 条全收录'],
    corePrinciple: '这份计划来自 GitHub 上很火的《高性价比人生指南》（eternity4719/HowToLiveBetter）。它的方法论只有一句：把每个决定当作一笔投资来算——花多少成本、换回什么收益、证据有多硬。本页收录全部 34 章、772 条条目的标题，点开任一章可以读逐条原文（成本 / 说人话 / 收益 / 证据等级 / 来源 / 备注）。它不是让你照做的人生答案，而是一份「知道自己在为什么付钱」的清单。',
    version: '版本：2026-11-10 ｜ 内容来自 GitHub eternity4719/HowToLiveBetter，逐条转换未改写',
    // 这本书按「书」排版：左目录、右正文，不套课程卡那一套。
    layout: 'book',
  },
  howToUse: [
    '按阶段顺序读，不要跳着从「钱」开始：第 0 组（保命）挡掉的是不可逆的损失，性价比最高。',
    '每章先看条目标题，挑 3 条和眼下处境相关的，点开读全文的成本、收益和证据等级。',
    '证据等级 A 才适合当结论用；B 是单项研究或汇总，C 只是方向性提示，别当定论。',
    '每周只推进 1–2 章。这本书的信息密度很高，读太快等于没读。',
    '读完一章回来，把不适用你情况的条目划掉——最后留下的是你自己的清单，不是作者的。',
  ],
  importanceScale: [
    { mark: '★★★★★', stars: 5, name: '先做', strategy: '保命、省钱、法律风险这三组——做错一次可能不可逆，所以先看。' },
    { mark: '★★★★☆', stars: 4, name: '值得排期', strategy: '精力管理、人生大事、事业技能——影响大，但晚两周开始不会出事。' },
    { mark: '★★★☆☆', stars: 3, name: '按需查', strategy: '具体场景（出国留学、残疾之后、家里有老人）——遇到再看对应那一章。' },
  ],
  stages,
  courses,
  weeklyNote: '每周 4–6 小时：读 1–2 章 + 挑 3 条落地。全书 772 条，不需要一次读完。',
  // 全文按需加载用的目录键：'./life/ch01.js' → import()
  bookChapters: lifeChapters.map((chapter) => ({ id: chapter.id, no: chapter.no, title: chapter.title, count: chapter.count })),
  totalItems: lifeChapters.reduce((sum, chapter) => sum + chapter.count, 0),
  totalChapters: lifeChapters.length,
}
