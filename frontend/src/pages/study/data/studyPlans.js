// 学习计划库。每一项是一份「可以独立开始学」的计划。
//
// 加一份新计划需要什么，见同目录 README.md。页面只认这一份数组：
// 有 id / name / 一段说明，加 plan（结构见 studyPlan.js）。
import { studyPlan as finance } from './studyPlan'

export const studyPlans = [
  {
    id: 'finance',
    name: '金融学系统自学路线',
    short: '金融学',
    note: '从本科基础到博士研究训练，29 门课、5 个阶段。',
    plan: finance,
  },
]
