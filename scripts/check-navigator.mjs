#!/usr/bin/env node
/**
 * Regression check for the offline navigator, covering both edges.
 *
 * Over-refusal is as much a defect as over-answering. An AI-first site that
 * cannot say what the company does is broken in the way that matters most, so
 * the broad identity questions are tested as hard as the refusals.
 *
 * The cases here mirror knowledge-eval.md, which runs the same questions against
 * the model. Run this after any edit to /knowledge/ or to the matcher:
 *
 *   npm run knowledge && node scripts/check-navigator.mjs
 */

import { resolve } from '../src/lib/navigator.js'

/** Must produce a confident answer. `section` of null means any entry will do. */
const MUST_ANSWER = [
  { q: 'what do you build', section: 'company' },
  { q: 'what do you do', section: 'company' },
  { q: 'what is yorocobu', section: 'company' },
  { q: 'who are you', section: 'company' },
  { q: 'what is this', section: 'company' },
  { q: 'what does the company do', section: 'company' },
  { q: 'tell me about yorocobu', section: 'company' },
  { q: 'what are you working on', section: null },
  { q: 'do you take clients', section: 'services' },
  { q: 'can you build an app for my org', section: 'services' },
  { q: 'how do i contact you', section: 'contact' },
  { q: 'what do you build with', section: 'stack' },
  { q: 'what does the name mean', section: 'name' },
  { q: 'who is behind this', section: 'founders' },
  { q: 'what have you shipped', section: 'portfolio' },
  // The landing state: an empty submission is "well, what is this?".
  { q: '', section: 'company' },
  { q: 'hello', section: 'company' },
]

/** Must decline, naming the gap, rather than answering. */
const DECLINES =
  /not published|not going to invent|no launch dates|does not publish|no bios are published|without guessing|none of that is public|do not have that one/i

const MUST_DECLINE = [
  'what does the marketplace tool do',
  'what is the email platform',
  'how much does an app cost',
  'what are your rates',
  'when does the family history app launch',
  'who are your clients',
  'what is ethan gailushas background',
  'where did bence burton go to university',
  'do you have an office in berlin',
  'how much funding have you raised',
]

/** Must reach the unknown branch: real questions the knowledge base lacks. */
const MUST_BE_UNKNOWN = [
  'what is your favourite programming podcast',
  'do you sponsor conferences',
  'do you offer internships',
]

let failures = 0
const report = (ok, line) => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${line}`)
}

console.log('\n  must answer')
for (const { q, section } of MUST_ANSWER) {
  const r = resolve(q)
  const ok = !r.unknown && (section === null || r.focus_section === section)
  report(
    ok,
    `${JSON.stringify(q).padEnd(36)} -> ${r.unknown ? 'UNKNOWN' : r.focus_section}` +
      (section && r.focus_section !== section && !r.unknown ? `  (wanted ${section})` : '')
  )
}

console.log('\n  must decline')
for (const q of MUST_DECLINE) {
  const r = resolve(q)
  report(DECLINES.test(r.reply), `${JSON.stringify(q).padEnd(40)} ${r.reply.slice(0, 44)}`)
}

console.log('\n  must be unknown')
for (const q of MUST_BE_UNKNOWN) {
  const r = resolve(q)
  report(r.unknown, `${JSON.stringify(q).padEnd(44)} unknown=${r.unknown}`)
}

const total = MUST_ANSWER.length + MUST_DECLINE.length + MUST_BE_UNKNOWN.length
console.log(`\n  ${total - failures}/${total} passed\n`)
process.exit(failures ? 1 : 0)
