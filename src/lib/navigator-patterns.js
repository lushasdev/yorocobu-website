/**
 * The offline navigator's locale-bound vocabulary.
 *
 * Everything in here is language-specific: curated intent phrases, the refusal
 * guards' evidence patterns, the question-scaffolding stopwords, and the
 * identity test. They were inline in navigator.js and keyed on English, which
 * meant that in any other language they matched nothing, failed open, and let
 * the matcher answer confidently from whatever happened to score highest.
 *
 * So the pattern set is now explicit and per-locale, and a locale with no set
 * is an ERROR rather than a locale that quietly gets English behaviour or a
 * low-confidence guess. `patternsFor()` throws. That is the whole point: an
 * unsupported locale has to fail loudly at the call site, because the failure
 * it replaces was invisible.
 *
 * Japanese is deliberately absent until its patterns are written and its eval
 * suite passes. Until then the console answers Japanese visitors in English and
 * says so, which is honest, rather than guessing, which is not.
 *
 * Replies, action labels and followups are dictionary KEYS here, never strings.
 * The guard decides what to say; src/i18n/ui.ts decides how to say it.
 */

/*
  Curated multi-word intents, checked before anything else and winning outright.

  A phrase carries sense that individual words destroy. "in charge" is about
  leadership, not money; splitting it into tokens loses that and leaves "charge"
  sitting next to the pricing guard. Anything whose meaning lives in the word
  order belongs here rather than in an alias list.
*/
const EN_PHRASES = [
  {
    to: 'founders',
    patterns: [
      /\bin charge\b/i,
      /\bwho\s+(runs|leads|heads|owns|started|founded|built)\b/i,
      /\bwho\s+(is|are)\s+(behind|running|leading)\b/i,
      /\b(the )?leadership\b/i,
      /\bwho\s+(is|are)\s+(the\s+)?(founders?|team)\b/i,
    ],
  },
  {
    to: 'portfolio',
    patterns: [
      /\bwhat\s+(kinds?|sorts?|types?)\s+of\b/i,
      /\bwhat\s+(apps|projects|products)\b/i,
      /\bwhat\s+are\s+you\s+building\b/i,
      /\bwhat\s+areas\b/i,
      /\bin\s+development\b/i,
    ],
  },
  {
    to: 'services',
    patterns: [
      /\bdo\s+you\s+take\s+(on\s+)?clients?\b/i,
      /\bwork\s+(with|for)\s+(us|me|my)\b/i,
      /\bhire\s+you\b/i,
      /\bbuild\s+(me|us|an?\s+app\s+for)\b/i,
      /\bclient\s+work\b/i,
    ],
  },
  {
    /*
      Asking whether Joy can pass a message is a contact question, not a question
      about Joy. It routed nowhere before compose mode existed, and a bare
      "can you" reaching the guide entry produced the worst possible answer:
      no, followed by the send control appearing underneath.
    */
    to: 'contact',
    patterns: [
      /\bget\s+in\s+touch\b/i,
      /\bcontact\s+you\b/i,
      /\breach\s+(you|out)\b/i,
      /\b(send|pass|forward|relay|give|get)\b.*\b(message|question|note|word)\b/i,
      /\b(message|question|note)\b.*\bto\s+(ethan|bence|him|her|them|the founders?)\b/i,
      /\b(contact|reach|email|ask|tell)\s+(ethan|bence|him|her|them)\b/i,
      /\btake\s+a\s+message\b/i,
    ],
  },
  {
    to: 'stack',
    // Before the company phrases below, which would otherwise swallow it.
    patterns: [/\bbuild\s+with\b/i, /\bwhat\s+(tech|technolog)/i, /\btech\s+stack\b/i],
  },
  {
    to: 'name',
    patterns: [/\bname\s+mean\b/i, /\bmean\s+in\s+japanese\b/i, /\bwhy\s+yorocobu\b/i],
  },
  {
    to: 'company',
    patterns: [
      /\bwhat\s+do\s+you\s+(do|build|make)\b/i,
      /\bwhat\s+does\s+(the\s+company|yorocobu)\s+do\b/i,
      /\btell\s+me\s+about\b/i,
    ],
  },
]

/*
  Questions the site must decline.

  A refusal needs a higher bar than routing does, because a wrong refusal is
  worse than picking the wrong real entry: it tells the visitor the site knows
  nothing when it does. So `strong` terms fire on their own, while `weak` terms
  are ambiguous and need corroborating subject matter before they count.
  "Charge" on its own means nothing.

  Each reply names the gap and then offers what the site does have. Refusing and
  stopping is what makes an assistant feel broken.
*/
const EN_GUARDS = [
  /*
    Person questions come first. They are the more specific reading: "what is
    Ethan's phone number" is about Ethan, and answering it out of the company
    guard would refuse correctly while talking about funding and Wyoming.
  */
  {
    /*
      Short bios are published now, so this guard no longer refuses biography as
      a category — that would decline questions the site answers. It covers the
      edge instead: how to reach either of them personally, where they are, what
      they are doing outside Yorocobu or after it. Published detail invites
      exactly these follow-ups, and they are the ones worth holding.
    */
    id: 'founder-private',
    strong:
      /\b(phone|cell number|personal email|home address|where does .*\b(live|stay)|where (is|are) (he|she|they|ethan|bence)\b.*\b(now|right now|based|living|these days)|how old|age of|birthday|married|girlfriend|boyfriend|partner of|salary|net worth|after (he|she|they) graduates?|after graduation|graduation plans|before yorocobu|previous (job|employer)|worked at|other (compan|project|startup|business)|side (project|business)|dm|text (him|her|them))\b/i,
    weak: /\b(schedule|availability|free time|travel|reach (him|her|them)|contact (him|her|them)|meet (him|her|them)|where is he|where is she)\b/i,
    // Only a person question, not a question about the company's own schedule.
    corroborate:
      /\b(ethan|bence|gailushas|burton|founders?|his|her|their|they|he|she|who|him)\b/i,
    replyKey: 'guard.founderPrivate',
    focus: 'founders',
    actionKeys: ['action.sendQuestion'],
    followupKeys: ['ask.founders', 'ask.contact'],
    used: ['founders'],
  },
  {
    id: 'company-metrics',
    /*
      Where Yorocobu is and when it was filed are published now, so this guard
      no longer covers them. What stays out is money, size, and any address you
      could turn up at: the work is remote, and there is nothing to visit.
    */
    strong:
      /\b(funding|funded|raised|valuation|revenue|profit|headcount|how many (people|employees|staff)|street address|office address|mailing address|phone number)\b/i,
    weak: /\b(office|users|downloads|growth|investors|address|visit)\b/i,
    corroborate: /\b(how many|number|figure|have|do you|is there|any|where|your|drop by|come by)\b/i,
    replyKey: 'guard.companyMetrics',
    focus: 'company',
    actionKeys: ['action.askDirectly'],
    followupKeys: ['ask.company', 'ask.founders'],
    used: ['company'],
  },
  {
    id: 'pricing',
    strong:
      /\b(pricing|prices?|rates?|quote|retainer|hourly|per hour|minimum project|how much (do|does|would|is|are|will)|what (do|would) (it|you) cost)\b/i,
    weak: /\b(charge|charges|cost|costs|fees?|budget|expensive|cheap|afford|pay|payment)\b/i,
    // "Charge" only means money next to something being paid for.
    corroborate:
      /\b(money|dollars?|usd|price|pricing|rate|quote|budget|invoice|bill|how much|project|app|apps|build|work|hire|engagement|per|for a)\b/i,
    replyKey: 'guard.pricing',
    focus: 'services',
    actionKeys: ['action.askAboutProject'],
    followupKeys: ['ask.buildForMyOrg', 'ask.stack'],
    used: ['services'],
  },
  {
    id: 'timeline',
    strong:
      /\b(launch date|release date|ship date|timeline|eta|deadline|what quarter|which quarter|when (will|do|does|is|are)\b.*\b(launch|release|ship|out|ready|available|done|live)|how long (will|would|does) it take)\b/i,
    replyKey: 'guard.timeline',
    focus: 'portfolio',
    actionKeys: ['action.askToBeKeptPosted'],
    followupKeys: ['ask.portfolio', 'ask.founders'],
    used: ['portfolio'],
  },
  {
    id: 'clients',
    strong:
      /\b(your clients|who are your clients|client names|case stud(y|ies)|testimonials?|references|previous clients|past clients)\b/i,
    weak: /\b(customers|worked with|past work)\b/i,
    corroborate: /\b(who|which|name|any|list|your|examples?)\b/i,
    replyKey: 'guard.clients',
    focus: 'services',
    actionKeys: ['action.askAboutClientWork'],
    followupKeys: ['ask.services', 'ask.stack'],
    used: ['services'],
  },
]



/*
  The question-scaffolding words, stripped before comparison so that what is left
  of a query is what it is actually about. "what do you build" reduces to
  {build}; "what do you build with" reduces to {build, with}. That one extra
  token separates the mission question from the technology question, which is
  why "with" is not treated as noise.
*/
const EN_SCAFFOLDING = new Set([
  'what', 'whats', 'is', 'are', 'was', 'be', 'do', 'does', 'did', 'you', 'your',
  'yours', 'the', 'a', 'an', 'me', 'my', 'about', 'tell', 'of', 'for', 'i', 'can',
  'could', 'would', 'how', 'who', 'and', 'to', 'it', 'this', 'that', 'these',
  'there', 'guys', 'folks', 'exactly', 'actually', 'really', 'please', 'hi',
  'hello', 'hey', 'so', 'ok', 'okay', 'on', 'at', 'in', 'up', 'yorocobus',
])

/** Broad, identity-shaped questions that survive stripping the scaffolding. */
const EN_IDENTITY =
  /\b(yorocobu|the company|this (site|company|place)|you (guys|all)|overview|introduce|what.*(company|business|startup|agency)|who.*(behind|runs|owns))\b/i

/** A question about what one of the five unnamed projects actually is. */
const EN_PROJECT_DETAIL =
  /\b(what|which|how|tell me|describe|explain|details?|features?|does it|is it)\b/i

/** "what have you shipped" deserves a straight answer rather than a summary. */
const EN_SHIPPED = /\b(shipped|released|launched|live|download|app store|try it|available)\b/i

/*
  ─── Japanese ──────────────────────────────────────────────────────────────

  Written as its own set rather than translated from the English one, because
  the two languages fail differently. English needs the phrase list mainly to
  rescue word order ("in charge" is leadership, not money); Japanese needs it to
  do most of the work, because the knowledge base's aliases are English and a
  Japanese query shares no tokens with them. So the scoring path is effectively
  a fallback here, and these patterns are the matcher.

  That is deliberate and it is why the phrase list below is more generous than
  the English one. A Japanese question that reaches scoring lands in the unknown
  branch, which offers next steps and the message form — a fine outcome, but a
  worse one than an answer.

  Order matters: the first phrase that matches wins, so the specific entries sit
  above the general ones and `company` is last.
*/
const JA_PHRASES = [
  {
    // Before everything: 映画 and 作品 would otherwise be read as products.
    to: 'documentary',
    patterns: [
      /忘れ者|わすれもの/,
      /ドキュメンタリー/,
      /(映画|作品|映像)(は|を|が|に|って|について)?/,
      /どこで(見|観|視聴)/,
      /(見|観)(られ|れ)ます/,
    ],
  },
  {
    /*
      Asking whether Joy can pass a message is a contact question, not a
      question about Joy — the same trap the English set has, for the same
      reason: a bare 「できますか」 reaching the guide entry answers no and then
      renders the send control underneath it.
    */
    to: 'contact',
    patterns: [
      /(連絡|問い合わせ|問合せ)/,
      /(メッセージ|伝言|質問|メール)(を|が)?(送|届|渡|伝|預)/,
      // 「伝言をお願いできますか」 is a contact question, but お願い also
      // appears in the services list — and services would otherwise claim it,
      // because a phrase wins outright and contact has to get there first.
      /(メッセージ|伝言|質問)(を)?(お願い|頼)/,
      /*
        \s* matters: the name is Latin and the particle is Japanese, so a
        space between them is how anyone would actually type it.
        「Ethan に質問したいのですが」 missed entirely without it.
      */
      /(Ethan|イーサン|Bence|ベンス)\s*(に|へ|宛)/,
      /(相談|話)(し|が)?(たい|でき)/,
      /取り次/,
    ],
  },
  {
    to: 'founders',
    patterns: [
      /(誰|だれ)(が|の|に)?(運営|経営|作|創業|やって|率い|代表)/,
      /(創業者|共同創業|ファウンダー|代表者|経営者)/,
      /(運営|経営)(して|し)(いる|る)(の|ん)?(は|です)/,
      /(チーム|メンバー|体制)(は|について)/,
      /*
        Naming a founder is NOT a founders question on its own. 「ベンスさんは
        どこに住んでいますか」 mentions Bence and is a privacy question, and a
        phrase wins outright over a guard — so this has to ask about them
        rather than merely say their name, or it steals every question that
        happens to contain one.
      */
      /(Ethan|イーサン|Bence|ベンス)\s*(さん)?\s*(の)?\s*(経歴|背景|プロフィール|について教え|ってどんな人|とは誰)/,
    ],
  },
  {
    to: 'services',
    patterns: [
      /(受託|請負|外注)/,
      /(依頼|発注|お願い)(でき|し|は)/,
      /(作って|開発して|制作して)(もらえ|いただけ|くれ)/,
      /(一緒に|共同で)(仕事|開発)/,
      /(うち|当社|弊社|私たち)の(ため|アプリ|サービス)/,
    ],
  },
  {
    to: 'stack',
    // Before portfolio, which would otherwise swallow 「何で作って」.
    patterns: [
      /(技術|テクノロジー|スタック)/,
      /(言語|フレームワーク|ライブラリ)(は|を|が)/,
      /(何|なに)(で|を使って)(作|開発)/,
      /(React|Swift|Flutter|SwiftUI)/i,
    ],
  },
  {
    to: 'portfolio',
    patterns: [
      /(どんな|どういう|どのような)(アプリ|もの|プロジェクト|製品|サービス)/,
      /(開発中|制作中|進行中)/,
      /(何|なに)(を)?(作|開発|手がけ)/,
      /(プロジェクト|案件|プロダクト)(は|が|について)/,
      /(リリース|公開)(した|済み)/,
    ],
  },
  {
    to: 'name',
    patterns: [
      /(社名|名前|ネーミング)(の)?(由来|意味|理由)/,
      /(由来|意味)(は|を|って)/,
      /喜ぶ|喜び/,
      /(なぜ|どうして)\s*Yorocobu/i,
      /Yorocobu\s*(と|って)(は)?(どういう|どんな)?意味/i,
    ],
  },
  {
    to: 'joy',
    patterns: [
      /(あなた|君|Joy)(は)?(誰|だれ|何|なに|人間|AI|ロボット)/i,
      /(人間|人|ひと)(です|ですか|なの)/,
      /(何|なに)(が)?(でき|して)(ます|る)/,
      /(どうやって|どのように)(答え|調べ|知っ)/,
    ],
  },
  {
    to: 'company',
    patterns: [
      /(どんな|どういう|何をしている)会社/,
      /Yorocobu\s*(と|って)(は|いう)/i,
      /(会社|事業|ビジネス)(について|とは|の概要)/,
      /*
        Deliberately no bare 「教えてください」 here. It is an ordinary polite
        request attached to any question at all, and as a phrase it won
        outright over every guard — 「取引先の名前を教えてください」 came back
        as the company overview instead of the clients refusal.

        A query that is ONLY scaffolding still reaches the overview, because
        stripping the scaffolding leaves nothing and the empty-subject branch
        handles it. That path is the right one for this: it fires when there is
        no subject, rather than whenever the words appear.
      */
    ],
  },
]

/*
  The refusal guards.

  Japanese compound terms are far less ambiguous than the English single words
  these mirror — 料金 means price and nothing else, where "charge" needed a
  corroborating subject — so most of these are `strong` and fire on their own.
  Where a term is genuinely ambiguous it keeps the weak/corroborate structure.
*/
const JA_GUARDS = [
  {
    // Person questions first: the more specific reading of a question that
    // mentions a founder AND something private.
    id: 'founder-private',
    strong:
      /(電話番号|携帯番号|個人(の)?(連絡先|メール|アドレス)|自宅|住所を|どこに(住|在住)|何歳|年齢|誕生日|結婚|既婚|恋人|彼女|彼氏|給料|年収|資産|卒業後|卒業したら|進路|前職|以前(の)?(仕事|職場|会社)|副業|他の(会社|事業|プロジェクト))/,
    weak: /(予定|スケジュール|空いて|旅行|会える|会いたい|今どこ)/,
    corroborate:
      /(Ethan|イーサン|Bence|ベンス|創業者|彼|彼女|二人|お二人|さん)/,
    replyKey: 'guard.founderPrivate',
    focus: 'founders',
    actionKeys: ['action.sendQuestion'],
    followupKeys: ['ask.founders', 'ask.contact'],
    used: ['founders'],
  },
  {
    id: 'company-metrics',
    strong:
      /(資金調達|出資|投資家|調達(した|し|額)|評価額|売上|売り上げ|収益|利益|従業員数|社員数|何人(いる|の社員)|オフィス(の)?(住所|所在地)|本社(の)?住所|電話番号|郵送先)/,
    weak: /(オフィス|事務所|ユーザー数|利用者数|ダウンロード数|成長|規模|訪問)/,
    corroborate: /(何人|人数|数|いくつ|どのくらい|ありますか|教えて|行け|訪問|伺)/,
    replyKey: 'guard.companyMetrics',
    focus: 'company',
    actionKeys: ['action.askDirectly'],
    followupKeys: ['ask.company', 'ask.founders'],
    used: ['company'],
  },
  {
    id: 'pricing',
    strong:
      /(料金|価格|費用|見積|単価|時給|人日|人月|相場|お値段|値段|いくら(かかり|です|くらい)|コストは|予算は)/,
    weak: /(コスト|予算|安い|高い|払|支払)/,
    corroborate: /(アプリ|開発|案件|プロジェクト|依頼|仕事|どのくらい|いくら)/,
    replyKey: 'guard.pricing',
    focus: 'services',
    actionKeys: ['action.askAboutProject'],
    followupKeys: ['ask.buildForMyOrg', 'ask.stack'],
    used: ['services'],
  },
  {
    id: 'timeline',
    strong:
      /(いつ(リリース|公開|発売|完成|出ます|出る|使え)|リリース(日|時期|予定)|公開(日|時期|予定)|発売(日|時期)|納期|スケジュール(は|を)|どのくらい(かかり|時間))/,
    replyKey: 'guard.timeline',
    focus: 'portfolio',
    actionKeys: ['action.askToBeKeptPosted'],
    followupKeys: ['ask.portfolio', 'ask.founders'],
    used: ['portfolio'],
  },
  {
    id: 'clients',
    strong:
      /(取引先|顧客(名|は|の名前)|クライアント(名|は|一覧)|導入事例|事例(は|を|が)|実績(は|を|が)|お客様(は|の名前)|推薦|レビュー(は|が))/,
    weak: /(過去の(仕事|案件)|これまでの(仕事|実績))/,
    corroborate: /(誰|どこ|どの|名前|一覧|教えて|ありますか)/,
    replyKey: 'guard.clients',
    focus: 'services',
    actionKeys: ['action.askAboutClientWork'],
    followupKeys: ['ask.services', 'ask.stack'],
    used: ['services'],
  },
]

/*
  Question scaffolding, stripped before comparison.

  These are the tokens Intl.Segmenter ACTUALLY produces, not the words a
  dictionary would list. That distinction cost a round: this set was first
  written as 'ください', 'ですか', 'ます' and so on, and matched nothing,
  because the ICU build here has no full Japanese lexicon and segments
  「ください」 as くだ + さい and 「ですか」 as です + か. A scaffolding set
  written against the language rather than against the tokeniser silently does
  nothing at all.

  So it is derived: every entry below appears in the output of segmenting real
  scaffolding phrases. Fragments like くだ and さい look wrong in a word list
  and are exactly right in this one.

  A query that reduces to nothing — 「教えてください」, 「これは何ですか」 — is
  scaffolding with no subject, which is how people ask what a site is. Those
  route to the overview rather than to a refusal.
*/
const JA_SCAFFOLDING = new Set([
  // Particles and copula fragments.
  'は', 'が', 'を', 'に', 'へ', 'で', 'と', 'も', 'の', 'や', 'か', 'ね', 'よ',
  'です', 'ます', 'すか', 'でしょう', 'しょう', 'だけ', 'て', 'た', 'ら', 'り',
  'い', 'え', 'し', 'る', 'な', 'ん',
  // 「ください」 and friends, as the segmenter breaks them.
  'くだ', 'さい', 'いただ', 'もら', 'ほしい', 'たい', 'きた',
  'あり', 'ありま', 'ある', 'いる', 'する', 'して',
  // Demonstratives and interrogatives that carry no subject on their own.
  'これ', 'それ', 'あれ', 'この', 'その', 'あの', 'ここ', 'そこ',
  'どう', 'どの', 'どんな', 'どういう', 'いかが', 'なに', '何', 'なん', 'こと',
  // Openers and courtesies.
  '教え', '知', '聞', '説明', 'お願い', 'すみません', 'こんにちは',
  'はじめまして', 'ありがとう', 'どうも', 'よろしく',
])

/** Broad, identity-shaped questions that survive stripping the scaffolding. */
const JA_IDENTITY =
  /(yorocobu|会社|御社|貴社|ここ(は|って)|サイト(は|って|について)|概要|紹介)/i

/** A question about what one of the five unnamed projects actually is. */
const JA_PROJECT_DETAIL = /(どんな|どういう|何|なに|内容|詳し|説明|機能|できる)/

/** 「もう公開されていますか」 deserves a straight answer rather than a summary. */
const JA_SHIPPED =
  /(リリース(済|され|しました)|公開(済|され|しました)|ダウンロード|アプリストア|App\s*Store|使え(ます|る)|出て(います|る))/i

const PATTERNS = {
  en: {
    phrases: EN_PHRASES,
    guards: EN_GUARDS,
    scaffolding: EN_SCAFFOLDING,
    identity: EN_IDENTITY,
    projectDetail: EN_PROJECT_DETAIL,
    shipped: EN_SHIPPED,
  },
  ja: {
    phrases: JA_PHRASES,
    guards: JA_GUARDS,
    scaffolding: JA_SCAFFOLDING,
    identity: JA_IDENTITY,
    projectDetail: JA_PROJECT_DETAIL,
    shipped: JA_SHIPPED,
  },
}

/** Which locales the offline matcher can actually reason about. */
export const supportedLocales = Object.keys(PATTERNS)

/**
 * The pattern set for a locale, or a thrown error.
 *
 * Never a fallback to English and never a permissive default. A caller that
 * reaches here with an unsupported locale has a bug, and the bug it would
 * otherwise produce is a confident wrong answer in a language nobody on the
 * team can spot-check.
 */
export function patternsFor(locale) {
  const set = PATTERNS[locale]
  if (!set) {
    throw new Error(
      `navigator: no pattern set for locale "${locale}". The offline matcher ` +
        `cannot reason about this language, and guessing is worse than failing. ` +
        `Supported: ${supportedLocales.join(', ')}.`
    )
  }
  return set
}
