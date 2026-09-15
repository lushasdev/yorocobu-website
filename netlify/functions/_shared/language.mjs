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
 * The maximal runs of Japanese characters in a text.
 *
 * Punctuation is not Japanese script here, so 。、「」 all break a run. That is
 * deliberate and it cuts both ways — see GRAMMAR_RUNS below for the half that
 * bites.
 */
function japaneseRuns(text) {
  return String(text ?? '').match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/gu) ?? []
}

/*
  Three signals, because no one of them holds on its own.

  1. PROSE SHARE — characters in runs longer than a quoted term.

  A correct ENGLISH answer here routinely contains Japanese, because several
  things the site publishes are Japanese words it is explaining: 喜ぶ, 喜, and
  忘れ者, which the documentary entry glosses against 忘れ物. A plain ratio broke
  on exactly that: "The title is 忘れ者, a play on 忘れ物." measures 26% and was
  refused. Raising the threshold to clear it would have put it above the 33% a
  Latin-heavy Japanese reply measures, leaving the two classes overlapping.

  Run LENGTH separates them. A quoted term is a short island of Japanese in a
  Latin sentence; Japanese prose has long runs because whole clauses are
  Japanese. Counting only runs longer than QUOTE_MAX puts every correct English
  answer at zero however many terms it quotes.

  2. OVERALL SHARE — the backstop, for Japanese too short to contain a long run.
  「はい、できます。」 is 0% prose and 100% overall.

  3. RUN COUNT and GRAMMAR RUNS — the register that defeats both of the above.

  Japanese tech copy keeps proper nouns in Latin and leaves only particles and
  copulas in Japanese: 「Mary Sakurai さんは Tokyo の rental girlfriend です。」
  Runs are さんは, の, です — nothing over QUOTE_MAX, overall share low. Prose
  and backstop both miss it, and 、 makes this worse rather than better, because
  a comma fragments a clause that would have been one long run into several
  short ones.

  Run count catches the general case: four or more separate Japanese runs is
  prose, whatever their length. A correct English answer quotes one to three
  terms, so three runs still passes.

  But the single short sentence above is only THREE runs, so count alone does
  not close the case that motivated it. What does is what those runs ARE. A run
  that is entirely hiragana and no longer than a particle phrase — さんは, の,
  です — is grammar, and English never produces it: the Japanese this site
  quotes in English is 喜ぶ, 喜, 忘れ者, 忘れ物, every one of which carries a
  kanji. Two such runs is Japanese sentence structure with the nouns swapped
  out.

  Every threshold here is pinned from both directions in
  scripts/check-language.mjs, so moving one breaks a test.
*/
const QUOTE_MAX = 6
const PROSE_THRESHOLD = 0.15
const OVERALL_THRESHOLD = 0.5
const RUN_COUNT_THRESHOLD = 4
const GRAMMAR_RUN_THRESHOLD = 2
const GRAMMAR_RUN_MAX = 4

/** The share of a text that is Japanese PROSE, ignoring quoted terms. */
export function japaneseProseShare(text) {
  const prose = japaneseRuns(text)
    .filter((run) => run.length > QUOTE_MAX)
    .reduce((total, run) => total + run.length, 0)
  const latin = count(text, LATIN)
  if (prose + latin === 0) return 0
  return prose / (prose + latin)
}

/**
 * Runs that are grammar rather than vocabulary: short, and entirely hiragana.
 *
 * This is the signal that survives a writer keeping every noun in Latin. It is
 * also why QUOTE_MAX can stay generous — a long quoted term is still a term,
 * and a bare particle is still a particle, regardless of how long the sentence
 * around it is.
 */
export function grammarRuns(text) {
  return japaneseRuns(text).filter(
    (run) => run.length <= GRAMMAR_RUN_MAX && /^[\u3040-\u309F]+$/u.test(run)
  ).length
}

/** How many separate islands of Japanese a text contains. */
export function runCount(text) {
  return japaneseRuns(text).length
}

/**
 * Is this text Japanese, as opposed to English that quotes Japanese?
 *
 * One predicate, used in both directions, so the two locales cannot drift into
 * disagreeing about what counts as Japanese.
 */
export function looksJapanese(text) {
  return (
    japaneseProseShare(text) > PROSE_THRESHOLD ||
    japaneseShare(text) > OVERALL_THRESHOLD ||
    runCount(text) >= RUN_COUNT_THRESHOLD ||
    grammarRuns(text) >= GRAMMAR_RUN_THRESHOLD
  )
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
    `${Math.round(japaneseShare(value) * 100)}% overall, ` +
    `${runCount(value)} runs, ${grammarRuns(value)} grammar`

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
