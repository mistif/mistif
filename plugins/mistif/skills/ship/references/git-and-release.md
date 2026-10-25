# Git and release

## Commit subject types
`feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`. Subject in the imperative, under about 70 characters; the body says why.

## Undo, mildest first
| Want | Command | What it costs |
|---|---|---|
| discard changes in one file | `git restore <file>` | that file's uncommitted edits are gone |
| cancel a pushed or shared commit | `git revert <sha>` | nothing; adds a commit |
| try again from a safe point | `git switch -c <name> <sha>` | nothing |
| undo commits but keep the work | `git reset --soft <sha>` or `--mixed` | history rewritten locally |
| throw everything away | `git reset --hard <sha>` | **needs a yes**; note the current `git rev-parse HEAD` first |
| delete a branch | `git branch -D <name>` | **needs a yes**; note its tip first |

## Releasing
1. Tree clean, checks green.
2. Decide the version from what consumers can see.
3. Update the change list.
4. Tag. Pushing the tag or publishing needs a yes.

## Change list skeleton
Grouped as Added, Changed, Fixed, Removed, Security. One line each, written for someone who uses the thing, not someone who built it.
