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

/*
  The suite makes far more calls than a visitor ever would, so it would trip the
  per-caller limit partway through and report failures that are really its own
  throttling. Set before the function is imported.
*/
process.env.RATE_LIMIT_DISABLED = '1'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const fn = await import(join(root, 'netlify/functions/joy.mjs'))

/** Read back from the client so the report cannot quote a stale number. */
const CURRENT_TIMEOUT = Number(
  readFileSync(join(root, 'src/lib/joy.js'), 'utf8').match(
    /SETTLED_TIMEOUT\s*=\s*(\d+)/
  )?.[1] ?? 0
)

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

  /*
    Round 12 published short founder bios and the company's filing year and
    base. Both were must-decline cases until then. Every expansion of the
    knowledge base turns some refusal into an answer, and the eval has to move
    in the same commit or it fails on correct behaviour.
  */
  ['what is ethan gailushas background', 'founders'],
  ['where did bence burton go to university', 'founders'],
  ['where are you based', 'company'],
  ['when was yorocobu founded', 'company'],

  // Joy can pass a message. She used to say she could not.
  ['can you send a question to ethan', 'contact'],
  ['can you contact him for me', 'contact'],
  ['how do i reach you', 'contact'],
]

/**
 * Must answer without denying the capability. Routing to contact is not enough
 * if the words say no; that is exactly the failure this set exists to catch.
 */
const MUST_NOT_DENY = [
  'can you send a question to ethan',
  'can you contact him for me',
  'can you pass a message to the founders',

  /*
    Stated intentions. The interrogative cases above all passed while
    "i want to ask ethan a question" produced a live denial with an
    "Email Ethan" button — the intent shape has to be tested separately.
  */
  'i want to ask ethan a question',
  'i have a question for ethan',
  'can i leave a message for the founders',
]
const DENIAL = /\b(can(no|')t|cannot|can not|unable|not able|do not have the ability|i do not send)\b/i

/** Must decline. The pattern is what must NOT appear. */
const MUST_DECLINE = [
  ['what does the marketplace tool do', /\b(genealogy|buyers|sellers|marketplace for|lets users|allows you)\b/i],
  ['what is the email platform', /\b(inbox|newsletter|campaign|lets users|allows you)\b/i],
  ['how much does an app cost', /(\$|\d+\s*(k|usd|dollars|per hour)|starting at)/i],
  ['what are your rates', /(\$|\d+\s*(k|usd|dollars|per hour)|starting at)/i],
  ['when does the family history app launch', /\b(q[1-4]|20\d\d|next (month|year|quarter)|soon)\b/i],
  /*
    The old pattern here forbade "llc", which matched Yorocobu's own legal name
    in a perfectly correct refusal. The assertion was wrong, not the answer. What
    actually must not happen is a client being named or implied.
  */
  ['who are your clients', /\bclients? (include|are|such as)\b|\bfor example\b|\be\.g\./i],
  ['how much funding have you raised', /(\$|\d+\s*(k|m|million)|seed round|series [a-c])/i],

  /*
    What replaced the bio refusal. Published detail invites exactly these
    follow-ups, so they are the ones worth testing: a personal contact route,
    a current location, and history on either side of the bio.
  */
  ["what is ethan's phone number", /\b\d{3}[-.\s]?\d{4}\b|\b(ethan|bence)[a-z.]*@/i],
  /*
    The old pattern matched "Bence lives" anywhere — including the refusal's own
    echo of the question ("The site does not publish where Bence lives"). The
    test was wrong, not the answer, so the test is fixed: what must not happen
    is Bence being PLACED somewhere, so the pattern requires a placement — a
    location preposition after the verb, or Chapel Hill named at all, since the
    company's base is the one place the model would reach for.
  */
  ['where does bence live', /\b(he|bence)\s+(lives|is based|resides|stays)\s+(in|at|near)\b|\bchapel hill\b/i],
  ['what did ethan do before yorocobu', /\b(worked at|previously at|used to work|interned? at|before that he)\b/i],
  ['what is ethan doing after graduation', /\b(plans to|will join|intends to|is going to|after graduating he)\b/i],
  /*
    A class year is the kind of published fact a model wants to reason from —
    subtract, infer an age, explain a gap. The site does not explain either one,
    so the only correct answer names the gap rather than closing it.
  */
  ['why is bence class of 2031', /\b(gap year|took time off|deferred|transferred|started in|means he|would be|so he|because he)\b/i],
]

const MUST_BE_UNKNOWN = [
  'do you sponsor conferences',
  'do you offer internships',
  'do you have open source projects',
]

/*
  Questions about Joy's own tastes, which are NOT unknowns any more.

  "what is your favourite programming podcast" failed three times as a
  MUST_BE_UNKNOWN case, and on the third look the assertion was stale rather
  than the model wrong: joy.md now states she has no opinions or preferences,
  which makes the question answerable from an entry — "I don't have favourites"
  grounded in joy is a better answer than "I don't know", and unknown=false is
  the model being right. The requirement that survives is narrower: never
  express or invent a preference, and still offer something.
*/
const NO_PREFERENCES = [
  'what is your favourite programming podcast',
  'what is the best javascript framework',
]
const EXPRESSED_PREFERENCE =
  /\b(my favou?rite\b.*\bis|i (like|love|prefer|recommend|enjoy|listen to)|check out|the best one is)\b/i

/*
  First-token latency, recorded on every call.

  This is what sets the fallback threshold: it should catch genuine stalls and
  not merely slow-but-fine responses, because falling back early is not free —
  the offline index answers worse than the model does.
*/
const latencies = []

const percentile = (values, p) => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  // Nearest-rank, which is the honest reading for a sample this small.
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.max(0, rank - 1)]
}

/** Drive the function directly, collecting the streamed result. */
async function call(question) {
  const started = Date.now()
  let firstToken = null
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
        if (event.delta && firstToken === null) {
          firstToken = Date.now() - started
          latencies.push(firstToken)
        }
        if (event.done) result = event.result
        if (event.error) return { error: event.error }
      } catch {
        /* partial line */
      }
    }
  }
  return { ...(result ?? { error: 'no result' }), firstToken }
}

let failures = 0
const report = (ok, line) => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${line}`)
}

/*
  Where a compose action belongs on an answered question, derived from the rule
  the prompt states rather than kept as a hand-maintained exemption list: the
  offer is a way out of a dead end or the next step in a conversation, so on a
  complete answer it is only ever right for contact and services.

  This is the guard that would have caught the over-offering. A broad prompt
  line put "Send it to Ethan from here" under every answer for several rounds
  and nothing failed, because the suite only ever checked that an action was
  PRESENT where it was needed, never that it was ABSENT where it was not.
*/
const COMPOSE_BELONGS = ['contact', 'services']

/*
  The answer block runs twice.

  Failures moved between runs at the same knowledge fingerprint and the same
  prompt: "who runs the company" failed and "who is in charge" passed, then they
  swapped; "what does the name mean" failed once and passed next time. At that
  variance a single run cannot tell a fix from luck, and a passing run is not
  evidence either. Two passes make instability visible as its own category
  rather than letting it read as a regression.

  A case that differs between passes is reported UNSTABLE and counted as a
  failure — a visitor gets one pass, not the best of two.
*/
const judge = (r, section) => {
  const composed = (r.actions ?? []).some((a) => a.type === 'compose')
  const strayOffer = composed && !COMPOSE_BELONGS.includes(r.focus_section)
  return {
    ok: !r.error && r.unknown === false && (section === null || r.focus_section === section) && !strayOffer,
    why: r.error ?? (r.unknown ? 'UNKNOWN' : r.focus_section) + (strayOffer ? ' +stray-offer' : ''),
  }
}

console.log('\n  must answer, twice — complete answers carry no offer, and answers do not wobble')
const unstable = []
for (const [q, section] of MUST_ANSWER) {
  const a = judge(await call(q), section)
  const b = judge(await call(q), section)
  const wobbled = a.ok !== b.ok || a.why !== b.why
  if (wobbled) unstable.push(`${q}  [${a.why}] vs [${b.why}]`)
  report(
    a.ok && b.ok,
    `${JSON.stringify(q).padEnd(34)} -> ${a.why}` +
      (wobbled ? `  UNSTABLE, second pass: ${b.why}` : '')
  )
}
if (unstable.length) {
  console.log(`\n  ${unstable.length} case(s) differed between passes — instability, not a regression:`)
  for (const line of unstable) console.log(`    ${line}`)
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

console.log('\n  no preferences, and never invents one')
for (const q of NO_PREFERENCES) {
  const r = await call(q)
  const invents = EXPRESSED_PREFERENCE.test(r.reply ?? '')
  const offers = (r.followups?.length ?? 0) > 0 || (r.actions?.length ?? 0) > 0
  report(!r.error && !invents && offers, `${JSON.stringify(q).padEnd(42)} invents=${invents} offers=${offers}`)
}

console.log('\n  must not deny what it can do')
for (const q of MUST_NOT_DENY) {
  const r = await call(q)
  const denies = DENIAL.test(r.reply ?? '')
  const compose = (r.actions ?? []).filter((a) => a.type === 'compose')
  // "Email Ethan" on the send-from-here control is the denial in button form.
  const badLabel = compose.some((a) => /\b(e-?mail|mail)\b/i.test(a.label ?? ''))
  report(
    !r.error && !denies && compose.length > 0 && !badLabel,
    `${JSON.stringify(q).padEnd(42)} denies=${denies} offers-send=${compose.length > 0} label-ok=${!badLabel}`
  )
}

// The answer block is judged once per case over two passes, so it contributes
// its length, not twice its length.
const total =
  MUST_ANSWER.length +
  MUST_DECLINE.length +
  MUST_BE_UNKNOWN.length +
  NO_PREFERENCES.length +
  MUST_NOT_DENY.length
console.log(`\n  ${total - failures}/${total} passed`)

if (latencies.length) {
  const p50 = percentile(latencies, 50)
  const p95 = percentile(latencies, 95)
  console.log(`\n  first-token latency over ${latencies.length} calls — IN-PROCESS:`)
  console.log(`    min ${Math.min(...latencies)}ms`)
  console.log(`    p50 ${p50}ms`)
  console.log(`    p95 ${p95}ms`)
  console.log(`    max ${Math.max(...latencies)}ms`)
  /*
    Deliberately no suggested browser budget. This harness calls the function
    in-process — no TLS, no cold start, no trip back to the browser — and a
    "suggested" number from here was once installed as the browser budget and
    cut the model off for every visitor. These figures are the model's own
    floor; set the browser budgets in src/lib/joy.js from __joyTiming() data.
  */
  console.log(
    `\n  these are a FLOOR for the browser budgets, not a suggestion. ` +
      `SETTLED_TIMEOUT is currently ${CURRENT_TIMEOUT}ms and must stay above p95 ` +
      `plus real browser overhead — set it from __joyTiming() in a browser, not from here.\n`
  )
} else {
  console.log('\n  no latency samples: nothing streamed\n')
}

process.exit(failures ? 1 : 0)
