/**
 * POST /api/ask — a visitor sends a question the navigator could not answer.
 *
 * This is the gaps queue. Every question the site could not answer lands in one
 * Netlify Blobs store, whether or not the visitor left an address, because the
 * gap is worth knowing about even when there is nobody to reply to. The weekly
 * digest and the protected review page read from this same store; there is not a
 * second one.
 *
 * Deliberately not recorded: IP addresses, user agents, or anything else that
 * identifies the person asking. Rate limiting needs to recognise a repeat caller,
 * so it keys on a salted hash of the address that is never written alongside the
 * question and cannot be reversed to one.
 */

import { getStore } from '@netlify/blobs'
import { randomUUID } from 'node:crypto'
import { json, callerId, overRateLimit } from './_shared/limits.mjs'

const QUESTION_MAX = 2000
const EMAIL_MAX = 254
const RATE_LIMIT = 5 // submissions per window, per caller
const RATE_WINDOW_MS = 60 * 60 * 1000

/**
 * Notify by email if a provider is configured. A missing key is not an error:
 * the question is already durably recorded, and the weekly digest will carry it.
 */
async function notify({ question, email, id }) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.GAPS_EMAIL_TO
  if (!key || !to) return { sent: false, reason: 'not configured' }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.GAPS_EMAIL_FROM ?? 'Joy <onboarding@resend.dev>',
      to: [to],
      /*
        Reply-To is the visitor when they gave an address, so hitting reply
        answers them directly. Otherwise it is the monitored inbox.

        What it is never is the From address: that is a sending subdomain nobody
        reads, and a reply landing there would be lost.
      */
      reply_to: email || to,
      subject: `Question from the site: ${question.slice(0, 60)}`,
      text: [
        question,
        '',
        email ? `Reply to: ${email}` : 'No reply address given.',
        `Reference: ${id}`,
      ].join('\n'),
    }),
  })

  if (!response.ok) {
    console.error('ask: email provider returned', response.status, await response.text())
    return { sent: false, reason: 'provider error' }
  }
  return { sent: true }
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' })

  let body
  try {
    body = await req.json()
  } catch {
    return json(400, { error: 'expected json' })
  }

  const question = String(body.question ?? '').trim()
  const email = String(body.email ?? '').trim()
  const honeypot = String(body.company ?? '').trim()

  // A bot filling the hidden field gets the same response a person would, so it
  // has nothing to learn from the difference.
  if (honeypot) return json(200, { ok: true })

  if (!question) return json(400, { error: 'question is required' })
  if (question.length > QUESTION_MAX) return json(400, { error: 'question is too long' })
  if (email && (email.length > EMAIL_MAX || !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email))) {
    return json(400, { error: 'that email address does not look right' })
  }

  if (await overRateLimit(callerId(req), 'ask', RATE_LIMIT, RATE_WINDOW_MS)) {
    return json(429, { error: 'a few too many just now. Try again a little later.' })
  }

  const id = randomUUID()
  const record = {
    id,
    question,
    email: email || null,
    asked_at: new Date().toISOString(),
    // Where it came from, so the gaps queue distinguishes a question Joy could
    // not answer from a message someone deliberately composed.
    source: ['compose', 'manual', 'unknown'].includes(body.source) ? body.source : 'unknown',
    answered: false,
    notified: false,
  }

  const store = getStore('questions')
  await store.setJSON(id, record)

  const result = await notify({ question, email, id }).catch((error) => {
    console.error('ask: notify failed', error)
    return { sent: false, reason: 'threw' }
  })

  if (result.sent) await store.setJSON(id, { ...record, notified: true })

  return json(200, { ok: true, replying: Boolean(email) })
}

export const config = { path: '/api/ask' }
