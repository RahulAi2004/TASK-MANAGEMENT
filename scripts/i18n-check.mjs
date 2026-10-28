// Lists English strings shown through t() that have no Urdu entry in src/i18n/ur.js.
// Covers literal t('…') calls plus the label/hint tables that are translated at render time.
// Usage: node scripts/i18n-check.mjs   (exit code 1 when something is missing)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import ur from '../src/i18n/ur.js'

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const files = []
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(jsx?|mjs)$/.test(f) && !p.includes('i18n')) files.push(p)
  }
}
walk(SRC)

const str = `(?:'((?:[^'\\\\]|\\\\.)*)'|"((?:[^"\\\\]|\\\\.)*)")`
const patterns = [
  new RegExp(`\\btr\\(${str}`, 'g'), // tr('…')
  new RegExp(`\\b(?:label|hint): ${str}`, 'g'), // { label: '…' } tables
  new RegExp(`\\b(?:label|hint)=${str}`, 'g'), // <Field label="…">
]
// Tables whose *values* are display text
const tables = ['STATUS_LABEL', 'ACTIVITY', 'DELAY_REASONS', 'CATEGORIES', 'ENTITY_TYPES', 'PRIORITIES']

const missing = new Map()
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  // only files that translate at all
  if (!/\bt as tr\b/.test(src)) continue
  const found = []
  for (const re of patterns) for (const m of src.matchAll(re)) found.push(m[1] ?? m[2])
  for (const name of tables) {
    const block = src.match(new RegExp(`const ${name} = ([\\[{])([\\s\\S]*?)\\n[\\]}]`))
    if (!block) continue
    // object → the values ({ Key: 'Text' }); array → the items (['Text', …] or [{ value: 'Text' }])
    const item = block[1] === '{' ? `:\\s*${str}` : `(?:^\\s*|,\\s*|\\[\\s*|value: )${str}`
    for (const m of block[2].matchAll(new RegExp(item, 'gm'))) found.push(m[1] ?? m[2])
  }
  for (const key of found) {
    // skip colours and code-style keys ('#1A66E5', 'today', '30d')
    if (!key || key.startsWith('#') || /^[a-z0-9_]+$/.test(key) || key in ur) continue
    if (!missing.has(key)) missing.set(key, file.slice(SRC.length))
  }
}

if (missing.size) {
  console.log(`${missing.size} string(s) have no Urdu text in src/i18n/ur.js:`)
  for (const [k, f] of missing) console.log(`  ${JSON.stringify(k)}   (${f})`)
  process.exit(1)
}
console.log('i18n: every translated string has Urdu text.')
