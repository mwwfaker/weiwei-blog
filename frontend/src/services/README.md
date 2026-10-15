# `src/services/` — 与外部打交道

只放「说外面语言」的代码：HTTP、对象存储、歌词接口、OCR、纯计算。**这里不读 Vue 的响应式状态**，
store 把需要的数据当参数传进来。

| 文件 | 干什么 |
| --- | --- |
| `api.js` | 后端 HTTP 请求（含错误信息提取）、S3 签名上传流程、Supabase 客户端。 |
| `lyrics.js` | 歌词四层解析：已存歌词 → 音频内嵌 ID3 → LRCLIB → 中文源中转；含 LRC 解析与当前句定位、`formatClock()`。 |
| `ocr.js` | 绩效表格文本解析器 + 按需加载的 Tesseract OCR。 |
| `perf.js` | 绩效公式（纯函数）与队列默认配置，可单独测试。 |
| `perfApi.js` | 绩效工作区的读写接口封装。 |
| `storage.js` | 可安全失败的 localStorage 读写（数据损坏或超配额都不会白屏）。 |

## 为什么公式要单独放

`perf.js` 与 `lyrics.js` 里的计算逻辑不依赖浏览器也不依赖 Vue，
所以 `verify-perf.mjs`、`verify-lyrics.mjs`、`verify-ocr.mjs` 能直接 import 它们做对拍。
**往这两个文件里加东西时不要引入 DOM 或 store 依赖**，否则那三个对拍脚本会一起失效。
