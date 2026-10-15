# `legacy/` — 已停用的 Java 后端（归档）

**这个目录里的东西都不参与构建、不参与部署，也不该再改。** 保留它只是为了可追溯：
里面有一整套曾经上线过的实现和当时的取舍记录。

## 为什么会有这个目录

项目最初是「Java 21 + Spring Boot + MySQL + MinIO」的架构。后来整体换成了
**Supabase（Auth + Postgres + Storage）**，前端通过 `frontend/src/services/api.js`
这个「后端模拟器」直接和 Supabase 对话——**没有后端服务器了**。

- CI（`.github/workflows/deploy-pages.yml`）只构建 `frontend/`。
- 上线说明 [`deploy/HOSTING.md`](../deploy/HOSTING.md) 描述的也是 Supabase 链路。
- 现在唯一还「活着」的验证脚本都在 `frontend/scripts/` 下。

## 里面是什么

| 路径 | 原来是什么 |
| --- | --- |
| `backend/` | Spring Boot 服务：账号 / JWT、日记、文章、媒体、绩效工作区、S3 签名。含 H2 集成测试与 Flyway 迁移。 |
| `db/schema.sql` | MySQL 手工建库脚本（当时就标注「仅供阅读，正式建表以 Flyway 为准」）。 |
| `Dockerfile` / `render.yaml` | 把 Java 服务部署到 Render 的配置。 |
| `deploy/production.env.example`、`deploy/minio-cors.json`、`deploy/r2-cors.json` | 当时那套部署的环境变量模板与对象存储 CORS 配置。 |
| `verify-backend.mjs`、`verify-backend-deps.mjs`、`verify-backend-e2e.mjs`、`verify-perf-e2e.mjs` | 后端静态检查 / 依赖坐标核对 / 对已启动 API 的端到端检查。 |
| `export-xlsx.mjs` | **不是项目工具，而且已经跑不起来了。** 它是一次性补丁脚本，靠字符串锚点往 `PerfPanel.vue` 里 splice 一段导出 Excel 的实现。绩效页拆分后那段逻辑已经搬进 `pages/perf/composables/usePerfExport.js`，脚本要找的锚点 `function exportCsv()` 不复存在——现在直接跑会输出 `EXPORT ANCHOR MISSING` 并以 1 退出。同类的一次性脚本一共 79 个，在结构重排时已经删掉，只剩它还被留在仓库里；**建议一并删除**（删掉不影响任何东西，`git log -- legacy/export-xlsx.mjs` 随时能翻出来）。 |

## 想把它跑起来的话

`legacy/backend` 仍然是一个完整的 Maven 工程，但注意：

- 脚本里的相对路径已经跟着移动改过了（例如 `verify-backend.mjs` 里指向 `./backend/src/...`
  的常量现在是 `./legacy/backend/...`），但如果要真的运行，仍需重新核对。
- `legacy/backend/target/` 是构建产物，已经在 `.gitignore` 里。

## 什么时候可以删掉

当「这套实现不会再被参考」的时候。删掉不影响任何构建与部署——git 历史里也还在，
真要用 `git log -- legacy/backend` 就能翻出来。
