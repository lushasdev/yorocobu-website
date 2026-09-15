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
    actually takes.

    Biased hard toward PRECISION, because compose is already asserted on the
    action token. This regex is a second layer: a miss costs one layer, a false
    positive fails a correct answer outright.

    Excluded on purpose, each for a different reason:

      ません, ありません — the ordinary polite negative, in every correct
        refusal on the site. 「公開していません」 is Joy doing her job.

      対応しておりません — this site belongs to a company that builds apps, so
        「Android には対応しておりません」 is a product fact rather than Joy
        denying anything about herself.

      できない — Joy speaks です・ます, so the plain form mostly turns up in
        embedded, instructional clauses: 「メールが送信できない場合は、こちら
        まで」. できません already covers what she actually says.

    NEVER write /かね(ます|ません)/. 〜かねます is a polite refusal;
    〜かねません means "is liable to" and is the opposite — 「誤解を招きかね
    ません」 is a warning, not a denial. One character apart. The fixtures in
    check-eval-assertions.mjs carry かねません on the must-not-fire side so this
    is enforced rather than remembered.
  */
  denial: new RegExp(
    [
      // The negative potential, polite form only.
      'できません',
      // Humble refusals. Note ます, never ません — see above.
      'できかねます',
      '致しかねます',
      'いたしかねます',
      'わかりかねます',
      '分かりかねます',
      /*
        不可能 needs the lookahead: 「不可能ではありません」 means the opposite
        and fired on the first draft of this.
      */
      '不可能(?!では(あり|ござい)ません|ではない|ではなく)',
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
    A stated preference.

    The comparative forms matter more than the possessive ones: 「Flutter の方
    がいいです」 is exactly what an over-helpful model says, and none of
    お気に入り / おすすめ / 好きです touches it. お気に入り is the weakest of
    the set and is kept only because it is unambiguous when it does appear.

    一番 alone stays excluded — 「一番近いのは」 is a legitimate way to point at
    the nearest entry — so only the evaluative compounds are listed.

    最適 is scoped to です／な so it cannot match 最適化, which is an ordinary
    engineering word this site might well use.
  */
  expressedPreference: new RegExp(
    [
      'お気に入り',
      'おすすめ(は|です|します)',
      '好きです',
      '好みです',
      '一番(良い|いい|好き)',
      '私は.*(が|を)(好き|愛用)',
      // The comparative: "X is better".
      'の方が(いい|良い|よい|おすすめ)',
      // Flat evaluations.
      '優れています',
      '最適(です|な)',
    ].join('|')
  ),
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
