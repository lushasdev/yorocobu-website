/**
 * The offline navigator.
 *
 * A deterministic intent matcher over the knowledge base. It handles the common
 * questions with no API call, and it is the fallback the site degrades to when the
 * Netlify Function errors, rate limits, or is slow. The visitor never sees a dead
 * input.
 *
 * It returns the same shape the model is asked to return in phase 3, so both paths
 * feed one renderer:
 *
 *   { reply, focus_section, actions, followups, unknown, used_entries, source }
 *
 * The refusal guards below are hand-written mirrors of the do_not_claim fields in
 * /knowledge/. They run before any entry match, so a question about pricing is
 * declined even though it also mentions client work. When you add a do_not_claim
 * rule that this file should enforce offline, add a guard here too.
 */

// The import attribute keeps this module loadable by plain Node as well as by
// Vite, so the matcher can be exercised directly by scripts/check-navigator.mjs.
import knowledge from '../generated/knowledge-client.json' with { type: 'json' }

const entries = knowledge.entries
const byId = Object.fromEntries(entries.map((e) => [e.id, e]))

/*
  Contact happens inside the console. The email address is not offered here at
  all any more — it lives in plain text on the full index, for anyone who would
  rather use their own client.
*/
const composeAction = (label = 'Send a message', seed = '') => ({
  type: 'compose',
  label,
  value: seed,
})

const indexAction = { type: 'index', label: 'Open the full index', value: '/full-index' }

/*
  Curated multi-word intents, checked before anything else and winning outright.

  A phrase carries sense that individual words destroy. "in charge" is about
  leadership, not money; splitting it into tokens loses that and leaves "charge"
  sitting next to the pricing guard. Anything whose meaning lives in the word
  order belongs here rather than in an alias list.
*/
const PHRASES = [
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
    to: 'contact',
    patterns: [/\bget\s+in\s+touch\b/i, /\bcontact\s+you\b/i, /\breach\s+(you|out)\b/i],
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

function matchPhrase(query) {
  for (const { to, patterns } of PHRASES) {
    if (patterns.some((pattern) => pattern.test(query))) return to
  }
  return null
}

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
const GUARDS = [
  {
    id: 'company-metrics',
    strong:
      /\b(funding|funded|raised|valuation|revenue|profit|headcount|how many (people|employees|staff)|founding date|headquarters|when (was|were) .* founded|where are you (based|located))\b/i,
    weak: /\b(office|users|downloads|growth|investors|location)\b/i,
    corroborate: /\b(how many|number|figure|based|located|city|country|have|do you|is there|any)\b/i,
    reply:
      'None of that is public. The site does not publish funding, figures, headcount, founding date, or location. What it does say is what Yorocobu builds and who the two founders are.',
    focus: 'company',
    actions: [composeAction('Ask directly')],
    followups: ['what is yorocobu', 'who is behind this'],
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
    reply:
      'Yorocobu has not published pricing, and I am not going to invent a number. What I can tell you is that it does take on client work, and what a project costs is a conversation with Ethan and Bence.',
    focus: 'services',
    actions: [composeAction('Ask about a project')],
    followups: ['can you build an app for my org', 'what do you build with'],
    used: ['services'],
  },
  {
    id: 'timeline',
    strong:
      /\b(launch date|release date|ship date|timeline|eta|deadline|what quarter|which quarter|when (will|do|does|is|are)\b.*\b(launch|release|ship|out|ready|available|done|live)|how long (will|would|does) it take)\b/i,
    reply:
      'No launch dates are public. What the site does say is that five projects are in development, and Yorocobu is happy to hear from anyone who wants to know when that changes.',
    focus: 'portfolio',
    actions: [composeAction('Ask to be kept posted')],
    followups: ['what kind of apps do you make', 'who is behind this'],
    used: ['portfolio'],
  },
  {
    id: 'clients',
    strong:
      /\b(your clients|who are your clients|client names|case stud(y|ies)|testimonials?|references|previous clients|past clients)\b/i,
    weak: /\b(customers|worked with|past work)\b/i,
    corroborate: /\b(who|which|name|any|list|your|examples?)\b/i,
    reply:
      'Yorocobu does not publish client names or case studies, so I have nothing to point you to there. It does take on client work, and that conversation starts with an email.',
    focus: 'services',
    actions: [composeAction('Ask about client work')],
    followups: ['do you take clients', 'what do you build with'],
    used: ['services'],
  },
  {
    id: 'founder-bios',
    strong:
      /\b(bios?|biography|resume|cv|where did .* (study|work|go)|which (school|university|college)|degrees?|studied|how old|age of)\b/i,
    weak: /\b(background|experience|previously|before this|career)\b/i,
    // Only a person question, not a question about the company's experience.
    corroborate:
      /\b(ethan|bence|gailushas|burton|founders?|his|her|their|they|he|she|who)\b/i,
    reply:
      'The site lists Ethan Gailushas and Bence Burton as Co-Founders, and nothing further. No bios are published, so anything more is best asked of them directly.',
    focus: 'founders',
    actions: [composeAction('Ask them directly')],
    followups: ['what is yorocobu', 'how do i get in touch'],
    used: ['founders'],
  },
]

/** The first guard whose evidence bar is met, or null. */
function firedGuard(query) {
  for (const guard of GUARDS) {
    if (guard.strong?.test(query)) return guard
    if (guard.weak?.test(query) && guard.corroborate?.test(query)) return guard
  }
  return null
}

/** A question about what one of the five unnamed projects actually is. */
const PROJECT_DETAIL =
  /\b(what|which|how|tell me|describe|explain|details?|features?|does it|is it)\b/i

function matchProject(query) {
  const projects = byId.portfolio?.projects ?? []
  const q = query.toLowerCase()
  return projects.find((p) => {
    const words = p.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
    return q.includes(p.title.toLowerCase()) || words.every((w) => q.includes(w))
  })
}

/*
  Matching.

  The question-scaffolding words below are stripped before comparison, so what is
  left of a query is what it is actually about. "what do you build" reduces to
  {build}; "what do you build with" reduces to {build, with}. That one extra token
  is what separates the mission question from the technology question, which is
  why "with" is not treated as noise.

  A query that reduces to nothing at all — "who are you", "what do you do" — is
  question scaffolding and no subject, which is exactly how people ask what a
  company is. Those route to the overview rather than to a refusal.
*/
const SCAFFOLDING = new Set([
  'what', 'whats', 'is', 'are', 'was', 'be', 'do', 'does', 'did', 'you', 'your',
  'yours', 'the', 'a', 'an', 'me', 'my', 'about', 'tell', 'of', 'for', 'i', 'can',
  'could', 'would', 'how', 'who', 'and', 'to', 'it', 'this', 'that', 'these',
  'there', 'guys', 'folks', 'exactly', 'actually', 'really', 'please', 'hi',
  'hello', 'hey', 'so', 'ok', 'okay', 'on', 'at', 'in', 'up', 'yorocobus',
])

const normalize = (text) =>
  (text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

const subject = (text) => normalize(text).filter((w) => !SCAFFOLDING.has(w))

/**
 * Overlap of what a query is about with what a candidate phrase is about,
 * symmetric so that neither a short query nor a long alias is penalised for
 * simply being short or long.
 */
function overlap(queryWords, candidateWords) {
  if (queryWords.length === 0 || candidateWords.length === 0) return 0
  const candidate = new Set(candidateWords)
  const shared = queryWords.filter((w) => candidate.has(w)).length
  if (shared === 0) return 0
  const union = new Set([...queryWords, ...candidateWords]).size
  return shared / union
}

/**
 * Score an entry against a query. 10 for an exact alias, otherwise scaled
 * subject overlap against the best-matching alias.
 */
function scoreEntry(entry, query) {
  const queryWords = subject(query)
  const queryPhrase = normalize(query).join(' ')
  const candidates = [entry.title, entry.id.replace(/-/g, ' '), ...entry.aliases]

  let best = 0
  for (const candidate of candidates) {
    if (normalize(candidate).join(' ') === queryPhrase) return 10
    best = Math.max(best, overlap(queryWords, subject(candidate)))
  }
  return best * 10
}

/** Enough shared subject matter to be confident, roughly a third of the words. */
const MATCH_THRESHOLD = 3.3

const FOLLOWUPS_BY_ENTRY = {
  company: ['what does the name mean', 'what is in development'],
  name: ['what is yorocobu', 'who is behind this'],
  founders: ['what is yorocobu', 'how do i get in touch'],
  stack: ['can you build an app for my org', 'what is in development'],
  portfolio: ['can you build an app for my org', 'how do i get in touch'],
  services: ['what do you build with', 'how do i get in touch'],
  contact: ['can you build an app for my org', 'who is behind this'],
}

/** Entries whose summary alone would undersell what is genuinely published. */
const REPLY_OVERRIDE = {
  portfolio: () =>
    `Five projects are in development: ${projectTitles()}. Those are the categories ` +
    `Yorocobu publishes; the product names and descriptions are not public yet.`,
}

const projectTitles = () => {
  const titles = (byId.portfolio?.projects ?? []).map((p) => p.title)
  return `${titles.slice(0, -1).join(', ')}, and ${titles.at(-1)}`
}

function fromEntry(entry, reply) {
  return {
    reply: reply ?? REPLY_OVERRIDE[entry.id]?.() ?? entry.summary,
    focus_section: entry.id,
    actions: [
      // Contact and client-work answers lead into compose rather than out to a
      // mail client.
      ...(entry.id === 'contact' || entry.id === 'services'
        ? [composeAction('Send a message')]
        : []),
      ...entry.links
        .filter((link) => !link.url.startsWith('mailto:'))
        .map((link) => ({ type: 'link', label: link.label, value: link.url })),
    ],
    followups: FOLLOWUPS_BY_ENTRY[entry.id] ?? [],
    unknown: false,
    used_entries: [entry.id],
    source: 'local',
  }
}

/**
 * Resolve a visitor question against the knowledge base.
 * @param {string} query
 */
export function resolve(query) {
  const trimmed = (query ?? '').trim()

  // The landing state. An empty submission is someone asking "well, what is
  // this?", so it gets the overview rather than a shrug.
  if (!trimmed) return overview()

  // A curated phrase wins outright. It carries sense that tokens destroy.
  const phrase = matchPhrase(trimmed)
  if (phrase && byId[phrase]) return fromEntry(byId[phrase])

  // A project asked about by category, before anything else can guess at it.
  const project = matchProject(trimmed)
  if (project && PROJECT_DETAIL.test(trimmed)) {
    return {
      reply: `${project.title} is in development. The site publishes the category and nothing more, so I cannot tell you what it does without guessing, and I would rather not.`,
      focus_section: 'portfolio',
      actions: [composeAction('Ask about it')],
      followups: ['what is in development', 'can you build an app for my org'],
      unknown: false,
      used_entries: ['portfolio'],
      source: 'local',
    }
  }

  const guard = firedGuard(trimmed)
  if (guard) {
    return {
      reply: guard.reply,
      focus_section: guard.focus,
      actions: guard.actions,
      followups: guard.followups,
      unknown: false,
      used_entries: guard.used,
      // Which guard fired, not merely that one did. A refusal from the wrong
      // guard passes a pass/fail test while being visibly broken to a reader.
      guard: guard.id,
      source: 'local',
    }
  }

  // "what have you shipped" deserves a straight answer rather than a summary.
  if (/\b(shipped|released|launched|live|download|app store|try it|available)\b/i.test(trimmed)) {
    return {
      reply: `Nothing has shipped yet. Five projects are in development: ${projectTitles()}.`,
      focus_section: 'portfolio',
      actions: [composeAction('Ask to be kept posted')],
      followups: ['what do you build with', 'can you build an app for my org'],
      unknown: false,
      used_entries: ['portfolio'],
      source: 'local',
    }
  }

  const ranked = entries
    .map((entry) => ({ entry, score: scoreEntry(entry, trimmed) }))
    // Ties break toward the entry that reads first on the full index, which puts
    // the overview ahead of the more specific entries.
    .sort((a, b) => b.score - a.score || (a.entry.order ?? 99) - (b.entry.order ?? 99))

  if (ranked[0] && ranked[0].score >= MATCH_THRESHOLD) {
    return fromEntry(ranked[0].entry)
  }

  /*
    Nothing matched strongly. Before refusing, check whether this is a broad
    question about what Yorocobu is, because those are always answerable and
    refusing one is the worst failure this interface has. Unknown is for
    specifics the knowledge base genuinely lacks.
  */
  if (subject(trimmed).length === 0 || IDENTITY.test(trimmed)) return overview()

  /*
    Nothing matched well enough to answer, so offer the nearest things by name
    before giving up. A bare "I do not have that" on a site whose whole premise
    is an AI navigator is the worst thing this console can say.
  */
  const nearest = ranked
    .filter(({ score }) => score > 0)
    .slice(0, 2)
    .map(({ entry }) => entry)
  const offers = nearest.length ? nearest : [byId.company, byId.portfolio].filter(Boolean)

  return {
    reply:
      `I do not have that one. I can tell you about ${offers
        .map((entry) => OFFER_PHRASE[entry.id] ?? entry.title.toLowerCase())
        .join(' or ')}, or I can send your question to Ethan.`,
    focus_section: null,
    // Joy sends it, inside the console. The address is on the full index for
    // anyone who would rather use their own mail client.
    actions: [
      composeAction('Send the question', trimmed),
      indexAction,
    ],
    followups: offers.map((entry) => OFFER_QUERY[entry.id] ?? entry.title.toLowerCase()),
    unknown: true,
    used_entries: [],
    source: 'local',
  }
}

/** How each entry is described when it is offered as a next step. */
const OFFER_PHRASE = {
  company: 'what Yorocobu builds',
  name: 'where the name comes from',
  founders: 'who is behind it',
  stack: 'the technology it builds with',
  portfolio: 'the five projects in development',
  services: 'working together',
  contact: 'how to get in touch',
}

const OFFER_QUERY = {
  company: 'what do you build',
  name: 'what does the name mean',
  founders: 'who is behind this',
  stack: 'what do you build with',
  portfolio: 'what kind of apps do you make',
  services: 'do you take clients',
  contact: 'how do i get in touch',
}

/** Broad, identity-shaped questions that survive stripping the scaffolding. */
const IDENTITY =
  /\b(yorocobu|the company|this (site|company|place)|you (guys|all)|overview|introduce|what.*(company|business|startup|agency)|who.*(behind|runs|owns))\b/i

/** The company overview: the answer to "what is this". */
function overview() {
  return fromEntry(byId.company)
}

/*
  The site map: fixed destinations covering everything the site holds, generated
  from the `nav` label on each knowledge entry. Not rotating examples — with no
  menu, seeing what exists without having to ask for it is the one thing a
  visitor loses, and this is what gives it back.
*/
export const DESTINATIONS = knowledge.destinations ?? []
