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
import { json, callerId, overRateLimit } from './_shared/limits.mjs'

/** One place. Short retrieval over eight entries, not reasoning. */
const MODEL = 'gpt-5.6-luna'

/** Overridable so the eval harness can be exercised against a local stub. */
const API_BASE = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com'

const MAX_OUTPUT_TOKENS = 600
const MAX_QUESTION = 500
const RATE_LIMIT = 20
const RATE_WINDOW_MS = 60 * 60 * 1000
const MAX_COMPOSE_TURNS = 3

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

const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['reply', 'focus_section', 'actions', 'followups', 'unknown', 'used_entries'],
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
        required: ['type', 'label'],
        properties: {
          // A closed set. There is deliberately no url field.
          type: { type: 'string', enum: ['compose', 'index'] },
          label: {
            type: 'string',
            description:
              'What the control does. For compose, it opens the message form ' +
              'right here — label it that way ("Send it to Ethan from here"), ' +
              'never "Email …": the visitor is not leaving the site.',
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
makes the whole site read as a contact form.`

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

const ANSWER_PROMPT = `${VOICE}\n\n${GROUNDING}`

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
  A compose action labelled "Email Ethan" is the denial in button form: the
  control sends the message from right here, and a label that says email
  teaches the visitor the opposite. The schema description asks the model not
  to; this makes it not matter if it does anyway.
*/
function fixComposeLabels(result) {
  if (!result?.actions?.length) return result
  return {
    ...result,
    actions: result.actions.map((a) =>
      a?.type === 'compose' && /\b(e-?mail|mail)\b/i.test(a.label ?? '')
        ? { ...a, label: 'Send it to Ethan from here' }
        : a
    ),
  }
}

/*
  What a dead end sounds like. One definition, used in both directions: an
  answer that says this is a dead end EARNS the offer, and an answer that does
  not say so cannot keep one. Editing this changes both, which is the point —
  the two rules are the same rule.
*/
const GAP_SHAPED =
  /\b(not (public|published|covered)|(does|do)(n't| not) (publish|cover|say|describe|explain|have)|i (do not|don't) (have|know)|isn'?t (public|published)|nothing (is )?(public|published)|no [a-z ]{0,24}(is|are) public|and (stops|stop) there|and nothing more|without guessing|have nothing to point)\b/i

/*
  Where an offer belongs on an answer that is not a dead end: the conversation
  cases. Same derivation the eval asserts against, so the function and the test
  cannot drift apart.
*/
const OFFER_FOCUS = ['contact', 'services']

/**
 * One decision about the offer, enforced in both directions.
 *
 * This replaces a pair of functions that keyed on the same regex — one adding
 * the offer where a reply looked like a dead end, the other stripping it where
 * it did not. Sharing the key was meant to make them one rule; what it did was
 * make them collude. The adder fired, and the stripper then exempted exactly
 * what the adder had just created, so `stripped_offers` read 0 on every call
 * while stray offers went out anyway.
 *
 * The second bug was the key itself. GAP_SHAPED was tested against the whole
 * reply, and a good complete answer routinely names a boundary in passing —
 * "…and the site does not publish anything further." Four of six realistic
 * complete answers were misread as dead ends that way. A dead end announces
 * itself in its OPENING sentence; a caveat arrives after the answer has landed.
 * Testing the first sentence only separates them: 0 of 6 false positives.
 *
 * The model may suggest a compose action; this decides whether it keeps one.
 * Four rounds of prompt instructions did not stop stray offers, and the eval
 * showed why a fifth would not either — within one entry, "who is in charge"
 * came back clean while "who runs the company" did not, and the two swapped
 * places on the next run. That is per-request guessing, not a rule applied
 * imperfectly.
 */
function decideOffer(result, mode) {
  if (!result || mode === 'compose') return { result, offer: 'n/a' }

  const opening = String(result.reply ?? '').split(/(?<=[.!?])\s/)[0]
  const deadEnd = Boolean(result.unknown) || GAP_SHAPED.test(opening)
  const shouldOffer = deadEnd || OFFER_FOCUS.includes(result.focus_section)

  const actions = result.actions ?? []
  const has = actions.some((a) => a?.type === 'compose')

  if (shouldOffer && !has) {
    const offers = knowledge.destinations.slice(0, 3)
    return {
      offer: 'added',
      result: {
        ...result,
        actions: [...actions, { type: 'compose', label: 'Send the question to Ethan' }],
        followups: result.followups?.length ? result.followups : offers.map((d) => d.query),
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
export function buildModelInput({ mode, question, turns = [], seed = '' }) {
  const asked = turns.filter((t) => t.role === 'assistant').length
  const forceDraft = mode === 'compose' && asked >= MAX_COMPOSE_TURNS

  return [
    { role: 'system', content: mode === 'compose' ? COMPOSE_PROMPT : ANSWER_PROMPT },
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

  // Logged before anything can fail, so an arriving request is always on record.
  console.log(
    `joy: request mode=${mode} qlen=${question.length} turns=${turns.length} knowledge=${KNOWLEDGE_FINGERPRINT}`
  )

  if (mode === 'answer' && !question) {
    trace(started, 'rejected, no question')
    return json(400, { error: 'question is required' })
  }

  if (await overRateLimit(callerId(req), 'joy', RATE_LIMIT, RATE_WINDOW_MS)) {
    trace(started, 'rate limited')
    return json(429, { error: 'a few too many just now. Try again a little later.' })
  }

  const input = buildModelInput({ mode, question, turns, seed })

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
        // Guarantee first, then strip: the guarantee only ever adds where a dead
        // end earned it, and the strip only ever removes where none did, so the
        // order cannot have them fighting over the same answer.
        const { result: decided, offer } = decideOffer(result, mode)
        const finished = fixComposeLabels(decided)
        send({ done: true, result: finished, source: 'model' })
        trace(
          started,
          'answered',
          `first_token=${firstToken ?? 'never'}ms mode=${mode}` +
            (mode === 'answer' ? ` unknown=${Boolean(finished?.unknown)}` : '') +
            ` offer=${offer}`
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
