// 内置示例内容。
//
// 只在「接口还没答上来」时用来预览，任何一条接口一旦答上来就不再展示（见各 store 的 refresh）。
// 各 id 用字符串，和真实记录的自增数字 id 不会撞车——`media:<id>` 封面/头像引用正是按 id 解析的。
//
// 单独成文件是为了让 store 只剩状态与动作，读起来不用在一屏里跳过四百行 JSON。

export const demoArticles = [
  { id: 1, category: '慢生活', tags: ['日常', '慢生活'], content: '给自己一段没有安排的下午。泡一杯茶，翻几页书，原来留白也是一种答案。', date: '2026.09.18', title: '把生活调成喜欢的亮度', excerpt: '给自己一段没有安排的下午。泡一杯茶，翻几页书，原来留白也是一种答案。', image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=840&q=80', read: '3 分钟阅读' },
  { id: 2, category: '旅行手记', tags: ['旅行', '海边'], content: '在日落前抵达海边，天空慢慢从金色变成蓝紫色。那一刻，我什么也没有想。', date: '2026.08.26', title: '海风经过的那个夏天', excerpt: '在日落前抵达海边，天空慢慢从金色变成蓝紫色。那一刻，我什么也没有想。', image: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=840&q=80', read: '5 分钟阅读' },
  { id: 3, category: '日常片段', tags: ['日常', '音乐'], content: '花市捧回一束洋桔梗，旧唱片转过一面。普通的日子，也有它柔软的回声。', date: '2026.07.09', title: '周末的花与唱片', excerpt: '花市捧回一束洋桔梗，旧唱片转过一面。普通的日子，也有它柔软的回声。', image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=840&q=80', read: '2 分钟阅读' },
]

export const demoPhotos = [
  { image: 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=800&q=80', caption: '花店刚开门的清晨', date: '2026 / 09' },
  { image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=800&q=80', caption: '山谷里慢慢亮起灯', date: '2026 / 08' },
  { image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=80', caption: '在路上的某个傍晚', date: '2026 / 07' },
  { image: 'https://images.unsplash.com/photo-1473116763249-2faaef81ccda?auto=format&fit=crop&w=800&q=80', caption: '海风经过的那个夏天', date: '2026 / 06' },
]

export const demoDiaries = [
  { id: 1, title: '周三，雨停以后', date: '2026-09-30', weather: '🌦', mood: '平静', tags: ['日常', '散步'], visibility: 'PRIVATE', content: '雨停以后，路边的树叶像是刚洗过。绕远路回家，买了一小束白色洋桔梗。今天没有什么特别的事，但也不需要每一天都特别。\n\n晚饭后听了一会儿歌，窗户开着，风刚刚好。' },
  { id: 2, title: '想念海边的风', date: '2026-09-12', weather: '☀️', mood: '开心', tags: ['旅行'], visibility: 'PUBLIC', content: '忽然想起上个月在海边的傍晚。没有行程，也没有赶时间，只是沿着海岸线一直走，等天色变暗。原来我最喜欢的旅行方式，是慢一点。' },
  { id: 3, title: '给未来的一封信', date: '2026-08-28', weather: '☁️', mood: '期待', tags: ['随想'], visibility: 'PRIVATE', content: '嘿，未来的我。希望你还记得现在喜欢的这些小事：早晨的咖啡、旧书的气味，还有把心情认真写下来的习惯。慢慢来，一切都会发生。' },
]

export const demoMessages = [
  { id: 1, name: '小岛', date: '2026-09-26', content: '喜欢这个安静的小世界，祝你每天都有好心情。' },
  { id: 2, name: '阿橘', date: '2026-09-21', content: '“慢一点也没关系”这句话送给最近忙碌的自己。' },
]

export const demoFriends = [
  { name: '纸飞机的信箱', url: 'https://example.com', note: '写字、读书和散步。' },
  { name: '小岛日记', url: 'https://example.org', note: '收藏沿途的风景。' },
]
