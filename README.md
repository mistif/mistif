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

**Commands:** `/mistif:spec`, `/mistif:plan`, `/mistif:code-simplify`, `/mistif:credits`, `/mistif:hud`, `/mistif:lean`, `/mistif:ask`, `/mistif:update`.

**Mods** (hooks that run inside Claude Code):

- **hud**: one band above the prompt with the lean level, a cost graph, tokens and limits, plus a settings card (`/mistif:hud`).
- **effort**: chooses the reasoning effort per prompt, offers a handoff when a chat gets long (it asks before it clears the chat), shows the prompt-cache countdown. A cut-down adaptation of Effortless (see Credits).
- **explain**: when you type a `/command`, a short plain-words note about what it does appears above the prompt.
- **agents-pane**: `/agents-pane` lists running subagents.
- **lean mode**: `/mistif:lean off|lite|full|ultra` adds a short section to the system prompt that asks for the smallest complete change, reuse before writing, and a short reply that says what was skipped. Off by default.
- **ask**: `/mistif:ask off|auto|on` (default auto). A local check, with no model call, on the first prompt of a session: if it asks to build something, names no file, path or code, and is under 60 words, one short rule is attached to that prompt telling Claude to ask before building (measured: Haiku and Sonnet asked first in 8 of 8 vague dialogues, at about +30% to +55% cost, and clear briefs got no questions). It exists because the benchmark showed skills changed the outcome only on vague requests; it costs more tokens when it fires, and it is silent for everything else. auto is off in headless runs; `MISTIF_ASK=on|off|auto` in the environment overrides the saved choice.
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

**Short version: on everyday coding work, mistif did not measurably beat plain Claude, and its skills cost extra tokens when they load.** Read this before you decide to use it.

All tests were small blind runs (2 to 4 runs per cell; a gap under about 0.4 on a 1 to 5 score, or 25 points of pass rate, is noise). The reports are in [evals/](evals/README.md); raw runs are not included.

What the tests showed:

- **Build, bug fix, review, tests (Haiku and Sonnet):** the public benchmark (324 runs) scored mistif 4.47 and plain Haiku 4.51, a tie. A difficulty ladder of 19 tasks, up to a 24-clause feature, 32 hidden mutants and a 14-defect review, found no level where mistif beat the base model: base Haiku and Sonnet already passed nearly everything. Loading a skill added about 12% (Haiku) to 32% (Sonnet) to the cost of a run.
- **Whole app, idea to ship (a good idea and two bad ones):** no measurable benefit at any stage. The idea-check skills (`decide`, `interview`) loaded in none of 18 mistif sessions, because the idea was presented as already decided. The obvious bad idea was flagged by every condition, plain Haiku included; the subtle one (a town marketplace with a 10% fee) was missed by all of them.
- **Where it did change the result:** a vague first request such as "build me an app". Plain Sonnet asked before building in 2 of 8 dialogues and mistif-Sonnet in 8 of 8, with a better brief; `/mistif:ask` extends this to Haiku (0 of 8 off, 8 of 8 on). It costs about 30% to 56% more when it fires. Decisions also scored higher (4.62 vs 4.12; one task, 4 runs). The design skill's phone pages had slightly larger text (15 px or more) in the whole-app test.
- **Where it was worse:** unprompted UI pages in the public benchmark (3.94 vs about 4.6 for the others; partly fixed in 1.0.31, not fully matched), and the design pages' small tap targets.
- **Earlier, easier tests (before 1.0.19):** skills vs no skills scored +0.33 (95% interval +0.16 to +0.50), mostly from fan-out, prompts and decisions, and mostly on Opus and Sonnet; Haiku's gain was not distinguishable from zero. Models do not load the skills on their own unless pointed at them.

What that means: treat the skills as optional. The parts with evidence are the vague-request question (`/mistif:ask`) and decisions; the mods (`/mistif:update`, the HUD, the effort mod) are tools, not quality boosters.

Not measured: very large or unverifiable work, long real projects, `lean-agents` (no test run tempted any model to fan out), any model other than Haiku, Sonnet and Opus, or the mods' effect on cost over real use.

## Credits and licence

mistif is MIT-licensed, see [LICENSE](LICENSE). The hud and effort mods adapt **Effortless** by HeyCubit (MIT), and lean mode follows the structure and ideas of **ponytail** by Dietrich Gebert (MIT), reworded, and the decide skill by **Court of Claude** by Alex Chen (MIT). Who made what, under which licence, and what we changed is in [CREDITS.md](CREDITS.md) and [NOTICE.md](NOTICE.md), or run `/mistif:credits`. If you reuse parts of this repository, keep those files and the licence texts with it.

## Develop

Bump the plugin's `version` in `plugins/mistif/.claude-plugin/plugin.json` in every commit that changes the plugin; installed copies stay on their version until the string changes. Before a commit:

```bash
claude plugin validate . --strict
claude plugin validate plugins/mistif --strict
CLAUDE_CODE_ENABLE_FUNCTION_HOOKS=1 claude plugin test plugins/mistif
```
