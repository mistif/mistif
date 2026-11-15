# mistif:research deep mode, version 2 (1.0.40)

Same setup as [the 1.0.39 report](../2026-11-15-research/REPORT.md): Claude Haiku on the Claude subscription, WebSearch and WebFetch, one `claude -p` run per question in a fresh folder, scored by facts with no AI judge.

## Why a version 2

1.0.39 tied deep-research at 90% on the three held-out rundowns, but on harder questions it lost: its helpers could not search (they were `web-fetch` agents), Haiku often skipped the helper team altogether, and the reports missed whole authorities (one country's investigation, an appeal ruling) and specifics such as case numbers and totals. Version 2 copies what the strongest research agents do:

- **The mode is chosen first.** A request for depth starts the helper team before any search of its own. In tuning, the team then ran in 14 to 16 of 16 runs.
- **Helpers that can search.** There are 3 `general-purpose` helpers, each with 6 to 10 searches. They batch their searches and page reads and write their findings to notes files.
- **A source map.** Every body that keeps an official record is searched for by name, along with the press release for each long report, because long PDFs get cut off when fetched.
- **A specifics pass.** Case and report numbers, totals, and exact dates of each decision are listed and either sourced or searched for again.
- **An independent check.** A fresh agent that has not seen the research reads the draft and lists thin sections, missing authorities and claims without a source. One round of fixes follows.

## Fresh in-depth questions (4 new rundowns, 40 key facts, 4 runs each)

A helper wrote these questions after the deep-mode design was settled. The two cost-cut versions were then compared on these same questions. Neither changed what deep mode does, only its size, but the choice between them was made on this set.

| Setup | Score | Fully solved | Facts backed | Dead links | Cost per run | Time |
|---|---|---|---|---|---|---|
| Base | 52% | 0/16 | 59/84 | 2/88 | $0.022 | 38 s |
| mistif:research 1.0.39 | 73% | 0/16 | 113/117 | 2/95 | $0.098 | 162 s |
| deep-research | 89% | 6/16 | 136/143 | 14/241 | $0.299 | 230 s |
| v2 before cost cuts | 89% | 5/16 | 137/143 | 0/260 | $0.568 | 335 s |
| **v2, shipped** | **88%** | 4/16 | 137/140 | **2/220** | $0.437 | 259 s |
| v2 with compact notes | 87% | 2/16 | 137/139 | 3/222 | $0.397 | 262 s |

## Cost cuts

The first v2 cost almost twice as much as deep-research. Most of that came from two things: every helper agent pays about 30k tokens just to start, and the helpers spent a lot of output tokens writing notes. The shipped version made these changes:

- 3 helpers instead of 4;
- 6 to 10 searches each instead of 8 to 15;
- searches and page reads batched in one message;
- WebFetch asked only for the passages that answer the sub-questions;
- one check pass.

That cut cost by 23% for one point of score. Capping notes at 40 lines saved only another 9% and fewer runs got every fact, so it was left out.

## Short questions (15 held-out questions, 1 run each)

This check makes sure that putting deep mode first does not pull simple lookups into it.

| Setup | Score | Fully solved | Facts backed | Dead links | Cost per run | Time |
|---|---|---|---|---|---|---|
| mistif:research 1.0.39 (3 runs each) | 100% | 45/45 | 100/105 | 2/128 | $0.041 | 48 s |
| **v2, shipped** | **100%** | 15/15 | 34/35 | 1/48 | $0.049 | 72 s |

No short question started the helper team. The costliest run was $0.13.

## Read with care

- Haiku only, and small samples: 16 in-depth runs per setup.
- The three older held-out rundowns (R16h to R18h) and three tuning rundowns were used while building v2, so only the 4 fresh questions are reported, and the cost-cut choice was made on them too.
- deep-research still costs less ($0.30 against $0.44) and fully solves slightly more runs. v2's lead is in links: 2 dead against 14.
- The scorer checks that a fact appears on a cited page, not that the cited sentence states it.
