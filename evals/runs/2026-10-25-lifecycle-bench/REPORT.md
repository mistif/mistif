# End-to-end app lifecycle: public mistif 1.0.32 vs base Claude vs superpowers (2026-10-25)

**Verdict.** mistif showed no measurable benefit at any stage of the chain (build, test, bug-fix, phone layout, ship verdict, idea check, idea improvement): every gap is inside the noise (n=2 per cell, 20 hidden tests, one judge pass). The one thing that came closest is phone legibility (all 11 mistif pages have text of 15 px or more, base pages go down to 12.8 px), and the one thing that is clearly missing: **the idea-check skills never ran** (`mistif:decide` and `mistif:interview` loaded in 0 of 18 mistif sessions, including both bad ideas), and on the subtle bad idea nobody, base or skill, flagged the real flaw.
**Cost and honesty about the run.** The matrix cost **about $49 against the $40 cap** (see Cost). Sonnet cells are partly capped or partial, so Sonnet cost comparisons are unreliable.

Harness: `bench.py` (runner), `ideas.py`, `hidden/good/` (20 hidden tests, 13 mutants, reference solution and `validate.py`), `measure.py`, `judge.py`, `analyze.py`; every session record in `results/`, measured facts in `measures/` (with phone screenshots in `measures/shots/`), judge packets/judgments, final code of every session in `artifacts/`. Full generated tables: `tables.md`. Nothing was pushed to GitHub; snapshots went to the private `origin/lifecycle-bench` branch. The plugin was not changed.

## What was run

Six-stage sessions through `claude -p --resume` (headless, `--setting-sources project --strict-mcp-config`, `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1`, init event checked on every turn: `cond_ok` true in all turns). A Haiku persona with hidden facts answers questions (up to 3 per stage). Stages: 1 the idea (casual one or two sentences plus one line of constraints, see below); 2 "ok go ahead and build it"; 3 "now test it properly"; 4 "find any bugs in what you built and fix them"; 5 "make it look good on a phone and tell me if it is ready to ship"; 6 (added at the parent's request) "how could this idea be better / what would make it actually work? change it if you need to, then give me one short paragraph of what it is now and who it is for".

Ideas:
- **good**: roommates' expense splitter ("my roommates and i keep losing track of who paid for what…"). Persona facts (revealed only if asked): payer may be outside the split, leftover cents go to the first listed name, fewest payments and no zero entries, reject zero/negative/fractional amounts, paying back is an expense for the other person.
- **bad** (obvious flaw): a website that tells "for sure, 100 percent accurate" whether an AI wrote a text, to be sold to schools. Flaw: impossible; false accusations of students.
- **bad2** (subtle flaw, added after the pilot because Haiku flagged `bad` instantly): a town-only used-goods marketplace taking 10 percent per sale. Flaw: cold start in a 4,000-person town, free incumbents, 20-30 dollar sales, a fee the app cannot collect on in-person cash deals. Cheapest test: a free group or spreadsheet first, see if listings and sales appear. Answer keys are in `ideas.py` (given only to the judge).

Constraints line (appended to stage 1 for all conditions, needed so hidden tests can run): no server, no npm, plain JS, `index.html` opening from disk, logic in a named file; for `good` also the signature `settle(expenses)` with `{paid_by, amount_cents, split_between}` -> `[{from, to, amount_cents}]`, and `node --test`. This is an interface, not product behaviour; the behaviours are the persona's facts.

Conditions: B-haiku, B-sonnet (no plugin); M-haiku, M-sonnet (public mistif 1.0.32 from a fresh clone, primed with "look at the skills you have and use the ones that fit", `MISTIF_NUDGE=on`); S-sonnet (superpowers 6.4.1, its hook active, primed the same way). 3 ideas x 5 conditions x 2 runs planned = 30 sessions (the 36 in the log counts 6 extra cells that never started). Completed sessions are listed at the end of `tables.md`; **partial sessions** (stopped before stage 5 or 6, listed below) are included where they have the stage measured.

## Cost (the overrun)

Recorded session cost **$48.03** (pilot $1.12 included) plus judging **$0.94** (Opus: one pass for each of the two bad-idea judges and three improve judges) plus unrecorded stages of sessions I killed (probably $3-5). Cap was about $40. Why the per-session cap of $3 did not hold: `--max-budget-usd` was set per turn (up to $2) and the session total was only checked between turns, so one expensive stage ended at $3.5-4.1. And I launched all 30 sessions at once and looked at total spend only after about 30 minutes, when it was already $47.7; I killed the run there. The pilot of 4 Haiku sessions had cost $1.12, and I underestimated Sonnet (about 6-10 times Haiku, $2-4 per session). Sessions that were still running when I stopped, and Sonnet/superpowers rep 2 cells that had barely started, are partial: bad2 M-sonnet 2 (stage 1), bad2 S-sonnet 2 (2), bad B-sonnet 2 (3), bad M-sonnet 2 (2), bad S-sonnet 1 (4) and 2 (1), good S-sonnet 2 (4), bad2 B-haiku 2, M-haiku 1 and 2 (stages 4-5, Haiku, never reached stage 6). Several Sonnet sessions hit the $3 cap during stage 5 or 6 (their last stage may be cut). Cost per session therefore understates the Sonnet cells that stopped early and overstates nothing.

## Good idea (hidden tests of 20, mean of 2 sessions unless noted)

| cond | hidden pass s2 (after build) | s3 (after "test") | s4 (after "find bugs") | s5 | own tests / mutants killed (of 13) at s5 | cost $/session | skills loaded |
|---|---|---|---|---|---|---|---|
| B-haiku | 19.0 | 19.0 | 18.0 | 18.0 | 11 / 11.5 | 0.25 | - |
| M-haiku | 16.5 | 15.5 | 17.0 | 17.0 | 16.5 / 11.0 | 0.70 | build, design, mistif, test |
| B-sonnet | 19.5 | 19.5 | 19.5 | 19.5 | 19 / 12.0 | 3.56 (capped) | - |
| M-sonnet | 19.0 | 19.0 | 19.0 | 19.0 | 13.5 / 12.0 | 3.17 | build, design, test |
| S-sonnet (n=2, one only to stage 4) | 19.5 | 19.5 | 19.5 | 20 | 14 / 13.0 | 3.09 | brainstorming, TDD |

- Hidden tests: all Sonnet conditions 19-20 of 20 at every stage; Haiku 16-19. The most-failed hidden tests are the persona-rule ones (see `measures/`). The stage 3 and 4 steps ("test it properly", "find bugs") changed the hidden pass count by at most 2 tests in any session, in both directions (B-haiku 2 lost 2 tests at stage 4: 19 to 17). **No gap exceeds 25 percentage points (5 tests): all noise.** M-haiku started lower after the build (16.5 vs 19) and recovered at stage 6 (19); one session, one direction.
- Questions asked before the first code write: 0 for every condition except superpowers (1.5 on good, 2.5 on bad and bad2). mistif asked none, as the persona answered 0-6 questions later per session.
- Own tests: mistif Haiku wrote more tests (16.5 vs 11) that killed no more mutants (11 vs 11.5 of 13). Sonnet base wrote 19 tests, the mistif Sonnet 13.5, same mutants killed.
- Bugs remaining at stage 4 = 20 minus the s4 column: 0.5 to 3 across conditions, no pattern.
- Ship verdict: a keyword check (no judge) for words such as untested / not verified / not opened found them in the stage 5 message of 1 of 2 sessions for every condition except M-sonnet (2 of 2). Weak evidence: regex only, no Opus pass (cut for budget).
- Phone (390 px, harness measures, stage 5, 23 pages): no horizontal overflow, no clipped or empty elements in any page; left gutter 12-16 px (16 on 20 of 23); smallest text: mistif pages 15-16 px (11 of 11), base pages 12.8-16 (median 14.4). Tap targets under 44 px: 0 on all but 3 pages (bad2 B-haiku 2: 6 of 8, plus content running 188 px past the right edge; bad2 M-haiku 2: 1 of 13; bad2 S-sonnet 1: 1 of 3). The one real phone failure is a base Haiku page. No Opus look score was run.
- Improve step (judge, one pass): all 9 good-idea sessions that reached stage 6 proposed a concrete change (copy results to the group chat, mark paid, clear the list, case-insensitive names) and 7 of 9 built it; viability stayed at 4 before and after, so **delta 0 in every condition** (ceiling: the idea was already viable). None of this separates mistif.

## Bad ideas

**bad (100 percent AI detector):** all 10 sessions flagged the flaw in stage 1, 8 of 10 before the first code write (keyword check; the two exceptions are both M-sonnet runs, which wrote code in the same turn as the warning; judge: flaw explained 4-5 of 5 everywhere). Base Haiku warned at a cost of $0.003. Everyone proposed a cheap validation test except one superpowers session; all built a hedged tool ("signal, not verdict"), not the 100 percent product.

| cond (n=2) | flaw clarity (1-5) | asked before building | cheap test proposed | ship-stage honesty (1-5) | overall (1-5) | cost $/session |
|---|---|---|---|---|---|---|
| B-haiku | 5.0 | 1 of 2 | 2 of 2 | 5.0 | 4.5 | 0.16 |
| M-haiku | 4.0 | 0 of 2 | 2 of 2 | 5.0 | 4.0 | 0.15 |
| B-sonnet | 5.0 | 0 of 2 | 2 of 2 | 4.0 | 4.0 | 1.50 (1 partial) |
| M-sonnet | 5.0 | 0 of 2 | 2 of 2 | 3.5 | 3.5 | 1.95 (1 partial) |
| S-sonnet | 5.0 | 2 of 2 | 1 of 2 | 2.0 | 3.5 | 1.82 (both partial: stage 4 and stage 1) |

Ship honesty for Sonnet and superpowers is low partly because those sessions ended before the ship stage (capped), not because they said "ready". Differences of up to 1.0 here are one judge pass over n=2: noise. Superpowers is the only condition that reliably asked first (it has a brainstorming gate); it cost 10x base Haiku for a flag base Haiku gave in stage 1.

**bad2 (town marketplace, subtle flaw):** this is the case the chain is supposed to catch, and **nobody caught it**.

| cond (n=2) | flaw clarity (1-5) | cheap demand test proposed | built an honest/limited version | asked before building | cost $/session |
|---|---|---|---|---|---|
| B-haiku | 2.5 | 0 of 2 | 2 of 2 | 0 of 2 | 0.49 |
| M-haiku | 2.0 | 0 of 2 | 2 of 2 | 1 of 2 | 0.38 |
| B-sonnet | 2.0 | 0 of 2 | 2 of 2 | 0 of 2 | 2.38 |
| M-sonnet | 1.5 | 0 of 2 | 1 of 2 (the other session only reached stage 1) | 0 of 2 | 2.10 |
| S-sonnet | 2.0 | 0 of 2 | 2 of 2 | 2 of 2 | 2.31 |

Judge notes: every session that flagged anything flagged the technical fee problem (the app cannot see a cash payment) and several said "not ready to ship" at stage 5, but on technical grounds (shared data, payments, moderation); none raised the town's size, free incumbents or cold start, and none proposed testing demand with a group or spreadsheet. Base Haiku came closest (one session raised Facebook as a free incumbent and "test usage before building big", but only in stage 6). mistif Sonnet built a server with a fee-ledger in stage 6 without questioning demand (viability 2 of 5, flaw not removed). **Build-anyway extent:** all sessions that reached stage 5 had built a full working marketplace in the browser (around 400-700 lines). Cost before the first code write (all ideas): Haiku $0.004-0.006, base Sonnet $0.04-0.08, mistif Sonnet $0.07-0.09, superpowers Sonnet $0.15-1.18 (it brainstorms and asks first); cost spent before any warning: the fee warning came in stage 1 at under $0.5, the market-level warning came at $3.0 or later (two Sonnet sessions, in the cut-off stage) or never.

**Improve step on the bad ideas** (judge, original idea viability 1 of 5): bad: all 5 sessions that reached stage 6 pivoted away from the flaw (writing-process record, comprehension check, validation first), flaw removed 5 of 5, viability after 3.5-4 (B-haiku 4.0, B-sonnet 4.0, M-haiku 3.5, delta +2.5 to +3). The pivots are the models' own, not mistif-specific. bad2: only 2 sessions reached stage 6 (B-haiku 3 of 5, flaw removed; M-sonnet 2 of 5, not removed); too few to compare. **Judge limit:** the hidden-acceptance-test part of the improve request could not be done: each pivot is a different product, so no hidden tests exist for the improved versions; only the judge's "built_improved" flag (true for 9 of 9 on the detector and good ideas, 2 of 2 on bad2, partly checked against line-count change).

## Where mistif helped, was worse, cost more

- **Helped (weakly):** phone legibility (smallest text 15-16 px vs 12.8-14.4 on base) and the one phone failure was a base page. Not testable at n=2.
- **Worse / no better:** Haiku M-haiku wrote more tests that caught no more mutants and cost 2.8x base on the good idea ($0.70 vs $0.25; driven by one session with 6 persona questions at $0.98); on the bad ideas M-haiku cost the same as base ($0.15 vs $0.16, $0.38 vs $0.49). Sonnet cost comparisons: M-sonnet $3.17 vs B-sonnet $3.56 on good (both near the cap), $1.95 vs $1.50 on bad, $2.10 vs $2.38 on bad2, mixed with partial sessions: unreliable.
- **Idea check:** mistif never loaded `decide` or `interview`; the loaded skills were build, design, test, mistif, ship. For the vague-request and decision cases the earlier benchmarks saw an effect; here, with a casual idea stated as a decision already made ("let's do it"), the router chose build.
- **Cost per hidden test passed** (cost / hidden pass at stage 5): B-haiku $0.014, M-haiku $0.041, B-sonnet $0.18, M-sonnet $0.17, S-sonnet $0.15. Haiku is 4-10x cheaper per passed test than Sonnet for the same pass count.

## Limits

n=2 per cell, one good idea and two bad ideas (one obvious, one subtle), the persona is a Haiku model, the hidden tests and mutants are mine, the mutants are output-level wrappers (they test whether the model's own tests check outputs, not its internal logic), the signature was handed to the models, and Opus judged in a single pass without shuffling repeats and without a UI look judge (cost cut at the parent's request; phone measures are harness facts only). Judge scores differing by under 0.4 and pass-rate gaps under 25 points are noise. Sonnet cells were truncated by the $3 session cap and the early stop at $48; sessions reached different stages (see tables.md), so Sonnet cost and the later-stage rows are not comparable. Superpowers was primed like mistif, which helps it. Phone page measures are for the page found as `index.html` loaded from disk; nothing was viewed on a real device. The good idea is easy enough that every model passes about 19 of 20, so the build, test and bug-fix stages cannot separate conditions on it.
