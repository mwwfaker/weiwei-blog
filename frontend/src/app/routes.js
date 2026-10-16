// Every page the app renders must have a route here: `go()` pushes a named location, and an
// unmatched name makes vue-router throw instead of navigating. Kept separate from router.js so the
// table can be imported (e.g. by tests) without constructing a browser history.

// The shell renders each page itself from `route.name`, so no route needs a real component. A no-op
// component is supplied anyway: a record without one makes vue-router log a warning on every match.
const NoopView = { name: 'NoopView', render: () => null }

export const routes = [
  { path: '/', name: 'home', component: NoopView },
  { path: '/about', name: 'about', component: NoopView },
  { path: '/study', name: 'study', component: NoopView },
  { path: '/articles', name: 'articles', component: NoopView },
  { path: '/categories', name: 'categories', component: NoopView },
  { path: '/tags', name: 'tags', component: NoopView },
  { path: '/diary', name: 'diary', component: NoopView },
  { path: '/public-diary', name: 'publicDiary', component: NoopView },
  { path: '/gallery', name: 'gallery', component: NoopView },
  { path: '/music', name: 'music', component: NoopView },
  { path: '/messages', name: 'messages', component: NoopView },
  { path: '/friends', name: 'friends', component: NoopView },
  { path: '/archives', name: 'archives', component: NoopView },
  { path: '/admin', name: 'admin', component: NoopView },
  { path: '/perf', name: 'perf', component: NoopView },
  { path: '/account', name: 'account', component: NoopView },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]
