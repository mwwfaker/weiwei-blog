# `supabase/` — 数据层（权威来源）

**这里才是数据库结构的权威定义。** `legacy/db/schema.sql` 是当年 MySQL 的建库脚本，
早已停用，不要照着它改。

| 文件 | 是什么 |
| --- | --- |
| `schema.sql` | **权威结构**：表、索引、RLS 策略、存储桶策略。可重复执行（`create ... if not exists` / `drop policy if exists`）。 |
| `apply.mjs` | 把 `schema.sql` 逐条执行到 Supabase 项目上（需要管理令牌）。 |
| `verify-schema.mjs` | **只读复查**：表和列是不是都在了。只用公开的 anon key，本地和 CI 都能跑。 |
| `functions/lyrics/index.ts` | 歌词中转 Edge Function。 |

## 为什么权限写在数据库里

前端**不做**访问控制。规则全部落在 RLS 策略上：

- 读：任何人（含未登录）都能读 `visibility = 'public'` 的行；登录用户额外能读自己名下的全部行。
- 写：只能改自己名下的行。

这样前端就算被改坏、或者有人直接拿 anon key 调 REST 接口，也读不到别人的私密内容。
anon key 本来就会打进前端产物，这是设计如此——它不是一个秘密，**不要把它当成秘密**。

## 应用结构变更

**自动化（推荐，也是长期方案）**：改完 `schema.sql` 推送即可 —— GitHub Actions 的
**Apply database schema**（[.github/workflows/apply-schema.yml](../.github/workflows/apply-schema.yml)）
会执行它并复查结果。这需要**一次性**往仓库里加一个 Secret：

```
Settings → Secrets and variables → Actions → Secrets → New repository secret
名字：SUPABASE_ACCESS_TOKEN      值：Supabase → Account → Access Tokens 的 sbp_ 令牌
```

**令牌放 Secrets，不放 Variables。** Variables 是明文可读的（`VITE_SUPABASE_URL` 这类
故意放那里，因为 anon key 本来就该公开）；管理令牌能管你整个 Supabase 账号，必须放加密存储。
也**不要**自己"加密后把密文提交进仓库"：解密口令仍然得放在某个 Secret 里才跑得起来，
信任边界没变，却多了一份可能把明文写进日志的自制代码。

**手动执行**：

```powershell
$env:SUPABASE_ACCESS_TOKEN='sbp_...'   # Supabase → Account → Access Tokens
node supabase/apply.mjs
```

`apply.mjs` 是**逐条**执行的，不是把整份脚本一次提交。原因是官方 Management API 在整份提交时
失败往往只回一个空的 400，逐条跑才能确切知道是哪一句、为什么失败。
它的语句切分认得 `$$ ... $$` 函数体、单引号字符串和注释，不会在中间断开。

**跑完必须复查一次**（结构与线上是两份会各自漂移的东西）：

```bash
node supabase/verify-schema.mjs     # 只用公开的 anon key，不需要任何机密
```

它逐张表探测"存不存在"（PostgREST 对不存在的表回 `404 PGRST205`、对不存在的列回 `400`）。
**加表或加列时，记得把它里面的 `TABLES` / `COLUMN_SETS` 也补一行** ——
否则"新表没建"这件事不会被发现。
（第一次跑就抓到了 `media_assets.lyrics` / `lyrics_source` 从来没进过数据库。）

改完结构记得跑一次数据层测试：

```bash
cd frontend
$env:SUPABASE_URL='https://<ref>.supabase.co'
$env:SUPABASE_ANON_KEY='...'
npm run verify:supabase      # 27 项真实数据层与权限隔离测试
```

## 歌词中转

中文歌词覆盖最好的那个源不返回 CORS 头，而且需要带 `Referer` / `Cookie`——这些在浏览器里都设不了。
所以把它放到 Edge Function 里转发：

```bash
supabase functions deploy lyrics --no-verify-jwt
```

然后把地址填进前端环境变量（见 `frontend/.env.example` 的 `VITE_LYRICS_PROXY`）。
**不部署也能用**：前端会自动跳过这条源，只用 LRCLIB 自动匹配 + 手动粘贴，功能正常、不报错。
