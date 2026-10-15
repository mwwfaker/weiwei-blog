# `supabase/functions/lyrics/` — 歌词中转 Edge Function

把中文歌词源的请求从浏览器搬到服务端。**这是可选组件**：不部署它，前端的自动匹配会退到
LRCLIB + 手动粘贴，功能正常、不报错。

## 为什么需要中转

中文歌词覆盖最好的那个源（网易云）有两个问题，都只能靠服务端解决：

1. 它的接口**不返回 CORS 头**，浏览器直连一定被拦；
2. 它需要带 `Referer` / `Cookie`，这些在浏览器里设不了。

## 部署

```bash
supabase functions deploy lyrics --no-verify-jwt
```

然后把地址填进前端环境变量（本地 `.env.local` 或 GitHub 仓库 Variables）：

```
VITE_LYRICS_PROXY=https://<项目 ref>.supabase.co/functions/v1/lyrics
```

## 调用约定

前端 [`services/lyrics.js`](../../../src/services/lyrics.js) 就是按这个来的：

```
GET  ?title=晴天&artist=周杰伦
200  { "lrc": "[00:12.34]…", "source": "netease" }
404  { "error": "没有匹配到歌词" }
```

## 一条必须记住的前提

**网易云的接口不是公开 API，随时可能改。** 所以这个函数里把 LRCLIB 也放在后面兜底——
万一哪天中文源挂了，它至少还能返回一份能用的歌词，而不是整条链路失效。
换源时请保留这个兜底顺序。
