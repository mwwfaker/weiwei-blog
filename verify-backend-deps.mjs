// Resolves every dependency declared in backend/pom.xml against Maven Central.
// Mirrors what Maven does: child <version> wins, otherwise the imported BOM / parent BOM supplies it.
// This is the check that catches a pinned version that does not exist.
import fs from 'node:fs'

const BASE = 'https://repo1.maven.org/maven2/'
const pomPath = new URL('./backend/pom.xml', import.meta.url)
const pom = fs.readFileSync(pomPath, 'utf8')

const prop = (name, xml = pom) => {
  const m = xml.match(new RegExp(`<${name}>([^<]+)</${name}>`))
  return m ? m[1].trim() : null
}

// --- collect properties from the pom itself ---
const props = {}
for (const m of pom.matchAll(/<properties>([\s\S]*?)<\/properties>/g)) {
  for (const p of m[1].matchAll(/<([\w.\-]+)>([^<]+)<\/\1>/g)) props[p[1]] = p[2].trim()
}
const expand = (v, table) => {
  if (v == null) return null
  let out = v
  for (let i = 0; i < 10 && /\$\{[^}]+\}/.test(out); i += 1) {
    out = out.replace(/\$\{([^}]+)\}/g, (_, k) => table[k] ?? props[k] ?? `\${${k}}`)
  }
  return out
}

const parentVersion = pom.match(/<parent>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/parent>/)[1].trim()
console.log(`parent BOM: spring-boot-dependencies ${parentVersion}\n`)

// --- fetch the Spring Boot BOM and build artifactId -> version ---
const bomRes = await fetch(`${BASE}org/springframework/boot/spring-boot-dependencies/${parentVersion}/spring-boot-dependencies-${parentVersion}.pom`)
if (!bomRes.ok) throw new Error(`cannot fetch Boot BOM: ${bomRes.status}`)
const bomXml = await bomRes.text()

const bomProps = {}
for (const m of bomXml.matchAll(/<properties>([\s\S]*?)<\/properties>/g)) {
  for (const p of m[1].matchAll(/<([\w.\-]+)>([^<]+)<\/\1>/g)) bomProps[p[1]] = p[2].trim()
}
const managed = new Map()
const dm = bomXml.match(/<dependencyManagement>[\s\S]*?<\/dependencyManagement>/)
if (dm) {
  for (const dep of dm[0].matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const a = dep[1].match(/<artifactId>([^<]+)<\/artifactId>/)
    const v = dep[1].match(/<version>([^<]+)<\/version>/)
    if (a && v) managed.set(a[1].trim(), expand(v[1].trim(), bomProps))
  }
}

// --- parse the pom's own <dependencies> ---
const ownDeps = []
const depsBlock = pom.match(/<\/dependencyManagement>\s*<dependencies>([\s\S]*?)<\/dependencies>/) || pom.match(/<dependencies>([\s\S]*?)<\/dependencies>/)
for (const dep of depsBlock[1].matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
  const g = dep[1].match(/<groupId>([^<]+)<\/groupId>/)
  const a = dep[1].match(/<artifactId>([^<]+)<\/artifactId>/)
  const v = dep[1].match(/<version>([^<]+)<\/version>/)
  const scope = dep[1].match(/<scope>([^<]+)<\/scope>/)
  ownDeps.push({
    groupId: g[1].trim(),
    artifactId: a[1].trim(),
    version: v ? expand(v[1].trim(), props) : null,
    source: v ? 'pom' : 'boot-bom',
    scope: scope ? scope[1].trim() : 'compile',
  })
}

let failures = 0
console.log('groupId:artifactId:version'.padEnd(78) + 'source     status')
console.log('-'.repeat(100))
for (const d of ownDeps) {
  const version = d.version ?? managed.get(d.artifactId) ?? null
  if (!version) {
    console.log(`${d.groupId}:${d.artifactId}:?`.padEnd(78) + `${d.source.padEnd(11)}NO VERSION RESOLVED`)
    failures += 1
    continue
  }
  if (version.includes('${')) {
    console.log(`${d.groupId}:${d.artifactId}:${version}`.padEnd(78) + `${d.source.padEnd(11)}UNRESOLVED PLACEHOLDER`)
    failures += 1
    continue
  }
  const path = `${d.groupId.replaceAll('.', '/')}/${d.artifactId}/${version}/${d.artifactId}-${version}.pom`
  const res = await fetch(BASE + path, { method: 'GET', headers: { Range: 'bytes=0-0' } })
  const ok = res.status === 200 || res.status === 206
  if (!ok) failures += 1
  console.log(`${d.groupId}:${d.artifactId}:${version}`.padEnd(78) + `${d.source.padEnd(11)}${ok ? 'OK' : 'MISSING (' + res.status + ')'}`)
}

console.log('-'.repeat(100))
console.log(failures === 0
  ? `All ${ownDeps.length} dependencies resolve on Maven Central.`
  : `${failures} of ${ownDeps.length} dependencies FAILED to resolve — Maven would refuse to build.`)
process.exitCode = failures === 0 ? 0 : 1
