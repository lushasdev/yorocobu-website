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

const EMAIL = 'yorocobu.llc@gmail.com'

const contactAction = (label = 'Send an email') => ({
  type: 'email',
  label,
  value: `mailto:${EMAIL}`,
})

const indexAction = { type: 'index', label: 'Open the full index', value: '/full-index' }

/**
 * Questions the site must decline. Each guard states the gap plainly in one line
 * and routes onward, rather than hedging into a plausible-sounding answer.
 */
const GUARDS = [
  {
    id: 'company-metrics',
    test: /\b(funding|funded|raised|raise|investors in|valuation|revenue|profit|users|downloads|headcount|how many (people|employees|staff)|when (was|were) .* founded|founding date|where are you (based|located)|office|headquarters)\b/i,
    reply:
      'None of that is public. The site does not publish funding, figures, headcount, founding date, or location.',
    focus: 'company',
    actions: [contactAction('Ask directly')],
    followups: ['what is yorocobu', 'who is behind this'],
    used: ['company'],
  },
  {
    id: 'pricing',
    test: /\b(pricing|price|prices|cost|costs|how much|rate|rates|quote|budget|fee|fees|charge|retainer|hourly|per hour|minimum project|expensive|cheap|afford)\b/i,
    reply:
      'Yorocobu has not published pricing, and I am not going to invent a number. What a project costs is a conversation with Ethan and Bence.',
    focus: 'services',
    actions: [contactAction('Ask about a project')],
    followups: ['can you build an app for my org', 'what do you build with'],
    used: ['services'],
  },
  {
    id: 'timeline',
    test: /\b(launch date|release date|ship date|when (will|do|does|is|are)\b.*\b(launch|release|ship|out|ready|available|done|live)|timeline|how long (will|would|does) it take|eta|deadline|what quarter|which quarter)\b/i,
    reply:
      'No launch dates are public. The five projects are in development, and that is as specific as the site gets.',
    focus: 'portfolio',
    actions: [contactAction('Ask to be kept posted')],
    followups: ['what is in development', 'who is behind this'],
    used: ['portfolio'],
  },
  {
    id: 'clients',
    test: /\b(your clients|who are your clients|client names|customers|case stud(y|ies)|testimonial|references|past work|previous clients|worked with)\b/i,
    reply:
      'Yorocobu does not publish client names or case studies, so I have nothing to point you to there.',
    focus: 'services',
    actions: [contactAction('Ask about client work')],
    followups: ['can you build an app for my org', 'what do you build with'],
    used: ['services'],
  },
  {
    id: 'founder-bios',
    test: /\b(bio|bios|biography|background|resume|cv|where did .* (study|work|go)|which (school|university|college)|degree|studied|previous(ly)? (work|job|company)|how old|age of)\b/i,
    reply:
      'The site lists Ethan Gailushas and Bence Burton as Co-Founders, and nothing further. No bios are published.',
    focus: 'founders',
    actions: [contactAction('Ask them directly')],
    followups: ['what is yorocobu', 'how do i get in touch'],
    used: ['founders'],
  },
]

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

function fromEntry(entry, reply) {
  return {
    reply: reply ?? entry.summary,
    focus_section: entry.id,
    actions: entry.links.map((link) =>
      link.url.startsWith('mailto:')
        ? { type: 'email', label: link.label, value: link.url }
        : { type: 'link', label: link.label, value: link.url }
    ),
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

  // A project asked about by category, before anything else can guess at it.
  const project = matchProject(trimmed)
  if (project && PROJECT_DETAIL.test(trimmed)) {
    return {
      reply: `${project.title} is in development. The site publishes the category and nothing more, so I cannot tell you what it does without guessing, and I would rather not.`,
      focus_section: 'portfolio',
      actions: [contactAction('Ask about it')],
      followups: ['what is in development', 'can you build an app for my org'],
      unknown: false,
      used_entries: ['portfolio'],
      source: 'local',
    }
  }

  for (const guard of GUARDS) {
    if (guard.test.test(trimmed)) {
      return {
        reply: guard.reply,
        focus_section: guard.focus,
        actions: guard.actions,
        followups: guard.followups,
        unknown: false,
        used_entries: guard.used,
        source: 'local',
      }
    }
  }

  // "what have you shipped" deserves a straight answer rather than a summary.
  if (/\b(shipped|released|launched|live|download|app store|try it|available)\b/i.test(trimmed)) {
    return {
      reply:
        'Nothing has shipped yet. Five projects are in development: Email Platform, Family History App, Mobile Tool, Scheduling Program for Institutions, and Marketplace Tool.',
      focus_section: 'portfolio',
      actions: [contactAction('Ask to be kept posted')],
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

  return {
    reply: 'I do not have that one. Want me to send the question to Ethan?',
    focus_section: null,
    // The assistant sends it. The mailto stays available for anyone who would
    // rather use their own mail client, but it is no longer the primary action.
    actions: [
      { type: 'ask', label: 'Send the question', value: trimmed },
      contactAction('Or email directly'),
      indexAction,
    ],
    followups: ['what is yorocobu', 'what is in development', 'do you take clients'],
    unknown: true,
    used_entries: [],
    source: 'local',
  }
}

/** Broad, identity-shaped questions that survive stripping the scaffolding. */
const IDENTITY =
  /\b(yorocobu|the company|this (site|company|place)|you (guys|all)|overview|introduce|what.*(company|business|startup|agency)|who.*(behind|runs|owns))\b/i

/** The company overview: the answer to "what is this". */
function overview() {
  return fromEntry(byId.company)
}

/** Suggested prompts, rotated per visit so the input is never blank. */
export const SUGGESTIONS = [
  'what is yorocobu',
  'can you build an app for my org',
  'who is behind this',
  'what is in development',
  'what do you build with',
  'what does the name mean',
  'how do i get in touch',
  'what have you shipped',
]

export function pickSuggestions(count = 4) {
  const pool = [...SUGGESTIONS]
  const picked = []
  while (picked.length < count && pool.length) {
    picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1))
  }
  return picked
}
