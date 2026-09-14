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

/*
  Why a ratio and not "contains any Japanese".

  A correct ENGLISH answer from this knowledge base routinely contains Japanese
  characters, because two of the things the site publishes are Japanese words it
  is explaining: the name comes from 喜ぶ, the mark is 喜, and the documentary is
  called 忘れ者 — which contains a hiragana れ, so even "kana means Japanese"
  would flag it. Measured against the real entries, the worst realistic English
  answer sits around 11% (a short reply that is mostly the film's title); the
  name entry's answer is under 3%.

  A typical Japanese reply is 80% or more, because Japanese spends few
  characters on the Latin alphabet. The narrowest case is a short Japanese
  sentence that is mostly proper nouns this site keeps in Latin — "Ethan
  Gailushas と Bence Burton の二名が創業しました。どちらも Co-Founder です。"
  measures 33%, and that is the closest a real Japanese reply gets.

  So the honest gap is 12% to 33%, not 12% to 80%. 0.25 sits between them with
  roughly equal room either side, and both ends are pinned by fixtures in
  scripts/check-language.mjs so that narrowing the gap breaks a test rather than
  quietly degrading. If a future entry pushes an English answer past 25% — a
  reply that is mostly a Japanese title, say — the fixture is where it will
  show up first.
*/
const JAPANESE_THRESHOLD = 0.25

/*
  The mirror, for when Japanese is the requested locale.

  Looser, because a correct Japanese answer carries more Latin than a correct
  English one carries Japanese: "Yorocobu", "Joy", "React", "Swift", "Flutter"
  and both founders' names all stay in Latin script by design, and a short
  Japanese answer that names three technologies can be a third Latin without
  anything being wrong.
*/
const LATIN_THRESHOLD = 0.7

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

  const share = japaneseShare(value)

  if (locale === 'en') {
    if (share > JAPANESE_THRESHOLD) {
      return `expected English, got ${Math.round(share * 100)}% Japanese script`
    }
    return null
  }

  if (locale === 'ja') {
    if (share < 1 - LATIN_THRESHOLD && count(value, LATIN) > 0) {
      return `expected Japanese, got ${Math.round((1 - share) * 100)}% Latin script`
    }
    return null
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
