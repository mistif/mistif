# Full blind test: old skill set vs new set (2026-10-23)

Build tested: an earlier build for the 32 main runs.

## Setup
- 8 tasks, one per new skill. 2 sides (old set, new set) x 2 runs each = 32 runs, all Sonnet, each told to read only its set's skill files and follow them. No agent was allowed to spawn anything; where a method would fan out, it wrote `AGENTS_I_WOULD_SPAWN: N` instead (so "agents spawned" below is that number).
- Labels R01..R32 were shuffled. Four Opus judges (a different tier from the Sonnet writers) scored each output 1-5 on four stated criteria per task, seeing only outputs and the criteria. Answer keys are in `ANSWER-KEY*.json`, written before judging and not shown to judges. Judge briefs and raw JSON: `judge/`. Run prompts: `prompts/`. Outputs: `outputs/`. Fixtures and scripts: `inputs/`.
- Old set per task: T1 using-agent-skills + interview-me + idea-refine; T2 + plan-work, build-work, test-first; T3 + code-review-and-quality, security-and-hardening; T4 + shipping-and-launch; T5 antislop + antislop-ui + ui-ux-pro-max + taste-skill; T6 llm-council (cheapest form); T7 prompt-master; T8 using-agent-skills only. New set: `mistif` (entry) + the matching role skill (`lean-agents` for T8).
- Token figure = the subagent total reported by the harness (input and output are not reported separately; it includes about 75k of base context per agent).

## Results (mean of the judge's four criteria, 1-5)
| Task (new skill) | Old mean | New mean | Winner | Tokens old | Tokens new | Agents it would spawn (old / new) |
|---|---|---|---|---|---|---|
| T1 shaping (mistif:interview) | 3.25 | 4.38 | new | 90.2k | 80.0k | 0, 0 / 0, 0 |
| T2 build (mistif:build) | 4.00 | 4.25 | new | 91.8k | 83.5k | 0 / 0 |
| T3 review (mistif:review) | 3.75 | 4.50 | new | 101.0k | 88.3k | 0 / 0 |
| T4 ship check (mistif:ship) | 4.38 | 4.12 | old | 87.9k | 84.6k | 0 / 0 |
| T5 UI page (mistif:design) | 4.12 | 3.88 | old | 155.2k | 86.7k | 0 / not stated |
| T6 decision (mistif:decide) | 3.88 | 4.88 | new | 83.2k | 84.0k | 1 / 0 |
| T7 prompt (mistif:prompt) | 4.12 | 4.62 | new | 85.9k | 81.2k | 0 / 0 |
| T8 fan-out (lean-agents) | 4.62 | 4.75 | new | 81.5k | 79.9k | 0 / 0 |
| **Overall** | **4.02** | **4.42** | **new 6 of 8 tasks** | **97.1k** | **83.5k (-14%)** | |

Run-level: comparing every new run with every old run of the same task, new won 20, old 7, 5 tied.

Per-run scores, tokens and the judge's one-line notes are in `summary.json` and `judge/*.json` (decode with the answer keys; `inputs/analyze.py` reproduces the table).

Always-loaded listing (name + description characters): the old set is 12,761 (24 workflow skills 8,972 + 14 older skills 3,789); the new 9 skills are 2,250 (82% smaller). Today both load, so the live listing is 15,011 until the old skills are retired.

## Where the old skill won, and why
- **T5 UI page (old 4.12 vs new 3.88).** The old stack (taste-skill, ui-ux-pro-max, antislop) produced the most distinctive page (a drawn loaf, an order builder that writes the email). The new `mistif:design` alone produced one clean but template-like page (distinctiveness 2 of 5). It costs 44% fewer tokens (87k vs 155k), because the old stack loads about 30k tokens of skills and uses tools.
- **T4 ship check (old 4.38 vs new 4.12).** The new reports were the longest (1,246 and 1,396 words against 841 and 1,137), opened with a "Mode: check" label, and one ranked the committed live payment key as should-fix instead of blocker. The difference between the two sides is within the run-to-run spread (the new runs scored 3.75 and 4.5).
- T1: the old replies used uppercase mode labels and process footers; the new ones read more like a person. Note that one new reply also carried the test-harness footer line, which the judge penalised on both sides.
- T8: **no measured edge for `lean-agents`.** Both sides declined the six-agent fan-out and did the job inline (0 agents). The base model already pushes back here; this task does not show the skill stopping anything. A harder trap (a case where the model would otherwise fan out) is needed to test it.
- T6: the old `llm-council` quick form (one agent) lost mainly on a runway arithmetic error and a long layout; the new runs averaged 5.0 and 4.75.

## Fix and one re-test (as requested)
Two skills lost. General fixes (not tailored to the task text): `mistif:ship` opens with the verdict, treats a committed secret, an irreversible data change with no backup and skipped tests of the security-critical part as blockers, keeps the report to about 500 words, and does not name its mode as a label; `mistif:design` requires one sentence naming what the client is plus one concrete visual idea carried by a real element before building. Re-test: two new runs of T4 and T5 each, judged blind together with the same old outputs under new labels (`outputs_retest/`, `ANSWER-KEY-retest-judging.json`).

| | Old mean | New mean (after fixes) | Tokens old / new |
|---|---|---|---|
| T4 ship | 4.12 | **4.50** | 87.9k / 83.4k (reports now 570 and 659 words) |
| T5 design | 3.75 | 3.62 | 155.2k / 88.9k |

Ship now wins. Design is still marginally behind (a gap smaller than the spread between the two new runs, 3.75 vs 3.5), and the judge scored the old pages lower this time (3.75 vs 4.12 before), which shows how much judge noise there is on UI. In the re-test judge's notes, three of the four pages clipped content at 390 px (one old, two new) and the fourth clipped its nav and hours times, so mobile layout did not separate the sides. Caveat: the screenshots come from headless Chrome, which may enforce a minimum window width, so the 390 px shots are not fully trustworthy. Not re-tested again, per the one-re-test rule.

## Other findings
- Several new build outputs also began with a "Mode:" line (judge notes on T2). The same plain-words fix was applied to `mistif:interview`  and now `mistif:ship` and `mistif:design`; `mistif:build`, `mistif:review` and `mistif:decide` still say "say it in one line". Proposed, not applied (it would be an untested change): use the same wording there.
- The judge sometimes penalised a footer that came from the test harness's own `AGENTS_I_WOULD_SPAWN` instruction, on both sides.

## Limits
Two runs per cell, one judge per task pair, the judge also sees criteria I wrote, tasks are small, Sonnet only, scores are discrete (whole numbers per criterion) so a 0.25 gap is one point on one criterion. Token totals include the 75k base context of each agent, which compresses relative differences. Treat per-task winners as signals; the overall direction (new at least as good, 14% cheaper) is the stronger claim.

## Correction (added later the same day)
The 390 px screenshots in this test (and the 'clipped at 390 px' notes) were an artifact: headless Chrome enforces a minimum window width, so the narrow shots were rendered wider and cropped. Rendered in a real 390 px iframe, the pages checked (R24-type, S03) do not clip. The 'mobile' criterion scores for T5 therefore reflect screenshot error on both sides equally; the T5 comparison above should be read with that in mind. The held-out test uses real 390 px frames.
