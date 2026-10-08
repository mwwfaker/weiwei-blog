import fs from 'node:fs'
const f = 'frontend/src/style.css'
let css = fs.readFileSync(f, 'utf8')
css = css.trimEnd() + `
/* 标签星图同样只有黑夜写法 */
:root:not(.dark) .tag-cloud{display:flex;flex-wrap:wrap;gap:8px}
:root:not(.dark) .tag-cloud button{
  border:1px solid var(--line);border-radius:999px;cursor:pointer;
  background:color-mix(in srgb,var(--panel) 82%,transparent);color:var(--ink);
  padding:7px 14px;font-size:11.5px;transition:border-color .3s ease,background-color .3s ease;
}
:root:not(.dark) .tag-cloud button:hover{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}
:root:not(.dark) .tag-cloud small{color:var(--muted);font-size:10px}
`
fs.writeFileSync(f, css, 'utf8')
console.log('标签星图已补')
