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

**The region under an answer surfaces only when it complements the answer.** Chip
navigation, refusals that route elsewhere, and unknowns raise the matching region;
a direct answer from an entry keeps it down, because the region would be the same
entry again at four times the length. The full index is where everything reads at
length.

**Chips never call the model, and Joy says nothing on them.** A chip is a site-map
link: the region below is the content, so clicking one renders the destination and
the answer slot collapses. A pointer line ("everything is just below") was tried
and removed — it only swapped duplication for filler, and a menu item does not
announce the page it opens. The query echo names what was clicked; the entry's own
controls still come along.

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

## Working note: fixing behaviour without causing its opposite

**Read this before writing a prompt line that begins "whenever" or "always."**

Three times in this project, a fix for one behavioural failure produced the
opposite failure, and each time the mechanism was the same: a broad instruction
doing the work of a narrow one.

| The failure | The fix | What the fix caused |
|---|---|---|
| Joy denied she could take a message | *"Whenever someone wants to reach Ethan or Bence, **ask them something**, or leave a message … offer the compose action"* | Every question is "asking her something", so the Send-to-Ethan button appeared under nearly every answer and the site read as a contact form |
| The region repeated the answer at length | Suppress the region when Joy answered from that entry | The chip path still called the model, so navigation produced an answer *and* a section — the same duplication on the one path where the region belongs |
| The chip duplicated its own section | Give the chip a one-line pointer instead of an answer | *"Everything the site publishes on this is just below"* — filler, a sentence whose only job was to point downward |
| The offer appeared under complete answers | Narrow the prompt to three enumerated cases | Nothing. 7 of 32 answers still carried a stray offer, and the failures were *inconsistent within one entry*: "who is in charge" clean, "who runs the company" not |
| The model called a published bio unknown | Two grounding instructions naming the founders entry | Nothing, twice. The case came back unknown on one pass and correct on the next, same fingerprint — so it moved to detection: if the deterministic matcher resolves the question to an entry while the model says unknown, the model is overruled |
| Same, fifth round | A strip in the function, sharing its key with the adder so "the two rules are one rule" | They colluded instead of checking each other. The adder fired, the stripper exempted exactly what the adder had created, and the log read `stripped_offers=0` on all 48 calls while stray offers shipped |

**The fourth round is the one that settles the argument.** Three instructions in a
row failed, and the eval showed why a fourth would too: the model was not applying
a rule imperfectly, it was deciding per request. Two phrasings of the same question
about the same entry came back differently in the same run. No wording fixes that,
so the function now strips a compose action from any answer that is not focused on
contact or services, is not flagged unknown, and does not read as a dead end — the
model suggests, the function decides. The prompt line stays as well, on the theory
that it costs nothing and may reduce how often the strip has to fire, and every
`joy: answered` line reports `stripped_offers=N` so "how often" is a measured
number rather than an assumption.

What generalises:

1. **Scope the instruction to the case, and enumerate the case.** "Offer the
   compose action whenever someone wants to reach Ethan" became three numbered
   situations plus an explicit *an answer that fully answers gets no action*.
   The negative half is what keeps the positive half from spreading.
2. **A fix that adds behaviour needs a test for the behaviour's absence.** The
   suite checked that the compose action was PRESENT where needed and never that
   it was ABSENT where it was not, so over-offering stayed green for rounds.
   Every "must do X here" assertion wants a "must not do X there" beside it.
3. **Prefer a structural guarantee to an instruction, but check what it keys
   on.** `guaranteeOffer` went through three keys: `unknown` (the model's own
   report, which fails exactly when the model is wrong), then empty
   actions+followups (fired on almost everything, because a complete answer
   frequently has neither), then the reply's own words. Deterministic is not the
   same as correct; a guarantee that fires too often is its own failure.
4. **When an interface expects speech, silence is an option.** Two of the four
   came from assuming Joy had to say something.
5. **Inconsistency within one entry is the tell.** If two phrasings of the same
   question behave differently in the same run, the model is guessing rather than
   applying a rule, and the fix belongs in the function rather than the prompt.
   Look for that signal before writing another instruction.
6. **Two enforcers sharing a key do not check each other, they collude.** The
   adder and the stripper keyed on the same regex, in the belief that one
   definition meant one rule. What it meant was that the stripper could never
   remove what the adder had just added — a closed loop that reported zero
   strips while the defect shipped. One decision function enforcing the rule in
   *both* directions has no such gap.
7. **A verification corpus cleaner than production proves nothing.** The nine
   hand-written shapes that "verified" the strip all had tidy replies. Real
   answers name a boundary in passing — "…and the site does not publish anything
   further" — and 4 of 6 realistic complete answers were misread as dead ends by
   a key tested against the whole reply. Testing the opening sentence only
   dropped that to 0 of 6. Build the corpus from what the model actually
   returns, not from what is easy to type.
8. **An assertion that quotes the question will match the refusal.** A refusal
   echoes what it is declining — "the site does not publish where Bence lives" —
   so a pattern looking for "Bence lives" calls a correct answer a fabrication.
   Four assertions have failed this way, three of them found by paid eval runs.
   `scripts/check-eval-assertions.mjs` now runs every decline pattern against
   fixture refusals it must accept and fabrications it must catch; it found the
   fourth on its first run, for free. Add a decline case, add its fixtures.
9. **Measure what the safety net catches.** A strip that quietly cleans up after
   the model forever is a maintenance cost nobody sees. Report the count in the
   same log line as everything else, so the day it starts firing on everything is
   the day you find out. A chip renders its destination
   and says nothing.

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
first-token latency with p50 and p95 as a floor for the browser budgets — it
deliberately does not suggest a budget, because an in-process "suggestion" was
once installed as the browser budget and cut the model off for every visitor.

`OPENAI_BASE_URL` points the whole thing at a different endpoint, which is how
the harness gets exercised without spending anything.

**The eval does not measure the browser path.** It imports the function and calls
it in-process, so its latency numbers exclude TLS, the function's cold start, and
the trip back to the browser — they are a floor, not a budget. The budgets in
`src/lib/joy.js` are spent on the *browser's* clock and are set from
`__joyTiming()` data, never from here.

### Seeing exactly what the model is sent

Never reason about which commit is where — print the input:

```bash
npm run knowledge
node scripts/print-model-input.mjs "i want to ask ethan a question"   # the full input, byte for byte
node scripts/print-model-input.mjs --fingerprint                       # e.g. 2026-08-18#72d77fa0
```

Every production request logs `knowledge=<fingerprint>` in the `joy: request`
line. If the log's fingerprint matches `--fingerprint` locally, production's
model context is byte-identical to what the script just printed. If it does not,
the deploys page names the commit production built from; borrow its knowledge and
print again:

```bash
git checkout <deploy-sha> -- knowledge && npm run knowledge
node scripts/print-model-input.mjs "the question"
git checkout HEAD -- knowledge && npm run knowledge
```

To check which knowledge a deploy *renders* (a coarser signal — mixed dates are
normal, entries update independently):

```bash
curl -sL https://yorocobu.org/full-index | grep -o "updated 2026-[0-9-]*" | sort | uniq -c
```

The `-L` matters: `/full-index` 301s to its canonical form, and without it curl
greps an empty redirect body and prints nothing.

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

### Run-to-run variance

The answer block runs twice, and any case that differs between passes is reported
UNSTABLE and counted as a failure — a visitor gets one pass, not the best of two.
At the same knowledge fingerprint and the same prompt, failures move: "who runs
the company" failed while "who is in charge" passed, then they swapped. A single
run cannot distinguish a fix from luck, and a green run is not evidence on its own.

### The two first-token budgets, and setting them from data

`src/lib/joy.js` carries two budgets: `FIRST_REQUEST_TIMEOUT` (8000ms) for a
session's first request, which pays TLS, the function's cold start, and the
model's first-token tail all at once, and `SETTLED_TIMEOUT` (5000ms) for every
request after. Set from measured browser sessions (first request 2959ms, warm
748–1650ms, desktop wifi) over the in-process model spread (warm p95 2462ms,
max 3940ms), with headroom for phones on cell data. Tighten them only with
`__joyTiming()` data from real sessions, ideally including mobile.

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

node scripts/check-navigator.mjs   # 69 cases: answer, decline, unknown, send-offer, reachability
node scripts/check-eval-assertions.mjs  # the eval's decline patterns, against fixture replies
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
