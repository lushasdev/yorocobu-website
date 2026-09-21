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
import { useTranslations, defaultLocale } from '../i18n/ui.ts'
import { patternsFor } from './navigator-patterns.js'

const entries = knowledge.entries
const byId = Object.fromEntries(entries.map((e) => [e.id, e]))

/*
  Contact happens inside the console. The email address is not offered here at
  all any more — it lives in plain text on the full index, for anyone who would
  rather use their own client.
*/
const composeAction = (label, seed = '') => ({ type: 'compose', label, value: seed })

const indexAction = (t) => ({ type: 'index', label: t('action.openIndex'), value: '/full-index' })

function matchPhrase(query, patterns) {
  for (const { to, patterns: set } of patterns.phrases) {
    if (set.some((pattern) => pattern.test(query))) return to
  }
  return null
}

/** The first guard whose evidence bar is met, or null. */
function firedGuard(query, patterns) {
  for (const guard of patterns.guards) {
    if (guard.strong?.test(query)) return guard
    if (guard.weak?.test(query) && guard.corroborate?.test(query)) return guard
  }
  return null
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
/*
  Normalisation keeps every script, and splits it the way the script is written.

  Two separate fixes live here. The first: this used to be
  .replace(/[^a-z0-9\s]/g, ' '), which deleted all Japanese and reduced every
  non-Latin query to the empty string. Punctuation is what we actually want
  gone, so punctuation is what is removed, leaving letters and marks in any
  script intact.

  The second: splitting on whitespace is an assumption about English. Japanese
  does not put spaces between words, so /\s+/ returns ONE token for a whole
  sentence and every comparison downstream runs against that single blob.
  Intl.Segmenter does the real work, and `isWordLike` drops the particles and
  punctuation that segmenting surfaces.

  English keeps the whitespace split rather than going through the segmenter.
  It is what the offline cases were tuned against, and there is nothing to gain
  from re-tokenising a language that already has spaces.
*/
const segmenters = new Map()

function segment(text, locale) {
  if (locale === defaultLocale) return text.split(/\s+/)
  if (!segmenters.has(locale)) {
    segmenters.set(locale, new Intl.Segmenter(locale, { granularity: 'word' }))
  }
  return [...segmenters.get(locale).segment(text)]
    .filter((piece) => piece.isWordLike)
    .map((piece) => piece.segment)
}

const normalize = (text, locale = defaultLocale) =>
  segment((text ?? '').toLowerCase().replace(/[\p{P}\p{S}]/gu, ' '), locale).filter(Boolean)

const subject = (text, scaffolding = new Set(), locale = defaultLocale) =>
  normalize(text, locale).filter((w) => !scaffolding.has(w))

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
export function scoreEntry(entry, query, scaffolding = new Set(), locale = defaultLocale) {
  const queryWords = subject(query, scaffolding, locale)
  const queryPhrase = normalize(query, locale).join(' ')

  /*
    An empty normalisation is the ABSENCE of a match, never an exact one.

    normalize() strips everything outside [a-z0-9\s], so a query in any
    non-Latin script reduces to the empty string — and so does an alias that is
    a single kanji. Those two empty strings then compared equal and returned 10,
    the exact-alias score. The effect was not "no match": it was every Japanese
    question answered, at maximum confidence, from whichever entry happened to
    carry such an alias. `喜` on the name entry is one, which is why every
    Japanese query resolved to About the Name.

    This is a live bug in English too — any alias that is punctuation or a
    symbol alone swallows every query that normalises to nothing, the same way.
    Adding the documentary's 忘れ者 alias would have made it a coin flip between
    two entries rather than a consistent wrong answer, which is how it surfaced.
  */
  if (!queryPhrase) return 0

  const candidates = [entry.title, entry.id.replace(/-/g, ' '), ...entry.aliases]

  let best = 0
  for (const candidate of candidates) {
    const candidatePhrase = normalize(candidate, locale).join(' ')
    if (!candidatePhrase) continue
    if (candidatePhrase === queryPhrase) return 10
    best = Math.max(best, overlap(queryWords, subject(candidate, scaffolding, locale)))
  }
  return best * 10
}

/** Enough shared subject matter to be confident, roughly a third of the words. */
const MATCH_THRESHOLD = 3.3

/* Dictionary keys, not text. The chip's words come from the active locale. */
const FOLLOWUPS_BY_ENTRY = {
  company: ['ask.name', 'ask.portfolio'],
  name: ['ask.company', 'ask.founders'],
  founders: ['ask.company', 'ask.contact'],
  stack: ['ask.buildForMyOrg', 'ask.portfolio'],
  portfolio: ['ask.buildForMyOrg', 'ask.contact'],
  services: ['ask.stack', 'ask.contact'],
  contact: ['ask.buildForMyOrg', 'ask.founders'],
  documentary: ['ask.documentary', 'ask.founders'],
  joy: ['ask.company', 'ask.contact'],
}

/** Entries whose summary alone would undersell what is genuinely published. */
/** Both bios in one line, so the offline answer is the published record too. */
const founderLine = () =>
  (byId.founders?.people ?? [])
    .map((p) => `${p.name}, ${p.title}. ${p.bio ?? ''}`.trim())
    .join(' ')

const REPLY_OVERRIDE = {
  /*
    The summary names the two of them; this adds what the site actually says
    about each. Without it the offline path answers "who runs it" with less than
    the page directly underneath it is showing.

    What We Build used to have an override here too, assembling a sentence around
    a list of project titles. The entry publishes two lines now and its summary
    is those two lines, so the summary is the answer and there is nothing to
    assemble.
  */
  founders: (t) => t('navigator.founders', { bios: founderLine() }),
}

function fromEntry(entry, t, reply) {
  return {
    reply: reply ?? REPLY_OVERRIDE[entry.id]?.(t) ?? entry.summary,
    focus_section: entry.id,
    actions: [
      // Contact and client-work answers lead into compose rather than out to a
      // mail client.
      ...(entry.id === 'contact' || entry.id === 'services'
        ? [composeAction(t('action.sendMessage'))]
        : []),
      ...entry.links
        .filter((link) => !link.url.startsWith('mailto:'))
        .map((link) => ({ type: 'link', label: link.label, value: link.url })),
    ],
    followups: (FOLLOWUPS_BY_ENTRY[entry.id] ?? []).map((key) => t(key)),
    unknown: false,
    used_entries: [entry.id],
    source: 'local',
  }
}

/**
 * Resolve a visitor question against the knowledge base.
 *
 * @param {string} query
 * @param {string} [locale]  must have a pattern set; unsupported locales THROW
 *
 * The locale is a hard fence, not a preference. patternsFor() throws for a
 * locale the matcher cannot reason about, and that is deliberate: the failure
 * being replaced is a confident wrong answer in a language nobody reviewing the
 * deploy can spot-check, which is strictly worse than a crash. A caller that
 * wants a Japanese answer has to wait until Japanese patterns exist and pass
 * their own eval suite, rather than getting a plausible-looking guess now.
 */
export function resolve(query, locale = defaultLocale) {
  const patterns = patternsFor(locale)
  const t = useTranslations(locale)
  const { scaffolding } = patterns
  const trimmed = (query ?? '').trim()

  // The landing state. An empty submission is someone asking "well, what is
  // this?", so it gets the overview rather than a shrug.
  if (!trimmed) return overview(t)

  // A curated phrase wins outright. It carries sense that tokens destroy.
  const phrase = matchPhrase(trimmed, patterns)
  if (phrase && byId[phrase]) return fromEntry(byId[phrase], t)

  const guard = firedGuard(trimmed, patterns)
  if (guard) {
    return {
      reply: t(guard.replyKey),
      focus_section: guard.focus,
      actions: guard.actionKeys.map((key) => composeAction(t(key))),
      followups: guard.followupKeys.map((key) => t(key)),
      unknown: false,
      used_entries: guard.used,
      // Which guard fired, not merely that one did. A refusal from the wrong
      // guard passes a pass/fail test while being visibly broken to a reader.
      guard: guard.id,
      pointer: true,
      source: 'local',
    }
  }

  /*
    "what have you shipped". After the guards, so a date question still reaches
    the timeline guard, and answered from What We Build rather than with a
    sentence of its own: the entry's two lines ARE the answer, and its
    do_not_claim is what keeps "shipped" from being conceded.
  */
  if (patterns.shipped.test(trimmed) && byId.portfolio) {
    return fromEntry(byId.portfolio, t)
  }

  const ranked = entries
    .map((entry) => ({ entry, score: scoreEntry(entry, trimmed, scaffolding, locale) }))
    // Ties break toward the entry that reads first on the full index, which puts
    // the overview ahead of the more specific entries.
    .sort((a, b) => b.score - a.score || (a.entry.order ?? 99) - (b.entry.order ?? 99))

  if (ranked[0] && ranked[0].score >= MATCH_THRESHOLD) {
    return fromEntry(ranked[0].entry, t)
  }

  /*
    Nothing matched strongly. Before refusing, check whether this is a broad
    question about what Yorocobu is, because those are always answerable and
    refusing one is the worst failure this interface has. Unknown is for
    specifics the knowledge base genuinely lacks.
  */
  if (subject(trimmed, scaffolding, locale).length === 0 || patterns.identity.test(trimmed)) {
    return overview(t)
  }

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
    reply: t('navigator.unknown', {
      offers: offers
        .map((entry) => t(OFFER_KEY[entry.id] ?? 'offer.company'))
        .join(t('navigator.offerSeparator')),
    }),
    focus_section: null,
    // Joy sends it, inside the console. The address is on the full index for
    // anyone who would rather use their own mail client.
    actions: [composeAction(t('action.sendTheQuestion'), trimmed), indexAction(t)],
    followups: offers.map((entry) => t(OFFER_QUERY_KEY[entry.id] ?? 'ask.company')),
    unknown: true,
    used_entries: [],
    source: 'local',
  }
}

/** How each entry is described when it is offered as a next step. */
const OFFER_KEY = {
  company: 'offer.company',
  name: 'offer.name',
  founders: 'offer.founders',
  stack: 'offer.stack',
  portfolio: 'offer.portfolio',
  services: 'offer.services',
  contact: 'offer.contact',
  documentary: 'offer.documentary',
  joy: 'offer.joy',
}

/** The same entries, phrased as a question a visitor would type. */
const OFFER_QUERY_KEY = {
  company: 'ask.company',
  name: 'ask.name',
  founders: 'ask.founders',
  stack: 'ask.stack',
  portfolio: 'ask.portfolio',
  services: 'ask.services',
  contact: 'ask.contact',
  documentary: 'ask.documentary',
  joy: 'ask.joy',
}

/** The company overview: the answer to "what is this". */
function overview(t) {
  return fromEntry(byId.company, t)
}

/*
  The site map: fixed destinations covering everything the site holds, generated
  from the `nav` label on each knowledge entry. Not rotating examples — with no
  menu, seeing what exists without having to ask for it is the one thing a
  visitor loses, and this is what gives it back.

  Only the `id` is used for matching now. The label is looked up per locale, so
  the six nav strings stopped being matcher input the moment they became
  translatable — a chip is a site-map link, and a link does not need its own
  display text parsed back out of it.
*/
export const DESTINATIONS = (knowledge.destinations ?? []).map(({ id }) => ({ id }))

/** A destination's label in the active locale. */
export function destinationLabel(id, locale = defaultLocale) {
  return useTranslations(locale)(`nav.${id}`)
}

/**
 * A chip, resolved by id rather than by matching its words.
 *
 * `DESTINATIONS.find((d) => d.query === trimmed)` compared display text, which
 * is exactly the coupling that breaks when display text can be in two
 * languages. An id is stable across both.
 */
export function resolveEntry(id, locale = defaultLocale) {
  const entry = byId[id]
  if (!entry) return null
  /*
    Deliberately does NOT go through patternsFor.

    Nothing here is matched or guessed: the caller already knows which entry it
    wants, and everything this returns that is language-dependent — the action
    labels, the followup chips — comes from the dictionary. So a chip works in a
    locale the MATCHER cannot handle, which is exactly the state Japanese is in
    until its pattern set and eval suite land. Making a link fail because free
    text would have failed would be locking a door that is not the one open.
  */
  return fromEntry(entry, useTranslations(locale))
}

/** Typing a chip's exact label, in whichever language it is displayed. */
export function destinationIdFor(text, locale = defaultLocale) {
  const wanted = String(text ?? '').trim().toLowerCase()
  if (!wanted) return null
  const t = useTranslations(locale)
  return (
    DESTINATIONS.find(({ id }) => t(`nav.${id}`).toLowerCase() === wanted)?.id ?? null
  )
}
