# pages/study/data/life —— 《高性价比人生指南》34 章全文

每份 `chNN.js` 对应 GitHub 上 `eternity4719/HowToLiveBetter` 的一章，**逐条原文，未改写**：
标题、成本、说人话、收益、证据等级、来源、备注。

```js
export default {
  no: 4, title: '不要浪费时间', intro: '……',
  items: [{ t: '标题', cost: '……', plain: '……', benefit: '……', evidence: 'A', source: '……', note: '……' }],
}
```

## 这些东西是生成的

由 `gen-life.mjs`（在项目外的 `.build-tools/`）从上游 markdown 转换而来，**不要手改**：
上游更新时重新跑一次生成脚本即可。

## 为什么分开 34 个文件

合计 2.3 MB。学习页只读 `../lifeIndex.js`（每章的标题与条目名，约 100 KB），
点「读这一章全文」时才通过 `../lifeChunks.js` 里显式列出的动态 import 取那一章（约 70 KB）。

**别改成 `import.meta.glob('./life/*.js')`**：静态检查的孤儿文件项不认 glob 模式，
会把这 34 个文件全报成「没有任何地方引用」；显式列出来的写法一样能按需切包。
