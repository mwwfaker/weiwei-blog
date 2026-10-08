// Backend static checks that would otherwise need a JDK/Maven/MySQL to catch:
//   1. Every `${...}` config placeholder used in Java is defined in application.yml or has a default.
//   2. Brace/paren balance per source file (catches a truncated or malformed edit).
//   3. Every API path the frontend calls exists in a controller, with a matching HTTP method.
//   4. Every JPA entity field maps to a column the Flyway migrations actually create.
// Run: node verify-backend.mjs [--routes] [--debug-yml]      (no JDK or Maven required)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = new URL('./', import.meta.url)
const srcDir = fileURLToPath(new URL('./backend/src/main/java/com/weiwei/blog/api', root))
const ymlPath = fileURLToPath(new URL('./backend/src/main/resources/application.yml', root))
const migrationDir = fileURLToPath(new URL('./backend/src/main/resources/db/migration', root))
const appVuePath = fileURLToPath(new URL('./frontend/src/App.vue', root))
const apiJsPath = fileURLToPath(new URL('./frontend/src/services/api.js', root))
const perfApiJsPath = fileURLToPath(new URL('./frontend/src/services/perfApi.js', root))

let failures = 0
const javaFiles = fs.readdirSync(srcDir).filter((f) => f.endsWith('.java'))
const sources = new Map(javaFiles.map((f) => [f, fs.readFileSync(path.join(srcDir, f), 'utf8')]))
const strip = (text) => text
  .replace(/"(?:\\.|[^"\\])*"/g, '""')      // string literals first: they contain // and { }
  .replace(/'(?:\\.|[^'\\])*'/g, "''")
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '')

// ---------------------------------------------------------------- 1. config placeholders
console.log('[1] config placeholders')
const ymlKeys = new Set()
const duplicateKeys = []
{
  const stack = []
  const seen = new Set() // full key paths already emitted at their own level
  for (const raw of fs.readFileSync(ymlPath, 'utf8').split(/\r?\n/)) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue
    const indent = raw.match(/^\s*/)[0].length
    const m = raw.match(/^\s*([\w.-]+):\s*(.*)$/)
    if (!m) continue
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    const parent = stack.map((s) => s.segment).join('.')
    const key = [...stack.map((s) => s.segment), m[1]].join('.')
    // A repeated key under the same parent is silently resolved by YAML (last wins), which would
    // quietly discard a whole block such as spring.datasource.
    const levelKey = `${parent}|${m[1]}`
    if (seen.has(levelKey)) duplicateKeys.push(key)
    seen.add(levelKey)
    if (m[2].trim() === '') stack.push({ indent, segment: m[1] })
    else ymlKeys.add(key)
  }
}
if (process.argv.includes('--debug-yml')) console.log('    keys:', [...ymlKeys].sort().join(', '))
if (duplicateKeys.length) {
  failures += duplicateKeys.length
  console.log(`    FAIL  duplicate key(s) in application.yml (YAML keeps only the last): ${duplicateKeys.join(', ')}`)
} else {
  console.log('    OK    application.yml has no duplicate keys')
}
const missingProps = []
for (const [file, text] of sources) {
  for (const m of text.matchAll(/\$\{([^}:]+)(?::([^}]*))?\}/g)) {
    if (m[2] === undefined && !ymlKeys.has(m[1].trim())) missingProps.push(`${file}: ${m[1].trim()}`)
  }
}
if (process.argv.includes('--debug-yml')) console.log('    keys:', [...ymlKeys].sort().join(', '))
if (missingProps.length) {
  failures += missingProps.length
  console.log(`    FAIL  no value and no default: ${[...new Set(missingProps)].join('; ')}`)
} else {
  console.log(`    OK    every Spring placeholder resolves (${ymlKeys.size} keys in application.yml)`)
}

// ---------------------------------------------------------------- 2. source balance
console.log('[2] source balance')
const unbalanced = []
for (const [file, text] of sources) {
  const clean = strip(text)
  for (const [open, close] of [['{', '}'], ['(', ')'], ['[', ']']]) {
    const delta = (clean.split(open).length - 1) - (clean.split(close).length - 1)
    if (delta !== 0) unbalanced.push(`${file}: ${open}${close} off by ${delta}`)
  }
}
if (unbalanced.length) {
  failures += unbalanced.length
  console.log(`    FAIL  ${unbalanced.join('; ')}`)
} else {
  console.log(`    OK    ${javaFiles.length} Java files balance braces, parens and brackets`)
}

// ---------------------------------------------------------------- 3. frontend <-> backend routes
console.log('[3] frontend calls vs backend routes')

// A controller's base path is the @RequestMapping nearest above its class declaration.
const backendRoutes = []
for (const [file, text] of sources) {
  const classes = [...text.matchAll(/(?:^|\n)[^\S\n]*(?:public\s+)?(?:static\s+)?(?:final\s+)?class\s+(\w+)/g)]
  for (let i = 0; i < classes.length; i += 1) {
    const start = classes[i].index
    const body = text.slice(start, i + 1 < classes.length ? classes[i + 1].index : text.length)
    const preceding = text.slice(Math.max(0, start - 400), start)
    const bases = [...preceding.matchAll(/@RequestMapping\(\s*"([^"]+)"\s*\)/g)]
    if (!bases.length) continue
    const base = bases[bases.length - 1][1]
    for (const m of body.matchAll(/@(Get|Post|Put|Delete)Mapping(?:\(\s*(?:value\s*=\s*)?"([^"]*)"\s*\))?/g)) {
      backendRoutes.push({ method: m[1].toUpperCase(), path: (base + (m[2] || '')).replace(/\/$/, '') || '/', file })
    }
  }
}

// Frontend call sites: request('<path>', { ...method: 'X'... }), request('<path>') for a plain GET,
// plus the `id ? PUT : POST` ternary.
const frontendCalls = []
const callPath = (raw) => raw.slice(1, -1).replace(/\$\{[^}]*\}/g, '{id}')
for (const p of [appVuePath, apiJsPath, perfApiJsPath]) {
  const text = fs.readFileSync(p, 'utf8')
  // No {0,300} cap on the options object: a long body (perfApi.saveWorkspace) used to fall outside it
  // and the call was never checked at all.
  for (const m of text.matchAll(/request\(\s*(`[^`]*`|'[^']*')\s*,\s*\{([\s\S]*?)\}\s*\)/g)) {
    const raw = m[1]
    const pathValue = callPath(raw)
    const opts = m[2]
    const method = opts.match(/method:\s*'(\w+)'/)
    // A ternary method means create-or-update; both branches are checked separately below.
    if (!method && /method:\s*\w+/.test(opts)) continue
    frontendCalls.push({ method: method ? method[1].toUpperCase() : 'GET', path: pathValue, raw: raw.replace(/\n/g, ' ') })
  }
  // `request('<path>')` with no options at all is a GET; those were invisible to this check before.
  for (const m of text.matchAll(/request\(\s*(`[^`]*`|'[^']*')\s*\)/g)) {
    frontendCalls.push({ method: 'GET', path: callPath(m[1]), raw: m[1].replace(/\n/g, ' ') })
  }
  // `method: cond ? 'PUT' : 'POST'` — verify both branches.
  for (const m of text.matchAll(/request\(\s*(`[^`]*`|'[^']*')[^)]*?method:\s*[^,}]*?\?\s*'(PUT|POST|DELETE)'\s*:\s*'(PUT|POST|DELETE)'/g)) {
    const pathValue = callPath(m[1])
    frontendCalls.push({ method: m[2], path: pathValue, raw: 'ternary' })
    frontendCalls.push({ method: m[3], path: pathValue, raw: 'ternary' })
  }
}

const matchesRoute = (call) => backendRoutes.some((route) => {
  if (route.method !== call.method) return false
  const pattern = new RegExp('^' + route.path.replace(/\{[^}]+\}/g, '[^/]+').replace(/[/.]/g, '\\$&') + '$')
  return pattern.test(call.path)
})
const unmatched = frontendCalls.filter((c) => !matchesRoute(c))
if (unmatched.length) {
  failures += unmatched.length
  console.log(`    FAIL  ${unmatched.length} frontend call(s) have no matching backend route:`)
  for (const c of unmatched) console.log(`          ${c.method.padEnd(6)} ${c.path}`)
} else {
  console.log(`    OK    all ${frontendCalls.length} frontend calls match one of ${backendRoutes.length} backend routes`)
}
if (process.argv.includes('--routes')) {
  console.log('    backend routes:')
  for (const r of [...backendRoutes].sort((a, b) => a.path.localeCompare(b.path))) console.log(`      ${r.method.padEnd(6)} ${r.path}`)
}

// ---------------------------------------------------------------- 4. entity fields vs migrations
console.log('[4] JPA fields vs Flyway columns')
const schema = fs.readdirSync(migrationDir).sort()
  .map((f) => fs.readFileSync(path.join(migrationDir, f), 'utf8')).join('\n')
const tableColumns = new Map()
for (const m of schema.matchAll(/CREATE TABLE (\w+)\s*\(([\s\S]*?)\n\)\s*ENGINE/g)) {
  const cols = new Set()
  for (const line of m[2].split(/\r?\n/)) {
    const c = line.match(/^\s*(\w+)\s+(?:BIGINT|VARCHAR|TEXT|LONGTEXT|DATE|TIMESTAMP|INT|BOOLEAN|DECIMAL|DOUBLE|NUMERIC)/i)
    if (c && !/^(PRIMARY|KEY|INDEX|CONSTRAINT|UNIQUE)$/i.test(c[1])) cols.add(c[1])
  }
  tableColumns.set(m[1], cols)
}
for (const m of schema.matchAll(/ALTER TABLE (\w+)([\s\S]*?);/g)) {
  const cols = tableColumns.get(m[1]) || new Set()
  for (const a of m[2].matchAll(/ADD COLUMN\s+(\w+)/gi)) cols.add(a[1])
  tableColumns.set(m[1], cols)
}
const snake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
const columnMismatches = []
for (const [file, text] of sources) {
  const tableName = text.match(/@Table\(name\s*=\s*"([^"]+)"/)?.[1]
  if (!tableName) continue
  const columns = tableColumns.get(tableName)
  if (!columns) { columnMismatches.push(`${file}: no CREATE TABLE for ${tableName}`); continue }
  const fields = text.match(/@Entity[\s\S]*$/)
  for (const f of fields[0].matchAll(/@Column\(([^)]*)\)\s*private\s+[\w<>.]+\s+(\w+)/g)) {
    const explicit = f[1].match(/name\s*=\s*"([^"]+)"/)
    const column = explicit ? explicit[1] : snake(f[2])
    if (!columns.has(column)) columnMismatches.push(`${file}: ${tableName}.${column} (field ${f[2]}) has no column`)
  }
}
if (columnMismatches.length) {
  failures += columnMismatches.length
  console.log(`    FAIL  ${columnMismatches.join('; ')}`)
} else {
  console.log(`    OK    every annotated entity field maps to a migrated column`)
}

console.log(failures ? `\n${failures} problem(s) found.` : '\nAll backend checks passed.')
process.exitCode = failures ? 1 : 0
