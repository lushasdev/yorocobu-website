/**
 * Patterns that inspect Joy's OUTPUT, in one place, per locale.
 *
 * These lived in four copies: fixComposeLabels in joy.mjs, badLabel in
 * eval-knowledge.mjs, the denial test in check-navigator.mjs, and the refusal
 * assertions in check-ui.mjs. Two of them were the same regex written twice and
 * had already drifted — the function and the test that was supposed to be
 * checking the function no longer agreed about what they were looking for.
 *
 * Four copies would have become eight the moment Japanese was added, so they are
 * consolidated first. That ordering is the point: a duplicated pattern is a
 * nuisance in one language and a guarantee of divergence in two.
 *
 * A locale with no pattern set is an ERROR, never a fallback to English and
 * never a permissive default. The failure being replaced is a guard that
 * silently stops catching anything, and a guard that fails open is worse than
 * no guard at all, because a suite that cannot fail gets trusted.
 */

const EN = {
  /*
    Joy denying something she can actually do.

    The specific failure: she said she could not pass a message, gave out the
    email address, and then rendered the send control directly underneath.
    Routing to the contact entry is not enough if the words say no.
  */
  denial: /\b(can(no|')t|cannot|can not|unable|not able|do not have the ability|i do not send|do not have)\b/i,

  /*
    "Email Ethan" on the compose control is the denial in button form: the
    control sends the message from right here, and a label that says email
    teaches the visitor the opposite.
  */
  mailLabel: /\b(e-?mail|mail)\b/i,

  /*
    Joy expressing a preference she is not allowed to have. joy.md says she has
    no opinions or favourites; "I don't have favourites" is a correct answer,
    inventing one is not.
  */
  /*
    The adverb slot is not optional decoration. The original pattern was
    `i (like|love|...)`, which requires the verb to sit immediately after "I" —
    so "I really like React for this" went straight through, and the eval had
    been passing on it for as long as the case has existed. A fixture in
    check-eval-assertions.mjs found it the first time one was written.
  */
  expressedPreference: new RegExp(
    [
      'my favou?rite\\b.*\\bis',
      // "I would recommend", "I'd suggest": a modal counts as the adverb slot.
      "i (really |genuinely |personally |quite |do not |don'?t |never |always |would |'d |can )?(like|love|prefer|recommend|suggest|enjoy|listen to)\\b",
      'check out',
      'the best one is',
    ].join('|'),
    'i'
  ),
}

const JA = {
  /*
    The Japanese denial vocabulary is verb morphology rather than a modal, so
    there is no single word to look for. These are the forms a polite refusal
    actually takes: the plain negative potential (できません), the two humble
    forms a service voice reaches for (いたしかねます / できかねます), and the
    specific shapes of "I cannot send that" that this site's failure took.

    ません on its own is deliberately NOT here. It is the ordinary polite
    negative and appears in every correct refusal on the site — 「公開して
    いません」 is Joy doing her job. Matching it would flag every decline.
    Neither is ありません on its own: 「そのような情報はありません」 is a
    legitimate unknown, so only the compounds naming a capability are listed.

    Written as an array joined at the end rather than as one long literal. The
    first draft of this was a single alternation with an optional leading group
    and a required tail, which meant the whole pattern only ever matched the
    last branch — it missed three of the four denials it was written for while
    looking, in the file, exactly like it worked. Fixtures below catch that
    shape; the list form makes it harder to write in the first place.
  */
  denial: new RegExp(
    [
      // The plain and humble negative potentials.
      'できません',
      'できかねます',
      '致しかねます',
      'いたしかねます',
      'わかりかねます',
      '分かりかねます',
      'できない',
      '不可能',
      // "We do not handle that" about a capability.
      '対応して(おり|い)ません',
      // "I have no such function / permission."
      '(機能|権限)は(ありません|ございません)',
    ].join('|')
  ),

  /*
    The same trap in Japanese: a label that sends the visitor to their own mail
    client when the control sends from right here. メール covers the katakana,
    and 送信 is not included on purpose — 「質問を送る」 is the CORRECT label.
  */
  mailLabel: /(メール|mail|e-?mail|メールアドレス)/i,

  /*
    A stated preference. 好き and おすすめ are the two that matter; 一番 alone
    is excluded because 「一番近いのは」 is a legitimate way to point at the
    nearest entry.
  */
  expressedPreference:
    /(お気に入り|おすすめ(は|です|します)|好きです|好みです|一番(良い|いい|好き)|私は.*(が|を)(好き|愛用))/,
}

const PATTERNS = { en: EN, ja: JA }

export const supportedOutputLocales = Object.keys(PATTERNS)

/**
 * The output patterns for a locale, or a thrown error.
 *
 * @param {string} locale
 * @throws when the locale has no pattern set
 */
export function outputPatternsFor(locale) {
  const set = PATTERNS[locale]
  if (!set) {
    throw new Error(
      `output-patterns: no pattern set for locale "${locale}". A guard cannot ` +
        `inspect prose it has no patterns for, and passing everything is worse ` +
        `than failing. Supported: ${supportedOutputLocales.join(', ')}.`
    )
  }
  return set
}

/**
 * Does this text deny a capability Joy actually has?
 * @param {string} text
 * @param {string} locale
 */
export function deniesCapability(text, locale) {
  return outputPatternsFor(locale).denial.test(String(text ?? ''))
}

/** Does this compose label send the visitor away instead of sending from here? */
export function labelSaysEmail(label, locale) {
  return outputPatternsFor(locale).mailLabel.test(String(label ?? ''))
}

/** Does this text express a preference Joy is not allowed to have? */
export function expressesPreference(text, locale) {
  return outputPatternsFor(locale).expressedPreference.test(String(text ?? ''))
}
