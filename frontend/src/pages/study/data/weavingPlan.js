// 手工编织与纤维手作：从《手工编织与纤维手作系统课程》整理出来的结构化数据。
//
// 每个技法 / 项目自带 links（来自原文档对应章节的链接）与 figures（public/weaving/ 里的配图），
// 页面因此能像「课程卡」一样把资源挂在它该在的位置，而不是最后堆一串链接。
export const weavingPlan = {
  "meta": {
    "title": "手工编织与纤维手作",
    "subtitle": "从第一针到独立设计 · 40 周自学课程",
    "intro": "适合零基础成人自学者。课程把棒针、钩针、手缝修补、刺绣、十字绣、布艺拼布、编绳与羊毛毡串成循序渐进的路线，并补齐材料工具、项目库、练习验收与可访问资源。",
    "usage": "每周 3 次练习、每次 45–90 分钟；先做样片再做成品。第 1–16 周按周推进，第 17–40 周按方向加深。把每次练习的材料、针号、尺寸、耗时与问题记入作品档案。",
    "source": "整理自《手工编织与纤维手作系统课程》文档"
  },
  "phases": [
    {
      "name": "基础工具与动作",
      "weeks": "1–4",
      "focus": "选线选针、样片、棒针下针/上针、钩针锁针/短针、手缝基本线迹",
      "outcome": "基础样卡、针数稳定",
      "can": "独立起针、下针、上针、钩锁针/短针；针线安全；能数针、数行。",
      "fix": "回到 10×10 cm 样片，连续两次针数不变再继续。"
    },
    {
      "name": "棒针围巾线",
      "weeks": "5–10",
      "focus": "搓板针围巾、罗纹、换色、脖套圈织、完整收尾",
      "outcome": "至少一条围巾或一个脖套",
      "can": "完成一条尺寸合适、边缘整齐的围巾或脖套；会换色、收针和藏线。",
      "fix": "重织 20 cm 练习边，找出漏针/边针问题后再做成品。"
    },
    {
      "name": "钩针小件线",
      "weeks": "11–18",
      "focus": "钩针围巾、方片、拼接、帽子量体",
      "outcome": "一件帽子或方片小件",
      "can": "能钩直片、圆片、方片；会钩围巾、帽子并按头围调整。",
      "fix": "检查每行/圈针数，连续 5 圈不增漏后再继续。"
    },
    {
      "name": "针线与布艺线",
      "weeks": "19–27",
      "focus": "钉扣、补洞、刺子绣、刺绣、十字绣、拼布杯垫",
      "outcome": "修好一件衣物，完成一件布艺品",
      "can": "能修一处衣物开缝/补丁，完成一件刺绣物和拼布杯垫。",
      "fix": "在旧布上重做针距和缝份练习，直到轻拉不脱线。"
    },
    {
      "name": "编绳与羊毛毡线",
      "weeks": "28–32",
      "focus": "平结、滑动扣、植物吊篮、平毡和立体针毡",
      "outcome": "完成手绳/吊篮与针毡作品",
      "can": "能重复做整齐平结、收尾并制作稳定挂件；会安全针毡塑形。",
      "fix": "编绳先做 10 cm 样带；毡作从平片/球体练针的垂直控制。"
    },
    {
      "name": "毛衣与自选项目",
      "weeks": "33–40",
      "focus": "量体、密度、插肩毛衣、试穿整理、自主项目设计",
      "outcome": "完成一件毛衣和一件自选作品",
      "can": "会按尺码选毛衣图解、确认洗后密度、记录育克针数、分袖、试穿、完成收边。",
      "fix": "未达密度不要开织；肩宽/腋深不合时先核对尺码和加针记录。"
    }
  ],
  "weeks": [
    {
      "n": 1,
      "topic": "工具与材料",
      "work": "整理针线、剪刀、卷尺、记号扣；摸清棉、羊毛、腈纶、真丝和旧布差别。",
      "pass": "完成个人工具盒和材料卡；针具安全收纳。"
    },
    {
      "n": 2,
      "topic": "线与针配合",
      "work": "用浅色中粗毛线试 3 个针号；织/钩 10×10 cm 样片并记针号、线材、手感。",
      "pass": "能按线标选起始针号；会测样片。"
    },
    {
      "n": 3,
      "topic": "棒针基本动作",
      "work": "学活结、起针、下针；每天练 10 行，不追求速度。",
      "pass": "织 20 针×20 行，无掉针；边缘基本垂直。"
    },
    {
      "n": 4,
      "topic": "上针与手缝",
      "work": "学上针、平针正反面；另做平针、回针样卡各 10 cm。",
      "pass": "可辨认 K/P；完成平整样片和缝线样卡。"
    },
    {
      "n": 5,
      "topic": "第一条围巾计划",
      "work": "洗后测棒针样片密度；选搓板针围巾，按目标宽度换算起针数。",
      "pass": "写出材料、目标宽长、换算过程。"
    },
    {
      "n": 6,
      "topic": "围巾起针和边缘",
      "work": "起针后织 15 cm；练边针，逐行点数并用记号纸记录。",
      "pass": "针数始终相同，边缘不明显斜。"
    },
    {
      "n": 7,
      "topic": "围巾主体",
      "work": "连续织到 40–50 cm；每 10 行量宽，观察张力是否变化。",
      "pass": "同一块织片宽度变化不超过约 1.5 cm。"
    },
    {
      "n": 8,
      "topic": "围巾收针与藏线",
      "work": "练弹性收针；达到目标长度，藏线、洗护、平铺整形。",
      "pass": "完成第一条可用围巾并记录实际用线。"
    },
    {
      "n": 9,
      "topic": "罗纹与双色条纹",
      "work": "做 2×2 罗纹样片；练色块换线和线尾藏入。",
      "pass": "能织双面有纹理的围巾样片，颜色接缝不收皱。"
    },
    {
      "n": 10,
      "topic": "脖套/围脖",
      "work": "在环针上练合圈，确认不扭转；织罗纹脖套并弹性收针。",
      "pass": "脖套能舒适套头，接缝/圈起点整齐。"
    },
    {
      "n": 11,
      "topic": "钩针基本动作",
      "work": "学活结、锁针、短针；从锁针链练直边，逐行夹记号扣。",
      "pass": "钩 20 针×15 行，针数保持稳定。"
    },
    {
      "n": 12,
      "topic": "钩针长针与罗纹",
      "work": "练中长针、长针、引拔针、后半针短针；做小样卡比较高度。",
      "pass": "能照文字行说明完成 4 行重复。"
    },
    {
      "n": 13,
      "topic": "钩针围巾",
      "work": "按样片换算宽度；钩后半针罗纹围巾主体，练行首/末针。",
      "pass": "围巾宽度均匀，没有逐行变窄。"
    },
    {
      "n": 14,
      "topic": "钩针围巾收尾",
      "work": "练换色、藏线、流苏；完成并轻柔整理围巾。",
      "pass": "两端齐整，流苏长度相近，线尾牢固。"
    },
    {
      "n": 15,
      "topic": "Granny 方片起步",
      "work": "练魔术环/锁针圈、长针簇、角部锁针空隙；先完成一圈。",
      "pass": "四角分布对称，能说清角针与边针区别。"
    },
    {
      "n": 16,
      "topic": "方片扩圈与定形",
      "work": "继续加圈，做两块相同方片；平铺检查、练洗后定形。",
      "pass": "方片边长误差小于 0.5 cm，基本平放。"
    },
    {
      "n": 17,
      "topic": "拼片与边缘",
      "work": "练引拔/短针拼片；完成杯垫或小桌垫并钩一圈包边。",
      "pass": "接缝不皱、边缘完整；藏线不松脱。"
    },
    {
      "n": 18,
      "topic": "钩针帽子",
      "work": "量头围、算帽顶直径，练圆片加针、帽身、帽檐。",
      "pass": "试戴合适；帽顶不卷、不起波浪，帽檐不勒。"
    },
    {
      "n": 19,
      "topic": "缝纫基础",
      "work": "练平针、回针、锁边、藏线；穿针打结与缝份标记。",
      "pass": "样布上缝 10 cm 直线，针距大致一致。"
    },
    {
      "n": 20,
      "topic": "衣物小修",
      "work": "给旧衣钉扣、补开缝；按原缝线回针并藏线。",
      "pass": "轻拉接缝和扣子不松，衣身没有被误缝住。"
    },
    {
      "n": 21,
      "topic": "补洞与刺子绣",
      "work": "给练习牛仔布加补片；画间距线，平针交织固定。",
      "pass": "补片四周覆盖磨损区，面料无明显拉皱。"
    },
    {
      "n": 22,
      "topic": "刺绣起步",
      "work": "绷布、转印；练回针、缎面绣、法国结并做针法样卡。",
      "pass": "线迹不拉皱，布背无线圈和长跨线。"
    },
    {
      "n": 23,
      "topic": "十字绣读图",
      "work": "用 14 格布、2 股线，从中心定位；每 10 格复核一次。",
      "pass": "完成 20×20 格图案，交叉方向一致。"
    },
    {
      "n": 24,
      "topic": "刺绣小成品",
      "work": "选书签/布贴图样，完成绣面、藏线、熨烫和包边。",
      "pass": "正反面都收洁，边缘耐用。"
    },
    {
      "n": 25,
      "topic": "拼布裁剪",
      "work": "预洗熨平布料；裁 4 片同尺寸方布并设计深浅顺序。",
      "pass": "四片边长一致，缝份画线清楚。"
    },
    {
      "n": 26,
      "topic": "拼接与夹棉",
      "work": "拼 2×2 方片，熨开缝份；叠表布、铺棉、底布并疏缝。",
      "pass": "中心交点对齐，夹层不移位。"
    },
    {
      "n": 27,
      "topic": "压线与包边",
      "work": "手缝绗压或机缝；修齐四边并包边，完成杯垫。",
      "pass": "无露棉，四角完整，杯垫平放。"
    },
    {
      "n": 28,
      "topic": "编绳基础结",
      "work": "练固定中心线、左半结和右半结；对照镜像动作反复做。",
      "pass": "能重复做 10 组宽度相近的平结。"
    },
    {
      "n": 29,
      "topic": "手绳成品",
      "work": "量腕围、剪四股绳、编平结带、做滑动收尾。",
      "pass": "滑动扣能调节，拉扯后不散。"
    },
    {
      "n": 30,
      "topic": "植物吊篮",
      "work": "练挂环、分组、交错平结和底部收束；先放空盆试形。",
      "pass": "网格托盆稳定；用等重物做安全测试。"
    },
    {
      "n": 31,
      "topic": "羊毛毡平面",
      "work": "学毡针和泡沫垫安全动作；做球、叶片和平毡片。",
      "pass": "形体密实，工作时针尖始终朝垫面。"
    },
    {
      "n": 32,
      "topic": "羊毛毡立体",
      "work": "制作蘑菇/小水果，分件塑形后连接、加色、安装挂环。",
      "pass": "接缝轻拉牢固；装饰无松脱。"
    },
    {
      "n": 33,
      "topic": "毛衣准备",
      "work": "量胸围、上臂围、衣长、袖长；选基础插肩图解并确定尺码和松量。",
      "pass": "完成尺寸表，能找到图解中的尺码与成衣胸围。"
    },
    {
      "n": 34,
      "topic": "毛衣密度与材料",
      "work": "用主体针法织至少 15×15 cm 样片，洗后数 10 cm 针行密度；核算线量。",
      "pass": "样片密度达到图解要求；不合就换针重织。"
    },
    {
      "n": 35,
      "topic": "领口与插肩育克",
      "work": "环针起针、建立前后身/袖子标记；按图解节奏做插肩加针。",
      "pass": "圈织不扭；每次加针后核对总针数并记录。"
    },
    {
      "n": 36,
      "topic": "育克试穿与分袖",
      "work": "继续育克；试穿肩宽和腋深；把袖针暂存，按图解加腋下针。",
      "pass": "衣身可舒适抬手；左右袖针数相同。"
    },
    {
      "n": 37,
      "topic": "毛衣身体",
      "work": "圈织衣身至目标衣长；试穿胸围和下摆，织罗纹并弹性收针。",
      "pass": "记录实际胸围、衣长；下摆平整不卷。"
    },
    {
      "n": 38,
      "topic": "袖子与完工",
      "work": "分别圈织袖子、照记录减针；收袖口、领边、藏线并湿整理。",
      "pass": "两袖长度一致；腋下无洞；洗后尺寸合适。"
    },
    {
      "n": 39,
      "topic": "自由项目设计",
      "work": "从围巾、衣物修补、方片毯、拼布袋选一个改尺寸/颜色/纹样，画草图。",
      "pass": "材料单、尺寸图、步骤清单和风险点齐全。"
    },
    {
      "n": 40,
      "topic": "结课作品与复盘",
      "work": "按计划完成作品，拍正面/背面/细节；填写制作记录和下一阶段计划。",
      "pass": "结构牢固、尺寸符合用途；能讲清制作顺序与改进点。"
    }
  ],
  "techniques": [
    {
      "id": "knit",
      "code": "B",
      "name": "棒针编织",
      "summary": "多个活线圈逐行成布：起针、上下针、加减针、缝合与读图，从围巾走到毛衣。",
      "units": [
        {
          "code": "B1 起针与下针",
          "skill": "长尾起针或简易起针；下针；不扭转织片",
          "pass": "起 20 针织 12 行，针目不掉落，左右边缘差异不超过 1 针。"
        },
        {
          "code": "B2 上针与平针",
          "skill": "上针；正反面；平针卷边特性",
          "pass": "完成 12×12 cm 样片，辨认正反面并能数行。"
        },
        {
          "code": "B3 罗纹与边针",
          "skill": "1×1、2×2 罗纹；边针保持一致",
          "pass": "做 8 cm 弹性带，拉伸后能回弹且无明显松紧跳变。"
        },
        {
          "code": "B4 加减针与纹样",
          "skill": "并针、加针、麻花交叉、简单镂空",
          "pass": "按 10 行图样织成样片，能标记行数并找出漏针。"
        },
        {
          "code": "B5 成品完成",
          "skill": "密度、缝合、藏线、湿整理",
          "pass": "织围脖或杯垫；尺寸偏差不超过目标的 10%，线头牢固。"
        }
      ],
      "links": [
        {
          "title": "棒针入门围巾图文与逐步视频",
          "url": "https://nimble-needles.com/patterns/how-to-knit-a-scarf-for-beginners/"
        },
        {
          "title": "Craft Yarn Council 新手流苏围巾图解 PDF",
          "url": "https://www.craftyarncouncil.com/sites/default/files/discover/K62_CYC_Discover-Time-for-Knit-Level-1-Scarf-With-Fringe.pdf"
        },
        {
          "title": "钩针罗纹围巾免费图文与视频",
          "url": "https://offthebeatenhook.com/long-scarf-free-crochet-pattern/"
        },
        {
          "title": "钩针罗纹围巾分段视频",
          "url": "https://www.youtube.com/watch?v=8-TAriLCPLE"
        }
      ],
      "figures": [
        "/weaving/fig-1.jpg"
      ]
    },
    {
      "id": "crochet",
      "code": "C",
      "name": "钩针编织",
      "summary": "单个活线圈逐针构造：锁针、短针、长针、圈起与加减，适合方片、帽子、玩偶。",
      "units": [
        {
          "code": "C1",
          "skill": "活结、锁针、引拔针",
          "pass": "锁针链 20 针，宽度均匀；不把起针活结计入针数。"
        },
        {
          "code": "C2",
          "skill": "短针与转向",
          "pass": "钩 10×10 cm 方片，每行针数保持一致。"
        },
        {
          "code": "C3",
          "skill": "中长针、长针、半针",
          "pass": "各做一块样片，比较高度、孔隙与线材消耗。"
        },
        {
          "code": "C4",
          "skill": "圈起、加针、减针、记号扣",
          "pass": "钩平圆片，6 圈不扭曲；能用记号扣标记每圈起点。"
        },
        {
          "code": "C5",
          "skill": "换色、收边、藏线",
          "pass": "完成杯垫或方形小袋，边缘平整，线头不外露。"
        }
      ],
      "links": [
        {
          "title": "方片毯免费图解与视频",
          "url": "https://www.thepurpleponcho.com/granny-square-blanket/"
        },
        {
          "title": "钩针帽免费图解与视频",
          "url": "https://www.marchingnorth.com/everyday-crochet-beanie-top-down-brimless/"
        },
        {
          "title": "钩针开衫图解与视频",
          "url": "https://wilmade.com/my-first-cardigan/"
        }
      ],
      "figures": [
        "/weaving/fig-2.jpg",
        "/weaving/fig-3.jpg"
      ]
    },
    {
      "id": "sewing",
      "code": "S",
      "name": "手缝与衣物修补",
      "summary": "通用能力：回针、藏线、钉扣、补洞与贴补，修好一件旧衣再谈成品。",
      "units": [
        {
          "code": "S1 基础针迹",
          "skill": "平针、回针、藏线、打结",
          "pass": "在布条上缝 10 cm 直线，针距尽量均匀。"
        },
        {
          "code": "S2 功能修补",
          "skill": "钉扣、补开缝、裤脚临时/永久折边",
          "pass": "修好一处旧衣松脱接缝；穿脱拉扯后不裂开。"
        },
        {
          "code": "S3 补洞补丁",
          "skill": "内贴补、外贴补、织补入门",
          "pass": "为不显眼的练习布补 2 cm 小洞；边缘平整不过度拉皱。"
        },
        {
          "code": "S4 衣物维护",
          "skill": "线色匹配、面料方向、熨烫与加固",
          "pass": "写下修补前后照片、问题原因和洗护方式。"
        }
      ],
      "links": [
        {
          "title": "MoMA 衣物修补图文 PDF",
          "url": "https://www.moma.org/momaorg/shared/pdfs/docs/learn/courses/loved-clothes-last.pdf"
        },
        {
          "title": "刺子绣补衣视频",
          "url": "https://www.youtube.com/watch?v=plrmII86LMM"
        },
        {
          "title": "Sarah 手绣针法图库",
          "url": "https://www.embroidery.rocksea.org/reference/picture-dictionary/"
        },
        {
          "title": "V&amp;A 基础刺绣针法图示",
          "url": "https://media.vam.ac.uk/media/documents/legacy_documents/file_upload/55229_file.pdf"
        },
        {
          "title": "十字绣初学者图文指南",
          "url": "https://www.re-imagining.org/wp-content/uploads/2020/07/Cross-stitch.-A-beginners-guide.pdf"
        }
      ],
      "figures": []
    },
    {
      "id": "embroidery",
      "code": "E",
      "name": "刺绣与十字绣",
      "summary": "在布面上造线迹图案：回针、缎面绣、法国结、按格计数做十字绣。",
      "units": [
        {
          "code": "E1 工具与转印",
          "skill": "绣绷张布、分线、结线、描图",
          "pass": "布面平整不松垂；图样线条可辨。"
        },
        {
          "code": "E2 基础针法",
          "skill": "直线绣、回针绣、缎面绣、法国结、链式绣",
          "pass": "完成针法样卡，正面针脚匀，背面不堆结。"
        },
        {
          "code": "E3 十字绣",
          "skill": "格数、图例、换色、回针边线",
          "pass": "先做 20×20 格小图；每 10 格复核一次坐标。"
        },
        {
          "code": "E4 成品与收边",
          "skill": "熨烫保护、书签/布贴/小框装裱",
          "pass": "图案中心、布边留量合适，线头收牢。"
        }
      ],
      "links": [
        {
          "title": "MoMA 衣物修补图文 PDF",
          "url": "https://www.moma.org/momaorg/shared/pdfs/docs/learn/courses/loved-clothes-last.pdf"
        },
        {
          "title": "刺子绣补衣视频",
          "url": "https://www.youtube.com/watch?v=plrmII86LMM"
        },
        {
          "title": "Sarah 手绣针法图库",
          "url": "https://www.embroidery.rocksea.org/reference/picture-dictionary/"
        },
        {
          "title": "V&amp;A 基础刺绣针法图示",
          "url": "https://media.vam.ac.uk/media/documents/legacy_documents/file_upload/55229_file.pdf"
        },
        {
          "title": "十字绣初学者图文指南",
          "url": "https://www.re-imagining.org/wp-content/uploads/2020/07/Cross-stitch.-A-beginners-guide.pdf"
        }
      ],
      "figures": [
        "/weaving/fig-4.jpg"
      ]
    },
    {
      "id": "patchwork",
      "code": "P",
      "name": "布艺与拼布",
      "summary": "裁剪、接缝、压线与收边：从杯垫、书签到方块拼布与贴布。",
      "units": [
        {
          "code": "P1 布料识别",
          "skill": "经纬方向、正反面、缩水与色牢度",
          "pass": "清洗并熨平 3 种边角料，记录手感与缩水情况。"
        },
        {
          "code": "P2 裁剪缝合",
          "skill": "缝份、珠针固定、回针加固、熨烫开缝",
          "pass": "缝 2 片布条，缝份一致，拼接边缘齐平。"
        },
        {
          "code": "P3 拼布排列",
          "skill": "色彩对比、方块拼接、压线",
          "pass": "制作 4–9 格拼布杯垫；角点对齐，边缘收口整洁。"
        },
        {
          "code": "P4 贴布与应用",
          "skill": "贴布、包边、挂环、内衬",
          "pass": "完成布书签、小收纳袋或针插。"
        }
      ],
      "links": [
        {
          "title": "Janome 四片拼布杯垫图文教程",
          "url": "https://www.janome.com/inspire/projects/easy-four-patch-coasters/"
        },
        {
          "title": "四片拼布杯垫视频教程",
          "url": "https://www.youtube.com/watch?v=ZwIhiu54UQk"
        }
      ],
      "figures": [
        "/weaving/fig-5.jpg"
      ]
    },
    {
      "id": "cord",
      "code": "R",
      "name": "编绳",
      "summary": "对张力与重复节奏的训练：平结、斜卷结、蛇结与收尾。",
      "units": [
        {
          "code": "R1",
          "skill": "量线、固定中心线、保持张力",
          "pass": "双色平结手绳；左右结交替，宽度一致。"
        },
        {
          "code": "R2",
          "skill": "斜卷结、蛇结、四股编",
          "pass": "钥匙挂件；扣环牢固，尾端处理干净。"
        },
        {
          "code": "R3",
          "skill": "配色、珠子、组合结",
          "pass": "杯垫或小挂饰；线头隐藏，结构不松散。"
        }
      ],
      "links": [
        {
          "title": "Macrame 平结图文步骤",
          "url": "https://macrameforbeginners.com/square-knot-tutorial-macrame-knot-guide/"
        },
        {
          "title": "平结手绳制作步骤",
          "url": "https://www.shopgiraa.com/blogs/news/how-to-make-a-macrame-bracelet"
        },
        {
          "title": "Domestika 平结图解",
          "url": "https://www.domestika.org/en/blog/7790-macrame-tutorial-how-to-tie-a-square-knot-step-by-step"
        }
      ],
      "figures": []
    },
    {
      "id": "felt",
      "code": "F",
      "name": "羊毛毡",
      "summary": "针毡与湿毡两条路：纤维交缠塑形，做平面、立体小物与配件。",
      "units": [
        {
          "code": "F1 针毡安全",
          "skill": "泡沫垫、单针垂直刺、手指避开针尖",
          "pass": "做 5×5 cm 平毡片，表面纤维基本贴合。"
        },
        {
          "code": "F2 立体塑形",
          "skill": "分层加毛、滚动塑圆、局部加固",
          "pass": "制作简单蘑菇/水果小摆件，能独立站立或悬挂。"
        },
        {
          "code": "F3 湿毡体验",
          "skill": "羊毛铺层、温水皂液、轻压滚动",
          "pass": "制一片缩绒样布，记录干湿尺寸变化。"
        },
        {
          "code": "F4 组合应用",
          "skill": "针毡装饰、刺绣点缀、缝合配件",
          "pass": "完成胸针/挂饰并牢固安装配件。"
        }
      ],
      "links": [
        {
          "title": "针毡初学视频",
          "url": "https://www.youtube.com/watch?v=baccjU-Ha4g"
        },
        {
          "title": "针毡新手项目视频集合",
          "url": "https://thefelthub.com/beginner-needle-felting-video-tutorials-start-with-confidence/"
        },
        {
          "title": "Erindale 入门针毡教程",
          "url": "https://erindaletapestrystudio.com/tutorials/tutorials-needlefelting/"
        }
      ],
      "figures": [
        "/weaving/fig-6.jpg"
      ]
    }
  ],
  "projects": [
    {
      "name": "基础长围巾",
      "size": "宽 18–24 × 长 150–180 cm",
      "level": "入门",
      "learn": "下针、边针、收针",
      "links": [
        {
          "title": "棒针入门围巾图文与逐步视频",
          "url": "https://nimble-needles.com/patterns/how-to-knit-a-scarf-for-beginners/"
        },
        {
          "title": "Craft Yarn Council 新手流苏围巾图解 PDF",
          "url": "https://www.craftyarncouncil.com/sites/default/files/discover/K62_CYC_Discover-Time-for-Knit-Level-1-Scarf-With-Fringe.pdf"
        },
        {
          "title": "钩针罗纹围巾免费图文与视频",
          "url": "https://offthebeatenhook.com/long-scarf-free-crochet-pattern/"
        },
        {
          "title": "钩针罗纹围巾分段视频",
          "url": "https://www.youtube.com/watch?v=8-TAriLCPLE"
        }
      ]
    },
    {
      "name": "2×2 罗纹围巾",
      "size": "宽 18–22 × 长 140–170 cm",
      "level": "入门",
      "learn": "上下针交替、弹性收针",
      "links": [
        {
          "title": "棒针入门围巾图文与逐步视频",
          "url": "https://nimble-needles.com/patterns/how-to-knit-a-scarf-for-beginners/"
        },
        {
          "title": "Craft Yarn Council 新手流苏围巾图解 PDF",
          "url": "https://www.craftyarncouncil.com/sites/default/files/discover/K62_CYC_Discover-Time-for-Knit-Level-1-Scarf-With-Fringe.pdf"
        },
        {
          "title": "钩针罗纹围巾免费图文与视频",
          "url": "https://offthebeatenhook.com/long-scarf-free-crochet-pattern/"
        },
        {
          "title": "钩针罗纹围巾分段视频",
          "url": "https://www.youtube.com/watch?v=8-TAriLCPLE"
        }
      ]
    },
    {
      "name": "条纹 / 色块围巾",
      "size": "宽 20–25 × 长 150–180 cm",
      "level": "入门到进阶",
      "learn": "换色、藏线、色彩规划",
      "links": [
        {
          "title": "棒针入门围巾图文与逐步视频",
          "url": "https://nimble-needles.com/patterns/how-to-knit-a-scarf-for-beginners/"
        },
        {
          "title": "Craft Yarn Council 新手流苏围巾图解 PDF",
          "url": "https://www.craftyarncouncil.com/sites/default/files/discover/K62_CYC_Discover-Time-for-Knit-Level-1-Scarf-With-Fringe.pdf"
        },
        {
          "title": "钩针罗纹围巾免费图文与视频",
          "url": "https://offthebeatenhook.com/long-scarf-free-crochet-pattern/"
        },
        {
          "title": "钩针罗纹围巾分段视频",
          "url": "https://www.youtube.com/watch?v=8-TAriLCPLE"
        }
      ]
    },
    {
      "name": "圈织脖套",
      "size": "围度 55–70 × 高 22–35 cm",
      "level": "初级",
      "learn": "环形起针、防扭转",
      "links": [
        {
          "title": "棒针入门围巾图文与逐步视频",
          "url": "https://nimble-needles.com/patterns/how-to-knit-a-scarf-for-beginners/"
        },
        {
          "title": "Craft Yarn Council 新手流苏围巾图解 PDF",
          "url": "https://www.craftyarncouncil.com/sites/default/files/discover/K62_CYC_Discover-Time-for-Knit-Level-1-Scarf-With-Fringe.pdf"
        },
        {
          "title": "钩针罗纹围巾免费图文与视频",
          "url": "https://offthebeatenhook.com/long-scarf-free-crochet-pattern/"
        },
        {
          "title": "钩针罗纹围巾分段视频",
          "url": "https://www.youtube.com/watch?v=8-TAriLCPLE"
        }
      ],
      "figure": "/weaving/fig-7.jpg"
    },
    {
      "name": "三角披肩",
      "size": "最长边 140–190 cm",
      "level": "初中级",
      "learn": "加针、记号扣、重复图样",
      "links": [
        {
          "title": "棒针入门围巾图文与逐步视频",
          "url": "https://nimble-needles.com/patterns/how-to-knit-a-scarf-for-beginners/"
        },
        {
          "title": "Craft Yarn Council 新手流苏围巾图解 PDF",
          "url": "https://www.craftyarncouncil.com/sites/default/files/discover/K62_CYC_Discover-Time-for-Knit-Level-1-Scarf-With-Fringe.pdf"
        },
        {
          "title": "钩针罗纹围巾免费图文与视频",
          "url": "https://offthebeatenhook.com/long-scarf-free-crochet-pattern/"
        },
        {
          "title": "钩针罗纹围巾分段视频",
          "url": "https://www.youtube.com/watch?v=8-TAriLCPLE"
        }
      ]
    },
    {
      "name": "插肩毛衣",
      "size": "按量体定尺码",
      "level": "进阶",
      "learn": "密度、育克加针、分袖、试穿",
      "links": [
        {
          "title": "Tin Can Knits Flax 插肩毛衣图解与教程",
          "url": "https://blog.tincanknits.com/2013/10/25/lets-knit-a-sweater/"
        },
        {
          "title": "Flax 毛衣视频第 1 部分",
          "url": "https://www.youtube.com/watch?v=B-D2kFUUhtI"
        },
        {
          "title": "Flax 毛衣视频第 2 部分",
          "url": "https://www.youtube.com/watch?v=WlEOT6WKp-8"
        },
        {
          "title": "Purl Soho 插肩毛衣免费图解",
          "url": "https://www.purlsoho.com/create/2022/01/18/lightweight-raglan-pullover-in-new-colors/"
        },
        {
          "title": "Purl Soho 插肩毛衣视频答疑与技法",
          "url": "https://www.purlsoho.com/create/zoom-knit-lightweight-raglan-pullover/"
        }
      ],
      "figure": "/weaving/fig-8.jpg"
    },
    {
      "name": "Granny 方片毯",
      "size": "按目标边长拼片",
      "level": "初级",
      "learn": "长针簇、角部加针、拼接",
      "links": [
        {
          "title": "方片毯免费图解与视频",
          "url": "https://www.thepurpleponcho.com/granny-square-blanket/"
        },
        {
          "title": "钩针帽免费图解与视频",
          "url": "https://www.marchingnorth.com/everyday-crochet-beanie-top-down-brimless/"
        },
        {
          "title": "钩针开衫图解与视频",
          "url": "https://wilmade.com/my-first-cardigan/"
        }
      ]
    },
    {
      "name": "合身钩针帽",
      "size": "头围 ÷ 3.14 算帽顶",
      "level": "初级",
      "learn": "圆片加针、帽身、帽檐",
      "links": [
        {
          "title": "方片毯免费图解与视频",
          "url": "https://www.thepurpleponcho.com/granny-square-blanket/"
        },
        {
          "title": "钩针帽免费图解与视频",
          "url": "https://www.marchingnorth.com/everyday-crochet-beanie-top-down-brimless/"
        },
        {
          "title": "钩针开衫图解与视频",
          "url": "https://wilmade.com/my-first-cardigan/"
        }
      ]
    },
    {
      "name": "牛仔补丁与刺子绣",
      "size": "覆盖磨损区",
      "level": "入门",
      "learn": "内贴补、平针交织",
      "links": [
        {
          "title": "MoMA 衣物修补图文 PDF",
          "url": "https://www.moma.org/momaorg/shared/pdfs/docs/learn/courses/loved-clothes-last.pdf"
        },
        {
          "title": "刺子绣补衣视频",
          "url": "https://www.youtube.com/watch?v=plrmII86LMM"
        },
        {
          "title": "Sarah 手绣针法图库",
          "url": "https://www.embroidery.rocksea.org/reference/picture-dictionary/"
        },
        {
          "title": "V&amp;A 基础刺绣针法图示",
          "url": "https://media.vam.ac.uk/media/documents/legacy_documents/file_upload/55229_file.pdf"
        },
        {
          "title": "十字绣初学者图文指南",
          "url": "https://www.re-imagining.org/wp-content/uploads/2020/07/Cross-stitch.-A-beginners-guide.pdf"
        }
      ]
    },
    {
      "name": "手绣布贴",
      "size": "按图样定",
      "level": "入门",
      "learn": "回针、缎面绣、收边",
      "links": [
        {
          "title": "MoMA 衣物修补图文 PDF",
          "url": "https://www.moma.org/momaorg/shared/pdfs/docs/learn/courses/loved-clothes-last.pdf"
        },
        {
          "title": "刺子绣补衣视频",
          "url": "https://www.youtube.com/watch?v=plrmII86LMM"
        },
        {
          "title": "Sarah 手绣针法图库",
          "url": "https://www.embroidery.rocksea.org/reference/picture-dictionary/"
        },
        {
          "title": "V&amp;A 基础刺绣针法图示",
          "url": "https://media.vam.ac.uk/media/documents/legacy_documents/file_upload/55229_file.pdf"
        },
        {
          "title": "十字绣初学者图文指南",
          "url": "https://www.re-imagining.org/wp-content/uploads/2020/07/Cross-stitch.-A-beginners-guide.pdf"
        }
      ]
    },
    {
      "name": "拼布杯垫",
      "size": "4–9 格方块",
      "level": "入门",
      "learn": "缝份、对格、包边",
      "links": [
        {
          "title": "Janome 四片拼布杯垫图文教程",
          "url": "https://www.janome.com/inspire/projects/easy-four-patch-coasters/"
        },
        {
          "title": "四片拼布杯垫视频教程",
          "url": "https://www.youtube.com/watch?v=ZwIhiu54UQk"
        }
      ]
    },
    {
      "name": "平结手绳 / 植物吊篮",
      "size": "按腕围 / 盆径",
      "level": "入门",
      "learn": "平结、张力、收尾",
      "links": [
        {
          "title": "Macrame 平结图文步骤",
          "url": "https://macrameforbeginners.com/square-knot-tutorial-macrame-knot-guide/"
        },
        {
          "title": "平结手绳制作步骤",
          "url": "https://www.shopgiraa.com/blogs/news/how-to-make-a-macrame-bracelet"
        },
        {
          "title": "Domestika 平结图解",
          "url": "https://www.domestika.org/en/blog/7790-macrame-tutorial-how-to-tie-a-square-knot-step-by-step"
        }
      ]
    },
    {
      "name": "针毡小物",
      "size": "5×5 cm 起",
      "level": "入门",
      "learn": "垂直刺、分层塑形、装配件",
      "links": [
        {
          "title": "针毡初学视频",
          "url": "https://www.youtube.com/watch?v=baccjU-Ha4g"
        },
        {
          "title": "针毡新手项目视频集合",
          "url": "https://thefelthub.com/beginner-needle-felting-video-tutorials-start-with-confidence/"
        },
        {
          "title": "Erindale 入门针毡教程",
          "url": "https://erindaletapestrystudio.com/tutorials/tutorials-needlefelting/"
        }
      ]
    }
  ],
  "materials": [
    {
      "name": "棉线 / 棉布",
      "use": "杯垫、方巾、拼布、刺绣样布",
      "note": "耐洗、结构清楚；中等粗细棉线最利于看清针目。"
    },
    {
      "name": "羊毛 / 羊毛混纺",
      "use": "围巾、帽子、毛衣、针毡",
      "note": "弹性和保暖性较好；先看洗护标签。羊毛毡适合针毡/湿毡，不宜当作普通针织线替代。"
    },
    {
      "name": "腈纶 / 混纺线",
      "use": "练习样片、毯子、玩偶",
      "note": "价格亲民、易清洁；不同品牌粗细会有差别，先做密度样片。"
    },
    {
      "name": "真丝 / 蚕丝线",
      "use": "刺绣、细节装饰、轻薄披肩或织物",
      "note": "光泽细腻但较滑、易勾丝，初学可先用较粗的真丝混纺或短段绣线；使用光滑针、减少摩擦并按标签冷水轻柔洗护。"
    },
    {
      "name": "亚麻 / 麻棉",
      "use": "袋物、餐垫、夏季织物",
      "note": "挺括、耐用但弹性小；控制手劲，避免织片过紧。"
    },
    {
      "name": "Aida 格布 / 棉麻平纹布",
      "use": "十字绣、刺绣",
      "note": "十字绣选格目清楚、颜色浅的布；普通刺绣先用中等密度平纹棉布。"
    },
    {
      "name": "旧衣 / 旧床单 / 边角料",
      "use": "补丁、拼布、练习布",
      "note": "先洗净、熨平、确认颜色牢度；新旧布缩水率不同时先预洗。"
    }
  ],
  "tools": [
    {
      "area": "棒针",
      "core": "一副 4–5 mm 直针或环针、记号圈、卷尺、钝头缝合针、剪刀",
      "later": "整套多尺寸针、昂贵木针"
    },
    {
      "area": "钩针",
      "core": "4–5 mm 钩针、棉线或中粗线、记号扣、剪刀",
      "later": "多套花式钩针"
    },
    {
      "area": "缝补/拼布",
      "core": "手缝针（中号）、线、布剪、珠针/夹子、软尺、熨斗",
      "later": "大型裁切垫与旋转刀（做大批拼布再添）"
    },
    {
      "area": "刺绣/十字绣",
      "core": "绣针、绣绷、绣线、浅色布；十字绣另备格布和图纸",
      "later": "整套线号全色包"
    },
    {
      "area": "编绳",
      "core": "棉绳/蜡线、卷尺、胶带或夹板、剪刀",
      "later": "专业编绳架"
    },
    {
      "area": "羊毛毡",
      "core": "羊毛条、专用毡针、泡沫垫；湿毡另备温水与皂液",
      "later": "多针握把，熟悉单针后再添"
    }
  ],
  "images": [
    {
      "src": "/weaving/fig-1.jpg",
      "caption": "棒针针法与样片"
    },
    {
      "src": "/weaving/fig-2.jpg",
      "caption": "钩针起针与短针"
    },
    {
      "src": "/weaving/fig-3.jpg",
      "caption": "钩针图解符号"
    },
    {
      "src": "/weaving/fig-4.jpg",
      "caption": "刺绣针法样卡"
    },
    {
      "src": "/weaving/fig-5.jpg",
      "caption": "拼布拼接与压线"
    },
    {
      "src": "/weaving/fig-6.jpg",
      "caption": "羊毛毡塑形"
    },
    {
      "src": "/weaving/fig-7.jpg",
      "caption": "圈织脖套"
    },
    {
      "src": "/weaving/fig-8.jpg",
      "caption": "插肩毛衣育克"
    }
  ],
  "resources": [
    {
      "title": "棒针入门围巾图文与逐步视频",
      "url": "https://nimble-needles.com/patterns/how-to-knit-a-scarf-for-beginners/",
      "group": "围巾与披肩"
    },
    {
      "title": "Craft Yarn Council 新手流苏围巾图解 PDF",
      "url": "https://www.craftyarncouncil.com/sites/default/files/discover/K62_CYC_Discover-Time-for-Knit-Level-1-Scarf-With-Fringe.pdf",
      "group": "围巾与披肩"
    },
    {
      "title": "钩针罗纹围巾免费图文与视频",
      "url": "https://offthebeatenhook.com/long-scarf-free-crochet-pattern/",
      "group": "围巾与披肩"
    },
    {
      "title": "钩针罗纹围巾分段视频",
      "url": "https://www.youtube.com/watch?v=8-TAriLCPLE",
      "group": "围巾与披肩"
    },
    {
      "title": "Tin Can Knits Flax 插肩毛衣图解与教程",
      "url": "https://blog.tincanknits.com/2013/10/25/lets-knit-a-sweater/",
      "group": "毛衣"
    },
    {
      "title": "Flax 毛衣视频第 1 部分",
      "url": "https://www.youtube.com/watch?v=B-D2kFUUhtI",
      "group": "毛衣"
    },
    {
      "title": "Flax 毛衣视频第 2 部分",
      "url": "https://www.youtube.com/watch?v=WlEOT6WKp-8",
      "group": "毛衣"
    },
    {
      "title": "Purl Soho 插肩毛衣免费图解",
      "url": "https://www.purlsoho.com/create/2022/01/18/lightweight-raglan-pullover-in-new-colors/",
      "group": "毛衣"
    },
    {
      "title": "Purl Soho 插肩毛衣视频答疑与技法",
      "url": "https://www.purlsoho.com/create/zoom-knit-lightweight-raglan-pullover/",
      "group": "毛衣"
    },
    {
      "title": "方片毯免费图解与视频",
      "url": "https://www.thepurpleponcho.com/granny-square-blanket/",
      "group": "钩针作品"
    },
    {
      "title": "钩针帽免费图解与视频",
      "url": "https://www.marchingnorth.com/everyday-crochet-beanie-top-down-brimless/",
      "group": "钩针作品"
    },
    {
      "title": "钩针开衫图解与视频",
      "url": "https://wilmade.com/my-first-cardigan/",
      "group": "钩针作品"
    },
    {
      "title": "MoMA 衣物修补图文 PDF",
      "url": "https://www.moma.org/momaorg/shared/pdfs/docs/learn/courses/loved-clothes-last.pdf",
      "group": "修补与刺绣"
    },
    {
      "title": "刺子绣补衣视频",
      "url": "https://www.youtube.com/watch?v=plrmII86LMM",
      "group": "修补与刺绣"
    },
    {
      "title": "Sarah 手绣针法图库",
      "url": "https://www.embroidery.rocksea.org/reference/picture-dictionary/",
      "group": "修补与刺绣"
    },
    {
      "title": "V&amp;A 基础刺绣针法图示",
      "url": "https://media.vam.ac.uk/media/documents/legacy_documents/file_upload/55229_file.pdf",
      "group": "修补与刺绣"
    },
    {
      "title": "十字绣初学者图文指南",
      "url": "https://www.re-imagining.org/wp-content/uploads/2020/07/Cross-stitch.-A-beginners-guide.pdf",
      "group": "修补与刺绣"
    },
    {
      "title": "Janome 四片拼布杯垫图文教程",
      "url": "https://www.janome.com/inspire/projects/easy-four-patch-coasters/",
      "group": "拼布与布艺"
    },
    {
      "title": "四片拼布杯垫视频教程",
      "url": "https://www.youtube.com/watch?v=ZwIhiu54UQk",
      "group": "拼布与布艺"
    },
    {
      "title": "Macrame 平结图文步骤",
      "url": "https://macrameforbeginners.com/square-knot-tutorial-macrame-knot-guide/",
      "group": "编绳"
    },
    {
      "title": "平结手绳制作步骤",
      "url": "https://www.shopgiraa.com/blogs/news/how-to-make-a-macrame-bracelet",
      "group": "编绳"
    },
    {
      "title": "Domestika 平结图解",
      "url": "https://www.domestika.org/en/blog/7790-macrame-tutorial-how-to-tie-a-square-knot-step-by-step",
      "group": "编绳"
    },
    {
      "title": "针毡初学视频",
      "url": "https://www.youtube.com/watch?v=baccjU-Ha4g",
      "group": "羊毛毡"
    },
    {
      "title": "针毡新手项目视频集合",
      "url": "https://thefelthub.com/beginner-needle-felting-video-tutorials-start-with-confidence/",
      "group": "羊毛毡"
    },
    {
      "title": "Erindale 入门针毡教程",
      "url": "https://erindaletapestrystudio.com/tutorials/tutorials-needlefelting/",
      "group": "羊毛毡"
    },
    {
      "title": "Craft Yarn Council 学习中心",
      "url": "https://craftyarncouncil.com/",
      "group": "公开资源"
    },
    {
      "title": "Craft Yarn Council 钩针课件 PDF",
      "url": "https://media.craftyarncouncil.com/files/teach/D003_CYCCrochetLessonPlan_1.pdf",
      "group": "公开资源"
    },
    {
      "title": "Sarah’s Hand Embroidery 刺绣图库",
      "url": "https://www.embroidery.rocksea.org/",
      "group": "公开资源"
    },
    {
      "title": "中国丝绸博物馆 手工刺绣课堂",
      "url": "https://www.chinasilkmuseum.com/ngcxg/info_11.aspx?itemid=26363",
      "group": "公开资源"
    },
    {
      "title": "Anchorage Museum CoLab Embroidery",
      "url": "https://www.anchoragemuseum.org/programs/for-educators/online-resources/colab-embroidery/",
      "group": "公开资源"
    }
  ],
  "miscResources": [
    {
      "title": "Craft Yarn Council 学习中心",
      "url": "https://craftyarncouncil.com/"
    },
    {
      "title": "Craft Yarn Council 钩针课件 PDF",
      "url": "https://media.craftyarncouncil.com/files/teach/D003_CYCCrochetLessonPlan_1.pdf"
    },
    {
      "title": "Sarah’s Hand Embroidery 刺绣图库",
      "url": "https://www.embroidery.rocksea.org/"
    },
    {
      "title": "中国丝绸博物馆 手工刺绣课堂",
      "url": "https://www.chinasilkmuseum.com/ngcxg/info_11.aspx?itemid=26363"
    },
    {
      "title": "Anchorage Museum CoLab Embroidery",
      "url": "https://www.anchoragemuseum.org/programs/for-educators/online-resources/colab-embroidery/"
    }
  ]
}
