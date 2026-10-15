# `deploy/` — 上线说明

| 文件 | 是什么 |
| --- | --- |
| `HOSTING.md` | **上线主文档**：现在的 Supabase 架构、免费额度、部署步骤、上线前检查清单。 |
| `README.md` | 你正在看的这个。 |

## 目录里为什么只剩两个文件

这里原来还有 `production.env.example`、`minio-cors.json`、`r2-cors.json`——它们是
「Java 后端 + 自建 S3」那套架构的环境变量模板和对象存储 CORS 配置。
那套架构已经停用（见 [`legacy/README.md`](../legacy/README.md)），所以一起归档到了 `legacy/deploy/`。

**现在的部署链路只有一条**：前端构建成静态站 → GitHub Pages；
账号、数据库、对象存储全在 Supabase。没有需要自己跑的服务端。

## 快速索引

- 上线的完整步骤与免费额度约束 → [`HOSTING.md`](HOSTING.md)
- 需要配哪些环境变量 → [`../frontend/.env.example`](../frontend/.env.example)（本地）
  与 [`HOSTING.md`](HOSTING.md)（GitHub 仓库 Variables）
- 数据库结构怎么改、怎么应用 → [`../supabase/README.md`](../supabase/README.md)
- 改动前后要跑哪些检查 → [`../frontend/scripts/README.md`](../frontend/scripts/README.md)
