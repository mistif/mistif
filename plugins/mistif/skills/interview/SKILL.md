---
name: interview
description: Use first whenever the request does not say what to build, for whom, or what done means; also for a spec or a written quality bar. Asks one question at a time, then saves a short result. Not for trivial asks or plain questions.
---

# interview

Find out what is wanted before anything is built. Four modes, chosen from the person's state, not their wording.

| Mode | Use it when | Result |
|---|---|---|
| clarify | the outcome, user, reason or limit is unknown, or they ask to be questioned. The default when unsure. | a restatement they approve |
| shape | there is an idea or a problem but no direction | a one-page direction note |
| spec | the direction is clear and a non-trivial change is about to start | `SPEC.md` |
| quality bar | no written standard exists, an agent keeps lowering checks to get green, or they ask for gates | `CONSTRAINTS.md` |

Choose the mode yourself. Only mention it if the choice is not obvious, and then in plain words ("first I'll check what you're after"), never by its label; they can still redirect you. Modes chain: clarify, then shape, then spec. Skip a mode whose result already exists. If a quality-bar file exists, read and obey it; change it only when asked.

In a non-interactive run (CI, a loop, nobody to answer) build nothing: return the brief, the "done means" list and what is missing as stated assumptions, then stop and say how to continue ("reply with changes, or 'go' to build from this brief").

## Rules for every mode

- Read the repo first. Never ask what a file can answer.
- One question per turn, with your best guess attached so they can react instead of compose.
- Say your assumptions out loud before building on them.
- "Whatever you think", "fine", "ok go" and silence are not approval. Turn them into a concrete two-way choice.
- End each mode by showing or saving the result, asking for approval, and ending the turn. Start no planning, code or installs in the same turn. Save files only after they confirm.
- Do not delegate the questioning. Follow `mistif:lean-agents` for anything else: inline by default.

## clarify

Open with one sentence on the need you think sits behind the request, not a guessed product or feature list, and an honest confidence figure. If it is low, say what is missing. Then ask your one question with its guess. A turn that asks a question carries no summary footer and no coverage line.

Cover five things: who benefits, why now, how success will be tested, the limit that binds hardest, and what is out of scope. Ask at most five questions in all; stop sooner once you can write a one-paragraph brief and a short "done means" list in their words. A vague request gets this mode first.

- If an answer sounds like fashion or duty ("scalable", "the usual way"), ask what they would pick if they owed nobody a reason.
- For anything that will take real effort or money, also ask for three lines before saying go: what plain Claude already does for this today (the baseline), what result would make them stop (the kill line), and a cap on time and spend. If they have no baseline, offer a short test first.
- Stop when you can predict their next few answers. If many rounds do not get you there, say something basic is missing and offer to step back.
- Finish with a short restatement in their words covering the five points, plus the "done means" list. Wait for a clear yes, then hand it to `mistif:build`. Offer to save it; do not save unasked.

Prevents: building the conventional thing, silent assumptions, polite false agreement, unstated exclusions.

## shape

Restate the problem sharply. Ask at most five sharpening questions, and do not move on until you know the user and the success test. In a repo, scan the existing code first and root the options in it.

- Diverge: five to eight really different options, each with a reason. Never twenty. Lenses are in `references/shape-lenses.md`.
- Converge after they react: two or three directions, judged on user value, feasibility and difference from what exists. For each, say what is being bet on, what would kill it, and what is knowingly ignored.
- Be candid about weak ideas. Prefer the simplest version that solves the real problem; the first scope should test the riskiest assumption with one job.
- Save a one-page note (default `docs/ideas/<name>.md`, after confirmation) with: problem, chosen direction and why, assumptions each with a test, minimal scope, a cut-list with reasons (required), open questions.

Prevents: option floods, flattery, designing for nobody, hidden assumptions, scope creep.

## spec

Check scale first. If one request bundles several capabilities that could ship and be checked separately, propose a small capability map before any spec (rules in `references/spec-fields.md`). Once they approve it, write the specs one by one, starting from the module nothing else depends on. A single capability skips this.

- List assumptions (platform, auth, data store, targets) first and invite correction.
- If the project already has a spec format, keep it.
- Turn vague wishes into pass/fail targets and confirm them.
- Fields to fill are in `references/spec-fields.md`. Save as `SPEC.md` at the repo root, or one file per module.
- Summarise, list open questions, ask for approval, end the turn. Planning is a later turn, with `mistif:build`.

Prevents: coding on guesses, spec after code, oversized specs, limits nobody wrote down.

## quality bar

Detect first: stack, test runner, linters, coverage, CI, agent setup. Report it in two lines. Then ask at most four questions, each with a guess and a default so "don't know" works:

1. Which extra dimensions to enforce (new-code coverage, security, performance, accessibility, architecture). Performance and accessibility need a running URL, so drop them for CLIs and libraries.
2. Block or warn on failure.
3. Set numbers now, or measure first and hold the line.
4. The slowest check they will tolerate.

Save the contract as `CONSTRAINTS.md` in the repo's top folder. It holds: review date and owner; always-on rules; enforced rules, each with the exact command and where it runs; measured-only metrics with today's value and the direction that must not worsen; exceptions with an owner and a short expiry. Every number carries its reason. Details, tools and placement rules are in `references/quality-bar.md`.

- A rule with no command is a wish. Install the standard tool for each chosen dimension rather than inventing one.
- Measuring and holding beats demanding numbers the code fails today.
- Include at least one outside judge (a scanner, a browser measurement). Tests the agent wrote itself are circular.
- Add one line to the agent instruction file: read the contract, never weaken it.
- Run it once on the branch and fix any rule they dispute now.

Subcommands: `check` runs the rules; `guard` inspects the diff for a lowered bar (see `references/guard.md` and `scripts/guard.py`); `ratchet` records current values as the new floor.

Prevents: unwritten standards, unenforced numbers, skipped slow checks, quiet relaxation by agents, ownerless exceptions.

## Before you finish

- Did you ask anything a file could have answered?
- Is every assumption said aloud, and every result approved before saving?
- Did you stop at "what is wanted, what to build, what bar to hold"?
