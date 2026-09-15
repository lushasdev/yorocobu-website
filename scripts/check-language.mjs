#!/usr/bin/env node
/**
 * The language fence on the MODEL path.
 *
 * The offline matcher has patternsFor(), which throws for a locale it cannot
 * reason about. The model is the primary path and had no equivalent: nothing
 * stopped it answering a Japanese question in Japanese, and if it did, every
 * output guard downstream failed open at once while the console displayed a
 * notice promising the answer would be in English.
 *
 * This checks both halves of the fix, and it costs nothing:
 *
 *   1. The detector, against fixtures. The interesting cases are the CORRECT
 *      English answers that contain Japanese — the site publishes 喜ぶ, 喜 and
 *      忘れ者 as things it is naming — because a naive "contains Japanese" test
 *      flags all of them.
 *
 *   2. The whole function, end to end, against a stubbed upstream. joy.mjs
 *      takes OPENAI_BASE_URL, so a local server can play the model and return
 *      a Japanese reply on demand. That exercises the real handler, the real
 *      stream parsing and the real guard ordering without an API key and
 *      without spending anything.
 *
 * Runs in `npm run check`.
 */

import { createServer } from 'node:http'
import {
  localeViolation,
  japaneseShare,
  japaneseProseShare,
  runCount,
  grammarRuns,
  resultLocaleViolation,
} from '../netlify/functions/_shared/language.mjs'

/** All four signals at a glance, so a failure says which one moved. */
const detail = (text) =>
  `${String(Math.round(japaneseProseShare(text) * 100)).padStart(3)}p` +
  `${String(Math.round(japaneseShare(text) * 100)).padStart(4)}o` +
  `${String(runCount(text)).padStart(3)}r` +
  `${String(grammarRuns(text)).padStart(3)}g`

let failures = 0
const report = (ok, line) => {
  if (!ok) failures++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${line}`)
}

// ── 1. The detector ─────────────────────────────────────────────────────────

/*
  Correct English answers drawn from what this knowledge base actually says.
  Every one of them contains Japanese characters, and every one must pass —
  these are the fixtures that rule out the naive version of this check.
*/
const ENGLISH_THAT_MUST_PASS = [
  'Yorocobu means to have joy in Japanese. The name comes from 喜ぶ, to be glad. The company mark is the kanji 喜, which sits at the end of the wordmark.',
  'Ethan Gailushas made a documentary called 忘れ者. There are two versions, one in English and one in Japanese, and either can be opened from here.',
  'The documentary is called 忘れ者.',
  'The standard romanization of 喜ぶ is yorokobu, with a k. The company name is spelled yorocobu, with a c.',
  'Yorocobu LLC finds holes in niche markets and builds apps to fill them.',
  'I do not have that one. I can tell you about what Yorocobu builds or who is behind it, or I can send your question to Ethan.',

  /*
    The title gloss. The documentary entry explains 忘れ者 against 忘れ物, so a
    correct English answer about the title carries TWO Japanese terms in one
    short sentence — the densest correct English this site can produce.

    These are the fixtures that killed the plain-ratio version of this check.
    "The title is 忘れ者, a play on 忘れ物." measures 26% and was being refused;
    "忘れ者 plays on 忘れ物." measures 46%. Both are correct. Under prose-run
    detection both are 0%, because neither contains a run longer than a name.
  */
  'The title 忘れ者 reads as forgotten person. It plays on 忘れ物, the everyday word for a lost or left-behind object, the thing on lost-and-found signs.',
  'The title is 忘れ者, a play on 忘れ物.',
  '忘れ者 plays on 忘れ物.',
  '忘れ者 means forgotten person, and it plays on 忘れ物, the everyday word for a lost object.',

  /*
    Interview subjects are written in Latin in every language until the credited
    Japanese forms are added to the knowledge base, so there is deliberately no
    fixture here with a person's name in kanji. A spelling this repo does not
    have is no better kept in a test than on a page.

    QUOTE_MAX stays at 6 rather than dropping to 4 for two reasons: it is the
    headroom a credited name will need once ja-glossary.md supplies them, and
    ordinary quoted vocabulary already reaches it — 開発中の案件 is six.
  */
  'Akihiko Kondo married the vocal synthesiser character Hatsune Miku.',
  'The Japanese version is labelled 日本語版.',
  'The portfolio entry is headed 開発中の案件 on the Japanese tree.',

  /*
    Three quoted terms is the most a correct English answer reaches, which is
    why the run-count signal fires at four. Pinned here so lowering it breaks a
    test rather than starting to refuse correct answers.
  */
  'The name comes from 喜ぶ, the mark is 喜, and the film is 忘れ者.',
]

/*
  Replies that are actually Japanese. If any of these passes, the check is
  decorative — which is the failure mode check-eval-assertions.mjs exists to
  catch on the other suite, and the same reasoning applies here.
*/
const JAPANESE_THAT_MUST_FAIL = [
  'Yorocobu は、ニッチな市場に残された穴を見つけて、それを埋めるアプリを作っています。',
  '料金は公開していません。金額を推測してお伝えするつもりもありません。',
  // The Latin-heaviest realistic Japanese reply: two full names and a title.
  'Ethan Gailushas と Bence Burton の二名が創業しました。どちらも Co-Founder です。',
  'それについては分かりません。ご質問を Ethan にお送りすることもできます。',
  '「忘れ者」は Ethan が作ったドキュメンタリー作品です。英語版と日本語版があります。',
  // Latin-heavy again, and short: the case the prose signal alone would miss.
  'Yorocobu は React と Swift でアプリを作っています。',
  // Short enough to have no long run at all: caught by the overall backstop.
  'はい、できます。',

  /*
    The register that defeats prose share and overall share together: every noun
    kept in Latin, only particles and copulas left in Japanese. Runs are さんは,
    の, です — none over QUOTE_MAX, overall share low. Three runs, so the
    run-count signal alone does not reach it either; what catches it is that all
    three runs are bare hiragana, which is grammar rather than vocabulary.
  */
  'Mary Sakurai さんは Tokyo の rental girlfriend です。',
  // 、 fragments a clause into shorter runs, so it makes this register harder,
  // not easier. Same sentence, same verdict.
  'Mary Sakurai さんは、Tokyo の rental girlfriend です。',
  // Longer in the same register: caught by run count as well.
  'Mary Sakurai さんは Tokyo の rental girlfriend で、Sakura Kudo さんは Hokkaido の学生です。',
]

console.log('\n  the detector accepts correct English that quotes Japanese')
for (const text of ENGLISH_THAT_MUST_PASS) {
  const reason = localeViolation(text, 'en')
  report(
    reason === null,
    `${detail(text)}  ${text.slice(0, 48)}`
  )
}

console.log('\n  the detector catches a Japanese reply where English was asked for')
for (const text of JAPANESE_THAT_MUST_FAIL) {
  const reason = localeViolation(text, 'en')
  report(
    reason !== null,
    `${detail(text)}  ${text.slice(0, 44)}`
  )
}

console.log('\n  the mirror, for when Japanese is the requested locale')
{
  // Ready for Unit C. A Japanese answer keeps Latin proper nouns and must pass.
  const ok = 'Yorocobu は React と Swift でアプリを作っています。'
  report(localeViolation(ok, 'ja') === null, `a Japanese answer with Latin names is accepted`)
  const bad = 'Yorocobu builds apps for niche markets that are underserved.'
  report(localeViolation(bad, 'ja') !== null, `an English answer is caught when Japanese was asked for`)
  // An unknown locale must be an error, never a silent pass.
  report(
    localeViolation('anything at all', 'de') !== null,
    'an unchecked locale errors rather than passing everything'
  )
}

console.log('\n  the draft is exempt, because it is the visitor speaking')
{
  /*
    A Japanese visitor's message to Ethan must stay Japanese whatever language
    Joy is answering in. Forcing it to English would rewrite what someone
    actually said, which is worse than the problem being solved.
  */
  const result = {
    reply: 'Here is what I have. Edit anything, then send it.',
    next_question: null,
    draft: '田中と申します。アプリの開発についてご相談したく connect しました。連絡先は tanaka@example.com です。',
    done: true,
  }
  report(
    resultLocaleViolation(result, 'en') === null,
    'a Japanese draft under an English reply is not a violation'
  )
  // But Joy's own words in the same payload still are.
  report(
    resultLocaleViolation({ ...result, reply: 'こちらが下書きです。' }, 'en') !== null,
    "Joy's own line in the same payload is still checked"
  )
}

console.log('\n  every field Joy speaks in is checked, not just the reply')
for (const [field, result] of [
  ['actions[].label', { reply: 'Fine.', actions: [{ type: 'compose', label: '質問を Ethan に送る' }] }],
  ['followups[]', { reply: 'Fine.', followups: ['社名の由来は'] }],
  ['next_question', { reply: 'Fine.', next_question: 'お名前を教えてください。' }],
]) {
  report(resultLocaleViolation(result, 'en') !== null, `a Japanese ${field} is caught`)
}

// ── 2. The whole function, against a stubbed model ──────────────────────────

/*
  A stand-in for the Responses API. joy.mjs reads OPENAI_BASE_URL, so this
  serves /v1/responses and streams back whatever payload the test asked for,
  in the same SSE shape the real API uses.
*/
let nextPayload = null
const stub = createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/event-stream' })
  const body = JSON.stringify(nextPayload)
  // Two deltas, so the streaming path is genuinely exercised rather than
  // short-circuited by a single complete chunk.
  const half = Math.ceil(body.length / 2)
  for (const chunk of [body.slice(0, half), body.slice(half)]) {
    res.write(`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: chunk })}\n\n`)
  }
  res.write(`data: ${JSON.stringify({ type: 'response.output_text.done', text: body })}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
})
await new Promise((resolve) => stub.listen(0, '127.0.0.1', resolve))
const { port } = stub.address()

process.env.OPENAI_BASE_URL = `http://127.0.0.1:${port}`
// Deliberately not sk-shaped. The stub does not check it, and a credential-
// shaped literal in the repo is exactly what check-secrets.mjs and GitHub's own
// scanner exist to shout about.
process.env.OPENAI_API_KEY = 'local-stub-no-credential-needed'
process.env.RATE_LIMIT_DISABLED = '1'

// Imported AFTER the environment is set: API_BASE is read at module load.
const joy = await import('../netlify/functions/joy.mjs')

/** Drive the handler and collect what the browser would actually receive. */
async function ask(question, locale, payload) {
  nextPayload = payload
  const response = await joy.default(
    new Request('https://yorocobu.org/api/joy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'answer', question, locale }),
    })
  )
  const text = await new Response(response.body).text()
  const events = text
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5).trim()))
  return {
    error: events.find((e) => e.error)?.error ?? null,
    result: events.find((e) => e.done)?.result ?? null,
  }
}

const ENGLISH_PAYLOAD = {
  reply: 'Yorocobu LLC finds holes in niche markets and builds apps to fill them.',
  focus_section: 'company',
  actions: [],
  followups: ['what does the name mean'],
  unknown: false,
  used_entries: ['company'],
}

const JAPANESE_PAYLOAD = {
  reply: 'Yorocobu は、ニッチな市場に残された穴を見つけて、それを埋めるアプリを作っています。',
  focus_section: 'company',
  actions: [],
  followups: ['社名の由来は'],
  unknown: false,
  used_entries: ['company'],
}

console.log('\n  end to end, against a stubbed model')
{
  /*
    Both locales are served now, so the assertion in each direction is the same
    one: the reply must be in the language that was ASKED for, and anything else
    is refused rather than served.

    Refusing rather than repairing is the whole design. There is no honest way
    to fix a reply in the wrong language from here — rewriting it would mean
    translating it, and this function has no business inventing prose the model
    did not produce. Failing hands the request to the browser's existing
    fallback, which answers from the offline index in the right language.
  */
  const jaGood = await ask('Yorocobu とは何ですか', 'ja', JAPANESE_PAYLOAD)
  report(
    jaGood.error === null && jaGood.result?.reply === JAPANESE_PAYLOAD.reply,
    `Japanese question, Japanese reply -> served  (${jaGood.error ?? 'ok'})`
  )

  const enGood = await ask('what is yorocobu', 'en', ENGLISH_PAYLOAD)
  report(
    enGood.error === null && enGood.result?.reply === ENGLISH_PAYLOAD.reply,
    `English question, English reply -> served  (${enGood.error ?? 'ok'})`
  )

  /*
    The failure that matters most now that 'ja' is open: a model reaching for
    its default and answering a Japanese visitor in English. Before the gate
    opened this was the CORRECT behaviour, which is exactly why it needs an
    assertion of its own — the expectation inverted, and an un-updated test
    would have gone on passing while asserting the opposite of the design.
  */
  const jaBad = await ask('Yorocobu とは何ですか', 'ja', ENGLISH_PAYLOAD)
  report(
    jaBad.error === 'wrong language' && jaBad.result === null,
    `Japanese question, English reply -> refused  (error=${jaBad.error}, result=${jaBad.result ? 'SERVED' : 'none'})`
  )

  const enBad = await ask('what is yorocobu', 'en', JAPANESE_PAYLOAD)
  report(
    enBad.error === 'wrong language' && enBad.result === null,
    `English question, Japanese reply -> refused  (error=${enBad.error})`
  )

  // An absent locale is English, and is policed as English.
  const noLocale = await ask('what is yorocobu', undefined, JAPANESE_PAYLOAD)
  report(
    noLocale.error === 'wrong language',
    `no locale in the request, Japanese reply -> refused  (error=${noLocale.error})`
  )

  // A locale the server does not serve falls back to English rather than
  // reaching a path nothing has verified.
  const unknown = joy.buildModelInput({ mode: 'answer', question: 'x', locale: 'de' })[0].content
  report(
    /Write your entire response in English\./.test(unknown),
    'an unserved locale falls back to an English-pinned prompt'
  )
}

/*
  The offer rule, now that it reads a token instead of the reply's prose.

  These are the cases the old GAP_SHAPED version got wrong. A complete answer
  that names a boundary on its way out — "…and the site does not publish
  anything further" — read as a dead end and collected an offer it had not
  earned; four of six realistic complete answers did. Reading dead_end makes
  that impossible to get wrong from phrasing, in either language.
*/
console.log('\n  the offer follows the dead_end token, not the prose')
{
  const base = { focus_section: 'company', actions: [], followups: [], unknown: false, used_entries: ['company'] }
  const cases = [
    [
      'a complete answer that mentions a boundary keeps no offer',
      { ...base, reply: 'Yorocobu builds apps for niche markets, and the site does not publish anything further.', dead_end: false },
      false,
    ],
    [
      'a genuine dead end gets one',
      { ...base, reply: 'That is not something the site covers.', dead_end: true },
      true,
    ],
    [
      'an unknown gets one even with dead_end false',
      { ...base, reply: 'I do not have that one.', dead_end: false, unknown: true },
      true,
    ],
    [
      'a contact answer keeps one regardless',
      { ...base, focus_section: 'contact', reply: 'You can reach Ethan from here.', dead_end: false },
      true,
    ],
    [
      'a stray offer on a complete answer is stripped',
      { ...base, reply: 'Yorocobu builds apps for niche markets.', dead_end: false, actions: [{ type: 'compose', label_token: 'send_message' }] },
      false,
    ],
  ]
  for (const [name, payload, wantOffer] of cases) {
    const got = await ask('anything', 'en', payload)
    const has = (got.result?.actions ?? []).some((a) => a.type === 'compose')
    report(has === wantOffer, `${name}  (offer=${has}, wanted ${wantOffer})`)
  }

  // An added offer carries a token, never words, and its followups are real text.
  const added = await ask('anything', 'en', { ...base, reply: 'Not covered.', dead_end: true })
  const action = (added.result?.actions ?? [])[0]
  report(
    action?.label_token === 'send_question' && action.label === undefined,
    `an injected offer carries a token and no free text  (${JSON.stringify(action)})`
  )
  report(
    (added.result?.followups ?? []).every((f) => typeof f === 'string' && !/^[a-z]+$/.test(f)),
    `injected followups are rendered text, not entry ids  (${JSON.stringify(added.result?.followups)})`
  )
}

/*
  The gate is open for 'ja', so the assertion is what the fence must do at
  runtime rather than which locales are listed.

  A tripwire used to sit here asserting REPLY_LOCALES was still ['en']. It was
  meant to make opening the gate a deliberate act; it has been, so it is gone
  rather than left as a test that has to be edited to stay green.
*/
console.log('\n  both served locales are policed, not just English')
{
  report(
    joy.REPLY_LOCALES.includes('ja'),
    `REPLY_LOCALES is ${JSON.stringify(joy.REPLY_LOCALES)}`
  )

  // A Japanese reply to a Japanese request is now SERVED, not refused.
  const served = await ask('Yorocobu とは何ですか', 'ja', {
    reply: 'Yorocobu は、サービスが行き届いていない市場に残された穴を見つけて、それを埋めるアプリを作っています。',
    focus_section: 'company',
    actions: [],
    followups: ['社名の由来は'],
    unknown: false,
    dead_end: false,
    used_entries: ['company'],
  })
  report(
    served.error === null && served.result?.focus_section === 'company',
    `a Japanese reply to a Japanese request is served  (${served.error ?? 'ok'})`
  )

  /*
    And the fence still bites in the other direction. Opening a locale must not
    mean the language check stops mattering — an ENGLISH reply to a Japanese
    request is just as wrong as the reverse, and is what a model reaching for
    its default would produce.
  */
  const wrongWay = await ask('Yorocobu とは何ですか', 'ja', {
    reply: 'Yorocobu LLC finds holes in niche markets and builds apps to fill them.',
    focus_section: 'company',
    actions: [],
    followups: ['what does the name mean'],
    unknown: false,
    dead_end: false,
    used_entries: ['company'],
  })
  report(
    wrongWay.error === 'wrong language' && wrongWay.result === null,
    `an English reply to a Japanese request is refused  (error=${wrongWay.error})`
  )

  // The prompt asks for Japanese now, rather than pinning everything to English.
  const sys = joy.buildModelInput({ mode: 'answer', question: 'x', locale: 'ja' })[0].content
  report(
    /Write your entire response in Japanese/.test(sys),
    'a Japanese request gets a Japanese-pinned prompt'
  )
}

stub.close()

console.log(
  failures
    ? `\n  ${failures} language check(s) failed\n`
    : `\n  the model path answers in the locale the server pinned, and is refused when it does not\n`
)
process.exit(failures ? 1 : 0)
