// Every page the app renders must have a route here: `go()` pushes a named location, and an
// unmatched name makes vue-router throw instead of navigating. Kept separate from router.js so the
// table can be imported (e.g. by tests) without constructing a browser history.

// The shell renders each page itself from `route.name`, so no route needs a real component. A no-op
// component is supplied anyway: a record without one makes vue-router log a warning on every match.
const NoopView = { name: 'NoopView', render: () => null }

// `meta.requiresAuth` 由 app/router.js 的守卫读：未登录的人被送到账号页（顺带弹一层说明）。
// `gateName` 只是那句说明里的主语，别把文案写死在守卫里。
export const routes = [
  { path: '/', name: 'home', component: NoopView },
  { path: '/about', name: 'about', component: NoopView },
  { path: '/study', name: 'study', component: NoopView },
  { path: '/articles', name: 'articles', component: NoopView },
  // 文章 / 日记的详情页。
  // 它们不是独立版式：外壳仍然渲染列表页，抽屉由地址决定开不开。
  // 这样链接能分享、刷新能停在原处、浏览器后退等于关掉抽屉。
  { path: '/articles/:id', name: 'articleDetail', component: NoopView, meta: { page: 'articles' } },
  { path: '/diary/:id', name: 'diaryDetail', component: NoopView, meta: { page: 'diary' } },
  { path: '/diary', name: 'diary', component: NoopView },
  { path: '/public-diary', name: 'publicDiary', component: NoopView },
  { path: '/gallery', name: 'gallery', component: NoopView },
  { path: '/gallery/:id', name: 'galleryDetail', component: NoopView, meta: { page: 'gallery' } },
  { path: '/music', name: 'music', component: NoopView },
  { path: '/messages', name: 'messages', component: NoopView },
  { path: '/admin', name: 'admin', component: NoopView },
  { path: '/perf', name: 'perf', component: NoopView, meta: { requiresAuth: true, gateName: '绩效计算器' } },
  { path: '/account', name: 'account', component: NoopView },
  { path: '/tools', name: 'tools', component: NoopView },
  { path: '/clipboard', name: 'clipboard', component: NoopView },
  // 未知地址不再是「静默跳回首页」：那样用户会以为链接有效，只是内容变了。
  // 必须排在最后——vue-router 按顺序匹配。
  { path: '/company', name: 'company', component: NoopView },
  { path: '/:pathMatch(.*)*', name: 'notFound', component: NoopView },
]
