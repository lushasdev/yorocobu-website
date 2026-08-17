# Knowledge base regression suite

Thirty questions the site must keep getting right. Run this after any edit to
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

## A. Must answer (17)

Confident answers grounded in the entry named. `unknown` must be false.

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
| A9 | do you take clients | services |
| A10 | can you build an app for my org | services |
| A11 | how do i contact you | contact |
| A12 | what do you build with | stack |
| A13 | do you do ios apps | stack |
| A14 | what does the name mean | name |
| A15 | who is behind this | founders |
| A16 | what have you shipped | portfolio |
| A17 | *(empty submission)* | company |

A1–A8 are the ones to watch. They are asked more than anything else, they are all
answerable from the mission copy, and they are the ones a matcher tuned for
caution gets wrong. A1 regressed once already: it scored below the match
threshold and produced the unknown refusal.

**A9–A10 have a second requirement.** Confirming client work is correct, but the
answer must not state pricing, timelines, availability, or fit, and must end by
routing to the contact action. An answer that confirms client work *and* says
"that sounds like a great fit" is a failure even though it answered.

## B. Must decline (10)

The knowledge base has no answer, and the entry's `do_not_claim` says so. The
reply must name the gap plainly and route onward. It must not guess, hedge into a
plausible-sounding answer, or extrapolate from a related entry.

| # | Question | Must not |
|---|---|---|
| B1 | what does the marketplace tool do | Guess from the category name. It is a category, not a product name. |
| B2 | what is the email platform | Same. Nothing about email features is public. |
| B3 | how much does an app cost | State or estimate any figure, including a range. |
| B4 | what are your rates | Same. |
| B5 | when does the family history app launch | Give any date, quarter, or "soon". |
| B6 | who are your clients | Name any client, or imply there are notable ones. |
| B7 | what is ethan gailushas background | Invent education, employers, or history. |
| B8 | where did bence burton go to university | Same. |
| B9 | do you have an office in berlin | Confirm or deny a location. None is public. |
| B10 | how much funding have you raised | State any figure, or imply a raise happened. |

B1 and B2 are the sharpest test in the suite. "Family History App" invites a
sentence about genealogy and "Marketplace Tool" invites one about buyers and
sellers, and both would be fabrications. If either starts answering, an entry has
been written loosely enough to license the guess.

B3 and B10 must also decline *distinctly*. A funding question answered with the
pricing refusal is wrong even though it refused — it declines the wrong thing.

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

---

## Reading a failure

| Symptom | Where to look |
|---|---|
| A refusal case started answering | The entry it drew on. Its `summary` or `detail` implies more than it should, or a `do_not_claim` line is missing. |
| An answer case started refusing | Aliases on the entry, then the match threshold in `src/lib/navigator.js`. |
| Right refusal, wrong subject | Guard order in `navigator.js`. The more specific guard has to run first. |
| An answer cites the wrong entry | `used_entries` on the response. Two entries probably share an alias. |

`used_entries` is on every response for exactly this reason: it says what the
answer was grounded in, so a bad answer can be traced to the entry that caused it
instead of being guessed at.
