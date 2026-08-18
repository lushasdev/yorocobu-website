#!/usr/bin/env node
/**
 * Fails if key material reaches the built output, or if server-only knowledge
 * does.
 *
 * The distinction that matters: naming an environment variable is fine and
 * sometimes necessary (an error message that says which one to check is useful),
 * while a value that looks like a credential is never fine. A check that cannot
 * tell those apart fires on every deploy and stops being read.
 *
 *   npm run build && node scripts/check-secrets.mjs
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')

/** Credential-shaped values. These are never acceptable in client output. */
const SECRET_VALUES = [
  { name: 'OpenAI key', pattern: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { name: 'Resend key', pattern: /\bre_[A-Za-z0-9_-]{20,}/g },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'generic bearer token', pattern: /\bBearer\s+[A-Za-z0-9_\-.]{24,}/g },
]

/**
 * Internal guidance that must stay server-side. do_not_claim tells a model what
 * is false about Yorocobu; publishing it hands a reader the list of things not
 * to ask about.
 */
const SERVER_ONLY = [
  { name: 'do_not_claim guidance', pattern: /do_not_claim|NEVER CLAIM \(/g },
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(js|html|css|json|xml|txt|map)$/.test(name)) out.push(full)
  }
  return out
}

let files
try {
  files = walk(dist)
} catch {
  console.error('\n  no dist/ — run `npm run build` first\n')
  process.exit(2)
}

const findings = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const { name, pattern } of [...SECRET_VALUES, ...SERVER_ONLY]) {
    const hits = text.match(pattern)
    if (hits) findings.push({ file: relative(root, file), name, count: hits.length })
  }
}

// Informational only: an env var *name* in a message is not a leak.
const NAMES = /\b(OPENAI_API_KEY|RESEND_API_KEY|GAPS_EMAIL_TO|RATE_LIMIT_SALT)\b/g
const mentions = []
for (const file of files) {
  const hits = readFileSync(file, 'utf8').match(NAMES)
  if (hits) mentions.push(`${relative(root, file)}  ${[...new Set(hits)].join(', ')}`)
}

console.log(`\n  scanned ${files.length} built files`)

if (mentions.length) {
  console.log('\n  environment variable names appear here (not a leak, for information):')
  for (const m of mentions) console.log(`    ${m}`)
}

if (findings.length === 0) {
  console.log('\n  no key material and no server-only guidance in the built output\n')
  process.exit(0)
}

console.log('\n  FAIL')
for (const f of findings) console.log(`    ${f.file}: ${f.name} x${f.count}`)
console.log()
process.exit(1)
