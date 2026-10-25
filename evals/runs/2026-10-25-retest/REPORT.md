# Re-test of the Phase 1 fixes (2026-10-25)

Plugin `mistif` 1.0.19. Fresh briefs, same kind and difficulty as Phase 1 (not the same text). Screenshots were taken in real Chrome (phone = CDP device emulation). Raw run outputs, answer keys and the harness scripts are not part of this repository (to keep it small); this report and its tables are the evidence. Conditions: A none, C = the skills as of that version, D = C + the Lite line in the system prompt. Every prompt starts with the same line that points the model at its skills and ends with the "nobody can answer" line. Judges: Opus for Haiku and Sonnet output, Sonnet for Opus output (weaker judge, so Opus numbers are less sure); two passes with different shuffles; judges open the real HTML and screenshots; measured facts are in the packets. Cost: runs $8.19 + judging $6.65 = **$14.83** (5-hour window 30% at the start).

## Result (score 1-5, mean of 2 runs x 2 judge passes; C - A is the number to read)

| task (fix) | model | A none | C new | C - A | Phase 1 C - A | D Lite - C |
|---|---|---|---|---|---|---|
| UI page (item 1) | Haiku | 2.62 | 4.00 | **+1.38** | +0.82 | |
| | Sonnet | 3.31 | 4.81 | **+1.50** | -0.62 | |
| | Opus (Sonnet judge) | 3.06 | 4.56 | **+1.50** | +0.25 | |
| 3D page (item 1) | Sonnet | 2.56 | 4.44 | **+1.88** | new | |
| fan-out (item 2) | Haiku | 3.25 | 4.50 | **+1.25** | +0.37 | +0.08 (agents 0 and 0; C: 0 and 11; A: 11 and 11) |
| build (item 3) | Haiku | 3.75 | 3.88 | +0.12 | -0.32 | |
| vague request (item 4) | Haiku | 2.44 | 2.56 | +0.12 | -1.00 | |
| | Sonnet | 2.88 | 2.81 | -0.06 | -0.13 | |
| review (item 5) | Haiku | 4.25 | 4.06 | -0.19 | +0.07 | +0.31 |
| | Sonnet | 3.62 | 3.88 | +0.25 | -0.31 | +0.31 |

Noise: a 2-run cell moves about 0.3 between runs (R2 Haiku C: 4.75 and 3.00); anything under about 0.4 is not a result. Absolute scores are not comparable with Phase 1 (other briefs, other judge passes); the C - A gap on the same brief is.

## What moved, item by item

- **1 design (clear win, measured).** Phone width, harness-measured: smallest text in the UI pages A 12-13 px, C 13-14.4 px; in the 3D pages A 10.6-11.2 px, C 13 px; small tap targets in the 3D pages A 5-9, C 0-4. Numbers in the page that the brief does not contain: C none in 6 UI pages; A had invented dates (Opus) and extra counts (Sonnet). Judges scored "nothing invented" 4-5 for C and 2-3.5 for A. 3D pages, both builds at 60 fps on the real GPU (worst frame 17-18 ms), no console errors, no horizontal overflow; C won on legibility (5.0 vs 1.75) and responsiveness (4.75 vs 2.5), tied on 3D craft (4.0 vs 4.0), so the lighting checklist did not show an effect here (n=2, one model). C cost more on the 3D brief ($1.10 vs $0.83) and 1.4M vs 1.0M tokens.
- **2 lean-agents (partial).** Haiku with the skill: 0 agents in 3 of 4 runs (C 0 and 11, D 0 and 0), against 11 in both A runs. Phase 1 Haiku spawned 13 every time. One run in four still fans out, so "Haiku obeys it" is not proven.
- **3 build (neutral).** Haiku C passes the same 28 hidden tests as A (28/28 each); score +0.12, within noise; tokens 117k vs 104k. The Phase 1 deficit (-0.32) did not show up, but this task cannot separate them.
- **4 interview reachable (did not work).** Neither Haiku nor Sonnet loaded `mistif:interview` in any of 8 runs; they loaded `mistif:build`, read its first line and built the whole app anyway (6-7 files each), as in A. The brief's own "nobody can answer, state your assumption and continue" line competes with "build nothing", and it won. Score unchanged. Needs an interactive test or a different design (for example the entry skill carrying the whole short interview itself); not fixed here.
- **5 review (neutral to small gain).** Sonnet +0.25 (was -0.31), Haiku -0.19 (was +0.07): both inside the noise. Recall criterion: Sonnet 4.0 vs 3.25, Haiku 3.75 vs 4.5. Lite scored higher than Full on both models (+0.31, +0.31), which fits the Phase 1 finding that Lite is equal on quality.
- **6 Lite.** Works as designed in the tests (110 pass). In the runs D used fewer tokens on fan-out (66k vs 75k) and equal on review (96k vs 109k Haiku, 76k vs 76k Sonnet). Default is off.

## Honest limits

One brief per task, two runs per cell, one model for the 3D page, no Opus 3D run. Opus UI is judged by Sonnet. The R2 build brief is saturated (every condition passes the hidden tests). Item 4 failed and I did not change anything after seeing the scores. Nothing got clearly worse (R3 Haiku -0.19 is inside the noise), so the one allowed fix and re-test was not used.

Files named in the original run folder (`results/`, `measures/`, `judgments/`, `keys/`, `outputs/`, `tasks.json`) are not part of this repository.
