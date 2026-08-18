#!/usr/bin/env node
/**
 * WCAG contrast check over the brand palette in src/styles/global.css.
 *
 * Tokens are parsed out of the stylesheet and resolved through their var()
 * chains, so this cannot drift from what it is checking. The palette carries
 * contrast intentions in its comments; this measures them.
 *
 * Run after any palette change: `node scripts/check-contrast.mjs`
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readdirSync } from 'node:fs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8')

/** Declarations from the brand block plus one theme block, in source order. */
function tokensFor(theme) {
  const brand = css.slice(0, css.indexOf('/* ─── Semantic tokens, light'))
  const lightStart = css.indexOf('/* ─── Semantic tokens, light')
  const darkStart = css.indexOf("[data-theme='dark'] {")
  const darkEnd = css.indexOf('/* The system setting')
  const scoped =
    theme === 'dark' ? css.slice(darkStart, darkEnd) : css.slice(lightStart, darkStart)

  const map = new Map()
  for (const [, name, value] of `${brand}\n${scoped}`.matchAll(
    /--([a-z0-9-]+):\s*([^;]+);/gi
  )) {
    map.set(name, value.trim())
  }
  return map
}

/** Resolve a token through any number of var() indirections to a hex. */
function resolve(map, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`circular token --${name}`)
  seen.add(name)
  const value = map.get(name)
  if (!value) throw new Error(`unknown token --${name}`)
  const ref = value.match(/^var\(--([a-z0-9-]+)\)$/i)
  if (ref) return resolve(map, ref[1], seen)
  const hex = value.match(/#[0-9a-f]{6}/i)
  if (!hex) throw new Error(`--${name} is not a colour: ${value}`)
  return hex[0].toLowerCase()
}

const channel = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/**
 * `min` is what the pairing has to clear.
 *   4.5  normal text
 *   3.0  large text (>=24px), and non-text UI such as rules, marks and focus
 *   0    decorative only, measured for information
 */
const PAIRINGS = [
  { fg: 'text-primary', bg: 'bg', min: 4.5, what: 'body copy' },
  { fg: 'text-secondary', bg: 'bg', min: 4.5, what: 'mono metadata, boot lines, chips' },
  // Measured and documented rather than enforced: these are brand facts, and
  // the site works around them. Both are recorded on every run so a change to
  // the palette cannot quietly make them worse.
  {
    fg: 'text-muted',
    bg: 'bg',
    min: 4.5,
    note: true,
    what: 'muted text — fails on light, so nothing uses it for type',
  },
  { fg: 'text-primary', bg: 'surface', min: 4.5, what: 'body copy on surface' },
  { fg: 'primary', bg: 'bg', min: 4.5, what: 'plum as text' },
  { fg: 'primary', bg: 'bg', min: 3.0, what: 'caret, focus rule, live indicator (non-text)' },
  { fg: 'primary-text', bg: 'bg', min: 4.5, what: 'small plum text' },
  { fg: 'on-primary', bg: 'primary', min: 4.5, what: 'label on a plum button' },
  { fg: 'warm', bg: 'bg', min: 4.5, note: true, what: 'gold as text — never do this' },
  {
    fg: 'warm',
    bg: 'bg',
    min: 3.0,
    note: true,
    what: 'gold rules and marks — decorative, outside 1.4.11',
  },
  { fg: 'warm-text', bg: 'bg', min: 4.5, what: 'gold as text, done properly' },
  { fg: 'warm', bg: 'surface-invert', min: 4.5, what: 'the 喜 on the inverted band' },
  { fg: 'text-on-invert', bg: 'surface-invert', min: 4.5, what: 'text on the inverted band' },
  { fg: 'border', bg: 'bg', min: 0, what: 'decorative hairlines' },
  { fg: 'border-strong', bg: 'bg', min: 0, what: 'stronger hairlines' },
]

/*
  --text-muted is 2.42:1 on light. It is a brand token used beyond this site, so
  the value stays as it is; instead the trap is made unsettable. A comment saying
  "do not use for text" gets ignored by whoever is moving fast. A failing check
  does not.

  Scanned across every stylesheet and component, not just the token file.
*/
const TEXT_PROPERTIES =
  /(^|[;{\s])(color|-webkit-text-fill-color|text-decoration-color|caret-color)\s*:\s*var\(--text-muted\)/

function styleSources() {
  const dirs = ['src/styles', 'src/components', 'src/layouts', 'src/pages']
  const found = []
  for (const dir of dirs) {
    let names = []
    try {
      names = readdirSync(join(root, dir))
    } catch {
      continue
    }
    for (const name of names) {
      if (/\.(css|astro|jsx|tsx)$/.test(name)) found.push(join(dir, name))
    }
  }
  return found
}

const misuse = []
for (const file of styleSources()) {
  const text = readFileSync(join(root, file), 'utf8')
  text.split('\n').forEach((line, i) => {
    if (TEXT_PROPERTIES.test(line)) misuse.push(`${file}:${i + 1}  ${line.trim()}`)
  })
}

let failures = []
if (misuse.length) {
  failures.push(
    `--text-muted applied to a text property in ${misuse.length} place(s) — ` +
      `it is 2.42:1 on light and cannot carry type`
  )
}

for (const theme of ['light', 'dark']) {
  const map = tokensFor(theme)
  console.log(`\n  ${theme}`)
  for (const { fg, bg, min, what, note } of PAIRINGS) {
    const ratio = contrast(resolve(map, fg), resolve(map, bg))
    const ok = min === 0 || ratio >= min
    if (!ok && !note) {
      failures.push(`${theme}: ${fg} on ${bg} — ${ratio.toFixed(2)}:1, needs ${min}`)
    }
    const mark = note ? (ok ? 'PASS' : 'NOTE') : ok ? 'PASS' : 'FAIL'
    console.log(
      `  ${mark}  ${(fg + ' on ' + bg).padEnd(28)} ${ratio.toFixed(2).padStart(6)}:1  ` +
        `${min === 0 ? '     ' : '>=' + min.toFixed(1)}  ${what}`
    )
  }
}

if (misuse.length) {
  console.log('\n  --text-muted used as a text colour:')
  for (const m of misuse) console.log(`    ${m}`)
}

if (failures.length === 0) {
  console.log('\n  every enforced pairing clears its threshold')
  console.log('  --text-muted is not applied to any text property\n')
} else {
  console.log(`\n  ${failures.length} below threshold:`)
  for (const f of failures) console.log(`    ${f}`)
  console.log()
}
process.exit(failures.length ? 1 : 0)
