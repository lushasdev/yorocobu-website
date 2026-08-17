#!/usr/bin/env node
/**
 * WCAG contrast check over the palette in src/styles/global.css.
 *
 * The palette is parsed out of the stylesheet rather than duplicated here, so
 * this cannot drift from the tokens it is checking. Run it after any palette
 * change: `node scripts/check-contrast.mjs`.
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(root, 'src/styles/global.css'), 'utf8')

function token(name) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))
  if (!match) throw new Error(`could not find --${name} in global.css`)
  return match[1]
}

const channel = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

const themes = {
  light: {
    paper: token('paper'),
    ink: token('ink'),
    accent: token('accent'),
    dim: token('dim'),
    rule: token('rule'),
  },
  dark: {
    paper: token('d-paper'),
    ink: token('d-ink'),
    accent: token('d-accent'),
    dim: token('d-dim'),
    rule: token('d-rule'),
  },
}

/**
 * `min` is the ratio this pairing has to clear.
 *   4.5  normal text
 *   3.0  large text (>=24px, or >=18.7px bold) and non-text UI such as focus rules
 *   n/a  hairlines that carry no meaning on their own
 */
const PAIRINGS = [
  { fg: 'ink', bg: 'paper', min: 4.5, what: 'body copy' },
  { fg: 'dim', bg: 'paper', min: 4.5, what: 'mono metadata, boot lines, chips (small)' },
  { fg: 'accent', bg: 'paper', min: 4.5, what: 'link underlines, action labels' },
  { fg: 'accent', bg: 'paper', min: 3.0, what: 'caret, marks, focus rule (non-text)' },
  { fg: 'rule', bg: 'paper', min: 0, what: 'decorative hairlines' },
]

let failures = 0
for (const [name, t] of Object.entries(themes)) {
  console.log(`\n  ${name}`)
  for (const { fg, bg, min, what } of PAIRINGS) {
    const ratio = contrast(t[fg], t[bg])
    const ok = min === 0 || ratio >= min
    if (!ok) failures++
    const need = min === 0 ? '     ' : `>=${min.toFixed(1)}`
    console.log(
      `  ${ok ? 'PASS' : 'FAIL'}  ${(fg + ' on ' + bg).padEnd(16)} ` +
        `${ratio.toFixed(2).padStart(5)}:1  ${need}  ${what}`
    )
  }
}

console.log(
  failures === 0
    ? '\n  all pairings clear their threshold\n'
    : `\n  ${failures} pairing(s) below threshold\n`
)
process.exit(failures ? 1 : 0)
