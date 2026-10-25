# Interview reachability: interactive test (2026-10-25)

Plugin `mistif` 1.0.19 -> 1.0.20. Harness `sim.py` (runs and simulator), `analyze.py` (tables), `hidden/personas.json` (4 personas x 5 facts, never in a run's folder), `variants/` (D2, D3, D4 skill text), `results/` (every dialog, turn, tool call, judgment), `pilot/` (first probes, not counted).

## How it was tested

- Headless `claude -p --output-format stream-json`, clean profile (`--setting-sources project`, only the plugin under test via `--plugin-dir`), Haiku and Sonnet. AskUserQuestion does not exist in headless mode (the model says so and asks in plain text), so a question = a final message containing "?" and no code write; the answer comes from a fresh Haiku call that plays the persona (reveals a fact only if the question touches it), and the next turn uses `--resume <session id>`. At most 6 answers.
- A run is cut at the first code write (Write/Edit of a non-.md file, or a file-creating Bash command), so cost is the cost up to that point, not of the build. Cost is token-priced from the stream (an estimate); simulator and judge calls are not in it (they were small).
- Facts: Sonnet reads the dialog and says which of the 5 persona facts the assistant's own restatement or brief states (questions and the person's words do not count). One-at-a-time: Sonnet counts distinct questions per asking turn (a question with its options and guess is one).
- Arms: **primed** (prompt starts with "look at the skills you have and use the one that fits", as in the earlier harness) and **unprimed** (just the persona's opening line, as a real user would type it). Per cell 4 personas x 2 runs = 8. Two Haiku/A primed runs were lost to a harness error (n=6).
- Designs: **A** plain Claude. **D1** main: vague-request line first in `build` and `mistif`. **D2** `mistif` entry carries an 8-line interview and `build` points to it; `interview` keeps the long text. **D3** D2 + `interview` description "Use first whenever the request does not say what to build, for whom, or what done means". **D4** (the one fix) D3 + the `interview` clarify mode capped at five questions, ends with a one-paragraph brief and a "done means" list, then hands to `build`.

## Result, primed (asked before building / mean question turns / one at a time / ended by hitting the 6-round cap / facts of 5 / brief / acceptance list / cost)

| model | design | asked before build | Q turns | one at a time | cap hit | facts /5 | brief | accept | cost $ |
|---|---|---|---|---|---|---|---|---|---|
| Haiku | A | 0/6 | - | - | 0 | 0.33 | 3/6 | 0/6 | 0.02 |
| | D1 | 4/8 | 4.8 | 2/4 | 0 | 1.38 | 4/8 | 3/8 | 0.03 |
| | D2 | 5/8 | 3.4 | 4/5 | 0 | 1.00 | 4/8 | 3/8 | 0.03 |
| | D3 | 7/8 | 6.4 | 3/7 | **5** | 2.75 | 7/8 | 5/8 | 0.03 |
| | **D4** | **8/8** | 4.6 | 7/8 | 0 | **3.12** | 8/8 | 8/8 | 0.03 |
| Sonnet | A | 0/8 | - | - | 0 | 0 | 0/8 | 0/8 | 0.07 |
| | D1 | 8/8 | 4.3 | 4/8 | 0 | 3.12 | 8/8 | 7/8 | 0.09 |
| | D2 | 8/8 | 4.0 | 5/8 | 0 | 2.38 | 8/8 | 7/8 | 0.10 |
| | D3 | 8/8 | 4.4 | 5/8 | 1 | 2.88 | 8/8 | 8/8 | 0.10 |
| | **D4** | 8/8 | 4.0 | 6/8 | 0 | 3.00 | 8/8 | 8/8 | 0.10 |

Files written before the interview ended: 0 in every run that asked (the cut fires on the first code write, which always came after the last answer). Plain Claude (A) built at once in every run, 14 of 14.

## Result, unprimed (what a real user gets)

| model | design | asked before build | skill reached |
|---|---|---|---|
| Haiku | A, D1, D2, D3, D4 | 0/8 each | none, in 40 of 40 runs |
| Sonnet | A | 0/8 | none |
| | D1 | 4/8 | interview 2 |
| | D2 | 4/8 | interview 2 |
| | D3 | 6/8 | interview 5 |
| | D4 | 5/8 | interview 3 |

## Unattended (original T1 brief + "no user, state your assumption and continue"), one run per design and model

Unprimed: all 8 built the app (A, D1, D2, D3 on both models), no skill loaded. Primed: A, D1, D2, D4 built on both models; D3 Haiku did not build (one of 10). **The unattended rule does not hold**: when the brief itself says "continue", the model builds, even after loading `build` and reading "build nothing".

## Decision

**D4 wins on what it can reach.** Primed, it is the only design with 16/16 asked-before-building, no run hitting the round cap, a brief and an acceptance list in 16/16 and the best Haiku facts score (3.1 vs 0.3 for plain Claude, 2.75 for D3). Its Haiku gain over D3 comes from the cap: D3 asked in 7/8 but 5 of those never finished within 6 rounds. D1 vs D2 vs D3 vs D4 on Sonnet are inside the noise (facts 2.4-3.1, n=8); the real separations are Haiku reach (D1 4/8, D2 5/8, D3 7/8, D4 8/8) and the cap. A 2-run persona cell moves a lot; treat 1 of 8 as no difference.

**What D4 does not do** (plainly): it does not make an unprompted user's vague request reach an interview. Unprimed, Haiku never loads a skill under any design, so it equals plain Claude (0/8); Sonnet reaches it 5/8 (D3 6/8) against 0/8 for plain Claude. Descriptions help Sonnet only. The unattended case is not solved by wording (9 of 10 built). D2's short entry-skill interview was rarely used: models choose `interview` by its description, not the entry skill, so the short text that worked had to be in the interview skill itself. Facts scores stay near 3 of 5 because the simulator only reveals what is asked and the models ask four questions.

**Proposed next, not built** (needs a hook and the mods validator rules): a UserPromptSubmit hook, or the Lite-style line the effort mod already puts in the system prompt, that on a first message with no repo files adds "if the request does not say what, for whom or what done means, ask one question before writing any file", plus a PreToolUse hook that blocks Write/Edit of code until a brief exists in the conversation; and for unattended runs a flag (the `-p` print mode) that makes the line say "return the brief and stop". Those are the only designs that do not depend on the model choosing to load a skill.

## Changed wording (final)

- `mistif` entry: first block = the vague-request interview (ONE question per turn, at most five, a default each, stop at a one-paragraph brief plus "done means" list, show it, ask "Right?", hand to `mistif:build`) and an unattended line (return brief, acceptance list and assumptions, say how to continue). The routing table row for "vague" points at it.
- `build` first line: vague request -> load `mistif:mistif` and run its short interview; unattended -> build nothing, return a brief.
- `interview` description: "Use first whenever the request does not say what to build, for whom, or what done means; also for a spec or a written quality bar. Asks one question at a time, then saves a short result. Not for trivial asks or plain questions." Clarify mode: at most five questions, ends with brief plus "done means" list, then hands to `build`.

Listing size (description characters): interview 251 -> 227, mistif 191 -> 191, build 211 -> 211 (total listing -24). File sizes: mistif 3143 -> 3810, interview 6757 -> 6965, build 7954 -> 7968.

## Worse, or not proven

- The entry skill grew 667 characters. Primed D4 costs about 3x plain Claude in tokens up to the first write (156k vs 37k Haiku; $0.03 vs $0.02 Haiku, $0.10 vs $0.07 Sonnet) because it talks before it builds.
- One-at-a-time is only 6-7 of 8 for D4; some turns still pack two topics.
- Limits: 2 runs x 4 personas per cell, token-priced cost, Sonnet as the facts judge (not Opus), a Haiku-played persona, one design change after seeing scores (D4, no re-tuning). Five Haiku/A runs errored in a 5-way parallel batch (a harness process kill) and were rerun serially.
