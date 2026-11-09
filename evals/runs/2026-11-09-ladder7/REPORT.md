# Seven-level ladder: mistif 1.0.36 vs 1.0.35 vs base (2026-11-09)

## Short version

- **Quality: no change.** Base Haiku, mistif 1.0.35 and mistif 1.0.36 scored the same at every level (99% of hidden checks passed overall; differences are one run in three). On Sonnet, base and 1.0.36 also tied.
- **No mistif skill loaded in any of the 286 runs.** On clear coding tasks with no hint to use a skill, installing mistif only adds its listing to the prompt.
- **Cost:** 1.0.36 costs +6% per run on Haiku (1.0.35: +10%). On Sonnet 1.0.36 cost +22%, because Sonnet made more tool calls with mistif installed (5.8 vs 4.2 per run).
- **Per-turn overhead (measured on the first prompt):** 1.0.35 added 1,167 tokens per turn over base, 1.0.36 adds 610. For comparison, superpowers 6.4.1 adds 2,165 and agent-skills 0.6.13 adds 3,807.
- **Routing (separate check):** for 10 clear requests, 3 runs each on Haiku, the matching skill loaded 21 of 30 times with 1.0.36, against 11 of 30 with 1.0.35.

## What changed in 1.0.36

- Each of the 11 skill descriptions is now one short line that starts with what the skill does.
- The 8 slash commands are hidden from the model's list (`disable-model-invocation: true`). People can still type them.

## Setup

- 22 tasks over 7 levels, from adding a small method (level 1) to a threaded job-queue security review and a JSON Patch engine built from a spec (level 7). Levels 1 to 5 and the level-7 review are the tasks of `2026-10-25-difficulty-bench`. Three tasks are new: an expression calculator from a spec (67 hidden tests) and a money package with bugs behind one failing test (level 6), and the JSON Patch engine (59 hidden tests, level 7). Every hidden suite was checked against a reference solution first.
- Five setups: base Haiku, mistif 1.0.35 on Haiku, mistif 1.0.36 on Haiku (3 runs per task each), base Sonnet and mistif 1.0.36 on Sonnet (2 runs per task each). 286 runs in total.
- Each run used `claude -p` in a fresh git folder, with only the plugin under test loaded and no prompt to use skills. The briefs said no user was available to answer questions.
- Scoring used measured facts only, with no LLM judge: hidden tests passed, planted defects found in reviews, and mutants caught by the tests the model wrote.

## Results

Score is the mean share of hidden checks passed; solved is the share of runs that passed every check.

| Level | Base Haiku | 1.0.35 Haiku | 1.0.36 Haiku | Base Sonnet | 1.0.36 Sonnet |
|---|---|---|---|---|---|
| 1 | 100 / 100% | 100 / 100% | 100 / 100% | 100 / 100% | 100 / 100% |
| 2 | 100 / 100% | 100 / 100% | 100 / 100% | 100 / 100% | 100 / 100% |
| 3 | 100 / 100% | 100 / 100% | 100 / 100% | 100 / 100% | 100 / 100% |
| 4 | 100 / 100% | 100 / 100% | 100 / 100% | 100 / 100% | 100 / 100% |
| 5 | 96 / 67% | 98 / 80% | 96 / 67% | 100 / 90% | 98 / 90% |
| 6 | 100 / 83% | 100 / 67% | 100 / 67% | 99 / 50% | 99 / 50% |
| 7 | 96 / 50% | 98 / 67% | 96 / 50% | 96 / 50% | 96 / 50% |
| **All** | **99 / 86%** | **99 / 89%** | **99 / 85%** | **99 / 89%** | **99 / 89%** |

Cost and work per run (estimated API price, all levels):

| | Base Haiku | 1.0.35 Haiku | 1.0.36 Haiku | Base Sonnet | 1.0.36 Sonnet |
|---|---|---|---|---|---|
| cost per run | $0.0084 | $0.0092 | $0.0089 | $0.084 | $0.103 |
| tokens per run | 127k | 142k | 136k | 72k | 86k |
| tool calls per run | 5.8 | 6.4 | 6.0 | 4.2 | 5.8 |

The only tasks any setup failed were the level-5 review (C5), the level-5 test-writing task (D5), the level-6 calculator (H6) and the level-7 review (C7), and each miss was one or two checks.

## What it means

- On clear, well-specified coding tasks, base Claude is already near the top of the scale, and mistif's skills are never used, so they cannot raise the score. The ladder did not find a level where base Haiku breaks down; it solved the new level-7 JSON Patch task in every run.
- 1.0.36 keeps mistif the leanest of the skill sets we measured. The Sonnet cost rise is the open problem: it comes from more tool calls, not from the listing size.
- Earlier reports found the only places mistif changed behaviour were vague requests (asking first) and decisions. This ladder does not test those.

## Limits

- 2 or 3 runs per cell; a one-run difference at a level is noise.
- Costs are estimates from token counts at API prices. The runs themselves used a Claude subscription.
- Python only, one repository layout per task family, and no vague or interactive tasks.
