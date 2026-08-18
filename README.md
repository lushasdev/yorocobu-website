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
shortfall. It will not state pricing, timelines, availability, client names, funding
or revenue figures, anything personal about either founder beyond the published bios,
or what any of the five in-development projects actually does — because none of that
is public. Each refusal says so in one line and offers to pass the question along.

**What is public moves, and the guards have to move with it.** Publishing founder
bios turned "what is Ethan's background" from a refusal into an answer, and the
guard it used to hit was renamed and rewritten to cover the edge the bios invite
instead. Whenever an entry gains material, check `scripts/check-navigator.mjs` and
`knowledge-eval.md` in the same commit: a decline case that has quietly become an
answer case either fails on correct behaviour or stops testing anything.

The refusal guards in `src/lib/navigator.js` mirror the `do_not_claim` fields.
**When you add a `do_not_claim` rule that should hold offline too, add a guard
there as well.**

---

## Running the model eval

```bash
npm run knowledge                                  # required first, see below
OPENAI_API_KEY=sk-... node scripts/eval-knowledge.mjs
```

**`npm run knowledge` has to run first.** `src/generated/` is not committed, and
the eval imports the Netlify function, which imports the compiled knowledge base.
Without it the run fails before reaching the model.

The eval costs real money, so it is not wired into `npm run check`. It reports
first-token latency with p50 and p95 and suggests a `FIRST_TOKEN_TIMEOUT` for
`src/lib/joy.js`, read back against the value currently set there.

`OPENAI_BASE_URL` points the whole thing at a different endpoint, which is how
the harness gets exercised without spending anything.

**The eval does not measure the browser path.** It imports the function and calls
it in-process, so its latency numbers exclude TLS, the function's cold start, and
the trip back to the browser — they are a floor, not a budget. `FIRST_TOKEN_TIMEOUT`
in `src/lib/joy.js` is spent on the *browser's* clock, so leave headroom over what
the eval reports.

### When the console says "answering from the offline index"

Every failure renders that one line, so start from the logs rather than the screen.
`joy` logs `joy: request …` the moment a request arrives and one `joy: … in Nms`
line when it leaves, whatever happened. No `joy: request` line for an answer you
just asked for means the request never reached the function at all — check the
path, not the key. The browser console carries the other half: the HTTP status
`/api/joy` returned, or the timeout it hit.

**One fallback is a footnote; two in a row is a fault.** A single slow request gets
the quiet line under the answer. From the second consecutive fallback the status bar
carries a persistent `navigator unreachable` marker and the browser console raises
an error. This exists because the opposite failed in practice: the offline index
answered well enough that a completely dead model path read as a working site for
several rounds, and the one quiet line was easy to read past.

### Setting `FIRST_TOKEN_TIMEOUT` from data

Every request records its browser-side first-token time. In DevTools:

```js
__joyTiming()
// joy timing over 4 request(s): first request 3027ms, rest p50 6013ms / p95 6013ms,
//   overall min 3027ms max 6013ms, 2 fell back
```

The request index is part of each sample deliberately. If request 1 is slow and the
rest are quick, that is a cold start, and the answer is a longer budget for the first
request rather than a blanket raise. The function's own contribution to a cold start
is about 30ms — 9ms of module init plus ~18ms on the first invocation — so anything
larger is the platform's container start or the model's own latency, not this code.

---

## The gaps queue

When the navigator cannot answer, it offers to send the question, and then it
sends it — an inline field in the console, not a mailto handed back to the
visitor. `netlify/functions/ask.mjs` (`POST /api/ask`) writes every submission to
the `questions` Netlify Blobs store.

**The gaps log and the visitor questions are the same data**, so there is one
store, not two. A question with no reply address is still recorded: the gap is
worth knowing about even when there is nobody to answer.

Every entry that store accumulates is an entry worth writing. That is the whole
training loop — there is no model training anywhere in this project.

### What is and is not recorded

Recorded: the question, an optional reply address, a timestamp, and whether it has
been answered. **Not recorded: IP addresses, user agents, or anything else that
identifies the person asking.** Rate limiting has to recognise a repeat caller, so
it keys on a salted daily hash of the address which is stored in a separate
`rate-limits` store, never alongside a question, and cannot be reversed.

Abuse controls: a honeypot field (a filled trap returns the same `200` a real
submission does, so a bot learns nothing from the difference), 5 submissions per
caller per hour, a 2000 character cap, and email validation.

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `RESEND_API_KEY` | no | Email notification on each question. Without it, submissions are still recorded and the weekly digest still carries them. |
| `GAPS_EMAIL_TO` | no | Where notifications go. |
| `GAPS_EMAIL_FROM` | no | Defaults to Resend's onboarding sender. |
| `RATE_LIMIT_SALT` | recommended | Any random string. Salts the rate-limit hash. |
| `OPENAI_API_KEY` | phase 3 | Never in the repo, never in the client bundle. |

---

## Checks

```bash
npm run check                      # navigator, contrast, secrets and CSP drift

node scripts/check-navigator.mjs   # 53 cases: answer, decline, unknown, reachability
node scripts/check-contrast.mjs    # WCAG contrast over the palette tokens
node scripts/check-secrets.mjs     # key material in the built output (needs a build)
node scripts/build-csp.mjs --check # netlify.toml CSP against the built inline scripts

npm i -D playwright                # not a project dependency, to keep deploy builds lean
node scripts/check-ui.mjs          # against a running `npm run preview`
```

`check-navigator.mjs` is the one to run after any edit to `/knowledge/`. It mirrors
`knowledge-eval.md` and costs nothing, because it exercises the offline matcher
rather than the model. **It tests both edges**: over-refusing is as much a defect
as over-answering, so the broad identity questions are checked as hard as the
refusals.

`check-ui.mjs` covers the boot sequence contract (1.6s budget, skippable, once per
session, reduced motion), keyboard operability, the live region, and region
surfacing.

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
喜ぶ, *to be glad*, so the design is a machine calibrating itself on a sheet of
paper rather than a terminal in a basement. No neon, no glow, no scanlines, no
glitch.

**Two accents, and they never swap jobs.** Plum is interactive — links, buttons,
the caret, active states, focus. Gold is atmosphere — hairlines, the calibration
marks, the mark itself. If it is clickable it is plum; if it is structure or light
it is gold. Roughly 82% neutral, 12% plum, 6% gold.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `--n-50` | `#171114` | warm paper |
| `--text-primary` | `--n-900` | `#f6ede6` | ink, a faint plum cast |
| `--text-secondary` | `--n-600` | `#c4b6bc` | metadata, labels, the machine voice |
| `--primary` | `--plum-500` | `--plum-400` | 紅梅 kobai plum, everything interactive |
| `--warm` | `--gold-400` | `--gold-300` | 山吹 yamabuki gold, rules and marks |
| `--border` | `--n-200` | `#322a31` | hairlines and frames |
| `--surface-invert` | `--plum-800` | `--plum-900` | the band the 喜 sits on |

Dark mode is not an inversion: it is a second set of values, because a single one
cannot clear WCAG AA against both grounds. It follows `prefers-color-scheme` with a
manual override in the corner.

**Gold is never text.** At `--gold-400` it measures about 1.9:1 on paper. Where gold
has to carry type it uses `--warm-text`; the one exception is gold at display size on
`--surface-invert`, which measures about 8:1, and the boot sequence's 喜 is the single
place that earns it. `--text-muted` exists as a brand token and is not a text colour
here at all — `check-contrast.mjs` **fails** if it is ever applied to a text property.

**Changing the palette is one edit.** Every colour resolves to a token and every
hex appears exactly once in `src/styles/global.css`: brand scales at the top,
semantic tokens mapped onto them below, dark values redefined in both the
`[data-theme='dark']` block and the `prefers-color-scheme` one. Nothing else in the
codebase carries a colour.

`node scripts/check-contrast.mjs` parses the tokens out of the stylesheet, resolves
each `var()` chain to a real hex, and measures every pairing against its threshold.
Run it after any palette edit; it is part of `npm run check`.

Both accents appear in small quantities only: the caret, the registration marks, the
streaming hairline, link underlines, list bullets, the focus rule. No fills, no
gradients, and never a plum button the size of a brick.

**Type is split by voice.** Instrument Serif for display and headings, Instrument
Sans for body copy, JetBrains Mono for the machine voice — boot lines, metadata, the
input, the transcript. Serif is content, mono is the machine. That split should be
visible on every screen. Zen Old Mincho is subset to the single glyph 喜, which takes
it from 1.8MB to 1.1KB. All four are self-hosted through Astro's font pipeline with
metric-compatible fallbacks, so nothing shifts when the files land.

**Content arrives by unmasking**, never by fading or sliding: `clip-path` wipes left
to right at 180ms on `cubic-bezier(0.2, 0, 0, 1)`. The registration marks and frame
persist for the whole session, so the page always reads as a sheet held in place by
a machine.

---

Copyright © 2026 yorocobu LLC.
