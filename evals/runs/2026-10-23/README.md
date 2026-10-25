# Blind test, old skill set vs new set (2026-10-23)

Tested build: an earlier build.

## Setup
Six Sonnet agents, one per task and skill set, each told to read only its set's skill files and follow them. No user was available, so assumptions were stated instead of asked. Outputs were labelled X/Y at random; a judge from a different tier (Opus) scored them without knowing which set made which. Mapping (kept out of the judge's view): A-X new, A-Y old, B-X old, B-Y new, C-X new, C-Y old.

| Task | Old set | New set |
|---|---|---|
| A. Add `top_words(text, n)` with tests (small repo) | using-agent-skills, plan-work, build-work, test-first | mistif, mistif:build |
| B. Review a patch with 9 planted issues | using-agent-skills, code-review-and-quality, security-and-hardening | mistif, mistif:review |
| C. Shape "an app to help my team stop forgetting things" (first reply) | using-agent-skills, interview-me, idea-refine | mistif, mistif:interview |

## Result (judge scores: substance / discipline / concision, 1-5)
| Task | New | Old | Winner | Tokens new vs old |
|---|---|---|---|---|
| A | 4 / 5 / 5 | 4 / 4 / 4 | new | 82.2k vs 89.8k |
| B | 5 / 5 / 4 | 5 / 4 / 2 | new | 87.7k vs 100.7k |
| C | 4 / 4 / 4 | 5 / 5 / 4 | old | 79.5k vs 89.5k |
| Total | | | new 2 of 3 | 249.4k vs 280.0k (new 11% lower) |

- A: both pass the hidden correctness check. The old set added an unrequested `ValueError` for negative n.
- B: both found 9 of 9 planted issues with no false findings. The old review was padded (a STRIDE section, a verification story, repeated refund points).
- C: the new reply leaked internal vocabulary ("clarify mode") and added a "Not checked" footer; the old reply asked a sharper question and questioned whether an app is the answer. **A real defect to fix:** `mistif:interview` should name its mode in plain words (or not at all in the user-facing reply), and the entry skill's coverage line should not appear in a first-turn question.

## Limits
One run per cell, three tasks, one judge, token counts include each agent's base context (about 75k each). Treat as a signal. Gate 2 asked for "at least as good at lower or equal tokens": met on average, not on task C.

Files: `A-X.diff`, `A-Y.diff`, `B-X.md`, `B-Y.md`, `C-X.md`, `C-Y.md`, `judge.md`; inputs `orders.patch`, `A_start_textstats.py`, `A_check.py`.
