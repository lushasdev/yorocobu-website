# yorocobu.org

The Yorocobu site. Navigation happens by asking an onboard navigator rather than
by using a nav bar, and the whole thing sits on top of a real, server-rendered
document so that crawlers, link previews, and anyone who would rather just read
are all first-class.

**Company:** yorocobu LLC · **Mark:** 喜 · **Contact:** yorocobu.llc@gmail.com

---

## Running it

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
npm run preview  # serve the built output
```

`dev` and `build` both run `npm run knowledge` first, which compiles `/knowledge/`
into `src/generated/`. That directory is generated, never committed.

Requires Node 22 or newer (Netlify is pinned to 22 in `netlify.toml`).

---

## Changing what the site says

**Everything the site knows lives in `/knowledge/`, one Markdown file per subject.**
Updating the site is a text edit and a deploy, not a code change. There is no model
training involved anywhere; this is the whole loop.

Each entry looks like this:

```yaml
---
id: services            # must match the filename
order: 6                # reading order on the full index
title: Client Work
aliases: [hire, work with us, can you build an app for my org]
status: open
summary: One or two sentences the navigator can quote back nearly verbatim.
links:
  - label: Email Yorocobu
    url: mailto:yorocobu.llc@gmail.com
do_not_claim:
  - Things that are NOT true and must never be implied.
last_updated: 2026-08-17
---

The fuller explanation, in Markdown. This becomes the body of the section on
the full index and the detail the navigator draws on.
```

### `do_not_claim` is the important field

Models fill gaps. Giving them explicit negative facts is the cheapest guard against
that, so **the build fails if any entry has an empty `do_not_claim`.** Write the
things that are not true, not public, or not decided:

> - No pricing, rates, or minimum project size are public. Never state or estimate any.
> - No launch dates are public for any project.

These fields never reach the browser. `build-knowledge.mjs` emits a trimmed
`knowledge-client.json` for the bundle with the guidance stripped out.

### What is generated from the entries

Nothing about the knowledge base is hardcoded anywhere else:

| Generated | From |
|---|---|
| The boot sequence status lines and their counts | every entry, plus `portfolio.projects` and `services.status` |
| The full index, its contents list and reading order | every entry, ordered by `order` |
| The content regions the navigator surfaces | every entry |
| The context passed to the model (phase 3) | `src/generated/knowledge-context.md` |

Add an entry and the boot line count goes up on its own. Change a project's status
and the boot line follows. There are no dates in the interface to go stale.

---

## How it fits together

```
knowledge/*.md                  what the site knows, hand-edited
  └── scripts/build-knowledge.mjs
        └── src/generated/      JSON for the site, trimmed JSON for the browser,
                                one concatenated document for the model

src/pages/index.astro           the navigator over server-rendered regions
src/pages/full-index.astro      the escape hatch: everything, typeset to read
src/components/BootSequence.astro   the calibration sequence
src/components/Console.jsx      the one React island on the site
src/lib/navigator.js            deterministic matcher, and the API fallback
```

Astro renders everything to static HTML. React is loaded for the console and
nothing else.

### The document underneath

The AI layer sits on top of a real document; it does not replace it.

- Every knowledge entry is server-rendered into `index.html` as a `<section>` with a
  proper heading, whether or not anyone asks a question.
- With JavaScript disabled, every region is visible and the console is not offered
  at all, rather than sitting there as a dead input.
- `/full-index` carries the same material laid out to read, reachable from the
  `◎ full index` control in the corner.

### Refusals

The navigator declines rather than guesses, and the refusals are the point, not a
shortfall. It will not state pricing, timelines, availability, client names, founder
biographies, or what any of the five in-development projects actually does — because
none of that is public. Each refusal says so in one line and offers the contact
action.

The refusal guards in `src/lib/navigator.js` mirror the `do_not_claim` fields.
**When you add a `do_not_claim` rule that should hold offline too, add a guard
there as well.**

---

## Checks

```bash
npm i -D playwright           # not a project dependency, to keep deploy builds lean
node scripts/check-ui.mjs     # against a running `npm run preview`
```

Covers the boot sequence contract (1.6s budget, skippable, once per session,
reduced-motion), keyboard operability, the live region, region surfacing, and the
refusal cases.

---

## Deployment

Netlify, from `netlify.toml`. Build `npm run build`, publish `dist`, Node 22.

Permanent redirects carry the previous site's routes forward:

| Old | New |
|---|---|
| `/tech-portfolio` | `/full-index#stack` |
| `/contact` | `/full-index#contact` |
| `/index` | `/full-index` |

`/images/yweb1.png` and `/images/yweb2.png` keep resolving; the favicon and the
Open Graph image both point at the former.

---

## Design

The concept is a precision instrument that is glad to see you. Yorocobu comes from
喜ぶ, *to be glad*, so the design is a machine calibrating itself on warm paper
rather than a terminal in a basement. No neon, no glow, no scanlines, no glitch.

| Token | Light | Role |
|---|---|---|
| `--paper` | `#F4F1EA` | base, the colour of washi |
| `--ink` | `#14110F` | text |
| `--shu` | `#E24A26` | accent, the vermilion of torii gates |
| `--dim` | `#8A8175` | metadata, timestamps, labels |
| `--rule` | `#DDD8CD` | hairlines and frames |

Dark mode swaps paper and ink and leaves the vermilion untouched. It follows
`prefers-color-scheme` with a manual override in the corner.

The accent appears in small quantities only: the caret, the registration marks, the
streaming hairline, link underlines, list bullets. Never a vermilion button the size
of a brick.

**Type is split by voice.** Instrument Serif for display and headings, Newsreader for
body copy, IBM Plex Mono for the machine voice — boot lines, metadata, the input,
the transcript. Serif is content, mono is the machine. That split should be visible
on every screen. IBM Plex Sans JP is loaded subset to the single glyph 喜.

**Content arrives by unmasking**, never by fading or sliding: `clip-path` wipes left
to right at 180ms on `cubic-bezier(0.2, 0, 0, 1)`. The registration marks and frame
persist for the whole session, so the page always reads as a sheet held in place by
a machine.

---

Copyright © 2026 yorocobu LLC.
