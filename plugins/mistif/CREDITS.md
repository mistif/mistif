# Credits

mistif stands on other people's work. This lists what in this repository is adapted from, inspired by, or named after someone else's project: who made it, its licence, and what we did. If something here is wrong or missing, open an issue or fix it in this file. (`plugins/mistif/CREDITS.md` is a copy of this file so that `/mistif:credits` works from an installed plugin; keep the two identical.)

Everything not listed below was written for mistif and is MIT-licensed, see `LICENSE`.

## Adapted (code or tests from another project)

| What in mistif | Made by | Licence | What we did |
|---|---|---|---|
| `plugins/mistif/hooks/hud.tsx` (the hud mod): the look (palette, panel and art style, ember warning colours) | Effortless by HeyCubit, https://github.com/HeyCubit/effortless | MIT | Style adapted. The footer row (modes, effort word, buttons, cache timer) copies the layout and colours of Effortless's own footer and reads its state; the code is ours. |
| `plugins/mistif/hooks/effort.tsx` (the effort mod): working copy of Effortless 1.71.0 | Effortless by HeyCubit | MIT | Renamed and cut down from about 5,400 to about 1,650 lines: no screens of its own (the hud mod draws them), no update check, no setup guide, no themes, no agent panel, no Haiku compaction, no cheaper-model routing. The effort judge, Save mode, handoff, cache countdown and stats are its code, with the handoff changed to ask before it clears the chat. Part of its test suite is Effortless's, adapted. `plugins/mistif/bench/judge-cases.json` is Effortless's own file (75 cases), unchanged. Its licence is kept as `plugins/mistif/LICENSE-EFFORTLESS`. |
| `vendor/effortless-1.71.0`: backup copy | Effortless by HeyCubit | MIT | Unmodified copy of its hooks and commands (with its own `LICENSE`). Not enabled, kept so we can compare against it. |

## Inspired by (ideas only, written again here)

| What in mistif | Made by | Licence | What we did |
|---|---|---|---|
| `/mistif:lean` and `plugins/mistif/hooks/lean.tsx` (lean mode: levels off, lite, full, ultra) | ponytail by Dietrich Gebert, https://github.com/DietrichGebert/ponytail | MIT | Follows ponytail's structure and ideas, reworded: levels, the order of preferences (leave it out, reuse, built-ins, installed packages, one line, then new code), finishing the whole job, never cutting checks at trust boundaries, a shortcut comment, and a closing note on what was skipped. The wording was written again (shared runs of 8 or more words with ponytail's files: none, checked with `scripts/similarity.py`, which does not catch paraphrase). No code copied. Nobody needs ponytail installed. |
| `mistif:decide` (`plugins/mistif/skills/decide`) | Court of Claude by Alex Chen (alexyc9381), https://github.com/alexyc9381/court-skill | MIT (checked on GitHub, 2026-10-25) | Inspiration only: the idea of putting a decision through a structured, multi-viewpoint review that ends in a clear verdict. The skill was written from scratch; no text or code of Court of Claude is in mistif. |

## Named, not copied

The which-tool list (`plugins/mistif/hooks/recommended.json`, `plugins/mistif/hooks/builtins.json`) names skills that other people or Anthropic make, so it can recommend them when they are installed: superpowers by Jesse Vincent (obra, MIT), crash-test-skill by Alex Chen (MIT), the Claude Code built-in commands, and Anthropic's own plugins and skills (see their repositories for licences). Only their names and a one-line "use it when" written here are in this repository; none of their code or text is.

## Earlier versions

Earlier private versions of mistif carried copies of other people's skills: agent-skills by Addy Osmani (MIT), superpowers by Jesse Vincent (MIT), ring by Lerian Studio (Apache-2.0), anti-slop by miqdadbadjuber (MIT), taste-skill by Leonxlnx (MIT), ui-ux-pro-max-skill by nextlevelbuilder (MIT), prompt-master by nidhinjs (MIT), playwright-cli by Microsoft (Apache-2.0), hiring-panel-skill by Alex Chen (MIT), karpathy-guidelines by forrestchang (MIT) and design-doc-mermaid by Rick Hightower (MIT). Those copies were removed before this release. The current skills were written again from behaviour descriptions, not from the removed text; a comparison with the old copies (`scripts/similarity.py`) found no shared run of 8 or more words except a list of manifest file names. That check does not catch paraphrase, and common practices (test first, small steps, plain-language review, avoiding stock UI patterns) are shared with many such skill sets. We list the projects here so the lineage is not hidden.

## Method

Where we changed someone's skill, we compared the new version against the original with blind tests before using it. See `evals/`.
