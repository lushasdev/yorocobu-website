import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { resolve, pickSuggestions } from '../lib/navigator.js'

const PLACEHOLDER = 'ask me about what we build'

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

  useEffect(() => stop, [stop])
  return { text, streaming, stream, setText }
}

export default function Console() {
  const [value, setValue] = useState('')
  const [engaged, setEngaged] = useState(false)
  const [transcript, setTranscript] = useState([])
  const [active, setActive] = useState(null)
  const [highlight, setHighlight] = useState(-1)
  const [suggestions, setSuggestions] = useState([])
  const inputRef = useRef(null)
  const mirrorRef = useRef(null)
  const [caretX, setCaretX] = useState(0)
  const { text, streaming, stream } = useStreamedReply()

  const reducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  useEffect(() => setSuggestions(pickSuggestions(4)), [])

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
    if (active?.result.focus_section) root.dataset.focus = active.result.focus_section
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

  // Track the caret position so the vermilion block sits after the typed text.
  useEffect(() => {
    if (mirrorRef.current) setCaretX(mirrorRef.current.offsetWidth)
  }, [value])

  const ask = useCallback(
    (query) => {
      const trimmed = query.trim()
      if (!trimmed) return

      const result = resolve(trimmed)
      const item = { n: transcript.length + 1, query: trimmed, result }

      setTranscript((prev) => [...prev, item])
      setActive(item)
      setEngaged(true)
      setValue('')
      setHighlight(-1)
      stream(result.reply, { instant: reducedMotion })
    },
    [transcript.length, stream, reducedMotion]
  )

  const restore = useCallback(
    (item) => {
      setActive(item)
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
    if (engaged || suggestions.length === 0) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const next = (highlight + delta + suggestions.length + 1) % (suggestions.length + 1)
      setHighlight(next === suggestions.length ? -1 : next)
      setValue(next === suggestions.length ? '' : suggestions[next] ?? '')
    }
  }

  return (
    <div className="console" data-engaged={engaged || undefined}>
      {/* Streaming indicator: a vermilion hairline across the very top of the viewport. */}
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

            {!streaming && active.result.actions.length > 0 && (
              <div className="answer__actions unmask">
                {active.result.actions.map((action) => (
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
                ))}
              </div>
            )}

            {!streaming && active.result.followups.length > 0 && (
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
            The hint sits above the rule rather than inside the field, so the
            vermilion block caret has the line to itself.
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

        {!engaged && suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((suggestion, i) => (
              <button
                key={suggestion}
                type="button"
                className="chip"
                data-highlight={highlight === i || undefined}
                onClick={() => ask(suggestion)}
              >
                <span className="chip__bullet" aria-hidden="true" />
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  )
}
