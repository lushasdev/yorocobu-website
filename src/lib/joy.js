/**
 * Talking to Joy from the browser.
 *
 * Every call has a floor: if the function errors, rate limits, returns nonsense,
 * or simply takes too long, the deterministic matcher in navigator.js answers
 * instead and the visitor never sees a dead input. `source` on the result says
 * which path served it, so a bad API day is visible in the transcript rather
 * than silent.
 */

import { resolve } from './navigator.js'
import { composeFallback } from './compose-fallback.js'

/*
  Past this, the local answer is better than a spinner.

  Provisional, and deliberately generous. The previous 2500ms came from the eval,
  which calls the function in-process — no TLS, no cold start, no trip back to the
  browser — so it was a floor for the function's own work being spent as a budget
  for the whole round trip. The result was that the model was never once reached
  from a browser while the site looked like it was working.

  8000ms is set to stop cutting off answers that were on their way, not because
  anything measured 8000ms. TIMING below records every real request so this can be
  set from browser-side data instead of guessed a second time.
*/
const FIRST_TOKEN_TIMEOUT = 8000

/*
  Browser-side timing, recorded on every request whether it succeeds or falls back.

  Kept per session and reachable from the console as `__joyTiming()`, because the
  number that matters is the one measured on the visitor's clock and there was no
  way to see it. The request index is part of each sample on purpose: if the first
  request of a session is slow and the rest are quick, that is a cold start, and
  the fix is a longer budget for the first request rather than for all of them.
*/
const TIMING = []

function record(sample) {
  TIMING.push(sample)
  const label =
    sample.firstTokenMs === null
      ? `no first token in ${FIRST_TOKEN_TIMEOUT}ms — offline index (${sample.outcome})`
      : `first token ${sample.firstTokenMs}ms — ${sample.outcome}`
  console.info(`joy: request ${sample.n} · ${label}`)

  if (typeof window !== 'undefined' && !window.__joyTiming) {
    window.__joyTiming = () => {
      const got = TIMING.filter((t) => t.firstTokenMs !== null).map((t) => t.firstTokenMs)
      const rest = TIMING.slice(1).filter((t) => t.firstTokenMs !== null).map((t) => t.firstTokenMs)
      const p = (xs, q) =>
        xs.length ? [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil((q / 100) * xs.length) - 1)] : null
      console.table(TIMING)
      console.info(
        `joy timing over ${TIMING.length} request(s): ` +
          `first request ${TIMING[0]?.firstTokenMs ?? 'no first token'}ms, ` +
          `rest p50 ${p(rest, 50) ?? '—'}ms / p95 ${p(rest, 95) ?? '—'}ms, ` +
          `overall min ${got.length ? Math.min(...got) : '—'}ms max ${got.length ? Math.max(...got) : '—'}ms, ` +
          `${TIMING.filter((t) => t.firstTokenMs === null).length} fell back`
      )
      return TIMING
    }
  }
  return sample
}

/**
 * Pull the value of a string field out of JSON that is still being written.
 * Structured output means the reply arrives inside a JSON envelope, and waiting
 * for the closing brace would throw away the streaming entirely.
 */
export function partialString(buffer, field) {
  const start = buffer.indexOf(`"${field}"`)
  if (start === -1) return null
  const open = buffer.indexOf('"', buffer.indexOf(':', start) + 1)
  if (open === -1) return null

  let out = ''
  for (let i = open + 1; i < buffer.length; i++) {
    const char = buffer[i]
    if (char === '\\') {
      const next = buffer[i + 1]
      if (next === undefined) break
      out += next === 'n' ? '\n' : next === 't' ? '\t' : next === 'u' ? '' : next
      if (next === 'u') i += 4
      i += 1
      continue
    }
    if (char === '"') break
    out += char
  }
  return out
}

/**
 * @param {object} options
 * @param {'answer'|'compose'} options.mode
 * @param {string} options.question
 * @param {Array<{role: string, content: string}>} [options.turns]
 * @param {(text: string) => void} options.onDelta  called with the reply so far
 * @param {AbortSignal} [options.signal]
 */
export async function askJoy({ mode = 'answer', question, turns = [], seed = '', onDelta, signal }) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })

  // Nothing has streamed yet; give up and use the local answer.
  const timer = setTimeout(abort, FIRST_TOKEN_TIMEOUT)
  let sawDelta = false
  const started = performance.now()
  const n = TIMING.length + 1
  let firstTokenMs = null

  try {
    const response = await fetch('/api/joy', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, question, turns, seed }),
      signal: controller.signal,
    })
    if (!response.ok || !response.body) {
      const detail = await response.json().catch(() => ({}))
      const failure = new Error(detail.error ?? `joy ${response.status}`)
      failure.kind = detail.kind ?? 'transient'
      // The status is the whole diagnosis from this side: 404 means the function
      // is not in the deploy, 503 means it is but has no key, 502 means it could
      // not reach the model. Every one of them renders the same line in the
      // transcript, so the number has to be somewhere a person can find it.
      failure.status = response.status
      throw failure
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let raw = ''
    let final = null

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        let event
        try {
          event = JSON.parse(line.slice(5).trim())
        } catch {
          continue
        }
        if (event.error) throw new Error(event.error)
        if (event.delta) {
          if (!sawDelta) {
            sawDelta = true
            firstTokenMs = Math.round(performance.now() - started)
            clearTimeout(timer)
          }
          raw += event.delta
          const reply = partialString(raw, mode === 'compose' ? 'reply' : 'reply')
          if (reply) onDelta?.(reply)
        }
        if (event.done) final = event.result
      }
    }

    if (!final) throw new Error('no result')
    record({ n, mode, firstTokenMs, outcome: 'model', status: response.status })
    return { ...normalise(final, mode, question), firstTokenMs }
  } catch (error) {
    // Any failure at all lands here, including an abort on the timeout.
    const fallback =
      mode === 'compose' ? composeFallback(turns, question, seed) : resolve(question)
    fallback.source = 'local'
    fallback.degraded = true
    fallback.degradedReason = error?.kind === 'config' ? 'config' : 'transient'
    record({
      n,
      mode,
      firstTokenMs,
      outcome: error?.name === 'AbortError' ? 'timeout' : (error?.kind ?? 'transient'),
      status: error?.status ?? null,
      elapsedMs: Math.round(performance.now() - started),
    })
    if (error?.kind === 'config') {
      // Loud, because it will not recover on its own.
      console.error(
        `Joy is misconfigured and is falling back to the offline index: ${error.message}. ` +
          `Check OPENAI_API_KEY and the model id in netlify/functions/joy.mjs.`
      )
    } else {
      console.warn(
        `Joy fell back to the offline index: ${error?.name === 'AbortError' ? `no first token within ${FIRST_TOKEN_TIMEOUT}ms` : error?.message}` +
          `${error?.status ? ` (HTTP ${error.status} from /api/joy)` : ''}. ` +
          `A 404 here means the function is not in the deploy; anything else means it is.`
      )
    }
    // Deliberately no onDelta here. The caller replays the local reply through
    // its own simulated stream, so a degraded answer still arrives rather than
    // appearing all at once — streaming is the whole feel of this interface.
    return fallback
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

/**
 * The model returns action *types*, never URLs. Real links are attached here
 * from the entry the answer was grounded in, so an invented link is impossible.
 */
function normalise(result, mode, question) {
  if (mode === 'compose') {
    return {
      reply: String(result.reply ?? ''),
      next_question: result.next_question ?? null,
      draft: result.draft ?? null,
      done: Boolean(result.done && result.draft),
      source: 'model',
    }
  }

  const actions = (result.actions ?? [])
    .filter((a) => a && (a.type === 'compose' || a.type === 'index'))
    .map((a) => ({
      type: a.type,
      label: String(a.label ?? (a.type === 'index' ? 'Open the full index' : 'Send a message')),
      value: a.type === 'index' ? '/full-index' : question,
    }))

  return {
    reply: String(result.reply ?? ''),
    focus_section: result.focus_section ?? null,
    actions,
    followups: (result.followups ?? []).slice(0, 3).map(String),
    unknown: Boolean(result.unknown),
    used_entries: result.used_entries ?? [],
    source: 'model',
  }
}
