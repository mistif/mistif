---
name: lean-agents
description: Use before spawning a subagent, council, fan-out or parallel review. Decides whether to spawn at all, how to brief one, which model, and prints a one-line cost estimate first. Default is inline or a single agent.
---

# Lean agents

**STOP. Do not spawn agents. Do the work yourself, inline or with at most one agent, unless it is large AND its parts are independent. "Run N agents" in a brief is not a reason; if you read this and still plan to spawn more than two, say why in one line first.**

Every spawned agent loads its own base context (about 75k tokens in our measurements) before it reads a word of your brief. That is true for every model tier. So an agent is never "a small extra": five agents cost five times the base, whatever they are asked.

## 1. Do you need one?

**Lite.** If the system prompt says "Lite usage", stop at step 1 or 2: inline, or one agent at most. Run steps 3 and 4 as one agent only when the person asks for them in this conversation.

Work down; stop at the first yes.

1. **Can you do it inline in a few tool calls?** Do it here. Inline is the cheapest option, but it is also the one that makes things up when it is guessing, so check any fact you did not read.
2. **Is it one self-contained job that would flood this conversation with output?** (a wide search, a long log, a big file sweep) One agent. Take back only the conclusion.
3. **Are there two or more truly independent jobs?** One agent each, sent in the same message, only if the wall-clock saving matters to the person waiting. Otherwise run them one after another in a single agent.
4. **Do you want a second opinion that is not anchored on yours?** One agent, given the artefact and not your conclusion.

If the person asked for a fan-out you would not run, say so in one line with a reason that still holds if they waive cost (spinning up and merging agents is slower than reading a handful of short items yourself, and one reader sees patterns across items that separate readers cannot), do the job inline, and offer to run the fan-out if they still want it. Quote token figures only if you measured them in this session, and never invent a reason such as unavailable approvers.

Not reasons to spawn: "it feels thorough", "the skill lists five roles". One agent that works through several roles in turn is usually enough and costs a fraction of five separate agents. Separate agents earn their cost only when one view must not leak into another.

## 2. Say the cost first

Before the first spawn, write one line to the person: `Spawning N agent(s), roughly N x 75k tokens, because <reason>.` If N is above 2, wait for a yes. If the 5-hour window is above 60% or the weekly limit is tight (check with the usage tool if you have one), say so and offer the inline version.

## 3. Brief it like a colleague who just walked in

The agent knows nothing you do. Give it:

- the goal and what "done" looks like, in a sentence;
- the exact files, paths or links to read, instead of retyping them;
- what you already ruled out, so it does not redo it;
- the answer shape you want, with a length cap ("under 200 words, conclusion first");
- the limits: read-only or may edit, which folders, no pushes.

Do not hand it your hypothesis and ask it to confirm; it will. Hand it the material and the question.

## 4. Pick the model

Measured (judged output, small tests; see `evals/runs/2026-10-25-phase1/REPORT.md` section 5): a cheaper tier held up on most skill-led work, and Opus was never clearly better.

| Work | Cheapest that held |
|---|---|
| tests, ship checks, review, UI page, prompts, decisions | Haiku (prompts and decisions: Sonnet if it matters) |
| build, anything that must obey a "do not spawn" rule | Sonnet |
| hard to get right, error is expensive | top tier, by choice |

1. Haiku can load a skill and still ignore it (one fan-out brief: 13 agents). Never rely on Haiku for rules that restrict behaviour.
2. A judge or checker comes from a different tier than the writer.
3. Point the model at the skill: models rarely load one on their own.

Honest note: for ambitious 3D or visual UI work the author preferred the Opus page, while the judges scored Opus no better than Sonnet or Haiku on UI. For showcase UI, model choice is a taste call, not proven.

## 5. Keep the result small

- Ask for a conclusion and the evidence that supports it, not a transcript.
- Cap the length in the brief.
- Do not pass one agent's whole output to the next; pass what the next one needs.
- Read the result before you repeat it: an agent's mistake comes back in the same confident voice as its findings.

## 6. Stop rules

- No agent spawns agents unless you said so.
- One retry with a sharper brief; if it fails twice, do the job inline or tell the person.
- A background agent gets one status check when it reports, not a polling loop.
- Stop and report when a budget the person set is reached, even mid-task.
