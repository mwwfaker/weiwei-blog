// 金融学系统自学路线 —— 数据来自《金融学系统自学路线_大学到博士阶段.docx》
// 由文档结构化而来（29 门课 / 5 个阶段），页面只负责呈现，不在这里改写内容。
export const studyPlan = {
  "meta": {
    "title": "金融学系统自学路线",
    "subtitle": "从本科基础 → 金融硕士 → 博士研究训练",
    "tags": [
      "视频优先",
      "不以读书为主",
      "课程化学习",
      "配套实战"
    ],
    "corePrinciple": "这份计划的核心原则 不追求“看过很多财经视频”，而追求形成一套可以解释现实市场的金融知识体系：经济学 → 会计 → 金融市场 → 公司金融 → 投资学 → 资产定价 → 计量 → 宏观金融 → 博士研究。",
    "version": "版本：2026-09-25  ｜  在线课程资源已按公开网页可访问性做核验"
  },
  "howToUse": [
    "把自己当成“非全日制金融学生”：每周 8–12 小时，工作日以视频为主，周末做题/实战。",
    "每门课只设置一个主线资源，避免同时追十几个老师。辅助资源只用于补理解，不用于替代主课。",
    "视频不是终点。每门课都要求至少完成“过关标准”，核心课程再做一个小型实战项目。",
    "不要求你系统读教材。课程讲义、习题、考试题、数据和论文属于工具，不把“通读书本”设为硬任务。",
    "阶段之间不是以“看完视频”作为毕业条件，而是以“能不能自己解释、计算、应用”作为标准。"
  ],
  "importanceScale": [
    {
      "mark": "★★★★★",
      "stars": 5,
      "name": "核心必修",
      "strategy": "认真听、做题、实战；缺这门会影响后面很多课程。"
    },
    {
      "mark": "★★★★☆",
      "stars": 4,
      "name": "重要进阶",
      "strategy": "认真学；掌握主要模型与直觉。"
    },
    {
      "mark": "★★★☆☆",
      "stars": 3,
      "name": "方向课",
      "strategy": "根据自己的方向深入，不必过度投入。"
    },
    {
      "mark": "★★☆☆☆",
      "stars": 2,
      "name": "补充课",
      "strategy": "遇到具体问题再学。"
    },
    {
      "mark": "★☆☆☆☆",
      "stars": 1,
      "name": "兴趣课",
      "strategy": "不属于主线。"
    }
  ],
  "stages": [
    {
      "id": "stage-0",
      "index": "0",
      "equivalent": "金融预科",
      "goal": "金融地图+数学统计+会计",
      "duration": "3–5个月",
      "coreCourses": [
        "金融学",
        "微观",
        "宏观",
        "会计",
        "统计",
        "微积分"
      ],
      "summary": "这一阶段的目标不是“成为金融专家”，而是把金融语言、经济学直觉、报表语言和数量工具搭起来。完成后再进入正式金融核心课，理解速度会明显提高。"
    },
    {
      "id": "stage-1",
      "index": "1",
      "equivalent": "本科核心",
      "goal": "金融市场+公司金融+投资",
      "duration": "5–8个月",
      "coreCourses": [
        "货币银行",
        "公司金融",
        "估值",
        "投资",
        "固收",
        "衍生品"
      ],
      "summary": "这是整条路线的核心区。这里建立“金融市场—公司—投资者—利率—资产价格”的基本框架。★★★★★课程建议认真完成习题与实战。"
    },
    {
      "id": "stage-2",
      "index": "2",
      "equivalent": "硕士核心",
      "goal": "资产定价+金融计量+宏观金融",
      "duration": "8–12个月",
      "coreCourses": [
        "资产定价",
        "计量",
        "时间序列",
        "行为金融",
        "宏观金融"
      ],
      "summary": "从“学金融”进入“研究金融”。核心问题从“市场有哪些工具”转向“资产为什么这样定价、如何用数据验证”。",
      "supplement": {
        "name": "硕士进阶",
        "summary": "这些课把市场结构、跨境资金、风险与宏观变量接进主线。根据兴趣深度选择，但宏观金融对现实市场分析很有价值。"
      }
    },
    {
      "id": "stage-3",
      "index": "3",
      "equivalent": "博士工具",
      "goal": "严谨数学、计量与连续时间金融",
      "duration": "12–18个月",
      "coreCourses": [
        "高级计量",
        "随机过程",
        "连续时间金融",
        "动态资产定价"
      ],
      "summary": "这里开始明显数学化。不要急着背公式；先确保概率、微积分、线性代数和计量的基础够用。"
    },
    {
      "id": "stage-4",
      "index": "4",
      "equivalent": "研究阶段",
      "goal": "论文、数据、研究问题",
      "duration": "长期",
      "coreCourses": [
        "复现论文→提出问题→做实证→形成研究方向"
      ],
      "summary": "研究阶段不再以“看完多少视频”衡量，而以能否提出可检验问题、处理数据、复现论文和形成自己的研究方向衡量。"
    }
  ],
  "order": {
    "chain": [
      "金融学导论",
      "微观",
      "宏观",
      "会计",
      "统计",
      "公司金融",
      "估值",
      "投资学",
      "固定收益",
      "衍生品",
      "资产定价",
      "金融计量",
      "时间序列",
      "行为金融/国际金融",
      "宏观金融",
      "高级计量",
      "随机过程",
      "连续时间金融",
      "动态资产定价",
      "研究训练"
    ],
    "text": "金融学导论 → 微观 → 宏观 → 会计 → 统计 → 公司金融 → 估值 → 投资学 → 固定收益 → 衍生品 → 资产定价 → 金融计量 → 时间序列 → 行为金融/国际金融 → 宏观金融 → 高级计量 → 随机过程 → 连续时间金融 → 动态资产定价 → 研究训练。",
    "foundation": [
      "微观经济学",
      "宏观经济学",
      "会计学",
      "概率统计",
      "公司金融",
      "投资学。"
    ]
  },
  "courseList": [
    {
      "code": "01",
      "name": "金融学导论",
      "stage": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–50小时"
    },
    {
      "code": "02",
      "name": "微观经济学",
      "stage": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约45–60小时"
    },
    {
      "code": "03",
      "name": "宏观经济学",
      "stage": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约45–60小时"
    },
    {
      "code": "04",
      "name": "会计学",
      "stage": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–50小时"
    },
    {
      "code": "05",
      "name": "财务报表分析",
      "stage": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约25–40小时"
    },
    {
      "code": "06",
      "name": "概率论与统计基础",
      "stage": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约50–70小时"
    },
    {
      "code": "07",
      "name": "单变量微积分",
      "stage": "预科",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约40–60小时"
    },
    {
      "code": "08",
      "name": "线性代数",
      "stage": "预科",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约40–60小时"
    },
    {
      "code": "09",
      "name": "货币银行学",
      "stage": "本科核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–50小时"
    },
    {
      "code": "10",
      "name": "公司金融",
      "stage": "本科核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约45–65小时"
    },
    {
      "code": "11",
      "name": "企业估值",
      "stage": "本科核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–55小时"
    },
    {
      "code": "12",
      "name": "投资学",
      "stage": "本科核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约50–70小时"
    },
    {
      "code": "13",
      "name": "固定收益",
      "stage": "本科核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–55小时"
    },
    {
      "code": "14",
      "name": "金融衍生品",
      "stage": "本科核心",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约40–60小时"
    },
    {
      "code": "15",
      "name": "金融市场",
      "stage": "本科核心",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约25–40小时"
    },
    {
      "code": "16",
      "name": "资产定价",
      "stage": "硕士核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约60–90小时"
    },
    {
      "code": "17",
      "name": "金融计量经济学",
      "stage": "硕士核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约60–90小时"
    },
    {
      "code": "18",
      "name": "时间序列分析",
      "stage": "硕士核心",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约40–60小时"
    },
    {
      "code": "19",
      "name": "行为金融",
      "stage": "硕士核心",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约25–40小时"
    },
    {
      "code": "20",
      "name": "国际金融",
      "stage": "硕士进阶",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约30–45小时"
    },
    {
      "code": "21",
      "name": "风险管理",
      "stage": "硕士进阶",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约35–55小时"
    },
    {
      "code": "22",
      "name": "市场微观结构",
      "stage": "硕士进阶",
      "importance": 3,
      "stars": "★★★☆☆",
      "hours": "约25–40小时"
    },
    {
      "code": "23",
      "name": "宏观金融",
      "stage": "硕士进阶",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–55小时"
    },
    {
      "code": "24",
      "name": "高级计量经济学",
      "stage": "博士工具",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约70–100小时"
    },
    {
      "code": "25",
      "name": "随机过程",
      "stage": "博士工具",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约60–90小时"
    },
    {
      "code": "26",
      "name": "随机微积分与连续时间金融",
      "stage": "博士工具",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约80–120小时"
    },
    {
      "code": "27",
      "name": "高级资产定价与动态金融",
      "stage": "博士工具",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约60–100小时"
    },
    {
      "code": "28",
      "name": "机器学习与金融数据分析",
      "stage": "博士工具",
      "importance": 3,
      "stars": "★★★☆☆",
      "hours": "约40–70小时"
    },
    {
      "code": "29",
      "name": "金融研究方法与论文阅读",
      "stage": "博士研究",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "长期"
    }
  ],
  "courses": [
    {
      "code": "01",
      "name": "金融学导论",
      "stageLabel": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–50小时",
      "hoursText": "35–50 小时",
      "prerequisite": "无",
      "concepts": [
        "金融的研究对象与基本问题：风险、时间、信息、资源配置。",
        "货币、信用、金融资产、金融市场、金融机构的关系。",
        "银行、中央银行、资本市场与实体经济之间的基本传导链条。",
        "利率、汇率、通胀、货币政策与金融资产价格的基本联系。",
        "金融监管、金融创新、金融危机的基本框架。"
      ],
      "resources": [
        {
          "title": "B站｜中央财经大学《金融学》李健（73讲）",
          "url": "https://www.bilibili.com/video/BV15a411i7uY/"
        },
        {
          "title": "B站｜耶鲁《金融市场》Robert Shiller（26讲）",
          "url": "https://www.bilibili.com/video/BV1BV411t7jC/"
        }
      ],
      "criteria": [
        "能用自己的话解释“货币—信用—银行—市场—资产价格”这条主线。",
        "能区分股票、债券、基金、期货、期权等基本金融资产。",
        "能解释利率变化为什么可能影响股票与债券价格。"
      ],
      "practice": "画一张“金融体系地图”，把家庭、企业、银行、央行、资本市场和政府连接起来。"
    },
    {
      "code": "02",
      "name": "微观经济学",
      "stageLabel": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约45–60小时",
      "hoursText": "45–60 小时",
      "prerequisite": "金融学导论",
      "concepts": [
        "供需、均衡与价格机制。",
        "消费者选择、效用、预算约束与边际分析。",
        "生产函数、成本、规模经济与边际成本。",
        "完全竞争、垄断、寡头与竞争策略。",
        "信息不对称、不确定性、外部性与政府干预。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜14.01 Principles of Microeconomics（视频+习题+考试）",
          "url": "https://ocw.mit.edu/courses/14-01-principles-of-microeconomics-fall-2023/video_galleries/video-lectures/"
        }
      ],
      "criteria": [
        "能解释价格、利润、竞争格局为何形成，而不是只描述结果。",
        "能把行业问题转化为供需、成本、竞争和激励问题。"
      ],
      "practice": "选择一个科技行业，画出上游—中游—下游的产业链，并分析其中一个环节的定价权。"
    },
    {
      "code": "03",
      "name": "宏观经济学",
      "stageLabel": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约45–60小时",
      "hoursText": "45–60 小时",
      "prerequisite": "微观经济学",
      "concepts": [
        "GDP、通胀、失业与经济周期。",
        "消费、投资、储蓄与国民收入恒等式。",
        "IS-LM与总需求、货币市场、利率。",
        "通货膨胀、菲利普斯曲线与货币政策。",
        "经济增长、资本积累、技术进步。",
        "开放经济、汇率与国际资本流动。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜14.02 Principles of Macroeconomics（视频+习题）",
          "url": "https://ocw.mit.edu/courses/14-02-principles-of-macroeconomics-spring-2023/resources/lecture-videos/"
        }
      ],
      "criteria": [
        "能解释“央行加息 → 利率 → 投资/消费 → 经济 → 资产价格”的基础链条。",
        "能区分名义变量与实际变量，理解通胀与实际利率。"
      ],
      "practice": "每周选一条央行新闻，用宏观模型解释它可能影响的变量。"
    },
    {
      "code": "04",
      "name": "会计学",
      "stageLabel": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–50小时",
      "hoursText": "35–50 小时",
      "prerequisite": "金融学导论",
      "concepts": [
        "会计等式与借贷记账。",
        "资产负债表、利润表、现金流量表。",
        "权责发生制与现金制的区别。",
        "收入、应收账款、存货、固定资产、负债与权益。",
        "会计信息质量与财务报表使用者。"
      ],
      "resources": [
        {
          "title": "B站｜中央财经大学《会计学（面向非会计专业学生）》",
          "url": "https://www.bilibili.com/video/BV1PM411678P/"
        }
      ],
      "criteria": [
        "看到三张表能说出每张表解决什么问题。",
        "理解“利润≠现金”，并能找到产生差异的原因。",
        "能读懂一家上市公司的基础财务报表。"
      ],
      "practice": "下载一家上市公司的年报，自己标出资产、负债、收入、利润和经营现金流。"
    },
    {
      "code": "05",
      "name": "财务报表分析",
      "stageLabel": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约25–40小时",
      "hoursText": "25–40 小时",
      "prerequisite": "会计学",
      "concepts": [
        "资产质量、负债结构与所有者权益。",
        "利润质量与利润表分析。",
        "现金流质量与经营活动现金流。",
        "存货、应收账款、固定资产等关键科目。",
        "资本结构与企业偿债能力。",
        "财务报表综合分析与行业比较。"
      ],
      "resources": [
        {
          "title": "B站｜对外经济贸易大学《财务报表分析》张新民（24讲）",
          "url": "https://www.bilibili.com/video/BV1ok4y1w77c/"
        }
      ],
      "criteria": [
        "能判断一家公司的利润增长是否有现金流支撑。",
        "能从报表发现增长、杠杆、存货、应收和资本开支问题。"
      ],
      "practice": "分析一家A股科技公司的三年报表，写一页“财报体检报告”。"
    },
    {
      "code": "06",
      "name": "概率论与统计基础",
      "stageLabel": "预科",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约50–70小时",
      "hoursText": "50–70 小时",
      "prerequisite": "高中数学",
      "concepts": [
        "概率、条件概率、Bayes。",
        "随机变量、期望、方差、协方差、相关系数。",
        "常见分布与中心极限定理直觉。",
        "抽样、估计、置信区间与假设检验。",
        "回归分析的统计直觉。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜18.05 Introduction to Probability and Statistics",
          "url": "https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/"
        }
      ],
      "criteria": [
        "能解释相关性、均值、方差、协方差和置信区间。",
        "能看懂一张基础回归结果表。"
      ],
      "practice": "用Excel/Python模拟1000次抛硬币，理解样本均值如何收敛。"
    },
    {
      "code": "07",
      "name": "单变量微积分",
      "stageLabel": "预科",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约40–60小时",
      "hoursText": "40–60 小时",
      "prerequisite": "高中数学",
      "concepts": [
        "极限、连续与导数。",
        "链式法则、指数与对数。",
        "最大值、最小值和边际分析。",
        "积分、面积与累计变化。",
        "Taylor展开与基础微分方程直觉。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜18.01 Single Variable Calculus（视频+习题）",
          "url": "https://ocw.mit.edu/courses/18-01-single-variable-calculus-fall-2006/video_galleries/video-lectures/"
        }
      ],
      "criteria": [
        "能熟练处理金融中的复利、贴现、连续增长与一阶最优化。",
        "能读懂基本金融模型中的导数和积分。"
      ],
      "practice": ""
    },
    {
      "code": "08",
      "name": "线性代数",
      "stageLabel": "预科",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约40–60小时",
      "hoursText": "40–60 小时",
      "prerequisite": "基础微积分/高中数学",
      "concepts": [
        "向量与矩阵。",
        "矩阵乘法、线性方程组。",
        "线性空间、基与维数。",
        "特征值、特征向量。",
        "协方差矩阵、二次型与优化中的矩阵表示。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜18.06 Linear Algebra Gilbert Strang",
          "url": "https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/video_galleries/video-lectures/"
        }
      ],
      "criteria": [
        "能看懂投资组合的矩阵表达。",
        "能理解协方差矩阵、特征值和因子模型中的线性代数。 这是整条路线的核心区。这里建立“金融市场—公司—投资者—利率—资产价格”的基本框架。★★★★★课程建议认真完成习题与实战。"
      ],
      "practice": ""
    },
    {
      "code": "09",
      "name": "货币银行学",
      "stageLabel": "本科核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–50小时",
      "hoursText": "35–50 小时",
      "prerequisite": "金融学导论+宏观",
      "concepts": [
        "货币与利率。",
        "金融体系、证券市场与金融中介。",
        "商业银行业务、杠杆与风险。",
        "中央银行、货币供给与货币需求。",
        "通胀、货币政策与政策传导。",
        "国际收支、汇率和国际货币体系。"
      ],
      "resources": [
        {
          "title": "B站｜北京大学《货币银行学》黄益平（24讲）",
          "url": "https://www.bilibili.com/video/BV1K34y1q7zc/"
        }
      ],
      "criteria": [
        "能解释央行如何通过政策利率与资产负债表影响金融条件。",
        "能把货币、银行、债券市场和汇率放进同一框架。"
      ],
      "practice": "建立“政策利率—国债收益率—信用—汇率—股票估值”的传导图。"
    },
    {
      "code": "10",
      "name": "公司金融",
      "stageLabel": "本科核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约45–65小时",
      "hoursText": "45–65 小时",
      "prerequisite": "会计+微观+金融学",
      "concepts": [
        "企业组织形式与代理问题。",
        "现金流预测与资本预算。",
        "NPV、IRR与资本成本。",
        "资本结构、债务与股权。",
        "MM理论、权衡理论与信息不对称。",
        "股利政策与股票回购。",
        "企业估值与实物期权基础。"
      ],
      "resources": [
        {
          "title": "B站｜中央财经大学《公司金融》（72讲）",
          "url": "https://www.bilibili.com/video/BV11S4y1L7sn/"
        },
        {
          "title": "NYU Stern｜Damodaran Corporate Finance课程总表",
          "url": "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/regularclass.htm"
        }
      ],
      "criteria": [
        "能独立计算NPV、IRR、WACC。",
        "能解释企业为什么借债、发股、回购和分红。",
        "能从现金流而不是“故事”理解公司价值。"
      ],
      "practice": "选择一家公司，做一份简化资本预算和资本结构分析。"
    },
    {
      "code": "11",
      "name": "企业估值",
      "stageLabel": "本科核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–55小时",
      "hoursText": "35–55 小时",
      "prerequisite": "公司金融",
      "concepts": [
        "DCF框架与自由现金流。",
        "FCFF、FCFE、WACC。",
        "终值与长期增长。",
        "PE、PB、EV/EBITDA、PS等相对估值。",
        "成长型企业、周期企业与高不确定性企业估值。",
        "估值偏差、复杂性与不确定性。"
      ],
      "resources": [
        {
          "title": "NYU Stern｜Damodaran Valuation完整学期课程",
          "url": "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/regularclass.htm"
        },
        {
          "title": "NYU Stern｜Damodaran Valuation短视频25课",
          "url": "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/webcastvalonline.htm"
        }
      ],
      "criteria": [
        "能自己搭一个简化DCF。",
        "能解释估值对增长率、利润率、WACC和终值的敏感性。",
        "能识别“好公司”和“好价格”不是同一个概念。"
      ],
      "practice": "给一家科技公司做三种情景估值：悲观、基准、乐观。"
    },
    {
      "code": "12",
      "name": "投资学",
      "stageLabel": "本科核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约50–70小时",
      "hoursText": "50–70 小时",
      "prerequisite": "概率统计+公司金融",
      "concepts": [
        "现值与资产定价的基本逻辑。",
        "风险与收益。",
        "投资组合分散化。",
        "均值—方差框架。",
        "CAPM、Beta、市场风险溢价。",
        "APT与因子模型基础。",
        "有效市场假说。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜15.401 Finance Theory I（视频+习题+考试）",
          "url": "https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/"
        },
        {
          "title": "B站｜耶鲁《金融市场》Robert Shiller",
          "url": "https://www.bilibili.com/video/BV1BV411t7jC/"
        }
      ],
      "criteria": [
        "能解释为什么分散化有效。",
        "能计算组合收益、方差、协方差。",
        "能用CAPM语言讨论风险溢价，而不是只说“涨跌”。"
      ],
      "practice": "用3–5个资产做一个最简单的均值—方差组合实验。"
    },
    {
      "code": "13",
      "name": "固定收益",
      "stageLabel": "本科核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–55小时",
      "hoursText": "35–55 小时",
      "prerequisite": "投资学+概率统计",
      "concepts": [
        "债券定价、到期收益率。",
        "久期与凸性。",
        "收益率曲线与期限结构。",
        "即期利率、远期利率。",
        "信用利差与违约风险。",
        "利率变化对债券价格的影响。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜15.401 Finance Theory I相关章节",
          "url": "https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/pages/syllabus/"
        }
      ],
      "criteria": [
        "能手算债券价格、久期和简单的利率敏感度。",
        "能理解10年期美债收益率变化为什么会影响股票估值。"
      ],
      "practice": "跟踪10年期国债收益率一个月，每次变化都写出可能原因。"
    },
    {
      "code": "14",
      "name": "金融衍生品",
      "stageLabel": "本科核心",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约40–60小时",
      "hoursText": "40–60 小时",
      "prerequisite": "投资学+固定收益+概率",
      "concepts": [
        "无套利原理。",
        "Forward与Futures。",
        "期权、看涨与看跌。",
        "Greeks与波动率。",
        "二叉树定价。",
        "Black-Scholes的核心思想。",
        "套期保值与风险暴露。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜15.401 Finance Theory I相关课程资源",
          "url": "https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/"
        },
        {
          "title": "B站｜耶鲁《金融市场》21–23讲：远期、期货、期权",
          "url": "https://www.bilibili.com/video/BV1BV411t7jC/"
        }
      ],
      "criteria": [
        "知道衍生品不是“赌博工具”，而是风险转移和定价工具。",
        "能解释无套利、复制组合、隐含波动率的基本含义。"
      ],
      "practice": ""
    },
    {
      "code": "15",
      "name": "金融市场",
      "stageLabel": "本科核心",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约25–40小时",
      "hoursText": "25–40 小时",
      "prerequisite": "金融学导论",
      "concepts": [
        "股票市场、债券市场、房地产金融。",
        "银行、投资银行、经纪与交易系统。",
        "期货与期权市场。",
        "有效市场与行为金融争论。",
        "金融危机与金融制度。"
      ],
      "resources": [
        {
          "title": "B站｜耶鲁《金融市场》Robert Shiller（26讲）",
          "url": "https://www.bilibili.com/video/BV1BV411t7jC/"
        }
      ],
      "criteria": [
        "能从“市场结构”的角度理解价格形成。",
        "知道金融市场背后的制度与中介，而不是把市场理解为一条K线。 从“学金融”进入“研究金融”。核心问题从“市场有哪些工具”转向“资产为什么这样定价、如何用数据验证”。"
      ],
      "practice": ""
    },
    {
      "code": "16",
      "name": "资产定价",
      "stageLabel": "硕士核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约60–90小时",
      "hoursText": "60–90 小时",
      "prerequisite": "投资学+微积分+概率统计",
      "concepts": [
        "效用函数与风险厌恶。",
        "无套利与状态价格。",
        "CAPM、APT与因子模型。",
        "SDF/随机贴现因子。",
        "消费资本资产定价。",
        "跨期资产定价。",
        "风险溢价的经济含义。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜Finance Theory I作为资产定价入门",
          "url": "https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/"
        },
        {
          "title": "B站｜耶鲁《金融理论》（26讲）",
          "url": "https://www.bilibili.com/video/BV1eh411p7rt/"
        }
      ],
      "criteria": [
        "能解释CAPM背后的优化问题和经济直觉。",
        "能把“风险”转化为可定价的协方差关系。",
        "能开始阅读资产定价论文中的基本公式。"
      ],
      "practice": "比较一个行业指数与市场指数的Beta，并讨论Beta变化的经济解释。"
    },
    {
      "code": "17",
      "name": "金融计量经济学",
      "stageLabel": "硕士核心",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约60–90小时",
      "hoursText": "60–90 小时",
      "prerequisite": "概率统计+线性代数+微积分",
      "concepts": [
        "OLS与多元回归。",
        "假设检验、置信区间与统计推断。",
        "异方差、自相关、多重共线性。",
        "时间序列与面板数据。",
        "内生性与工具变量。",
        "固定效应、DID、事件研究。",
        "GMM、Bootstrap和处理效应。"
      ],
      "resources": [
        {
          "title": "B站｜对外经济贸易大学《计量经济学导论》（101课）",
          "url": "https://www.bilibili.com/video/BV1C34y127Ra/"
        },
        {
          "title": "MIT OCW｜14.382 Econometrics（研究生级）",
          "url": "https://ocw.mit.edu/courses/14-382-econometrics-spring-2017/"
        },
        {
          "title": "B站｜《计量经济学》李振波（52课）",
          "url": "https://www.bilibili.com/video/BV15t421V7m1/"
        }
      ],
      "criteria": [
        "能自己做OLS并解释系数、标准误和显著性。",
        "能识别“相关关系≠因果关系”。",
        "能看懂一篇实证金融论文的识别策略。"
      ],
      "practice": "完成一次事件研究：例如某家公司重大公告前后股价异常收益。"
    },
    {
      "code": "18",
      "name": "时间序列分析",
      "stageLabel": "硕士核心",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约40–60小时",
      "hoursText": "40–60 小时",
      "prerequisite": "概率统计+计量",
      "concepts": [
        "平稳性、白噪声与随机过程基础。",
        "ACF、PACF。",
        "AR、MA、ARIMA。",
        "协整与误差修正。",
        "VAR与Granger因果。",
        "ARCH/GARCH与波动率。"
      ],
      "resources": [
        {
          "title": "B站｜通俗导向《计量经济学》含时间序列、VAR、GARCH模块",
          "url": "https://www.bilibili.com/cheese/play/ss674119527/"
        },
        {
          "title": "B站｜经济计量学入门级课程",
          "url": "https://www.bilibili.com/video/BV1Th411X7zX/"
        }
      ],
      "criteria": [
        "能判断金融时间序列为何不能简单套OLS。",
        "能理解收益率、波动率和宏观变量的动态关系。"
      ],
      "practice": "用指数收益率拟合一个GARCH模型，比较预测波动率与实际波动率。"
    },
    {
      "code": "19",
      "name": "行为金融",
      "stageLabel": "硕士核心",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约25–40小时",
      "hoursText": "25–40 小时",
      "prerequisite": "投资学+资产定价",
      "concepts": [
        "有限理性与前景理论。",
        "损失厌恶、过度自信、锚定。",
        "羊群效应与注意力。",
        "处置效应与代表性启发。",
        "套利限制。",
        "泡沫、崩盘与非理性定价。"
      ],
      "resources": [
        {
          "title": "B站｜耶鲁《金融市场》行为金融相关课程",
          "url": "https://www.bilibili.com/video/BV1BV411t7jC/"
        },
        {
          "title": "B站｜耶鲁《金融理论》相关课程",
          "url": "https://www.bilibili.com/video/BV1eh411p7rt/"
        }
      ],
      "criteria": [
        "能分别说出经典金融理论与行为金融对同一现象的不同解释。",
        "能避免把“市场情绪”当成万能解释。 这些课把市场结构、跨境资金、风险与宏观变量接进主线。根据兴趣深度选择，但宏观金融对现实市场分析很有价值。"
      ],
      "practice": ""
    },
    {
      "code": "20",
      "name": "国际金融",
      "stageLabel": "硕士进阶",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约30–45小时",
      "hoursText": "30–45 小时",
      "prerequisite": "宏观+货币银行学",
      "concepts": [
        "汇率决定与利率平价。",
        "国际收支。",
        "资本流动。",
        "美元体系与国际货币体系。",
        "汇率风险。",
        "开放经济中的货币政策。"
      ],
      "resources": [
        {
          "title": "B站｜北京大学《货币银行学》国际金融相关章节",
          "url": "https://www.bilibili.com/video/BV1K34y1q7zc/"
        },
        {
          "title": "MIT OCW｜14.02宏观经济学",
          "url": "https://ocw.mit.edu/courses/14-02-principles-of-macroeconomics-spring-2023/resources/lecture-videos/"
        }
      ],
      "criteria": [
        "能解释“美国利率—美元—跨境资本—新兴市场”的传导。"
      ],
      "practice": "选一个亚洲货币，对比其汇率与美国利率的阶段性变化。"
    },
    {
      "code": "21",
      "name": "风险管理",
      "stageLabel": "硕士进阶",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约35–55小时",
      "hoursText": "35–55 小时",
      "prerequisite": "投资组合+固定收益+衍生品",
      "concepts": [
        "市场风险、信用风险、流动性风险。",
        "VaR与Expected Shortfall。",
        "压力测试。",
        "对冲与风险预算。",
        "杠杆与尾部风险。",
        "模型风险与风险治理。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜15.401 Finance Theory I作为风险分析基础",
          "url": "https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/"
        },
        {
          "title": "NYU Stern｜Damodaran Corporate Finance/Valuation资源",
          "url": "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/regularclass.htm"
        }
      ],
      "criteria": [
        "能区分波动率风险和流动性/信用/尾部风险。",
        "能解释为什么“低波动”不等于“低风险”。"
      ],
      "practice": "对一个假设组合做一次历史回测VaR和压力测试。"
    },
    {
      "code": "22",
      "name": "市场微观结构",
      "stageLabel": "硕士进阶",
      "importance": 3,
      "stars": "★★★☆☆",
      "hours": "约25–40小时",
      "hoursText": "25–40 小时",
      "prerequisite": "投资学+金融市场",
      "concepts": [
        "订单簿与价格发现。",
        "买卖价差。",
        "做市商与库存风险。",
        "信息不对称。",
        "交易成本。",
        "高频交易与市场流动性。"
      ],
      "resources": [
        {
          "title": "B站｜耶鲁《金融市场》交易系统与二级市场相关讲次",
          "url": "https://www.bilibili.com/video/BV1BV411t7jC/"
        }
      ],
      "criteria": [
        "能解释为什么流动性、交易成本和订单流会影响短期价格。"
      ],
      "practice": ""
    },
    {
      "code": "23",
      "name": "宏观金融",
      "stageLabel": "硕士进阶",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约35–55小时",
      "hoursText": "35–55 小时",
      "prerequisite": "宏观+资产定价+固定收益",
      "concepts": [
        "政策利率与资产价格。",
        "收益率曲线与经济周期。",
        "货币政策预期。",
        "金融条件与信用周期。",
        "美元与全球流动性。",
        "宏观冲击与风险溢价。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜14.02 Principles of Macroeconomics",
          "url": "https://ocw.mit.edu/courses/14-02-principles-of-macroeconomics-spring-2023/resources/lecture-videos/"
        },
        {
          "title": "B站｜耶鲁《金融市场》货币政策/金融危机相关课程",
          "url": "https://www.bilibili.com/video/BV1BV411t7jC/"
        }
      ],
      "criteria": [
        "能把宏观变量和资产定价连接起来，而不是分开学习。",
        "能解释“预期变化”为什么有时比政策实际变化更重要。"
      ],
      "practice": "建立“Fed—美债—美元—科技股估值”的月度跟踪表。"
    },
    {
      "code": "24",
      "name": "高级计量经济学",
      "stageLabel": "博士工具",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约70–100小时",
      "hoursText": "70–100 小时",
      "prerequisite": "金融计量",
      "concepts": [
        "识别与估计的严格框架。",
        "IV、GMM。",
        "Bootstrap。",
        "非线性模型。",
        "面板数据。",
        "处理效应与因果推断。",
        "高维稀疏模型。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜14.382 Econometrics（研究生级，含讲义、Problem Sets、数据代码）",
          "url": "https://ocw.mit.edu/courses/14-382-econometrics-spring-2017/"
        },
        {
          "title": "MIT OCW｜14.382讲义与数据代码",
          "url": "https://ocw.mit.edu/courses/14-382-econometrics-spring-2017/pages/lecture-notes/"
        }
      ],
      "criteria": [
        "能独立设计识别策略并说明为什么它可能有效。",
        "能读懂现代实证论文的方法部分。",
        "能用真实数据复现至少一张核心结果表。"
      ],
      "practice": "选一篇金融实证论文，尽可能复现其核心回归。"
    },
    {
      "code": "25",
      "name": "随机过程",
      "stageLabel": "博士工具",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约60–90小时",
      "hoursText": "60–90 小时",
      "prerequisite": "概率+微积分",
      "concepts": [
        "条件期望与鞅。",
        "Markov过程。",
        "随机游走。",
        "Brownian Motion。",
        "Martingale。",
        "停时与基本随机过程。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜18.05概率统计作为基础，再进入随机过程专题视频学习",
          "url": "https://ocw.mit.edu/courses/18-05-introduction-to-probability-and-statistics-spring-2022/"
        }
      ],
      "criteria": [
        "能理解金融模型中“随机性如何随时间演化”。",
        "理解Brownian motion和martingale的金融直觉。"
      ],
      "practice": ""
    },
    {
      "code": "26",
      "name": "随机微积分与连续时间金融",
      "stageLabel": "博士工具",
      "importance": 4,
      "stars": "★★★★☆",
      "hours": "约80–120小时",
      "hoursText": "80–120 小时",
      "prerequisite": "多元微积分+随机过程+线代",
      "concepts": [
        "Ito引理。",
        "随机微分方程。",
        "风险中性测度的直觉。",
        "动态对冲。",
        "Black-Scholes。",
        "连续时间资产定价。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜15.450 Analytics of Finance（高级定量金融）",
          "url": "https://ocw.mit.edu/courses/15-450-analytics-of-finance-fall-2010/"
        },
        {
          "title": "MIT OCW｜15.401 Finance Theory I",
          "url": "https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/"
        }
      ],
      "criteria": [
        "能从无套利和动态复制理解Black-Scholes，而非只背公式。",
        "能读懂基础连续时间金融模型。"
      ],
      "practice": ""
    },
    {
      "code": "27",
      "name": "高级资产定价与动态金融",
      "stageLabel": "博士工具",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "约60–100小时",
      "hoursText": "60–100 小时",
      "prerequisite": "资产定价+高级计量",
      "concepts": [
        "随机贴现因子与定价核。",
        "跨期风险溢价。",
        "Consumption CAPM。",
        "动态组合选择。",
        "长期风险。",
        "宏观变量与资产定价。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜Finance Theory I作为资产定价基础",
          "url": "https://ocw.mit.edu/courses/15-401-finance-theory-i-fall-2008/"
        },
        {
          "title": "B站｜耶鲁《金融理论》",
          "url": "https://www.bilibili.com/video/BV1eh411p7rt/"
        }
      ],
      "criteria": [
        "能把一个资产定价问题写成“状态—支付—价格”的框架。",
        "开始阅读资产定价论文中的理论模型。"
      ],
      "practice": ""
    },
    {
      "code": "28",
      "name": "机器学习与金融数据分析",
      "stageLabel": "博士工具",
      "importance": 3,
      "stars": "★★★☆☆",
      "hours": "约40–70小时",
      "hoursText": "40–70 小时",
      "prerequisite": "统计+Python",
      "concepts": [
        "特征工程与数据泄露。",
        "训练/验证/测试。",
        "线性模型、树模型。",
        "正则化。",
        "交叉验证。",
        "预测与因果的区别。",
        "回测偏差、幸存者偏差和过拟合。"
      ],
      "resources": [
        {
          "title": "MIT OCW/公开课程｜先掌握统计与计量后再学机器学习金融",
          "url": "https://ocw.mit.edu/"
        },
        {
          "title": "建议搜索｜YouTube “Machine Learning for Finance” + “Financial Econometrics”",
          "url": "https://www.youtube.com/results?search_query=Machine+Learning+for+Finance"
        }
      ],
      "criteria": [
        "能解释模型为什么可能在样本外失效。",
        "知道金融预测最危险的不是模型不够复杂，而是数据与验证方式有问题。"
      ],
      "practice": "做一次严格的滚动样本外预测，不追求交易收益，只验证方法。"
    },
    {
      "code": "29",
      "name": "金融研究方法与论文阅读",
      "stageLabel": "博士研究",
      "importance": 5,
      "stars": "★★★★★",
      "hours": "长期",
      "hoursText": "长期",
      "prerequisite": "高级计量+资产定价",
      "concepts": [
        "如何提出可研究的问题。",
        "文献综述与研究空白。",
        "理论假说。",
        "数据与变量设计。",
        "识别策略。",
        "稳健性检验。",
        "如何读实证表格。",
        "如何复现与质疑论文。"
      ],
      "resources": [
        {
          "title": "MIT OCW｜14.382 Econometrics",
          "url": "https://ocw.mit.edu/courses/14-382-econometrics-spring-2017/"
        },
        {
          "title": "NYU Stern｜Damodaran公开课程与视频资源",
          "url": "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/regularclass.htm"
        }
      ],
      "criteria": [
        "能独立提出一个明确、可验证、可数据化的金融问题。",
        "能完整复现一篇论文的核心结果。"
      ],
      "practice": "建立自己的“研究问题库”，每周记录一个可验证的金融假设。"
    }
  ],
  "weeklyTemplate": [
    {
      "day": "周一",
      "task": "视频课",
      "duration": "60–90分钟",
      "requirement": "看新内容，做简短笔记"
    },
    {
      "day": "周二",
      "task": "视频课",
      "duration": "60–90分钟",
      "requirement": "继续主课"
    },
    {
      "day": "周三",
      "task": "视频课+回忆",
      "duration": "60–90分钟",
      "requirement": "合上视频，复述本节核心逻辑"
    },
    {
      "day": "周四",
      "task": "习题",
      "duration": "60分钟",
      "requirement": "只做本课最重要的计算题/概念题"
    },
    {
      "day": "周五",
      "task": "视频课",
      "duration": "45–75分钟",
      "requirement": "推进课程，不追求一次看完大量内容"
    },
    {
      "day": "周末一天",
      "task": "实战",
      "duration": "2–3小时",
      "requirement": "财报、市场数据、Excel/Python小项目"
    },
    {
      "day": "周末另一天",
      "task": "复盘",
      "duration": "1小时",
      "requirement": "整理错题、知识图、下周计划"
    }
  ],
  "graduationRules": [
    "普通课程：不用追求 100%，达到“可以不用看视频解释核心概念”即可进入下一门。",
    "★★★★★核心课程：至少完成 1 次计算/实证/案例任务。",
    "遇到不会的公式：先回到经济含义，再回到数学推导；不要把公式当成背诵题。",
    "三次复述原则：学完当天复述一次，周末复述一次，一个月后再复述一次。能长期复述的知识才算真正掌握。"
  ],
  "pythonTimeline": [
    "第一阶段只需要 Excel：计算现值、收益率、财务比率、简单统计。",
    "学完投资学后：开始 Python 的 pandas、numpy、matplotlib，做行情和组合统计。",
    "学金融计量后：加入 statsmodels/scipy，开始回归、事件研究、时间序列。",
    "博士工具阶段：再进入机器学习、滚动回测和更复杂的金融数据工程。"
  ],
  "firstYearGoals": [
    "完成金融学导论、微观、宏观、会计、财报分析、概率统计、微积分。",
    "能够看懂上市公司三张表，并解释利润、现金流、资本开支和负债的关系。",
    "能够从“经济增长—通胀—利率—企业利润—估值”的链条解释一条宏观新闻。",
    "建立一个个人金融知识库：每门课只保留一页“核心框架图”。"
  ],
  "finalStandards": {
    "intro": "如果沿着这条路线完成，你最终需要具备的不是“记住多少金融术语”，而是下面这套能力：",
    "items": [
      "看到宏观政策，能分析其对利率、流动性、汇率与风险溢价的可能影响。",
      "看到公司，能从商业模式、财报、现金流、资本成本和估值分析它。",
      "看到股票价格，能区分基本面、估值、预期、风险偏好和市场微观结构。",
      "看到一篇金融研究论文，能判断它的理论、数据和识别策略。",
      "面对一个新问题，能自己找数据、建模型、做检验，而不是只等待别人给结论。"
    ]
  },
  "resources": [
    {
      "name": "MIT OpenCourseWare",
      "url": "https://ocw.mit.edu/",
      "note": "微积分、线代、微观、宏观、金融、计量等系统课程；很多课程含视频、习题、考试。"
    },
    {
      "name": "Yale Open Courses",
      "url": "https://oyc.yale.edu/",
      "note": "适合获得经济学与金融的直觉，其中Shiller的Financial Markets尤其值得作为金融全景课。"
    },
    {
      "name": "NYU Stern｜Aswath Damodaran",
      "url": "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/regularclass.htm",
      "note": "公司金融和企业估值的视频主线，适合从理论落到真实公司。"
    },
    {
      "name": "Bilibili",
      "url": "https://www.bilibili.com/",
      "note": "中文高校课程资源最方便；本计划优先挑高校公开课，而不是财经UP主碎片内容。"
    }
  ],
  "resourceNotes": [
    "本计划中的在线课程链接以公开网页在 2026-09-25 可访问的课程页面为准。不同平台的搬运版本可能会下架、改名或调整播放顺序，因此当某个B站链接失效时，优先按“学校 + 课程名 + 主讲人”搜索；MIT、Yale、NYU Stern则优先使用官方课程页。",
    "建议你真正开始时，只打开第1门课，不要同时收藏几十个课程。"
  ],
  "totals": {
    "courses": 29,
    "hoursLow": 1200,
    "hoursHigh": 1800
  }
}
