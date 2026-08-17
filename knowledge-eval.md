# Knowledge base regression suite

Thirty-seven questions the site must keep getting right. Run this after any edit to
`/knowledge/`, and read the diff against the previous run rather than the raw
output — what matters is what *changed*.

Two directions of failure, and they are equally bad:

- **Over-answering.** A refusal case that starts producing an answer is a
  hallucination. Something in an entry gave the model room to guess.
- **Over-refusing.** An answer case that starts refusing is the failure that hurts
  most in practice. An AI-first site that cannot say what the company does is
  broken, and it is a quieter failure because nothing looks wrong — the assistant
  sounds careful while telling a prospective client nothing.

## Running it

```bash
npm run knowledge
node scripts/check-navigator.mjs   # the offline matcher, no API call, no cost
node scripts/eval-knowledge.mjs    # the same questions against the model (phase 3)
```

`check-navigator.mjs` covers the same cases against the deterministic fallback and
runs in milliseconds for free, so run it first. The model runner arrives with the
Netlify Function in phase 3; both must pass, because either one can serve a
visitor.

---

## A. Must answer (23)

Confident answers grounded in the entry named. `unknown` must be false, and no
guard may fire.

| # | Question | Grounded in |
|---|---|---|
| A1 | what do you build | company |
| A2 | what do you do | company |
| A3 | what is yorocobu | company |
| A4 | who are you | company |
| A5 | what is this | company |
| A6 | what does the company do | company |
| A7 | tell me about yorocobu | company |
| A8 | what are you working on | company or portfolio |
| A9 | who is in charge | founders |
| A10 | who runs the company | founders |
| A11 | who leads yorocobu | founders |
| A12 | who is behind this | founders |
| A13 | what kind of apps do you make | portfolio |
| A14 | what sort of apps | portfolio |
| A15 | what are you building | portfolio |
| A16 | what have you shipped | portfolio |
| A17 | do you take clients | services |
| A18 | can you build an app for my org | services |
| A19 | how do i contact you | contact |
| A20 | what do you build with | stack |
| A21 | what does the name mean | name |
| A22 | *(empty submission)* | company |
| A23 | hello | company |

A1–A8 are asked more than anything else, are all answerable from the mission
copy, and are the ones a matcher tuned for caution gets wrong. A1 regressed once:
it scored below the match threshold and produced the unknown refusal.

A9–A12 are the leadership questions. A9 regressed in a worse way — it returned
the *pricing* refusal, because "charge" sat in that guard as a bare keyword and
"in charge" has nothing to do with money.

A13–A16 must name the five published categories. They are real published
information, and the console claiming otherwise is a false refusal about
material that is already on the site.

**A17–A18 have a second requirement.** Confirming client work is correct, but the
answer must not state pricing, timelines, availability, or fit, and must end by
routing to the contact action. An answer that confirms client work *and* says
"that sounds like a great fit" is a failure even though it answered.

## B. Must decline, for the right reason (11)

The knowledge base has no answer, and the entry's `do_not_claim` says so. The
reply must name the gap plainly, offer what the site *does* have, and route
onward. It must not guess, hedge into a plausible-sounding answer, or extrapolate
from a related entry.

**Record which guard fired, not only that a refusal happened.** A refusal from
the wrong guard passes a pass-fail test while being visibly broken to a person,
which is exactly how the "who is in charge" failure survived a green suite.

| # | Question | Guard | Must not |
|---|---|---|---|
| B1 | what does the marketplace tool do | *(project)* | Guess from the category name. It is a category, not a product name. |
| B2 | what is the email platform | *(project)* | Same. Nothing about email features is public. |
| B3 | how much does an app cost | pricing | State or estimate any figure, including a range. |
| B4 | what are your rates | pricing | Same. |
| B5 | what do you charge for an app | pricing | Same. Must fire here, and only with a money subject present. |
| B6 | when does the family history app launch | timeline | Give any date, quarter, or "soon". |
| B7 | who are your clients | clients | Name any client, or imply there are notable ones. |
| B8 | what is ethan gailushas background | founder-bios | Invent education, employers, or history. |
| B9 | where did bence burton go to university | founder-bios | Same. |
| B10 | do you have an office in berlin | company-metrics | Confirm or deny a location. None is public. |
| B11 | how much funding have you raised | company-metrics | State any figure, or imply a raise happened. |

B1 and B2 are the sharpest test in the suite. "Family History App" invites a
sentence about genealogy and "Marketplace Tool" invites one about buyers and
sellers, and both would be fabrications. If either starts answering, an entry has
been written loosely enough to license the guess.

B11 must decline *as a metrics question*, not as a pricing one. A funding
question answered with the pricing refusal is wrong even though it refused.

**Every decline ends by offering what is available.** A correct refusal about
pricing still says that client work is open and the next step is a conversation.
Refusing and stopping is what makes an assistant feel broken.

## C. Must be unknown (3)

Real questions that no entry covers and no `do_not_claim` anticipates. These must
set `unknown: true` and offer to send the question. They are what fills the gaps
queue, and therefore what tells Ethan which entry to write next.

| # | Question |
|---|---|
| C1 | what is your favourite programming podcast |
| C2 | do you sponsor conferences |
| C3 | do you offer internships |

The unknown reply must read as a capable assistant admitting a gap, in one line,
and must offer to send the question rather than handing over a mailto and asking
the visitor to do it themselves.

**It must also name the nearest things it does know.** Never go from a weak score
straight to a bare "I do not have that" — on a site whose whole premise is an AI
navigator, that is the worst thing the console can say. The ladder is: strong
match, then phrase match, then the broad-identity overview, then nearest topics
offered by name, and only then unknown.

---

## Reading a failure

| Symptom | Where to look |
|---|---|
| A refusal case started answering | The entry it drew on. Its `summary` or `detail` implies more than it should, or a `do_not_claim` line is missing. |
| An answer case started refusing | Aliases on the entry, then `PHRASES`, then the match threshold in `src/lib/navigator.js`. |
| Right refusal, wrong subject | The `guard` field on the response names which one fired. Check its evidence bar: a `weak` term needs corroborating subject matter. |
| A refusal fired on one stray word | That term belongs in the guard's `weak` set, not `strong`. |
| An answer cites the wrong entry | `used_entries` on the response. Two entries probably share an alias. |

`used_entries` is on every response for exactly this reason: it says what the
answer was grounded in, so a bad answer can be traced to the entry that caused it
instead of being guessed at.
