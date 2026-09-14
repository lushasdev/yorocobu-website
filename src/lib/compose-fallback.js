/**
 * Compose mode without the model.
 *
 * The same three questions, asked in the same order, ending in a template draft
 * built only from what the visitor typed. This is now the site's only conversion
 * path, so it has to work when the API is down — a broken contact flow is worse
 * than a plain one.
 */

import { useTranslations, defaultLocale } from '../i18n/ui.ts'

/** The three questions, as dictionary keys. The words come from the locale. */
export const COMPOSE_QUESTION_KEYS = [
  { key: 'who', ask: 'composeFallback.who' },
  { key: 'what', ask: 'composeFallback.what' },
  { key: 'reply', ask: 'composeFallback.reply' },
]

/** The questions rendered for a locale. */
export function composeQuestions(locale = defaultLocale) {
  const t = useTranslations(locale)
  return COMPOSE_QUESTION_KEYS.map(({ key, ask }) => ({ key, ask: t(ask) }))
}

/*
  Sentence formatting is per-language, not universal.

  Capitalising the first letter and appending a full stop is correct English
  tidying and wrong everywhere else: Japanese has no letter case, and its
  sentence-ending mark is 。 rather than a period. Applying the English rules to
  a Japanese draft produced a sentence ending in "." mid-paragraph, which reads
  as broken to anyone who can read it.
*/
const FORMATTERS = {
  en: (text) => {
    const trimmed = text.trim()
    const capitalised = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
    return /[.!?]$/.test(capitalised) ? capitalised : `${capitalised}.`
  },
  ja: (text) => {
    const trimmed = text.trim()
    return /[。！？.!?]$/.test(trimmed) ? trimmed : `${trimmed}。`
  },
}

/** How the finished sentences are joined into a paragraph. */
const JOINERS = { en: ' ', ja: '' }

/**
 * @param {Array<{role: string, content: string}>} turns
 * @param {string} latest  what the visitor just typed
 * @param {string} seed    what they typed to get here, in their own words
 * @param {string} locale
 */
export function composeFallback(turns, latest, seed = '', locale = defaultLocale) {
  const t = useTranslations(locale)
  const sentence = FORMATTERS[locale] ?? FORMATTERS[defaultLocale]
  const joiner = JOINERS[locale] ?? JOINERS[defaultLocale]

  const answers = [
    ...turns.filter((t2) => t2.role === 'user').map((t2) => t2.content),
    ...(latest ? [latest] : []),
  ]
    .map((a) => String(a).trim())
    .filter(Boolean)

  const next = COMPOSE_QUESTION_KEYS[answers.length]
  if (next) {
    return {
      reply: answers.length === 0 ? t('composeFallback.ackFirst') : t('composeFallback.ackNext'),
      next_question: t(next.ask),
      draft: null,
      done: false,
      source: 'local',
    }
  }

  const [who, what, reply] = answers
  // Only what they typed. Capitalisation and a full stop are formatting, not
  // content; nothing is added and nothing is embellished.
  const draft = [
    who ? t('composeFallback.draftWho', { who }) : null,
    // What they typed to get here, in their words.
    seed && seed.trim() ? seed.trim() : null,
    what,
    reply ? t('composeFallback.draftReply', { reply }) : null,
  ]
    .filter(Boolean)
    .map(sentence)
    .join(joiner)

  return {
    reply: t('composeFallback.draftIntro'),
    next_question: null,
    draft,
    done: true,
    source: 'local',
  }
}
