---
name: mistif
description: Entry point for software work. Use at the start of a task to pick the next step (clarify, plan, build, review, ship, design, decide) and the cheapest way to do it. Not for one-line questions.
---

# mistif

**Vague request** (it does not say what to build, for whom, or what done means)? Interview first. Build nothing and write no file until the brief is approved:
1. Ask ONE question per turn, then stop and wait for the answer. At most five questions.
2. Attach your best-guess default to each, so a short answer works. Never ask what a file in the repo can answer.
3. Stop when you can write a one-paragraph brief and a short acceptance list ("done means: ...") in the person's own words, with your assumptions marked.
4. Show them, ask "Right?", and on a yes hand the brief to `mistif:build`.

**Unattended** (nobody can answer): do not build. Return the brief, the acceptance list and your stated assumptions, then stop and say how to continue ("reply with changes, or 'go' to build from this brief"). The long version is `mistif:interview`.

A signpost. Read the request, name the situation, hand over to one skill, and keep the spend visible. Do not narrate this; one or two lines, then go.

## 1. What is the situation?

| If the request is... | Go to |
|---|---|
| vague or a loose idea | the interview above |
| a spec or written quality bar wanted | `mistif:interview` |
| clear but large, or spans several files | `mistif:build` (plan mode) |
| clear and small, or a plan exists | `mistif:build` (build mode) |
| tests to write or repair, a bug to reproduce as a test, flaky or slow tests | `mistif:test` |
| a bug or an unexpected result | `mistif:build` (fix mode), or `superpowers:systematic-debugging` if it is already running |
| "is this good / safe / fast" about existing code, a second opinion, or a UI to check in a browser | `mistif:review` |
| about to release, merge or deploy; CI, logging, retiring something, git, decision records | `mistif:ship` |
| how something looks, reads or feels, or building UI components | `mistif:design` |
| a choice with real stakes between options | `mistif:decide`, only if asked |
| writing a prompt for another AI tool | `mistif:prompt` |
| "which tool should I use" | `mistif:which-tool` |

If none fits, say so and carry on without a skill. If two fit, pick the one that comes first in the workflow and mention the other once.

## 2. How big is it?

Size the work before spending on it.

- **Trivial** (one file, one obvious change): just do it. No skill, no plan.
- **Small** (a few files, clear outcome): build, test, commit.
- **Large or unclear**: clarify first, then plan, then build in small steps. Do not start building until you can state the outcome in a sentence.

## 3. Spend line

**Lite.** If the system prompt says "Lite usage", that is the budget for every skill: inline or at most one agent, no peer-review round, short outputs, no fan-out unless asked. Say it in the spend line, read a skill's main file only (a reference only when stuck), and skip stages a skill marks optional.

Before work that spawns agents, runs a long search or loads several large skills, say one line: what you will use and roughly what it costs. For agents, follow `mistif:lean-agents`: inline first, one agent next, more only with a reason and a yes.

Load only the skill you are about to use. Several skills in one turn is a sign you are still unsure what the task is.

## 4. Order of preference

1. What the person said in this conversation.
2. The project's own instructions and tooling (CLAUDE.md, its test and lint commands).
3. A mistif skill.
4. Your own habits.

Hand over and do the work. After build, review or ship work, report what changed and what you did not check; a first-turn question needs no such footer.
