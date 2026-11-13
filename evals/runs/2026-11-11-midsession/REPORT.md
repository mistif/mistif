# Mid-session routing (2026-11-11)

Does routing still help when the request is not the first message? Same six held-out tasks as round 2, Claude Haiku on the subscription (`apiKeySource: none`), 5 runs each, scored by facts (hidden keys, browser measurements), no AI judge.

Each run is one session, one process, two turns: first "give me a short overview of this repository, do not change anything yet", then the task brief unchanged.

## Result

| Setup | Score | Fully solved | Cost per run |
|---|---|---|---|
| Base | 89% | 14/30 | $0.011 |
| 1.0.38, routing off | 88% | 14/30 | $0.011 |
| 1.0.38, routing on every prompt | 89% | 15/30 | $0.013 |

- The router fired as designed: the matching skill loaded in 25 of 25 routed runs (U4h's brief is 163 words, over the 120-word limit for later prompts, so it was not routed, as intended).
- On the five routed tasks: 91% with routing vs 89% without and 90% for base, inside the ~7-point noise. Cost +22%.
- Compare round 2, where the task was the first message: base 83%, routing 95% (21/30 solved).

## What it means

- Base rose from 83% to 89% just by having read the repository first. The skills' gain in round 2 came mostly from cold starts; once the model has looked around, loading the skill adds little.
- Routing later prompts is not worth shipping on this evidence: same score, more cost.

## Limits

One warm-up kind (a repo overview); a real session's earlier turns may differ. Haiku only. 5 runs per cell.

## Outcome

1.0.38 keeps routing on the first prompt only. It keeps the tighter patterns written for this test (no routing for casual "should I" questions, links, or prompts that name a skill or slash command; more ways of asking for UI and review). All six held-out briefs route as before.
