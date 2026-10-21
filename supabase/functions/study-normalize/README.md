# `functions/study-normalize/` — 把学习文档整理成结构化计划

学习页导入 `.docx` 后，前端把**纯文本**发给这个函数，函数调用模型，返回固定 schema 的
计划 JSON（阶段 / 课程 / 重要性 / 时长 / 概念 / 完成标准 / 资源）。

模型 key 只存在 Supabase 的环境变量里，**不进前端**。

## 部署

```bash
supabase functions deploy study-normalize
supabase secrets set STUDY_AI_KEY=sk-...          # 去 chatanywhere 项目页领的免费 key
# 默认就用 chatanywhere 的免费网关 + gpt-4o-mini，不必再设 URL/MODEL
# 想换 DeepSeek / OpenAI 时再设这两个：
# supabase secrets set STUDY_AI_URL=https://api.deepseek.com/v1 STUDY_AI_MODEL=deepseek-chat
```

## 关于「随机生成 key」

**不行。** 这类免费 key 是对方站点按账号签发的，随机字符串会被网关直接拒绝（401/403），
和请求量、期限一起由对方控制。正确的做法只有两步：

1. 打开 [chatanywhere/GPT_API_free](https://github.com/chatanywhere/GPT_API_free)，按页面说明
   用 GitHub 账号领一个免费 key（页面会给 `sk-...`）；
2. 把那个 key 写进 Supabase secrets（就是上面那条命令），别写进仓库、别写进前端。

兼容 OpenAI 格式的网关都能用（DeepSeek 默认；只改 URL / MODEL 即可切到别家）。

## 请求 / 响应

```jsonc
// POST，带登录态（supabase.functions.invoke 会自动带上）
{ "name": "金融学路线.docx", "text": "文档纯文本（最多 6 万字符）" }

// 成功
{ "plan": { "title": "…", "stages": [ { "title": "…", "courses": [ … ] } ] } }

// 失败
{ "error": "可读的中文原因", "detail": "…" }
```

## 为什么要求登录

函数对外是公开地址（anon key 也能调）。这里用 `auth.getUser()` 校验一个真实用户，
避免它被当成免费代理被人刷。没有配置 key 时返回 500 并说明，而不是静默失败。

## 解析失败怎么办

模型偶尔会在 JSON 前后加解释。函数会剥掉 ```json 围栏再解析；仍然失败时返回 502，
前端保留“按文档排版”的兜底版本，不会丢内容。


## key 过期了怎么换（不用重新部署函数）

```bash
cd frontend
$env:STUDY_AI_KEY='sk-新的' ; node scripts/check-study-ai.mjs   # 先在本地确认可用
supabase secrets set STUDY_AI_KEY=sk-新的                        # 写进 Supabase
```

Edge Function 每次调用时读环境变量，所以**换 secret 立即生效**，不需要 `functions deploy`。
页面上表现为：再次导入同一份文档即可；之前按文档排版的那份仍在学习库里。

如果脚本报 401/403 → key 无效或过期；429 → 限额；404 → 网关/模型名不对。三种都在脚本里给了提示。
