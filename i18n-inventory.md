# i18n inventory

Every literal string a visitor can see, with its file and line, at commit
`claude/friendly-einstein-elqs9l`. This is the translation surface for Phase 2.

Line numbers are from the tree as audited. Anything marked **operator** is seen
by Ethan, not by a visitor, and does not need Japanese. Anything marked
**model-facing** is prompt text sent to the API, not rendered — it needs Japanese
handling in Phase 3, but not a dictionary key.

Counts: **214 visitor-visible strings** across 12 source files, plus 8 knowledge
entries whose prose is rendered wholesale into the page.

---

## 1. `src/components/Console.jsx` — the console itself

| Line | String | Notes |
|---|---|---|
| 6 | `ask Joy for anything on this site` | `PLACEHOLDER`, the input hint before engagement |
| 148 | `that did not go through` | fallback when `/api/ask` returns no error body |
| 168 | `Sent.` | compose confirmation, email sent |
| 168 | `Recorded.` | compose confirmation, email not configured |
| 171 | `Ethan will reply to the address you gave.` | |
| 172 | `No address in there, so this one is a note for Ethan rather than a reply to you.` | |
| 174 | `It is in the queue Ethan reads, and he will reply to the address you gave.` | |
| 175 | `It is in the queue Ethan reads. There is no address in it, so treat it as a note rather than a conversation.` | |
| 179 | `close` | chip |
| 191 | `htmlFor="compose-answer"` label text comes from `prompt` | see §3 |
| 208 | `One moment` | submit button, thinking state |
| 208 | `Next` | submit button, asking state |
| 212 | `never mind` | chip |
| 221 | `Your message, edit anything` | draft textarea label |
| 238 | `Sending` | send button, in flight |
| 238 | `Send it` | send button |
| 242 | `never mind` | chip (second instance) |
| 262 | `. The address is on the full index if you would rather write directly.` | appended to the error from `/api/ask` |
| 431 | `what is yorocobu` | default query label for an empty submission; **appears in the rail** |
| 564 | `Your questions` | `aria-label` on the transcript rail |
| 594 | `answering from the offline index — navigator not configured` | degraded notice, config failure |
| 595 | `answering from the offline index` | degraded notice, transient failure |
| 658 | `Ask about Yorocobu` | visually-hidden label for `#console-input` |
| 678 | `JOY // NAVIGATOR // ready` | intro status line |
| 679 | `This is the future of websites.` | intro claim |
| 680 | `No menus. No hunting. Just a guide.` | intro proof |
| 681 | `This is Joy. She can help you find anything here.` | intro body |
| 696 | `navigator unreachable — {n} answers from the local index` | persistent degraded banner, interpolated count |
| 699 | `ask another` | hint once engaged |
| 723 | `Ask` | visually-hidden submit button |
| 734 | `Everything on this site` | `aria-label` on the chip nav |

Not visitor-facing: the `console.error` at 496–500 (**operator**).

## 2. `src/lib/joy.js` — client transport

| Line | String | Notes |
|---|---|---|
| 242 | `Open the full index` | default label when the model omits one on an `index` action |
| 242 | `Send a message` | default label when the model omits one on a `compose` action |

**Operator** only: 54, 63–68 (`__joyTiming` console output), 202–204, 207–211
(fallback diagnostics).

## 3. `src/lib/compose-fallback.js` — compose without the model

| Line | String | Notes |
|---|---|---|
| 11 | `Who am I passing this to Ethan from?` | `COMPOSE_QUESTIONS[0].ask` — also the label fallback at Console.jsx:101 and :192 |
| 12 | `And what are you working on?` | |
| 13 | `Where should he reply?` | |
| 37 | `Happy to pass a message along.` | first turn |
| 37 | `Got it.` | subsequent turns |
| 50 | `I'm {who}` | draft assembly — **sentence-structural, not a label** |
| 53 | `You can reach me at {reply}` | draft assembly — **sentence-structural** |
| 60 | `Here is what I have. Edit anything, then send it.` | |

Line 19's `/[.!?]$/` and line 18's `toUpperCase()` are English-sentence
formatting applied to visitor text. Both are wrong for Japanese and are logic,
not strings — flagged for Phase 2.

## 4. `src/lib/navigator.js` — the deterministic offline fallback

This is the largest single block of visitor-visible English, and the easiest to
miss because it only renders when the API is unreachable.

**Action labels**

| Line | String |
|---|---|
| 32 | `Send a message` (default `composeAction` label) |
| 38 | `Open the full index` (`indexAction`) |
| 159 | `Send a question` |
| 177 | `Ask directly` |
| 192 | `Ask about a project` |
| 203 | `Ask to be kept posted` |
| 216 | `Ask about client work` |
| 350 | `Send a message` |
| 384 | `Ask about it` |
| 416 | `Ask to be kept posted` |
| 462 | `Send the question` |

**Guard refusal replies** (full prose, rendered as the answer)

| Line | Guard | String |
|---|---|---|
| 157 | `founder-private` | `The site publishes short bios for Ethan Gailushas and Bence Burton and stops there. Nothing about where either of them is, how to reach them personally, or what they are doing outside Yorocobu is public. I can pass a question along instead.` |
| 175 | `company-metrics` | `That part is not public. The site does not publish funding, revenue, user numbers, or headcount beyond the two founders, and there is no office to visit — the work is remote. What it does say is that Yorocobu was filed in Wyoming in 2025, operates from Chapel Hill, and what it is building.` |
| 190 | `pricing` | `Yorocobu has not published pricing, and I am not going to invent a number. What I can tell you is that it does take on client work, and what a project costs is a conversation with Ethan and Bence.` |
| 201 | `timeline` | `No launch dates are public. What the site does say is that five projects are in development, and Yorocobu is happy to hear from anyone who wants to know when that changes.` |
| 214 | `clients` | `Yorocobu does not publish client names or case studies, so I have nothing to point you to there. It does take on client work, and that conversation starts with an email.` |

**Other generated replies**

| Line | String |
|---|---|
| 331 | `Yorocobu was founded by two Co-Founders. {bios}` |
| 332–334 | `Five projects are in development: {titles}. Those are the categories Yorocobu publishes; the product names and descriptions are not public yet.` |
| 339 | `, ` and ` and ` — the list joiner in `projectTitles()` |
| 382 | `{title} is in development. The site publishes the category and nothing more, so I cannot tell you what it does without guessing, and I would rather not.` |
| 414 | `Nothing has shipped yet. Five projects are in development: {titles}.` |
| 455–457 | `I do not have that one. I can tell you about {a} or {b}, or I can send your question to Ethan.` |

**Followup chips** — `FOLLOWUPS_BY_ENTRY`, lines 309–315, 14 strings:
`what does the name mean`, `what is in development`, `what is yorocobu`,
`who is behind this`, `how do i get in touch`, `can you build an app for my org`,
`what do you build with`, `what kind of apps do you make`, `do you take clients`.
Plus per-guard followups at 160, 178, 193, 204, 217, 385, 417 (14 more, drawn
from the same vocabulary).

**Offer vocabulary** — `OFFER_PHRASE` 474–480 (7 strings: `what Yorocobu builds`,
`where the name comes from`, `who is behind it`, `the technology it builds with`,
`the five projects in development`, `working together`, `how to get in touch`)
and `OFFER_QUERY` 484–490 (7 strings, the same entries as typed questions).

**Not strings, but locale-bound logic** — see §3 of the Phase 0 report:
`PHRASES` 48–114, `GUARDS` regexes 135–220, `PROJECT_DETAIL` 232,
`SCAFFOLDING` 257–263, `normalize()` 265, `IDENTITY` 494, the shipped-check at
412, and `matchProject()` 235–242.

## 5. `src/components/BootSequence.astro` — the calibration sequence

| Line | String | Notes |
|---|---|---|
| 57 | `Yorocobu` | the title line; brand, stays Latin |
| 60–65 | `{line.label}` / `{line.value}` | from `knowledge.bootLines`, generated in `scripts/build-knowledge.mjs:101–135` |
| 69 | `Press any key to skip` | |

The six generated boot lines, as they currently render:

| Label | Value | Generated at |
|---|---|---|
| `knowledge base` | `indexed` | build-knowledge.mjs:108 |
| `portfolio` | `5 in development` | build-knowledge.mjs:118, `{count} {status}` |
| `client work` | `open` | build-knowledge.mjs:122, from `services.status` |
| `stack` | `17 technologies` | build-knowledge.mjs:126 |
| `founders` | `2` | build-knowledge.mjs:130 |
| `navigator` | `online` | build-knowledge.mjs:133 |

`portfolio`, `client work` and `stack` interpolate a count and a status word from
the knowledge front matter, so translating them means translating the status
vocabulary (`in development`, `open`, `active`, `online`) and moving the counter
words, not just the labels.

## 6. `src/layouts/Base.astro`

| Line | String | Notes |
|---|---|---|
| 17 | `lang="en"` | hardcoded — Phase 6 |
| 22–23 | `{title}` / `{description}` | from props |
| 27 | `Yorocobu` | `og:site_name`; brand, stays Latin |
| 28–35 | title/description repeated into og and twitter | |
| 76 | `Skip to content` | skip link |

No `hreflang`, no `og:locale`, no `og:locale:alternate` — Phase 6.

## 7. `src/pages/index.astro`

| Line | String |
|---|---|
| 12 | `Yorocobu — apps for underserved markets` (`<title>`) |
| 13 | `Yorocobu LLC finds holes in niche markets and builds apps to fill them. Five projects in development, built with React, Swift, and Flutter. Ask the navigator, or read the full index.` (meta description) |
| 19 | `Yorocobu — apps for underserved markets` (visually-hidden `<h1>`) |
| 25 | `full index` (escape-hatch link) |

## 8. `src/pages/full-index.astro`

| Line | String |
|---|---|
| 19 | `Full index — Yorocobu` (`<title>`) |
| 20 | `Everything Yorocobu publishes, on one page: the mission, the name, the founders, the technology, the five projects in development, client work, and how to get in touch.` (meta description) |
| 24 | `Yorocobu  //  full index  //  {generated}` |
| 26 | `Everything on this site` (+ the 喜 glyph, which stays) |
| 29–31 | `The navigator on the home page answers from exactly these {n} entries and nothing else. This is the same material, laid out to read.` |
| 33 | `Contents` (`aria-label`) |
| 58 | `updated {last_updated}` |
| 69–71 | `Joy can send a message from any page. If you would rather write directly, the address is ethan@yorocobu.org.` |
| 74 | `back to the navigator` |

Plus, per entry: `{entry.status}` (line 54), `{entry.title}` (60),
`{entry.detailHtml}` (62) — all from `/knowledge/`.

## 9. `src/components/Regions.astro`

| Line | String |
|---|---|
| 22 | `{entry.status}` |
| 26 | `updated {entry.last_updated}` |
| 28 | `{entry.title}` |
| 30 | `{entry.detailHtml}` |

## 10. `src/components/ThemeToggle.astro`

| Line | String |
|---|---|
| 10 | `Switch between light and dark` (visually-hidden) |
| 11 | `light` (initial label) |
| 64 | `label.textContent = theme` → renders `light` / `dark` |

## 11. `src/components/Founders.astro`

| Line | String |
|---|---|
| 31 | `alt={name}` — the founder's name as alt text |
| 34–36 | `{name}`, `{title}`, `{bio}` — all from `knowledge/founders.md` |

Names are the Phase 3b glossary case: **イーサン・ガルシャス** and Bence Burton's
katakana must be pinned, never improvised.

## 12. `netlify/functions/joy.mjs` — visitor-visible output from the server

**Labels the server writes into the result** (these reach the rendered page):

| Line | String |
|---|---|
| 234 | `Send it to Ethan from here` — `fixComposeLabels()` replacement |
| 336 | `Send the question to Ethan` — `decideOffer()` added action |
| 337 | followups fall back to `knowledge.destinations[].query` (the six chip labels) |

**Error bodies.** These are returned as JSON; `src/lib/joy.js:184` swallows them
into the offline fallback, so today they are **operator**-visible in the console
warning only. They become visitor-visible the moment anything surfaces them:

| Line | String |
|---|---|
| 440 | `method not allowed` |
| 448 | `navigator not configured` |
| 457 | `expected json` |
| 471 | `question is required` |
| 476 | `a few too many just now. Try again a little later.` |
| 507 | `navigator unreachable` |
| 529 | `model "{MODEL}" is not available to this key` |
| 629 | `stream failed` |

**Model-facing** (Phase 3a, not dictionary keys): `VOICE` 115–145, `GROUNDING`
147–184, `COMPOSE_PROMPT` 188–209, schema descriptions 58–94, the forced-draft
system message 385–387, and the compiled `context` 34–49.

## 13. `netlify/functions/ask.mjs`

**Visitor-visible** — these render inside `Compose` at Console.jsx:262:

| Line | String |
|---|---|
| 93 | `question is required` |
| 94 | `question is too long` |
| 96 | `that email address does not look right` |
| 100 | `a few too many just now. Try again a little later.` |
| 76 | `method not allowed` |
| 82 | `expected json` |

**Operator** (the notification email to Ethan): 57 `Question from the site: …`,
61 `Reply to: …` / `No reply address given.`, 62 `Reference: …`.

## 14. `netlify/functions/_shared/quality.mjs`

All **operator**: the alert email bodies at 52–65 and the subject at 74.

## 15. `/knowledge/*.md` — the content itself

Eight entries. Per Phase 3b these stay canonical in English; what is listed here
is the surface that gets *rendered* (and therefore read by a visitor on the full
index and in the surfaced regions), as distinct from the surface sent to the
model.

| Entry | `title` | `nav` label | Rendered fields |
|---|---|---|---|
| `company.md` | Yorocobu | *(none)* | title, summary, status, detail body |
| `name.md` | About the Name | `the name` | + detail body with 喜ぶ etymology |
| `founders.md` | Founders | `who runs it` | + `people[].name`, `.title`, `.bio` |
| `services.md` | Client Work | `working together` | title, summary, status, detail |
| `stack.md` | Technology | `the tech` | title, summary, status, detail |
| `portfolio.md` | Work in Development | `what we build` | + `projects[].title`, `.status` |
| `contact.md` | Contact | `get in touch` | title, summary, status, detail |
| `joy.md` | Joy | *(none)* | title, summary, status, detail |

The six `nav` labels are the chip labels *and* the chip queries — they are both
display text and matcher input, which is why they cannot simply be translated in
place (Console.jsx:434 does an exact-string comparison against `query`).

`status` values render verbatim on every region header and in the boot sequence:
`active`, `open`, `online`, and `in development` on projects.

`aliases` on every entry are English matcher vocabulary, not display text, but
they are the offline navigator's entire recall surface in Japanese — see the
Phase 0 report, §3.

## 16. `public/robots.txt`

Line 4: `Sitemap: https://yorocobu.org/sitemap-index.xml`. Not translated;
noted because Phase 6 requires the sitemap to cover both trees.

## 17. Not translated, deliberately

- `src/styles/console.css:332` — `content: '▸ '`, a decorative bullet.
- `src/components/Frame.astro` — registration marks, `aria-hidden`.
- `src/components/Logo.astro` — the wordmark SVG. Brand, stays Latin.
- `src/components/BootSequence.astro:52` — the 喜 glyph.
- `src/pages/full-index.astro:26` — the 喜 glyph in the heading.
