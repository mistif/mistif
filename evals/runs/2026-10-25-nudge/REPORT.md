# Nudge: does one line in the system prompt make Claude load a mistif skill?

Haiku, headless `claude -p`, the plugin loaded as a local folder, project settings only (no user plugins or hooks), tools Read, Write, Edit, Glob, Grep, Bash, Skill. Four everyday briefs with no mention of skills, 4 runs per brief and arm: nudge on vs `MISTIF_NUDGE=off`. 32 runs. Counted from the stream events.

Briefs: a small build with a clear spec (a word-count CLI with tests), a bug fix (failing test, wrong discount), a review of the last commit (SQL built by string joining), a vague request ("add some kind of notifications to my app").

| Brief | Skill loaded, off | Skill loaded, on | Which skill (on) |
|---|---|---|---|
| build | 0 of 4 | 4 of 4 | build |
| bug fix | 0 of 4 | 4 of 4 | build |
| review | 0 of 4 | 4 of 4 | review |
| vague | 0 of 4 | 4 of 4 | interview |
| all | 0 of 16 | 16 of 16 | |

- Vague brief: asked a question before writing any code in 4 of 4 runs with the nudge, 0 of 4 without (all four wrote code at once).
- Cost as reported by the CLI, 16 runs per arm: $0.067 off, $0.084 on. Tokens read and written, cache included: 1.29M off, 1.63M on (about 26% more, the skill text).
- Not measured: whether the work was better. The skills load; this does not show the output improves, only that the skills now get used. Four runs per cell and one model, so read the counts as facts about loading, not as a quality score.
- The model did see the line: asked to quote it, it did with the nudge on and said NONE with it off.

Decision: nudge stays on by default; `/mistif:nudge off` or `MISTIF_NUDGE=off` turns it off.
