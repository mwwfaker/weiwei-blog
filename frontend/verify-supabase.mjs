/**
 * Supabase 数据层验证脚本（在 Node 里直接跑，不需要浏览器）。
 *
 * 用法（在 frontend 目录下执行，因为要用到那里的 @supabase/supabase-js）：
 *   $env:SUPABASE_URL='https://xxx.supabase.co'; $env:SUPABASE_ANON_KEY='sb_publishable_xxx'; node verify-supabase.mjs
 *
 * 它会把「注册 -> 写 -> 读 -> 权限隔离 -> 清理」整条链路真跑一遍，
 * 重点验证 RLS：别人读不到我的私密内容，公开内容匿名可读。
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('缺少 SUPABASE_URL / SUPABASE_ANON_KEY')
  process.exit(2)
}

const stamp = Date.now()
const password = 'Verify2026!x'
const clientA = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const clientB = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

let pass = 0
let fail = 0
function check(name, ok, detail = '') {
  if (ok) { pass++; console.log(`  [OK]   ${name}${detail ? ' -- ' + detail : ''}`) }
  else { fail++; console.log(`  [FAIL] ${name}${detail ? ' -- ' + detail : ''}`) }
}

async function signUp(client, email, displayName) {
  const { data, error } = await client.auth.signUp({ email, password, options: { data: { display_name: displayName } } })
  if (error) throw new Error(`注册失败：${error.message}`)
  if (!data.session) throw new Error('注册后没有会话：请在 Supabase 关闭 "Confirm email"（Authentication -> Sign In / Providers -> Email）')
  return data.user
}

try {
  console.log('\n=== 1. 注册两个测试账号 ===')
  const emailA = `verify-a-${stamp}@gmail.com`
  const emailB = `verify-b-${stamp}@gmail.com`
  const userA = await signUp(clientA, emailA, '验证账号 A')
  const userB = await signUp(clientB, emailB, '验证账号 B')
  check('账号 A 注册', Boolean(userA?.id), userA?.id)
  check('账号 B 注册', Boolean(userB?.id), userB?.id)

  console.log('\n=== 2. 资料行是否由触发器自动创建 ===')
  const { data: profileA } = await clientA.from('profiles').select('id, display_name').eq('id', userA.id).maybeSingle()
  check('profiles 自动建行', profileA?.id === userA.id, `display_name=${profileA?.display_name}`)

  console.log('\n=== 3. 写入日记（一条公开、一条私密）===')
  const { data: pubDiary, error: e1 } = await clientA.from('diary_entries').insert({
    owner_id: userA.id, title: 'RLS 公开日记', entry_date: '2026-10-08', mood: '平静', weather: '晴',
    visibility: 'PUBLIC', tags: '测试', content: '公开内容，任何人都该看得到。',
  }).select().single()
  check('插入公开日记', !e1, e1?.message)

  const { data: privDiary, error: e2 } = await clientA.from('diary_entries').insert({
    owner_id: userA.id, title: 'RLS 私密日记', entry_date: '2026-10-08', mood: '平静', weather: '阴',
    visibility: 'PRIVATE', tags: '测试', content: '私密内容，只有本人能读。',
  }).select().single()
  check('插入私密日记', !e2, e2?.message)

  console.log('\n=== 4. 文章 / 媒体 ===')
  const { data: article, error: e3 } = await clientA.from('blog_articles').insert({
    owner_id: userA.id, title: 'RLS 验证文章', category: '测试', visibility: 'PUBLIC',
    tags: '测试', excerpt: '摘要', content: '正文', article_date: '2026-10-08',
  }).select().single()
  check('插入公开文章', !e3, e3?.message)

  const { data: media, error: e4 } = await clientA.from('media_assets').insert({
    owner_id: userA.id, kind: 'IMAGE', title: 'RLS 验证图片', album_name: '测试',
    object_key: `users/${userA.id}/images/verify-${stamp}.png`, content_type: 'image/png',
    visibility: 'PUBLIC',
  }).select().single()
  check('插入公开媒体记录', !e4, e4?.message)

  console.log('\n=== 5. 本人能读到自己的全部内容 ===')
  const { data: ownDiaries } = await clientA.from('diary_entries').select('id, visibility')
  check('本人可读自己全部日记', (ownDiaries || []).length === 2, `读到 ${ownDiaries?.length} 条`)

  console.log('\n=== 6. 匿名访客只能读公开内容 ===')
  const { data: anonDiaries } = await anon.from('diary_entries').select('id, visibility')
  check('匿名只看到公开日记', (anonDiaries || []).every((r) => r.visibility === 'PUBLIC'), `读到 ${anonDiaries?.length} 条`)
  const { data: anonArticles } = await anon.from('blog_articles').select('id')
  check('匿名可读公开文章', (anonArticles || []).length >= 1, `读到 ${anonArticles?.length} 条`)

  console.log('\n=== 7. 另一个登录用户读不到我的私密内容 ===')
  const { data: bSees } = await clientB.from('diary_entries').select('id, visibility, title')
  const seesPrivate = (bSees || []).some((r) => r.title === 'RLS 私密日记')
  check('用户 B 读不到 A 的私密日记', !seesPrivate, `B 读到 ${bSees?.length} 条（都该是公开的）`)

  console.log('\n=== 8. 不能冒名写入别人的数据 ===')
  const { error: e5 } = await clientB.from('diary_entries').insert({
    owner_id: userA.id, title: '冒名写入', entry_date: '2026-10-08', visibility: 'PRIVATE', tags: '', content: '',
  })
  check('冒名写入被拒绝', Boolean(e5), e5?.message || '（居然成功了，说明 RLS 有问题）')

  console.log('\n=== 9. 不能修改别人的数据 ===')
  const { data: hacked } = await clientB.from('diary_entries').update({ title: '被改了' }).eq('id', privDiary?.id).select()
  check('修改别人的日记无效', (hacked || []).length === 0)

  console.log('\n=== 10. 绩效工作区整份写入（数据库函数）===')
  const { error: e6 } = await clientA.rpc('save_perf_workspace', {
    incoming_queues: [{ id: 'q1', name: '队列一', kpi: 100 }],
    incoming_members: [{ id: 'm1', name: '张三', email: 'z@example.com', queue: '队列一', requiredHours: 160, transferHours: 2, overtimeHours: 3, tripleHours: 1 }],
    incoming_entries: [
      { id: 'e1', memberId: 'm1', queue: '队列一', actualAht: 12.5, auditCount: 30, tripleCount: 1 },
      { id: 'e2', memberId: '不存在的人', queue: '队列一', actualAht: 1, auditCount: 1, tripleCount: 0 },
    ],
  })
  check('调用 save_perf_workspace', !e6, e6?.message)

  const { data: q } = await clientA.from('perf_queues').select('*').eq('owner_id', userA.id)
  const { data: m } = await clientA.from('perf_members').select('*').eq('owner_id', userA.id)
  const { data: en } = await clientA.from('perf_entries').select('*').eq('owner_id', userA.id)
  check('队列写入正确', (q || []).length === 1 && q[0].client_id === 'q1')
  check('成员写入正确', (m || []).length === 1 && m[0].email === 'z@example.com')
  check('孤儿明细被丢弃', (en || []).length === 1 && en[0].member_client_id === 'm1', `明细 ${en?.length} 条`)

  const { data: anonPerf } = await anon.from('perf_queues').select('owner_id, client_id')
  check('绩效数据匿名可读（按既定设计）', (anonPerf || []).length >= 1, `读到 ${anonPerf?.length} 条`)

  console.log('\n=== 11. 清理测试数据 ===')
  await clientA.from('perf_entries').delete().eq('owner_id', userA.id)
  await clientA.from('perf_members').delete().eq('owner_id', userA.id)
  await clientA.from('perf_queues').delete().eq('owner_id', userA.id)
  await clientA.from('diary_entries').delete().eq('owner_id', userA.id)
  await clientA.from('blog_articles').delete().eq('owner_id', userA.id)
  await clientA.from('media_assets').delete().eq('owner_id', userA.id)
  const { data: left } = await clientA.from('diary_entries').select('id')
  check('测试数据已清理', (left || []).length === 0, `剩余 ${left?.length} 条`)
} catch (error) {
  console.error('\n中断：', error.message)
  fail++
}

console.log(`\n========== 结果：通过 ${pass} 项，失败 ${fail} 项 ==========`)
console.log('注意：测试账号（verify-a-...@gmail.com）会留在 Supabase Auth 里，可在控制台删除。')
process.exit(fail === 0 ? 0 : 1)
