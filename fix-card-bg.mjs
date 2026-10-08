import fs from 'node:fs'
const f = 'frontend/src/style.css'
const block = `
/* 这些卡片的背景是 linear-gradient(...)，上面那轮只替换了 \`background:#hex\`，
   所以白天主题下卡片仍然是深色。这里统一按面板色覆盖。 */
:root:not(.dark) .message-card,
:root:not(.dark) .friend-card,
:root:not(.dark) .friend-request,
:root:not(.dark) .guestbook-form,
:root:not(.dark) .archive-month,
:root:not(.dark) .taxonomy-card,
:root:not(.dark) .admin-panel,
:root:not(.dark) .stats-grid article,
:root:not(.dark) .music-row{
  background:color-mix(in srgb,var(--panel) 94%,transparent);
  border:1px solid var(--line);
}
:root:not(.dark) .friend-request strong,
:root:not(.dark) .message-meta strong,
:root:not(.dark) .archive-month h2{color:var(--ink)}
:root:not(.dark) .archive-month h2{color:var(--accent)}
:root:not(.dark) .guestbook-form input,
:root:not(.dark) .guestbook-form textarea,
:root:not(.dark) .friend-request input{
  background:var(--panel-raised);border:1px solid var(--line);color:var(--ink);
  border-radius:9px;padding:9px 12px;font-size:11.5px;
}
:root:not(.dark) .message-avatar,
:root:not(.dark) .friend-mark{background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent)}
`
fs.writeFileSync(f, fs.readFileSync(f, 'utf8').trimEnd() + '\n' + block, 'utf8')
console.log('卡片背景已覆盖')
