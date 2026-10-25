# Blind test: mistif:test vs the old way, 5 testing situations (2026-10-24)

Build tested: an earlier build. One fix and one re-test of a losing situation.

**Result: new 4.275, old 4.112 (+0.16), at 2% fewer tokens. New won 2 of 5 situations, tied 1, lost 2. The margin is small and inside judge noise; this is not a clear win.**

**Correction found later (see "Follow-up" at the end):** in the 20-run test below the diff step of the harness failed silently (a quoting error under `cmd.exe`), so the judges saw the author's report and the measured mutation facts but not the test files. The edge-case and style scores in this first test therefore rest on the reports; the measured mutation score does not. The test files of those 20 runs were not kept. The follow-up re-ran both losing situations with the diff fixed.

## Setup
- 5 throwaway repos built for this test (sources in `base/`), each with 2 existing tests in the repo's own style: **T1** JavaScript bug fix (free shipping at exactly $50.00, `node --test`), **T2** legacy Python function with no tests (`normalize_phone`, pytest, "pin it before we refactor"), **T3** React component (`TagInput`, vitest + testing-library), **T4** Node CLI (`colstat`, node:test with child processes), **T5** Claude Code mod hook (a `/notes` command, `claude plugin test`).
- Sides: **old** = the old `test-first` and `build-work` skills; **new** = `mistif:test` (and the references it points at). Same model (Sonnet), same one-line task, 2 runs per cell = 20 runs. No agent could spawn. Labels P01..P20 shuffled, key in `KEY.json` (not shown to judges).
- Score per run = mean of four criteria, 1-5:
  1. **Tests fail when the code is broken: measured, not judged.** After each run, the author's whole suite was run against 9-15 deliberately broken versions of the code (`mut/`, written by me before the runs, each checked to be killable by the hidden reference suites in `hidden/`) and against a correct reference (`ref/`); score = 1 + 4 x share of breaks the suite turned red on (0 if it failed on correct code). For T1 (bug fix) the author's fix also had to pass a hidden acceptance suite. The author's own source was replaced by the reference or a mutant, so any fix style is judged the same way.
  2. edge-case coverage, 3. fit with the existing style, 4. honest report: judged by Opus (two judges, 3 + 2 tasks), blind, on the diff, the report and the measured facts above (so a claim of proof the facts contradict is visible).
- Tokens = the harness total per agent (includes about 75-80k base context).

## Results
| Situation | Old | New | Winner | Mutants caught old / new | Tokens old / new |
|---|---|---|---|---|---|
| T1 bug fix (JS) | 3.25 | 4.13 | new | 10 of 20 / 15 of 20 | 84.5k / 84.8k |
| T2 legacy Python | 4.38 | 4.13 | old | 20 of 20 / 20 of 20 | 96.8k / 97.3k |
| T3 React component | 4.63 | 4.25 | old | 18 of 18 / 18 of 18 | 95.0k / 91.7k |
| T4 Node CLI | 4.38 | 4.38 | tie | 24 of 24 / 24 of 24 | 96.1k / 93.8k |
| T5 mod hook | 3.93 | 4.50 | new | 28 of 30 / 30 of 30 | 99.2k / 93.1k |
| **Overall** | **4.11** | **4.28** | new 2, tie 1, old 2 | | **94.3k / 92.1k (-2%)** |

By criterion (all 10 runs per side): breaks caught 4.55 old / 4.80 new; edge cases 3.7 / 4.4; style fit 4.3 / 4.1; honest report 3.9 / 3.8. Run pairs (same task and repetition): new won 4, old won 3, 3 tied. Per-run numbers: `tally.json`, judge notes in `judge_out/`.

## Where new won, where it lost, and why
- **T1 bug fix:** both sides wrote a regression test for the boundary, but new runs covered more of the neighbouring rules (coupon boundary, empty cart, and in one run the range and rounding) and caught more of the broken versions (9 and 6 of 10 against 5 and 5). This is the situation the skill was written for.
- **T5 mod hook:** new used the mod-test reference and caught every break; one old run missed that a handler answers other commands too and the other missed an off-by-one in `done N`. The old reports were also less accurate (one claimed proof the facts did not support).
- **T2 and T3 (lost):** the broken-version score was perfect on both sides, so the gap is style and report. New wrote more tests than it needed (94 tests with 15 near-identical phone formats; 17 React tests with several that hit the same branch) and its reports were long and narrated the process (a skill screenshot step, run times, runner trivia). Judges marked both down; report length was 560 words on new T3 against 360-440 on old.
- Ceiling effect: on T2, T3 and T4 every run on both sides caught every break, so the measured criterion cannot separate them there. The old side already asks for a failing test and a break-it check; mistif:test's gain shows in the cases where that is not enough (T1, T5).

## Fix and re-test (one allowed)
Cause: report padding and redundant cases on the new side. Fix (general, not tied to a task): the report is capped at about 150 words with no process narration, and a new rule says one case per distinct behaviour (same-branch inputs are one case or one table row). Re-test: situation T3, two new runs after the fix, judged blind with the two old outputs.

| T3 | Old | New before | New after |
|---|---|---|---|
| Mean | 4.63 (4.50, 4.75) | 4.25 (4.25, 4.25) | **4.32** (4.75, 3.89) |
| Report length | 363 / 443 words | 561 / 569 | 218 / 295 |
| Tests written | 13-14 | 17 | 13 / 9 |
| Tokens | 96.7k / 93.3k | 93.9k / 89.4k | 94.5k / 95.6k |

The gap to old closed from 0.38 to 0.05 (the judge scored the same two old outputs lower this time, 4.38 against 4.63, so part of that is judge noise). The reports are about half as long, as intended. One re-test run (R02) wrote only nine tests and missed one break (Backspace with no tags), and its report did not list that gap; shorter did not fully fix honesty. The overall mean above was not recomputed with the re-test.

## Limits
Two runs per cell, one judge per task, small tasks, Sonnet only, whole-number judge scores. The broken versions and hidden suites are mine, written before the runs, and cover what I thought matters; a test suite catching them is evidence of strength, not proof. T3's `value.length <= max` break is equivalent through the UI (the input is disabled at max) and was dropped from the set. T2's `strip()` break likewise. Token totals include about 75-80k of base context per agent, which compresses differences. The harness here (`mutate.py`, `collect.py`, `setup_runs.py`, `tally.py`) uses absolute paths from the machine it ran on (a short folder avoids Windows path-length errors); `base/T3` has no `node_modules` (run `npm install` there first). Agent transcripts are not kept; the per-run diffs and final reports are in `judge/` (anonymised).

## Follow-up: the two losing situations re-run with the diff visible (2026-10-24)

Why: the first test lost on legacy Python (T2) and React (T3), and the judges had not seen the test files (correction above). Both situations were re-run with the harness fixed: 2 fresh old-side runs and 2 new-side runs each, new side after the fix, same tasks, Sonnet, mutation check as before, one Opus judge, labels shuffled (`followup/KEY_s.json`, `followup/KEY_x.json`), judge input now includes the full diff. Tests of these 8 runs are kept in `followup/outputs/`. Old-side runs from the first test could not be re-judged (their test files were not kept), so the old side here is the fresh runs.

| Situation | Old (fresh) | New after fix | Breaks caught old / new | Tokens old / new | Report words old / new |
|---|---|---|---|---|---|
| T2 legacy Python | 4.13 (4.25, 4.00) | **4.75** (5.00, 4.50) | 20 of 20 / 20 of 20 | 93.9k / 90.8k | 373, 395 / 347, 303 |
| T3 React component | 4.63 (4.50, 4.75) | **4.88** (5.00, 4.75) | 18 of 18 / 18 of 18 | 92.2k / 93.0k | 328, 271 / 259, 274 |

New is ahead on both, so the earlier loss does not reproduce once the judge sees the tests and the report-length fix is in. Two runs per cell and one judge: the 0.25 to 0.6 gaps are small, so read this as "not behind", not "clearly better".

What the old runs did and the new did not (judge notes and the test files): little. The best old T2 suite (O01) went furthest on odd inputs (non-digit characters inside the extension, a plus that is not first) but wrote about 28 single-case functions that could be tables, and its report counted 43 new tests against 41 in the diff. On T3 the old runs were thorough but repeated their setup in every test and cleaned the document by hand; one report was padded with the story of a failed matcher. What the best new runs did that the others did not: grouped same-branch inputs into tables, pinned both ends of each limit, tested the default `max` and the last free slot, and kept to exact counts. The two things worth keeping from old runs went into the references as general rules: in the UI reference, re-render with new props and send the events the component should ignore; in the legacy reference, when code cuts parts out of text, vary where the marker sits, its case and what non-digit characters fall inside the cut part. Similarity of the skill and all five references against every source stays at 0.00% shared 8-word runs. The later text was not re-tested.

Can the rest of the old testing skills be retired? On this evidence (5 situations, new ahead or level on 4 of 5 in the first test, and ahead on the other two here), the test-first loop and the `/test` command are covered by `mistif:test`: its test-first, bug-reproduction and break-it rules are the same ideas written in our own words, and its pinned-legacy and mod-test material is more than they have. One piece must not be lost: the old `/test` command and `mistif:build`'s test mode are what `mistif:build` points at for the test step, so `mistif:build` needs a line sending test work to `mistif:test` before `an earlier plugin:test-first` and the `/test` command are removed. This was not changed and nothing was removed.
