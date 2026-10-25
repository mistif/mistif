# Public mistif vs base Claude and older skill sets (2026-10-25)

Plugin tested: public `mistif/mistif` cloned at `1a2197d` (mistif 1.0.29, session-start nudge on by default). Harness `bench.py`, `tasks.py`, `measure.py`, `judge.py`, `analyze.py`; fixtures, hidden tests, mutants, answer keys, every run record (`results/`), measured facts (`measures/`), judge packets and judgments. Full tables: `tables.md`. Nothing was pushed or published.

## Answer in six lines

1. **On this suite mistif is not measurably better or worse than base Haiku.** Unprimed (what a real user gets): mistif 4.47, base Haiku 4.51, mistif with the nudge off 4.55, difference to base Haiku -0.04 (95% interval -0.17 to +0.08). Primed: 4.61 vs 4.54, +0.07 (-0.06 to +0.21). Both inside the noise (a cell's run-to-run SD is 0.18).
2. **The suite is too easy to separate anything.** Every condition passes all 14 hidden feature tests and all 16 bug-fix tests, finds 8 of 8 planted review defects and about 10 of 10 audit bugs, and no run spawned an agent (0 in all 36 audit runs, base included). Judge scores sit between 3.5 and 5.0 with most at 4.3-4.9. Differences below about 0.4 are not results.
3. **Haiku with skills did not catch Sonnet by quality, because base Haiku already matched it here.** Base Haiku 4.51 vs base Sonnet 4.33 (judge rubric rewards tests and a stated check; Sonnet made minimal fixes with fewer added tests). Mistif-Haiku vs base Sonnet +0.13 (0.00 to +0.25), at about 1/8 of the cost ($0.008 vs $0.060 per run).
4. **The nudge works as a router and costs tokens.** Unprimed, mistif loaded a mistif skill in 24 of 28 single-shot runs; base Haiku 0 of 28, mistif with the nudge off 0 of 28, old mistif 0 of 28, superpowers 6 of 28. Cost per run Haiku unprimed: mistif $0.0078 (108k tokens) vs base $0.0051 (61k) vs nudge off $0.0056 (69k): **+53% cost, +75% tokens for no measured quality gain.**
5. **Where mistif was worse: the UI page, unprimed.** 3.94 vs 4.56-4.81 for every other condition; all four mistif runs had loaded `mistif:design`. The one page I opened has content flush to the screen edge with no side gutters, a clipped "Closed now" label and an empty bordered box; in the first two judge passes the three mistif pages scored design 2 and phone legibility 3-4. The primed mistif page was fine (4.69).
6. **Where mistif was better: the decision task** (4.62 vs 4.12 base Haiku unprimed; 4.81 vs 4.31 primed, 4 runs and 2 runs; the largest per-task gap in the data, though the nudge-off arm also scored 4.38) and the **primed vague-request dialogue** (asked before building 3/4, brief 4/4, acceptance list 3/4 vs base 0/4). Unprimed it asked 0/8, same as base.

## What was run

Headless `claude -p`, Haiku (`claude-haiku-5-5`) for every skill condition, base Claude on Haiku and Sonnet (`claude-sonnet-5-5`). Default config dir with `--setting-sources project`, `--strict-mcp-config`, `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` (no user settings, no user CLAUDE.md), tools `Read,Write,Edit,Glob,Grep,Bash,Skill,Agent`, one condition's plugin folder via `--plugin-dir`. Nothing was installed into the real `~/.claude`. Per run, the init event was checked: exactly the intended non-builtin plugin set and none of the personal plugins (`cond_ok` true in all 324 runs).

| condition | loaded |
|---|---|
| B-haiku, B-sonnet | no plugin |
| M-haiku | public mistif 1.0.29 (clone of `github.com/mistif/mistif` at `1a2197d`), nudge default on |
| M-off-haiku | same plugin, `MISTIF_NUDGE=off` |
| S-haiku | superpowers 6.4.1 from the local marketplace cache (its own session-start hook is active) |
| O-haiku | old `mistif-me` + `mistif-dev` from `3fc5fd3~1` (the last tree before the one-plugin merge) |
| A-haiku | agent-skills (Addy Osmani) 0.6.13 |

Deviation from the brief: M was loaded from a clone with `--plugin-dir`, not `claude plugin install` (parent's instruction; a permission checker blocked the clean config dir). Same files.

Tasks (fresh briefs, `tasks.py`): 1 phone UI page for a bike shop with exact facts; 2 coupon feature on a tiny cart library (14 hidden tests); 3 two-symptom bug fix in a pager (16 hidden tests, one cause duplicated in a second function); 4 review of a commit with 8 planted defects and 3 decoys; 5 write tests for an untested text module (17 hidden mutants, 1 of them reachable only by a double-space input); 6 audit of 10 small modules, one planted bug each, "quickly" (fan-out bait); 7 multi-tenancy decision with stated numbers; 8 vague request with the interactive user simulator (4 new hidden personas x 5 facts, run cut at the first code write, Sonnet checks which facts the assistant's own brief states).

Arms and n: **unprimed** (real wording; the harness appends the "no user is available, state your assumption" line to tasks 1-7 in both arms): B-haiku, B-sonnet, M, M-off, S, O x 7 tasks x **4 runs**; A x 2. **Primed** (prompt starts "look at the skills you have available and use the one that fits", copied from the earlier harness): B-haiku, M, S, O, A x 7 tasks x 2 runs. Task 8: 1-2 dialogues per persona (unprimed 8 per condition, A 4; primed 4). 324 runs/dialogues, 0 errors.

Judging: Opus judges all of Haiku and Sonnet output, blind labels, shuffled; 2 passes with different shuffles per packet (first 2 runs per cell in packets 1-2, later runs in packets 3-4). Packets give the final message, the diff, harness-measured facts (hidden tests, mutants killed, agents, tokens, cost, skills loaded, 390 px font/tap/overflow measures) and for task 1 the phone screenshot path. Each criterion is 1-5; a run score is the mean of its criteria and passes. Tasks 2, 3, 5, 6 and the T4 defect list are also measured; T8 is measured only.

## Results: Haiku vs Haiku first

Unprimed (mean of the 7 tasks; 4 runs per cell):

| task | base Haiku | **mistif** | mistif, nudge off | superpowers | old mistif | agent-skills (n=2) | base Sonnet |
|---|---|---|---|---|---|---|---|
| UI page | 4.69 | **3.94** | 4.56 | 4.81 | 4.56 | 4.62 | 4.59 |
| Feature | 4.62 | **4.53** | 4.75 | 4.78 | 4.62 | 4.88 | 3.97 |
| Bug fix | 4.78 | **4.88** | 4.88 | 4.84 | 4.88 | 4.75 | 3.75 |
| Review | 4.28 | **4.41** | 4.28 | 4.28 | 4.31 | 4.38 | 4.44 |
| Write tests | 4.38 | **4.28** | 4.25 | 4.34 | 4.44 | 4.31 | 4.44 |
| Fan-out audit | 4.72 | **4.62** | 4.78 | 4.53 | 4.53 | 4.88 | 4.50 |
| Decision | 4.12 | **4.62** | 4.38 | 4.53 | 4.19 | 4.25 | 4.66 |
| **mean** | **4.51** | **4.47** | 4.55 | 4.59 | 4.50 | 4.58 | 4.33 |
| tokens / run | 61k | **108k** | 69k | 86k | 70k | 92k | 43k |
| $ / run | 0.0051 | **0.0078** | 0.0056 | 0.0065 | 0.0059 | 0.0068 | 0.0599 |
| a skill loaded (runs) | 0/28 | **24/28** | 0/28 | 6/28 | 0/28 | 0/14 | 0/28 |

Mistif minus each baseline, unprimed, bootstrap 95% interval over runs (per task: win above +0.4, loss below -0.4):

| vs | difference | wins / ties / losses (of 7 tasks) |
|---|---|---|
| base Haiku | -0.04 (-0.17 to +0.08) | 1 / 5 / 1 |
| mistif, nudge off | -0.08 (-0.22 to +0.04) | 0 / 6 / 1 |
| superpowers | -0.12 (-0.25 to +0.01) | 0 / 6 / 1 |
| old mistif | -0.04 (-0.18 to +0.11) | 1 / 5 / 1 |
| agent-skills | -0.11 (-0.23 to +0.00) | 0 / 6 / 1 |
| **base Sonnet** | **+0.13 (0.00 to +0.25)** | 2 / 4 / 1 |

The single loss in every row is the UI page; the single win against base Haiku and old mistif is the decision task. No difference is large against the noise, and the sum of tied tasks says "no measurable effect".

Primed (mean of 7 tasks; 2 runs per cell, so each cell moves about +-0.2):

| task | base Haiku | **mistif** | superpowers | old mistif | agent-skills |
|---|---|---|---|---|---|
| UI page | 4.69 | 4.69 | 4.38 | 4.44 | 4.75 |
| Feature | 4.50 | 4.56 | 5.00 | 3.94 | 5.00 |
| Bug fix | 4.69 | 4.62 | 4.88 | 4.94 | 4.81 |
| Review | 4.62 | 4.38 | 4.38 | 4.12 | 4.50 |
| Write tests | 4.19 | 4.75 | 4.50 | 4.38 | 4.56 |
| Fan-out audit | 4.75 | 4.44 | 4.75 | 4.19 | 3.62 |
| Decision | 4.31 | 4.81 | 4.06 | 4.75 | 4.31 |
| **mean** | 4.54 | **4.61** | 4.56 | 4.39 | 4.51 |
| tokens / run | 81k | **92k** | 105k | 123k | 100k |
| $ / run | 0.0062 | **0.0072** | 0.0072 | 0.0080 | 0.0077 |
| a skill loaded | 2/14 | **14/14** | 8/14 | 13/14 | 12/14 |

Mistif minus: base Haiku +0.07 (-0.06 to +0.21), superpowers +0.04 (-0.09 to +0.18), agent-skills +0.10 (-0.03 to +0.22), **old mistif +0.21 (+0.03 to +0.40)**: the only primed gap whose interval excludes zero, and its lower end is barely above it. Primed mistif is also the cheapest of the skill sets per run. Superpowers' own session-start hook did not do the routing on Haiku: it loaded a skill in 6/28 unprimed runs and 8/14 primed; mistif's nudge loaded one in 24/28 unprimed.

## Measured facts (what the harness counted, not the judge)

| measure (unprimed, mean of runs) | base Haiku | mistif | nudge off | superpowers | old mistif | agent-skills | base Sonnet |
|---|---|---|---|---|---|---|---|
| T2 hidden tests passed (of 14) | 14 | 14 | 14 | 14 | 14 | 14 | 14 |
| T3 hidden tests passed (of 16) | 16 | 16 | 16 | 16 | 16 | 16 | 16 |
| T4 planted defects found (judge, of 8) | 8 | 8 | 8 | 8 | 8 | 8 | 8 |
| T4 false alarms per review | 1.0 | 1.25 | 1.0 | 1.25 | 1.0 | 1.0 | 1.0 |
| T5 mutants killed (of 17) | 16.25 | 16.25 | 16.25 | 16.5 | 17.0 | 16.0 | 17.0 |
| T6 audit bugs found (judge, of 10) | 9.75 | 10 | 9.75 | 10 | 9.75 | 10 | 10 |
| T6 agents spawned | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| T6 tokens (k) | 48 | 59 | 51 | 66 | 59 | 59 | 46 |
| T1 smallest phone text px | 15.5 | 14.6 | 14.7 | 14.6 | 14.5 | 14.4 | 15.4 |
| T1 phone taps under 44 px (per page) | 0 | 1.0 | 0.5 | 0 | 0.5 | 0.5 | 0.5 |
| T1 invented numbers, console errors | 0, 0 | 0, 0 | 0, 0 | 0, 0 | 0, 0 | 0, 0 | 0, 0 |

Everything measurable is saturated. The primed measured table is in `tables.md` and says the same.

## Task 8: vague request with the simulated user

Unprimed (8 dialogues per condition; A 4): asked before building: **base Haiku 0/8, mistif 0/8, mistif nudge off 0/8, old mistif 0/8, superpowers 4/8**, agent-skills 0/4, base Sonnet 1/8. Mistif loaded a skill in 4/8 and still built without asking: it loaded `mistif:build` or `mistif:design` and wrote files, saying it would "state assumptions". Superpowers asked in 4/8 (brainstorming, 1.8 question turns, facts of 5 in the brief 1.0).

Primed (4 dialogues each):

| cond | asked before build | question turns | one question per turn | facts of 5 in the brief | brief / acceptance list | cost to first write |
|---|---|---|---|---|---|---|
| base Haiku | 0/4 | 0 | - | 0.0 | 1/4, 0/4 | $0.013 |
| **mistif** | 3/4 | 2.8 | 1/3 | 2.5 | 4/4, 3/4 | $0.022 |
| superpowers | 4/4 | 5.2 | 2/4 | 3.75 | 4/4, 1/4 | $0.039 |
| old mistif | 0/4 | 0 | - | 0.0 | 3/4, 0/4 | $0.031 |
| agent-skills | 2/4 | 2.5 | 1/2 | 1.25 | 2/4, 1/4 | $0.028 |

Primed, mistif is the cheapest way to get an interview and the only one with a done-means list in 3 of 4; superpowers asks more often and in more rounds and covers more facts. Old mistif loaded its skill 4/4 and still asked 0/4 (it did not route to its interview skill). Question turns are cut at the first write, so total build cost is not in these numbers.

## What mistif is bad at (from this data)

1. **The nudge costs about 50% more per run and 75% more tokens on tasks that did not need a skill**, and the quality gain is nil on seven of eight tasks. The nudge-off arm (same files, no routing) scored as well (4.55 vs 4.47).
2. **`mistif:design` unprimed produced the weakest pages** (3.94 vs 4.56-4.81, four of four runs loaded it): zero side padding on the page I looked at, clipped label, an empty icon box. Not seen in the primed arm (4.69), so it may be a variable outcome; n=4.
3. **The vague request is not asked about unprimed**, even when the nudge makes the model load `mistif:build` (0/8 asked). The interview fires only when pointed at (primed 3/4).
4. **Nothing here tests its fan-out brake**: no run in any condition spawned an agent, so `lean-agents` is neither proven nor disproven by this brief.
5. Mistif does not beat the free alternatives primed: superpowers and agent-skills tie it on quality within 0.1.

## Honest limits

- **One brief per task, 2-4 runs per cell**, 1-2 dialogues per persona. Gaps under about 0.4 are noise; the per-cell run-to-run SD is 0.18 (median over 84 cells).
- **Ceiling.** Haiku solves all tasks; scores cluster at 4.3-4.9 so a real gap of 0.3 would be hidden. A harder suite (multi-file refactor, a bug with no reproducing test, an actual fan-out temptation) is needed to learn whether skills help the cheaper model.
- **Judge**: Opus scoring with a rubric I wrote before seeing results; the rubric rewards stated checks and added tests, which favours verbose Haiku runs over Sonnet's terse fixes (base Haiku beat base Sonnet by +0.18, interval +0.08 to +0.28, for that reason as much as quality). Not independently validated; I opened only 2 of the screenshots myself.
- **Judge saw a wrong measured fact once**: five task-2 runs were measured as 0 passed because two measure processes ran at once (transient errors). Found by reading the data, re-measured (all 14/14), and both task-2 judge passes re-run; the discarded first pair (about $1.5) is counted in the spend.
- **Hardening before the main run, not after results**: the bug-fix fixture was made harder (a duplicated formula in `page_label`) after a six-run pilot (deleted, not counted) where every condition passed the first version; no brief was changed after any scored run.
- **Full-page screenshots with sticky headers** show the sticky bar over content; the measured font and tap numbers do not depend on that, the layout judgments partly do.
- **Primed and unprimed are not independent experiments**: different runs, same briefs.
- **Suite coverage**: no Opus, no Sonnet with skills, no run longer than a few minutes, no real repo. The task-8 simulator is a Haiku persona and the fact check is Sonnet, not Opus.
- `M` was loaded with `--plugin-dir` from a clone, not through `claude plugin install`; `userConfig` options of the plugin were left unset (defaults).

## Spend

Runs and simulator $4.71 (324 runs and dialogues; Haiku about $0.005-0.008 per run, base Sonnet $0.06), Opus judging $11.27 plus about $1.5 for the discarded first task-2 pair, Sonnet fact checks $0.58: **about $18** against the $30 cap.
