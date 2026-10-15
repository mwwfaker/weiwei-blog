# `supabase/` — 数据层（权威来源）

**这里才是数据库结构的权威定义。** `legacy/db/schema.sql` 是当年 MySQL 的建库脚本，
早已停用，不要照着它改。

| 文件 | 是什么 |
| --- | --- |
| `schema.sql` | **权威结构**：表、索引、RLS 策略、存储桶策略。可重复执行（`create ... if not exists` / `drop policy if exists`）。 |
| `apply.mjs` | 把 `schema.sql` 逐条执行到 Supabase 项目上。 |
| `functions/lyrics/index.ts` | 歌词中转 Edge Function。 |

## 为什么权限写在数据库里

前端**不做**访问控制。规则全部落在 RLS 策略上：

- 读：任何人（含未登录）都能读 `visibility = 'public'` 的行；登录用户额外能读自己名下的全部行。
- 写：只能改自己名下的行。

这样前端就算被改坏、或者有人直接拿 anon key 调 REST 接口，也读不到别人的私密内容。
anon key 本来就会打进前端产物，这是设计如此——它不是一个秘密，**不要把它当成秘密**。

## 应用结构变更

```powershell
$env:SUPABASE_ACCESS_TOKEN='sbp_...'   # Supabase → Account → Access Tokens
node supabase/apply.mjs
```

`apply.mjs` 是**逐条**执行的，不是把整份脚本一次提交。原因是官方 Management API 在整份提交时
失败往往只回一个空的 400，逐条跑才能确切知道是哪一句、为什么失败。
它的语句切分认得 `$$ ... $$` 函数体、单引号字符串和注释，不会在中间断开。

改完结构记得跑一次数据层测试：

```bash
cd frontend
$env:SUPABASE_URL='https://<ref>.supabase.co'
$env:SUPABASE_ANON_KEY='...'
npm run verify:supabase      # 19 项真实数据层与权限隔离测试
```

## 歌词中转

中文歌词覆盖最好的那个源不返回 CORS 头，而且需要带 `Referer` / `Cookie`——这些在浏览器里都设不了。
所以把它放到 Edge Function 里转发：

```bash
supabase functions deploy lyrics --no-verify-jwt
```

然后把地址填进前端环境变量（见 `frontend/.env.example` 的 `VITE_LYRICS_PROXY`）。
**不部署也能用**：前端会自动跳过这条源，只用 LRCLIB 自动匹配 + 手动粘贴，功能正常、不报错。
