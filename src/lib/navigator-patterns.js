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

const PATTERNS = {
  en: {
    phrases: EN_PHRASES,
    guards: EN_GUARDS,
    scaffolding: EN_SCAFFOLDING,
    identity: EN_IDENTITY,
    projectDetail: EN_PROJECT_DETAIL,
    shipped: EN_SHIPPED,
  },
  // ja: added in Unit C, with its own eval suite. Absent is deliberate.
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
