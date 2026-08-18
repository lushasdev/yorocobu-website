/**
 * Compose mode without the model.
 *
 * The same three questions, asked in the same order, ending in a template draft
 * built only from what the visitor typed. This is now the site's only conversion
 * path, so it has to work when the API is down — a broken contact flow is worse
 * than a plain one.
 */

export const COMPOSE_QUESTIONS = [
  { key: 'who', ask: 'Who am I passing this to Ethan from?' },
  { key: 'what', ask: 'And what are you working on?' },
  { key: 'reply', ask: 'Where should he reply?' },
]

const sentence = (text) => {
  const trimmed = text.trim()
  const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
  return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`
}

/**
 * @param {Array<{role: string, content: string}>} turns
 * @param {string} latest  what the visitor just typed
 */
export function composeFallback(turns, latest, seed = '') {
  const answers = [
    ...turns.filter((t) => t.role === 'user').map((t) => t.content),
    ...(latest ? [latest] : []),
  ]
    .map((a) => String(a).trim())
    .filter(Boolean)

  const next = COMPOSE_QUESTIONS[answers.length]
  if (next) {
    return {
      reply: answers.length === 0 ? 'Happy to pass a message along.' : 'Got it.',
      next_question: next.ask,
      draft: null,
      done: false,
      source: 'local',
    }
  }

  const [who, what, reply] = answers
  // Only what they typed. Capitalisation and a full stop are formatting, not
  // content; nothing is added and nothing is embellished.
  const draft = [
    who ? `I'm ${who}` : null,
    // What they typed to get here, in their words.
    seed && seed.trim() ? seed.trim() : null,
    what,
    reply ? `You can reach me at ${reply}` : null,
  ]
    .filter(Boolean)
    .map(sentence)
    .join(' ')

  return {
    reply: 'Here is what I have. Edit anything, then send it.',
    next_question: null,
    draft,
    done: true,
    source: 'local',
  }
}
