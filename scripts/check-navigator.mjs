#!/usr/bin/env node
/**
 * Regression check for the offline navigator, covering three behaviours.
 *
 * Over-refusal is as much a defect as over-answering, and a refusal from the
 * wrong guard is a third failure that a pass/fail test misses entirely: it looks
 * like a correct refusal to a script and visibly broken to a person. So the
 * decline cases assert *which* guard fired, not merely that one did.
 *
 * These cases mirror knowledge-eval.md, which runs the same questions against
 * the model. Run after any edit to /knowledge/ or to the matcher:
 *
 *   npm run knowledge && node scripts/check-navigator.mjs
 */

import { resolve, DESTINATIONS } from '../src/lib/navigator.js'
import knowledge from '../src/generated/knowledge-client.json' with { type: 'json' }

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

  // Leadership. "in charge" is about who leads, and used to reach the pricing
  // guard because "charge" was a bare keyword in it.
  { q: 'who is in charge', section: 'founders' },
  { q: 'who runs the company', section: 'founders' },
  { q: 'who leads yorocobu', section: 'founders' },
  { q: 'who is behind this', section: 'founders' },

  // The categories are published. The console must never imply otherwise.
  { q: 'what kind of apps do you make', section: 'portfolio' },
  { q: 'what sort of apps', section: 'portfolio' },
  { q: 'what are you building', section: 'portfolio' },
  { q: 'what have you shipped', section: 'portfolio' },

  { q: 'do you take clients', section: 'services' },
  { q: 'can you build an app for my org', section: 'services' },
  { q: 'how do i contact you', section: 'contact' },
  { q: 'what do you build with', section: 'stack' },
  { q: 'what does the name mean', section: 'name' },
  { q: 'what are you', section: 'joy' },
  { q: 'are you a person', section: 'joy' },

  // The landing state: an empty submission is "well, what is this?".
  { q: '', section: 'company' },
  { q: 'hello', section: 'company' },
]

/** Must decline, and must decline for the right reason. */
const MUST_DECLINE = [
  { q: 'what does the marketplace tool do', guard: null, focus: 'portfolio' },
  { q: 'what is the email platform', guard: null, focus: 'portfolio' },
  { q: 'how much does an app cost', guard: 'pricing' },
  { q: 'what are your rates', guard: 'pricing' },
  { q: 'what do you charge for an app', guard: 'pricing' },
  { q: 'when does the family history app launch', guard: 'timeline' },
  { q: 'who are your clients', guard: 'clients' },
  { q: 'what is ethan gailushas background', guard: 'founder-bios' },
  { q: 'where did bence burton go to university', guard: 'founder-bios' },
  { q: 'do you have an office in berlin', guard: 'company-metrics' },
  { q: 'how much funding have you raised', guard: 'company-metrics' },
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
  const ok = !r.unknown && !r.guard && (section === null || r.focus_section === section)
  report(
    ok,
    `${JSON.stringify(q).padEnd(34)} -> ${r.unknown ? 'UNKNOWN' : r.focus_section}` +
      (r.guard ? ` [refused by ${r.guard}]` : '') +
      (section && r.focus_section !== section && !r.unknown ? `  (wanted ${section})` : '')
  )
}

console.log('\n  must decline, by the right guard')
for (const { q, guard, focus } of MUST_DECLINE) {
  const r = resolve(q)
  // A guarded refusal names its guard; a project refusal is identified by its
  // focus, since it is handled ahead of the guards.
  const ok = guard ? r.guard === guard : !r.guard && r.focus_section === focus && !r.unknown
  report(
    ok,
    `${JSON.stringify(q).padEnd(38)} ${(r.guard ? `[${r.guard}]` : `<${r.focus_section}>`).padEnd(18)}` +
      (ok ? '' : `  wanted ${guard ? `[${guard}]` : `<${focus}>`}`)
  )
}

console.log('\n  must be unknown, and must still offer something')
for (const q of MUST_BE_UNKNOWN) {
  const r = resolve(q)
  // Every unknown names what the assistant can help with instead.
  const offers = /I can tell you about/i.test(r.reply) && r.followups.length > 0
  report(r.unknown && offers, `${JSON.stringify(q).padEnd(42)} unknown=${r.unknown} offers=${offers}`)
}

/*
  Reachability, both directions.

  Forward: every chip lands on its own entry, so the site map cannot lie about
  where it goes.

  Reverse: every entry is reachable through the console, by a chip or by a
  must-answer case. The full index carries all of them and is the backstop, but
  it does not count as exposure here — if it did, this check would pass for every
  entry forever and catch nothing. An entry that only the full index reaches is
  invisible to anyone using the site as designed.
*/
console.log('\n  every chip reaches its own entry')
for (const destination of DESTINATIONS) {
  const r = resolve(destination.query)
  report(
    r.focus_section === destination.id && !r.unknown,
    `${destination.label.padEnd(22)} -> ${r.unknown ? 'UNKNOWN' : r.focus_section}` +
      (r.focus_section === destination.id ? '' : `  (wanted ${destination.id})`)
  )
}

console.log('\n  every entry is reachable from the console')
const chipFor = new Map(DESTINATIONS.map((d) => [d.id, d.label]))
for (const entry of knowledge.entries) {
  const chip = chipFor.get(entry.id)
  const asked = MUST_ANSWER.find(({ q, section }) => section === entry.id && resolve(q).focus_section === entry.id)
  const how = chip ? `chip "${chip}"` : asked ? `answers "${asked.q}"` : 'FULL INDEX ONLY'
  report(Boolean(chip || asked), `${entry.id.padEnd(12)} ${how}`)
}

const total =
  MUST_ANSWER.length +
  MUST_DECLINE.length +
  MUST_BE_UNKNOWN.length +
  DESTINATIONS.length +
  knowledge.entries.length
console.log(`\n  ${total - failures}/${total} passed\n`)
process.exit(failures ? 1 : 0)
