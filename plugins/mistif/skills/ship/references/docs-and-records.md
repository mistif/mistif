# Docs and records

## Decision record layout
If the project has none, use `docs/decisions/NNNN-short-title.md`, numbered in order:
```
Title
Status: proposed | accepted | superseded by NNNN | deprecated
Context: the situation and the constraints
Options considered: each with why it was or was not chosen
Decision: what we will do
Consequences: what gets easier, what gets harder
```
Never edit an accepted record's decision; write a new one that links back.

## README skeleton
What it is, how to install, how to run, how to test, where things live, where to ask.

## Other docs
- API docs sit beside the types they describe.
- Change notes are written with the change.
- The agent rules file (CLAUDE.md or similar) is updated when commands or conventions change.
- A comment states a reason that the code cannot show.

## Editing prose safely
1. List every name, number, command, path, condition and caveat in the original.
2. Edit.
3. Check that each is still there and unchanged.
4. Add no example or guarantee that the source did not give.
