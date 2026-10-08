# 上线部署说明

## 一、最终架构（无服务器）

```
GitHub 仓库 ──自动构建──> GitHub Pages    → https://mwwfaker.github.io/weiwei-blog/
                                │
                                └──前端直连──> Supabase
                                                 ├─ Auth     账号与登录
                                                 ├─ Postgres 日记 / 文章 / 媒体记录 / 绩效
                                                 └─ Storage  图片与音乐（桶 weiwei-media）
```

| 层 | 用什么 | 免费额度 | 要信用卡吗 |
| --- | --- | --- | --- |
| 前端静态站 | GitHub Pages | 1 GB 站点 / 100 GB 带宽软限制 | 不要 |
| 账号 | Supabase Auth | 5 万月活 | 不要 |
| 数据库 | Supabase Postgres | 500 MB | 不要 |
| 对象存储 | Supabase Storage | 1 GB 存储 | 不要 |

**没有后端服务器**。原来是 Java（Spring Boot）+ MySQL + MinIO，现在这些都不需要跑了：账号交给 Supabase Auth，
数据存在 Postgres 里，图片音乐放在 Storage。前端通过 [frontend/src/services/api.js](../frontend/src/services/api.js)
这个「后端模拟器」直接和 Supabase 对话 —— 对外仍然是 `request('/api/diaries', ...)`，
所以 App.vue 那些调用点一行都不用改。

访问控制不在前端做，而在数据库的 RLS 策略里：**前端就算被改坏，也读不到别人的私密数据**。

### 为什么换掉 Java 后端

不是不想用，是**免费容器托管在 2025–2026 年基本消失了**。实测结论：

| 平台 | 结果 |
| --- | --- |
| Render | 新账号创建任何服务都强制绑卡（Stripe 验证），银联卡不被接受 |
| Back4App Containers | 不要卡，但**部署后约 50 分钟就被销毁**（日志原文：`The Back4app custom domain has expired for free plan` → `DEPLOYMENT DESTROYED`），只能当试用沙盒 |
| Northflank | 免费档存在，但创建服务时明确提示 `Payment method required` |
| Koyeb / Fly.io / Hugging Face Docker / Zeabur / Glitch | 免费额度已取消或服务关停 |

Supabase 的免费档是少数**不要卡、不销毁、地址稳定**的选择。

## 二、日常维护

**改前端（页面、样式、文案、功能）**：

```powershell
cd D:\a唯唯项目\唯唯博客网
git add -A; git commit -m "改了什么"; git push
```

推送后 GitHub Actions 会自动构建并发布（约 2 分钟）。只要改动落在 `frontend/**`、
`verify-frontend.mjs` 或工作流文件里就会触发；只改 README 之类不会。

> 桌面上有 `唯唯园-推送代码.bat`，双击等价于上面三条命令。

**改数据库结构**：编辑 [supabase/schema.sql](schema.sql) 后执行

```powershell
$env:SUPABASE_ACCESS_TOKEN='sbp_...'   # Supabase 账号 → Access Tokens
node supabase/apply.mjs
```

脚本会逐条执行并报告哪一句失败（整份一起提交时官方接口只回一个空的 400，逐条才看得见原因）。

**改 Supabase 配置**：直接改 `schema.sql` 里的 RLS 策略再跑一次即可，脚本是幂等的
（`create table if not exists` + `drop policy if exists`）。

## 三、Supabase 配置要点

- **项目**：`weiwei-blog`，ref `ossnacjetutqihbbvoau`，区域 `ap-southeast-1`（新加坡）
- **邮箱验证已关闭**（`mailer_autoconfirm = true`）。原来是开启的，但注册后必须点邮件确认链接才能登录，
  而 Supabase 自带发信额度极低（每小时几封），访客基本会卡住。原 Java 后端也是「注册即登录」，行为一致。
- **`site_url` 已设为** `https://mwwfaker.github.io/weiwei-blog/`。
- **前端只需要两个公开变量**（写在仓库 Variables 里，构建时注入）：
  - `VITE_SUPABASE_URL` = `https://ossnacjetutqihbbvoau.supabase.co`
  - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_...`

  这两个值本来就设计成放在前端代码里，被看到没有风险。**`service_role` / secret key 绝对不能进前端。**
- **存储桶 `weiwei-media` 保持私有**，读取一律走 1 小时有效的签名链接（和原来一致）。
  上传只允许写进自己的目录 `users/<自己的 uuid>/...`，写别人目录会被存储策略拒绝。

### 表结构

| 表 | 说明 | 读权限 | 写权限 |
| --- | --- | --- | --- |
| `profiles` | 昵称 / 简介 / 头像（不含邮箱，邮箱从会话取） | 所有人 | 仅本人 |
| `diary_entries` | 日记 | 公开的任何人；私密的仅本人 | 仅本人 |
| `blog_articles` | 文章 | 同上 | 仅本人 |
| `media_assets` | 照片与音乐的元数据 | 同上 | 仅本人 |
| `perf_queues` / `perf_members` / `perf_entries` | 绩效工作区 | **所有人（既定设计，含成员邮箱）** | 仅本人 |

绩效的「整份读、整份写」放在数据库函数 `save_perf_workspace()` 里，一次事务内完成，
不会出现写一半的状态（原来 Java 后端用事务保证，前端一次 POST 做不到，所以下沉到数据库）。

## 四、本机环境

- git 是便携版：`D:\a唯唯项目\_tools\PortableGit`，已加入用户 PATH。
- **这台机器访问 GitHub 必须走本地代理**（Clash，端口 7897），已写进全局 git 配置：

  ```powershell
  git config --global http.proxy  http://127.0.0.1:7897
  git config --global https.proxy http://127.0.0.1:7897
  ```

  关掉代理后如果 git 连不上，用 `--unset http.proxy` / `--unset https.proxy` 去掉。
- **认证用 Personal Access Token + `credential.helper=wincred`**，不要用 Git Credential Manager 的浏览器登录：
  GitHub 的 OAuth 换令牌接口 `github.com/login/oauth/access_token` 在这条线路上会被重置，登录必然失败。
  换令牌后重新写入：

  ```powershell
  "protocol=https`nhost=github.com`nusername=mwwfaker`npassword=<新令牌>`n" | git credential approve
  ```
- 本机**没有** Java、Maven、Docker（现在也用不上了）。Node.js 可用。

## 五、验证

上线前跑过的检查：

- `cd frontend; npm run verify` —— 前端静态检查 7 项（模板标识符、路由、样式完整性等）
- `cd frontend; npm run build` —— 生产构建
- `cd frontend; npm run test:render` —— 16 条路由的 SSR 渲染冒烟测试
- `cd frontend; npm run verify:supabase` —— **19 项真实数据层测试**，需要先设置：

  ```powershell
  $env:SUPABASE_URL='https://ossnacjetutqihbbvoau.supabase.co'
  $env:SUPABASE_ANON_KEY='sb_publishable_...'
  npm run verify:supabase
  ```

  覆盖：注册两个账号 → 资料行自动创建 → 写公开/私密日记与文章媒体 → 本人可读全部 →
  **匿名只能读公开内容** → **另一个登录用户读不到私密日记** → **冒名写入被拒** →
  **改别人的数据无效** → 绩效整份写入与孤儿明细丢弃 → 清理。
  脚本跑完会把测试数据删干净，测试账号留在 Supabase Auth 里（可手动删）。

## 六、已知限制与安全提醒

- **免费额度**：数据库 500 MB、存储 1 GB。图片和音乐占存储，文字数据很小。
  Supabase 免费项目**连续 7 天没有任何请求会暂停**（暂停期间接口不可用，登录一下控制台即可恢复）。
- **中国大陆访问**：GitHub Pages 在国内时快时慢；Supabase 新加坡节点通常可用。
  要让国内稳定访问，需要国内主机 + 域名 + ICP 备案。
- **绩效数据的公开读取是按既定设计做的**：`perf_members` 里含成员姓名和邮箱，
  且匿名可读。如果这些是同事的真实信息，请再确认一次是否真的要公开。
- **旧资源可以清理**：Aiven 的 MySQL、Back4App 的应用现在都不再被使用，想省事可以直接删除；
  `backend/` 目录的 Java 代码保留在仓库里做参考，不再参与部署。

## 七、数据备份

数据都在 Supabase，建议偶尔导出：

- 控制台 → **Database → Backups**（免费档有每日备份，保留期有限）
- 或本机导出：控制台 → **Project Settings → Database → Connection string**，用 `pg_dump`：

  ```powershell
  pg_dump "<连接串>" --no-owner --no-privileges > weiwei-backup.sql
  ```

**不要把免费层当作唯一存档。**

## 八、历史记录：已经废弃的部署尝试

这些配置仍留在仓库里，但**都已失效，不要照着用**：

- [render.yaml](../render.yaml) —— Render 蓝图（需要绑卡）
- [backend/Dockerfile](../backend/Dockerfile)、[Dockerfile](../Dockerfile) —— 旧 Java 后端镜像
  （Back4App 用它部署，免费档约 50 分钟后销毁）
- [deploy/production.env.example](production.env.example) —— 旧 Java 后端的环境变量模板
- [deploy/r2-cors.json](r2-cors.json) —— Cloudflare R2 的跨域配置（R2 需绑卡，未开通）
