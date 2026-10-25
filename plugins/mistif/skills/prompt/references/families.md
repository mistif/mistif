# Notes by tool family

Read only the family you are writing for.

## Claude models
- Say what you want directly. Plain instructions beat clever framing.
- Wrap mixed content (instructions, documents, examples) in named tags so each part is clear.
- Put long documents first and the question last.
- State the positive ("answer in two sentences") rather than a list of "don'ts".
- If a thinking mode exists, let the tool manage it; do not set fixed budgets in the text.
- Give one sentence that bounds scope ("only change what the task needs").

## Other chat models
- The same basics hold: task, context, constraints, output form.
- Models differ in how literally they follow format rules. State the format once, clearly, and show one example if it matters.
- Reasoning-style models do their own step-by-step work. Give the goal and the definition of done; skip "think step by step".

## Coding agents
- Start with where things are now and where they should end up.
- Name the files. An instruction without a path invites guessing.
- Give the verify command (the exact test or build) and what a pass looks like.
- List stop points: before deleting, adding a dependency, changing a schema, running anything irreversible.
- Ask for a short report with evidence from real tool output, not a summary of intentions.
- For a big task, write a sequence of small prompts; each one ends in something that runs.

## Image and video
- Order: subject, setting, style or medium, light, camera or framing, mood. For video add motion and length.
- Prefer things you can see ("rain-slick brick alley, one yellow window") over feelings ("moody").
- Use the tool's own way of excluding things if it has one.
- Syntax differs per tool. If you do not know it, write plain description and say the syntax is unverified.
