/**
 * Where the navigator's self-corrections accumulate.
 *
 * Two guards in `joy` quietly clean up after the model: a rescue replaces a
 * false "I don't know" with the offline answer, and a strip removes an offer
 * from an answer that did not need one. Both are working as designed, and both
 * are quality signals that decay into invisibility if they only ever appear in
 * a log line nobody greps.
 *
 *   rescue  the model called a published entry unknown. A quiet downgrade — the
 *           offline reply is terser than the model's — and a sign the entry
 *           needs work. This is exactly the gaps-queue case from the brief: a
 *           question where `unknown` was true, with its text and a timestamp.
 *           So it lands in the SAME `questions` store the gaps queue reads,
 *           tagged `source: 'rescue'`, rather than in a place to remember.
 *
 *   strip   the model attached an offer to a complete answer. Harmless once,
 *           and a sign the prompt line has stopped helping if it is most
 *           answers. Counted rather than stored: the count is the whole signal.
 *
 * Everything here fails open and is never awaited by the answer path. A blob
 * store hiccup must not cost a visitor their reply.
 *
 * Recorded: the question, the entry, a timestamp. Not recorded: addresses, user
 * agents, or anything else identifying — the same rule as the gaps queue.
 */

import { getStore } from '@netlify/blobs'
import { randomUUID } from 'node:crypto'

/** Alert once a day, when a kind first crosses its threshold. */
const THRESHOLDS = {
  rescue: Number(process.env.QUALITY_ALERT_RESCUES ?? 3),
  strip: Number(process.env.QUALITY_ALERT_STRIPS ?? 25),
}

const today = () => new Date().toISOString().slice(0, 10)

async function notify(kind, count, day) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.GAPS_EMAIL_TO
  if (!key || !to) {
    console.warn(
      `joy: ${kind} count reached ${count} today and no alert was sent — ` +
        `RESEND_API_KEY or GAPS_EMAIL_TO is not set on this site.`
    )
    return
  }

  const body =
    kind === 'rescue'
      ? [
          `Joy called a published entry "unknown" ${count} times today.`,
          '',
          'Each one was overruled and served from the offline index, which is',
          'terser than the model. The questions are in the gaps queue, tagged',
          'rescue — they name the entries that need work.',
        ].join('\n')
      : [
          `Joy attached an offer to a complete answer ${count} times today.`,
          '',
          'Each was stripped, so nothing wrong reached anyone. But the prompt',
          'line asking it not to has stopped earning its place at this rate,',
          'and the strip is doing all the work.',
        ].join('\n')

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.GAPS_EMAIL_FROM ?? 'Joy <onboarding@resend.dev>',
      to: [to],
      reply_to: to,
      subject: `Joy: ${count} ${kind}${count === 1 ? '' : 's'} today (${day})`,
      text: body,
    }),
  })
  if (!response.ok) {
    console.error(`joy: quality alert email failed, ${response.status}`, await response.text())
  }
}

/**
 * @param {'rescue'|'strip'} kind
 * @param {{question?: string, entry?: string|null}} detail
 *
 * Fire and forget. Returns a promise so a caller may await it in a test, but
 * the answer path must not.
 */
export async function recordQuality(kind, { question = '', entry = null } = {}) {
  let store
  try {
    store = getStore('quality')
  } catch (error) {
    // Outside Netlify, or storage is down. Neither is worth a failed answer.
    console.warn(`joy: quality store unavailable (${kind} not counted): ${error.message}`)
    return
  }

  const day = today()
  const counterKey = `${kind}:${day}`

  try {
    const current = (await store.get(counterKey, { type: 'json' }).catch(() => null)) ?? { count: 0 }
    const count = current.count + 1
    await store.setJSON(counterKey, { count, day })

    /*
      A rescue is a gap in an entry, so it goes where gaps already go. The
      review page and the digest read that store; nothing new has to be checked.
    */
    if (kind === 'rescue' && question) {
      const questions = getStore('questions')
      const id = randomUUID()
      await questions.setJSON(id, {
        id,
        question,
        email: null,
        asked_at: new Date().toISOString(),
        source: 'rescue',
        entry,
        answered: false,
        notified: false,
      })
    }

    // Alert on the first crossing each day, so a busy day sends one mail.
    const threshold = THRESHOLDS[kind]
    if (threshold > 0 && count === threshold) {
      const alertKey = `alerted:${kind}:${day}`
      const alerted = await store.get(alertKey, { type: 'json' }).catch(() => null)
      if (!alerted) {
        await store.setJSON(alertKey, { at: new Date().toISOString() })
        await notify(kind, count, day)
      }
    }
  } catch (error) {
    console.error(`joy: recording a ${kind} failed:`, error.message)
  }
}
