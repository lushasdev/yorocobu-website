/**
 * POST /api/joy — Joy, grounded in /knowledge/ and nothing else.
 *
 * Two modes, both streaming:
 *   answer   one question, one grounded reply
 *   compose  a short guided exchange that ends in a drafted message
 *
 * The model never emits a URL. Actions are a closed enum the client maps to
 * behaviour, and any real links come from the entry's own `links`, added
 * client-side. That is the strongest guarantee against an invented link: there
 * is no field it could put one in.
 *
 * If anything here fails, the browser falls back to the deterministic matcher in
 * src/lib/navigator.js. The visitor never sees a dead input.
 */

import knowledge from '../../src/generated/knowledge.json' with { type: 'json' }
import { resolve as resolveLocal } from '../../src/lib/navigator.js'
import { json, callerId, overRateLimit } from './_shared/limits.mjs'
import { recordQuality } from './_shared/quality.mjs'
import { resultLocaleViolation } from './_shared/language.mjs'
import { useTranslations } from '../../src/i18n/ui.ts'

/** One place. Short retrieval over eight entries, not reasoning. */
const MODEL = 'gpt-5.6-luna'

/** Overridable so the eval harness can be exercised against a local stub. */
const API_BASE = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com'

const MAX_OUTPUT_TOKENS = 600
const MAX_QUESTION = 500
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60 * 60 * 1000
const MAX_COMPOSE_TURNS = 3

/*
  Which locales Joy is allowed to ANSWER in, decided on the server.

  This is the same fence as patternsFor() in the offline matcher, on the other
  path. The client sends the locale it wants; the server decides what it gets,
  because a locale whose answers cannot be checked is not a locale this function
  may answer in.

  The guards themselves no longer key on English. decideOffer reads a dead_end
  token, action labels are closed tokens the dictionary renders, and the
  language check works on script rather than vocabulary. What still gates this
  list is rescueFalseUnknown, which delegates to the offline matcher — so a
  locale belongs here once that matcher has a pattern set AND its eval suite
  passes, not before.

  Not trusting the client is the point either way: a stray locale in a request
  body must not be able to reach a path nothing has verified.

  Not trusting the client is the point: a stray locale in a request body must
  not be able to switch off the guards.
*/
const REPLY_LOCALES = ['en']
const FALLBACK_REPLY_LOCALE = 'en'

/** What the model is told to answer in, whatever the client asked for. */
function replyLocaleFor(requested) {
  if (REPLY_LOCALES.includes(requested)) return requested
  return FALLBACK_REPLY_LOCALE
}

/** How each locale is named to the model. */
const LOCALE_NAMES = { en: 'English', ja: 'Japanese (日本語)' }

const context = knowledge.entries
  .map((e) =>
    [
      `## ${e.title}  (id: ${e.id}, status: ${e.status})`,
      `Summary: ${e.summary}`,
      e.aliases.length ? `Also asked as: ${e.aliases.join(', ')}` : null,
      '',
      e.detail,
      '',
      'NEVER CLAIM (false or not public):',
      ...e.do_not_claim.map((d) => `- ${d}`),
    ]
      .filter(Boolean)
      .join('\n')
  )
  .join('\n\n---\n\n')

const ENTRY_IDS = knowledge.entries.map((e) => e.id)

/*
  The closed set of action labels.

  The model picks a TOKEN; the locale dictionary turns it into words. That is
  what makes fixComposeLabels unnecessary rather than something to duplicate per
  language — there is no free-text label left for the model to get wrong, in any
  language, so there is nothing to repair afterwards.
*/
const LABEL_TOKENS = [
  'send_message',
  'send_question',
  'ask_directly',
  'ask_about_project',
  'ask_about_client_work',
  'ask_to_be_kept_posted',
  'ask_about_it',
  'open_index',
]

const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'focus_section', 'actions', 'followups', 'unknown', 'dead_end', 'used_entries'],
  properties: {
    reply: { type: 'string', description: 'What Joy says. Plain prose, no markdown.' },
    focus_section: {
      type: ['string', 'null'],
      enum: [...ENTRY_IDS, null],
      description: 'Which content region to surface, or null.',
    },
    actions: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'label_token'],
        properties: {
          // A closed set. There is deliberately no url field.
          type: { type: 'string', enum: ['compose', 'index'] },
          label_token: {
            type: 'string',
            enum: LABEL_TOKENS,
            description:
              'Which label the control carries. The site renders it in the ' +
              'visitor\'s language; you are choosing which one fits, not ' +
              'writing the words. Use open_index only with type index. A ' +
              'compose control opens the message form right here — the ' +
              'visitor is not leaving the site.',
          },
        },
      },
    },
    followups: {
      type: 'array',
      maxItems: 3,
      items: { type: 'string' },
      description:
        'Two or three natural next questions, phrased as a visitor would type ' +
        'them. Leave empty only when nothing sensibly follows.',
    },
    unknown: { type: 'boolean' },
    /*
      Whether this answer is a DEAD END: a question the site cannot take any
      further, either because the knowledge base lacks it or because it is not
      published. Structured rather than inferred.

      This replaces reading the opening sentence of the reply for phrases like
      "not public" or "I do not have". That test could not survive translation —
      the sentence splitter keyed on English punctuation, so a Japanese reply
      came back as one sentence and the pattern matched nothing — and adding a
      second pattern set would have brought back the false positives the
      first-sentence-only rule was invented to remove. The model already knows
      whether it hit a wall; asking it is cheaper and more honest than guessing
      from its prose.
    */
    dead_end: {
      type: 'boolean',
      description:
        'True when this answer is a dead end for the visitor: the knowledge ' +
        'base does not contain what they asked for, or it is explicitly not ' +
        'published. False when you answered the question, even if the answer ' +
        'mentions a boundary in passing. A complete answer that ends "and the ' +
        'site does not publish anything further" is NOT a dead end.',
    },
    used_entries: { type: 'array', items: { type: 'string', enum: ENTRY_IDS } },
  },
}

const COMPOSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'next_question', 'draft', 'done'],
  properties: {
    reply: { type: 'string', description: 'One short line of context before the question.' },
    next_question: {
      type: ['string', 'null'],
      description: 'The single next question to ask, or null when drafting.',
    },
    draft: {
      type: ['string', 'null'],
      description: 'The drafted message, in the visitor’s voice, or null.',
    },
    done: { type: 'boolean', description: 'True when draft is filled in.' },
  },
}

const VOICE = `You are Joy, the guide for the Yorocobu website.

Your name is the English of 喜ぶ, to be glad, which is where the company name
comes from too.

How you speak:
- First person, always. "I do not have that yet", never "Joy does not have that".
  You are not a mascot referring to yourself in the third person.
- Plain, brief, warm. No exclamation marks, no sales language, no emoji.
- You are not a person. If asked, say so plainly. You have no opinions,
  preferences, feelings or life outside this site, and you never invent any.
- You never speak for Ethan or Bence. You never commit Yorocobu to work, prices,
  timelines, availability, or whether something is a good fit. A named guide
  makes it easy to slip into speaking for the company; hold that line harder.

What you can do, and must never deny doing:
- Answer from the knowledge base below.
- Take a message for Ethan right here. The compose action opens a short exchange
  in this console, drafts the message, and nothing is sent until the visitor
  presses send. NEVER say you cannot send, pass on, or take a message; that is
  false. The email address exists for people who prefer their own mail client,
  not as the only route, so never present it as the way and yourself as unable.

WHEN TO ATTACH THE COMPOSE ACTION. Only in these three cases:
  1. The visitor wants to reach Ethan or Bence, or to leave a message — however
     they phrase it, whether they ask whether you can or simply say they want to.
  2. You could not answer, or the answer is that something is not published.
  3. The question is about working together, and the next step is a conversation.
An answer that fully answers the question gets NO action. The offer is a way out
of a dead end, not a signature on every reply — attaching it to a complete answer
makes the whole site read as a contact form.

DEAD_END. Set it true when the visitor has hit a wall: the knowledge base does
not contain what they asked for, or it is there only as something explicitly not
published. Set it false when you answered them. Naming a boundary on the way out
of a complete answer is not a dead end — "Yorocobu builds X and Y, and the site
does not publish anything further" ANSWERED the question. This field decides
whether the message form is offered, so guessing high turns every answer into a
contact form and guessing low strands people.

LABELS. You choose a label_token, not words. The site renders it in the
visitor's language. Pick the one that fits what the control will do; do not
worry about how it reads.`

const GROUNDING = `Answer only from the knowledge base below. It is the complete
and only source of truth about Yorocobu. Do not use outside knowledge about the
company, its founders, or its projects, even if you think you know it.

EXHAUST THE KNOWLEDGE BASE BEFORE SAYING YOU DO NOT KNOW.

Broad questions about what Yorocobu is or does are ALWAYS answerable from the
company entry. "What do you build", "what do you do", "who are you", "what is
this", "tell me about yorocobu" — none of these is ever unknown. Questions about
who leads or runs the company are always answerable from the founders entry.
Questions about what kind of apps are being built are answerable from the
portfolio entry, which publishes five categories. Questions about either
founder's background, education, or scholarship are answerable from the founders
entry, which publishes a short bio for each — the bio is the boundary of what
you may say, but it is published, and treating it as unknown is wrong.

Set unknown: true only for a specific thing the knowledge base genuinely does not
contain. When you do:
- Say it in one line, without apologising repeatedly.
- Name what you CAN help with instead, drawn from the entries.
- Offer the compose action so the question can be sent to Ethan.
A bare "I do not have that" is the worst thing you can say on this site.

Declining is different from unknown. Pricing, launch dates, client names, founder
biographies, funding and headcount are all covered by the NEVER CLAIM lines: say
plainly that it is not published, then offer what IS available. A refusal that
stops without offering anything reads as broken.

A refusal category needs explicit subject matter, not a stray keyword. "Who is in
charge" is a question about leadership, not money.

Never state pricing, timelines, client names, or availability unless an entry
contains them. Never guess what one of the five in-development projects does from
its category name. Never invent a URL; you have no field to put one in.

KNOWLEDGE BASE
==============
${context}`

/*
  The language constraint.

  Stated as a hard rule rather than a preference, and repeated for the action
  labels specifically, because a label is the field most likely to drift: it is
  short, it is generated last, and it is the one piece of Joy's output that
  reads like UI rather than like speech.

  The instruction is not trusted on its own. _shared/language.mjs checks what
  comes back, and a violation is treated as a failed response rather than as
  something to tidy up — see the stream handler below.
*/
const languageRule = (locale) => `LANGUAGE. Write your entire response in ${LOCALE_NAMES[locale]}.
This applies to every field without exception: the reply, every action label,
every follow-up question, and any refusal or unknown-answer response.

- Never mix languages inside one response.
- Never apologise for the language you are writing in, and never mention it.
- If the visitor writes to you in another language, understand them in that
  language and answer in ${LOCALE_NAMES[locale]} anyway. Do not comment on
  having done so.
- Proper names stay as they are written in the knowledge base: Yorocobu, Joy,
  Ethan Gailushas, Bence Burton. A Japanese term the knowledge base quotes —
  喜ぶ, 喜, 忘れ者 — stays in Japanese even in an English answer, because it is
  the thing being named rather than a word being translated.`

const COMPOSE_PROMPT = `${VOICE}

You are helping a visitor send a message to Ethan at Yorocobu.

Ask at most ${MAX_COMPOSE_TURNS} short questions, ONE at a time: who they are,
what they are working on, and how to reach them. Never ask more than one thing in
a turn. Nobody should feel interviewed.

When you have enough, or when you have asked ${MAX_COMPOSE_TURNS} questions, set
next_question to null and fill in draft.

RULES FOR THE DRAFT, which matter more than making it read well:
- Use ONLY what the visitor typed. Nothing else.
- Never invent a company, a role, a budget, a timeline, a team size, or any
  detail about the visitor. A short message is better than an embellished one.
- Never make commitments on Yorocobu's behalf.
- Write it in the visitor's own voice, first person, plainly. Two or three
  sentences. No subject line, no greeting formalities, no sign-off.
- Do not add enthusiasm the visitor did not express.

Nothing is ever sent without the visitor pressing send, so never say the message
has been sent.`

const answerPrompt = (locale) => `${VOICE}\n\n${languageRule(locale)}\n\n${GROUNDING}`
const composePrompt = (locale) => `${COMPOSE_PROMPT}\n\n${languageRule(locale)}

The DRAFT is the exception to the language rule above. It is the visitor's own
message in their own voice, so it is written in the language THEY used, not in
${LOCALE_NAMES[locale]}. Everything you say around it still follows the rule.`


/*
  "Every unknown names what it can help with instead" was an instruction, and an
  instruction is followed unevenly: the model holds it when the question is
  adjacent to something real and drops it when the question is far outside the
  knowledge base — which is exactly when a bare refusal reads worst.

  So it stops being instructed and becomes structural. If unknown came back with
  nothing attached, the offer is added here, from the same site map the chips are
  built from. It cannot be missed regardless of what the model returns.
*/
/*
  Where an offer belongs on an answer that is not a dead end: the conversation
  cases. Same derivation the eval asserts against, so the function and the test
  cannot drift apart.
*/
const OFFER_FOCUS = ['contact', 'services']

/**
 * A claimed unknown that the site can in fact answer.
 *
 * "what is ethan gailushas background" came back unknown on one pass and
 * correct on the next, same fingerprint, same prompt. The bios are in the
 * founders entry; claiming not to know is not a judgement call the model gets
 * to make, it is a contradiction with the knowledge base it was handed. Two
 * instructions failed to fix it, which is the same evidence the offer problem
 * gave before decideOffer.
 *
 * So it is detected rather than instructed. The deterministic matcher already
 * decides, from the same knowledge, whether a question has a confident home —
 * it is the fallback the browser trusts when this function is unreachable, and
 * it is checked by 69 offline cases on every build. If it resolves the question
 * to an entry while the model says unknown, the model is wrong and its refusal
 * is replaced by the offline answer.
 *
 * Deliberately narrow: a local result that is itself unknown, or that fired a
 * refusal guard, is not a rescue. "Not published" is a real answer, and the
 * matcher agreeing that something is missing is corroboration, not a conflict.
 */
function rescueFalseUnknown(result, question, mode) {
  if (mode === 'compose' || !result?.unknown) return { result, rescued: false }

  let local
  try {
    local = resolveLocal(question)
  } catch {
    return { result, rescued: false }
  }
  if (!local || local.unknown || local.guard || !local.focus_section) {
    return { result, rescued: false }
  }

  console.warn(
    `joy: model claimed unknown for a question the ${local.focus_section} entry answers; ` +
      `serving the offline answer instead`
  )
  return { result: { ...local, source: 'local' }, rescued: true }
}

/**
 * One decision about the offer, enforced in both directions.
 *
 * The model may suggest a compose action; this decides whether it keeps one.
 * Four rounds of prompt instructions did not stop stray offers, and the eval
 * showed why a fifth would not either — within one entry, "who is in charge"
 * came back clean while "who runs the company" did not, and the two swapped
 * places on the next run. That is per-request guessing, not a rule applied
 * imperfectly, so the rule is applied here instead.
 *
 * WHAT CHANGED FOR THE SECOND LANGUAGE. This used to take the opening sentence
 * of the reply and test it against GAP_SHAPED, an English alternation. Both
 * halves broke in Japanese: the splitter keyed on `[.!?]` followed by a space,
 * and Japanese ends sentences with 。 and no space, so `opening` came back as
 * the entire reply; the pattern then matched nothing regardless. The rule did
 * not merely stop working, it INVERTED — offers were stripped from genuine dead
 * ends and kept only where focus happened to be contact or services.
 *
 * Patching both would have meant two pattern sets and a sentence splitter per
 * language, and testing the whole reply again reintroduces exactly the false
 * positives that first-sentence-only was invented to remove: four of six
 * complete answers read as dead ends, because a good answer routinely names a
 * boundary in passing.
 *
 * So the prose test is gone. `dead_end` is a field in the structured output.
 * The model knows whether it hit a wall — it does not have to be inferred from
 * how it phrased the reply — and a boolean means the same thing in every
 * language. OFFER_FOCUS was already token-based and is unchanged.
 */
function decideOffer(result, mode, locale) {
  const t = useTranslations(locale)
  if (!result || mode === 'compose') return { result, offer: 'n/a' }

  const deadEnd = Boolean(result.unknown) || Boolean(result.dead_end)
  const shouldOffer = deadEnd || OFFER_FOCUS.includes(result.focus_section)

  const actions = result.actions ?? []
  const has = actions.some((a) => a?.type === 'compose')

  if (shouldOffer && !has) {
    const offers = knowledge.destinations.slice(0, 3)
    return {
      offer: 'added',
      result: {
        ...result,
        actions: [...actions, { type: 'compose', label_token: 'send_question' }],
        /*
          The injected fallback followups are rendered here rather than shipped
          as ids, because the client renders whatever string it is given. Ids
          would have appeared on screen as "portfolio" and "founders".
        */
        followups: result.followups?.length ? result.followups : offers.map((d) => t(`ask.${d.id}`)),
      },
    }
  }

  if (!shouldOffer && has) {
    return {
      offer: 'stripped',
      result: { ...result, actions: actions.filter((a) => a?.type !== 'compose') },
    }
  }

  return { result, offer: has ? 'kept' : 'none' }
}

/**
 * The exact message array sent to the model — exported so it can be inspected
 * offline (`node scripts/print-model-input.mjs "question"`) instead of reasoned
 * about. What this returns for a given question IS what production sends, byte
 * for byte, at the same commit of /knowledge.
 */
export function buildModelInput({ mode, question, turns = [], seed = '', locale }) {
  const asked = turns.filter((t) => t.role === 'assistant').length
  const forceDraft = mode === 'compose' && asked >= MAX_COMPOSE_TURNS
  // Never the requested locale directly: the server decides what it will answer
  // in, so a locale in a request body cannot switch off the guards.
  const replyLocale = replyLocaleFor(locale)

  return [
    {
      role: 'system',
      content: mode === 'compose' ? composePrompt(replyLocale) : answerPrompt(replyLocale),
    },
    ...(mode === 'compose' && seed
      ? [
          {
            role: 'system',
            content:
              `The visitor arrived at this from: "${seed}". Those are their words; ` +
              `you may use them in the draft, but do not treat them as an answer ` +
              `to a question you have not asked yet.`,
          },
        ]
      : []),
    ...turns.map((t) => ({
      role: t.role === 'assistant' ? 'assistant' : 'user',
      content: String(t.content ?? '').slice(0, MAX_QUESTION),
    })),
    ...(question ? [{ role: 'user', content: question }] : []),
    ...(forceDraft
      ? [
          {
            role: 'system',
            content:
              'You have asked enough. Set next_question to null and write the draft now, ' +
              'using only what the visitor has already told you.',
          },
        ]
      : []),
  ]
}

/*
  Which knowledge this function is answering from, as a fingerprint: the newest
  last_updated across entries plus a hash of the compiled context. Logged on
  every request, so "which knowledge did the model see" is read from the
  function log and compared with `print-model-input.mjs --fingerprint` locally,
  instead of inferred from dates on rendered pages.
*/
import { createHash } from 'node:crypto'
export const KNOWLEDGE_FINGERPRINT = `${knowledge.entries
  .map((e) => e.last_updated)
  .sort()
  .at(-1)}#${createHash('sha256').update(context).digest('hex').slice(0, 8)}`

/** Server-sent events, so the reply arrives as it is written. */
function sse(stream) {
  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    },
  })
}

/*
  One line when a request arrives and one when it leaves, whatever happens to it.

  The browser falls back to the offline index on *any* failure, and every failure
  looks identical from the transcript: "answering from the offline index". That
  covers a request that reached the function and gave up, and a request that never
  reached it at all — a 404 on an undeployed function reads exactly like a stalled
  model. Without these lines the two are indistinguishable, and the whole first
  round of that diagnosis is guesswork.

  Question text is never logged, only its length. It lives in the gaps store if it
  needs to be read.
*/
const stamp = () => Date.now()
function trace(started, outcome, extra = '') {
  console.log(`joy: ${outcome} in ${Date.now() - started}ms${extra ? ` ${extra}` : ''}`)
}

export default async (req) => {
  const started = stamp()

  if (req.method !== 'POST') {
    trace(started, `rejected ${req.method} not POST`)
    return json(405, { error: 'method not allowed' })
  }
  if (!process.env.OPENAI_API_KEY) {
    console.error(
      'joy: OPENAI_API_KEY is not set on this site. The request arrived and is ' +
        'falling back to the offline index. Nothing was asked of the model.'
    )
    trace(started, 'refused, not configured')
    return json(503, { error: 'navigator not configured', kind: 'config' })
  }

  let body
  try {
    body = await req.json()
  } catch {
    trace(started, 'rejected, body was not json')
    return json(400, { error: 'expected json' })
  }

  const mode = body.mode === 'compose' ? 'compose' : 'answer'
  const question = String(body.question ?? '').trim().slice(0, MAX_QUESTION)
  const turns = Array.isArray(body.turns) ? body.turns.slice(-6) : []
  const seed = String(body.seed ?? '').trim().slice(0, MAX_QUESTION)
  const requestedLocale = String(body.locale ?? 'en').trim().slice(0, 8)
  const replyLocale = replyLocaleFor(requestedLocale)

  // Logged before anything can fail, so an arriving request is always on record.
  console.log(
    `joy: request mode=${mode} qlen=${question.length} turns=${turns.length} ` +
      `locale=${requestedLocale}->${replyLocale} knowledge=${KNOWLEDGE_FINGERPRINT}`
  )
  if (replyLocale !== requestedLocale) {
    console.log(
      `joy: answering in ${replyLocale} for a request that asked for ` +
        `"${requestedLocale}". Only ${REPLY_LOCALES.join(', ')} are served, because ` +
        `the output guards can only police those. The console shows a notice saying so.`
    )
  }

  if (mode === 'answer' && !question) {
    trace(started, 'rejected, no question')
    return json(400, { error: 'question is required' })
  }

  if (await overRateLimit(callerId(req), 'joy', RATE_LIMIT, RATE_WINDOW_MS)) {
    trace(started, 'rate limited')
    return json(429, { error: 'a few too many just now. Try again a little later.' })
  }

  const input = buildModelInput({ mode, question, turns, seed, locale: replyLocale })

  let upstream
  try {
    upstream = await fetch(`${API_BASE}/v1/responses`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        input,
        stream: true,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        text: {
          format: {
            type: 'json_schema',
            name: mode === 'compose' ? 'compose' : 'answer',
            strict: true,
            schema: mode === 'compose' ? COMPOSE_SCHEMA : ANSWER_SCHEMA,
          },
        },
      }),
    })
  } catch (error) {
    console.error('joy: upstream unreachable', error)
    trace(started, 'failed, upstream unreachable')
    return json(502, { error: 'navigator unreachable' })
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    /*
      A permissions or model-name problem is not a bad day, it is a
      misconfiguration, and it will never fix itself. Silently degrading on one
      looks exactly like a working site with a poor matcher, which is the hardest
      failure to notice. So it is separated from transient failures here, logged
      loudly, and labelled for the client.
    */
    const configError = [401, 403, 404].includes(upstream.status)
    console.error(
      configError
        ? `joy: CONFIGURATION ERROR ${upstream.status} for model "${MODEL}". ` +
            `The key is missing a permission, or the model id is wrong or not ` +
            `available to this account. This will not recover on its own. ${detail}`
        : `joy: upstream returned ${upstream.status} ${detail}`
    )
    trace(started, `failed, upstream ${upstream.status}`, configError ? '(config)' : '(transient)')
    return json(502, {
      error: configError ? `model "${MODEL}" is not available to this key` : 'navigator unreachable',
      kind: configError ? 'config' : 'transient',
      status: upstream.status,
    })
  }

  /*
    Re-emit the upstream event stream as a minimal one: text deltas as they
    arrive, then the finished object. The client renders the deltas immediately
    and only uses the parsed object for actions and focus.
  */
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))

      let buffer = ''
      let full = ''
      /*
        Server-side first-token latency. The eval measures this by calling the
        handler in-process; the browser also pays TLS, cold start, and the trip
        home, and only this number appears in production logs. If it is
        comfortably under the client's FIRST_TOKEN_TIMEOUT and the browser still
        falls back, the overhead outside this function is what to look at.
      */
      let firstToken = null
      try {
        for await (const chunk of upstream.body) {
          buffer += decoder.decode(chunk, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            const raw = line.slice(5).trim()
            if (!raw || raw === '[DONE]') continue

            let event
            try {
              event = JSON.parse(raw)
            } catch {
              continue
            }

            if (event.type === 'response.output_text.delta' && event.delta) {
              if (firstToken === null) firstToken = Date.now() - started
              full += event.delta
              send({ delta: event.delta })
            } else if (event.type === 'response.output_text.done' && event.text) {
              full = event.text
            } else if (event.type === 'error' || event.type === 'response.failed') {
              throw new Error(event.error?.message ?? 'model error')
            }
          }
        }

        let result = null
        try {
          result = JSON.parse(full)
        } catch {
          console.error('joy: model output was not valid json')
        }
        // Rescue first: a false unknown replaces the whole result, and the
        // offer decision must then run over what is actually being sent.
        /*
          The language constraint, checked rather than trusted.

          This runs FIRST, before the offer and rescue guards, because those
          guards are the thing at stake: every one of them keys on English, and
          on a Japanese reply they match nothing and fail open. Running them
          over a reply in the wrong language would produce a result that had
          passed three checks while none of them actually looked at anything.

          A violation is treated as a FAILED response, not as something to
          repair. There is no honest way to repair it here — rewriting the
          reply would mean translating it, and this function has no business
          inventing prose the model did not produce. Failing hands the request
          to the browser's existing fallback, which answers from the offline
          index in English and tells the visitor it did so. That keeps the
          notice above the input true, which is the whole point.
        */
        const wrongLanguage = resultLocaleViolation(result, replyLocale)
        if (wrongLanguage) {
          console.error(
            `joy: LANGUAGE VIOLATION — ${wrongLanguage}. The prompt pinned the ` +
              `response to ${replyLocale} and the model did not comply. Serving a ` +
              `failure so the browser falls back to the offline index rather than ` +
              `running English-keyed guards over a reply they cannot read.`
          )
          void recordQuality('language', { question, entry: result?.focus_section ?? null })
          trace(started, 'failed, wrong language', `locale=${replyLocale}`)
          send({ error: 'wrong language' })
          return
        }

        const { result: checked, rescued } = rescueFalseUnknown(result, question, mode)
        /*
          fixComposeLabels used to run here, rewriting any compose label that
          said "email". It is gone: the label is a closed token now and the
          locale dictionary supplies the words, so there is no free-text label
          left for the model to get wrong and nothing to repair.
        */
        const { result: finished, offer } = decideOffer(checked, mode, replyLocale)
        send({ done: true, result: finished, source: 'model' })

        /*
          Both guards are quiet by design, and quiet is how a quality signal
          decays into nothing. A rescue is a downgrade the visitor cannot see;
          a rising strip count means the prompt line has stopped helping. Neither
          should depend on someone remembering to grep for it.

          Deliberately after send(), never awaited: the reply is already on its
          way, and recording must not be able to cost anyone their answer.
        */
        if (rescued) {
          void recordQuality('rescue', { question, entry: checked?.focus_section ?? null })
        }
        if (offer === 'stripped') {
          void recordQuality('strip', { entry: finished?.focus_section ?? null })
        }
        trace(
          started,
          'answered',
          `first_token=${firstToken ?? 'never'}ms mode=${mode}` +
            (mode === 'answer' ? ` unknown=${Boolean(finished?.unknown)}` : '') +
            ` offer=${offer}${rescued ? ' rescued=true' : ''}`
        )
      } catch (error) {
        console.error('joy: stream failed', error)
        trace(started, 'failed mid-stream', `first_token=${firstToken ?? 'never'}ms`)
        send({ error: 'stream failed' })
      } finally {
        controller.close()
      }
    },
  })

  return sse(stream)
}

export const config = { path: '/api/joy' }
