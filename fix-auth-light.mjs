import fs from 'node:fs'
const f = 'frontend/src/style.css'
const block = `
/* ===== 登录 / 账号页的白天主题写法 =====
   这一页原先整套样式（含布局）都只写在 \`:root.dark\` 下，白天主题下卡片没有
   背景、输入框是白底黑边的默认样式。布局原样搬过来，颜色改走主题变量。 */
:root:not(.dark) .account-page{display:grid;place-items:center;min-height:calc(100vh - 165px)}
:root:not(.dark) .account-card{
  display:grid;grid-template-columns:.9fr 1.1fr;width:min(790px,100%);
  overflow:hidden;border-radius:16px;border:1px solid var(--line);
  background:color-mix(in srgb,var(--panel) 94%,transparent);
}
:root:not(.dark) .account-visual{
  position:relative;min-height:420px;padding:30px;
  background:radial-gradient(circle at 55% 37%,color-mix(in srgb,var(--accent) 22%,transparent),color-mix(in srgb,var(--panel) 94%,transparent));
  border-right:1px solid var(--line);
}
:root:not(.dark) .account-visual>span{
  position:absolute;left:30px;top:30px;width:42px;height:42px;border-radius:50%;
  display:grid;place-items:center;color:var(--accent);
  background:color-mix(in srgb,var(--accent) 14%,transparent);
  border:1px solid color-mix(in srgb,var(--accent) 34%,transparent);
}
:root:not(.dark) .account-visual strong{font-family:var(--serif);font-weight:400;font-size:22px;line-height:1.75;color:var(--ink)}
:root:not(.dark) .account-visual small{font-size:7px;letter-spacing:.18em;color:var(--muted);margin-top:17px;display:block}
:root:not(.dark) .account-form{padding:33px}
:root:not(.dark) .account-form h1{font-family:var(--serif);font-size:23px;font-weight:500;margin:13px 0 8px;color:var(--ink)}
:root:not(.dark) .account-form>p{font-family:var(--serif);font-size:10px;color:var(--muted);line-height:1.8;margin:0 0 19px}
:root:not(.dark) .account-form label{display:grid;gap:6px;color:var(--muted);font-size:9px;margin:12px 0}
:root:not(.dark) .account-form input{
  background:var(--panel-raised);border:1px solid var(--line);color:var(--ink);
  border-radius:9px;padding:10px;font-size:12px;
}
:root:not(.dark) .account-form input::placeholder{color:color-mix(in srgb,var(--muted) 85%,transparent)}
:root:not(.dark) .account-form label small,
:root:not(.dark) .account-note{font-size:8px;color:var(--muted)}
:root:not(.dark) .account-submit{width:100%;margin-top:7px}
:root:not(.dark) .account-switch{display:block;margin:12px auto}
:root:not(.dark) .account-note{display:block;line-height:1.6;text-align:center}
`
fs.writeFileSync(f, fs.readFileSync(f, 'utf8').trimEnd() + '\n' + block, 'utf8')
console.log('登录页白天写法已补')
