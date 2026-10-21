// 导航表。页面 id 同时是路由名，两者必须一一对应（`npm run verify` 的第 [2] 项会检查）。
//
// 音乐放在主导航里——之前被收进「更多」，很难找到入口。
// 绩效计算器是独立工具，不占主导航——从「更多」或创作管理页路由进去。
export const navigation = [
  { id: 'home', label: '首页', icon: '⌂' },
  { id: 'study', label: '学习', icon: '✦' },
  { id: 'music', label: '音乐', icon: '♫' },
  { id: 'articles', label: '文章', icon: '✎' },
  { id: 'diary', label: '日记', icon: '❏' },
  { id: 'gallery', label: '相册', icon: '▧' },
]

// 其余页面收在「更多」里。分类 / 标签 / 归档 / 朋友已经删掉（用不上）；
// 绩效计算器收进「工具箱」，工具类页面以后都往那里加。
export const secondaryNavigation = [
  { id: 'admin', label: '创作管理', icon: '⚙' },
  { id: 'tools', label: '工具箱', icon: '▦' },
  { id: 'about', label: '关于我', icon: '✿' },
  { id: 'messages', label: '留言板', icon: '✉' },
]

// 外面要「有哪些页面」应该去问 app/pageRegistry.js 或 app/routes.js，不要从这两张表推。
