#!/usr/bin/env node
/**
 * Two checks that keep the bilingual site honest, neither of which a type
 * annotation can enforce here — the build does not run tsc, so `Record<UIKey,
 * string>` is documentation until something asserts it.
 *
 *   1. Completeness. Every locale has every key, no key is empty, and no locale
 *      carries a key the canonical English dictionary does not. A missing
 *      Japanese string falls back to English at runtime, which is exactly the
 *      silent English leak this whole unit exists to prevent.
 *
 *   2. Bare literals. A string sitting in a rendered position in a component,
 *      rather than coming from the dictionary, is English that will never be
 *      translated. This reports offenders rather than failing the build on
 *      every heuristic hit, because the heuristic is a heuristic — but an
 *      offender in a file that has been converted IS a failure, since that file
 *      was supposed to be clean.
 *
 * Runs in `npm run check`. Costs nothing, needs no key, needs no server.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ui, locales, defaultLocale } from '../src/i18n/ui.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

let failures = 0
const report = (ok, line) => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${line}`)
}

// ── 1. Completeness ─────────────────────────────────────────────────────────

console.log('\n  every locale carries every string')

const canonical = Object.keys(ui[defaultLocale])
for (const locale of locales) {
  const dictionary = ui[locale]
  const missing = canonical.filter((key) => !(key in dictionary))
  const empty = canonical.filter((key) => key in dictionary && !String(dictionary[key]).trim())
  const extra = Object.keys(dictionary).filter((key) => !canonical.includes(key))

  /*
    console.englishOnlyNotice is deliberately empty in English: the notice only
    exists on the Japanese tree, and an English visitor has nothing to be told.
    It is the one key allowed to be blank, and naming it here rather than
    loosening the rule keeps the next blank string a failure.
  */
  const allowedEmpty = ['console.englishOnlyNotice']
  const reallyEmpty = empty.filter((key) => !allowedEmpty.includes(key))

  report(
    missing.length === 0 && reallyEmpty.length === 0 && extra.length === 0,
    `${locale.padEnd(4)} ${canonical.length} keys, ${missing.length} missing, ` +
      `${reallyEmpty.length} empty, ${extra.length} unknown`
  )
  for (const key of missing) console.log(`          missing: ${key}`)
  for (const key of reallyEmpty) console.log(`          empty:   ${key}`)
  for (const key of extra) console.log(`          unknown: ${key}`)
}

/*
  A Japanese string identical to its English one is almost always an untranslated
  copy rather than a deliberate choice. The deliberate ones are named here, so
  that the next accidental one is caught: brand and product names, the two film
  language labels (each written in its own language on purpose), and the boot
  status line, which is machine voice in both trees.
*/
console.log('\n  no Japanese string is an untranslated copy of the English')
{
  const deliberate = new Set([
    'boot.title',
    'console.introStatus',
    'lang.toEnglish',
    'lang.toJapanese',
    'gate.filmEnglish',
    'gate.filmJapanese',
    'gate.yes',
    'navigator.listSeparator',
    'navigator.listFinal',
  ])
  const copies = canonical.filter(
    (key) => !deliberate.has(key) && ui.ja[key] === ui.en[key] && ui.en[key].trim()
  )
  report(copies.length === 0, `${copies.length} identical string(s)`)
  for (const key of copies) console.log(`          identical: ${key} = ${JSON.stringify(ui.en[key])}`)
}

/*
  Interpolation has to survive translation. A {count} dropped from the Japanese
  means a sentence that renders with the number missing — which reads as correct
  to anyone who cannot check, and is the kind of thing that ships.
*/
console.log('\n  every placeholder survives translation')
{
  const placeholders = (value) => (String(value).match(/\{(\w+)\}/g) ?? []).sort().join(',')
  const drifted = canonical.filter((key) => placeholders(ui.en[key]) !== placeholders(ui.ja[key]))
  report(drifted.length === 0, `${drifted.length} key(s) with mismatched placeholders`)
  for (const key of drifted) {
    console.log(`          ${key}: en[${placeholders(ui.en[key])}] ja[${placeholders(ui.ja[key])}]`)
  }
}

// ── 2. Bare literals in rendered positions ──────────────────────────────────

/*
  Files that have been converted and must stay clean. A file listed here with an
  offender is a hard failure; anything else is reported for information, because
  the detector is a heuristic and a heuristic that blocks a build gets disabled.
*/
const MUST_BE_CLEAN = [
  'src/components/Console.jsx',
  'src/components/BootSequence.astro',
  'src/components/ThemeToggle.astro',
  'src/components/LanguageSwitch.astro',
  'src/layouts/Base.astro',
  'src/pages/index.astro',
  'src/pages/full-index.astro',
  'src/pages/ja/index.astro',
  'src/pages/ja/full-index.astro',
  'src/lib/navigator.js',
  'src/lib/compose-fallback.js',
  'src/lib/documentary.js',
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (name === 'generated' || name === 'i18n') continue
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (['.astro', '.jsx', '.js'].includes(extname(name))) out.push(full)
  }
  return out
}

/** Strip what is not rendered, so the detector is looking at markup and values. */
function stripNoise(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/<style>[\s\S]*?<\/style>/g, '')
    // Multi-line console calls too: a diagnostic is for whoever is reading the
    // logs, and those are English by design.
    .replace(/console\.(log|warn|error|info)\([\s\S]*?\n\s*\)/g, '')
    .replace(/console\.(log|warn|error|info)\([^\n]*\)/g, '')
    .replace(/import[^\n]*from[^\n]*/g, '')
    /*
      Attribute values that are never read by a visitor. class names in
      particular look exactly like prose to the detector — "compose compose--sent
      unmask" is two words with lowercase runs. aria-label and alt are
      deliberately NOT in this list: they are read aloud, so they are as
      translatable as anything on screen.
    */
    .replace(
      /\b(className|class|rel|type|id|htmlFor|name|autoComplete|autoCapitalize|href|src|viewBox|fill|stroke|style|content|property|charset|format|data-[\w-]+)=(["'])[^"']*\2/g,
      ''
    )
}

/*
  What counts as visitor-visible prose: a quoted string of two or more words
  containing a lowercase run, or JSX text between tags. Class names, ids, enum
  members, CSS values and single tokens are all excluded by the two-word rule,
  which is what keeps the false-positive rate low enough to be read.
*/
const PROSE = /(['"])((?=[^'"]*[a-z]{2})[A-Za-z][A-Za-z,.'’—-]*(?: +[A-Za-z][A-Za-z,.'’—-]*)+)\1/g
const JSX_TEXT = />\s*([A-Z][a-z]+(?: +[A-Za-z][A-Za-z,.'’—-]*)+)\s*</g

const ALLOWED = [
  /^(use |import |export )/,
  /^[a-z-]+\/[a-z-]+$/, // mime types
  /^(no-store|same-origin|width=device-width)/,
  /prefers-|pointer: fine|max-width|content-type|application\/json/,
  // Object-literal forms of attributes the attribute stripper cannot see.
  /^noopener noreferrer$/,
]

console.log('\n  no bare English in a rendered position')
const offenders = []
for (const file of walk(join(root, 'src'))) {
  const rel = relative(root, file).replaceAll('\\', '/')
  const source = stripNoise(readFileSync(file, 'utf8'))
  const hits = new Set()
  for (const match of source.matchAll(PROSE)) {
    const text = match[2]
    if (ALLOWED.some((p) => p.test(text))) continue
    hits.add(text)
  }
  for (const match of source.matchAll(JSX_TEXT)) hits.add(match[1])
  if (hits.size) offenders.push({ rel, hits: [...hits] })
}

const mustBeClean = offenders.filter((o) => MUST_BE_CLEAN.includes(o.rel))
report(
  mustBeClean.length === 0,
  `${MUST_BE_CLEAN.length} converted file(s) checked, ${mustBeClean.length} with bare strings`
)
for (const { rel, hits } of mustBeClean) {
  for (const hit of hits) console.log(`          ${rel}: ${JSON.stringify(hit)}`)
}

const informational = offenders.filter((o) => !MUST_BE_CLEAN.includes(o.rel))
if (informational.length) {
  console.log('\n  not yet converted (for information, not a failure):')
  for (const { rel, hits } of informational) {
    console.log(`    ${rel}  ${hits.length} string(s)`)
  }
}

console.log(
  failures
    ? `\n  ${failures} i18n check(s) failed\n`
    : `\n  both locales complete, and every converted file draws from the dictionary\n`
)
process.exit(failures ? 1 : 0)
