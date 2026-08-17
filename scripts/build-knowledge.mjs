#!/usr/bin/env node
/**
 * Compiles /knowledge/*.md into build artifacts.
 *
 *   src/generated/knowledge.json        structured entries, imported by the site
 *                                       and (in phase 3) by the Netlify function
 *   src/generated/knowledge-client.json trimmed copy for the browser bundle. The
 *                                       do_not_claim guidance is internal and is
 *                                       deliberately withheld from the client.
 *   src/generated/knowledge-context.md  the whole knowledge base concatenated into
 *                                       one document, passed to the model as context
 *
 * Nothing downstream hardcodes counts or statuses: every number the site displays,
 * including the boot sequence status lines, is derived here.
 *
 * Run via `npm run knowledge`, and automatically before `dev` and `build`.
 */

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import { marked } from 'marked'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const KNOWLEDGE_DIR = join(root, 'knowledge')
const OUT_DIR = join(root, 'src', 'generated')

const REQUIRED = ['id', 'title', 'summary', 'status', 'last_updated']

function fail(message) {
  console.error(`\n  knowledge: ${message}\n`)
  process.exit(1)
}

function readEntries() {
  const files = readdirSync(KNOWLEDGE_DIR)
    .filter((f) => f.endsWith('.md') && f !== 'README.md')
    .sort()

  if (files.length === 0) fail(`no entries found in ${KNOWLEDGE_DIR}`)

  const parsed = files.map((file) => {
    const raw = readFileSync(join(KNOWLEDGE_DIR, file), 'utf8')
    const { data, content } = matter(raw)

    for (const key of REQUIRED) {
      if (!data[key]) fail(`${file} is missing required field "${key}"`)
    }

    const expectedId = basename(file, '.md')
    if (data.id !== expectedId) {
      fail(`${file} declares id "${data.id}" but should be "${expectedId}"`)
    }

    const doNotClaim = toArray(data.do_not_claim)
    if (doNotClaim.length === 0) {
      fail(
        `${file} has no do_not_claim entries. Negative facts are the primary ` +
          `hallucination guard; every entry needs at least one.`
      )
    }

    // last_updated may parse as a Date via YAML; normalise back to YYYY-MM-DD.
    const lastUpdated =
      data.last_updated instanceof Date
        ? data.last_updated.toISOString().slice(0, 10)
        : String(data.last_updated)

    return {
      ...data,
      id: data.id,
      title: data.title,
      aliases: toArray(data.aliases),
      status: data.status,
      kind: data.kind ?? 'about',
      summary: data.summary.trim(),
      links: toArray(data.links),
      do_not_claim: doNotClaim,
      last_updated: lastUpdated,
      detail: content.trim(),
      // Rendered once here so both the home page regions and the full index can
      // set it directly, and no markdown parser ships to the browser.
      detailHtml: marked.parse(content.trim(), { async: false }),
    }
  })

  // `order` sets reading order on the full index and in the model's context.
  return parsed.sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
}

function toArray(value) {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Boot sequence status lines, derived entirely from the entries above so they
 * cannot go stale. Lines that describe an absent entry are simply omitted.
 */
function buildBootLines(entries) {
  const byId = Object.fromEntries(entries.map((e) => [e.id, e]))

  // Deliberately not a count. A raw entry total is a number about the site's
  // plumbing rather than about Yorocobu, and it invites the visitor to wonder
  // what the missing entries would have been. Every other line below is a real
  // derived figure that reads as information.
  const lines = [{ label: 'knowledge base', value: 'indexed' }]

  const portfolio = byId.portfolio
  if (portfolio) {
    const projects = toArray(portfolio.projects)
    const counts = projects.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1
      return acc
    }, {})
    for (const [status, count] of Object.entries(counts)) {
      lines.push({ label: 'portfolio', value: `${count} ${status}` })
    }
  }

  if (byId.services) lines.push({ label: 'client work', value: byId.services.status })
  if (byId.stack) {
    const primary = toArray(byId.stack.primary).length
    const additional = toArray(byId.stack.additional).length
    lines.push({ label: 'stack', value: `${primary + additional} technologies` })
  }
  if (byId.founders) {
    const count = toArray(byId.founders.people).length
    if (count) lines.push({ label: 'founders', value: String(count) })
  }

  lines.push({ label: 'navigator', value: 'online' })
  return lines
}

/** The single document handed to the model as grounding context. */
function buildContext(entries) {
  const header = [
    '# Yorocobu knowledge base',
    '',
    'This document is the complete and only source of truth about Yorocobu.',
    `It contains ${entries.length} entries and was generated on ${today()}.`,
    '',
    '---',
    '',
  ].join('\n')

  const body = entries
    .map((e) => {
      const parts = [
        `## ${e.title}`,
        '',
        `- id: ${e.id}`,
        `- status: ${e.status}`,
        e.aliases.length ? `- also asked about as: ${e.aliases.join(', ')}` : null,
        `- last updated: ${e.last_updated}`,
        '',
        `**Summary.** ${e.summary}`,
        '',
        e.detail,
        '',
        e.links.length
          ? `**Links.** ${e.links.map((l) => `${l.label} — ${l.url}`).join(' · ')}`
          : '**Links.** None. Do not invent one.',
        '',
        '**Never claim (these are false or not public):**',
        ...e.do_not_claim.map((d) => `- ${d}`),
      ].filter((p) => p !== null)
      return parts.join('\n')
    })
    .join('\n\n---\n\n')

  return `${header}${body}\n`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

const entries = readEntries()
const bootLines = buildBootLines(entries)
const context = buildContext(entries)

// What the browser needs to run the offline navigator: enough to match a question
// and quote an answer, and nothing more. do_not_claim and detail stay server-side.
const clientEntries = entries.map((e) => ({
  id: e.id,
  title: e.title,
  aliases: e.aliases,
  status: e.status,
  kind: e.kind,
  summary: e.summary,
  links: e.links,
  ...(e.projects ? { projects: e.projects } : {}),
}))

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(
  join(OUT_DIR, 'knowledge.json'),
  `${JSON.stringify({ entries, bootLines, generated: today() }, null, 2)}\n`
)
writeFileSync(
  join(OUT_DIR, 'knowledge-client.json'),
  `${JSON.stringify({ entries: clientEntries }, null, 2)}\n`
)
writeFileSync(join(OUT_DIR, 'knowledge-context.md'), context)

// Rough token estimate: ~4 characters per token. The brief's guidance is to send
// the whole base as context and revisit only past ~30k tokens.
const estimatedTokens = Math.round(context.length / 4)
console.log(
  `  knowledge: ${entries.length} entries -> src/generated/ ` +
    `(context ~${estimatedTokens.toLocaleString()} tokens)`
)
if (estimatedTokens > 30000) {
  console.warn(
    `  knowledge: context exceeds 30k tokens. Time to revisit the ` +
      `send-everything approach described in the brief.`
  )
}
