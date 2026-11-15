# mistif:research vs base and Anthropic's deep-research skill (2026-11-15)

All runs used Claude Haiku on the Claude subscription (`apiKeySource: none`) with WebSearch and WebFetch, one `claude -p` run per question in a fresh folder, and a one-line instruction to use the skill under test. Scored by facts, no AI judge.

## Questions

- **Held out:** 18 questions written and verified by a helper that never saw the skill, frozen before any run. 6 lookups (one name, number or date, two hops), 6 multi-fact questions (4 facts each), 3 false-premise questions, 3 in-depth rundowns (10 key facts each). 65 facts, 56 with a primary source.
- **Tuning:** 9 separate questions of the same kinds, built by another helper. Every change to the skill was made on these.

## Scores

- **score**: share of key facts in the answer (regex per fact; report files the run wrote are included).
- **backed**: facts in the answer that also appear on at least one page the answer cites (fetched afterwards).
- **dead links**: cited links that return 404/410 or do not resolve.

### Short questions (15 held-out questions, 3 runs each)

| Setup | Score | Fully solved | Facts backed | Dead links | Cost per run | Time |
|---|---|---|---|---|---|---|
| Base | 99% | 44/45 | 91/104 (88%) | 12/158 | $0.020 | 18 s |
| **mistif:research** | **100%** | **45/45** | 100/105 (95%) | **2/128** | $0.041 | 48 s |
| deep-research | 100% | 45/45 | 103/105 (98%) | 8/296 | $0.089 | 110 s |

### In-depth rundowns (3 held-out questions, 3 runs each)

| Setup | Score | Facts backed | Dead links | Cost per run | Time |
|---|---|---|---|---|---|
| Base | 72% | 52/65 | 1/75 | $0.049 | 45 s |
| mistif:research, first deep mode | 82% | 65/74 | 2/86 | $0.183 | 183 s |
| **mistif:research, final** | **90%** | 73/81 | **0/74** | $0.153 | 173 s |
| deep-research | 90% | 77/81 | 4/162 | $0.375 | 239 s |

Most dead links were real news pages since removed; a few were sites this network could not resolve. None were checked as invented.

## What changed during tuning

- Helpers were reading single pages; the skill now allows one `web-fetch` agent for reading several pages and no other agents below a survey.
- The first deep mode lost to deep-research (82% vs 90%) because its report summarised away facts its helpers had found (800 to 2,000 words against about 3,000). The final version has each helper write its full ledger to a notes file and the report carry over every sourced fact.

## Read with care

- The last deep-mode change was made after looking at how the held-out in-depth runs behaved (searches, report length), not their answers; on the tuning set it scored 98% vs 98% for deep-research.
- Small samples: 9 in-depth runs per setup. Haiku only, not tested on Sonnet.
- Short held-out questions were run on the version before the final deep-mode change, which only touches deep mode.
- The scorer checks that a fact appears on a cited page, not that the cited sentence states it.
- The skill's own citation checker (`scripts/check_cites.py`) was never run by the model in these runs; it re-checked by opening pages instead.
