/**
 * Shared abuse controls for the /api/ functions.
 *
 * Rate limiting has to recognise a repeat caller, so it keys on a salted daily
 * hash of the address. That hash lives in its own store and is never written
 * beside a question, and it cannot be reversed to an address.
 */

import { getStore } from '@netlify/blobs'
import { createHash } from 'node:crypto'

export const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })

const warned = new Set()
const warnOnce = (message) => {
  if (warned.has(message)) return
  warned.add(message)
  console.warn(message)
}

export function callerId(req) {
  const address =
    req.headers.get('x-nf-client-connection-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  const day = new Date().toISOString().slice(0, 10)
  const salt = process.env.RATE_LIMIT_SALT ?? 'yorocobu'
  return createHash('sha256').update(`${salt}:${day}:${address}`).digest('hex').slice(0, 32)
}

/**
 * @param {string} id      caller hash
 * @param {string} bucket  which allowance, so asking and sending are separate
 * @param {number} limit   calls permitted per window
 * @param {number} windowMs
 *
 * Fails open. If the blob store is unavailable the request is allowed rather
 * than the function throwing: a storage hiccup should not take the navigator
 * down, and the hard token cap per request plus the monthly spend cap on the key
 * are the protections that actually bound the bill. This is defence in depth,
 * not the only defence.
 *
 * The only bypass is an environment variable, never anything from the request,
 * so a caller cannot ask to be exempted.
 */
export async function overRateLimit(id, bucket, limit, windowMs) {
  if (process.env.RATE_LIMIT_DISABLED === '1') {
    warnOnce('rate limiting is disabled by RATE_LIMIT_DISABLED — do not ship this way')
    return false
  }

  let store
  try {
    store = getStore('rate-limits')
  } catch (error) {
    warnOnce(`rate limit store unavailable, allowing requests: ${error.message}`)
    return false
  }

  const key = `${bucket}:${id}`
  const now = Date.now()
  const record = await store.get(key, { type: 'json' }).catch(() => null)

  try {
    if (!record || now - record.start > windowMs) {
      await store.setJSON(key, { start: now, count: 1 })
      return false
    }
    if (record.count >= limit) return true

    await store.setJSON(key, { start: record.start, count: record.count + 1 })
    return false
  } catch (error) {
    console.error('rate limit write failed, allowing request:', error.message)
    return false
  }
}
