# Re-test of the new set after the held-out fixes (2026-10-24)

Build tested: an earlier build, the held-out fixes applied (lean-agents, decide and design fixes).

**Important: this is not a held-out test any more.** The 8 tasks are the same prompts as `2026-10-23-heldout` (their results led to the fixes), so this shows whether the fixes helped, not how the skills generalise. The fixes are general rules, not text about these tasks.

## Setup
- Only the new side was re-run: 16 Sonnet runs (2 per task), with the old side's 16 outputs from the held-out test reused unchanged (the old skills did not change). All 32 outputs were relabelled J01..J32, shuffled, and re-judged blind by four Opus judges with the same four criteria per task. Keys: `ANSWER-KEY-runs.json`, `ANSWER-KEY-judging.json`. The UI pages were screenshotted in a real 390 px frame.
- Token = harness total per agent (about 75k base context each).

## Result (mean of the four criteria, 1-5)
| Task | Old | New (after fixes) | Winner | Tokens old / new | Was in held-out (new) |
|---|---|---|---|---|---|
| H1 shaping | 3.38 | 4.12 | new | 90.1k / 80.3k | 4.38 |
| H2 build | 4.88 | 4.62 | **old** | 90.5k / 83.3k | 4.75 |
| H3 review | 3.88 | 4.50 | new | 99.7k / 85.5k | 4.62 |
| H4 ship | 4.38 | 4.75 | new | 87.5k / 83.5k | 4.75 |
| H5 UI page | 3.88 | 4.12 | new | 149.7k / 95.3k | 4.12 |
| H6 decision | 4.12 | 4.50 | new | 83.6k / 87.2k | 4.12 |
| H7 prompt | 4.38 | 4.62 | new | 84.1k / 80.9k | 4.75 |
| H8 fan-out | 4.38 | 4.38 | tie | 81.6k / 80.4k | 4.00 |
| **Overall** | **4.16** | **4.45** | new 6, tie 1, old 1 | **95.9k / 84.5k (-12%)** | 4.44 |

Run-level: new won 18 of the 32 run pairs, old 7, 7 tied.

**Target (new mean at least 4.5, not behind on any task, tokens at or below old): not reached.** New mean 4.45; behind on build (H2); tokens lower overall but higher on the decision task (+4%, 87.2k vs 83.6k).

## What moved and what did not
- **Moved:** the decision task (4.12 to 4.50: the arithmetic and flip-condition slips are gone) and the fan-out task (4.00 to 4.38, now level with old; one run still carried an unmeasured cost claim).
- **Did not move:** the overall mean (4.44 to 4.45). Gains on H6 and H8 were offset by small drops on H1 (4.38 to 4.12), H2 (4.75 to 4.62), H3 and H7. Differences of this size are inside judge noise: the old side's own mean moved from 4.06 to 4.16 with no change to the old skills.
- **Old won build (4.88 vs 4.62).** Both new runs bundled several edge cases into combined tests; the old runs wrote nine granular tests and a new-list identity check. A rule added earlier ("each test earns its place: no duplicate assertions") may be nudging toward bundling. The old reports were also slightly padded, but the judges weighted test quality more.
- **Where the mean is held down:** the UI page. Both new pages scored 3 on distinctiveness ("generic feel", "fairly familiar layout") against 5 for the old stack's best page (a bold orange block, a stacked-kayak motif, oversized numerals); the old side's other page was broken (content hidden by scroll-reveal, 3.0 overall). The one-signature rule produced a signature element and a working function but still a conventional layout. A compact rule is not enough here: the old stack's edge comes from its heavier art-direction process.
- **Shaping:** two replies still carry the test harness's own `AGENTS_I_WOULD_SPAWN` footer (judged as a process footer), and one jumps to a specific solution in its guess.

## Proposals (not applied: the rules allow one fix and one re-test only)
1. `mistif:build` test mode: "one behaviour per test, named for it" in place of the duplicate-assertion wording, to stop bundling edge cases.
2. `mistif:design`: let it offer a separate "distinctive" mode. The evidence here is that a compact rule alone does not close the distinctiveness gap (3 against 5) and the old stack costs 1.6 times the tokens (150k vs 95k), so this is a choice between cost and look, for you to decide.
3. `mistif:ship`: ask for rollback thresholds as numbers (two replies left them unset).

## Limits
Two runs per cell, one judge per task pair, whole-number scores, the judge sees criteria the tester wrote, tasks are small, Sonnet only. The same tasks were reused, so this cannot show generalisation. Judge noise is as large as most of the differences above.
