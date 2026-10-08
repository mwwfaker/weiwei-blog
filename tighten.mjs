import fs from 'node:fs'
const f = 'verify-frontend.mjs'
let s = fs.readFileSync(f, 'utf8')
// 关键词、$ 开头的 Vue 注入、以及对象字面量的键（后面紧跟冒号）都跳过
const oldBuiltins = `const BUILTINS = new Set(['true', 'false', 'null', 'undefined', 'Math', 'Number', 'String', 'Object',
  'Array', 'JSON', 'Date', 'Boolean', 'isNaN', 'parseInt', 'parseFloat', 'console', 'window', 'document',
  '$event', '$refs', '$slots', '$attrs', 'item', 'index', 'key'])`
const newBuiltins = `const BUILTINS = new Set(['true', 'false', 'null', 'undefined', 'Math', 'Number', 'String', 'Object',
  'Array', 'JSON', 'Date', 'Boolean', 'isNaN', 'parseInt', 'parseFloat', 'console', 'window', 'document',
  'in', 'of', 'if', 'else', 'return', 'typeof', 'new', 'delete', 'void', 'this', 'instanceof', 'await',
  'item', 'index', 'key', 'slot', 'props'])`
if (!s.includes(oldBuiltins)) { console.log('BUILTINS ANCHOR MISSING'); process.exit(1) }
s = s.replace(oldBuiltins, newBuiltins)

const oldLoop = `      if (BUILTINS.has(name) || declared.has(name)) continue`
const newLoop = `      if (BUILTINS.has(name) || declared.has(name)) continue
      if (name.startsWith('$')) continue
      // 对象字面量的键：名字后面紧跟冒号
      if (new RegExp('(?<![\\\\w$])' + name + '\\\\s*:').test(cleaned)) continue`
if (!s.includes(oldLoop)) { console.log('LOOP ANCHOR MISSING'); process.exit(1) }
s = s.replace(oldLoop, newLoop)
fs.writeFileSync(f, s, 'utf8')
console.log('已收紧判定')
