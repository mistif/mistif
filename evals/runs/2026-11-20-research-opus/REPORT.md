# mistif:research on Opus, the issue log and fallbacks (1.0.41)

Same setup as [the 1.0.40 report](../2026-11-15-research-v2/REPORT.md): the same 4 fresh in-depth questions (40 key facts), one `claude -p` run per question in a fresh folder, Claude subscription, scored by facts with no AI judge.

## Opus (2 runs per question)

| Setup | Score | Fully solved | Facts backed | Dead links | Cost per run | Time |
|---|---|---|---|---|---|---|
| Base | 75% | 1/8 | 7/60 | 0/4 | $0.16 | 80 s |
| mistif:research 1.0.40 | 85% | 5/8 | 63/68 | 0/140 | $3.26 | 777 s |
| **with foreground helpers** | **99%** | **7/8** | 65/79 | **0/160** | $4.27 | 952 s |
| deep-research | 96% | 5/8 | 73/77 | 2/155 | $3.62 | 601 s |

In 1 of the 8 runs of 1.0.40, the lead started its helpers in the background and ended its turn to wait. In a headless run (`claude -p`, the SDK) that ends the session, so the run wrote no report and scored 0%. 1.0.41 starts helpers with `run_in_background: false`, which is what deep-research does: they still run in parallel, but the lead cannot stop before they report. There were no cut-offs afterwards.

The bench crashed while saving the first 24 Opus results (it had no Opus price entry). Each result was rebuilt from Claude Code's saved session transcript, which records the real total cost and duration. Nothing was re-run or estimated.

## The issue log

In deep mode, each helper now ends its notes with an `## Issues` list. The lead merges those with its own into `research/<slug>/notes/issues.md`, one line per problem: kind, step, URL, what happened and what was tried instead. In 8 Haiku runs it recorded 252 problems:

- not found: 67;
- sources disagree: 56;
- snippet only, page not opened: 38;
- blocked: 26;
- PDF not read: 17;
- dead link: 15;
- search budget ran out: 14;
- tool error: 13.

These led to fallbacks for blocked, dead and PDF pages, a separate page-read allowance for helpers, and up to 4 extra searches for gaps.

The log then showed that two of those fallbacks can never work in Claude Code:

- WebFetch refused all 64 attempts on web.archive.org.
- Reading a saved PDF failed every time, because it needs a PDF renderer (poppler) that was not installed.

1.0.41 drops the archive fallback and tries a saved PDF at most once. Archive fetches went from 102 to 0.

## Haiku

| Setup | Runs | Score | Fully solved | Facts backed | Dead links | Cost per run | Time |
|---|---|---|---|---|---|---|---|
| Base | 16 | 52% | 0 | 59/84 | 2/88 | $0.022 | 38 s |
| A generic research-skill outline (user-supplied) | 8 | 71% | 0 | 47/57 | 1/70 | $0.052 | 65 s |
| mistif:research 1.0.40 | 16 | 88% | 4 | 137/140 | 2/220 | $0.437 | 259 s |
| with fallbacks, before the trim | 16 | 86% | 3 | 135/138 | 0/245 | $0.413 | 306 s |
| **1.0.41** | 8 | **92%** | 3 | 71/74 | **0/120** | $0.478 | 299 s |
| deep-research | 16 | 89% | 6 | 136/143 | 14/241 | $0.299 | 230 s |

The generic outline (clarify, split into sub-questions, search, weigh sources, cite, deliver) roughly matched 1.0.39 at half its cost, but it rarely started helpers. It also did not require opening each page, so 10 of its 57 facts were not on any page it cited.

## Read with care

- Small samples: 8 runs for 1.0.41 on Haiku, and 8 runs per setup on Opus. One run moves a score by about 12 points.
- The Opus row for foreground helpers was run before the issue log and fallbacks were added. 1.0.41 as shipped was tested on Haiku only.
- These 4 questions were also used to choose between versions in 1.0.40 and here, so they are no longer fully held out.
- The scorer checks that a fact appears on a cited page, not that the cited sentence states it.
