import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolve, DESTINATIONS } from '../lib/navigator.js'
import { askJoy } from '../lib/joy.js'
import { COMPOSE_QUESTIONS } from '../lib/compose-fallback.js'

const PLACEHOLDER = 'ask Joy for anything on this site'

/** Reveal a reply progressively. A response that appears all at once reads as a page load. */
function useStreamedReply() {
  const [text, setText] = useState('')
  const [streaming, setStreaming] = useState(false)
  const timer = useRef(null)

  const stop = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
  }, [])

  const stream = useCallback(
    (full, { instant = false } = {}) => {
      stop()
      if (instant) {
        setText(full)
        setStreaming(false)
        return
      }
      setText('')
      setStreaming(true)
      // Word by word rather than character by character: fast enough to feel live,
      // slow enough to read as arriving.
      const words = full.split(' ')
      let i = 0
      timer.current = window.setInterval(() => {
        i += 1
        setText(words.slice(0, i).join(' '))
        if (i >= words.length) {
          stop()
          setStreaming(false)
        }
      }, 22)
    },
    [stop]
  )

  /** A delta straight from the model: already arriving, no simulation needed. */
  const live = useCallback(
    (partial) => {
      stop()
      setStreaming(true)
      setText(partial)
    },
    [stop]
  )

  const settle = useCallback(() => setStreaming(false), [])

  useEffect(() => stop, [stop])
  return { text, streaming, stream, live, settle, setText }
}

/**
 * Compose mode: a short guided exchange that ends in a drafted message.
 *
 * Joy asks at most three short questions, one at a time, drafts from what the
 * visitor said, and shows the draft editable in place. Nothing is ever sent
 * without an explicit send — there is no auto-send on the last answer.
 *
 * Without the model this degrades to the same questions and a template draft.
 * It is the only conversion path on the site, so it has to work when the API
 * does not.
 */
function Compose({ seed, onClose }) {
  const [turns, setTurns] = useState([])
  const [value, setValue] = useState('')
  const [prompt, setPrompt] = useState(null)
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState(null)
  const [honeypot, setHoneypot] = useState('')
  const [state, setState] = useState('starting') // starting | asking | thinking | drafted | sending | sent | error
  const [error, setError] = useState('')
  const [replying, setReplying] = useState(false)
  const fieldRef = useRef(null)
  const draftRef = useRef(null)

  const advance = useCallback(
    async (answer, history) => {
      setState('thinking')
      const result = await askJoy({
        mode: 'compose',
        question: answer,
        turns: history,
        seed,
        onDelta: setNote,
      })
      setNote(result.reply ?? '')
      if (result.done && result.draft) {
        setDraft(result.draft)
        setState('drafted')
      } else {
        setPrompt(result.next_question ?? COMPOSE_QUESTIONS[0].ask)
        setState('asking')
      }
    },
    [seed]
  )

  // Always open on the first question. The seed is what the visitor typed to get
  // here; it is carried into the draft as their own words, but it is not an
  // answer to anything, so it is not counted as one.
  useEffect(() => {
    advance('', [])
  }, [advance])

  useEffect(() => {
    if (state === 'asking') fieldRef.current?.focus()
    if (state === 'drafted') draftRef.current?.focus()
  }, [state])

  const answer = (event) => {
    event.preventDefault()
    const said = value.trim()
    if (!said || state !== 'asking') return
    // `turns` is the history BEFORE this answer; the answer travels separately as
    // the question. Including it in both counts it twice.
    const prior = [...turns, { role: 'assistant', content: prompt ?? '' }]
    setTurns([...prior, { role: 'user', content: said }])
    setValue('')
    advance(said, prior)
  }

  const send = async () => {
    if (state === 'sending') return
    setState('sending')
    setError('')
    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          question: draft,
          email: extractEmail([...turns.map((t) => t.content), draft].join(' ')),
          company: honeypot,
          source: 'compose',
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'that did not go through')
      setReplying(Boolean(data.replying))
      setState('sent')
    } catch (caught) {
      setError(caught.message)
      setState('error')
    }
  }

  if (state === 'sent') {
    return (
      <div className="compose compose--sent unmask" role="status">
        <p className="compose__note mono">
          Sent.{' '}
          {replying
            ? 'Ethan will reply to the address you gave.'
            : 'No address in there, so this one is a note for Ethan rather than a reply to you.'}
        </p>
        <button type="button" className="chip" onClick={onClose}>
          <span className="chip__bullet" aria-hidden="true" />
          close
        </button>
      </div>
    )
  }

  return (
    <div className="compose unmask">
      {note && <p className="compose__note mono">{note}</p>}

      {(state === 'asking' || state === 'thinking') && (
        <form onSubmit={answer}>
          <label className="compose__label mono" htmlFor="compose-answer">
            {prompt ?? COMPOSE_QUESTIONS[0].ask}
          </label>
          <div className="field compose__field">
            <input
              id="compose-answer"
              ref={fieldRef}
              className="field__input"
              type="text"
              value={value}
              autoComplete="off"
              disabled={state === 'thinking'}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <div className="compose__controls">
            <button type="submit" className="action action--button" disabled={state === 'thinking'}>
              {state === 'thinking' ? 'One moment' : 'Next'}
            </button>
            <button type="button" className="chip" onClick={onClose}>
              <span className="chip__bullet" aria-hidden="true" />
              never mind
            </button>
          </div>
        </form>
      )}

      {(state === 'drafted' || state === 'sending' || state === 'error') && (
        <>
          <label className="compose__label mono" htmlFor="compose-draft">
            Your message, edit anything
          </label>
          <textarea
            id="compose-draft"
            ref={draftRef}
            className="compose__draft"
            rows={5}
            value={draft ?? ''}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="compose__controls">
            <button
              type="button"
              className="action action--button"
              onClick={send}
              disabled={state === 'sending' || !draft?.trim()}
            >
              {state === 'sending' ? 'Sending' : 'Send it'}
            </button>
            <button type="button" className="chip" onClick={onClose}>
              <span className="chip__bullet" aria-hidden="true" />
              never mind
            </button>
          </div>
        </>
      )}

      {/* Bots fill this in; people never see it. */}
      <input
        className="compose__trap"
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={honeypot}
        onChange={(event) => setHoneypot(event.target.value)}
      />

      {state === 'error' && (
        <p className="compose__error mono" role="alert">
          {error}. The address is on the full index if you would rather write directly.
        </p>
      )}
    </div>
  )
}

/** The reply-to address, if the visitor happened to give one. */
function extractEmail(text) {
  return text.match(/[^\s<>@]+@[^\s<>@.]+\.[^\s<>@]+/)?.[0] ?? ''
}

export default function Console() {
  const [value, setValue] = useState('')
  const [compose, setCompose] = useState({ open: false, seed: '' })
  const [engaged, setEngaged] = useState(false)
  const [transcript, setTranscript] = useState([])
  const [active, setActive] = useState(null)
  const [highlight, setHighlight] = useState(-1)
  const inputRef = useRef(null)
  const mirrorRef = useRef(null)
  const [caretX, setCaretX] = useState(0)
  const { text, streaming, stream, live, settle } = useStreamedReply()

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  // Take the caret once calibration has handed off, but only where there is a
  // real pointer: focusing on touch would throw up the soft keyboard on arrival.
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    const root = document.documentElement
    if (!root.dataset.booting) {
      inputRef.current?.focus()
      return
    }
    const observer = new MutationObserver(() => {
      if (!root.dataset.booting) {
        inputRef.current?.focus()
        observer.disconnect()
      }
    })
    observer.observe(root, { attributes: true, attributeFilter: ['data-booting'] })
    return () => observer.disconnect()
  }, [])

  // Surface the matching server-rendered region alongside the prose answer.
  useEffect(() => {
    const root = document.documentElement
    if (active?.result?.focus_section) root.dataset.focus = active.result.focus_section
    else delete root.dataset.focus
  }, [active])

  useEffect(() => {
    if (engaged) document.documentElement.dataset.engaged = 'true'
  }, [engaged])

  // Keep the console clear of the soft keyboard on mobile.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`)
    }
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    sync()
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [])

  // `/` or Cmd+K focuses the input from anywhere.
  useEffect(() => {
    const onKey = (event) => {
      const typingElsewhere =
        event.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA'].includes(event.target.tagName)
      if ((event.key === '/' && !typingElsewhere) || (event.key === 'k' && (event.metaKey || event.ctrlKey))) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Track the caret position so the accent block sits after the typed text.
  useEffect(() => {
    if (mirrorRef.current) setCaretX(mirrorRef.current.offsetWidth)
  }, [value])

  const ask = useCallback(
    async (query) => {
      const trimmed = query.trim()
      const label = trimmed || 'what is yorocobu'
      const n = transcript.length + 1

      // The question and the migration land immediately; the answer follows.
      setActive({ n, query: label, result: null })
      setCompose({ open: false, seed: '' })
      setEngaged(true)
      setValue('')
      setHighlight(-1)
      live('')

      const result = await askJoy({ mode: 'answer', question: trimmed, onDelta: live })

      // A degraded answer is replayed through the simulated stream so it still
      // arrives rather than appearing all at once.
      if (result.degraded) stream(result.reply, { instant: reducedMotion })
      else settle()

      const item = { n, query: label, result }
      setTranscript((prev) => [...prev, item])
      setActive(item)
    },
    [transcript.length, stream, live, settle, reducedMotion]
  )

  const restore = useCallback(
    (item) => {
      setActive(item)
      setCompose({ open: false, seed: '' })
      stream(item.result.reply, { instant: true })
    },
    [stream]
  )

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setValue('')
      setHighlight(-1)
      return
    }
    if (engaged || DESTINATIONS.length === 0) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const count = DESTINATIONS.length
      const next = (highlight + delta + count + 1) % (count + 1)
      setHighlight(next === count ? -1 : next)
      setValue(next === count ? '' : DESTINATIONS[next]?.query ?? '')
    }
  }

  return (
    <div className="console" data-engaged={engaged || undefined}>
      {/* Streaming indicator: an accent hairline across the very top of the viewport. */}
      <div
        className="console__progress"
        data-streaming={streaming || undefined}
        aria-hidden="true"
      />

      {/* Past queries, numbered, in a narrow left rail. */}
      {transcript.length > 0 && (
        <nav className="rail" aria-label="Your questions">
          <ol>
            {transcript.map((item) => (
              <li key={item.n}>
                <button
                  type="button"
                  onClick={() => restore(item)}
                  data-active={active?.n === item.n || undefined}
                >
                  <span className="rail__n">{String(item.n).padStart(2, '0')}</span>
                  <span className="rail__q">{item.query}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* The answer, typeset as content rather than as a transcript bubble. */}
      <div className="answer" aria-live="polite" aria-atomic="false">
        {active && (
          <article className="answer__body" key={active.n}>
            <p className="answer__q mono">{active.query}</p>
            <p className="answer__text">{text}</p>

            {!streaming && active.result?.actions?.length > 0 && (
              <div className="answer__actions unmask">
                {active.result.actions.map((action) =>
                  action.type === 'compose' ? (
                    <button
                      key={action.label}
                      type="button"
                      className="action action--button"
                      onClick={() => setCompose({ open: true, seed: action.value })}
                      aria-expanded={compose.open}
                    >
                      {action.label}
                    </button>
                  ) : (
                    <a
                      key={action.label}
                      className="action"
                      href={action.value}
                      {...(action.type === 'link'
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {action.label}
                    </a>
                  )
                )}
              </div>
            )}

            {!streaming && compose.open && (
              <Compose seed={compose.seed} onClose={() => setCompose({ open: false, seed: '' })} />
            )}

            {!streaming && active.result?.followups?.length > 0 && (
              <div className="answer__followups unmask">
                {active.result.followups.map((followup) => (
                  <button key={followup} type="button" className="chip" onClick={() => ask(followup)}>
                    <span className="chip__bullet" aria-hidden="true" />
                    {followup}
                  </button>
                ))}
              </div>
            )}
          </article>
        )}
      </div>

      {/* The input. On arrival it sits centred; once engaged it becomes a status bar. */}
      <form
        className="bar"
        onSubmit={(event) => {
          event.preventDefault()
          ask(value)
        }}
      >
        <div className="bar__inner">
          <label className="visually-hidden" htmlFor="console-input">
            Ask about Yorocobu
          </label>
          {/*
            The introduction. The console replaced the nav bar, so it has to do a
            nav bar's job and say what it is.

            Arrival only: once the first query resolves and the console migrates
            to the bottom, the whole block goes. Nothing this bold survives being
            read fifteen times.
          */}
          {!engaged && (
            <div className="intro">
              <p className="intro__status mono">JOY // NAVIGATOR // ready</p>
              <p className="intro__claim">This is the future of websites.</p>
              <p className="intro__proof">No menus. No hunting. Just a guide.</p>
              <p className="intro__body">This is Joy. She can help you find anything here.</p>
            </div>
          )}

          {/*
            The hint sits above the rule rather than inside the field, so the
            accent block caret has the line to itself.
          */}
          <p className="bar__hint mono">{engaged ? 'ask another' : PLACEHOLDER}</p>
          <div className="field">
            <input
              id="console-input"
              ref={inputRef}
              className="field__input"
              type="text"
              value={value}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <span className="field__mirror" ref={mirrorRef} aria-hidden="true">
              {value}
            </span>
            <span
              className="field__caret"
              style={{ transform: `translateX(${caretX}px)` }}
              aria-hidden="true"
            />
          </div>
          <button type="submit" className="visually-hidden">
            Ask
          </button>
        </div>

        {/*
          The site map, not example questions. A visitor arriving at a site with
          no menu needs to see its shape immediately; rotating examples show range
          but hide structure. Fixed, and derived from /knowledge/ so they cannot
          drift from what the site actually holds.
        */}
        {!engaged && (
          <nav className="suggestions" aria-label="Everything on this site">
            {DESTINATIONS.map((destination, i) => (
              <button
                key={destination.id}
                type="button"
                className="chip"
                data-highlight={highlight === i || undefined}
                onClick={() => ask(destination.query)}
              >
                <span className="chip__bullet" aria-hidden="true" />
                {destination.label}
              </button>
            ))}
          </nav>
        )}
      </form>
    </div>
  )
}
