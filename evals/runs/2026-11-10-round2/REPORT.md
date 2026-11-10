# Round 2: sharpened skills and first-prompt routing (2026-11-10)

All runs used Claude Haiku on the Claude subscription (`apiKeySource: none`), scored by facts: hidden tests, mutants, browser measurements and regex keys, with no AI judge.

## Short version

- On six **held-out** tasks (built by helpers who never saw the skills or earlier keys, frozen before any run), 5 runs each, no hint:

| Setup | Score | Fully solved | Cost per run |
|---|---|---|---|
| Base Haiku | 83% | 6/30 | $0.014 |
| Sharpened, no router | 90% | 13/30 | $0.012 |
| **Sharpened + router** | **95%** | **21/30** | $0.015 |

- The router does not touch other work: on the eight level 1-4 coding tasks it loaded nothing and scored 100% like base, at about +6% cost.
- Interview (ask-first, round-2 data): base asked first 0/12 and captured 0.2 of 5 facts; sharpened mistif asked 12/12 and captured 3.9 (tuned personas) and 3.2 (two held-out personas; 1.0.36 got 2.3).

## Read with care

- **Noise scale is about 7 points.** Sharpened without the router beat base by 7 points while loading a skill in only 2 of 30 runs, so part of the base gap is chance. The clean comparison is router vs no router:
  - design 93 vs 85 (solved 5/10 vs 0/10, browser-measured): clear;
  - decide 98 vs 92 (all from X7h; the leaky volume key was rescored strictly and gave the same counts): probable;
  - review 94 vs 92, and worse on C4h (92 vs 100): **not shown**. Routed review answers are about 30% longer, which can help regex keys; the C7h hits that decided it were read and are real findings.
- **Real-world firing is low and unproven.** On 50 real first prompts the router fired twice (4%), both borderline app requests. It checks only the first prompt of a session. Not tested on Sonnet, where round 1 cost +22%.
- **Interview change touches the 1.0.35 planning lines.** Baseline, stop line and limits are no longer asked as questions; they go into the brief as assumptions and are asked only if a question is left over.
- Earlier report correction: the "21/30 vs 11/30 routing" figure in the 2026-11-09 report came from runs with `Skill` as the only tool and 2 turns; with full tools 0 of 286 runs loaded a skill unprompted.

## What changed

- interview: questions go to the facts that change the build (rules and numbers, data and where it may live, users and devices, outputs, what must never happen); at most five; a "yes" on a small brief also approves the plan.
- build (fix): after the first fix, read every module on the path to the wrong output and check it against its documented rules.
- test: cover every documented promise and its extremes (including exactness at huge values).
- design: 16 px body text, 44 px tap targets including footer links, no page wider than 375 px.
- decide: verify the plan's numbers against code, config and data; compute the net effect.
- ship and review: a few specific hunts (money/time edges, hidden tests, dropped columns; off-by-one limits, constant-time compares, races).
- router (in the ask-first hook, `MISTIF_ASK` controls it): clear review, decision or interface first prompts get one line asking to load `mistif:review`, `mistif:decide` or `mistif:design`. Build, test and ship are not routed.

## Tuned tasks (round 2, same tasks used for tuning; treat as optimistic)

Hinted sharpened 94% vs base 88% over 16 tasks (29/48 vs 21/48 solved). Hinted 1.0.36 was 88% (16/48): unsharpened, the build and test skills made level-8 results worse (bug fix 73% vs 94%).
