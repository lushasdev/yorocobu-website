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
import { createHash, randomUUID } from 'node:crypto'

const QUESTION_MAX = 2000
const EMAIL_MAX = 254
const RATE_LIMIT = 5 // submissions per window, per caller
const RATE_WINDOW_MS = 60 * 60 * 1000

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

/**
 * A stable but non-reversible id for a caller, salted per day so it cannot be
 * correlated across days or matched against a list of known addresses.
 */
function callerId(req) {
  const address =
    req.headers.get('x-nf-client-connection-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  const day = new Date().toISOString().slice(0, 10)
  const salt = process.env.RATE_LIMIT_SALT ?? 'yorocobu'
  return createHash('sha256').update(`${salt}:${day}:${address}`).digest('hex').slice(0, 32)
}

async function overRateLimit(id) {
  const store = getStore('rate-limits')
  const now = Date.now()
  const record = await store.get(id, { type: 'json' }).catch(() => null)

  if (!record || now - record.start > RATE_WINDOW_MS) {
    await store.setJSON(id, { start: now, count: 1 })
    return false
  }
  if (record.count >= RATE_LIMIT) return true

  await store.setJSON(id, { start: record.start, count: record.count + 1 })
  return false
}

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
      from: process.env.GAPS_EMAIL_FROM ?? 'Yorocobu <onboarding@resend.dev>',
      to: [to],
      ...(email ? { reply_to: email } : {}),
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

  if (await overRateLimit(callerId(req))) {
    return json(429, { error: 'a few too many just now. Try again a little later.' })
  }

  const id = randomUUID()
  const record = {
    id,
    question,
    email: email || null,
    asked_at: new Date().toISOString(),
    source: String(body.source ?? 'unknown') === 'manual' ? 'manual' : 'unknown',
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
