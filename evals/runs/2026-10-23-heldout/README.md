# Held-out blind test: old skill set vs new set, on fresh tasks (2026-10-23)

Build tested: an earlier build. One re-test of the losing skill after one fix.

**Target (set by the author): new mean at least 4.5, not behind old on any task, at lower or equal tokens. Not reached: new mean 4.44 (old 4.06).**

## Setup
- 8 fresh tasks, with different content from the first two tests, one per skill: shaping a support-tool request, `merge_intervals` with tests, review of an invoice-export patch (10 planted issues), a Monday release packet (12 planted problems), a kayak-rental page, a decision for a 5-person agency, a prompt for a weekly ticket report, and a harder fan-out trap (12 one-line emails; the user says cost is no concern and demands 12 agents plus a merger).
- 2 sides x 2 runs = 32 Sonnet runs (no skill was tuned to these prompts after they were written; the fixes before this came from the failure patterns in the earlier test, see the 2026-10-23-full README). Shuffled labels P01..P32, four Opus judges, 4 stated criteria per task, key in `ANSWER-KEY.json` (not shown to judges). The UI page was judged from screenshots at 1280 px and in a real 390 px iframe (not a narrowed window).
- Token figure = harness total per agent (includes about 75k base context). "Agents spawned" = `AGENTS_I_WOULD_SPAWN` (no agent was allowed to spawn).

## Results (mean of the judge's four criteria, 1-5)
| Task (new skill) | Old | New | Winner | Tokens old / new | Agents old / new |
|---|---|---|---|---|---|
| H1 shaping (mistif:interview) | 3.12 | 4.38 | new | 90.1k / 80.0k | 0,0 / 0,0 |
| H2 build (mistif:build) | 4.62 | 4.75 | new | 90.5k / 83.4k | 0 / 0 |
| H3 review (mistif:review) | 3.88 | 4.62 | new | 99.7k / 84.8k | 0 / 0 |
| H4 ship check (mistif:ship) | 4.38 | 4.75 | new | 87.5k / 83.3k | 0 / 0 |
| H5 UI page (mistif:design) | 3.62 | 4.12 | new | 149.7k / 98.0k | 0 / 0 |
| H6 decision (mistif:decide) | 4.00 | 4.12 | new | 83.6k / 84.3k | 1 / 0 |
| H7 prompt (mistif:prompt) | 4.62 | 4.75 | new | 84.1k / 80.8k | 0 / 0 |
| H8 fan-out (lean-agents) | 4.25 | 4.00 | **old** | 81.6k / 80.1k | 0 / 0 |
| **Overall** | **4.06** | **4.44** | new 7 of 8 | **95.9k / 84.3k (-12%)** | |

Run-level: new won 19 of the 32 head-to-head run pairs, old won 6, 7 tied. The first full test (different tasks, before the fixes) was new 4.42 vs old 4.02, so the mean did not move much but the gap held on tasks it was never tuned on.

## Against the target
- **Mean at least 4.5: no (4.44).**
- **Not behind old on any task: no.** H8 (lean-agents) was behind, 4.00 vs 4.25. After one fix and one re-test (see below) it is ahead, 4.00 vs 3.88.
- **Tokens lower or equal: yes overall (-12%).** One task is marginally higher: H6, 84.3k vs 83.6k (+0.8%, inside noise).

## Where the old skill won, and why
- **H8 fan-out, old 4.25 vs new 4.00.** Both sides declined the 12-agent fan-out and did the job inline, so the skill did not change the main decision. The new answers lost on tone and concision: one quoted unmeasured token totals and another leaned on a cost argument the user had explicitly waived. All four answers split "cancel my account" into its own theme, which the judge counted against both sides.
- Individual runs where old beat new: H5's best old page (4.75, an orange-and-navy page with a stacked-kayak motif and an oversized price) beat the best new page (4.5), although one old page was badly broken (scroll-reveal content never showed, 2.5 overall). H3's old runs found all 10 issues (recall 5) but were padded; new runs found 9 of 10 with less padding. H6 had one new run with a logic slip (flip conditions backwards, 3 on grounding) and one old run with a cost error.

## Fix and re-test (one allowed)
Cause: the lean-agents answers cited a cost argument after the user waived cost, and quoted token figures nobody had measured. Fix (general rule): decline an unneeded fan-out with reasons that hold when cost is waived (slower than reading a handful of short items, and one reader sees patterns across items), and quote token figures only if measured in the session. Re-test: two new H8 runs judged blind with the two old outputs.

| | Old | New (after fixes) | Tokens old / new |
|---|---|---|---|
| H8 re-test | 3.88 (4.5, 3.25) | 4.00 (4.25, 3.75) | 81.6k / 80.3k |

New is now ahead on H8, by a small margin; the judge scored the old answers lower this time (3.88 vs 4.25), so judge noise is as large as the difference. The new answers now open with the decline and give reasons that survive the waiver, but still split cancellation into its own theme and carry a little extra bulk. The overall held-out mean above was not recomputed with the re-test, and is still 4.44.

## What kept the mean under 4.5
- A harness footer: several new replies lost points for the `AGENTS_I_WOULD_SPAWN` line the test itself requires (H1 judge notes). This lowers the new mean on H1 and perhaps others and is not a skill defect.
- Concision on long outputs (H3, H4 old; H8, H1 new), a content slip on decision arithmetic (H6), and one page whose wordmark overflowed at 390 px (H5, new, 2 on the mobile criterion).
- Proposed, not applied (the rules say no edits after seeing held-out scores beyond the one fix): in `mistif:decide`, re-derive flip conditions and arithmetic before printing; in `mistif:design`, include a check that the largest heading or wordmark fits the phone width.

## Limits
Two runs per cell, one judge per task pair, criteria written by the tester, small tasks, Sonnet only, whole-number scores (0.25 is one point on one criterion). Token totals include each agent's 75k base context, which compresses relative differences. The always-loaded listing is unchanged from the earlier test: 12,761 characters for the old set, 2,250 for the new nine (both load today).
