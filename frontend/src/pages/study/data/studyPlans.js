// 学习计划库。每一项是一份「可以独立开始学」的计划。
//
// 加一份新计划需要什么，见同目录 README.md。页面只认这一份数组：
// 有 id / name / 一段说明，加 plan（结构见 studyPlan.js）。
import { studyPlan as finance } from './studyPlan'
import { studyPlan as financeOptimized } from './financeOptimizedPlan'
import { studyPlan as life } from './lifePlan'
import { studyPlan as scarf } from './scarfPlan'

export const studyPlans = [
  {
    id: 'finance',
    name: '金融学系统自学路线',
    short: '金融学',
    note: '从本科基础到博士研究训练，29 门课、5 个阶段。',
    unit: '门课程',
    plan: finance,
  },
  {
    id: 'finance-priority',
    name: '基金与股票优先的金融学习路线',
    short: '基金股票',
    note: '先实用后理论：12 周主线 10 门课 + 3 门必要基础，每门课都要做输出。',
    unit: '门课程',
    plan: financeOptimized,
  },
  {
    id: 'life',
    name: '高性价比人生指南',
    short: '人生指南',
    note: '把人生当系统来运维：34 章、772 条，逐条写明成本、收益与证据等级。',
    unit: '章',
    plan: life,
  },
  {
    id: 'scarf',
    name: '围巾编织学习大全',
    short: '围巾编织',
    note: '从选线、起针到花样、流苏与成品整理，17 个单元、6 个阶段。',
    unit: '个单元',
    plan: scarf,
  },
]
