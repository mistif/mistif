---
name: which-tool
description: Recommends which installed skill, plugin or command fits what the user is trying to do, by searching what is installed. Use when they ask what tool or skill to use or how to approach something, or at the start of substantial work.
---

# Which tool when

The user may have hundreds of skills and plugins installed and use a few. Surface the right one at the moment it applies, with the reasoning, so they learn to recognise the pattern themselves.

## Steps

1. **State the goal in one line.** From the conversation: what the user is trying to do, and what they have already tried. Specific beats general ("verify the retry logic really backs off after a failed payment", not "testing").
2. **Get the menu.** Run `python "<this skill's base directory>/../../hooks/explain.py" --menu "<that line>"` (use `python3` if `python` is not found). It prints two parts: a curated list of recommended skills, each with a plain "use it when" line and how often the user has used it (`you used it 26x`, shown only when the environment variable MISTIF_USAGE=1 is set), then a few other installed skills that match the words. Plugins switched off in this project are marked `[OFF here: enable "plugin@marketplace"]`.
3. **Choose one, at most two, by meaning.** Read the curated list as a person would: pick the one whose "use it when" fits the situation, even if no words overlap ("the numbers look wrong and I cannot tell why" fits debugging). Use how often the user has used a skill only to break a tie between equals, never to override a clearly better fit. Look at the keyword part only if nothing in the curated list fits. If nothing fits, say so plainly and suggest how they could phrase the task instead. Never invent a skill.
4. **Answer in plain words, three or four sentences:** the pick, why it fits what they are doing right now, and the close alternative you passed over and why it lost. Skip the alternative only if there truly is none.
5. **If the pick is OFF here,** say so and give the one fix: add `"<plugin>@<marketplace>": true` to `enabledPlugins` in this project's `.claude/settings.json`, then restart. Offer to do it.
6. **Then get on with the work.** This is a signpost, not a detour. If the pick is a skill that is on, use it.

