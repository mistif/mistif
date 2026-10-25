# Evals

Written reports of the blind tests run while building mistif. Only the reports are kept here: raw run outputs, answer keys, screenshots and the harness scripts are left out to keep the repository small, so the reports are evidence to read, not tests you can re-run from this folder.

How to read them:

- "Old" and "new" in the early reports mean mistif's earlier plugins (not published) against the current skills. Skills they mention that no longer exist were removed before this release.
- Each run was small: a handful of tasks, usually 2 runs per cell, one or two LLM judges that did not see which side wrote what. Treat the numbers as a strong hint, not proof. Scores are 1 to 5 unless stated.
- Files named in the reports (`summary.json`, `judge/`, `outputs/`, scripts) are not in this repository.

| Report | What it measured |
|---|---|
| `runs/2026-10-23/README.md` | first pairwise checks of the merged skills |
| `runs/2026-10-23-full/README.md` | 32 tasks, new vs old skills, Sonnet writers, Opus judges |
| `runs/2026-10-23-heldout/README.md` | the same on prompts no skill was tuned to |
| `runs/2026-10-24-retest/README.md` | re-run of the new side after fixes |
| `runs/2026-10-24-test/README.md` | the testing skill against broken code and hidden test suites |
| `runs/2026-10-25-phase1/REPORT.md` | skills vs no skills across Haiku, Sonnet and Opus; Full vs Lite usage |
| `runs/2026-10-25-retest/REPORT.md` | re-test of the Phase 1 fixes on fresh briefs |
| `runs/2026-10-25-interview/REPORT.md` | the interview skill with a simulated user, four designs |
| `runs/2026-10-25-nudge/REPORT.md` | Haiku loading mistif skills unprompted, nudge on vs off |
| `runs/2026-10-25-public-bench/REPORT.md` | public mistif vs base Haiku, base Sonnet, superpowers, agent-skills and the old mistif set, 324 runs; the nudge cost and the design-page loss |
