# Tests

`claude plugin test .` (set `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1`). Nothing here calls a model: every model reply is stubbed.

- `effort.test.ts`: what is left of Effortless's own suite (MIT, HeyCubit), adapted to this plugin: the judge and the
  effort it applies, follow-ups, named levels, the cache countdown, the handoff, and the benchmark helpers. The suites for
  the screens, setup guide, update card, agent panel, themes and the second judge are gone with that code.
  - The cache countdown is read through `/mistif:hud debug` (the numbers the hud module draws), since the footer is not ours.
- `effort-changes.test.ts`: what mistif changed. The defaults (the chat compacts itself, effort never below medium), no log
  files, nothing added to Claude's prompt, the footer and band left to the hud module, settings of removed features ignored,
  `bench mine`, and the short-message rules.
- The handoff tests cover the ask-first rule: a written handoff clears nothing until "Clear & carry on" is pressed, and
  "Keep chat & copy" and "Not now" leave the chat alone, on desktop and on the terminal.
- All tests pass. (Three failed on the untouched Effortless 1.71.0; they tested screens that are gone, or are fixed here.)
- `lean.test.ts`: lean mode (`/mistif:lean`): off by default, one session section per level, the level kept between sessions, the hud's level buttons and Review/Audit buttons, and the band's own token count (nothing read from another plugin).
- `explain.test.ts`: the note above the prompt (saved line, model asked once, cleared by plain text, unknown name). `explain_script_test.py` tests `explain.py` against a made-up home folder (worktrees, unregistered `local-marketplaces` folders, stale cache versions, switched-off plugins, lookup order); run it with `python -m unittest tests/explain_script_test.py`, since a test file here cannot start a process.
- `agents.test.ts`: the agents pane opens with the first running subagent, lists it, and closes a while after the last one ends.
- Timing: no test waits on real time. The cache countdown tests move the mocked clock, and keep the jumps short because every simulated minute runs the mod's 15 s timers.
- `update.test.ts`: `/mistif:update` and `check`: already latest, updated, `claude` missing, a failing command, newer / not newer (compared as numbers); process.run and the file reads are stubbed, the real update is never run.
