# mistif

A Claude Code plugin marketplace with one plugin, `mistif`: a small set of workflow skills, a few commands, and some mods that watch cost and effort. Everything is invoked as `/mistif:<name>`.

## Install

In Claude Code:

```text
/plugin marketplace add mistif/mistif
/plugin install mistif@mistif
```

Update later with `/mistif:update`, or by hand with `/plugin marketplace update mistif`, then `/plugin update mistif@mistif`. The skills and commands work in any Claude Code that supports plugins. The mods (below) use Claude Code's mod API; if your build does not load them, the skills and commands still work.

## What is in it

**Skills** (they load by their description; you can also call them by name):

| Skill | Use it to |
|---|---|
| `mistif:mistif` | pick the next step of a software task (clarify, plan, build, review, ship, design, decide) and the cheapest way to do it |
| `mistif:interview` | ask a few questions one at a time when a request does not say what to build, for whom, or what done means, then save a short brief |
| `mistif:build` | plan, write, test, repair or tidy code (machine-flavoured comments too), or check a framework's current docs |
| `mistif:test` | write or repair tests, prove they can fail, run them |
| `mistif:review` | review a diff or PR, check security, find why something is slow, verify UI in a real browser (read-only unless asked) |
| `mistif:ship` | go/no-go before release, CI/CD, logging and alerts, retiring something, git workflow (never pushes or deploys without a yes) |
| `mistif:design` | build or restyle UI and interface text, phone layouts, usability |
| `mistif:decide` | stress-test a real decision with several lenses; ends GO, TEST FIRST or NO-GO plus the cheapest test |
| `mistif:prompt` | write one ready-to-paste prompt for a named AI tool |
| `mistif:lean-agents` | decide whether to spawn subagents at all, how to brief them, and print a cost estimate first (default: inline or one agent) |
| `mistif:which-tool` | recommend which installed skill, plugin or command fits what you are doing |

**Commands:** `/mistif:spec`, `/mistif:plan`, `/mistif:code-simplify`, `/mistif:credits`, `/mistif:hud`, `/mistif:lean`, `/mistif:nudge`, `/mistif:update`.

**Mods** (hooks that run inside Claude Code):

- **hud**: one band above the prompt with the lean level, a cost graph, tokens and limits, plus a settings card (`/mistif:hud`).
- **effort**: chooses the reasoning effort per prompt, offers a handoff when a chat gets long (it asks before it clears the chat), shows the prompt-cache countdown. A cut-down adaptation of Effortless (see Credits).
- **explain**: when you type a `/command`, a short plain-words note about what it does appears above the prompt.
- **agents-pane**: `/agents-pane` lists running subagents.
- **lean mode**: `/mistif:lean off|lite|full|ultra` adds a short section to the system prompt that asks for the smallest complete change, reuse before writing, and a short reply that says what was skipped. Off by default.
- **nudge**: `/mistif:nudge off|on` adds one short line to the system prompt asking Claude to check whether a mistif skill fits before software work and load it. Models rarely load a skill on their own. On by default (Haiku loaded a mistif skill in 16 of 16 runs with it and 0 of 16 without, see [evals/](evals/README.md)); `MISTIF_NUDGE=off|on` in the environment overrides the saved choice.
- **update**: `/mistif:update` refreshes the marketplace and updates mistif to the latest version (then restart Claude Code); `/mistif:update check` only says whether a newer version exists. It runs `claude plugin marketplace update` and `claude plugin update` for you, and prints those two commands if `claude` cannot be run.

**Usage: Lite.** A plugin option (`usage`, default `full`). With `lite`, one short line is added to the system prompt so the skills take their short path: inline or one agent, no peer review, short outputs.

### What the mods read, write and call

- **Effort** sends text to a small model (Haiku) in two ways. On every prompt you type (unless Auto is off: the ⏻ button in the hud, or `/mistif:hud auto`) it sends that prompt and a few recent messages so the judge can pick an effort. Separately, once the chat passes about 30% of its context it also checks whether a fresh chat would serve better, sending your first message, up to seven earlier messages (160 characters each), the tail of the last reply and your next message. Set the plugin option `contextCheck` to `off` (or use the Handoff card in the settings) and that check is never made.
- **Handoff**: a quick handoff on a chat whose cache has gone cold sends the whole chat (tool output shortened) to Haiku to write the summary. Choose a Full handoff with your own skill (the `handoffSkill` option) to avoid that; there is no other switch.
- **Explain** sends the name and description of a `/command` you type to Haiku to get a plain-words line.
- The settings card edits your Claude Code `settings.json` (plugin options only) and writes a backup next to it first.
- The which-tool skill can show how often you used each skill. That reads your session files under `~/.claude/projects` and caches counts in `~/.claude/mistif-usage.json`. It is **off** unless you set the environment variable `MISTIF_USAGE=1`.
- Apart from those model calls, which go through your own Claude Code login, nothing is sent anywhere, and there is no telemetry.
- `/mistif:update` runs the normal plugin update commands when you type it; nothing runs on its own.

## What we measured

Small blind tests with LLM judges: a few tasks, usually 2 runs per cell, scores 1 to 5. Read them as hints, not proof. A gap under about 0.4 is noise. The reports are in [evals/](evals/README.md); the raw runs are not included.

Gains:

- Phase 1 (Haiku, Sonnet and Opus; an earlier build, before 1.0.19): skills vs no skills **+0.33** (95% interval +0.16 to +0.50). Opus gained most (+0.53), Sonnet +0.32; Haiku's +0.15 is not distinguishable from zero. The gain was in fan-out, prompts and decisions; review, ship, UI and build were small or zero. Opus output was judged by a weaker model (Sonnet), so its numbers are less sure.
- Lite scored the same as Full (-0.03, interval -0.18 to +0.12) with about 17k fewer tokens per run on average; nearly all of that saving was on Opus (-39k), Sonnet -14k, Haiku about the same.
- Re-test on fresh briefs (1.0.19, 2 runs per cell): pages built with the design skill scored 1.4 to 1.9 points higher than without it (UI on Haiku, Sonnet and Opus judged by Sonnet; one 3D page on Sonnet), and the lean-agents skill cut subagent fan-out on Haiku in 3 of 4 runs.

Losses and non-results:

- Phase 1: on Sonnet the design skill made UI pages **worse** than plain Claude (it invented figures and tool descriptions, used 11 px text); that was fixed and re-tested as the gain above. The build skill on Haiku scored about 0.3 **below** no skill, and the re-test could not separate them. The entry skill alone (without the role skills visible) reached the intended skill in only 2 of 20 runs and scored about the same as no skills.
- Re-test: build and review were within noise, and a vague request did not reach the interview skill at all (0 of 8 runs).
- Interview, with a simulated user: when the prompt tells the model to use its skills, the shipped design asked before building in 16 of 16 runs (Haiku and Sonnet); plain Claude built straight away in 14 of 14. Without that nudge, Haiku never asked (0 of 8) and Sonnet asked in 5 of 8 (loading the interview skill in 3). If the brief says nobody can answer, the model builds anyway. So the interview helps when the model is pointed at its skills, not on its own.

Not measured: long real projects, any model other than Haiku, Sonnet and Opus, or the effect of the mods on cost over real use.

## Credits and licence

mistif is MIT-licensed, see [LICENSE](LICENSE). The hud and effort mods adapt **Effortless** by HeyCubit (MIT), and lean mode follows the structure and ideas of **ponytail** by Dietrich Gebert (MIT), reworded, and the decide skill by **Court of Claude** by Alex Chen (MIT). Who made what, under which licence, and what we changed is in [CREDITS.md](CREDITS.md) and [NOTICE.md](NOTICE.md), or run `/mistif:credits`. If you reuse parts of this repository, keep those files and the licence texts with it.

## Develop

Bump the plugin's `version` in `plugins/mistif/.claude-plugin/plugin.json` in every commit that changes the plugin; installed copies stay on their version until the string changes. Before a commit:

```bash
claude plugin validate . --strict
claude plugin validate plugins/mistif --strict
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test plugins/mistif
```
