# Diff guard

Purpose: catch an agent lowering the bar to get green. Run it on the diff against the base branch, including untracked files.

## What it flags
- loosened thresholds or removed rules in config and in `CONSTRAINTS.md`;
- tests skipped, disabled or deleted without a stated reason;
- assertions removed or weakened;
- new lint, type or scanner suppressions;
- stubs, `TODO: implement`, and empty error handlers;
- new entries in the exceptions list.

The shipped script automates the pattern-shaped ones (suppressions, skipped tests, stubs, empty handlers, possible secrets, removed assertions). Config and threshold changes need a look at the diff by eye.

## Output and exit codes
- Report each finding as rule plus `file:line`. Never print a secret's value.
- Exit code 0 clean, 1 violations found, 2 could not run (no git, no base branch).
- It only reads. It never edits or reverts.
- Patterns are adapted to the stack; the shipped script covers common JS/TS and Python forms.

## Use
```
python "<skill dir>/scripts/guard.py" [base-ref]
```
Default base is `origin/main`, falling back to `main`.
