import fs from 'node:fs'
const f = 'frontend/src/style.css'
let css = fs.readFileSync(f, 'utf8')
const block = `
/* ===== 创作管理页的白天主题写法 =====
   这一页原先只写了 \`:root.dark\` 的样式，白天主题下会退回浏览器默认样式
   （按钮是灰色方块、统计卡没有盒子）。这里补一套基于主题变量的浅色写法。
   注意用 \`:root:not(.dark)\` 限定，不要去动黑夜主题已有的样式。 */
:root:not(.dark) .stats-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
:root:not(.dark) .stats-grid article{padding:16px;border-radius:12px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 84%,transparent)}
:root:not(.dark) .stats-grid small{display:block;font-size:9px;letter-spacing:.06em;color:var(--muted)}
:root:not(.dark) .stats-grid strong{display:block;font-family:var(--serif);font-size:26px;font-weight:600;color:var(--accent);margin:3px 0 2px}
:root:not(.dark) .stats-grid span{display:block;font-size:10px;color:var(--muted)}
:root:not(.dark) .quick-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}
:root:not(.dark) .quick-actions button{
  padding:10px 12px;text-align:left;font-size:11.5px;cursor:pointer;
  border:1px solid var(--line);border-radius:9px;
  background:color-mix(in srgb,var(--panel) 82%,transparent);color:var(--ink);
  transition:border-color .3s ease,background-color .3s ease,transform .3s ease;
}
:root:not(.dark) .quick-actions button:hover{transform:translateY(-1px);border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,transparent)}
:root:not(.dark) .admin-panel{border-radius:14px;border:1px solid var(--line);background:color-mix(in srgb,var(--panel) 82%,transparent);padding:18px}
:root:not(.dark) .privacy-toggle{border:1px solid var(--line);border-radius:999px;background:color-mix(in srgb,var(--panel) 82%,transparent);color:var(--ink);padding:7px 14px;font-size:11px;cursor:pointer}
:root:not(.dark) .privacy-toggle.large{padding:8px 18px}
`
fs.writeFileSync(f, css.trimEnd() + '\n' + block, 'utf8')
console.log('已为创作管理页补上白天主题写法')
