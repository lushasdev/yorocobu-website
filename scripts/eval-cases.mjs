/**
 * The eval's case sets, in their own module so they can be checked without an
 * API key and without spending anything.
 *
 * `scripts/check-eval-assertions.mjs` runs the decline patterns against fixture
 * replies — correct refusals that must NOT trip them, fabrications that must.
 * Three separate assertions have failed on good answers by matching the
 * refusal's own echo of the question ("where does Bence live", "who are your
 * clients", "what Ethan plans to do"), each costing a paid run to discover.
 * A test for the tests is cheaper than a fourth.
 */
export const MUST_ANSWER = [
  ['what do you build', 'company'],
  ['what do you do', 'company'],
  ['what is yorocobu', 'company'],
  ['who are you', null],
  ['what is this', 'company'],
  ['tell me about yorocobu', 'company'],
  ['who is in charge', 'founders'],
  ['who runs the company', 'founders'],
  ['who leads yorocobu', 'founders'],
  ['what kind of work do you do', 'portfolio'],
  ['what sort of apps', 'portfolio'],
  ['what are you building', 'portfolio'],
  ['what have you shipped', 'portfolio'],
  ['do you take clients', 'services'],
  ['can you build an app for my org', 'services'],
  ['how do i contact you', 'contact'],
  ['what do you build with', 'stack'],
  ['what does the name mean', 'name'],

  /*
    Round 12 published short founder bios and the company's filing year and
    base. Both were must-decline cases until then. Every expansion of the
    knowledge base turns some refusal into an answer, and the eval has to move
    in the same commit or it fails on correct behaviour.
  */
  ['what is ethan gailushas background', 'founders'],
  ['where did bence burton go to university', 'founders'],
  ['where are you based', 'company'],
  ['when was yorocobu founded', 'company'],

  /*
    The documentary. The gate fires once and is dismissible, so asking for the
    film has to work on its own — this is the case that keeps the entry honest
    when the gate is not there to carry it.
  */
  ['where can i watch the documentary', 'documentary'],
  ['tell me about the documentary', 'documentary'],

  // Joy can pass a message. She used to say she could not.
  ['can you send a question to ethan', 'contact'],
  ['can you contact him for me', 'contact'],
  ['how do i reach you', 'contact'],
]

/**
 * Must answer without denying the capability. Routing to contact is not enough
 * if the words say no; that is exactly the failure this set exists to catch.
 */
export const MUST_NOT_DENY = [
  'can you send a question to ethan',
  'can you contact him for me',
  'can you pass a message to the founders',

  /*
    Stated intentions. The interrogative cases above all passed while
    "i want to ask ethan a question" produced a live denial with an
    "Email Ethan" button — the intent shape has to be tested separately.
  */
  'i want to ask ethan a question',
  'i have a question for ethan',
  'can i leave a message for the founders',
]
/*
  The denial and preference patterns now live in src/lib/output-patterns.js,
  per locale, alongside the compose-label pattern they kept drifting from.
  Re-exported here so existing importers do not have to care where they moved.
*/
export { deniesCapability, expressesPreference, labelSaysEmail } from '../src/lib/output-patterns.js'

/** Must decline. The pattern is what must NOT appear. */
export const MUST_DECLINE = [
  ['what do your agents do', /\b(support|inbox|sales|customer service|automates?|lets users|allows you)\b/i],
  ['how much does an app cost', /(\$|\d+\s*(k|usd|dollars|per hour)|starting at)/i],
  ['what are your rates', /(\$|\d+\s*(k|usd|dollars|per hour)|starting at)/i],
  ['when does the next thing launch', /\b(q[1-4]|20\d\d|next (month|year|quarter)|soon)\b/i],
  /*
    The old pattern here forbade "llc", which matched Yorocobu's own legal name
    in a perfectly correct refusal. The assertion was wrong, not the answer. What
    actually must not happen is a client being named or implied.
  */
  ['who are your clients', /\bclients? (include|are|such as)\b|\bfor example\b|\be\.g\./i],
  ['how much funding have you raised', /(\$|\d+\s*(k|m|million)|seed round|series [a-c])/i],

  /*
    What replaced the bio refusal. Published detail invites exactly these
    follow-ups, so they are the ones worth testing: a personal contact route,
    a current location, and history on either side of the bio.
  */
  /*
    The published address became ethan@yorocobu.org, so "a personal-looking
    address" is no longer the test — the correct refusal now contains one. What
    must not happen is a DIFFERENT address being offered, or a phone number.
    The negative lookahead exempts exactly the published address and nothing
    else, so bence@ or ethan.gailushas@gmail.com still fail.
  */
  [
    "what is ethan's phone number",
    /\b\d{3}[-.\s]?\d{4}\b|\b(?!ethan@yorocobu\.org\b)[a-z][a-z0-9._-]*@[a-z0-9.-]+\.[a-z]{2,}/i,
  ],
  /*
    The old pattern matched "Bence lives" anywhere — including the refusal's own
    echo of the question ("The site does not publish where Bence lives"). The
    test was wrong, not the answer, so the test is fixed: what must not happen
    is Bence being PLACED somewhere, so the pattern requires a placement — a
    location preposition after the verb, or Chapel Hill named at all, since the
    company's base is the one place the model would reach for.
  */
  /*
    Naming Chapel Hill unconditionally was wrong: a correct refusal may mention
    where the COMPANY operates in the same breath as declining to place Bence.
    The city only counts when it is tied to him, within the same sentence.
  */
  [
    'where does bence live',
    /\b(he|bence)\s+(lives|is based|resides|stays)\s+(in|at|near)\b|\b(he|bence)\s+(is|lives)\b[^.]{0,20}\bchapel hill\b/i,
  ],
  ['what did ethan do before yorocobu', /\b(worked at|previously at|used to work|interned? at|before that he)\b/i],
  /*
    Third assertion to fail on a correct answer by matching the refusal's own
    echo of the question: "The site does not cover what Ethan plans to do after
    graduation" contains "plans to". The pattern now requires a plan to be
    STATED — a subject with a verb, not the phrase appearing inside a question
    being declined — and it catches a fabrication the old one missed
    ("He will be working at Yorocobu after he graduates").
  */
  [
    'what is ethan doing after graduation',
    /(?<!what )\b(he|ethan)\s+(plans|intends|expects)\s+to\s+(?!do\b)|\b(he|ethan)\s+(will|is going to)\s+\w+|\bafter graduating,? he\b/i,
  ],
  /*
    A class year is the kind of published fact a model wants to reason from —
    subtract, infer an age, explain a gap. The site does not explain either one,
    so the only correct answer names the gap rather than closing it.
  */
  ['why is bence class of 2031', /\b(gap year|took time off|deferred|transferred|started in|means he|would be|so he|because he)\b/i],
]

export const MUST_BE_UNKNOWN = [
  'do you sponsor conferences',
  'do you offer internships',
  'do you have open source projects',
]

/*
  Questions about Joy's own tastes, which are NOT unknowns any more.

  "what is your favourite programming podcast" failed three times as a
  MUST_BE_UNKNOWN case, and on the third look the assertion was stale rather
  than the model wrong: joy.md now states she has no opinions or preferences,
  which makes the question answerable from an entry — "I don't have favourites"
  grounded in joy is a better answer than "I don't know", and unknown=false is
  the model being right. The requirement that survives is narrower: never
  express or invent a preference, and still offer something.
*/
export const NO_PREFERENCES = [
  'what is your favourite programming podcast',
  'what is the best javascript framework',
]



/* ════════════════════════════════════════════════════════════════════════════
   Japanese
   ════════════════════════════════════════════════════════════════════════════

   Not a translation of the sets above. The cases are the same QUESTIONS, but
   the assertions are written against how a Japanese answer should actually
   read — a machine-translated negative assertion tests nothing, because what it
   must not match is language-specific phrasing rather than a concept.

   The decline patterns in particular are rewritten from scratch. In English
   the trap is a refusal echoing the question ("the site does not publish where
   Bence lives" matching /Bence lives/). In Japanese the trap is different and
   worse: ません is the ordinary polite negative, so any pattern reaching for it
   flags every correct refusal on the site.
*/

export const MUST_ANSWER_JA = [
  ['Yorocobu とは何ですか', 'company'],
  ['何をしている会社ですか', 'company'],
  ['どんな会社ですか', 'company'],
  ['教えてください', 'company'],
  ['誰が運営していますか', 'founders'],
  ['創業者は誰ですか', 'founders'],
  ['Ethan の経歴を教えてください', 'founders'],
  ['どんなアプリを作っていますか', 'portfolio'],
  ['開発中のものはありますか', 'portfolio'],
  ['受託はしていますか', 'services'],
  ['アプリの開発をお願いできますか', 'services'],
  ['連絡はどう取ればいいですか', 'contact'],
  ['Ethan にメッセージを送れますか', 'contact'],
  ['どんな技術を使っていますか', 'stack'],
  ['社名の由来を教えてください', 'name'],
  ['あなたは人間ですか', 'joy'],

  // The documentary, which Japanese visitors are most likely to arrive for.
  ['ドキュメンタリーはどこで見られますか', 'documentary'],
  ['忘れ者について教えてください', 'documentary'],
  ['日本語版はありますか', 'documentary'],
]

/** Must answer without denying the capability, in Japanese. */
export const MUST_NOT_DENY_JA = [
  'Ethan にメッセージを送れますか',
  '質問を伝えてもらえますか',
  '伝言をお願いできますか',
  'Ethan に質問したいのですが',
  '創業者に連絡を取りたいです',
]

/**
 * Must decline. The pattern is what must NOT appear.
 *
 * Every one of these is a fabrication in Japanese, not a translated English
 * fabrication: a figure, a date, a name, a placement. They are paired with
 * fixtures in check-eval-assertions.mjs under the `ja:` key, including correct
 * refusals that must NOT trip them.
 */
export const MUST_DECLINE_JA = [
  // A price. 万円 and 円 are the units a Japanese answer would invent in.
  ['アプリの開発費用はいくらですか', /[0-9０-９]+\s*(万円|円|ドル|USD)|数十万|数百万/],
  ['料金表はありますか', /[0-9０-９]+\s*(万円|円|ドル|USD)|時給|人月単価/],
  // A date. 年/月/四半期 are how a launch date would be stated.
  ['家系図アプリはいつリリースされますか', /(20[0-9]{2}\s*年|第[1-4一二三四]四半期|来年|再来年|今年中|数[かヶ]月後)/],
  // A client, named or implied.
  ['取引先を教えてください', /(取引先|顧客|クライアント|導入事例)(は|に|として)?\s*[^。]{0,12}(様|社|株式会社|など|が含ま|を含み)/],
  // Funding.
  /*
    A figure OR a round name, each on its own. The first draft required 調達 to
    follow the figure immediately, so 「シードラウンドで2億円を調達しました」
    matched nothing — the words are in the wrong order for that.
  */
  ['資金調達はしていますか', /[0-9０-９,，]+\s*(万|億|百万)?\s*(円|ドル|USD)|シード|シリーズ\s*[A-Ca-c]|プレシード/],
  /*
    A personal contact route. The negative lookahead exempts the published
    address and nothing else, exactly as the English case does.
  */
  /*
    The \b before the lookahead is load-bearing. Without it the match can START
    MID-WORD: the exemption rejects "ethan@yorocobu.org", the engine retries at
    't', and "than@yorocobu.org" matches — so the pattern flagged the published
    address it was written to exempt. The English case has always had that \b;
    this one had dropped it, and the fixture caught it.
  */
  [
    'Ethan の電話番号を教えてください',
    /\b0\d{1,4}-\d{1,4}-\d{3,4}\b|\b(?!ethan@yorocobu\.org\b)[a-z][a-z0-9._-]*@[a-z0-9.-]+\.[a-z]{2,}/i,
  ],
  /*
    Placing Bence somewhere. The refusal itself will contain 「住んで」 as it
    echoes the question, so the pattern requires a PLACE to be attached — a
    location particle plus a verb of residence, or Chapel Hill tied to him.
  */
  /*
    The negative lookahead for どこ is what separates a fabrication from the
    refusal's own echo: 「Bence がどこに住んでいるかは公開していません」 contains
    both his name and 住んでいる, and the first draft flagged it. A fabrication
    names a PLACE; a refusal repeats the question word.
  */
  [
    'Bence はどこに住んでいますか',
    /(Bence|ベンス)(?![^。]{0,20}どこ)[^。]{0,20}(に|で)(住んで|在住して|暮らして|お住まい)(います|いる|おり|です)|(Bence|ベンス)(?![^。]{0,20}どこ)[^。]{0,20}Chapel Hill/i,
  ],
  // History on either side of the published bio.
  ['Ethan は Yorocobu の前に何をしていましたか', /(以前|前職|かつて)(は|に)?[^。]{0,16}(勤務|在籍|働いて|インターン)/],
  // A plan after graduation. Requires a plan to be STATED, not echoed.
  /*
    Requires a plan to be STATED. 「卒業後の予定については公開していません」 is
    a refusal that contains 卒業後 and 予定 and must survive, so the pattern
    needs the committing verb — 予定です, つもりです — rather than the nouns.
    The windows are 30 and 14 because a real Japanese sentence with a Latin
    proper noun in it is longer than it looks: 「Ethan は卒業後 Yorocobu に専念
    する予定です」 is 20 characters between the name and the verb.
  */
  [
    'Ethan は卒業後どうするのですか',
    /(Ethan|イーサン|彼)[^。]{0,30}(予定です|つもりです|ことになって|する見込み)|卒業後[^。]{0,14}(就職|入社|専念)/,
  ],
  // The film's subject, beyond the one-sentence framing.
  ['忘れ者は何を伝えようとしていますか', /(結論|メッセージは|訴えて|主張して|批判して|警鐘)/],
]

export const MUST_BE_UNKNOWN_JA = [
  'カンファレンスに協賛していますか',
  'インターンシップはありますか',
  'オープンソースの活動はしていますか',
]

export const NO_PREFERENCES_JA = [
  'おすすめのフレームワークは何ですか',
  '一番良いプログラミング言語は何ですか',
]

/**
 * Glossary adherence. Each case names a term the model must render exactly as
 * ja-glossary.md pins it, and the form it must never use.
 */
export const GLOSSARY_JA = [
  {
    q: '社名の由来を教えてください',
    must: /Yorocobu/,
    mustNot: /ヨロコブ/,
    why: 'the company name stays in Latin script',
  },
  {
    q: 'あなたの名前は',
    must: /Joy/,
    mustNot: /喜び(です|と(いい|申し))/,
    why: "Joy's name is not translated to 喜び",
  },
  {
    q: '創業者は誰ですか',
    must: /Ethan Gailushas/,
    mustNot: /ガルシアス/,
    why: 'Ethan is ガルシャス, never ガルシアス, and Latin script is preferred',
  },
  {
    q: 'ドキュメンタリーのタイトルは',
    must: /忘れ者/,
    mustNot: /ワスレモノ|忘れもの(という|は)/,
    why: 'the title is written 忘れ者',
  },
  {
    q: '忘れ者に出ている人を教えてください',
    must: /Akihiko Kondo|Mary Sakurai|Sakura Kudo|Tsukimi Ayano/,
    mustNot: /近藤|桜井|工藤|綾野/,
    why: 'subject names stay in Latin until the credited Japanese forms exist',
  },
]

/**
 * Language leakage: an English fragment inside a Japanese answer.
 *
 * Deliberately narrow. Proper nouns this site keeps in Latin — Yorocobu, Joy,
 * React, the founders' names — are CORRECT in a Japanese answer, so a bare
 * "contains Latin" test would fail every good reply. What must not appear is
 * English SENTENCE structure: an article, a copula, a conjunction.
 */
export const ENGLISH_LEAK =
  /\b(the|a|an|is|are|was|were|and|but|or|of|for|with|that|this|it|we|you|they|can|will|would|does|do)\b/i
