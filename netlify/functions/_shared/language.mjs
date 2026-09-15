/**
 * Is this text actually in the language we asked for?
 *
 * The prompt asks the model to answer in one locale. A prompt is an instruction,
 * and the whole history of this project is instructions being followed unevenly
 * — four rounds of prompt lines did not stop stray offers, which is why
 * decideOffer exists. So the language constraint gets the same treatment: the
 * prompt asks, and this checks.
 *
 * It matters more than the offer rules did. If Joy answers a Japanese question
 * in Japanese today, every output guard downstream fails open at once —
 * decideOffer's sentence splitter returns the whole reply, GAP_SHAPED matches
 * nothing, fixComposeLabels matches nothing — and the console is meanwhile
 * displaying a line that promises the answer will be in English. A wrong answer
 * is bad; a wrong answer underneath a notice saying it will not happen is worse.
 *
 * WHAT THIS IS NOT. It is not language identification. It does not know English
 * from German, and it is not trying to: the only distinction that matters here
 * is script, because the two locales this site serves do not share one.
 */

/*
  Character classes, by script rather than by language.

  Kana is the reliable Japanese marker — hiragana and katakana appear in no
  other language. Han is deliberately counted too, but neither is used on its
  own: see the ratio below for why a bare "contains Japanese" test is wrong.
*/
const KANA = /[぀-ゟ゠-ヿ]/gu
const HAN = /[一-鿿]/gu
const LATIN = /[A-Za-z]/gu

const count = (text, pattern) => (String(text ?? '').match(pattern) ?? []).length

/**
 * The share of a text that is Japanese script, against the Latin it competes
 * with. Returns 0 for text with neither.
 */
export function japaneseShare(text) {
  const japanese = count(text, KANA) + count(text, HAN)
  const latin = count(text, LATIN)
  if (japanese + latin === 0) return 0
  return japanese / (japanese + latin)
}

/**
 * The maximal runs of Japanese characters in a text, longest first.
 *
 * Punctuation is not Japanese script here, so 。、「」 break a run. That is
 * deliberate: it splits Japanese prose into clause-sized pieces, which is the
 * scale this is measuring at.
 */
function japaneseRuns(text) {
  return (String(text ?? '').match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/gu) ?? [])
    .map((run) => run.length)
    .sort((a, b) => b - a)
}

/*
  Why a ratio ALONE is not enough, and what replaced it.

  A correct ENGLISH answer from this knowledge base routinely contains Japanese,
  because several things the site publishes are Japanese words it is explaining:
  the name comes from 喜ぶ, the mark is 喜, and the documentary is called 忘れ者
  — a title the entry glosses against 忘れ物, the everyday word for a lost
  object. So a correct answer about the title carries two Japanese terms in one
  short sentence.

  A plain share broke on exactly that. "The title is 忘れ者, a play on 忘れ物."
  measures 26% and was refused; "忘れ者 plays on 忘れ物." measures 46%. Both are
  correct English. Raising the threshold to clear them would have put it above
  the 33% that a real Japanese reply full of Latin proper nouns measures, and
  the two classes would have overlapped with nothing to separate them.

  The signal that does separate them is RUN LENGTH, not quantity. A quoted term
  is a short island of Japanese in a Latin sentence — 忘れ者 is three characters,
  工藤さくら is five. Japanese prose has long runs, because whole clauses are
  Japanese: 「の二名が創業しました」 is nine, 「でアプリを作っています」 is
  eleven. Counting only the characters in runs longer than a name leaves a
  correct English answer at zero however many terms it quotes.

  QUOTE_MAX is 6 rather than 4 so that the documentary's interview subjects —
  工藤さくら, 綾野月見, 初音ミク — are treated as the names they are.

  The overall share survives as a backstop, for a reply that is Japanese without
  containing any long run. Neither signal alone is right; the pair is.

  Every number here is pinned by fixtures in scripts/check-language.mjs, from
  both directions, so moving one breaks a test rather than quietly degrading.
*/
const QUOTE_MAX = 6
const PROSE_THRESHOLD = 0.15
const OVERALL_THRESHOLD = 0.5

/** The share of a text that is Japanese PROSE, ignoring quoted terms. */
export function japaneseProseShare(text) {
  const prose = japaneseRuns(text)
    .filter((length) => length > QUOTE_MAX)
    .reduce((total, length) => total + length, 0)
  const latin = count(text, LATIN)
  if (prose + latin === 0) return 0
  return prose / (prose + latin)
}

/**
 * Is this text Japanese, as opposed to English that quotes Japanese?
 *
 * One predicate, used in both directions, so the two locales cannot drift into
 * disagreeing about what counts as Japanese.
 */
export function looksJapanese(text) {
  return japaneseProseShare(text) > PROSE_THRESHOLD || japaneseShare(text) > OVERALL_THRESHOLD
}

/**
 * Whether a string is plausibly in the requested locale.
 *
 * @param {string} text
 * @param {'en'|'ja'} locale
 * @returns {string|null} a human-readable reason, or null when it is fine
 */
export function localeViolation(text, locale) {
  const value = String(text ?? '')
  // Nothing to judge. An empty reply is a different failure, caught elsewhere.
  if (!value.trim()) return null

  const japanese = looksJapanese(value)
  const detail =
    `${Math.round(japaneseProseShare(value) * 100)}% prose, ` +
    `${Math.round(japaneseShare(value) * 100)}% overall`

  if (locale === 'en') {
    return japanese ? `expected English, read as Japanese (${detail})` : null
  }

  if (locale === 'ja') {
    return japanese ? null : `expected Japanese, read as English (${detail})`
  }

  // An unknown locale is a programming error, not a response to judge. Say so
  // rather than silently approving, which is the failure this file exists for.
  return `no language check defined for locale "${locale}"`
}

/**
 * Check every field of a model result that is JOY speaking.
 *
 * Deliberately excludes `draft`. That field is the visitor's own message in the
 * visitor's own voice, and a Japanese visitor's message to Ethan should be in
 * Japanese whatever language Joy is answering in — forcing it to English would
 * rewrite what someone said, which is far worse than the problem being solved.
 *
 * @returns {string|null} the first violation found, or null
 */
export function resultLocaleViolation(result, locale) {
  if (!result) return null

  const spoken = [
    ['reply', result.reply],
    ['next_question', result.next_question],
    ...(result.actions ?? []).map((a, i) => [`actions[${i}].label`, a?.label]),
    ...(result.followups ?? []).map((f, i) => [`followups[${i}]`, f]),
  ]

  for (const [field, value] of spoken) {
    const reason = localeViolation(value, locale)
    if (reason) return `${field}: ${reason}`
  }
  return null
}
