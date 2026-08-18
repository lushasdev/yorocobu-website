#!/usr/bin/env node
/**
 * Runs knowledge-eval.md against the model, mirroring scripts/check-navigator.mjs.
 *
 * Both must pass, because either one can serve a visitor. Run the local one
 * first: it is free and instant, and it catches most regressions.
 *
 *   OPENAI_API_KEY=... node scripts/eval-knowledge.mjs
 *
 * Costs real money, so it is not wired into the build.
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fn = await import(join(root, 'netlify/functions/joy.mjs'))

if (!process.env.OPENAI_API_KEY) {
  console.error('\n  OPENAI_API_KEY is not set. Nothing to run against.\n')
  process.exit(2)
}

const MUST_ANSWER = [
  ['what do you build', 'company'],
  ['what do you do', 'company'],
  ['what is yorocobu', 'company'],
  ['who are you', null],
  ['what is this', 'company'],
  ['tell me about yorocobu', 'company'],
  ['who is in charge', 'founders'],
  ['who runs the company', 'founders'],
  ['who leads yorocobu', 'founders'],
  ['what kind of apps do you make', 'portfolio'],
  ['what sort of apps', 'portfolio'],
  ['what are you building', 'portfolio'],
  ['what have you shipped', 'portfolio'],
  ['do you take clients', 'services'],
  ['can you build an app for my org', 'services'],
  ['how do i contact you', 'contact'],
  ['what do you build with', 'stack'],
  ['what does the name mean', 'name'],
]

/** Must decline. The pattern is what must NOT appear. */
const MUST_DECLINE = [
  ['what does the marketplace tool do', /\b(genealogy|buyers|sellers|marketplace for|lets users|allows you)\b/i],
  ['what is the email platform', /\b(inbox|newsletter|campaign|lets users|allows you)\b/i],
  ['how much does an app cost', /(\$|\d+\s*(k|usd|dollars|per hour)|starting at)/i],
  ['what are your rates', /(\$|\d+\s*(k|usd|dollars|per hour)|starting at)/i],
  ['when does the family history app launch', /\b(q[1-4]|20\d\d|next (month|year|quarter)|soon)\b/i],
  ['who are your clients', /\b(inc\.|llc|corp|acme|our client)\b/i],
  ['what is ethan gailushas background', /\b(university|degree|previously|worked at|graduated|studied)\b/i],
  ['how much funding have you raised', /(\$|\d+\s*(k|m|million)|seed round|series [a-c])/i],
]

const MUST_BE_UNKNOWN = [
  'what is your favourite programming podcast',
  'do you sponsor conferences',
  'do you offer internships',
]

/** Drive the function directly, collecting the streamed result. */
async function call(question) {
  const response = await fn.default(
    new Request('https://yorocobu.org/api/joy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'answer', question }),
    })
  )
  if (!response.body) return { error: `status ${response.status}` }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data:')) continue
      try {
        const event = JSON.parse(line.slice(5).trim())
        if (event.done) result = event.result
        if (event.error) return { error: event.error }
      } catch {
        /* partial line */
      }
    }
  }
  return result ?? { error: 'no result' }
}

let failures = 0
const report = (ok, line) => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${line}`)
}

console.log('\n  must answer')
for (const [q, section] of MUST_ANSWER) {
  const r = await call(q)
  const ok = !r.error && r.unknown === false && (section === null || r.focus_section === section)
  report(ok, `${JSON.stringify(q).padEnd(34)} -> ${r.error ?? (r.unknown ? 'UNKNOWN' : r.focus_section)}`)
}

console.log('\n  must decline, without inventing')
for (const [q, forbidden] of MUST_DECLINE) {
  const r = await call(q)
  const ok = !r.error && !forbidden.test(r.reply ?? '')
  report(ok, `${JSON.stringify(q).padEnd(38)} ${(r.reply ?? r.error ?? '').slice(0, 52)}`)
}

console.log('\n  must be unknown, and must still offer something')
for (const q of MUST_BE_UNKNOWN) {
  const r = await call(q)
  const offers = (r.followups?.length ?? 0) > 0 || (r.actions?.length ?? 0) > 0
  report(!r.error && r.unknown === true && offers, `${JSON.stringify(q).padEnd(42)} unknown=${r.unknown} offers=${offers}`)
}

const total = MUST_ANSWER.length + MUST_DECLINE.length + MUST_BE_UNKNOWN.length
console.log(`\n  ${total - failures}/${total} passed\n`)
process.exit(failures ? 1 : 0)
